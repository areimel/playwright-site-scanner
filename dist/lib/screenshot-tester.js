"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotTester = void 0;
const chalk_1 = __importDefault(require("chalk"));
const session_manager_js_1 = require("../utils/session-manager.js");
class ScreenshotTester {
    sessionManager;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
    }
    async captureScreenshot(page, pageUrl, viewport, sessionId) {
        const startTime = new Date();
        const pageName = this.sessionManager.getPageName(pageUrl);
        const testResult = {
            testType: `screenshot-${viewport.name}`,
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    📸 Capturing ${viewport.name} screenshot (${viewport.width}x${viewport.height})`));
            // Set viewport
            await page.setViewportSize({
                width: viewport.width,
                height: viewport.height
            });
            // Wait for any lazy-loaded content
            await page.waitForTimeout(1000);
            // Ensure page directory exists
            await this.sessionManager.createPageDirectory(sessionId, pageName);
            // Generate screenshot path
            const screenshotPath = this.sessionManager.getScreenshotPath(sessionId, pageName, viewport.name);
            // Capture screenshot
            await page.screenshot({
                path: screenshotPath,
                fullPage: true,
                animations: 'disabled'
            });
            testResult.status = 'success';
            testResult.outputPath = screenshotPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`    ✅ ${viewport.name} screenshot saved`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ Failed to capture ${viewport.name} screenshot: ${testResult.error}`));
        }
        return testResult;
    }
    async captureElementScreenshot(page, selector, pageUrl, viewport, sessionId, elementName) {
        const startTime = new Date();
        const pageName = this.sessionManager.getPageName(pageUrl);
        const testResult = {
            testType: `screenshot-${viewport.name}-${elementName}`,
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    📸 Capturing ${elementName} element screenshot`));
            await page.setViewportSize({
                width: viewport.width,
                height: viewport.height
            });
            const element = await page.locator(selector);
            await element.waitFor({ state: 'visible' });
            await this.sessionManager.createPageDirectory(sessionId, pageName);
            const screenshotPath = this.sessionManager.getScreenshotPath(sessionId, pageName, `${viewport.name}-${elementName}`);
            await element.screenshot({
                path: screenshotPath,
                animations: 'disabled'
            });
            testResult.status = 'success';
            testResult.outputPath = screenshotPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`    ✅ ${elementName} element screenshot saved`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ Failed to capture ${elementName} element: ${testResult.error}`));
        }
        return testResult;
    }
    async captureComparisonScreenshots(page, pageUrl, viewports, sessionId) {
        const results = [];
        for (const viewport of viewports) {
            const result = await this.captureScreenshot(page, pageUrl, viewport, sessionId);
            results.push(result);
        }
        return results;
    }
}
exports.ScreenshotTester = ScreenshotTester;
//# sourceMappingURL=screenshot-tester.js.map