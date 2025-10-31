import { Page } from 'playwright';
import chalk from 'chalk';
import { TestConfig, TestResult } from '@shared/index.js';
import { ExecutionStrategy, PhaseExecutionPlan } from '@shared/test-phases.js';
import { SessionDataManager } from '@utils/session-data-store.js';
import { ParallelExecutor } from '@utils/parallel-executor.js';
import { CrawleeSiteCrawler } from '@lib/crawlee-site-crawler.js';
import { ScreenshotTester } from '@lib/screenshot-tester.js';
import { SEOTester } from '@lib/seo-tester.js';
import { AccessibilityTester } from '@lib/accessibility-tester.js';
import { SitemapTester } from '@lib/sitemap-tester.js';
import { ContentScraper } from '@lib/content-scraper.js';
import { SiteSummaryTester } from '@lib/site-summary-tester.js';
import { ApiKeyTester } from '@lib/api-key-tester.js';
import { BrowserManager } from './browser-manager.js';
import { ErrorHandler } from './error-handler.js';
import { UIStyler } from './ui-styler.js';
import { getExecutionConfig } from '@utils/config-loader.js';

/**
 * Core test execution engine that handles all three phases of test execution.
 * Manages parallel processing, unified page processing, and sophisticated test orchestration.
 */
export class TestRunner {
  // Dependencies injected through constructor
  private browserManager: BrowserManager;
  private dataManager: SessionDataManager;
  private parallelExecutor: ParallelExecutor;
  private siteCrawler: CrawleeSiteCrawler;
  private screenshotTester: ScreenshotTester;
  private seoTester: SEOTester;
  private accessibilityTester: AccessibilityTester;
  private sitemapTester: SitemapTester;
  private contentScraper: ContentScraper;
  private siteSummaryTester: SiteSummaryTester;
  private apiKeyTester: ApiKeyTester;
  private errorHandler: ErrorHandler;
  private uiStyler: UIStyler;

  // Track all test results for aggregation
  private allTestResults: TestResult[] = [];

  constructor(
    browserManager: BrowserManager,
    dataManager: SessionDataManager,
    parallelExecutor: ParallelExecutor,
    siteCrawler: CrawleeSiteCrawler,
    screenshotTester: ScreenshotTester,
    seoTester: SEOTester,
    accessibilityTester: AccessibilityTester,
    sitemapTester: SitemapTester,
    contentScraper: ContentScraper,
    siteSummaryTester: SiteSummaryTester,
    apiKeyTester: ApiKeyTester,
    errorHandler: ErrorHandler,
    uiStyler: UIStyler
  ) {
    this.browserManager = browserManager;
    this.dataManager = dataManager;
    this.parallelExecutor = parallelExecutor;
    this.siteCrawler = siteCrawler;
    this.screenshotTester = screenshotTester;
    this.seoTester = seoTester;
    this.accessibilityTester = accessibilityTester;
    this.sitemapTester = sitemapTester;
    this.contentScraper = contentScraper;
    this.siteSummaryTester = siteSummaryTester;
    this.apiKeyTester = apiKeyTester;
    this.errorHandler = errorHandler;
    this.uiStyler = uiStyler;
  }

  /**
   * Get all accumulated test results
   */
  getTestResults(): TestResult[] {
    return this.allTestResults;
  }

  /**
   * Clear test results (useful for multiple test runs)
   */
  clearResults(): void {
    this.allTestResults = [];
  }

