import { Browser, Page } from 'playwright';
import chalk from 'chalk';
import { TestResult, PageResult, TestConfig } from '../types/index.js';
import { LoadingScreen } from './loading-screen/index.js';

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
  private loadingScreen: LoadingScreen | null = null;

  constructor(browser: Browser, maxConcurrency: number = 5) {
    this.browser = browser;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Set the loading screen instance for progress updates
   */
  setLoadingScreen(loadingScreen: LoadingScreen): void {
    this.loadingScreen = loadingScreen;
  }

  /**
   * Execute multiple tasks in parallel with concurrency control using worker pool pattern
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
    
    // Use LoadingScreen if available, otherwise fall back to console logging
    if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
      this.loadingScreen.setProgressContext(description);
      this.loadingScreen.updateTaskProgress(0, tasks.length, description);
      this.loadingScreen.updateThreadInfo(0, concurrency);
    } else {
      // Route through LoadingScreen for consistent handling
      if (this.loadingScreen) {
        this.loadingScreen.log(chalk.blue(`🚀 Starting ${tasks.length} ${description} (max ${concurrency} concurrent)`));
      } else {
        console.log(chalk.blue(`🚀 Starting ${tasks.length} ${description} (max ${concurrency} concurrent)`));
      }
    }

    const successful: { id: string; result: T }[] = [];
    const failed: { id: string; error: string }[] = [];
    const taskQueue = [...tasks]; // Copy array to avoid mutation
    const runningPromises: Promise<void>[] = [];
    let activeWorkers = 0;
    
    // Worker function that processes tasks from the queue
    const worker = async (): Promise<void> => {
      while (taskQueue.length > 0) {
        const task = taskQueue.shift();
        if (!task) break;
        
        // Update active worker count
        activeWorkers++;
        if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
          this.loadingScreen.updateThreadInfo(activeWorkers, concurrency);
        }
        
        try {
          const result = await task.execute();
          successful.push({ id: task.id, result });
          
          const completedCount = successful.length + failed.length;
          
          // Update progress
          if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
            this.loadingScreen.updateTaskProgress(completedCount, tasks.length, description);
          }
          
          if (options.onProgress) {
            options.onProgress(completedCount, tasks.length);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({ id: task.id, error: errorMessage });
          
          const completedCount = successful.length + failed.length;
          
          // Update progress and log error
          if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
            this.loadingScreen.updateTaskProgress(completedCount, tasks.length, description);
          } else {
            // Route error through LoadingScreen for consistent handling
            if (this.loadingScreen) {
              this.loadingScreen.log(`⚠️  ${task.name} failed: ${errorMessage}`, 'warning');
            } else {
              console.log(chalk.yellow(`   ⚠️  ${task.name} failed: ${errorMessage}`));
            }
          }
          
          if (options.onProgress) {
            options.onProgress(completedCount, tasks.length);
          }
        }
        
        // Update active worker count
        activeWorkers--;
        if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
          this.loadingScreen.updateThreadInfo(activeWorkers, concurrency);
        }
      }
    };
    
    // Start worker pool with maximum concurrency
    const workerCount = Math.min(concurrency, tasks.length);
    for (let i = 0; i < workerCount; i++) {
      runningPromises.push(worker());
    }
    
    // Wait for all workers to complete
    await Promise.all(runningPromises);

    const duration = Date.now() - startTime;
    
    // Final status update
    if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
      this.loadingScreen.updateThreadInfo(0, concurrency);
    } else {
      // Route completion messages through LoadingScreen
      if (this.loadingScreen) {
        this.loadingScreen.log(`✅ Completed ${tasks.length} ${description} in ${duration}ms`, 'success');
        this.loadingScreen.log(`   Success: ${successful.length}, Failed: ${failed.length}`, 'success');
      } else {
        console.log(chalk.green(`✅ Completed ${tasks.length} ${description} in ${duration}ms`));
        console.log(chalk.green(`   Success: ${successful.length}, Failed: ${failed.length}`));
      }
    }

    return { successful, failed, duration };
  }

  /**
   * Execute page-level tests in parallel across multiple pages using worker pool pattern
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
    
    // Use LoadingScreen if available, otherwise fall back to console logging
    if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
      this.loadingScreen.setProgressContext('page testing');
      this.loadingScreen.updateTaskProgress(0, urls.length, 'page testing');
      this.loadingScreen.updateThreadInfo(0, concurrency);
    } else {
      // Route through LoadingScreen for consistent handling
      if (this.loadingScreen) {
        this.loadingScreen.log(`🌐 Testing ${urls.length} pages with ${pageTestTasks.length} test types`);
      } else {
        console.log(chalk.blue(`🌐 Testing ${urls.length} pages with ${pageTestTasks.length} test types`));
      }
    }
    
    let completedPages = 0;
    let completedTests = 0;
    const totalTests = urls.length * pageTestTasks.length;
    const urlQueue = [...urls]; // Copy array to avoid mutation
    const runningPromises: Promise<void>[] = [];

    // Worker function that processes URLs from the queue
    const worker = async (): Promise<void> => {
      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;
        
        const page = await this.browser.newPage();
        
        try {
          // Update loading screen if available, otherwise log
          if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
            // Loading screen handles the display
          } else {
            // Route through LoadingScreen for consistent handling
            if (this.loadingScreen) {
              this.loadingScreen.log(`📄 Testing ${url}`, 'info');
            } else {
              console.log(chalk.gray(`   📄 Testing ${url}`));
            }
          }
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
          
          // Update loading screen progress
          if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
            this.loadingScreen.updateTaskProgress(completedPages, urls.length, 'page testing');
          }
          
          if (options.onPageProgress) {
            options.onPageProgress(completedPages, urls.length);
          }
          
          if (this.loadingScreen && this.loadingScreen.isVerboseMode()) {
            this.loadingScreen.log(`✅ Completed testing ${url}`, 'success');
          }
          
        } catch (error) {
          // Route error through LoadingScreen for consistent handling
          if (this.loadingScreen) {
            this.loadingScreen.log(`❌ Error testing ${url}: ${error}`, 'error');
          } else {
            console.error(chalk.red(`   ❌ Error testing ${url}:`), error);
          }
          
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
      }
    };
    
    // Start worker pool with maximum concurrency
    const workerCount = Math.min(concurrency, urls.length);
    for (let i = 0; i < workerCount; i++) {
      runningPromises.push(worker());
    }
    
    // Wait for all workers to complete
    await Promise.all(runningPromises);

    return pageResults;
  }

  /**
   * Execute screenshot tests across multiple viewports in parallel
   * Fixed to return BOTH successful and failed results
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
          // Add timeout to prevent hanging on slow pages
          await viewportPage.goto(url, { 
            waitUntil: 'networkidle', 
            timeout: 30000 // 30 second timeout
          });
          return await screenshotTester.captureScreenshot(viewportPage, url, viewport, sessionId);
        } finally {
          await viewportPage.close();
        }
      }
    }));

    const result = await this.executeTasks(tasks, {
      maxConcurrency: Math.min(2, viewports.length), // Limit concurrency to prevent resource exhaustion
      description: 'screenshots'
    });

    // CRITICAL FIX: Return ALL results (both successful AND failed)
    // Convert failed tasks to proper TestResult objects
    const allResults: TestResult[] = [
      ...result.successful.map(s => s.result),
      ...result.failed.map(f => this.createFailedTestResult(f, viewports))
    ];

    return allResults;
  }

  /**
   * Create a failed TestResult from a failed task
   */
  private createFailedTestResult(
    failedTask: { id: string; error: string }, 
    viewports: Array<{ name: string; width: number; height: number }>
  ): TestResult {
    // Extract viewport name from task ID
    const viewportName = failedTask.id.replace('screenshot-', '');
    
    return {
      testType: `screenshots-${viewportName}`,
      status: 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      error: `Screenshot failed for ${viewportName} viewport: ${failedTask.error}`
    };
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
   * Parallel processing utility for large datasets using worker pool pattern
   */
  async processBatches<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrency: number = this.maxConcurrency,
    onItemComplete?: (completedItems: number, totalItems: number) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const itemQueue = [...items]; // Copy array to avoid mutation
    const runningPromises: Promise<void>[] = [];
    let completedItems = 0;

    // Worker function that processes items from the queue
    const worker = async (): Promise<void> => {
      while (itemQueue.length > 0) {
        const item = itemQueue.shift();
        if (!item) break;
        
        try {
          const result = await processor(item);
          results.push(result);
          completedItems++;
          
          if (onItemComplete) {
            onItemComplete(completedItems, items.length);
          }
        } catch (error) {
          // Note: You might want to handle errors differently based on requirements
          completedItems++;
          
          if (onItemComplete) {
            onItemComplete(completedItems, items.length);
          }
          
          throw error; // Re-throw to maintain error handling behavior
        }
      }
    };

    // Start worker pool with maximum concurrency
    const workerCount = Math.min(maxConcurrency, items.length);
    for (let i = 0; i < workerCount; i++) {
      runningPromises.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(runningPromises);

    return results;
  }
}