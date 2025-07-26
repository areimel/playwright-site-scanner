import { chromium, Browser, Page } from 'playwright';
import chalk from 'chalk';
import { TestConfig, SessionSummary, PageResult, TestResult, ProgressState } from '../types/index.js';
import { TestPhaseManager, ExecutionStrategy, PhaseExecutionPlan } from '../types/test-phases.js';
import { SessionManager } from '../utils/session-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ParallelExecutor } from '../utils/parallel-executor.js';
import { CrawleeSiteCrawler } from '../lib/crawlee-site-crawler.js';
import { ScreenshotTester } from '../lib/screenshot-tester.js';
import { SEOTester } from '../lib/seo-tester.js';
import { AccessibilityTester } from '../lib/accessibility-tester.js';
import { SitemapTester } from '../lib/sitemap-tester.js';
import { ContentScraper } from '../lib/content-scraper.js';
import { SiteSummaryTester } from '../lib/site-summary-tester.js';

export class TestOrchestrator {
  private browser: Browser | null = null;
  private sessionManager: SessionManager;
  private progressTracker: ProgressTracker;
  private dataManager: SessionDataManager | null = null;
  private parallelExecutor: ParallelExecutor | null = null;
  private siteCrawler: CrawleeSiteCrawler;
  private screenshotTester: ScreenshotTester;
  private seoTester: SEOTester;
  private accessibilityTester: AccessibilityTester;
  private sitemapTester: SitemapTester;
  private contentScraper: ContentScraper;
  private siteSummaryTester: SiteSummaryTester;

  constructor() {
    this.sessionManager = new SessionManager();
    this.progressTracker = new ProgressTracker();
    this.siteCrawler = new CrawleeSiteCrawler();
    this.screenshotTester = new ScreenshotTester();
    this.seoTester = new SEOTester();
    this.accessibilityTester = new AccessibilityTester();
    this.sitemapTester = new SitemapTester();
    this.contentScraper = new ContentScraper();
    this.siteSummaryTester = new SiteSummaryTester();
  }

