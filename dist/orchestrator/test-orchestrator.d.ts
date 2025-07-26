import { TestConfig } from '../types/index.js';
export declare class TestOrchestrator {
    private browser;
    private sessionManager;
    private progressTracker;
    private siteCrawler;
    private screenshotTester;
    private seoTester;
    private accessibilityTester;
    private sitemapTester;
    private contentScraper;
    private siteSummaryTester;
    constructor();
    runTests(config: TestConfig): Promise<void>;
    private initializeBrowser;
    private discoverPages;
    private calculateTotalTests;
    private testPage;
    private executeTest;
    private generatePageSummary;
    private displayCompletionSummary;
    private cleanup;
}
//# sourceMappingURL=test-orchestrator.d.ts.map