import { Page } from 'playwright';
import { TestResult, ViewportConfig } from '../types/index.js';
export declare class ScreenshotTester {
    private sessionManager;
    constructor();
    captureScreenshot(page: Page, pageUrl: string, viewport: ViewportConfig, sessionId: string): Promise<TestResult>;
    captureElementScreenshot(page: Page, selector: string, pageUrl: string, viewport: ViewportConfig, sessionId: string, elementName: string): Promise<TestResult>;
    captureComparisonScreenshots(page: Page, pageUrl: string, viewports: ViewportConfig[], sessionId: string): Promise<TestResult[]>;
}
//# sourceMappingURL=screenshot-tester.d.ts.map