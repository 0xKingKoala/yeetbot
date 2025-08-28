#!/usr/bin/env bun

import { runBot } from '../bot/BotRunner';
import { logger } from '../utils/Logger';
import * as readline from 'readline';

// Show disclaimer and wait for user acceptance
async function showDisclaimer(): Promise<boolean> {
  // Check if disclaimer should be skipped
  if (process.env.SKIP_DISCLAIMER === 'true') {
    return true;
  }

  console.log('\n' + '='.repeat(70));
  console.log('                    ⚠️  DISCLAIMER  ⚠️');
  console.log('='.repeat(70));
  console.log('\nYEET V2 GAME BOT - USE AT YOUR OWN RISK');
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
        console.log('\n✅ Risk accepted. Starting bot...\n');
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

    logger.info('Starting Yeet Bot V2...');
    await runBot();
  } catch (error) {
    logger.error('Fatal error', error as Error);
    process.exit(1);
  }
}

// Run the bot
main();