import { TestResult } from '../types/index.js';
export declare class SiteSummaryTester {
    private sessionManager;
    private siteCrawler;
    constructor();
    generateSiteSummary(baseUrl: string, sessionId: string, crawlSite?: boolean): Promise<TestResult>;
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