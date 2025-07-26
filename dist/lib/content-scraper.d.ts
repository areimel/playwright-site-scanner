import { Page } from 'playwright';
import { TestResult } from '../types/index.js';
import { SessionDataManager } from '../utils/session-data-store.js';
export declare class ContentScraper {
    private sessionManager;
    constructor();
    scrapePageContent(page: Page, pageUrl: string, sessionId: string): Promise<TestResult>;
    /**
     * Scrape page content and save directly to SessionDataStore
     * This method integrates with the parallel execution system
     */
    scrapePageContentToStore(page: Page, pageUrl: string, dataManager: SessionDataManager): Promise<TestResult>;
    private extractPageContent;
    private createImagesDirectory;
    private processImages;
    private generateMarkdown;
    private saveMarkdownContent;
    getContentStats(markdownPath: string): Promise<{
        wordCount: number;
        imageCount: number;
        linkCount: number;
        headingCount: number;
    }>;
}
//# sourceMappingURL=content-scraper.d.ts.map