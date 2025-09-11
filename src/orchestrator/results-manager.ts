import path from 'path';
import { SessionSummary, PageResult, TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ReporterManager } from '../utils/reporter-manager.js';
import { ErrorHandler } from './error-handler.js';
import { UIStyler } from './ui-styler.js';

export class ResultsManager {
  private sessionManager: SessionManager;
  private errorHandler: ErrorHandler;
  private uiStyler: UIStyler;

  constructor(
    sessionManager: SessionManager,
    errorHandler?: ErrorHandler,
    uiStyler?: UIStyler
  ) {
    this.sessionManager = sessionManager;
    this.errorHandler = errorHandler || new ErrorHandler();
    this.uiStyler = uiStyler || new UIStyler();
  }

  /**
   * Simple, reliable method to check if a test result belongs to a specific page
   * Handles Windows/Unix path differences properly
   */
  private testBelongsToPage(testResult: TestResult, pageName: string): boolean {
    if (!testResult.outputPath) {
      return false;
    }
    
    // Normalize the path to handle Windows/Unix differences
    const normalizedPath = path.normalize(testResult.outputPath);
    
    // Look for the page name as a directory in the path
    // Expected pattern: .../{sessionId}/{pageName}/{testType}/...
    const pagePattern = path.sep + pageName + path.sep;
    
    return normalizedPath.includes(pagePattern);
  }

  /**
   * Check if a test result is a site-wide test (no specific page)
   */
  private isSiteWideTest(testResult: TestResult, sessionId: string, allPageNames: string[]): boolean {
    if (!testResult.outputPath) {
      return false;
    }
    
    // Must contain the session ID
    if (!testResult.outputPath.includes(sessionId)) {
      return false;
    }
    
    // But should NOT belong to any specific page
    return !allPageNames.some(pageName => this.testBelongsToPage(testResult, pageName));
  }

  /**
   * Aggregate all test results
   */
  aggregateResults(allTestResults: TestResult[]): TestResult[] {
    return allTestResults;
  }

  /**
   * Generate final session summary with page results
   */
  async generateFinalSessionSummary(
    sessionSummary: SessionSummary, 
    allTestResults: TestResult[], 
    dataManager: SessionDataManager
  ): Promise<void> {
    // Use the same logic as HTML reports for consistency
    const pageResults = this.createPageResults(allTestResults, dataManager);
    await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
  }

  /**
   * Generate HTML reports if configured - using direct test results
   */
  async generateHTMLReports(
    sessionSummary: SessionSummary, 
    allTestResults: TestResult[], 
    dataManager: SessionDataManager,
    reporterManager?: ReporterManager
  ): Promise<void> {
    if (!reporterManager) {
      return; // No reporter configured
    }

    try {
      // Update reporter open behavior based on test results
      reporterManager.updateOpenBehaviorBasedOnResults(sessionSummary);

      // Use existing test results directly - no need to scan directories
      const pageResults = this.createPageResults(allTestResults, dataManager);

      // Generate reports using real file data
      const reportResult = await reporterManager.generateReports(sessionSummary, pageResults);
      
      if (reportResult.success && reportResult.reportPaths.length > 0) {
        this.uiStyler.displayHTMLReports(reportResult.reportPaths.length, true);
      } else if (reportResult.errors.length > 0) {
        this.uiStyler.displayHTMLReportWarnings(reportResult.errors);
      }

    } catch (error) {
      this.errorHandler.captureError(error, 'HTML report generation');
      this.errorHandler.logHTMLReportError(error);
    }
  }

  /**
   * Process screenshot test results to maintain individual viewport results
   * This replaces consolidation to ensure all viewport failures are visible
   */
  private processScreenshotTests(tests: TestResult[]): TestResult[] {
    // Return all tests as-is - no consolidation to preserve individual viewport results
    // This ensures that desktop, tablet, and mobile screenshot failures are all visible
    // in session summaries and HTML reports
    return tests;
  }

  /**
   * Create PageResult objects from test results and stored data
   */
  createPageResults(allTestResults: TestResult[], dataManager: SessionDataManager): PageResult[] {
    const pageResults: PageResult[] = [];
    const urls = dataManager.getUrls();
    
    // Create page-specific results
    for (const url of urls) {
      const metrics = dataManager.getPageMetrics(url);
      const content = dataManager.getScrapedContent(url);
      const pageName = this.sessionManager.getPageName(url);
      
      // Filter for tests that belong to this specific page using simple helper
      const pageTests = allTestResults.filter(result => 
        this.testBelongsToPage(result, pageName)
      );
      
      // Process screenshot test results to preserve individual viewport failures
      const processedTests = this.processScreenshotTests(pageTests);
      
      const pageResult: PageResult = {
        url,
        pageName,
        tests: processedTests,
        summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}\nTests run: ${processedTests.length}`
      };
      
      pageResults.push(pageResult);
    }

    // Create a separate entry for site-wide tests using simple helper
    const allPageNames = urls.map(url => this.sessionManager.getPageName(url));
    const sessionTests = allTestResults.filter(result => 
      this.isSiteWideTest(result, dataManager.sessionId, allPageNames)
    );
    
    if (sessionTests.length > 0) {
      const siteWideResult: PageResult = {
        url: 'Site-wide',
        pageName: 'site-wide',
        tests: sessionTests,
        summary: `Site-wide tests: ${sessionTests.length} tests (sitemap, site summary, etc.)`
      };
      pageResults.push(siteWideResult);
    }

    return pageResults;
  }

}