#!/usr/bin/env bun

import { BGTClaimService } from '../services/BGTClaimService';
import { BlockchainService } from '../services/BlockchainService';
import { logger } from '../utils/Logger';

// Manual BGT claim script
async function main() {
  try {
    logger.info('Manual BGT claim script');
    
    // Initialize blockchain service
    const blockchain = BlockchainService.getInstance();
    const health = await blockchain.checkHealth();
    
    if (!health.connected) {
      throw new Error('Failed to connect to blockchain');
    }
    
    logger.info('Connected to blockchain', {
      chainId: health.chainId,
      account: blockchain.getAccount().address,
    });
    
    // Get BGT claim service
    const claimService = BGTClaimService.getInstance();
    
    // Trigger manual claim
    logger.info('Triggering BGT claim...');
    await claimService.claimNow();
    
    // Get stats
    const stats = claimService.getStats();
    logger.info('Claim complete', {
      totalClaimed: stats.totalClaimed.toString(),
      totalRedeemed: stats.totalRedeemed.toString(),
      claimCount: stats.claimCount,
      redeemCount: stats.redeemCount,
    });
    
    logger.info('Done!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to claim BGT', error as Error);
    process.exit(1);
  }
}

// Run the script
main();