#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getWelcomeScreen, getBanner } from './utils/ascii-art.js';
import { displayQrCode } from './utils/qr-code.js';
import { runWalkthrough } from './commands/walkthrough.js';
import { TestOrchestrator } from './orchestrator/test-orchestrator.js';
import { TestConfig } from './types/index.js';
import { getAppConfig, getQRConfig, getCLIConfig, getDefaultsConfig, getAvailableTestsAsArray, getViewportsAsArray, getReporterConfig } from './utils/config-loader.js';

const program = new Command();

// Initialize CLI from config
async function initializeCLI() {
  const appConfig = await getAppConfig();
  const cliConfig = await getCLIConfig();
  
  program
    .name(appConfig.name)
    .description(appConfig.description)
    .version(appConfig.version);

  return { appConfig, cliConfig };
}

async function setupCommands() {
  const { cliConfig } = await initializeCLI();
  const qrConfig = await getQRConfig();

  program
    .command('start')
    .description(cliConfig.commands.start.description)
    .action(async () => {
      console.clear();
      console.log(await getWelcomeScreen());
      console.log(await getBanner());
      if (qrConfig.enabled) {
        await displayQrCode(qrConfig.url);
      }
      console.log(chalk.gray('Starting interactive walkthrough...\n'));
      
      try {
        await runWalkthrough();
      } catch (error) {
        console.error(chalk.red('\n❌ An error occurred:'), error);
        process.exit(1);
      }
    });

  program
    .command('scan')
    .description(cliConfig.commands.scan.description)
    .argument('<url>', 'URL to scan')
    .option('--no-crawl', cliConfig.commands.scan.options?.crawl?.description || 'Test single page only (default: crawl entire site)')
    .action(async (url, options) => {
      console.clear();
      console.log(await getBanner());
      console.log(chalk.gray('Running automated scan...\n'));
      
      try {
        const availableTests = await getAvailableTestsAsArray();
        const viewports = await getViewportsAsArray();
        const reporter = await getReporterConfig();
        
        const config: TestConfig = {
          url,
          crawlSite: options.crawl !== false,
          selectedTests: availableTests.map(test => ({ ...test, enabled: true })),
          viewports,
          reporter
        };

        const orchestrator = new TestOrchestrator();
        await orchestrator.runTests(config);
      } catch (error) {
        console.error(chalk.red('\n❌ An error occurred:'), error);
        process.exit(1);
      }
    });
}

async function main() {
  try {
    await setupCommands();
    
    // If no command is provided, show welcome screen and run walkthrough
    if (process.argv.length === 2) {
      const qrConfig = await getQRConfig();
      
      console.clear();
      console.log(await getWelcomeScreen());
      console.log(await getBanner());
      if (qrConfig.enabled) {
        await displayQrCode(qrConfig.url);
      }
      console.log(chalk.gray('Starting interactive walkthrough...\n'));
      
      try {
        await runWalkthrough();
      } catch (error) {
        console.error(chalk.red('\n❌ An error occurred:'), error);
        process.exit(1);
      }
    } else {
      program.parse();
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize CLI:'), error);
    process.exit(1);
  }
}

main();
