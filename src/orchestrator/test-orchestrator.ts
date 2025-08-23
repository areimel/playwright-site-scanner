import { chromium, Browser, Page } from 'playwright';
import chalk from 'chalk';
import { TestConfig, SessionSummary, PageResult, TestResult, ProgressState } from '../types/index.js';
import { TestPhaseManager, ExecutionStrategy, PhaseExecutionPlan } from '../types/test-phases.js';
import { SessionManager } from '../utils/session-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ParallelExecutor } from '../utils/parallel-executor.js';
import { ReporterManager } from '../utils/reporter-manager.js';
import { CrawleeSiteCrawler } from '../lib/crawlee-site-crawler.js';
import { ScreenshotTester } from '../lib/screenshot-tester.js';
import { SEOTester } from '../lib/seo-tester.js';
import { AccessibilityTester } from '../lib/accessibility-tester.js';
import { SitemapTester } from '../lib/sitemap-tester.js';
import { ContentScraper } from '../lib/content-scraper.js';
import { SiteSummaryTester } from '../lib/site-summary-tester.js';
import { ApiKeyTester } from '../lib/api-key-tester.js';

export class TestOrchestrator {
  private browser: Browser | null = null;
  private sessionManager: SessionManager;
  private progressTracker: ProgressTracker;
  private dataManager: SessionDataManager | null = null;
  private parallelExecutor: ParallelExecutor | null = null;
  private reporterManager: ReporterManager | null = null;
  private siteCrawler: CrawleeSiteCrawler;
  private screenshotTester: ScreenshotTester;
  private seoTester: SEOTester;
  private accessibilityTester: AccessibilityTester;
  private sitemapTester: SitemapTester;
  private contentScraper: ContentScraper;
  private siteSummaryTester: SiteSummaryTester;
  private apiKeyTester: ApiKeyTester;

  // Track all test results for session summary
  private allTestResults: TestResult[] = [];

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
    this.apiKeyTester = new ApiKeyTester();
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
      
      // Initialize data manager, parallel executor, and reporter manager
      this.dataManager = new SessionDataManager(config.url, sessionSummary.sessionId);
      this.parallelExecutor = new ParallelExecutor(this.browser!, 5);
      
      // Initialize reporter if configured
      if (config.reporter?.enabled) {
        this.reporterManager = new ReporterManager(config.reporter, sessionSummary.sessionId);
      }

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
      
      // Generate HTML reports if configured
      await this.generateHTMLReports(sessionSummary);
      
      // Display files created summary
      this.displayFilesCreated(sessionSummary.sessionId);
      
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
        const sessionResults = await this.parallelExecutor!.executeTasks(sessionTasks, {
          description: 'session tests',
          maxConcurrency: 2
        });
        