  /**
   * Phase 1: Data Discovery & Collection
   * - Site crawling (single execution)
   * - Content scraping for all pages
   * - Sitemap generation
   */
  async executePhase1(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase1Plan = strategy.phases.find(p => p.phase === 1);
    if (!phase1Plan) return;

    this.uiStyler.displayPhaseStart(1, 'Data Discovery & Collection');
    
    // Step 1: Site crawling (if needed)
    let urls: string[] = [config.url];
    if (config.crawlSite || phase1Plan.sessionTests.includes('site-crawling')) {
      this.uiStyler.displayProgress('🕷️  Discovering pages...');
      urls = await this.siteCrawler.crawlSite(config.url);
      this.uiStyler.displaySiteDiscovery(urls.length);
    }
    
    this.dataManager.setUrls(urls);

    // Step 2: Execute session-level tests in parallel
    if (phase1Plan.sessionTests.length > 0) {
      this.uiStyler.displayProgress(`🎯 Running ${phase1Plan.sessionTests.length} session-level tests...`);
      
      const sessionTasks = phase1Plan.sessionTests
        .filter(testId => testId !== 'site-crawling') // Already done
        .map(testId => ({
          id: testId,
          name: this.getTestName(testId),
          execute: async () => {
            switch (testId) {
              case 'sitemap':
                return await this.sitemapTester.generateSitemapFromUrls(urls, config.url, this.dataManager.sessionId);
              default:
                throw new Error(`Unknown session test: ${testId}`);
            }
          }
        }));

      if (sessionTasks.length > 0) {
        const executionConfig = await getExecutionConfig();
        const sessionResults = await this.parallelExecutor.executeTasks(sessionTasks, {
          description: 'session tests',
          maxConcurrency: executionConfig.phases[1]?.maxConcurrency || 2
        });
        
        // Collect results
        sessionResults.successful.forEach(result => {
          this.allTestResults.push(result.result as TestResult);
        });
      }
    }

    // Note: Content scraping is now handled in Phase 2 for unified page processing
    // No page-level tests in Phase 1 anymore

    this.dataManager.markPhaseComplete(1);
    this.uiStyler.displayPhaseComplete(1);
  }

