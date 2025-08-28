#!/usr/bin/env bun

import { BotRunner } from '../bot/BotRunner';
import { Dashboard, DashboardCallbacks } from '../ui/Dashboard';
import { DashboardTransport } from '../ui/DashboardLogger';
import { Logger } from '../utils/Logger';
import { StateManager } from '../services/StateManager';
import { BlockchainService } from '../services/BlockchainService';
import { BGTClaimService } from '../services/BGTClaimService';
import { Config } from '../config/Config';
import { YEET_GAME_ABI } from '../contracts/abis';
import winston from 'winston';
import * as readline from 'readline';
import { formatEther } from 'viem';

// Show disclaimer and wait for user acceptance
async function showDisclaimer(): Promise<boolean> {
  // Check if disclaimer should be skipped
  if (process.env.SKIP_DISCLAIMER === 'true') {
    return true;
  }

  console.log('\n' + '='.repeat(70));
  console.log('                    ⚠️  DISCLAIMER  ⚠️');
  console.log('='.repeat(70));
  console.log('\nYEET V2 GAME BOT DASHBOARD - USE AT YOUR OWN RISK');
  console.log('\nThis bot automates participation in the Yeet V2 game on Berachain.');
  console.log('\nThe developers assume no responsibility for:');
  console.log('  • Financial losses from game participation');
  console.log('  • Failed transactions or lost gas fees');
  console.log('  • Changes in game mechanics or rules');
  console.log('  • Competition from other players');
  console.log('  • Any damages arising from using this bot');
  console.log('\nGame transactions are IRREVERSIBLE once confirmed.');
  console.log('You can lose ALL funds used in the game.');
  console.log('\nMake sure you understand the game and risks before proceeding.');
  console.log('See DISCLAIMER.md for full details.');
  console.log('\n' + '='.repeat(70));
  console.log('\nTo continue, type: I accept the risk');
  console.log('To exit, press Ctrl+C or type anything else\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'i accept the risk') {
        console.log('\n✅ Risk accepted. Starting dashboard...\n');
        resolve(true);
      } else {
        console.log('\n❌ Risk not accepted. Exiting...\n');
        resolve(false);
      }
    });
  });
}

