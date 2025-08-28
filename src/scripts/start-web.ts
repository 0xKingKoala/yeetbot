#!/usr/bin/env bun

import { BotRunner } from '../bot/BotRunner';
import { DashboardServer } from '../server/server';
import { Logger } from '../utils/Logger';
import { Config } from '../config/Config';
import * as readline from 'readline';

const logger = Logger.getInstance();

// Show disclaimer and wait for user acceptance
async function showDisclaimer(): Promise<boolean> {
  // Check if disclaimer should be skipped
  if (process.env.SKIP_DISCLAIMER === 'true') {
    return true;
  }

  console.log('\n' + '='.repeat(70));
  console.log('                    ⚠️  DISCLAIMER  ⚠️');
  console.log('='.repeat(70));
  console.log('\nYEET V2 GAME BOT WEB DASHBOARD - USE AT YOUR OWN RISK');
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
        console.log('\n✅ Risk accepted. Starting web dashboard...\n');
        resolve(true);
      } else {
        console.log('\n❌ Risk not accepted. Exiting...\n');
        resolve(false);
      }
    });
  });
}

async function main() {
  try {
    // Show disclaimer first
    const accepted = await showDisclaimer();
    if (!accepted) {
      process.exit(0);
    }

    const config = Config.getInstance().get();
    const port = parseInt(process.env.DASHBOARD_PORT || '3000');

    // Create and start bot runner
    const botRunner = new BotRunner();
    await botRunner.start();
    logger.info('Bot runner started');

    // Create and start dashboard server
    const dashboardServer = new DashboardServer(botRunner, port);
    dashboardServer.start();
    
    console.log('\n' + '='.repeat(70));
    console.log('🚀 YEET BOT V2 WEB DASHBOARD RUNNING');
    console.log('='.repeat(70));
    console.log(`\n📡 Dashboard URL: http://localhost:${port}`);
    console.log(`🤖 Bot Mode: ${config.safety.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`💰 Max Yeet: ${config.strategy.maxYeetAmount} BERA`);
    console.log('\nPress Ctrl+C to stop the bot and dashboard\n');
    console.log('='.repeat(70) + '\n');

    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await botRunner.stop();
      dashboardServer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      await botRunner.stop();
      dashboardServer.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Fatal error:', error as Error);
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the web dashboard
main();