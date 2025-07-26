import { TestResult } from '../types/index.js';
import { SessionDataManager } from '../utils/session-data-store.js';
export declare class SiteSummaryTester {
    private sessionManager;
    private siteCrawler;
    constructor();
    generateSiteSummary(baseUrl: string, sessionId: string, crawlSite?: boolean): Promise<TestResult>;
    /**
     * Generate site summary using real scraped content from SessionDataStore
     * This replaces the old method that used placeholder data
     */
    generateSiteSummaryFromStore(dataManager: SessionDataManager): Promise<TestResult>;
    private analyzePages;
    private extractTitleFromUrl;
    private determineContentType;
    private calculateUrlDepth;
    private generateSiteSummaryData;
    private extractMainSections;
    private findOrphanPages;
    private generateSummaryMarkdown;
    private saveSummaryReport;
    getSummaryStats(summaryPath: string): Promise<{
        pageCount: number;
        sectionCount: number;
        totalWords: number;
        reportSize: number;
    }>;
}
//# sourceMappingURL=site-summary-tester.d.ts.map