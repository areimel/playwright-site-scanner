import { chromium, Browser, Page } from 'playwright';
import chalk from 'chalk';
import { TestConfig, SessionSummary, PageResult, TestResult, ProgressState } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { SiteCrawler } from '../lib/site-crawler.js';
import { ScreenshotTester } from '../lib/screenshot-tester.js';
import { SEOTester } from '../lib/seo-tester.js';
import { AccessibilityTester } from '../lib/accessibility-tester.js';

export class TestOrchestrator {
  private browser: Browser | null = null;
  private sessionManager: SessionManager;
  private progressTracker: ProgressTracker;
  private siteCrawler: SiteCrawler;
  private screenshotTester: ScreenshotTester;
  private seoTester: SEOTester;
  private accessibilityTester: AccessibilityTester;

  constructor() {
    this.sessionManager = new SessionManager();
    this.progressTracker = new ProgressTracker();
    this.siteCrawler = new SiteCrawler();
    this.screenshotTester = new ScreenshotTester();
    this.seoTester = new SEOTester();
    this.accessibilityTester = new AccessibilityTester();
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
      console.log(chalk.blue('🚀 Initializing browser...'));
      await this.initializeBrowser();

      console.log(chalk.blue('🔍 Discovering pages...'));
      const pagesToTest = await this.discoverPages(config);
      sessionSummary.totalPages = pagesToTest.length;

      console.log(chalk.green(`✅ Found ${pagesToTest.length} page(s) to test\n`));

      await this.sessionManager.createSessionDirectory(sessionSummary.sessionId);
      
      this.progressTracker.initialize({
        currentTest: '',
        completedTests: 0,
        totalTests: this.calculateTotalTests(config, pagesToTest.length),
        currentPage: '',
        completedPages: 0,
        totalPages: pagesToTest.length
      });

      const pageResults: PageResult[] = [];

      for (let i = 0; i < pagesToTest.length; i++) {
        const pageUrl = pagesToTest[i];
        console.log(chalk.blue(`\n📄 Testing page ${i + 1}/${pagesToTest.length}: ${pageUrl}`));
        
        this.progressTracker.updateCurrentPage(pageUrl, i);
        
        const pageResult = await this.testPage(pageUrl, config, sessionSummary.sessionId);
        pageResults.push(pageResult);
        
        sessionSummary.testsRun += pageResult.tests.length;
        sessionSummary.testsSucceeded += pageResult.tests.filter(t => t.status === 'success').length;
        sessionSummary.testsFailed += pageResult.tests.filter(t => t.status === 'failed').length;
        
        this.progressTracker.updateCompletedPages(i + 1);
      }

      sessionSummary.endTime = new Date();
      
      console.log(chalk.blue('\n📊 Generating session summary...'));
      await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
      
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

  private async discoverPages(config: TestConfig): Promise<string[]> {
    if (config.crawlSite) {
      return await this.siteCrawler.crawlSite(config.url);
    } else {
      return [config.url];
    }
  }

  private calculateTotalTests(config: TestConfig, pageCount: number): number {
    return config.selectedTests.length * pageCount * config.viewports.length;
  }

  private async testPage(pageUrl: string, config: TestConfig, sessionId: string): Promise<PageResult> {
    const page = await this.browser!.newPage();
    const pageResult: PageResult = {
      url: pageUrl,
      pageName: this.sessionManager.getPageName(pageUrl),
      tests: [],
      summary: ''
    };

    try {
      console.log(chalk.gray(`  Navigating to ${pageUrl}...`));
      await page.goto(pageUrl, { waitUntil: 'networkidle' });

      for (const test of config.selectedTests) {
        if (!test.enabled) continue;

        this.progressTracker.updateCurrentTest(`${test.name} on ${pageResult.pageName}`);
        
        const testResults = await this.executeTest(test.id, page, pageUrl, config, sessionId);
        pageResult.tests.push(...testResults);
        
        this.progressTracker.incrementCompletedTests(testResults.length);
      }

      pageResult.summary = this.generatePageSummary(pageResult);
      await this.sessionManager.savePageSummary(sessionId, pageResult);

    } catch (error) {
      console.error(chalk.red(`  ❌ Error testing page ${pageUrl}:`), error);
      pageResult.tests.push({
        testType: 'page-load',
        status: 'failed',
        startTime: new Date(),
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await page.close();
    }

    return pageResult;
  }

  private async executeTest(
    testType: string, 
    page: Page, 
    pageUrl: string, 
    config: TestConfig, 
    sessionId: string
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    switch (testType) {
      case 'screenshots':
        for (const viewport of config.viewports) {
          const result = await this.screenshotTester.captureScreenshot(
            page, pageUrl, viewport, sessionId
          );
          results.push(result);
        }
        break;

      case 'seo':
        const seoResult = await this.seoTester.runSEOScan(page, pageUrl, sessionId);
        results.push(seoResult);
        break;

      case 'accessibility':
        const a11yResult = await this.accessibilityTester.runAccessibilityScan(page, pageUrl, sessionId);
        results.push(a11yResult);
        break;

      default:
        console.warn(chalk.yellow(`⚠️  Unknown test type: ${testType}`));
    }

    return results;
  }

  private generatePageSummary(pageResult: PageResult): string {
    const successCount = pageResult.tests.filter(t => t.status === 'success').length;
    const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
    const totalTests = pageResult.tests.length;

    return `Page: ${pageResult.url}\nTests completed: ${totalTests}\nSuccessful: ${successCount}\nFailed: ${failCount}`;
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