        // Collect results
        sessionResults.successful.forEach(result => {
          this.allTestResults.push(result.result as TestResult);
        });
      }
    }

    // Note: Content scraping is now handled in Phase 2 for unified page processing
    // No page-level tests in Phase 1 anymore

    this.dataManager!.markPhaseComplete(1);
    console.log(chalk.green('   ✅ Phase 1 completed\n'));
  }

  /**
   * Process a single page with all enabled tests using hybrid parallel execution
   * Reduces page loads from N×T to N (where N=pages, T=tests)
   * Runs compatible tests in parallel within each page session
   */
  private async processPageCompletely(
    url: string, 
    enabledTests: string[], 
    config: TestConfig
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let page: Page | null = null;

    try {
      console.log(chalk.gray(`    🌐 Loading page: ${new URL(url).pathname}`));
      page = await this.browser!.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      // Group tests by compatibility for optimal parallel execution
      const testGroups = this.getParallelTestGroups(enabledTests);

      // Group 1: Run non-conflicting tests in parallel
      if (testGroups.nonConflicting.length > 0) {
        console.log(chalk.gray(`      🔄 Running ${testGroups.nonConflicting.length} tests in parallel...`));
        
        const parallelTestPromises = testGroups.nonConflicting.map(async (testType) => {
          try {
            switch (testType) {
              case 'content-scraping':
                console.log(chalk.gray(`      📄 Content scraping...`));
                return await this.contentScraper.scrapePageContentToStore(page!, url, this.dataManager!);

              case 'seo':
                console.log(chalk.gray(`      🔍 SEO analysis...`));
                return await this.seoTester.runSEOScan(page!, url, this.dataManager!.sessionId);

              case 'api-key-scan':
                console.log(chalk.gray(`      🔐 API key scan...`));
                return await this.apiKeyTester.runApiKeyScan(page!, url, this.dataManager!.sessionId);

              default:
                throw new Error(`Unknown non-conflicting test type: ${testType}`);
            }
          } catch (error) {
            console.error(chalk.red(`      ❌ ${testType} failed: ${error}`));
            return {
              testType,
              status: 'failed' as const,
              startTime: new Date(),
              endTime: new Date(),
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });

        const parallelResults = await Promise.all(parallelTestPromises);
        results.push(...parallelResults);
      }

      // Group 2: Run accessibility test (viewport sensitive)
      if (testGroups.accessibility.length > 0) {
        try {
          console.log(chalk.gray(`      ♿ Accessibility scan...`));
          const accessibilityResult = await this.accessibilityTester.runAccessibilityScan(page, url, this.dataManager!.sessionId);
          results.push(accessibilityResult);
        } catch (error) {
          console.error(chalk.red(`      ❌ accessibility failed: ${error}`));
          results.push({
            testType: 'accessibility',
            status: 'failed' as const,
            startTime: new Date(),
            endTime: new Date(),
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Group 3: Run screenshot tests with parallel viewport processing
      if (testGroups.screenshots.length > 0) {
        console.log(chalk.gray(`      📸 Screenshots across ${config.viewports.length} viewports in parallel...`));
        
        const screenshotPromises = config.viewports.map(async (viewport) => {
          try {
            console.log(chalk.gray(`      📸 Screenshot ${viewport.name} (${viewport.width}x${viewport.height})...`));
            await page!.setViewportSize({ width: viewport.width, height: viewport.height });
            await page!.waitForTimeout(500); // Allow re-render
            return await this.screenshotTester.captureScreenshot(page!, url, viewport, this.dataManager!.sessionId);
          } catch (error) {
            console.error(chalk.red(`      ❌ Screenshot ${viewport.name} failed: ${error}`));
            return {
              testType: `screenshots-${viewport.name}`,
              status: 'failed' as const,
              startTime: new Date(),
              endTime: new Date(),
              error: error instanceof Error ? error.message : String(error)
            };
          }
        });

        const screenshotResults = await Promise.all(screenshotPromises);
        results.push(...screenshotResults);
      }

      const totalTests = results.length;
      const successfulTests = results.filter(r => r.status === 'success').length;
      console.log(chalk.green(`    ✅ Completed ${totalTests} tests for ${new URL(url).pathname} (${successfulTests} successful)`));
      return results;

    } catch (error) {
      console.error(chalk.red(`    ❌ Page loading failed for ${url}: ${error}`));
      // Return failed results for all enabled tests
      return enabledTests.map(testType => ({
        testType,
        status: 'failed' as const,
        startTime: new Date(),
        endTime: new Date(),
        error: `Page load failed: ${error instanceof Error ? error.message : String(error)}`
      }));

    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Group tests by compatibility for parallel execution
   * Returns tests grouped by their ability to run simultaneously
   */
  private getParallelTestGroups(enabledTests: string[]): {
    nonConflicting: string[];
    accessibility: string[];
    screenshots: string[];
  } {
    // Tests that don't modify DOM or viewport and can run in parallel
    const nonConflictingTests = ['content-scraping', 'seo', 'api-key-scan'];
    
    // Tests that modify viewport or inject scripts (must run separately)
    const conflictingTests = ['accessibility', 'screenshots'];
    
    return {
      nonConflicting: enabledTests.filter(test => nonConflictingTests.includes(test)),
      accessibility: enabledTests.filter(test => test === 'accessibility'),
      screenshots: enabledTests.filter(test => test === 'screenshots')
    };
  }

  /**
   * Phase 2: Unified Page Analysis & Testing
   * - Content scraping, SEO, accessibility, and screenshots in single page sessions
   */
  private async executePhase2(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase2Plan = strategy.phases.find(p => p.phase === 2);
    if (!phase2Plan || (phase2Plan.pageTests.length === 0 && phase2Plan.sessionTests.length === 0)) return;

    console.log(chalk.blue('\n🔬 Phase 2: Unified Page Analysis & Testing'));
    
    const urls = this.dataManager!.getUrls();
    const pageTests = phase2Plan.pageTests;
    const sessionTests = phase2Plan.sessionTests;
    
    console.log(chalk.gray(`   🌐 Processing ${urls.length} pages with ${pageTests.length} test types each...`));
    console.log(chalk.gray(`   🎯 Unified approach: 1 page load per URL (instead of ${pageTests.length})`));

    // Create page-centric tasks - one task per URL that runs all tests
    if (pageTests.length > 0) {
      const unifiedPageTasks = urls.map(url => ({
        id: `unified-page-${url}`,
        name: `All tests for ${new URL(url).pathname}`,
        execute: async () => {
          return await this.processPageCompletely(url, pageTests, config);
        }
      }));

      console.log(chalk.gray(`   🚀 Executing ${unifiedPageTasks.length} unified page sessions...`));
      
      const unifiedResults = await this.parallelExecutor!.executeTasks(unifiedPageTasks, {
        description: 'unified page analysis',
        maxConcurrency: Math.min(phase2Plan.maxConcurrency, 3), // Slightly lower concurrency for page sessions
        onProgress: (completed, total) => {
          console.log(chalk.gray(`      Progress: ${completed}/${total} pages completed`));
        }
      });
      
      // Collect all test results from unified page processing
      unifiedResults.successful.forEach(taskResult => {
        const pageResults = taskResult.result as TestResult[];
        pageResults.forEach(result => {
          this.allTestResults.push(result);
        });
      });

      // Handle any failed page tasks
      unifiedResults.failed.forEach(taskResult => {
        console.error(chalk.red(`   ❌ Failed to process page: ${taskResult.error}`));
        // Add error to session manager
        this.dataManager!.addError(`page-processing-${taskResult.id}`, taskResult.error);
      });
    }

    // Execute session-level tests (like final API key report)
    if (sessionTests.length > 0) {
      console.log(chalk.gray(`   🔐 Processing ${sessionTests.length} session-level tests...`));
      
      const sessionTasks = sessionTests.map(testId => ({
        id: testId,
        name: this.getTestName(testId),
        execute: async () => {
          switch (testId) {
            case 'api-key-scan':
              return await this.apiKeyTester.generateFinalReport(this.dataManager!.sessionId, urls);
            default:
              throw new Error(`Unknown session test: ${testId}`);
          }
        }
      }));

      const sessionResults = await this.parallelExecutor!.executeTasks(sessionTasks, {
        description: 'session tests',
        maxConcurrency: 2
      });
      
      // Collect session test results
      sessionResults.successful.forEach(result => {
        this.allTestResults.push(result.result as TestResult);
      });
    }

    this.dataManager!.markPhaseComplete(2);
    
    // Calculate performance improvement summary
    const totalTests = this.allTestResults.filter(r => r.testType !== 'site-crawling' && r.testType !== 'sitemap').length;
    const estimatedOldPageLoads = urls.length * pageTests.length;
    const actualPageLoads = urls.length;
    const reductionPercentage = ((estimatedOldPageLoads - actualPageLoads) / estimatedOldPageLoads * 100).toFixed(0);
    
    console.log(chalk.green('   ✅ Phase 2 completed'));
    console.log(chalk.green(`   📊 Performance: ${actualPageLoads} page loads (vs ${estimatedOldPageLoads} in old approach)`));
    console.log(chalk.green(`   🚀 Network efficiency: ${reductionPercentage}% reduction in page loads`));
    console.log(chalk.green(`   ⚡ Parallel execution: Tests within each page run concurrently\n`));
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

      const reportResults = await this.parallelExecutor!.executeTasks(reportTasks, {
        description: 'reports',
        maxConcurrency: 2
      });
      
      // Collect Phase 3 results
      reportResults.successful.forEach(result => {
        this.allTestResults.push(result.result as TestResult);
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
      'site-summary': 'Site Summary',
      'api-key-scan': 'API Key Security Scan'
    };
    
    return testNames[testId] || testId;
  }

  private aggregateResults(): TestResult[] {
    return this.allTestResults;
  }

  private async generateFinalSessionSummary(sessionSummary: SessionSummary): Promise<void> {
    // Generate page results from stored data and organize by URL
    const pageResults: PageResult[] = [];
    const urls = this.dataManager!.getUrls();
    
    for (const url of urls) {
      const metrics = this.dataManager!.getPageMetrics(url);
      const content = this.dataManager!.getScrapedContent(url);
      
      // Find per-page tests that ran for this specific page using the new output type system
      const pageTests = this.sessionManager.filterTestResultsByOutputType(this.allTestResults, 'per-page')
        .filter(result => {
          // Check if this test result is for this page
          return result.outputPath?.includes(this.sessionManager.getPageName(url));
        });
      
      const pageResult: PageResult = {
        url,
        pageName: this.sessionManager.getPageName(url),
        tests: pageTests,
        summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}\nTests run: ${pageTests.length}`
      };
      
      pageResults.push(pageResult);
    }

    // Add site-wide tests to the first page result (or create a separate section)
    if (pageResults.length > 0) {
      const sessionTests = this.sessionManager.filterTestResultsByOutputType(this.allTestResults, 'site-wide');
      
      if (sessionTests.length > 0) {
        // Add session tests to first page or create a summary entry
        pageResults[0].tests.push(...sessionTests);
      }
    }

    await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
  }

  private displayFilesCreated(sessionId: string): void {
    console.log(chalk.blue('\n📁 Files Created:'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    // Show content scraping results
    const contentScrapingResults = this.allTestResults.filter(r => r.testType === 'content-scraping');
    if (contentScrapingResults.length > 0) {
      console.log(chalk.white(`📄 Content Scraping: ${contentScrapingResults.length} markdown files`));
      contentScrapingResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }
    
    // Show sitemap results
    const sitemapResults = this.allTestResults.filter(r => r.testType === 'sitemap');
    if (sitemapResults.length > 0) {
      console.log(chalk.white(`🗺️  Sitemap: ${sitemapResults.length} file(s)`));
      sitemapResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }
    
    // Show site summary results
    const summaryResults = this.allTestResults.filter(r => r.testType === 'site-summary');
    if (summaryResults.length > 0) {
      console.log(chalk.white(`📊 Site Summary: ${summaryResults.length} file(s)`));
      summaryResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }

    // Show screenshot results
    const screenshotResults = this.allTestResults.filter(r => r.testType.includes('screenshots'));
    if (screenshotResults.length > 0) {
      console.log(chalk.white(`📸 Screenshots: ${screenshotResults.length} file(s)`));
    }

    // Show other test results
    const otherResults = this.allTestResults.filter(r => 
      !['content-scraping', 'sitemap', 'site-summary'].includes(r.testType) &&
      !r.testType.includes('screenshots')
    );
    if (otherResults.length > 0) {
      console.log(chalk.white(`🧪 Other Tests: ${otherResults.length} file(s)`));
    }
    
    console.log(chalk.cyan('═'.repeat(50)));
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
    console.log(chalk.blue(`📁 Results saved to: arda-site-scan-sessions/${summary.sessionId}/`));
  }

  private async generateHTMLReports(sessionSummary: SessionSummary): Promise<void> {
    if (!this.reporterManager) {
      return; // No reporter configured
    }

    try {
      // Update reporter open behavior based on test results
      this.reporterManager.updateOpenBehaviorBasedOnResults(sessionSummary);

      // Generate page results from stored data and organize by URL
      const pageResults: PageResult[] = [];
      const urls = this.dataManager!.getUrls();
      
      for (const url of urls) {
        const metrics = this.dataManager!.getPageMetrics(url);
        const content = this.dataManager!.getScrapedContent(url);
        
        // Find per-page tests that ran for this specific page using the new output type system
        const pageTests = this.sessionManager.filterTestResultsByOutputType(this.allTestResults, 'per-page')
          .filter(result => {
            // Check if this test result is for this page
            return result.outputPath?.includes(this.sessionManager.getPageName(url));
          });
        
        const pageResult: PageResult = {
          url,
          pageName: this.sessionManager.getPageName(url),
          tests: pageTests,
          summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}\nTests run: ${pageTests.length}`
        };
        
        pageResults.push(pageResult);
      }

      // Add site-wide tests to the first page result
      if (pageResults.length > 0) {
        const sessionTests = this.sessionManager.filterTestResultsByOutputType(this.allTestResults, 'site-wide');
        
        if (sessionTests.length > 0) {
          pageResults[0].tests.push(...sessionTests);
        }
      }

      // Generate reports
      const reportResult = await this.reporterManager.generateReports(sessionSummary, pageResults);
      
      if (reportResult.success && reportResult.reportPaths.length > 0) {
        console.log(chalk.green(`\n✅ Generated ${reportResult.reportPaths.length} HTML report(s)`));
      } else if (reportResult.errors.length > 0) {
        console.warn(chalk.yellow('\n⚠️  Some HTML reports failed to generate:'));
        reportResult.errors.forEach(error => {
          console.warn(chalk.yellow(`   - ${error}`));
        });
      }

    } catch (error) {
      console.error(chalk.red('\n❌ HTML report generation failed:'), error);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    if (this.reporterManager) {
      await this.reporterManager.cleanup();
      this.reporterManager = null;
    }
  }
}