import chalk from 'chalk';
import { SessionSummary } from '@shared/index.js';

export interface CapturedError {
  error: unknown;
  context?: string;
  timestamp: Date;
  formatted: string;
}

export class ErrorHandler {
  private capturedErrors: CapturedError[] = [];

  /**
   * Captures an error with optional context information
   * Maintains exact same error handling patterns as the original orchestrator
   */
  captureError(error: unknown, context?: string): CapturedError {
    const timestamp = new Date();
    const formatted = this.formatError(error);
    
    const capturedError: CapturedError = {
      error,
      context,
      timestamp,
      formatted
    };
    
    this.capturedErrors.push(capturedError);
    return capturedError;
  }

  /**
   * Adds error to session summary using the same pattern as the original orchestrator
   * Preserves exact error message format: error instanceof Error ? error.message : String(error)
   */
  addError(sessionSummary: SessionSummary, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sessionSummary.errors.push(errorMessage);
  }

  /**
   * Enhanced screenshot error logging with viewport-specific diagnostics
   */
  logScreenshotError(viewportName: string, error: unknown, pageUrl?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`    ❌ Screenshot failed for ${viewportName} viewport: ${errorMessage}`));
    
    if (pageUrl) {
      console.error(chalk.gray(`       URL: ${pageUrl}`));
    }
    
    // Log specific error types
    if (errorMessage.includes('timeout')) {
      console.error(chalk.yellow(`       💡 Suggestion: Page may be slow to load or has infinite scroll content`));
    } else if (errorMessage.includes('viewport')) {
      console.error(chalk.yellow(`       💡 Suggestion: Viewport setting may have failed due to page constraints`));
    } else if (errorMessage.includes('directory') || errorMessage.includes('ENOENT')) {
      console.error(chalk.yellow(`       💡 Suggestion: File system race condition - will retry`));
    }
  }

  /**
   * Logs error with chalk formatting using the same patterns as the original orchestrator
   * Matches the exact formatting from various catch blocks
   */
  logError(error: unknown, context?: string): void {
    if (context) {
      // Pattern from processPageCompletely catch blocks
      if (context.includes('failed:')) {
        console.error(chalk.red(context), error);
      } else if (context.includes('❌')) {
        // Pattern from page processing errors
        console.error(chalk.red(context));
      } else {
        // General pattern with context
        console.error(chalk.red(`❌ ${context}:`), error);
      }
    } else {
      // Pattern from main runTests catch block
      console.error(chalk.red('\n❌ Test session failed:'), error);
    }
  }

  /**
   * Logs test-specific errors with the exact format from the original orchestrator
   * Matches patterns from processPageCompletely method
   */
  logTestError(testType: string, error: unknown): void {
    console.error(chalk.red(`      ❌ ${testType} failed: ${error}`));
  }

  /**
   * Logs page loading errors with the exact format from the original orchestrator
   */
  logPageLoadError(url: string, error: unknown): void {
    console.error(chalk.red(`    ❌ Page loading failed for ${url}: ${error}`));
  }


  /**
   * Logs page processing task errors with the exact format from the original orchestrator
   */
  logPageProcessingError(taskId: string, error: string): void {
    console.error(chalk.red(`   ❌ Failed to process page: ${error}`));
  }

  /**
   * Logs HTML report generation errors
   */
  logHTMLReportError(error: unknown): void {
    console.error(chalk.red('\n❌ HTML report generation failed:'), error);
  }

  /**
   * Formats collected errors for display
   */
  formatErrorSummary(): string {
    if (this.capturedErrors.length === 0) {
      return 'No errors captured during session.';
    }

    let summary = `${this.capturedErrors.length} error(s) captured:\n\n`;
    
    this.capturedErrors.forEach((capturedError, index) => {
      summary += `${index + 1}. `;
      if (capturedError.context) {
        summary += `[${capturedError.context}] `;
      }
      summary += `${capturedError.formatted}\n`;
      summary += `   Time: ${capturedError.timestamp.toISOString()}\n\n`;
    });

    return summary.trim();
  }

  /**
   * Checks if any errors have been captured
   */
  hasErrors(): boolean {
    return this.capturedErrors.length > 0;
  }

  /**
   * Returns all captured errors
   */
  getErrors(): CapturedError[] {
    return [...this.capturedErrors];
  }

  /**
   * Returns error count
   */
  getErrorCount(): number {
    return this.capturedErrors.length;
  }

  /**
   * Returns errors filtered by context
   */
  getErrorsByContext(context: string): CapturedError[] {
    return this.capturedErrors.filter(e => e.context === context);
  }

  /**
   * Resets the error collection
   */
  clearErrors(): void {
    this.capturedErrors = [];
  }

  /**
   * Creates a TestResult for failed tests with consistent error handling
   * Matches the exact pattern from the original orchestrator's error handling
   */
  createFailedTestResult(testType: string, error: unknown): {
    testType: string;
    status: 'failed';
    startTime: Date;
    endTime: Date;
    error: string;
  } {
    return {
      testType,
      status: 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      error: error instanceof Error ? error.message : String(error)
    };
  }

  /**
   * Creates a viewport-specific failed test result with enhanced diagnostics
   */
  createFailedScreenshotTestResult(viewportName: string, error: unknown, pageUrl?: string): {
    testType: string;
    status: 'failed';
    startTime: Date;
    endTime: Date;
    error: string;
  } {
    const baseError = error instanceof Error ? error.message : String(error);
    const enhancedError = pageUrl 
      ? `${viewportName} viewport failed on ${pageUrl}: ${baseError}`
      : `${viewportName} viewport: ${baseError}`;

    return {
      testType: `screenshots-${viewportName}`,
      status: 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      error: enhancedError
    };
  }

  /**
   * Creates failed test results for multiple test types (used in page load failures)
   * Matches the exact pattern from processPageCompletely method
   */
  createFailedTestResultsForPage(enabledTests: string[], pageLoadError: unknown): Array<{
    testType: string;
    status: 'failed';
    startTime: Date;
    endTime: Date;
    error: string;
  }> {
    const errorMessage = `Page load failed: ${pageLoadError instanceof Error ? pageLoadError.message : String(pageLoadError)}`;
    
    return enabledTests.map(testType => ({
      testType,
      status: 'failed' as const,
      startTime: new Date(),
      endTime: new Date(),
      error: errorMessage
    }));
  }

  /**
   * Formats an error for consistent display
   * Uses the same logic as the original orchestrator
   */
  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}