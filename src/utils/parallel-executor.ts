import { Browser, Page } from 'playwright';
import chalk from 'chalk';
import { TestResult, PageResult, TestConfig } from '../types/index';

export interface ParallelTask<T> {
  id: string;
  name: string;
  execute: () => Promise<T>;
}

export interface PageTestTask {
  url: string;
  testType: string;
  testName: string;
  execute: (page: Page) => Promise<TestResult>;
}

export interface BatchResult<T> {
  successful: { id: string; result: T }[];
  failed: { id: string; error: string }[];
  duration: number;
}

export class ParallelExecutor {
  private browser: Browser;
  private maxConcurrency: number;

  constructor(browser: Browser, maxConcurrency: number = 5) {
    this.browser = browser;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Execute multiple tasks in parallel with concurrency control
   */
  async executeTasks<T>(
    tasks: ParallelTask<T>[],
    options: {
      maxConcurrency?: number;
      description?: string;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<BatchResult<T>> {
    const startTime = Date.now();
    const concurrency = options.maxConcurrency || this.maxConcurrency;
    const description = options.description || 'tasks';
    
    console.log(chalk.blue(`🚀 Starting ${tasks.length} ${description} (max ${concurrency} concurrent)`));

    const successful: { id: string; result: T }[] = [];
    const failed: { id: string; error: string }[] = [];
    
    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      
      console.log(chalk.gray(`   Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} ${description})`));
      
      const batchPromises = batch.map(async (task) => {
        try {
          const result = await task.execute();
          successful.push({ id: task.id, result });
          
          if (options.onProgress) {
            options.onProgress(successful.length + failed.length, tasks.length);
          }
          
          return { success: true, id: task.id, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({ id: task.id, error: errorMessage });
          
          console.log(chalk.yellow(`   ⚠️  ${task.name} failed: ${errorMessage}`));
          
          if (options.onProgress) {
            options.onProgress(successful.length + failed.length, tasks.length);
          }
          
          return { success: false, id: task.id, error: errorMessage };
        }
      });

      await Promise.all(batchPromises);
    }

    const duration = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Completed ${tasks.length} ${description} in ${duration}ms`));
    console.log(chalk.green(`   Success: ${successful.length}, Failed: ${failed.length}`));

    return { successful, failed, duration };
  }

  /**
   * Execute page-level tests in parallel across multiple pages
   */
  async executePageTests(
    urls: string[],
    pageTestTasks: PageTestTask[],
    options: {
      maxConcurrency?: number;
      onPageProgress?: (completedPages: number, totalPages: number) => void;
      onTestProgress?: (completedTests: number, totalTests: number) => void;
    } = {}
  ): Promise<Map<string, PageResult>> {
    const concurrency = options.maxConcurrency || this.maxConcurrency;
    const pageResults = new Map<string, PageResult>();
    
    console.log(chalk.blue(`🌐 Testing ${urls.length} pages with ${pageTestTasks.length} test types`));
    
    let completedPages = 0;
    let completedTests = 0;
    const totalTests = urls.length * pageTestTasks.length;

    // Process pages in parallel batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const urlBatch = urls.slice(i, i + concurrency);
      
      const pagePromises = urlBatch.map(async (url) => {
        const page = await this.browser.newPage();
        
        try {
          console.log(chalk.gray(`   📄 Testing ${url}`));
          await page.goto(url, { waitUntil: 'networkidle' });
          
          const pageResult: PageResult = {
            url,
            pageName: this.getPageName(url),
            tests: [],
            summary: ''
          };

          // Execute all tests for this page in parallel
          const testPromises = pageTestTasks.map(async (task) => {
            if (task.url !== url) return null; // Skip if not for this URL
            
            try {
              const testResult = await task.execute(page);
              completedTests++;
              
              if (options.onTestProgress) {
                options.onTestProgress(completedTests, totalTests);
              }
              
              return testResult;
            } catch (error) {
              completedTests++;
              
              if (options.onTestProgress) {
                options.onTestProgress(completedTests, totalTests);
              }
              
              return {
                testType: task.testType,
                status: 'failed' as const,
                startTime: new Date(),
                endTime: new Date(),
                error: error instanceof Error ? error.message : String(error)
              };
            }
          });

          const testResults = (await Promise.all(testPromises)).filter(r => r !== null) as TestResult[];
          pageResult.tests = testResults;
          pageResult.summary = this.generatePageSummary(pageResult);
          
          pageResults.set(url, pageResult);
          completedPages++;
          
          if (options.onPageProgress) {
            options.onPageProgress(completedPages, urls.length);
          }
          
          console.log(chalk.green(`   ✅ Completed testing ${url}`));
          
        } catch (error) {
          console.error(chalk.red(`   ❌ Error testing ${url}:`), error);
          
          pageResults.set(url, {
            url,
            pageName: this.getPageName(url),
            tests: [{
              testType: 'page-load',
              status: 'failed',
              startTime: new Date(),
              endTime: new Date(),
              error: error instanceof Error ? error.message : String(error)
            }],
            summary: 'Page failed to load'
          });
          
          completedPages++;
          
          if (options.onPageProgress) {
            options.onPageProgress(completedPages, urls.length);
          }
          
        } finally {
          await page.close();
        }
      });

      await Promise.all(pagePromises);
    }

    return pageResults;
  }

  /**
   * Execute screenshot tests across multiple viewports in parallel
   */
  async executeScreenshotTests(
    page: Page,
    url: string,
    viewports: Array<{ name: string; width: number; height: number }>,
    sessionId: string,
    screenshotTester: any // Import would be circular, so using any for now
  ): Promise<TestResult[]> {
    const tasks: ParallelTask<TestResult>[] = viewports.map(viewport => ({
      id: `screenshot-${viewport.name}`,
      name: `Screenshot (${viewport.name})`,
      execute: async () => {
        // Create a new page for each viewport to avoid conflicts
        const viewportPage = await this.browser.newPage();
        try {
          await viewportPage.goto(url, { waitUntil: 'networkidle' });
          return await screenshotTester.captureScreenshot(viewportPage, url, viewport, sessionId);
        } finally {
          await viewportPage.close();
        }
      }
    }));

    const result = await this.executeTasks(tasks, {
      maxConcurrency: viewports.length, // All viewports can run simultaneously
      description: 'screenshot tests'
    });

    return result.successful.map(s => s.result);
  }

  /**
   * Create page test tasks for a specific URL and test configuration
   */
  createPageTestTasks(
    url: string,
    config: TestConfig,
    sessionId: string,
    testers: {
      screenshotTester?: any;
      seoTester?: any;
      accessibilityTester?: any;
      contentScraper?: any;
    }
  ): PageTestTask[] {
    const tasks: PageTestTask[] = [];

    config.selectedTests.forEach(test => {
      if (!test.enabled) return;

      switch (test.id) {
        case 'screenshots':
          // Create separate tasks for each viewport
          config.viewports.forEach(viewport => {
            tasks.push({
              url,
              testType: `screenshots-${viewport.name}`,
              testName: `Screenshot (${viewport.name})`,
              execute: async (page: Page) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                return await testers.screenshotTester.captureScreenshot(page, url, viewport, sessionId);
              }
            });
          });
          break;

        case 'seo':
          tasks.push({
            url,
            testType: 'seo',
            testName: 'SEO Scan',
            execute: async (page: Page) => {
              return await testers.seoTester.runSEOScan(page, url, sessionId);
            }
          });
          break;

        case 'accessibility':
          tasks.push({
            url,
            testType: 'accessibility',
            testName: 'Accessibility Scan',
            execute: async (page: Page) => {
              return await testers.accessibilityTester.runAccessibilityScan(page, url, sessionId);
            }
          });
          break;

        case 'content-scraping':
          tasks.push({
            url,
            testType: 'content-scraping',
            testName: 'Content Scraping',
            execute: async (page: Page) => {
              return await testers.contentScraper.scrapePageContent(page, url, sessionId);
            }
          });
          break;
      }
    });

    return tasks;
  }

  /**
   * Utility methods
   */
  private getPageName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length === 0) {
        return 'home';
      }
      
      return pathSegments.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    } catch (error) {
      return 'unknown-page';
    }
  }

  private generatePageSummary(pageResult: PageResult): string {
    const successCount = pageResult.tests.filter(t => t.status === 'success').length;
    const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
    const totalTests = pageResult.tests.length;

    return `Page: ${pageResult.url}\nTests completed: ${totalTests}\nSuccessful: ${successCount}\nFailed: ${failCount}`;
  }

  /**
   * Batch processing utility for large datasets
   */
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = this.maxConcurrency,
    onBatchComplete?: (batchIndex: number, totalBatches: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);

      if (onBatchComplete) {
        onBatchComplete(Math.floor(i / batchSize) + 1, totalBatches);
      }
    }

    return results;
  }
}