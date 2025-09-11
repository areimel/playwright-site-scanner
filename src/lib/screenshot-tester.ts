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
    
    // Create initial test result with viewport-specific test type
    const testResult = this.sessionManager.createTestResult(`screenshots-${viewport.name}`);

    try {
      console.log(chalk.gray(`    📸 Capturing ${viewport.name} screenshot (${viewport.width}x${viewport.height})`));
      
      // Set viewport with timeout
      const viewportPromise = page.setViewportSize({ 
        width: viewport.width, 
        height: viewport.height 
      });
      
      // Add timeout to viewport setting
      await Promise.race([
        viewportPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout setting viewport for ${viewport.name}`)), 10000)
        )
      ]);

      // Wait for any lazy-loaded content with timeout
      await Promise.race([
        page.waitForTimeout(2000), // Increased wait time for better screenshot quality
        page.waitForLoadState('networkidle', { timeout: 5000 })
      ]).catch(() => {
        // Continue if load state timeout - not critical
        console.log(chalk.yellow(`    ⚠️  Network idle timeout for ${viewport.name} - continuing with screenshot`));
      });

      // Generate output path using simple canonical method
      const filename = `${pageName}-${viewport.name}.png`;
      const outputPath = this.sessionManager.buildFilePath(sessionId, pageName, 'screenshots', filename);
      
      // Ensure directory exists with retry logic
      await this.ensureDirectoryWithRetry(outputPath);
      
      // Capture screenshot with timeout
      const screenshotPromise = page.screenshot({
        path: outputPath,
        fullPage: true,
        animations: 'disabled',
        timeout: 20000 // 20 second timeout for screenshot
      });

      await Promise.race([
        screenshotPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Screenshot timeout for ${viewport.name} viewport after 20s`)), 20000)
        )
      ]);

      // Update test result with success
      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`        📄 Screenshot saved: ${outputPath}`));

    } catch (error) {
      testResult.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      testResult.error = `${viewport.name} viewport: ${errorMessage}`;
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Failed to capture ${viewport.name} screenshot: ${errorMessage}`));
    }

    return testResult;
  }

  /**
   * Ensure directory exists with retry logic to prevent race conditions
   */
  private async ensureDirectoryWithRetry(filePath: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.sessionManager.ensureDirectoryExists(filePath);
        return; // Success
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to create directory after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Wait before retry to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
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