import { Page } from 'playwright';
import { TestResult } from '../types/index.js';
export declare class SEOTester {
    private sessionManager;
    constructor();
    runSEOScan(page: Page, pageUrl: string, sessionId: string): Promise<TestResult>;
    private extractSEOData;
    private generateSEOReport;
}
//# sourceMappingURL=seo-tester.d.ts.map