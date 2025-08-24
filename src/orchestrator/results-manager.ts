import { SessionSummary, PageResult, TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ReporterManager } from '../utils/reporter-manager.js';
import { DirectoryScanner } from '../utils/directory-scanner.js';
import { ErrorHandler } from './error-handler.js';
import { UIStyler } from './ui-styler.js';

export class ResultsManager {
  private sessionManager: SessionManager;
  private directoryScanner: DirectoryScanner;
  private errorHandler: ErrorHandler;
  private uiStyler: UIStyler;

  constructor(
    sessionManager: SessionManager,
    errorHandler?: ErrorHandler,
    uiStyler?: UIStyler
  ) {
    this.sessionManager = sessionManager;
    this.directoryScanner = new DirectoryScanner();
    this.errorHandler = errorHandler || new ErrorHandler();
    this.uiStyler = uiStyler || new UIStyler();
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
    // Generate page results from stored data and organize by URL
    const pageResults: PageResult[] = [];
    const urls = dataManager.getUrls();
    
    for (const url of urls) {
      const metrics = dataManager.getPageMetrics(url);
      const content = dataManager.getScrapedContent(url);
      
      // Since we trust our simple path system, just filter results by output path containing the page
      const pageTests = allTestResults.filter(result => 
        result.outputPath && result.outputPath.includes(`/${this.sessionManager.getPageName(url)}/`)
      );
      
      const pageResult: PageResult = {
        url,
        pageName: this.sessionManager.getPageName(url),
        tests: pageTests,
        summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}\nTests run: ${pageTests.length}`
      };
      
      pageResults.push(pageResult);
    }

    // Add site-wide tests to the first page result (or create a separate section)
    if (pageResults.length > 0) {
      // Site-wide tests are in the session root (no page subdirectory) - include sitemap, site-summary, etc.
      const sessionTests = allTestResults.filter(result => 
        result.outputPath && 
        result.outputPath.includes(dataManager.sessionId) && 
        !urls.some(pageUrl => result.outputPath!.includes(`/${this.sessionManager.getPageName(pageUrl)}/`))
      );
      
      if (sessionTests.length > 0) {
        // Add session tests to first page or create a summary entry
        pageResults[0].tests.push(...sessionTests);
      }
    }

    await this.sessionManager.generateSessionSummary(sessionSummary, pageResults);
  }

  /**
   * Generate HTML reports if configured - using DirectoryScanner for reliable data
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

      // Use DirectoryScanner to get ACTUAL files from session directory
      // This eliminates all cross-session contamination issues
      const pageResults = await this.directoryScanner.scanSession(sessionSummary.sessionId);

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
   * Create PageResult objects from test results and stored data
   */
  createPageResults(allTestResults: TestResult[], dataManager: SessionDataManager): PageResult[] {
    const pageResults: PageResult[] = [];
    const urls = dataManager.getUrls();
    
    for (const url of urls) {
      const metrics = dataManager.getPageMetrics(url);
      const content = dataManager.getScrapedContent(url);
      
      // Since we trust our simple path system, just filter results by output path containing the page
      const pageTests = allTestResults.filter(result => 
        result.outputPath && result.outputPath.includes(`/${this.sessionManager.getPageName(url)}/`)
      );
      
      const pageResult: PageResult = {
        url,
        pageName: this.sessionManager.getPageName(url),
        tests: pageTests,
        summary: `Page: ${url}\nTitle: ${metrics?.title || content?.title || 'Unknown'}\nWord count: ${metrics?.wordCount || 0}\nTests run: ${pageTests.length}`
      };
      
      pageResults.push(pageResult);
    }

    // Add site-wide tests to the first page result
    if (pageResults.length > 0) {
      // Site-wide tests are in the session root (no page subdirectory) - include sitemap, site-summary, etc.
      const sessionTests = allTestResults.filter(result => 
        result.outputPath && 
        result.outputPath.includes(dataManager.sessionId) && 
        !urls.some(pageUrl => result.outputPath!.includes(`/${this.sessionManager.getPageName(pageUrl)}/`))
      );
      
      if (sessionTests.length > 0) {
        pageResults[0].tests.push(...sessionTests);
      }
    }

    return pageResults;
  }

  /**
   * Simple page filtering - relies on canonical path structure
   */
  filterTestResultsByPage(allTestResults: TestResult[], url: string): TestResult[] {
    const pageName = this.sessionManager.getPageName(url);
    return allTestResults.filter(result => {
      return result.outputPath?.includes(`/${pageName}/`);
    });
  }
}