import { formatEther, type Hash } from 'viem';
import { Config } from '../config/Config';
import { logger } from '../utils/Logger';
import { BlockchainService } from '../services/BlockchainService';
import { EventManager } from '../services/EventManager';
import { StateManager } from '../services/StateManager';
import { DecisionEngine } from '../services/DecisionEngine';
import { createDecisionEngine } from '../createDecisionEngine';
import { ProfitCalculator } from '../services/ProfitCalculator';
import { YEET_GAME_ABI } from '../contracts/abis';
import { RuleContext, YeetDecision } from '../core/types';
import { BGTClaimService } from '../services/BGTClaimService';

export class BotRunner {
  private config = Config.getInstance().get();
  private blockchain = BlockchainService.getInstance();
  private eventManager = EventManager.getInstance();
  private stateManager = StateManager.getInstance();
  private decisionEngine: DecisionEngine;
  private profitCalculator: ProfitCalculator;
  private bgtClaimService = BGTClaimService.getInstance();
  private isRunning = false;
  private checkInterval?: NodeJS.Timeout;
  private shutdownPromise?: Promise<void>;
  private yeetMutex: Promise<void> = Promise.resolve();
  private yeetLockCount = 0;
  private lastStatusLog?: number;
  
  constructor() {
    // Initialize decision engine with configuration
    this.decisionEngine = createDecisionEngine({
      bgtEqualsPriceBuffer: this.config.strategy.rules.bgtEqualsPriceBuffer,
      marketPriceDiscountThreshold: this.config.strategy.rules.marketPriceDiscountThreshold
    });
    this.profitCalculator = new ProfitCalculator();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Set up graceful shutdown
    this.setupShutdownHandlers();
  }
  
