#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { getWelcomeScreen, getBanner } from './utils/ascii-art.js';
import { displayQrCode } from './utils/qr-code.js';
import { runWalkthrough } from './commands/walkthrough.js';
import { TestOrchestrator } from './orchestrator/test-orchestrator.js';
import { TestConfig } from './types/index.js';

const qrCodeUrl = 'https://bio.alecreimel.com';

const program = new Command();

program
  .name('arda-site-scan')
  .description('Comprehensive website analysis with Playwright')
  .version('1.0.0');

program
  .command('start')
  .description('Start the interactive walkthrough')
  .action(async () => {
    console.clear();
    console.log(getWelcomeScreen());
    console.log(getBanner());
    await displayQrCode(qrCodeUrl);
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
  .description('Run automated scan with all tests enabled')
  .argument('<url>', 'URL to scan')
  .option('--no-crawl', 'Test single page only (default: crawl entire site)')
  .action(async (url, options) => {
    console.clear();
    console.log(getBanner());
    console.log(chalk.gray('Running automated scan...\n'));
    
    try {
      const config: TestConfig = {
        url,
        crawlSite: options.crawl !== false,
        selectedTests: [
          { id: 'screenshots', name: 'Screenshots', description: 'Capture screenshots', enabled: true },
          { id: 'seo', name: 'SEO Scan', description: 'SEO analysis', enabled: true },
          { id: 'accessibility', name: 'Accessibility Scan', description: 'WCAG compliance', enabled: true },
          { id: 'sitemap', name: 'Sitemap Generation', description: 'Generate sitemap', enabled: true },
          { id: 'content-scraping', name: 'Content Scraping', description: 'Extract content', enabled: true },
          { id: 'site-summary', name: 'Site Summary', description: 'Generate summary', enabled: true },
          { id: 'api-key-scan', name: 'API Key Security Scan', description: 'Security scan', enabled: true }
        ],
        viewports: [
          { name: 'desktop', width: 1920, height: 1080 },
          { name: 'tablet', width: 768, height: 1024 },
          { name: 'mobile', width: 375, height: 667 }
        ],
        reporter: {
          enabled: true,
          type: 'html',
          openBehavior: 'always',
          includeScreenshots: true,
          includeDetailedLogs: true
        }
      };

      const orchestrator = new TestOrchestrator();
      await orchestrator.runTests(config);
    } catch (error) {
      console.error(chalk.red('\n❌ An error occurred:'), error);
      process.exit(1);
    }
  });

async function main() {
  // If no command is provided, show welcome screen and run walkthrough
  if (process.argv.length === 2) {
    console.clear();
    console.log(getWelcomeScreen());
    console.log(getBanner());
    await displayQrCode(qrCodeUrl);
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
}

main();
