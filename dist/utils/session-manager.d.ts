import { SessionSummary, PageResult } from '../types/index.js';
export declare class SessionManager {
    private readonly outputDir;
    createSessionId(): string;
    createSessionDirectory(sessionId: string): Promise<void>;
    createPageDirectory(sessionId: string, pageName: string): Promise<string>;
    getPageName(url: string): string;
    getPagePath(sessionId: string, pageName: string): string;
    getScreenshotPath(sessionId: string, pageName: string, viewportName: string): string;
    getScanPath(sessionId: string, pageName: string, scanType: string): string;
    savePageSummary(sessionId: string, pageResult: PageResult): Promise<void>;
    generateSessionSummary(summary: SessionSummary, pageResults: PageResult[]): Promise<void>;
    private generatePageSummaryMarkdown;
    private generateSessionSummaryMarkdown;
}
//# sourceMappingURL=session-manager.d.ts.map