  private setupEventHandlers(): void {
    this.eventManager.setHandlers({
      onYeetCreated: async (event) => {
        logger.info('Yeet created - updating state', {
          yeeter: event.yeeter,
          amount: formatEther(event.amount),
          newPrice: formatEther(event.newPrice),
        });
        
        // Check if it was our yeet
        const ourWallets = new Set([this.blockchain.getAccount().address.toLowerCase()]);
        if (this.stateManager.isOurWallet(event.yeeter, ourWallets)) {
          logger.info('Our yeet was successful!', {
            amount: formatEther(event.amount),
            price: formatEther(event.newPrice),
          });
          this.stateManager.recordYeetAttempt(true, event.amount);
        }
      },
      
      onAuctionCreated: async (event) => {
        logger.info('Auction phase started', {
          startPrice: formatEther(event.startPrice),
          endPrice: formatEther(event.endPrice),
          duration: event.duration.toString(),
        });
        
        // Start monitoring for opportunities
        this.startMonitoring();
      },
    });
  }
  
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
  
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }
    
    logger.info('Starting Yeet Bot V2', {
      environment: this.config.environment,
      dryRun: this.config.safety.dryRun,
      maxYeetAmount: this.config.strategy.maxYeetAmount,
      wallet: this.blockchain.getAccount().address,
    });
    
    try {
      // Check blockchain connection
      const health = await this.blockchain.checkHealth();
      if (!health.connected) {
        throw new Error('Failed to connect to blockchain');
      }
      
      logger.info('Blockchain connected', {
        chainId: health.chainId,
        blockNumber: health.blockNumber?.toString(),
        gasPrice: health.gasPrice ? formatEther(health.gasPrice) : undefined,
      });
      
      // Check wallet balance
      const balance = await this.blockchain.getBalance();
      logger.info('Wallet balance', {
        balance: formatEther(balance),
        minRequired: this.config.safety.minWalletBalance,
      });
      
      const minBalance = Config.getInstance().getMinWalletBalanceWei();
      if (balance < minBalance) {
        throw new Error(`Insufficient balance: ${formatEther(balance)} BERA`);
      }
      
      // Start event manager
      await this.eventManager.start();
      
      // Start BGT claim service if enabled
      if (this.config.strategy.bgtClaiming?.enabled !== false) {
        const interval = this.config.strategy.bgtClaiming?.intervalMinutes;
        this.bgtClaimService.start(interval);
      }
      
      // Start monitoring
      this.isRunning = true;
      this.startMonitoring();
      
      logger.info('Bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot', error as Error);
      throw error;
    }
  }
  
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    logger.info('Stopping bot...');
    this.isRunning = false;
    
    // Stop monitoring
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    // Wait for any pending yeet operations to complete
    await this.yeetMutex;
    
    // Stop services
    await this.eventManager.stop();
    this.bgtClaimService.stop();
    await this.blockchain.cleanup();
    
    // Log final stats
    const stats = this.stateManager.getSessionStats();
    const bgtStats = this.bgtClaimService.getStats();
    logger.info('Session statistics', {
      totalYeets: stats.totalYeets,
      successfulYeets: stats.successfulYeets,
      failedYeets: stats.failedYeets,
      totalSpent: formatEther(stats.totalSpent),
      totalBgtEarned: formatEther(stats.totalBgtEarned),
      successRate: `${stats.successRate.toFixed(2)}%`,
      sessionDuration: `${Math.floor(stats.sessionDuration / 1000 / 60)} minutes`,
    });
    
    // Log BGT claim stats
    logger.info('BGT claim statistics', {
      totalClaimed: formatEther(bgtStats.totalClaimed),
      totalRedeemed: formatEther(bgtStats.totalRedeemed),
      claimCount: bgtStats.claimCount,
      redeemCount: bgtStats.redeemCount,
    });
    
    logger.info('Bot stopped');
  }
  
  private startMonitoring(): void {
    if (this.checkInterval) {
      return;
    }
    
    logger.info('Starting opportunity monitoring');
    
    // Check immediately
    this.checkForOpportunity();
    
    // Then check periodically
    this.checkInterval = setInterval(() => {
      if (this.isRunning) {
        this.checkForOpportunity();
      }
    }, 1000); // Check every second during auction
  }
  
  private async checkForOpportunity(): Promise<void> {
    try {
      const state = this.stateManager.getState();
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      
      // Skip if not in auction phase or in cooldown
      if (!realtimeAuction?.isAuctionPhase || state.isInCooldown) {
        // Still evaluate rules for dashboard display during non-auction
        if (realtimeAuction) {
          const bgtRewards = this.stateManager.calculateCurrentBgt() || { 
            bgtPerSecond: 0n, 
            totalAccumulated: 0n, 
            timeElapsed: 0 
          };
          
          // Calculate profit metrics even during non-auction phase
          const profitMetrics = this.profitCalculator.calculateProfitMetrics(
            realtimeAuction.leaderAmount || realtimeAuction.currentPrice,
            bgtRewards
          );
          
          const ruleContext: RuleContext = {
            auction: realtimeAuction,
            bgtRewards,
            profit: profitMetrics,
            wallet: {
              address: this.blockchain.getAccount().address,
              isOurWallet: false,
            },
            config: {
              othersProfitThreshold: this.config.strategy.rules.othersProfitThreshold,
              selfProfitThreshold: this.config.strategy.rules.selfProfitThreshold,
              blacklistProfitThreshold: this.config.strategy.rules.blacklistProfitThreshold,
              snipeBufferSeconds: this.config.strategy.rules.snipeBufferSeconds,
              blacklistedAddresses: new Set(
                this.config.strategy.rules.blacklistedAddresses.map(a => a.toLowerCase())
              ),
              maxAuctionFactor: this.config.strategy.rules.maxAuctionFactor,
              ourWallets: new Set([this.blockchain.getAccount().address.toLowerCase()]),
              maxYeetAmount: this.config.strategy.maxYeetAmount,
            },
            lastPaidPrice: state.auction.lastPaidPrice,
          };
          
          // Evaluate for display only - no action taken
          this.decisionEngine.evaluate(ruleContext);
        }
        return;
      }
      
      // Log active monitoring every 10 seconds
      const now = Date.now();
      if (!this.lastStatusLog || now - this.lastStatusLog > 10000) {
        this.lastStatusLog = now;
        logger.info('📡 Monitoring auction - evaluating rules...', {
          currentPrice: realtimeAuction?.currentPrice ? formatEther(realtimeAuction.currentPrice) : 'N/A',
          activeRules: 5, // Number of rules in the system
        });
      }
      
      // Calculate current BGT rewards
      const bgtRewards = this.stateManager.calculateCurrentBgt();
      if (!bgtRewards) {
        return;
      }
      
      // Calculate profit metrics based on what the leader paid, not current price
      const profitMetrics = this.profitCalculator.calculateProfitMetrics(
        realtimeAuction.leaderAmount || realtimeAuction.currentPrice,
        bgtRewards
      );
      
      // Build rule context
      const ruleContext: RuleContext = {
        auction: realtimeAuction,
        bgtRewards,
        profit: profitMetrics,
        wallet: {
          address: this.blockchain.getAccount().address,
          isOurWallet: this.stateManager.isOurWallet(
            realtimeAuction.currentLeader,
            new Set([this.blockchain.getAccount().address.toLowerCase()])
          ),
        },
        config: {
          othersProfitThreshold: this.config.strategy.rules.othersProfitThreshold,
          selfProfitThreshold: this.config.strategy.rules.selfProfitThreshold,
          blacklistProfitThreshold: this.config.strategy.rules.blacklistProfitThreshold,
          snipeBufferSeconds: this.config.strategy.rules.snipeBufferSeconds,
          blacklistedAddresses: new Set(
            this.config.strategy.rules.blacklistedAddresses.map(a => a.toLowerCase())
          ),
          maxAuctionFactor: this.config.strategy.rules.maxAuctionFactor,
          ourWallets: new Set([this.blockchain.getAccount().address.toLowerCase()]),
          maxYeetAmount: this.config.strategy.maxYeetAmount,
        },
        lastPaidPrice: realtimeAuction.lastPaidPrice,  // Add last paid price to context
      };
      
      // Get decision from engine
      const decision = this.decisionEngine.evaluate(ruleContext);
      
      // The decision engine now always stores last evaluations internally
      // This ensures the dashboard can always access current rule states
      
      if (decision) {
        if (!decision.shouldYeet) {
          // A rule is blocking the yeet
          const blockingRule = decision.ruleName || 'Unknown';
          logger.warn(`🚫 BLOCKED by ${blockingRule}: ${decision.reason}`);
          return;
        }
        
        if (decision.shouldYeet) {
        // Determine which rule triggered based on ruleName or priority
        let ruleDisplay = 'Unknown Rule';
        if (decision.ruleName) {
          // Map rule names to display names with emojis
          const ruleDisplayMap: Record<string, string> = {
            'BGTEqualsCurrentPrice': '📊 BGT Equals Price Rule',
            'Blacklist': '🚫 Blacklist Rule',
            'SelfProtection': '🛡️ Self Protection Rule',
            'StandardSnipe': '🎯 Standard Snipe Rule',
            'Safety': '⚠️ Safety Rule'
          };
          ruleDisplay = ruleDisplayMap[decision.ruleName] || decision.ruleName;
        }
        
        logger.info(`🤖 DECISION: ${ruleDisplay}`, {
          reason: decision.reason,
          priority: decision.priority,
          currentPrice: formatEther(realtimeAuction.currentPrice),
          profitPercentage: profitMetrics.profitPercentage.toFixed(2),
        });
        
        // Execute yeet
        await this.executeYeet(decision);
        }
      }
    } catch (error) {
      logger.error('Error checking for opportunity', error as Error);
    }
  }
  
  private async executeYeet(decision: YeetDecision): Promise<void> {
    // Use mutex-based locking for proper concurrency control
    const lockId = ++this.yeetLockCount;
    
    this.yeetMutex = this.yeetMutex.then(async () => {
      // Check if this is still the latest lock request
      if (lockId !== this.yeetLockCount) {
        logger.debug('Yeet superseded by newer request');
        return;
      }
      
      await this.executeYeetInternal(decision);
    });
    
    await this.yeetMutex;
  }
  
  public getDecisionEngine(): DecisionEngine {
    return this.decisionEngine;
  }
  
  public pause(): void {
    if (!this.isRunning) {
      logger.warn('Bot is not running, cannot pause');
      return;
    }
    
    logger.info('Pausing bot monitoring');
    
    // Stop the monitoring interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    // Keep isRunning true so we can resume
    logger.info('Bot paused - monitoring stopped');
  }
  
  public resume(): void {
    if (!this.isRunning) {
      logger.warn('Bot is not running, cannot resume');
      return;
    }
    
    if (this.checkInterval) {
      logger.warn('Bot is already monitoring');
      return;
    }
    
    logger.info('Resuming bot monitoring');
    this.startMonitoring();
    logger.info('Bot resumed - monitoring restarted');
  }
  
  public async forceYeet(): Promise<void> {
    logger.info('Force yeet requested - using real-time price');
    
    try {
      // Get real-time auction state
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      if (!realtimeAuction) {
        throw new Error('No auction state available');
      }
      
      if (!realtimeAuction.isAuctionPhase) {
        throw new Error('Not in auction phase - cannot force yeet');
      }
      
      // Create a force yeet decision with real-time price
      const decision: YeetDecision = {
        shouldYeet: true,
        reason: 'Manual force yeet via API',
        priority: 999, // Highest priority
        ruleName: 'ForceYeet',
        metadata: {
          realtimePrice: realtimeAuction.currentPrice.toString(),
          timestamp: new Date().toISOString()
        }
      };
      
      logger.info('Executing force yeet with real-time price', {
        currentPrice: formatEther(realtimeAuction.currentPrice),
        currentLeader: realtimeAuction.currentLeader,
      });
      
      // Execute the yeet
      await this.executeYeet(decision);
    } catch (error) {
      logger.error('Force yeet failed', error as Error);
      throw error;
    }
  }
  
  private async executeYeetInternal(decision: YeetDecision): Promise<void> {
    try {
      const state = this.stateManager.getState();
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      if (!realtimeAuction) {
        throw new Error('No auction state available');
      }
      
      const yeetAmount = realtimeAuction.currentPrice;
      
      // Note: Max yeet amount check is now handled by SafetyRule
      // This provides better visibility in the dashboard
      
      // Check wallet balance
      const balance = await this.blockchain.getBalance();
      if (balance < yeetAmount) {
        logger.error('Insufficient balance for yeet', undefined, {
          required: formatEther(yeetAmount),
          balance: formatEther(balance),
        });
        return;
      }
      
      if (this.config.safety.dryRun) {
        logger.info('DRY RUN: Would execute yeet', {
          amount: formatEther(yeetAmount),
          gasMultiplier: decision.suggestedGasMultiplier,
        });
        this.stateManager.recordYeetAttempt(true, yeetAmount);
      } else {
        // Execute the transaction
        logger.info('Executing yeet transaction', {
          amount: formatEther(yeetAmount),
        });
        
        const hash = await this.blockchain.writeContract({
          address: this.config.contracts.yeetGame as `0x${string}`,
          abi: YEET_GAME_ABI,
          functionName: 'yeet',
          value: yeetAmount,
          gas: this.config.strategy.gasLimit,
        });
        
        logger.info('Yeet transaction sent', { hash });
        
        // Wait for confirmation
        const receipt = await this.blockchain.waitForTransactionReceipt(hash);
        
        if (receipt.status === 'success') {
          logger.info('Yeet successful!', {
            hash,
            gasUsed: receipt.gasUsed.toString(),
          });
          this.stateManager.recordYeetAttempt(true, yeetAmount);
        } else {
          logger.error('Yeet transaction failed', undefined, { hash });
          this.stateManager.recordYeetAttempt(false);
        }
      }
    } catch (error) {
      logger.error('Failed to execute yeet', error as Error);
      this.stateManager.recordYeetAttempt(false);
    }
  }
}

// Export convenience function
export async function runBot(): Promise<void> {
  const bot = new BotRunner();
  await bot.start();
  
  // Keep the process running with proper signal handling
  await new Promise<void>((resolve) => {
    process.once('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      bot.stop().then(() => resolve());
    });
    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      bot.stop().then(() => resolve());
    });
  });
}