import { TestConfig, SessionSummary, TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { ProgressTracker } from '../utils/progress-tracker.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { ParallelExecutor } from '../utils/parallel-executor.js';
import { ReporterManager } from '../utils/reporter-manager.js';
import { LoadingScreen } from '../utils/loading-screen/index.js';
import { SessionProgressTracker } from '../utils/session-progress-tracker.js';
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
  private sessionProgressTracker: SessionProgressTracker | null = null;
  private errorHandler: ErrorHandler;
  private uiStyler: UIStyler;
  private resultsManager: ResultsManager;
  
  // Test execution modules
  private testRunner: TestRunner | null = null;
  
  // Session state
  private dataManager: SessionDataManager | null = null;
  private parallelExecutor: ParallelExecutor | null = null;
  private reporterManager: ReporterManager | null = null;
  private loadingScreen: LoadingScreen | null = null;
  
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
      const configValidation = await TestConfigManager.validateConfig(config);
      if (!configValidation.valid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
      }

      // 2. Display configuration and execution strategy
      this.uiStyler.displayInitialization('Initializing browser and execution strategy...');
      const executionStrategy = await TestConfigManager.processExecutionStrategy(config);
      this.uiStyler.displayExecutionStrategy(executionStrategy.phases.length, executionStrategy.totalEstimatedDuration);

      // 2.5. Create session progress tracker (needs to know page count, so after strategy processing)
      const estimatedPages = config.crawlSite ? 50 : 1; // Rough estimate, will be updated after crawling
      this.sessionProgressTracker = SessionProgressTracker.createForConfig(config, estimatedPages);

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
    
    // Initialize loading screen (check for verbose mode environment variable)
    const verboseMode = process.env.VERBOSE === 'true' || config.verboseMode === true;
    this.loadingScreen = new LoadingScreen({
      enableVerboseMode: verboseMode,
      progressTracker: this.sessionProgressTracker
    });
    
    // Set session progress tracker on loading screen
    if (this.sessionProgressTracker) {
      this.loadingScreen.setProgressTracker(this.sessionProgressTracker);
    }
    
    // Connect LoadingScreen to ParallelExecutor and UIStyler
    this.parallelExecutor.setLoadingScreen(this.loadingScreen);
    this.uiStyler.setLoadingScreen(this.loadingScreen);
    
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
    if (!this.testRunner || !this.loadingScreen) {
      throw new Error('TestRunner or LoadingScreen not initialized');
    }

    // Start loading screen
    this.loadingScreen.start();

    // Execute Phase 1: Data Discovery & Collection
    this.loadingScreen.updatePhase(1, 3, 'Data Discovery & Collection');
    this.loadingScreen.updateLoadingContext('crawling');
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.startPhase(1);
    }
    await this.testRunner.executePhase1(config, executionStrategy);
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.completePhase(1);
    }
    
    // Execute Phase 2: Unified Page Analysis & Testing  
    this.loadingScreen.updatePhase(2, 3, 'Page Analysis & Testing');
    this.loadingScreen.updateLoadingContext('testing');
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.startPhase(2);
      // Update total pages if we discovered more during crawling
      const actualPageCount = this.dataManager?.getUrls().length || 1;
      if (actualPageCount !== this.sessionProgressTracker.getSessionProgress().totalPages) {
        // Create new tracker with accurate page count
        this.sessionProgressTracker = SessionProgressTracker.createForConfig(config, actualPageCount);
        this.sessionProgressTracker.startPhase(2);
        this.loadingScreen.setProgressTracker(this.sessionProgressTracker);
      }
    }
    await this.testRunner.executePhase2(config, executionStrategy);
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.completePhase(2);
    }
    
    // Execute Phase 3: Dedicated Screenshot Testing
    this.loadingScreen.updatePhase(3, 4, 'Screenshot Testing');
    this.loadingScreen.updateLoadingContext('testing');
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.startPhase(3);
    }
    await this.testRunner.executePhase3(config, executionStrategy);
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.completePhase(3);
    }
    
    // Execute Phase 4: Final Analysis & Report Generation
    this.loadingScreen.updatePhase(4, 4, 'Final Analysis & Reports');
    this.loadingScreen.updateLoadingContext('reporting');
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.startPhase(4);
    }
    await this.testRunner.executePhase4(config, executionStrategy);
    if (this.sessionProgressTracker) {
      this.sessionProgressTracker.completePhase(4);
    }

    // Stop loading screen
    this.loadingScreen.stop();

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

    // Cleanup loading screen
    if (this.loadingScreen) {
      this.loadingScreen.destroy();
      this.loadingScreen = null;
    }

    // Reset session state
    this.dataManager = null;
    this.parallelExecutor = null;
    this.testRunner = null;
    this.sessionProgressTracker = null;
    this.allTestResults = [];
  }
}