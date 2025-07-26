import { TestResult } from '../types/index.js';
export declare class SitemapTester {
    private sessionManager;
    private siteCrawler;
    constructor();
    generateSitemap(baseUrl: string, sessionId: string, crawlSite?: boolean): Promise<TestResult>;
    /**
     * Generate sitemap using pre-crawled URLs (optimized version)
     * This eliminates redundant site crawling
     */
    generateSitemapFromUrls(urls: string[], baseUrl: string, sessionId: string): Promise<TestResult>;
    private generateSitemapEntries;
    private calculatePriority;
    private determineChangeFrequency;
    private generateSitemapXml;
    private escapeXml;
    private saveSitemap;
    validateSitemap(sitemapPath: string): Promise<boolean>;
    getSitemapStats(sitemapPath: string): Promise<{
        urlCount: number;
        fileSize: number;
    }>;
}
//# sourceMappingURL=sitemap-tester.d.ts.map