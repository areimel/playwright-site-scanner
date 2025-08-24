import { TestConfig, SessionSummary, TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ParallelExecutor } from '../utils/parallel-executor.js';
import { ReporterManager } from '../utils/reporter-manager.js';
import { CrawleeSiteCrawler } from '../lib/crawlee-site-crawler.js';
import { ScreenshotTester } from '../lib/screenshot-tester.js';
import { SEOTester } from '../lib/seo-tester.js';
import { AccessibilityTester } from '../lib/accessibility-tester.js';
import { SitemapTester } from '../lib/sitemap-tester.js';
import { ContentScraper } from '../lib/content-scraper.js';
import { SiteSummaryTester } from '../lib/site-summary-tester.js';
import { ApiKeyTester } from '../lib/api-key-tester.js';
import { BrowserManager } from './browser-manager.js';
import { ErrorHandler } from './error-handler.js';
import { UIStyler } from './ui-styler.js';
import { TestConfigManager } from './test-config-manager.js';
import { TestRunner } from './test-runner.js';
import { ResultsManager } from './results-manager.js';

/**
 * TestOrchestrator - Lean coordinator that manages the overall test execution flow
 * Delegates specific responsibilities to specialized modules while maintaining session state
 */
export class TestOrchestrator {
  // Core orchestration dependencies
  private browserManager: BrowserManager;
  private sessionManager: SessionManager;
  private progressTracker: ProgressTracker;
  private errorHandler: ErrorHandler;
  private uiStyler: UIStyler;
  private resultsManager: ResultsManager;
  
  // Test execution modules
  private testRunner: TestRunner | null = null;
  
  // Session state
  private dataManager: SessionDataManager | null = null;
  private parallelExecutor: ParallelExecutor | null = null;
  private reporterManager: ReporterManager | null = null;
  
  // Track all test results for session summary
  private allTestResults: TestResult[] = [];

  constructor() {
    // Initialize core orchestration modules
    this.browserManager = new BrowserManager();
    this.sessionManager = new SessionManager();
    this.progressTracker = new ProgressTracker();
    this.errorHandler = new ErrorHandler();
    this.uiStyler = new UIStyler();
    this.resultsManager = new ResultsManager(this.sessionManager, this.errorHandler, this.uiStyler);
  }

  /**
   * Main orchestration method - coordinates the entire test execution flow
   * Maintains the same public interface while delegating to specialized modules
   */
  async runTests(config: TestConfig): Promise<void> {
    // Create session summary for tracking
    const sessionSummary: SessionSummary = {
      sessionId: this.sessionManager.createSessionId(),
      url: config.url,
      startTime: new Date(),
      totalPages: 0,
      testsRun: 0,
      testsSucceeded: 0,
      testsFailed: 0,
      errors: []
    };

    try {
      // 1. Validate configuration
      const configValidation = TestConfigManager.validateConfig(config);
      if (!configValidation.valid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
      }

      // 2. Display configuration and execution strategy
      this.uiStyler.displayInitialization('Initializing browser and execution strategy...');
      const executionStrategy = TestConfigManager.processExecutionStrategy(config);
      this.uiStyler.displayExecutionStrategy(executionStrategy.phases.length, executionStrategy.totalEstimatedDuration);

      // 3. Initialize browser and session infrastructure
      await this.initializeSession(config, sessionSummary);

      // 4. Execute all three phases using TestRunner
      await this.executeAllPhases(config, executionStrategy);

      // 5. Generate final reports and summaries
      await this.generateFinalResults(sessionSummary);

      // 6. Display completion summary
      this.uiStyler.displayCompletionSummary(sessionSummary);

    } catch (error) {
      this.errorHandler.captureError(error, 'Test session');
      this.errorHandler.logError(error);
      this.errorHandler.addError(sessionSummary, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize browser, session infrastructure, and TestRunner
   */
  private async initializeSession(config: TestConfig, sessionSummary: SessionSummary): Promise<void> {
    // Initialize browser
    await this.browserManager.initializeBrowser();
    
    // Initialize session data management
    this.dataManager = new SessionDataManager(config.url, sessionSummary.sessionId);
    this.parallelExecutor = new ParallelExecutor(this.browserManager.getBrowser()!, 5);
    
    // Initialize reporter if configured
    if (config.reporter?.enabled) {
      this.reporterManager = new ReporterManager(config.reporter, sessionSummary.sessionId);
    }

    // Create session directory
    await this.sessionManager.createSessionDirectory(sessionSummary.sessionId);

    // Initialize TestRunner with all dependencies
    this.testRunner = new TestRunner(
      this.browserManager,
      this.dataManager,
      this.parallelExecutor,
      new CrawleeSiteCrawler(),
      new ScreenshotTester(),
      new SEOTester(),
      new AccessibilityTester(),
      new SitemapTester(),
      new ContentScraper(),
      new SiteSummaryTester(),
      new ApiKeyTester(),
      this.errorHandler,
      this.uiStyler
    );
  }

  /**
   * Execute all three test phases using TestRunner
   */
  private async executeAllPhases(config: TestConfig, executionStrategy: any): Promise<void> {
    if (!this.testRunner) {
      throw new Error('TestRunner not initialized');
    }

    // Execute Phase 1: Data Discovery & Collection
    await this.testRunner.executePhase1(config, executionStrategy);
    
    // Execute Phase 2: Unified Page Analysis & Testing  
    await this.testRunner.executePhase2(config, executionStrategy);
    
    // Execute Phase 3: Report Generation & Finalization
    await this.testRunner.executePhase3(config, executionStrategy);

    // Collect all results from TestRunner
    this.allTestResults = this.testRunner.getTestResults();
  }

  /**
   * Generate final session summary and reports
   */
  private async generateFinalResults(sessionSummary: SessionSummary): Promise<void> {
    if (!this.dataManager) {
      throw new Error('Data manager not initialized');
    }

    // Update session summary with final statistics
    sessionSummary.endTime = new Date();
    sessionSummary.totalPages = this.dataManager.getUrls().length;
    
    const allResults = this.resultsManager.aggregateResults(this.allTestResults);
    sessionSummary.testsRun = allResults.length;
    sessionSummary.testsSucceeded = allResults.filter(r => r.status === 'success').length;
    sessionSummary.testsFailed = allResults.filter(r => r.status === 'failed').length;
    
    // Generate session summary
    this.uiStyler.displayProgress('📊 Generating session summary...');
    await this.resultsManager.generateFinalSessionSummary(sessionSummary, this.allTestResults, this.dataManager);
    
    // Generate HTML reports if configured
    await this.resultsManager.generateHTMLReports(sessionSummary, this.allTestResults, this.dataManager, this.reporterManager || undefined);
    
    // Display files created summary
    this.uiStyler.displayFilesCreated(sessionSummary.sessionId, this.allTestResults);
  }

  /**
   * Clean up resources and reset session state
   */
  private async cleanup(): Promise<void> {
    // Cleanup browser resources
    await this.browserManager.cleanup();
    
    // Cleanup reporter if active
    if (this.reporterManager) {
      await this.reporterManager.cleanup();
      this.reporterManager = null;
    }

    // Reset session state
    this.dataManager = null;
    this.parallelExecutor = null;
    this.testRunner = null;
    this.allTestResults = [];
  }
}