  /**
   * Phase 2: Unified Page Analysis & Testing
   * - Content scraping, SEO, accessibility, and screenshots in single page sessions
   */
  async executePhase2(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase2Plan = strategy.phases.find(p => p.phase === 2);
    if (!phase2Plan || (phase2Plan.pageTests.length === 0 && phase2Plan.sessionTests.length === 0)) return;

    this.uiStyler.displayPhaseStart(2, 'Unified Page Analysis & Testing');
    
    const urls = this.dataManager.getUrls();
    const pageTests = phase2Plan.pageTests;
    const sessionTests = phase2Plan.sessionTests;
    
    this.uiStyler.displayUnifiedProcessing(urls.length, pageTests.length);

    // Create page-centric tasks - one task per URL that runs all tests
    if (pageTests.length > 0) {
      const unifiedPageTasks = urls.map(url => ({
        id: `unified-page-${url}`,
        name: `All tests for ${new URL(url).pathname}`,
        execute: async () => {
          return await this.processPageCompletely(url, pageTests, config);
        }
      }));

      this.uiStyler.displayTaskExecution('unified page sessions', unifiedPageTasks.length);
      
      const unifiedResults = await this.parallelExecutor.executeTasks(unifiedPageTasks, {
        description: 'unified page analysis',
        maxConcurrency: Math.min(phase2Plan.maxConcurrency, (await getExecutionConfig()).phases[2]?.maxConcurrency || 3),
        onProgress: (completed, total) => {
          this.uiStyler.displayTaskProgress(completed, total);
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
        this.errorHandler.captureError(taskResult.error, `page-processing-${taskResult.id}`);
        this.errorHandler.logPageProcessingError(taskResult.id, taskResult.error);
        // Add error to session manager
        this.dataManager.addError(`page-processing-${taskResult.id}`, taskResult.error);
      });
    }

    // Execute session-level tests (like final API key report)
    if (sessionTests.length > 0) {
      this.uiStyler.displayProgress(`🔐 Processing ${sessionTests.length} session-level tests...`);
      
      const sessionTasks = sessionTests.map(testId => ({
        id: testId,
        name: this.getTestName(testId),
        execute: async () => {
          switch (testId) {
            case 'api-key-scan':
              return await this.apiKeyTester.generateFinalReport(this.dataManager.sessionId, urls);
            default:
              throw new Error(`Unknown session test: ${testId}`);
          }
        }
      }));

      const executionConfig = await getExecutionConfig();
      const sessionResults = await this.parallelExecutor.executeTasks(sessionTasks, {
        description: 'session tests',
        maxConcurrency: executionConfig.phases[1]?.maxConcurrency || 2
      });
      
      // Collect session test results
      sessionResults.successful.forEach(result => {
        this.allTestResults.push(result.result as TestResult);
      });
    }

    this.dataManager.markPhaseComplete(2);
    
    // Calculate performance improvement summary
    const totalTests = this.allTestResults.filter(r => r.testType !== 'site-crawling' && r.testType !== 'sitemap').length;
    const estimatedOldPageLoads = urls.length * pageTests.length;
    const actualPageLoads = urls.length;
    const reductionPercentage = ((estimatedOldPageLoads - actualPageLoads) / estimatedOldPageLoads * 100).toFixed(0);
    
    this.uiStyler.displayPhaseComplete(2);
    this.uiStyler.displayPerformanceImprovement(actualPageLoads, estimatedOldPageLoads, totalTests);
  }

  /**
   * Phase 3: Dedicated Screenshot Testing
   * - Screenshots isolated from other tests to prevent conflicts
   */
  async executePhase3(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase3Plan = strategy.phases.find(p => p.phase === 3);
    if (!phase3Plan || (phase3Plan.pageTests.length === 0 && phase3Plan.sessionTests.length === 0)) return;

    this.uiStyler.displayPhaseStart(3, 'Dedicated Screenshot Testing');

    const urls = this.dataManager.getUrls();
    const pageTests = phase3Plan.pageTests;

    this.uiStyler.displayProgress(`📸 Processing ${urls.length} pages for screenshot testing...`);

    // Create dedicated screenshot tasks - isolated from other tests
    // Handle both full-page and above-the-fold screenshots
    const screenshotTestTypes = pageTests.filter(test =>
      test === 'screenshots-full-page' || test === 'screenshots-above-fold'
    );

    if (screenshotTestTypes.length > 0) {
      const screenshotTasks = urls.flatMap(url =>
        screenshotTestTypes.map(testType => ({
          id: `${testType}-${url}`,
          name: `${testType === 'screenshots-full-page' ? 'Full-Page' : 'Above-Fold'} Screenshots for ${new URL(url).pathname}`,
          execute: async () => {
            return await this.processPageScreenshots(url, config, testType);
          }
        }))
      );

      this.uiStyler.displayTaskExecution('dedicated screenshot sessions', screenshotTasks.length);

      const executionConfig = await getExecutionConfig();
      const screenshotResults = await this.parallelExecutor.executeTasks(screenshotTasks, {
        description: 'screenshot testing',
        maxConcurrency: Math.min(phase3Plan.maxConcurrency, executionConfig.phases[3]?.maxConcurrency || 2),
        onProgress: (completed, total) => {
          this.uiStyler.displayTaskProgress(completed, total);
        }
      });

      // Collect all screenshot results
      screenshotResults.successful.forEach(taskResult => {
        const pageResults = taskResult.result as TestResult[];
        pageResults.forEach(result => {
          this.allTestResults.push(result);
        });
      });

      // Handle any failed screenshot tasks
      screenshotResults.failed.forEach(taskResult => {
        this.errorHandler.captureError(taskResult.error, `screenshot-processing-${taskResult.id}`);
        this.errorHandler.logPageProcessingError(taskResult.id, taskResult.error);
        this.dataManager.addError(`screenshot-processing-${taskResult.id}`, taskResult.error);
      });
    }

    this.dataManager.markPhaseComplete(3);
    this.uiStyler.displayPhaseComplete(3);
  }

  /**
   * Phase 4: Final Analysis & Report Generation
   * - Accessibility testing, site summaries, aggregated reports, final analysis
   */
  async executePhase4(config: TestConfig, strategy: ExecutionStrategy): Promise<void> {
    const phase4Plan = strategy.phases.find(p => p.phase === 4);
    if (!phase4Plan) return;

    this.uiStyler.displayPhaseStart(4, 'Final Analysis & Report Generation');
    
    const urls = this.dataManager.getUrls();
    const pageTests = phase4Plan.pageTests;
    const sessionTests = phase4Plan.sessionTests;

    // Execute page-level tests (like accessibility)
    if (pageTests.length > 0) {
      const pageTestTasks = urls.map(url => ({
        id: `final-analysis-${url}`,
        name: `Final analysis for ${new URL(url).pathname}`,
        execute: async () => {
          return await this.processPageFinalAnalysis(url, pageTests, config);
        }
      }));

      this.uiStyler.displayTaskExecution('final analysis sessions', pageTestTasks.length);
      
      const executionConfig = await getExecutionConfig();
      const pageResults = await this.parallelExecutor.executeTasks(pageTestTasks, {
        description: 'final page analysis',
        maxConcurrency: Math.min(phase4Plan.maxConcurrency, executionConfig.phases[4]?.maxConcurrency || 2),
        onProgress: (completed, total) => {
          this.uiStyler.displayTaskProgress(completed, total);
        }
      });
      
      // Collect page test results
      pageResults.successful.forEach(taskResult => {
        const testResults = taskResult.result as TestResult[];
        testResults.forEach(result => {
          this.allTestResults.push(result);
        });
      });

      // Handle failed page tasks
      pageResults.failed.forEach(taskResult => {
        this.errorHandler.captureError(taskResult.error, `final-analysis-${taskResult.id}`);
        this.errorHandler.logPageProcessingError(taskResult.id, taskResult.error);
        this.dataManager.addError(`final-analysis-${taskResult.id}`, taskResult.error);
      });
    }
    
    // Execute session-level tests (like site summary)
    if (sessionTests.length > 0) {
      this.uiStyler.displayProgress(`📋 Generating ${sessionTests.length} reports...`);
      
      const reportTasks = sessionTests.map(testId => ({
        id: testId,
        name: this.getTestName(testId),
        execute: async () => {
          switch (testId) {
            case 'site-summary':
              return await this.siteSummaryTester.generateSiteSummaryFromStore(this.dataManager);
            default:
              throw new Error(`Unknown report test: ${testId}`);
          }
        }
      }));

      const executionConfig = await getExecutionConfig();
      const reportResults = await this.parallelExecutor.executeTasks(reportTasks, {
        description: 'reports',
        maxConcurrency: executionConfig.phases[4]?.maxConcurrency || 2
      });
      
      // Collect Phase 4 results
      reportResults.successful.forEach(result => {
        this.allTestResults.push(result.result as TestResult);
      });
    }

    this.dataManager.markPhaseComplete(4);
    this.uiStyler.displayPhaseComplete(4);
  }

  /**
   * Process a single page with all enabled tests using hybrid parallel execution
   * Reduces page loads from N×T to N (where N=pages, T=tests)
   * Runs compatible tests in parallel within each page session
   */
  async processPageCompletely(
    url: string, 
    enabledTests: string[], 
    config: TestConfig
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let page: Page | null = null;

    try {
      this.uiStyler.displayProgress(`🌐 Loading page: ${new URL(url).pathname}`);
      page = await this.browserManager.createPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      // Group tests by compatibility for optimal parallel execution
      const testGroups = this.getParallelTestGroups(enabledTests);

      // Group 1: Run non-conflicting tests in parallel
      if (testGroups.nonConflicting.length > 0) {
        this.uiStyler.displayParallelExecution(testGroups.nonConflicting.length);
        
        const parallelTestPromises = testGroups.nonConflicting.map(async (testType) => {
          try {
            switch (testType) {
              case 'content-scraping':
                this.uiStyler.displayTestProgress('📄 Content scraping');
                return await this.contentScraper.scrapePageContentToStore(page!, url, this.dataManager);

              case 'seo':
                this.uiStyler.displayTestProgress('🔍 SEO analysis');
                return await this.seoTester.runSEOScan(page!, url, this.dataManager.sessionId);

              case 'api-key-scan':
                this.uiStyler.displayTestProgress('🔐 API key scan');
                return await this.apiKeyTester.runApiKeyScan(page!, url, this.dataManager.sessionId);

              default:
                throw new Error(`Unknown non-conflicting test type: ${testType}`);
            }
          } catch (error) {
            this.errorHandler.captureError(error, `${testType} test`);
            this.errorHandler.logTestError(testType, error);
            return this.errorHandler.createFailedTestResult(testType, error);
          }
        });

        const parallelResults = await Promise.all(parallelTestPromises);
        results.push(...parallelResults);
      }

      // Group 2: Accessibility tests are now handled in dedicated Phase 4 - removed from unified processing
      // This eliminates conflicts with other tests and provides cleaner isolation

      // Group 3: Screenshots are now handled in dedicated Phase 3 - removed from unified processing
      // This eliminates viewport conflicts and resource contention

      const totalTests = results.length;
      const successfulTests = results.filter(r => r.status === 'success').length;
      this.uiStyler.displayPageComplete(url, totalTests, successfulTests);
      return results;

    } catch (error) {
      this.errorHandler.captureError(error, `Page load for ${url}`);
      this.errorHandler.logPageLoadError(url, error);
      // Return failed results for all enabled tests
      return this.errorHandler.createFailedTestResultsForPage(enabledTests, error);

    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Process a single page for dedicated screenshot testing only
   * Used in Phase 3 to isolate screenshot tests from other tests
   */
  async processPageScreenshots(url: string, config: TestConfig, testType: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let page: Page | null = null;

    try {
      const isFullPage = testType === 'screenshots-full-page';
      const screenshotTypeLabel = isFullPage ? 'full-page screenshots' : 'above-the-fold screenshots';

      this.uiStyler.displayProgress(`📸 Loading page for ${screenshotTypeLabel}: ${new URL(url).pathname}`);
      page = await this.browserManager.createPage();

      await page.goto(url, { waitUntil: 'networkidle' });

      // Run ONLY screenshot tests - no other conflicting tests
      this.uiStyler.displayTestProgress(`📸 ${isFullPage ? 'Full-Page' : 'Above-Fold'} screenshots across ${config.viewports.length} viewports in isolation`);

      try {
        // Capture screenshots based on test type
        for (const viewport of config.viewports) {
          let screenshotResult: TestResult;

          if (isFullPage) {
            screenshotResult = await this.screenshotTester.captureScreenshot(
              page!,
              url,
              viewport,
              this.dataManager.sessionId
            );
          } else {
            screenshotResult = await this.screenshotTester.captureAboveTheFoldScreenshot(
              page!,
              url,
              viewport,
              this.dataManager.sessionId
            );
          }

          results.push(screenshotResult);
        }
      } catch (error) {
        this.errorHandler.captureError(error, 'screenshot tests');
        this.errorHandler.logScreenshotError('all viewports', error);
        // Create failed results for all viewports
        const failedResults = config.viewports.map(viewport =>
          this.errorHandler.createFailedTestResult(`${testType}-${viewport.name}`, error)
        );
        results.push(...failedResults);
      }

      const totalTests = results.length;
      const successfulTests = results.filter(r => r.status === 'success').length;
      this.uiStyler.displayPageComplete(url, totalTests, successfulTests);
      return results;

    } catch (error) {
      this.errorHandler.captureError(error, `Screenshot page load for ${url}`);
      this.errorHandler.logPageLoadError(url, error);
      // Return failed results for all viewports
      return config.viewports.map(viewport =>
        this.errorHandler.createFailedTestResult(`${testType}-${viewport.name}`, error)
      );

    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Process a single page for final analysis tests (like accessibility)
   * Used in Phase 4 for non-conflicting final analysis
   */
  async processPageFinalAnalysis(url: string, enabledTests: string[], config: TestConfig): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let page: Page | null = null;

    try {
      this.uiStyler.displayProgress(`🔍 Loading page for final analysis: ${new URL(url).pathname}`);
      page = await this.browserManager.createPage();
      
      await page.goto(url, { waitUntil: 'networkidle' });

      // Run final analysis tests (like accessibility)
      for (const testType of enabledTests) {
        try {
          switch (testType) {
            case 'accessibility':
              this.uiStyler.displayTestProgress('♿ Accessibility analysis');
              const accessibilityResult = await this.accessibilityTester.runAccessibilityScan(page!, url, this.dataManager.sessionId);
              results.push(accessibilityResult);
              break;
            default:
              throw new Error(`Unknown final analysis test type: ${testType}`);
          }
        } catch (error) {
          this.errorHandler.captureError(error, `${testType} test`);
          this.errorHandler.logTestError(testType, error);
          results.push(this.errorHandler.createFailedTestResult(testType, error));
        }
      }

      const totalTests = results.length;
      const successfulTests = results.filter(r => r.status === 'success').length;
      this.uiStyler.displayPageComplete(url, totalTests, successfulTests);
      return results;

    } catch (error) {
      this.errorHandler.captureError(error, `Final analysis page load for ${url}`);
      this.errorHandler.logPageLoadError(url, error);
      // Return failed results for all enabled tests
      return this.errorHandler.createFailedTestResultsForPage(enabledTests, error);

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
  getParallelTestGroups(enabledTests: string[]): {
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
   * Utility method to get human-readable test names
   */
  private getTestName(testId: string): string {
    const testNames: Record<string, string> = {
      'site-crawling': 'Site Crawling',
      'sitemap': 'Sitemap Generation',
      'content-scraping': 'Content Scraping',
      'screenshots-full-page': 'Full-Page Screenshots',
      'screenshots-above-fold': 'Above-The-Fold Screenshots',
      'seo': 'SEO Scan',
      'accessibility': 'Accessibility Scan',
      'site-summary': 'Site Summary',
      'api-key-scan': 'API Key Security Scan'
    };

    return testNames[testId] || testId;
  }
}