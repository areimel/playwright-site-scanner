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
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    // Create initial test result using simple system
    const testResult = this.sessionManager.createTestResult('screenshots');

    try {
      console.log(chalk.gray(`    📸 Capturing ${viewport.name} screenshot (${viewport.width}x${viewport.height})`));
      
      // Set viewport
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });

      // Wait for any lazy-loaded content
      await page.waitForTimeout(1000);

      // Generate output path using simple canonical method
      const filename = `${pageName}-${viewport.name}.png`;
      const outputPath = this.sessionManager.buildFilePath(sessionId, pageName, 'screenshots', filename);
      
      // Ensure directory exists
      await this.sessionManager.ensureDirectoryExists(outputPath);
      
      // Capture screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: true,
        animations: 'disabled'
      });

      // Update test result with success
      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`        📄 Screenshot saved: ${outputPath}`));

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
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    // Create initial test result using simple system
    const testResult = this.sessionManager.createTestResult('screenshots');

    try {
      console.log(chalk.gray(`    📸 Capturing ${elementName} element screenshot`));
      
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });

      const element = await page.locator(selector);
      await element.waitFor({ state: 'visible' });

      // Generate output path using simple canonical method
      const filename = `${pageName}-${viewport.name}-${elementName}.png`;
      const outputPath = this.sessionManager.buildFilePath(sessionId, pageName, 'screenshots', filename);
      
      // Ensure directory exists
      await this.sessionManager.ensureDirectoryExists(outputPath);
      
      await element.screenshot({
        path: outputPath,
        animations: 'disabled'
      });

      // Update test result with success
      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`        📄 Element screenshot saved: ${outputPath}`));

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