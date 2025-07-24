import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult, ViewportConfig } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';

export class ScreenshotTester {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async captureScreenshot(
    page: Page, 
    pageUrl: string, 
    viewport: ViewportConfig, 
    sessionId: string
  ): Promise<TestResult> {
    const startTime = new Date();
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    const testResult: TestResult = {
      testType: `screenshot-${viewport.name}`,
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    📸 Capturing ${viewport.name} screenshot (${viewport.width}x${viewport.height})`));
      
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
      
      console.log(chalk.green(`    ✅ ${viewport.name} screenshot saved`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Failed to capture ${viewport.name} screenshot: ${testResult.error}`));
    }

    return testResult;
  }

  async captureElementScreenshot(
    page: Page,
    selector: string,
    pageUrl: string,
    viewport: ViewportConfig,
    sessionId: string,
    elementName: string
  ): Promise<TestResult> {
    const startTime = new Date();
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    const testResult: TestResult = {
      testType: `screenshot-${viewport.name}-${elementName}`,
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    📸 Capturing ${elementName} element screenshot`));
      
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });

      const element = await page.locator(selector);
      await element.waitFor({ state: 'visible' });

      await this.sessionManager.createPageDirectory(sessionId, pageName);
      
      const screenshotPath = this.sessionManager.getScreenshotPath(
        sessionId, 
        pageName, 
        `${viewport.name}-${elementName}`
      );
      
      await element.screenshot({
        path: screenshotPath,
        animations: 'disabled'
      });

      testResult.status = 'success';
      testResult.outputPath = screenshotPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ ${elementName} element screenshot saved`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Failed to capture ${elementName} element: ${testResult.error}`));
    }

    return testResult;
  }

  async captureComparisonScreenshots(
    page: Page,
    pageUrl: string,
    viewports: ViewportConfig[],
    sessionId: string
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    for (const viewport of viewports) {
      const result = await this.captureScreenshot(page, pageUrl, viewport, sessionId);
      results.push(result);
    }

    return results;
  }
}