import { Page } from 'playwright';
import { TestResult } from '../types/index.js';
export declare class AccessibilityTester {
    private sessionManager;
    constructor();
    runAccessibilityScan(page: Page, pageUrl: string, sessionId: string): Promise<TestResult>;
    private injectAxeCore;
    private runAxeScan;
    private generateAccessibilityReport;
    private groupBySeverity;
    private calculateWCAGCompliance;
}
//# sourceMappingURL=accessibility-tester.d.ts.map