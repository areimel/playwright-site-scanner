"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestOrchestrator = void 0;
const playwright_1 = require("playwright");
const chalk_1 = __importDefault(require("chalk"));
const test_phases_js_1 = require("../types/test-phases.js");
const session_manager_js_1 = require("../utils/session-manager.js");
const progress_tracker_js_1 = require("../utils/progress-tracker.js");
const session_data_store_js_1 = require("../utils/session-data-store.js");
const parallel_executor_js_1 = require("../utils/parallel-executor.js");
const crawlee_site_crawler_js_1 = require("../lib/crawlee-site-crawler.js");
const screenshot_tester_js_1 = require("../lib/screenshot-tester.js");
const seo_tester_js_1 = require("../lib/seo-tester.js");
const accessibility_tester_js_1 = require("../lib/accessibility-tester.js");
const sitemap_tester_js_1 = require("../lib/sitemap-tester.js");
const content_scraper_js_1 = require("../lib/content-scraper.js");
const site_summary_tester_js_1 = require("../lib/site-summary-tester.js");
class TestOrchestrator {
    browser = null;
    sessionManager;
    progressTracker;
    dataManager = null;
    parallelExecutor = null;
    siteCrawler;
    screenshotTester;
    seoTester;
    accessibilityTester;
    sitemapTester;
    contentScraper;
    siteSummaryTester;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
        this.progressTracker = new progress_tracker_js_1.ProgressTracker();
        this.siteCrawler = new crawlee_site_crawler_js_1.CrawleeSiteCrawler();
        this.screenshotTester = new screenshot_tester_js_1.ScreenshotTester();
        this.seoTester = new seo_tester_js_1.SEOTester();
        this.accessibilityTester = new accessibility_tester_js_1.AccessibilityTester();
        this.sitemapTester = new sitemap_tester_js_1.SitemapTester();
        this.contentScraper = new content_scraper_js_1.ContentScraper();
        this.siteSummaryTester = new site_summary_tester_js_1.SiteSummaryTester();
    }
    async runTests(config) {
        const sessionSummary = {
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
            console.log(chalk_1.default.blue('🚀 Initializing browser and parallel execution...'));
            await this.initializeBrowser();
            // Initialize data manager and parallel executor
            this.dataManager = new session_data_store_js_1.SessionDataManager(config.url, sessionSummary.sessionId);
            this.parallelExecutor = new parallel_executor_js_1.ParallelExecutor(this.browser, 5);
            // Create session directory
            await this.sessionManager.createSessionDirectory(sessionSummary.sessionId);
            // Analyze test configuration and create execution strategy
            const executionStrategy = test_phases_js_1.TestPhaseManager.organizeTestsIntoPhases(config);
            console.log(chalk_1.default.blue(`📋 Execution strategy: ${executionStrategy.phases.length} phases`));
            console.log(chalk_1.default.gray(`   Estimated duration: ${executionStrategy.totalEstimatedDuration}s`));
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
            console.log(chalk_1.default.blue('\n📊 Generating session summary...'));
            await this.generateFinalSessionSummary(sessionSummary);
            this.displayCompletionSummary(sessionSummary);
        }
        catch (error) {
            console.error(chalk_1.default.red('\n❌ Test session failed:'), error);
            sessionSummary.errors.push(error instanceof Error ? error.message : String(error));
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    async initializeBrowser() {
        this.browser = await playwright_1.chromium.launch({
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
    async executePhase1(config, strategy) {
        const phase1Plan = strategy.phases.find(p => p.phase === 1);
        if (!phase1Plan)
            return;
        console.log(chalk_1.default.blue('\n🔍 Phase 1: Data Discovery & Collection'));
        // Step 1: Site crawling (if needed)
        let urls = [config.url];
        if (config.crawlSite || phase1Plan.sessionTests.includes('site-crawling')) {
            console.log(chalk_1.default.gray('   🕷️  Discovering pages...'));
            urls = await this.siteCrawler.crawlSite(config.url);
            console.log(chalk_1.default.green(`   ✅ Found ${urls.length} pages`));
        }
        this.dataManager.setUrls(urls);
        // Step 2: Execute session-level tests in parallel
        if (phase1Plan.sessionTests.length > 0) {
            console.log(chalk_1.default.gray(`   🎯 Running ${phase1Plan.sessionTests.length} session-level tests...`));
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
                await this.parallelExecutor.executeTasks(sessionTasks, {
                    description: 'session tests',
                    maxConcurrency: 2
                });
            }
        }
        // Step 3: Content scraping for all pages in parallel
        if (phase1Plan.pageTests.includes('content-scraping')) {
            console.log(chalk_1.default.gray(`   📄 Scraping content from ${urls.length} pages...`));
            const scrapingTasks = urls.map(url => ({
                id: `content-${url}`,
                name: `Content scraping (${new URL(url).pathname})`,
                execute: async () => {
                    const page = await this.browser.newPage();
                    try {
                        await page.goto(url, { waitUntil: 'networkidle' });
                        const result = await this.contentScraper.scrapePageContentToStore(page, url, this.dataManager);
                        return result;
                    }
                    finally {
                        await page.close();
                    }
                }
            }));
            await this.parallelExecutor.executeTasks(scrapingTasks, {
                description: 'content scraping',
                maxConcurrency: phase1Plan.maxConcurrency
            });
        }
        this.dataManager.markPhaseComplete(1);
        console.log(chalk_1.default.green('   ✅ Phase 1 completed\n'));
    }
    /**
     * Phase 2: Page Analysis & Testing
     * - Screenshots across all viewports
     * - SEO scans
     * - Accessibility testing
     */
    async executePhase2(config, strategy) {
        const phase2Plan = strategy.phases.find(p => p.phase === 2);
        if (!phase2Plan || phase2Plan.pageTests.length === 0)
            return;
        console.log(chalk_1.default.blue('\n🔬 Phase 2: Page Analysis & Testing'));
        const urls = this.dataManager.getUrls();
        const pageTests = phase2Plan.pageTests;
        console.log(chalk_1.default.gray(`   🎯 Running ${pageTests.length} test types on ${urls.length} pages...`));
        // Create all page test tasks
        const allPageTasks = [];
        for (const url of urls) {
            for (const testType of pageTests) {
                if (testType === 'screenshots') {
                    // Create separate tasks for each viewport
                    for (const viewport of config.viewports) {
                        allPageTasks.push({
                            id: `${testType}-${viewport.name}-${url}`,
                            name: `Screenshot ${viewport.name} (${new URL(url).pathname})`,
                            execute: async () => {
                                const page = await this.browser.newPage();
                                try {
                                    await page.goto(url, { waitUntil: 'networkidle' });
                                    await page.setViewportSize({ width: viewport.width, height: viewport.height });
                                    return await this.screenshotTester.captureScreenshot(page, url, viewport, this.dataManager.sessionId);
                                }
                                finally {
                                    await page.close();
                                }
                            }
                        });
                    }
                }
                else {
                    allPageTasks.push({
                        id: `${testType}-${url}`,
                        name: `${this.getTestName(testType)} (${new URL(url).pathname})`,
                        execute: async () => {
                            const page = await this.browser.newPage();
                            try {
                                await page.goto(url, { waitUntil: 'networkidle' });
                                switch (testType) {
                                    case 'seo':
                                        return await this.seoTester.runSEOScan(page, url, this.dataManager.sessionId);
                                    case 'accessibility':
                                        return await this.accessibilityTester.runAccessibilityScan(page, url, this.dataManager.sessionId);
                                    default:
                                        throw new Error(`Unknown page test: ${testType}`);
                                }
                            }
                            finally {
                                await page.close();
                            }
                        }
                    });
                }
            }
        }
        // Execute all page tests in parallel
        await this.parallelExecutor.executeTasks(allPageTasks, {
            description: 'page analysis tests',
            maxConcurrency: phase2Plan.maxConcurrency,
            onProgress: (completed, total) => {
                console.log(chalk_1.default.gray(`      Progress: ${completed}/${total} tests completed`));
            }
        });
        this.dataManager.markPhaseComplete(2);
        console.log(chalk_1.default.green('   ✅ Phase 2 completed\n'));
    }
    /**
     * Phase 3: Report Generation & Finalization
     * - Site summary using real scraped content
     * - Session reports and statistics
     */
    async executePhase3(config, strategy) {
        const phase3Plan = strategy.phases.find(p => p.phase === 3);
        if (!phase3Plan)
            return;
        console.log(chalk_1.default.blue('\n📊 Phase 3: Report Generation & Finalization'));
        // Execute session-level tests (like site summary)
        if (phase3Plan.sessionTests.length > 0) {
            console.log(chalk_1.default.gray(`   📋 Generating ${phase3Plan.sessionTests.length} reports...`));
            const reportTasks = phase3Plan.sessionTests.map(testId => ({
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
            await this.parallelExecutor.executeTasks(reportTasks, {
                description: 'reports',
                maxConcurrency: 2
            });
        }
        this.dataManager.markPhaseComplete(3);
        console.log(chalk_1.default.green('   ✅ Phase 3 completed\n'));
    }
    /**
     * Utility methods
     */
    getTestName(testId) {
        const testNames = {
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
    aggregateResults() {
        // This would collect all test results from the data manager
        // For now, return empty array as results are stored in the data manager
        return [];
    }
    async generateFinalSessionSummary(sessionSummary) {
        // Generate page results from stored data
        const pageResults = [];
        const urls = this.dataManager.getUrls();
        for (const url of urls) {
            const metrics = this.dataManager.getPageMetrics(url);
            const content = this.dataManager.getScrapedContent(url);
            const pageResult = {
                url,
                pageName: this.sessionManager.getPageName(url),
                tests: [], // Tests are tracked separately in the new system
                summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}`
            };
            pageResults.push(pageResult);
        }
        await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
    }
    displayCompletionSummary(summary) {
        const duration = summary.endTime
            ? Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
            : 0;
        console.log(chalk_1.default.green('\n🎉 Testing session completed!'));
        console.log(chalk_1.default.cyan('═'.repeat(50)));
        console.log(chalk_1.default.white(`📊 Session ID: ${summary.sessionId}`));
        console.log(chalk_1.default.white(`🌐 URL: ${summary.url}`));
        console.log(chalk_1.default.white(`📄 Pages tested: ${summary.totalPages}`));
        console.log(chalk_1.default.white(`🧪 Total tests: ${summary.testsRun}`));
        console.log(chalk_1.default.green(`✅ Successful: ${summary.testsSucceeded}`));
        if (summary.testsFailed > 0) {
            console.log(chalk_1.default.red(`❌ Failed: ${summary.testsFailed}`));
        }
        console.log(chalk_1.default.white(`⏱️  Duration: ${duration}s`));
        console.log(chalk_1.default.cyan('═'.repeat(50)));
        console.log(chalk_1.default.blue(`📁 Results saved to: playwright-site-scanner-sessions/${summary.sessionId}/`));
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
exports.TestOrchestrator = TestOrchestrator;
//# sourceMappingURL=test-orchestrator.js.map