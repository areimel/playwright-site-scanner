import { chromium, Browser, Page } from 'playwright';
import chalk from 'chalk';
import { getExecutionConfig } from '@utils/config-loader.js';

/**
 * Manages browser lifecycle for the test orchestrator
 * Handles browser initialization, page creation, and cleanup operations
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private isInitialized = false;

  /**
   * Initialize the Chromium browser with the required configuration
   * Uses configuration from project-config.yaml
   */
  async initializeBrowser(): Promise<void> {
    try {
      const executionConfig = await getExecutionConfig();
      const browserArgs = ['--no-sandbox'];
      
      if (executionConfig.browser.disableSandbox) {
        browserArgs.push('--disable-setuid-sandbox');
      }
      
      this.browser = await chromium.launch({
        headless: executionConfig.browser.headless,
        args: browserArgs
      });
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new page instance from the managed browser
   * Throws an error if browser is not initialized
   */
  async createPage(): Promise<Page> {
    if (!this.browser || !this.isInitialized) {
      throw new Error('Browser not initialized. Call initializeBrowser() first.');
    }

    try {
      return await this.browser.newPage();
    } catch (error) {
      throw new Error(`Failed to create new page: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the browser instance
   * Returns null if browser is not initialized
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Check if the browser is initialized and ready for use
   */
  isReady(): boolean {
    return this.isInitialized && this.browser !== null;
  }

  /**
   * Get current browser state information for debugging
   */
  getBrowserState(): {
    initialized: boolean;
    browserExists: boolean;
    isConnected: boolean;
  } {
    return {
      initialized: this.isInitialized,
      browserExists: this.browser !== null,
      isConnected: this.browser?.isConnected() || false
    };
  }

  /**
   * Cleanup browser resources
   * Closes the browser instance and resets the state
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error(chalk.red('Warning: Error during browser cleanup:'), error);
      } finally {
        this.browser = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * Restart the browser if it becomes disconnected or crashes
   * Useful for recovery scenarios in long-running sessions
   */
  async restartBrowser(): Promise<void> {
    console.log(chalk.yellow('🔄 Restarting browser...'));
    
    // Cleanup existing browser
    await this.cleanup();
    
    // Initialize fresh browser
    await this.initializeBrowser();
    
    console.log(chalk.green('✅ Browser restarted successfully'));
  }

  /**
   * Health check for the browser instance
   * Verifies the browser is connected and responsive
   */
  async healthCheck(): Promise<boolean> {
    if (!this.browser || !this.isInitialized) {
      return false;
    }

    try {
      // Test if browser is responsive by checking connection status
      const isConnected = this.browser.isConnected();
      
      // Optionally create and close a test page to verify functionality
      if (isConnected) {
        const testPage = await this.browser.newPage();
        await testPage.close();
      }
      
      return isConnected;
    } catch (error) {
      console.error(chalk.red('Browser health check failed:'), error);
      return false;
    }
  }
}