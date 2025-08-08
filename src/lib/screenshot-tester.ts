import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult, ViewportConfig } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { StandardTestOutputHandler } from '../utils/test-output-handler.js';
import { OutputContext } from '../types/test-output-types.js';

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
    const pageName = StandardTestOutputHandler.getPageNameFromUrl(pageUrl);
    
    // Create initial test result using standardized system
    const testResult = this.sessionManager.createStandardTestResult('screenshots', 'pending');

    try {
      console.log(chalk.gray(`    📸 Capturing ${viewport.name} screenshot (${viewport.width}x${viewport.height})`));
      
      // Set viewport
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });

      // Wait for any lazy-loaded content
      await page.waitForTimeout(1000);

      // Prepare output context for the screenshot
      const context: OutputContext = {
        url: pageUrl,
        pageName,
        viewport: viewport.name
      };
      
      // Generate output path using the standardized system
      const outputPath = this.sessionManager.generateOutputPath(sessionId, 'screenshots', context);
      
      // Ensure directory exists
      await this.sessionManager.getOutputHandler().ensureOutputDirectory(outputPath);
      
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
    const pageName = StandardTestOutputHandler.getPageNameFromUrl(pageUrl);
    
    // Create initial test result using standardized system
    const testResult = this.sessionManager.createStandardTestResult('screenshots', 'pending');

    try {
      console.log(chalk.gray(`    📸 Capturing ${elementName} element screenshot`));
      
      await page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });

      const element = await page.locator(selector);
      await element.waitFor({ state: 'visible' });

      // Prepare output context for the element screenshot
      const context: OutputContext = {
        url: pageUrl,
        pageName,
        viewport: `${viewport.name}-${elementName}`,
        additionalData: {
          element: elementName,
          selector
        }
      };
      
      // Generate output path using the standardized system
      const outputPath = this.sessionManager.generateOutputPath(sessionId, 'screenshots', context);
      
      // Ensure directory exists
      await this.sessionManager.getOutputHandler().ensureOutputDirectory(outputPath);
      
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