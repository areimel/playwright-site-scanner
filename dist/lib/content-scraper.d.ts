import { Page } from 'playwright';
import { TestResult } from '../types/index.js';
export declare class ContentScraper {
    private sessionManager;
    constructor();
    scrapePageContent(page: Page, pageUrl: string, sessionId: string): Promise<TestResult>;
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