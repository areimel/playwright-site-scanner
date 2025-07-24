export declare class SiteCrawler {
    private browser;
    private visited;
    private toVisit;
    private baseUrl;
    private maxPages;
    crawlSite(startUrl: string, maxPages?: number): Promise<string[]>;
    private crawlPage;
    private isPageUrl;
    crawlSection(startUrl: string, sectionPath: string, maxPages?: number): Promise<string[]>;
    getSamplePages(startUrl: string, sampleSize?: number): Promise<string[]>;
}
//# sourceMappingURL=site-crawler.d.ts.map