  async runTests(config: TestConfig): Promise<void> {
    const sessionSummary: SessionSummary = {
      sessionId: this.sessionManager.createSessionId(),
      url: config.url,
      startTime: new Date(),
      totalPages: 0,
      testsRun: 0,
      testsSucceeded: 0,
      testsFailed: 0,
      errors: []
    };

    try {
      console.log(chalk.blue('🚀 Initializing browser and parallel execution...'));
      await this.initializeBrowser();
      
      // Initialize data manager and parallel executor
      this.dataManager = new SessionDataManager(config.url, sessionSummary.sessionId);
      this.parallelExecutor = new ParallelExecutor(this.browser!, 5);

      // Create session directory
      await this.sessionManager.createSessionDirectory(sessionSummary.sessionId);

      // Analyze test configuration and create execution strategy
      const executionStrategy = TestPhaseManager.organizeTestsIntoPhases(config);
      
      console.log(chalk.blue(`📋 Execution strategy: ${executionStrategy.phases.length} phases`));
      console.log(chalk.gray(`   Estimated duration: ${executionStrategy.totalEstimatedDuration}s`));

      // Execute tests in three phases
      await this.executePhase1(config, executionStrategy);
      await this.executePhase2(config, executionStrategy);
      await this.executePhase3(config, executionStrategy);

      // Generate final session summary
      sessionSummary.endTime = new Date();
      sessionSummary.totalPages = this.dataManager.getUrls().length;
      
      const allResults = this.aggregateResults();
      sessionSummary.testsRun = allResults.length;
      sessionSummary.testsSucceeded = allResults.filter(r => r.status === 'success').length;
      sessionSummary.testsFailed = allResults.filter(r => r.status === 'failed').length;
      
      console.log(chalk.blue('\n📊 Generating session summary...'));
      await this.generateFinalSessionSummary(sessionSummary);
      
      this.displayCompletionSummary(sessionSummary);

    } catch (error) {
      console.error(chalk.red('\n❌ Test session failed:'), error);
      sessionSummary.errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  /**
   * Phase 1: Data Discovery & Collection
   * - Site crawling (single execution)
   * - Content scraping for all pages
   * - Sitemap generation
   */
  private async executePhase1(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase1Plan = strategy.phases.find(p => p.phase === 1);
    if (!phase1Plan) return;

    console.log(chalk.blue('\n🔍 Phase 1: Data Discovery & Collection'));
    
    // Step 1: Site crawling (if needed)
    let urls: string[] = [config.url];
    if (config.crawlSite || phase1Plan.sessionTests.includes('site-crawling')) {
      console.log(chalk.gray('   🕷️  Discovering pages...'));
      urls = await this.siteCrawler.crawlSite(config.url);
      console.log(chalk.green(`   ✅ Found ${urls.length} pages`));
    }
    
    this.dataManager!.setUrls(urls);

    // Step 2: Execute session-level tests in parallel
    if (phase1Plan.sessionTests.length > 0) {
      console.log(chalk.gray(`   🎯 Running ${phase1Plan.sessionTests.length} session-level tests...`));
      
      const sessionTasks = phase1Plan.sessionTests
        .filter(testId => testId !== 'site-crawling') // Already done
        .map(testId => ({
          id: testId,
          name: this.getTestName(testId),
          execute: async () => {
            switch (testId) {
              case 'sitemap':
                return await this.sitemapTester.generateSitemapFromUrls(urls, config.url, this.dataManager!.sessionId);
              default:
                throw new Error(`Unknown session test: ${testId}`);
            }
          }
        }));

      if (sessionTasks.length > 0) {
        await this.parallelExecutor!.executeTasks(sessionTasks, {
          description: 'session tests',
          maxConcurrency: 2
        });
      }
    }

    // Step 3: Content scraping for all pages in parallel
    if (phase1Plan.pageTests.includes('content-scraping')) {
      console.log(chalk.gray(`   📄 Scraping content from ${urls.length} pages...`));
      
      const scrapingTasks = urls.map(url => ({
        id: `content-${url}`,
        name: `Content scraping (${new URL(url).pathname})`,
        execute: async () => {
          const page = await this.browser!.newPage();
          try {
            await page.goto(url, { waitUntil: 'networkidle' });
            const result = await this.contentScraper.scrapePageContentToStore(page, url, this.dataManager!);
            return result;
          } finally {
            await page.close();
          }
        }
      }));

      await this.parallelExecutor!.executeTasks(scrapingTasks, {
        description: 'content scraping',
        maxConcurrency: phase1Plan.maxConcurrency
      });
    }

    this.dataManager!.markPhaseComplete(1);
    console.log(chalk.green('   ✅ Phase 1 completed\n'));
  }

  /**
   * Phase 2: Page Analysis & Testing
   * - Screenshots across all viewports
   * - SEO scans
   * - Accessibility testing
   */
  private async executePhase2(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase2Plan = strategy.phases.find(p => p.phase === 2);
    if (!phase2Plan || phase2Plan.pageTests.length === 0) return;

    console.log(chalk.blue('\n🔬 Phase 2: Page Analysis & Testing'));
    
    const urls = this.dataManager!.getUrls();
    const pageTests = phase2Plan.pageTests;
    
    console.log(chalk.gray(`   🎯 Running ${pageTests.length} test types on ${urls.length} pages...`));

    // Create all page test tasks
    const allPageTasks: any[] = [];
    
    for (const url of urls) {
      for (const testType of pageTests) {
        if (testType === 'screenshots') {
          // Create separate tasks for each viewport
          for (const viewport of config.viewports) {
            allPageTasks.push({
              id: `${testType}-${viewport.name}-${url}`,
              name: `Screenshot ${viewport.name} (${new URL(url).pathname})`,
              execute: async () => {
                const page = await this.browser!.newPage();
                try {
                  await page.goto(url, { waitUntil: 'networkidle' });
                  await page.setViewportSize({ width: viewport.width, height: viewport.height });
                  return await this.screenshotTester.captureScreenshot(page, url, viewport, this.dataManager!.sessionId);
                } finally {
                  await page.close();
                }
              }
            });
          }
        } else {
          allPageTasks.push({
            id: `${testType}-${url}`,
            name: `${this.getTestName(testType)} (${new URL(url).pathname})`,
            execute: async () => {
              const page = await this.browser!.newPage();
              try {
                await page.goto(url, { waitUntil: 'networkidle' });
                
                switch (testType) {
                  case 'seo':
                    return await this.seoTester.runSEOScan(page, url, this.dataManager!.sessionId);
                  case 'accessibility':
                    return await this.accessibilityTester.runAccessibilityScan(page, url, this.dataManager!.sessionId);
                  default:
                    throw new Error(`Unknown page test: ${testType}`);
                }
              } finally {
                await page.close();
              }
            }
          });
        }
      }
    }

    // Execute all page tests in parallel
    await this.parallelExecutor!.executeTasks(allPageTasks, {
      description: 'page analysis tests',
      maxConcurrency: phase2Plan.maxConcurrency,
      onProgress: (completed, total) => {
        console.log(chalk.gray(`      Progress: ${completed}/${total} tests completed`));
      }
    });

    this.dataManager!.markPhaseComplete(2);
    console.log(chalk.green('   ✅ Phase 2 completed\n'));
  }

  /**
   * Phase 3: Report Generation & Finalization
   * - Site summary using real scraped content
   * - Session reports and statistics
   */
  private async executePhase3(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase3Plan = strategy.phases.find(p => p.phase === 3);
    if (!phase3Plan) return;

    console.log(chalk.blue('\n📊 Phase 3: Report Generation & Finalization'));

    // Execute session-level tests (like site summary)
    if (phase3Plan.sessionTests.length > 0) {
      console.log(chalk.gray(`   📋 Generating ${phase3Plan.sessionTests.length} reports...`));
      
      const reportTasks = phase3Plan.sessionTests.map(testId => ({
        id: testId,
        name: this.getTestName(testId),
        execute: async () => {
          switch (testId) {
            case 'site-summary':
              return await this.siteSummaryTester.generateSiteSummaryFromStore(this.dataManager!);
            default:
              throw new Error(`Unknown report test: ${testId}`);
          }
        }
      }));

      await this.parallelExecutor!.executeTasks(reportTasks, {
        description: 'reports',
        maxConcurrency: 2
      });
    }

    this.dataManager!.markPhaseComplete(3);
    console.log(chalk.green('   ✅ Phase 3 completed\n'));
  }

  /**
   * Utility methods
   */
  private getTestName(testId: string): string {
    const testNames: Record<string, string> = {
      'site-crawling': 'Site Crawling',
      'sitemap': 'Sitemap Generation',
      'content-scraping': 'Content Scraping',
      'screenshots': 'Screenshots',
      'seo': 'SEO Scan',
      'accessibility': 'Accessibility Scan',
      'site-summary': 'Site Summary'
    };
    
    return testNames[testId] || testId;
  }

  private aggregateResults(): TestResult[] {
    // This would collect all test results from the data manager
    // For now, return empty array as results are stored in the data manager
    return [];
  }

  private async generateFinalSessionSummary(sessionSummary: SessionSummary): Promise<void> {
    // Generate page results from stored data
    const pageResults: PageResult[] = [];
    const urls = this.dataManager!.getUrls();
    
    for (const url of urls) {
      const metrics = this.dataManager!.getPageMetrics(url);
      const content = this.dataManager!.getScrapedContent(url);
      
      const pageResult: PageResult = {
        url,
        pageName: this.sessionManager.getPageName(url),
        tests: [], // Tests are tracked separately in the new system
        summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}`
      };
      
      pageResults.push(pageResult);
    }

    await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
  }

  private displayCompletionSummary(summary: SessionSummary): void {
    const duration = summary.endTime 
      ? Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
      : 0;

    console.log(chalk.green('\n🎉 Testing session completed!'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white(`📊 Session ID: ${summary.sessionId}`));
    console.log(chalk.white(`🌐 URL: ${summary.url}`));
    console.log(chalk.white(`📄 Pages tested: ${summary.totalPages}`));
    console.log(chalk.white(`🧪 Total tests: ${summary.testsRun}`));
    console.log(chalk.green(`✅ Successful: ${summary.testsSucceeded}`));
    if (summary.testsFailed > 0) {
      console.log(chalk.red(`❌ Failed: ${summary.testsFailed}`));
    }
    console.log(chalk.white(`⏱️  Duration: ${duration}s`));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.blue(`📁 Results saved to: playwright-site-scanner-sessions/${summary.sessionId}/`));
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}