import inquirer from 'inquirer';
import chalk from 'chalk';
import { TestConfig, TestType, ViewportConfig, ReporterConfig } from '@shared/index.js';
import { validateUrl, resolveUrlByProbing } from '@utils/validation.js';
import { TestOrchestrator } from '@orchestrator/test-orchestrator.js';
import { ReporterManager } from '@utils/reporter-manager.js';
import { getAvailableTestsAsArray, getViewportsAsArray, getReporterConfig, getDefaultsConfig } from '@utils/config-loader.js';


export async function runWalkthrough(): Promise<void> {
  // Load configuration
  const availableTests = await getAvailableTestsAsArray();
  const viewports = await getViewportsAsArray();
  const reporterConfig = await getReporterConfig();
  const defaults = await getDefaultsConfig();
  // Step 1: Get URL
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'What URL would you like to test?',
      validate: validateUrl,
      default: defaults.url
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
      default: defaults.crawlSite
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
      choices: availableTests.map(test => ({
        name: `${test.name} - ${chalk.gray(test.description)}`,
        value: test.id,
        checked: false
      })),
      loop: false,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one test to run.';
        }
        return true;
      }
    }
  ]);

  const selectedTests = availableTests.filter(test => 
    selectedTestIds.includes(test.id)
  ).map(test => ({ ...test, enabled: true }));

  console.log(chalk.green(`✅ Selected ${selectedTests.length} test(s)\n`));

  // Step 4: Reporter Configuration - use config
  console.log(chalk.blue('📊 HTML Report Generation:\n'));
  console.log(chalk.green('✅ HTML reporter enabled with screenshots and detailed logs\n'));

  // Step 5: Confirmation
  const verboseMode = process.env.VERBOSE === 'true';
  await showConfirmation({
    url: resolvedUrl,
    crawlSite,
    selectedTests,
    viewports,
    reporter: reporterConfig,
    verboseMode
  });
}


async function showConfirmation(config: TestConfig): Promise<void> {
  console.log(chalk.blue('📋 Test Configuration Summary:'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.white(`🌐 URL: ${config.url}`));
  console.log(chalk.white(`🕷️  Crawl entire site: ${config.crawlSite ? 'Yes' : 'No'}`));
  console.log(chalk.white(`🧪 Selected tests: ${config.selectedTests.map(t => t.name).join(', ')}`));
  console.log(chalk.white(`📱 Viewports: ${config.viewports.map(v => v.name).join(', ')}`));
  console.log(chalk.white(`🔧 Output mode: ${config.verboseMode ? 'Verbose logging' : 'Clean loading screen'}`));
  
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