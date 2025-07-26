import { ScrapedContent, SitemapEntry, PageSummary } from '../types/index.js';
export interface PageMetrics {
    url: string;
    wordCount: number;
    imageCount: number;
    linkCount: number;
    title: string;
    description: string;
    loadTime?: number;
    errors: string[];
}
export interface SessionDataStore {
    urls: string[];
    baseUrl: string;
    sessionId: string;
    scrapedContent: Map<string, ScrapedContent>;
    pageMetrics: Map<string, PageMetrics>;
    sitemapEntries: SitemapEntry[];
    phase1Complete: boolean;
    phase2Complete: boolean;
    phase3Complete: boolean;
    errors: Map<string, string[]>;
}
export declare class SessionDataManager {
    private data;
    constructor(baseUrl: string, sessionId: string);
    setUrls(urls: string[]): void;
    getUrls(): string[];
    setScrapedContent(url: string, content: ScrapedContent): void;
    getScrapedContent(url: string): ScrapedContent | undefined;
    getAllScrapedContent(): Map<string, ScrapedContent>;
    updatePageMetrics(url: string, metrics: Partial<PageMetrics>): void;
    getPageMetrics(url: string): PageMetrics | undefined;
    getAllPageMetrics(): Map<string, PageMetrics>;
    setSitemapEntries(entries: SitemapEntry[]): void;
    getSitemapEntries(): SitemapEntry[];
    markPhaseComplete(phase: 1 | 2 | 3): void;
    isPhaseComplete(phase: 1 | 2 | 3): boolean;
    addError(context: string, error: string): void;
    getErrors(context?: string): string[] | Map<string, string[]>;
    getTotalWordCount(): number;
    getTotalImageCount(): number;
    getTotalLinkCount(): number;
    getAverageWordsPerPage(): number;
    analyzeContentTypes(): {
        [key: string]: number;
    };
    generatePageSummaries(): PageSummary[];
    private calculateWordCount;
    private determineContentType;
    private calculateUrlDepth;
    private extractTitleFromUrl;
    get sessionId(): string;
    get baseUrl(): string;
    getSessionStats(): {
        totalUrls: number;
        scrapedPages: number;
        pagesWithMetrics: number;
        totalErrors: number;
        phase1Complete: boolean;
        phase2Complete: boolean;
        phase3Complete: boolean;
    };
}
//# sourceMappingURL=session-data-store.d.ts.map