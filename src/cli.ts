#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getWelcomeScreen, getBanner } from './utils/ascii-art';
import { runWalkthrough } from './commands/walkthrough';
import { BrowserManager } from './utils/browser-manager';

const program = new Command();

program
  .name('playwright-site-scanner')
  .description('Automated website testing with Playwright')
  .version('1.0.0');

program
  .command('start')
  .description('Start the interactive walkthrough')
  .option('--download-browsers', 'Automatically download missing browsers')
  .option('--browser-path <path>', 'Custom path to browser executable')
  .option('--skip-browser-check', 'Skip browser availability check')
  .action(async (options) => {
    console.clear();
    console.log(getWelcomeScreen());
    console.log(getBanner());
    console.log(chalk.gray('Starting interactive walkthrough...\n'));
    
    try {
      await runWalkthrough(options);
    } catch (error) {
      console.error(chalk.red('\n❌ An error occurred:'), error);
      process.exit(1);
    }
  });

// Browser management commands
program
  .command('browsers')
  .description('Browser management commands')
  .action(() => {
    console.log(chalk.blue('🌐 Browser Management Commands:'));
    console.log(chalk.cyan('═'.repeat(40)));
    console.log(chalk.white('  check     - Check browser installation status'));
    console.log(chalk.white('  install   - Download and install browsers'));
    console.log(chalk.white('  list      - List available browsers'));
    console.log(chalk.cyan('═'.repeat(40)));
    console.log(chalk.gray('\nUsage: playwright-site-scanner browsers <command>'));
  });

program
  .command('browsers:check')
  .description('Check browser installation status')
  .action(async () => {
    console.log(chalk.blue('🔍 Checking browser status...\n'));
    
    try {
      const browserManager = BrowserManager.create();
      await browserManager.checkPlaywrightBrowsers();
    } catch (error) {
      console.error(chalk.red('\n❌ Browser check failed:'), error);
      process.exit(1);
    }
  });

program
  .command('browsers:install')
  .description('Download and install Playwright browsers')
  .option('-b, --browsers <browsers>', 'Comma-separated list of browsers to install (chromium,firefox,webkit)', 'chromium')
  .action(async (options) => {
    console.log(chalk.blue('📥 Installing Playwright browsers...\n'));
    
    try {
      const browserManager = BrowserManager.create();
      const browsers = options.browsers.split(',').map((b: string) => b.trim());
      const success = await browserManager.downloadPlaywrightBrowsers(browsers);
      
      if (success) {
        console.log(chalk.green('\n🎉 Browser installation completed!'));
        console.log(chalk.blue('💡 You can now run tests with: playwright-site-scanner start'));
      } else {
        console.log(chalk.red('\n❌ Browser installation failed!'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Browser installation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('browsers:list')
  .description('List all available browsers and their status')
  .action(async () => {
    console.log(chalk.blue('📋 Available Browsers:\n'));
    
    try {
      const browserManager = BrowserManager.create();
      const browsers = await browserManager.checkPlaywrightBrowsers();
      
      console.log(chalk.blue('Supported browsers:'));
      console.log(chalk.white('  • chromium - Fast, lightweight (recommended)'));
      console.log(chalk.white('  • firefox  - Mozilla Firefox browser'));
      console.log(chalk.white('  • webkit   - Safari/WebKit browser (Mac only)'));
      
      console.log(chalk.blue('\nCurrent status:'));
      Object.values(browsers).forEach(browser => {
        const icon = browser.isInstalled ? '✅' : '❌';
        const status = browser.isInstalled ? 'Installed' : 'Not installed';
        console.log(chalk.white(`  ${icon} ${browser.name} - ${status}`));
      });
      
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to list browsers:'), error);
      process.exit(1);
    }
  });

// Process handling for packaged environment
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Ensure stdin is available for inquirer in packaged environment
if ((process as any).pkg) {
  // We're running in a packaged environment
  try {
    process.stdin.setRawMode = process.stdin.setRawMode || function(this: any) { return this; };
  } catch (err) {
    // Ignore errors setting raw mode in packaged environment
  }
}

// If no command is provided, show welcome screen and run walkthrough
if (process.argv.length === 2) {
  console.clear();
  console.log(getWelcomeScreen());
  console.log(getBanner());
  console.log(chalk.gray('Starting interactive walkthrough...\n'));
  
  runWalkthrough({}).catch((error) => {
    console.error(chalk.red('\n❌ An error occurred:'), error);
    process.exit(1);
  });
} else {
  program.parse();
}