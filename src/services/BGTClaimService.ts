import { formatEther, type Hash, type Account } from 'viem';
import { logger } from '../utils/Logger';
import { BlockchainService } from './BlockchainService';
import { Config } from '../config/Config';
import { BGT_REWARD_ABI, BGT_REDEEM_ABI, ERC20_ABI } from '../contracts/bgtAbis';

export interface ClaimStats {
  totalClaimed: bigint;
  totalRedeemed: bigint;
  lastClaimTime: Date | null;
  lastRedeemTime: Date | null;
  claimCount: number;
  redeemCount: number;
  failureCount: number;
}

export class BGTClaimService {
  private static instance: BGTClaimService;
  private blockchain = BlockchainService.getInstance();
  private config = Config.getInstance().get();
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private stats: ClaimStats = {
    totalClaimed: 0n,
    totalRedeemed: 0n,
    lastClaimTime: null,
    lastRedeemTime: null,
    claimCount: 0,
    redeemCount: 0,
    failureCount: 0,
  };
  
  private constructor() {}
  
  public static getInstance(): BGTClaimService {
    if (!BGTClaimService.instance) {
      BGTClaimService.instance = new BGTClaimService();
    }
    return BGTClaimService.instance;
  }
  
  /**
   * Start the BGT claiming service
   * @param intervalMinutes - How often to check and claim (default: from config)
   */
  public start(intervalMinutes?: number): void {
    if (this.isRunning) {
      logger.warn('BGT claim service is already running');
      return;
    }
    
    const interval = intervalMinutes || this.config.strategy.bgtClaiming.intervalMinutes;
    
    logger.info('Starting BGT claim service', {
      interval: `${interval} minutes`,
      account: this.blockchain.getAccount().address,
    });
    
    this.isRunning = true;
    
    // Run immediately on start
    this.processRewards();
    
    // Set up interval
    this.intervalId = setInterval(
      () => this.processRewards(),
      interval * 60 * 1000
    );
  }
  
  /**
   * Stop the BGT claiming service
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    logger.info('Stopping BGT claim service');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    this.isRunning = false;
    
    // Log final stats
    logger.info('BGT claim service stats', {
      totalClaimed: formatEther(this.stats.totalClaimed),
      totalRedeemed: formatEther(this.stats.totalRedeemed),
      claimCount: this.stats.claimCount,
      redeemCount: this.stats.redeemCount,
      failureCount: this.stats.failureCount,
    });
  }
  
  /**
   * Process rewards: claim -> check balance -> redeem
   */
  private async processRewards(): Promise<void> {
    const account = this.blockchain.getAccount();
    logger.info('Processing BGT rewards', { account: account.address });
    
    try {
      // Step 1: Claim rewards
      const claimSuccess = await this.claimRewards(account);
      
      if (!claimSuccess) {
        logger.warn('Failed to claim rewards, skipping redemption');
        this.stats.failureCount++;
        return;
      }
      
      // Wait a bit for the claim to process
      await new Promise(resolve => setTimeout(resolve, 
        this.config.strategy.bgtClaiming.processingDelayMs));
      
      // Step 2: Check balance
      const balance = await this.checkBalance(account);
      
      if (balance === 0n) {
        logger.info('No BGT balance available for redemption');
        return;
      }
      
      logger.info('BGT balance available', { balance: formatEther(balance) });
      
      // Step 3: Redeem balance
      await this.redeemBalance(account, balance);
      
    } catch (error) {
      logger.error('Error processing BGT rewards', error as Error);
      this.stats.failureCount++;
    }
  }
  
  /**
   * Claim BGT rewards
   */
  private async claimRewards(account: Account): Promise<boolean> {
    try {
      logger.info('Claiming BGT rewards...');
      
      if (this.config.safety.dryRun) {
        logger.info('DRY RUN: Would claim BGT rewards');
        this.stats.claimCount++;
        this.stats.lastClaimTime = new Date();
        return true;
      }
      
      const rewardAddress = this.config.contracts.bgtReward;
      
      const hash = await this.blockchain.writeContract({
        address: rewardAddress as `0x${string}`,
        abi: BGT_REWARD_ABI,
        functionName: 'getReward',
        args: [account.address, account.address], // Claim to own address
      });
      
      logger.info('BGT claim transaction sent', { hash });
      
      const receipt = await this.blockchain.waitForTransactionReceipt(hash);
      
      if (receipt.status === 'success') {
        logger.info('BGT rewards claimed successfully', {
          hash,
          gasUsed: receipt.gasUsed.toString(),
        });
        
        this.stats.claimCount++;
        this.stats.lastClaimTime = new Date();
        
        // Note: We can't easily track the amount claimed without parsing events
        // For now, we'll track it during redemption
        
        return true;
      } else {
        logger.error('BGT claim transaction failed', undefined, { hash });
        return false;
      }
    } catch (error) {
      logger.error('Failed to claim BGT rewards', error as Error);
      return false;
    }
  }
  
  /**
   * Check BGT balance on redeem contract
   */
  private async checkBalance(account: Account): Promise<bigint> {
    try {
      const redeemAddress = this.config.contracts.bgtRedeem;
      
      const balance = await this.blockchain.readContract({
        address: redeemAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as bigint;
      
      return balance;
    } catch (error) {
      logger.error('Failed to check BGT balance', error as Error);
      return 0n;
    }
  }
  
  /**
   * Redeem BGT balance
   */
  private async redeemBalance(account: Account, amount: bigint): Promise<boolean> {
    try {
      logger.info('Redeeming BGT balance...', { amount: formatEther(amount) });
      
      if (this.config.safety.dryRun) {
        logger.info('DRY RUN: Would redeem BGT', { amount: formatEther(amount) });
        this.stats.redeemCount++;
        this.stats.totalRedeemed += amount;
        this.stats.lastRedeemTime = new Date();
        return true;
      }
      
      const redeemAddress = this.config.contracts.bgtRedeem;
      
      const hash = await this.blockchain.writeContract({
        address: redeemAddress as `0x${string}`,
        abi: BGT_REDEEM_ABI,
        functionName: 'redeem',
        args: [account.address, amount], // Redeem to own address
      });
      
      logger.info('BGT redeem transaction sent', { hash });
      
      const receipt = await this.blockchain.waitForTransactionReceipt(hash);
      
      if (receipt.status === 'success') {
        logger.info('BGT redeemed successfully', {
          hash,
          amount: formatEther(amount),
          gasUsed: receipt.gasUsed.toString(),
        });
        
        this.stats.redeemCount++;
        this.stats.totalRedeemed += amount;
        this.stats.lastRedeemTime = new Date();
        
        // Track this as claimed amount too
        this.stats.totalClaimed += amount;
        
        // Log metrics
        logger.metric('bgt_redeemed', Number(formatEther(amount)), 'BGT', {
          total: formatEther(this.stats.totalRedeemed),
        });
        
        return true;
      } else {
        logger.error('BGT redeem transaction failed', undefined, { hash });
        return false;
      }
    } catch (error) {
      logger.error('Failed to redeem BGT', error as Error);
      return false;
    }
  }
  
  /**
   * Get current stats
   */
  public getStats(): Readonly<ClaimStats> {
    return { ...this.stats };
  }
  
  /**
   * Manually trigger a claim/redeem cycle
   */
  public async claimNow(): Promise<void> {
    logger.info('Manually triggered BGT claim');
    await this.processRewards();
  }
}

// Export singleton getter
export function getBGTClaimService(): BGTClaimService {
  return BGTClaimService.getInstance();
}