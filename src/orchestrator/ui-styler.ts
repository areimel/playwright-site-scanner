import chalk from 'chalk';
import { TestResult, SessionSummary } from '../types/index.js';
import { LoadingScreen } from '../utils/loading-screen/index.js';

/**
 * UIStyler class provides consistent console formatting and UI display logic
 * for the test orchestrator. Maintains exact formatting patterns from the original
 * test orchestrator implementation.
 */
export class UIStyler {
  private loadingScreen: LoadingScreen | null = null;

  /**
   * Set the loading screen instance for coordinated output
   */
  setLoadingScreen(loadingScreen: LoadingScreen): void {
    this.loadingScreen = loadingScreen;
  }
  /**
   * Display files created summary with consistent formatting
   * @param sessionId - The session identifier
   * @param allTestResults - Array of all test results from the session
   */
  displayFilesCreated(sessionId: string, allTestResults: TestResult[]): void {
    console.log(chalk.blue('\n📁 Files Created:'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    // Show content scraping results
    const contentScrapingResults = allTestResults.filter(r => r.testType === 'content-scraping');
    if (contentScrapingResults.length > 0) {
      console.log(chalk.white(`📄 Content Scraping: ${contentScrapingResults.length} markdown files`));
      contentScrapingResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }
    
    // Show sitemap results
    const sitemapResults = allTestResults.filter(r => r.testType === 'sitemap');
    if (sitemapResults.length > 0) {
      console.log(chalk.white(`🗺️  Sitemap: ${sitemapResults.length} file(s)`));
      sitemapResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }
    
    // Show site summary results
    const summaryResults = allTestResults.filter(r => r.testType === 'site-summary');
    if (summaryResults.length > 0) {
      console.log(chalk.white(`📊 Site Summary: ${summaryResults.length} file(s)`));
      summaryResults.forEach(result => {
        if (result.outputPath && result.status === 'success') {
          console.log(chalk.gray(`   - ${result.outputPath}`));
        }
      });
    }

    // Show screenshot results
    const screenshotResults = allTestResults.filter(r => r.testType.includes('screenshots'));
    if (screenshotResults.length > 0) {
      console.log(chalk.white(`📸 Screenshots: ${screenshotResults.length} file(s)`));
    }

    // Show other test results
    const otherResults = allTestResults.filter(r => 
      !['content-scraping', 'sitemap', 'site-summary'].includes(r.testType) &&
      !r.testType.includes('screenshots')
    );
    if (otherResults.length > 0) {
      console.log(chalk.white(`🧪 Other Tests: ${otherResults.length} file(s)`));
    }
    
    console.log(chalk.cyan('═'.repeat(50)));
  }

  /**
   * Display session completion summary with consistent formatting
   * @param summary - The session summary data
   */
  displayCompletionSummary(summary: SessionSummary): void {
    const duration = summary.endTime 
      ? Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
      : 0;

    console.log(chalk.green('\n🎉 Testing session completed!'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.white(`📊 Session ID: ${summary.sessionId}`));
    console.log(chalk.white(`🌐 URL: ${summary.url}`));
    console.log(chalk.white(`📄 Pages tested: ${summary.totalPages}`));
    console.log(chalk.white(`🧪 Total tests: ${summary.testsRun}`));
    console.log(chalk.green(`✅ Successful: ${summary.testsSucceeded}`));
    if (summary.testsFailed > 0) {
      console.log(chalk.red(`❌ Failed: ${summary.testsFailed}`));
    }
    console.log(chalk.white(`⏱️  Duration: ${duration}s`));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.blue(`📁 Results saved to: arda-site-scan-sessions/${summary.sessionId}/`));
  }

  /**
   * Display phase start header with consistent formatting
   * @param phaseNumber - The phase number (1, 2, or 3)
   * @param phaseName - The name of the phase
   * @param description - Optional additional description
   */
  displayPhaseStart(phaseNumber: number, phaseName: string, description?: string): void {
    console.log(chalk.blue(`\n🔍 Phase ${phaseNumber}: ${phaseName}`));
    if (description) {
      console.log(chalk.gray(`   ${description}`));
    }
  }

  /**
   * Display phase completion message with consistent formatting
   * @param phaseNumber - The phase number that completed
   * @param additionalInfo - Optional additional information to display
   */
  displayPhaseComplete(phaseNumber: number, additionalInfo?: string): void {
    console.log(chalk.green(`   ✅ Phase ${phaseNumber} completed`));
    if (additionalInfo) {
      console.log(chalk.green(`   ${additionalInfo}`));
    }
    console.log(''); // Add blank line after phase completion
  }

  /**
   * Display initialization messages with consistent formatting
   * @param message - The initialization message to display
   */
  displayInitialization(message: string): void {
    console.log(chalk.blue(`🚀 ${message}`));
  }

  /**
   * Display progress messages with consistent formatting
   * @param message - The progress message to display
   * @param type - The type of progress message (info, success, warning)
   */
  displayProgress(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
    // Only show in verbose mode or when loading screen is not active
    if (this.loadingScreen && !this.loadingScreen.isVerboseMode()) {
      return;
    }

    switch (type) {
      case 'success':
        console.log(chalk.green(`✅ ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`⚠️  ${message}`));
        break;
      case 'info':
      default:
        console.log(chalk.gray(`   ${message}`));
        break;
    }
  }

  /**
   * Display execution strategy information with consistent formatting
   * @param phases - Number of phases in the execution strategy
   * @param estimatedDuration - Estimated duration in seconds
   */
  displayExecutionStrategy(phases: number, estimatedDuration: number): void {
    console.log(chalk.blue(`📋 Execution strategy: ${phases} phases`));
    console.log(chalk.gray(`   Estimated duration: ${estimatedDuration}s`));
  }

  /**
   * Display unified page processing information
   * @param totalPages - Total number of pages to process
   * @param testTypes - Number of test types per page
   */
  displayUnifiedProcessing(totalPages: number, testTypes: number): void {
    console.log(chalk.gray(`   🌐 Processing ${totalPages} pages with ${testTypes} test types each...`));
    console.log(chalk.gray(`   🎯 Unified approach: 1 page load per URL (instead of ${testTypes})`));
  }

  /**
   * Display performance improvement summary
   * @param actualLoads - Actual number of page loads performed
   * @param estimatedOldLoads - Estimated page loads in old approach
   * @param totalTests - Total number of tests performed
   */
  displayPerformanceImprovement(actualLoads: number, estimatedOldLoads: number, totalTests: number): void {
    const reductionPercentage = ((estimatedOldLoads - actualLoads) / estimatedOldLoads * 100).toFixed(0);
    
    console.log(chalk.green(`   📊 Performance: ${actualLoads} page loads (vs ${estimatedOldLoads} in old approach)`));
    console.log(chalk.green(`   🚀 Network efficiency: ${reductionPercentage}% reduction in page loads`));
    console.log(chalk.green(`   ⚡ Parallel execution: Tests within each page run concurrently`));
  }

  /**
   * Display task execution progress
   * @param taskType - Type of tasks being executed
   * @param count - Number of tasks
   */
  displayTaskExecution(taskType: string, count: number): void {
    console.log(chalk.gray(`   🚀 Executing ${count} ${taskType}...`));
  }

  /**
   * Display task progress update
   * @param completed - Number of completed tasks
   * @param total - Total number of tasks
   */
  displayTaskProgress(completed: number, total: number): void {
    console.log(chalk.gray(`      Progress: ${completed}/${total} pages completed`));
  }

  /**
   * Display individual test progress within page processing
   * @param testName - Name of the test being run
   * @param context - Additional context (e.g., viewport, page name)
   */
  displayTestProgress(testName: string, context?: string): void {
    const contextStr = context ? ` ${context}` : '';
    console.log(chalk.gray(`      ${testName}${contextStr}...`));
  }

  /**
   * Display page completion summary
   * @param url - The URL that was processed
   * @param totalTests - Total number of tests run
   * @param successfulTests - Number of successful tests
   */
  displayPageComplete(url: string, totalTests: number, successfulTests: number): void {
    const pathname = new URL(url).pathname;
    console.log(chalk.green(`    ✅ Completed ${totalTests} tests for ${pathname} (${successfulTests} successful)`));
  }

  /**
   * Display parallel test execution info
   * @param count - Number of tests running in parallel
   */
  displayParallelExecution(count: number): void {
    console.log(chalk.gray(`      🔄 Running ${count} tests in parallel...`));
  }

  /**
   * Display site discovery results
   * @param count - Number of pages discovered
   */
  displaySiteDiscovery(count: number): void {
    console.log(chalk.green(`   ✅ Found ${count} pages`));
  }

  /**
   * Display HTML report generation results
   * @param reportCount - Number of reports generated
   * @param success - Whether generation was successful
   */
  displayHTMLReports(reportCount: number, success: boolean): void {
    if (success && reportCount > 0) {
      console.log(chalk.green(`\n✅ Generated ${reportCount} HTML report(s)`));
    }
  }

  /**
   * Display HTML report warnings
   * @param errors - Array of error messages
   */
  displayHTMLReportWarnings(errors: string[]): void {
    if (errors.length > 0) {
      console.log(chalk.yellow('\n⚠️  Some HTML reports failed to generate:'));
      errors.forEach(error => {
        console.log(chalk.yellow(`   - ${error}`));
      });
    }
  }

  /**
   * Format duration between two dates
   * @param startTime - Start date
   * @param endTime - End date (optional, defaults to now)
   * @returns Formatted duration string in seconds
   */
  formatDuration(startTime: Date, endTime?: Date): string {
    const end = endTime || new Date();
    const duration = Math.round((end.getTime() - startTime.getTime()) / 1000);
    return `${duration}s`;
  }

  /**
   * Display separator line with consistent formatting
   * @param length - Length of the separator (default: 50)
   * @param color - Chalk color function to use (default: cyan)
   */
  displaySeparator(length: number = 50, color: typeof chalk.cyan = chalk.cyan): void {
    console.log(color('═'.repeat(length)));
  }
}