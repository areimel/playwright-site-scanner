import inquirer from 'inquirer';
import chalk from 'chalk';
import { TestConfig, TestType, ViewportConfig, ReporterConfig } from '../types/index.js';
import { validateUrl, resolveUrlByProbing } from '../utils/validation.js';
import { TestOrchestrator } from '../orchestrator/test-orchestrator.js';
import { ReporterManager } from '../utils/reporter-manager.js';

const AVAILABLE_TESTS: TestType[] = [
  {
    id: 'screenshots',
    name: 'Screenshots',
    description: 'Capture screenshots across different viewports',
    enabled: false
  },
  {
    id: 'seo',
    name: 'SEO Scan',
    description: 'Analyze SEO elements (meta tags, headings, etc.)',
    enabled: false
  },
  {
    id: 'accessibility',
    name: 'Accessibility Scan',
    description: 'Check for accessibility issues and WCAG compliance',
    enabled: false
  },
  {
    id: 'sitemap',
    name: 'Sitemap Generation',
    description: 'Generate XML sitemap for search engine submission',
    enabled: false
  },
  {
    id: 'content-scraping',
    name: 'Content Scraping',
    description: 'Extract page content and images to markdown files',
    enabled: false
  },
  {
    id: 'site-summary',
    name: 'Site Summary',
    description: 'Generate comprehensive site overview report',
    enabled: false
  },
  {
    id: 'api-key-scan',
    name: 'API Key Security Scan',
    description: 'Scan site for exposed API keys and security tokens',
    enabled: false
  }
];

const VIEWPORTS: ViewportConfig[] = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

export async function runWalkthrough(): Promise<void> {
  console.log(chalk.blue('🌐 Let\'s set up your website testing session!\n'));

  // Step 1: Get URL
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'What URL would you like to test?',
      validate: validateUrl,
      default: 'https://example.com'
    }
  ]);

  const resolvedUrl = await resolveUrlByProbing(url);
  console.log(chalk.green(`✅ URL set to: ${url}`));
  if (resolvedUrl !== url) {
    console.log(chalk.yellow(`🔎 Resolved to: ${resolvedUrl}\n`));
  } else {
    console.log();
  }

  // Step 2: Ask about site crawling
  const { crawlSite } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'crawlSite',
      message: 'Would you like to crawl the entire site and test all pages?',
      default: true
    }
  ]);

  const crawlMessage = crawlSite 
    ? chalk.yellow('🕷️  Will crawl entire site') 
    : chalk.yellow('📄 Will test single page only');
  console.log(`${crawlMessage}\n`);

  // Step 3: Select tests
  console.log(chalk.blue('🧪 Select which tests you\'d like to run:\n'));
  
  const { selectedTestIds } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTestIds',
      message: 'Choose your tests:',
      choices: AVAILABLE_TESTS.map(test => ({
        name: `${test.name} - ${chalk.gray(test.description)}`,
        value: test.id,
        checked: false
      })),
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one test to run.';
        }
        return true;
      }
    }
  ]);

  const selectedTests = AVAILABLE_TESTS.filter(test => 
    selectedTestIds.includes(test.id)
  ).map(test => ({ ...test, enabled: true }));

  console.log(chalk.green(`✅ Selected ${selectedTests.length} test(s)\n`));

  // Step 4: Reporter Configuration
  const reporterConfig = await configureReporter();

  // Step 5: Confirmation
  await showConfirmation({
    url: resolvedUrl,
    crawlSite,
    selectedTests,
    viewports: VIEWPORTS,
    reporter: reporterConfig
  });
}

async function configureReporter(): Promise<ReporterConfig> {
  console.log(chalk.blue('📊 HTML Report Generation:\n'));

  const reporterConfig: ReporterConfig = {
    enabled: true,
    type: 'html',
    openBehavior: 'always',
    includeScreenshots: true,
    includeDetailedLogs: true
  };

  console.log(chalk.green('✅ HTML reporter enabled with screenshots and detailed logs\n'));
  return reporterConfig;
}

async function showConfirmation(config: TestConfig): Promise<void> {
  console.log(chalk.blue('📋 Test Configuration Summary:'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.white(`🌐 URL: ${config.url}`));
  console.log(chalk.white(`🕷️  Crawl entire site: ${config.crawlSite ? 'Yes' : 'No'}`));
  console.log(chalk.white(`🧪 Selected tests: ${config.selectedTests.map(t => t.name).join(', ')}`));
  console.log(chalk.white(`📱 Viewports: ${config.viewports.map(v => v.name).join(', ')}`));
  
  // Display reporter configuration
  if (config.reporter?.enabled) {
    console.log(chalk.white(`📊 HTML Report: Enabled (${config.reporter.openBehavior})`));
    const features = [];
    if (config.reporter.includeScreenshots) features.push('Screenshots');
    if (config.reporter.includeDetailedLogs) features.push('Detailed Logs');
    if (features.length > 0) {
      console.log(chalk.white(`   Features: ${features.join(', ')}`));
    }
  } else {
    console.log(chalk.white(`📊 HTML Report: Disabled`));
  }
  
  console.log(chalk.cyan('═'.repeat(50)));

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Ready to start testing?',
      default: true
    }
  ]);

  if (confirmed) {
    console.log(chalk.green('\n🚀 Starting test session...\n'));
    const orchestrator = new TestOrchestrator();
    await orchestrator.runTests(config);
  } else {
    console.log(chalk.yellow('\n⏹️  Test session cancelled.'));
    process.exit(0);
  }
}