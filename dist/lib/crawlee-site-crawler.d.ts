export declare class CrawleeSiteCrawler {
    private discoveredUrls;
    private maxPages;
    crawlSite(startUrl: string, maxPages?: number): Promise<string[]>;
    private collectResults;
    private clearDataset;
    private isPageUrl;
    crawlSection(startUrl: string, sectionPath: string, maxPages?: number): Promise<string[]>;
    getSamplePages(startUrl: string, sampleSize?: number): Promise<string[]>;
}
//# sourceMappingURL=crawlee-site-crawler.d.ts.map