// Main entry point
async function main() {
  try {
    // Show disclaimer first
    const accepted = await showDisclaimer();
    if (!accepted) {
      process.exit(0);
    }

    // Create bot runner instance
    const botRunner = new BotRunner();
    const stateManager = StateManager.getInstance();
    const blockchain = BlockchainService.getInstance();
    const bgtClaimService = BGTClaimService.getInstance();
    
    // Create dashboard transport for logging
    const dashboardTransport = new DashboardTransport({
      level: 'info',
    });

    // Replace console transport with dashboard transport
    const logger = Logger.getInstance();
    const winstonLogger = (logger as any).logger;
    
    // Remove console transport to prevent interference with dashboard UI
    winstonLogger.transports.forEach((transport: any) => {
      if (transport.name === 'console') {
        winstonLogger.remove(transport);
      }
    });
    
    // Add dashboard transport
    winstonLogger.add(dashboardTransport);

    // Create dashboard callbacks
    const callbacks: DashboardCallbacks = {
      onForceYeet: async () => {
        dashboard.showNotification('Force yeet requested...', 'warning');
        try {
          const state = stateManager.getState();
          const config = Config.getInstance().get();
          
          if (!state.auction) {
            dashboard.showNotification('No active auction', 'error');
            return;
          }
          
          const yeetAmount = state.auction.currentPrice;
          logger.info('Force yeet requested', { 
            price: formatEther(yeetAmount),
            dryRun: config.safety.dryRun
          });
          
          if (config.safety.dryRun) {
            dashboard.showNotification(`DRY RUN: Would yeet ${formatEther(yeetAmount)} BERA`, 'info');
            stateManager.recordYeetAttempt(true, yeetAmount);
          } else {
            // Check balance
            const balance = await blockchain.getBalance();
            if (balance < yeetAmount) {
              dashboard.showNotification(`Insufficient balance: ${formatEther(balance)} < ${formatEther(yeetAmount)}`, 'error');
              return;
            }
            
            dashboard.showNotification(`Executing yeet for ${formatEther(yeetAmount)} BERA...`, 'info');
            
            const hash = await blockchain.writeContract({
              address: config.contracts.yeetGame as `0x${string}`,
              abi: YEET_GAME_ABI,
              functionName: 'yeet',
              value: yeetAmount,
              gas: config.strategy.gasLimit,
            });
            
            dashboard.showNotification(`Yeet sent! TX: ${hash.slice(0, 10)}...`, 'success');
            
            // Wait for confirmation
            const receipt = await blockchain.waitForTransactionReceipt(hash);
            if (receipt.status === 'success') {
              dashboard.showNotification('Yeet confirmed!', 'success');
              stateManager.recordYeetAttempt(true, yeetAmount);
            } else {
              dashboard.showNotification('Yeet transaction failed', 'error');
              stateManager.recordYeetAttempt(false);
            }
          }
        } catch (error) {
          dashboard.showNotification(`Yeet failed: ${error}`, 'error');
          logger.error('Force yeet failed', error as Error);
        }
      },
      
      onClaimBGT: async () => {
        dashboard.showNotification('Claiming BGT rewards...', 'info');
        try {
          const config = Config.getInstance().get();
          
          logger.info('BGT claim requested');
          
          if (config.safety.dryRun) {
            dashboard.showNotification('DRY RUN: Would claim BGT rewards', 'info');
          } else {
            // Use the BGT claim service to claim rewards
            await bgtClaimService.claimNow();
            dashboard.showNotification('BGT claim process initiated', 'success');
            logger.info('BGT claim process initiated');
          }
        } catch (error) {
          dashboard.showNotification(`BGT claim failed: ${error}`, 'error');
          logger.error('BGT claim failed', error as Error);
        }
      },
      
      onPause: () => {
        dashboard.showNotification('Bot paused', 'warning');
        botRunner.pause();
      },
      
      onResume: () => {
        dashboard.showNotification('Bot resumed', 'success');
        botRunner.resume();
      },
      
      onQuit: () => {
        dashboard.showNotification('Shutting down...', 'warning');
        botRunner.stop().then(() => {
          dashboard.stop();
          process.exit(0);
        });
      }
    };

    // Create and start dashboard
    const dashboard = new Dashboard(callbacks);
    dashboardTransport.setDashboard(dashboard);
    dashboard.start();

    // Track auction phase for rule resets
    let lastAuctionPhase = false;
    
    // Set up state update interval
    setInterval(() => {
      const state = stateManager.getState();
      dashboard.updateState(state);
      
      // Check if auction phase changed
      const currentAuctionPhase = state.auction?.isAuctionPhase || false;
      const phaseChanged = currentAuctionPhase !== lastAuctionPhase;
      
      // Update rules panel
      const decisionEngine = botRunner.getDecisionEngine();
      if (decisionEngine) {
        // If we just entered auction phase, clear old evaluations
        if (phaseChanged && currentAuctionPhase) {
          // Clear the last evaluations when entering auction
          (decisionEngine as any).lastEvaluations = null;
          dashboard.clearRules();
          logger.info('🔄 Auction started - resetting rule evaluations');
        }
        
        const evaluations = decisionEngine.getLastEvaluations();
        
        // Only show evaluations if we're in auction phase
        if (currentAuctionPhase && evaluations) {
          const ruleEvals = evaluations.allEvaluations.map((e: any) => ({
            name: e.ruleName,
            shouldYeet: e.decision?.shouldYeet || false,
            reason: e.reason || e.decision?.reason || 'Not triggered',
            priority: e.decision?.priority || 0,
            triggered: e.triggered
          }));
          dashboard.updateRules(ruleEvals, evaluations.decision);
        } else if (!currentAuctionPhase) {
          // Not in auction phase - show waiting status
          const ruleInfo = decisionEngine.getRuleInfo();
          const ruleEvals = ruleInfo.map((r: any) => ({
            name: r.name,
            shouldYeet: false,
            reason: 'Waiting for auction phase',
            priority: r.priority,
            triggered: false
          }));
          dashboard.updateRules(ruleEvals);
        }
      }
      
      lastAuctionPhase = currentAuctionPhase;
    }, 1000); // Update every second

    // Start the bot
    await botRunner.start();

    // Keep the process alive
    process.on('SIGINT', async () => {
      await botRunner.stop();
      dashboard.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await botRunner.stop();
      dashboard.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Add pause and resume methods to BotRunner if they don't exist
declare module '../bot/BotRunner' {
  interface BotRunner {
    pause(): void;
    resume(): void;
    getDecisionEngine(): any;
  }
}

// Extend BotRunner with pause/resume functionality
BotRunner.prototype.pause = function() {
  // Pause implementation - would need to access private members
  (this as any).isRunning = false;
  Logger.getInstance().info('Bot paused');
};

BotRunner.prototype.resume = function() {
  // Resume implementation - would need to access private members
  if (!(this as any).isRunning) {
    (this as any).isRunning = true;
    Logger.getInstance().info('Bot resumed');
  }
};

// Run the dashboard
main();