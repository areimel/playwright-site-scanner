"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestOrchestrator = void 0;
const playwright_1 = require("playwright");
const chalk_1 = __importDefault(require("chalk"));
const session_manager_js_1 = require("../utils/session-manager.js");
const progress_tracker_js_1 = require("../utils/progress-tracker.js");
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
            console.log(chalk_1.default.blue('🚀 Initializing browser...'));
            await this.initializeBrowser();
            console.log(chalk_1.default.blue('🔍 Discovering pages...'));
            const pagesToTest = await this.discoverPages(config);
            sessionSummary.totalPages = pagesToTest.length;
            console.log(chalk_1.default.green(`✅ Found ${pagesToTest.length} page(s) to test\n`));
            await this.sessionManager.createSessionDirectory(sessionSummary.sessionId);
            this.progressTracker.initialize({
                currentTest: '',
                completedTests: 0,
                totalTests: this.calculateTotalTests(config, pagesToTest.length),
                currentPage: '',
                completedPages: 0,
                totalPages: pagesToTest.length
            });
            const pageResults = [];
            for (let i = 0; i < pagesToTest.length; i++) {
                const pageUrl = pagesToTest[i];
                console.log(chalk_1.default.blue(`\n📄 Testing page ${i + 1}/${pagesToTest.length}: ${pageUrl}`));
                this.progressTracker.updateCurrentPage(pageUrl, i);
                const pageResult = await this.testPage(pageUrl, config, sessionSummary.sessionId);
                pageResults.push(pageResult);
                sessionSummary.testsRun += pageResult.tests.length;
                sessionSummary.testsSucceeded += pageResult.tests.filter(t => t.status === 'success').length;
                sessionSummary.testsFailed += pageResult.tests.filter(t => t.status === 'failed').length;
                this.progressTracker.updateCompletedPages(i + 1);
            }
            sessionSummary.endTime = new Date();
            console.log(chalk_1.default.blue('\n📊 Generating session summary...'));
            await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
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
    async discoverPages(config) {
        if (config.crawlSite) {
            return await this.siteCrawler.crawlSite(config.url);
        }
        else {
            return [config.url];
        }
    }
    calculateTotalTests(config, pageCount) {
        return config.selectedTests.length * pageCount * config.viewports.length;
    }
    async testPage(pageUrl, config, sessionId) {
        const page = await this.browser.newPage();
        const pageResult = {
            url: pageUrl,
            pageName: this.sessionManager.getPageName(pageUrl),
            tests: [],
            summary: ''
        };
        try {
            console.log(chalk_1.default.gray(`  Navigating to ${pageUrl}...`));
            await page.goto(pageUrl, { waitUntil: 'networkidle' });
            for (const test of config.selectedTests) {
                if (!test.enabled)
                    continue;
                this.progressTracker.updateCurrentTest(`${test.name} on ${pageResult.pageName}`);
                const testResults = await this.executeTest(test.id, page, pageUrl, config, sessionId);
                pageResult.tests.push(...testResults);
                this.progressTracker.incrementCompletedTests(testResults.length);
            }
            pageResult.summary = this.generatePageSummary(pageResult);
            await this.sessionManager.savePageSummary(sessionId, pageResult);
        }
        catch (error) {
            console.error(chalk_1.default.red(`  ❌ Error testing page ${pageUrl}:`), error);
            pageResult.tests.push({
                testType: 'page-load',
                status: 'failed',
                startTime: new Date(),
                endTime: new Date(),
                error: error instanceof Error ? error.message : String(error)
            });
        }
        finally {
            await page.close();
        }
        return pageResult;
    }
    async executeTest(testType, page, pageUrl, config, sessionId) {
        const results = [];
        switch (testType) {
            case 'screenshots':
                for (const viewport of config.viewports) {
                    const result = await this.screenshotTester.captureScreenshot(page, pageUrl, viewport, sessionId);
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
            case 'sitemap':
                // Sitemap is generated once per session, not per page
                const sitemapResult = await this.sitemapTester.generateSitemap(config.url, sessionId, config.crawlSite);
                results.push(sitemapResult);
                break;
            case 'content-scraping':
                const contentResult = await this.contentScraper.scrapePageContent(page, pageUrl, sessionId);
                results.push(contentResult);
                break;
            case 'site-summary':
                // Site summary is generated once per session, not per page
                const summaryResult = await this.siteSummaryTester.generateSiteSummary(config.url, sessionId, config.crawlSite);
                results.push(summaryResult);
                break;
            default:
                console.warn(chalk_1.default.yellow(`⚠️  Unknown test type: ${testType}`));
        }
        return results;
    }
    generatePageSummary(pageResult) {
        const successCount = pageResult.tests.filter(t => t.status === 'success').length;
        const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
        const totalTests = pageResult.tests.length;
        return `Page: ${pageResult.url}\nTests completed: ${totalTests}\nSuccessful: ${successCount}\nFailed: ${failCount}`;
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