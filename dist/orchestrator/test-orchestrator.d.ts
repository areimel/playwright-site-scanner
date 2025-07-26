import { TestConfig } from '../types/index.js';
export declare class TestOrchestrator {
    private browser;
    private sessionManager;
    private progressTracker;
    private dataManager;
    private parallelExecutor;
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
    /**
     * Phase 1: Data Discovery & Collection
     * - Site crawling (single execution)
     * - Content scraping for all pages
     * - Sitemap generation
     */
    private executePhase1;
    /**
     * Phase 2: Page Analysis & Testing
     * - Screenshots across all viewports
     * - SEO scans
     * - Accessibility testing
     */
    private executePhase2;
    /**
     * Phase 3: Report Generation & Finalization
     * - Site summary using real scraped content
     * - Session reports and statistics
     */
    private executePhase3;
    /**
     * Utility methods
     */
    private getTestName;
    private aggregateResults;
    private generateFinalSessionSummary;
    private displayCompletionSummary;
    private cleanup;
}
//# sourceMappingURL=test-orchestrator.d.ts.map