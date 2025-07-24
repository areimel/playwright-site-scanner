#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getWelcomeScreen, getBanner } from './utils/ascii-art.js';
import { runWalkthrough } from './commands/walkthrough.js';

const program = new Command();

program
  .name('playwright-site-scanner')
  .description('Automated website testing with Playwright')
  .version('1.0.0');

program
  .command('start')
  .description('Start the interactive walkthrough')
  .action(async () => {
    console.clear();
    console.log(getWelcomeScreen());
    console.log(getBanner());
    console.log(chalk.gray('Starting interactive walkthrough...\n'));
    
    try {
      await runWalkthrough();
    } catch (error) {
      console.error(chalk.red('\n❌ An error occurred:'), error);
      process.exit(1);
    }
  });

// If no command is provided, show welcome screen and run walkthrough
if (process.argv.length === 2) {
  console.clear();
  console.log(getWelcomeScreen());
  console.log(getBanner());
  console.log(chalk.gray('Starting interactive walkthrough...\n'));
  
  runWalkthrough().catch((error) => {
    console.error(chalk.red('\n❌ An error occurred:'), error);
    process.exit(1);
  });
} else {
  program.parse();
}