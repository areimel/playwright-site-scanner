"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParallelExecutor = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ParallelExecutor {
    browser;
    maxConcurrency;
    constructor(browser, maxConcurrency = 5) {
        this.browser = browser;
        this.maxConcurrency = maxConcurrency;
    }
    /**
     * Execute multiple tasks in parallel with concurrency control
     */
    async executeTasks(tasks, options = {}) {
        const startTime = Date.now();
        const concurrency = options.maxConcurrency || this.maxConcurrency;
        const description = options.description || 'tasks';
        console.log(chalk_1.default.blue(`🚀 Starting ${tasks.length} ${description} (max ${concurrency} concurrent)`));
        const successful = [];
        const failed = [];
        // Process tasks in batches
        for (let i = 0; i < tasks.length; i += concurrency) {
            const batch = tasks.slice(i, i + concurrency);
            console.log(chalk_1.default.gray(`   Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} ${description})`));
            const batchPromises = batch.map(async (task) => {
                try {
                    const result = await task.execute();
                    successful.push({ id: task.id, result });
                    if (options.onProgress) {
                        options.onProgress(successful.length + failed.length, tasks.length);
                    }
                    return { success: true, id: task.id, result };
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    failed.push({ id: task.id, error: errorMessage });
                    console.log(chalk_1.default.yellow(`   ⚠️  ${task.name} failed: ${errorMessage}`));
                    if (options.onProgress) {
                        options.onProgress(successful.length + failed.length, tasks.length);
                    }
                    return { success: false, id: task.id, error: errorMessage };
                }
            });
            await Promise.all(batchPromises);
        }
        const duration = Date.now() - startTime;
        console.log(chalk_1.default.green(`✅ Completed ${tasks.length} ${description} in ${duration}ms`));
        console.log(chalk_1.default.green(`   Success: ${successful.length}, Failed: ${failed.length}`));
        return { successful, failed, duration };
    }
    /**
     * Execute page-level tests in parallel across multiple pages
     */
    async executePageTests(urls, pageTestTasks, options = {}) {
        const concurrency = options.maxConcurrency || this.maxConcurrency;
        const pageResults = new Map();
        console.log(chalk_1.default.blue(`🌐 Testing ${urls.length} pages with ${pageTestTasks.length} test types`));
        let completedPages = 0;
        let completedTests = 0;
        const totalTests = urls.length * pageTestTasks.length;
        // Process pages in parallel batches
        for (let i = 0; i < urls.length; i += concurrency) {
            const urlBatch = urls.slice(i, i + concurrency);
            const pagePromises = urlBatch.map(async (url) => {
                const page = await this.browser.newPage();
                try {
                    console.log(chalk_1.default.gray(`   📄 Testing ${url}`));
                    await page.goto(url, { waitUntil: 'networkidle' });
                    const pageResult = {
                        url,
                        pageName: this.getPageName(url),
                        tests: [],
                        summary: ''
                    };
                    // Execute all tests for this page in parallel
                    const testPromises = pageTestTasks.map(async (task) => {
                        if (task.url !== url)
                            return null; // Skip if not for this URL
                        try {
                            const testResult = await task.execute(page);
                            completedTests++;
                            if (options.onTestProgress) {
                                options.onTestProgress(completedTests, totalTests);
                            }
                            return testResult;
                        }
                        catch (error) {
                            completedTests++;
                            if (options.onTestProgress) {
                                options.onTestProgress(completedTests, totalTests);
                            }
                            return {
                                testType: task.testType,
                                status: 'failed',
                                startTime: new Date(),
                                endTime: new Date(),
                                error: error instanceof Error ? error.message : String(error)
                            };
                        }
                    });
                    const testResults = (await Promise.all(testPromises)).filter(r => r !== null);
                    pageResult.tests = testResults;
                    pageResult.summary = this.generatePageSummary(pageResult);
                    pageResults.set(url, pageResult);
                    completedPages++;
                    if (options.onPageProgress) {
                        options.onPageProgress(completedPages, urls.length);
                    }
                    console.log(chalk_1.default.green(`   ✅ Completed testing ${url}`));
                }
                catch (error) {
                    console.error(chalk_1.default.red(`   ❌ Error testing ${url}:`), error);
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
                }
                finally {
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
    async executeScreenshotTests(page, url, viewports, sessionId, screenshotTester // Import would be circular, so using any for now
    ) {
        const tasks = viewports.map(viewport => ({
            id: `screenshot-${viewport.name}`,
            name: `Screenshot (${viewport.name})`,
            execute: async () => {
                // Create a new page for each viewport to avoid conflicts
                const viewportPage = await this.browser.newPage();
                try {
                    await viewportPage.goto(url, { waitUntil: 'networkidle' });
                    return await screenshotTester.captureScreenshot(viewportPage, url, viewport, sessionId);
                }
                finally {
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
    createPageTestTasks(url, config, sessionId, testers) {
        const tasks = [];
        config.selectedTests.forEach(test => {
            if (!test.enabled)
                return;
            switch (test.id) {
                case 'screenshots':
                    // Create separate tasks for each viewport
                    config.viewports.forEach(viewport => {
                        tasks.push({
                            url,
                            testType: `screenshots-${viewport.name}`,
                            testName: `Screenshot (${viewport.name})`,
                            execute: async (page) => {
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
                        execute: async (page) => {
                            return await testers.seoTester.runSEOScan(page, url, sessionId);
                        }
                    });
                    break;
                case 'accessibility':
                    tasks.push({
                        url,
                        testType: 'accessibility',
                        testName: 'Accessibility Scan',
                        execute: async (page) => {
                            return await testers.accessibilityTester.runAccessibilityScan(page, url, sessionId);
                        }
                    });
                    break;
                case 'content-scraping':
                    tasks.push({
                        url,
                        testType: 'content-scraping',
                        testName: 'Content Scraping',
                        execute: async (page) => {
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
    getPageName(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            if (pathSegments.length === 0) {
                return 'home';
            }
            return pathSegments.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
        }
        catch (error) {
            return 'unknown-page';
        }
    }
    generatePageSummary(pageResult) {
        const successCount = pageResult.tests.filter(t => t.status === 'success').length;
        const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
        const totalTests = pageResult.tests.length;
        return `Page: ${pageResult.url}\nTests completed: ${totalTests}\nSuccessful: ${successCount}\nFailed: ${failCount}`;
    }
    /**
     * Batch processing utility for large datasets
     */
    async processBatches(items, processor, batchSize = this.maxConcurrency, onBatchComplete) {
        const results = [];
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
exports.ParallelExecutor = ParallelExecutor;
//# sourceMappingURL=parallel-executor.js.map