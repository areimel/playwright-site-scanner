import inquirer from 'inquirer';
import chalk from 'chalk';
import { TestConfig, TestType, ViewportConfig, ReporterConfig, CrawlMode } from '@shared/index.js';
import { validateUrl, resolveUrlByProbing } from '@utils/validation.js';
import { TestOrchestrator } from '@orchestrator/test-orchestrator.js';
import { TestConfigManager } from '@orchestrator/test-config-manager.js';
import { ReporterManager } from '@utils/reporter-manager.js';
import { getAvailableTestsAsArray, getViewportsAsArray, getReporterConfig, getDefaultsConfig, getAvailablePlaylistsAsArray, getPlaylistById } from '@utils/config-loader.js';
import { PlaylistManager } from '@orchestrator/playlists.js';


export async function runWalkthrough(): Promise<void> {
  // Load configuration
  const availableTests = await getAvailableTestsAsArray();
  const availablePlaylists = await getAvailablePlaylistsAsArray();
  const viewports = await getViewportsAsArray();
  const reporterConfig = await getReporterConfig();
  const defaults = await getDefaultsConfig();
  const playlistManager = new PlaylistManager();
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
  console.log(chalk.green(`URL set to: ${url}`));
  if (resolvedUrl !== url) {
    console.log(chalk.yellow(`🔎 Resolved to: ${resolvedUrl}\n`));
  } else {
    console.log();
  }

  // Step 2: Ask about site crawling
  // Display info about tests that require multi-page crawling
  console.log(chalk.gray('  Note: Sitemap Generator, Site Summary, and LLMs.txt require'));
  console.log(chalk.gray('  crawling multiple pages and will be disabled for single-page scans.\n'));

  const { crawlMode } = await inquirer.prompt<{ crawlMode: CrawlMode }>([
    {
      type: 'list',
      name: 'crawlMode',
      message: 'Do you want to scan a single page, or the full site?',
      choices: [
        {
          name: 'Just this page - Scan only the URL provided',
          value: 'single',
          short: 'Single page'
        },
        {
          name: 'Smart site crawl (Recommended) - Full site, skip duplicate templated pages',
          value: 'smart',
          short: 'Smart crawl'
        },
        {
          name: 'Full site crawl - Crawl all discovered pages',
          value: 'full',
          short: 'Full crawl'
        }
      ],
      default: defaults.crawlMode || 'smart',
      loop: false
    }
  ]);

  // Derive crawlSite boolean for backward compatibility
  const crawlSite = crawlMode !== 'single';

  const crawlMessages: Record<CrawlMode, string> = {
    'single': '📄 Will test single page only',
    'smart': '🕷️  Will crawl site (smart mode - skipping duplicate templates)',
    'full': '🕷️  Will crawl entire site (all pages)'
  };
  console.log(chalk.yellow(crawlMessages[crawlMode]) + '\n');

  // Step 3: Select playlist or manual test selection
  console.log(chalk.blue('Choose your testing approach:\n'));

  const playlistChoices = [
    {
      name: 'Manually Select Tests - Choose specific tests individually',
      value: 'manual',
      short: 'Manual Selection'
    },
    ...availablePlaylists.map(playlist => ({
      name: `${playlist.name} - ${chalk.gray(playlist.description)}`,
      value: playlist.id,
      short: playlist.name
    }))
  ];

  const { selectionMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectionMode',
      message: 'How would you like to select your tests?',
      choices: playlistChoices,
      loop: false
    }
  ]);

  let selectedTests: TestType[];
  let usedPlaylist: string | null = null;

  if (selectionMode === 'manual') {
    console.log(chalk.green('✅ Manual test selection chosen\n'));

    // Step 4: Manual test selection (existing logic)
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
        },
        theme: {
          helpMode: 'always'
        }
      }
    ]);

    selectedTests = availableTests.filter(test =>
      selectedTestIds.includes(test.id)
    ).map(test => ({ ...test, enabled: true }));
  } else {
    // Playlist selection
    usedPlaylist = selectionMode;
    selectedTests = await playlistManager.getPlaylistTests(selectionMode);
    const playlist = await getPlaylistById(selectionMode);

    console.log(chalk.green(`✅ ${playlist?.name} testing playlist selected`));
    console.log(chalk.gray(`   ${playlist?.description}`));
    console.log(chalk.cyan(`   Tests: ${selectedTests.map(t => t.name).join(', ')}\n`));
  }

  console.log(chalk.green(`✅ Selected ${selectedTests.length} test(s)\n`));

  // Step 4: Reporter Configuration - use config
  console.log(chalk.blue('📊 HTML Report Generation:\n'));
  console.log(chalk.green('✅ HTML reporter enabled with screenshots and detailed logs\n'));

  // Step 5: Confirmation
  const verboseMode = process.env.VERBOSE === 'true';
  await showConfirmation({
    url: resolvedUrl,
    crawlSite,
    crawlMode,
    selectedTests,
    viewports,
    reporter: reporterConfig,
    verboseMode,
    usedPlaylist
  });
}


async function showConfirmation(config: TestConfig): Promise<void> {
  const crawlModeLabels: Record<CrawlMode, string> = {
    'single': 'Single page only',
    'smart': 'Smart crawl (skip duplicate templates)',
    'full': 'Full site crawl'
  };

  console.log(chalk.blue('Test Configuration Summary:'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.white(`URL: ${config.url}`));
  console.log(chalk.white(`Crawl mode: ${crawlModeLabels[config.crawlMode || 'full']}`));

  if (config.usedPlaylist) {
    const playlist = await getPlaylistById(config.usedPlaylist);
    console.log(chalk.white(`Playlist: ${playlist?.name} (${config.selectedTests.length} tests)`));
    console.log(chalk.white(`Tests: ${config.selectedTests.map(t => t.name).join(', ')}`));
  } else {
    console.log(chalk.white(`Selected tests: ${config.selectedTests.map(t => t.name).join(', ')}`));
  }

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

  // Check for tests that will be filtered out due to single-page scan
  if (!config.crawlSite) {
    const { disabledTests } = await TestConfigManager.filterTestsForSinglePageScan(config);
    if (disabledTests.length > 0) {
      console.log(chalk.yellow('\nThe following tests require site crawling and will be skipped:'));
      disabledTests.forEach(testId => {
        console.log(chalk.yellow(`   - ${TestConfigManager.getTestName(testId)}`));
      });
      console.log(chalk.gray('   Enable "Crawl entire site" to run these tests.\n'));
    }
  }

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