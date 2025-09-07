import logUpdate from 'log-update';
import chalk from 'chalk';
import { PlatformDetector } from './platform-detector.js';
import { LoadingText, LoadingTextOptions } from './loading-text.js';
import { LoadingInfo, LoadingInfoData } from './loading-info.js';
import { LoadingProgressBar, ProgressData } from './loading-progress-bar.js';
import { SessionProgressTracker } from '../session-progress-tracker.js';

export interface LoadingScreenOptions {
  enableVerboseMode?: boolean;
  updateInterval?: number;
  loadingText?: LoadingTextOptions;
  showInfo?: boolean;
  showProgress?: boolean;
  showKeyboardShortcuts?: boolean;
  progressTracker?: SessionProgressTracker | null;
}

export interface BufferedMessage {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export interface LoadingScreenState {
  isActive: boolean;
  currentPhase?: number;
  totalPhases?: number;
  phaseName?: string;
  verboseMode: boolean;
  currentContext?: string;
  progressDescription?: string;
}

/**
 * Main LoadingScreen orchestrator that combines all loading components
 * Manages the display lifecycle and coordinates updates between components
 */
export class LoadingScreen {
  private options: LoadingScreenOptions;
  private state: LoadingScreenState;
  
  // Component instances
  private loadingText: LoadingText;
  private loadingInfo: LoadingInfo;
  private progressBar: LoadingProgressBar;
  
  // Update management
  private updateTimer: NodeJS.Timeout | null = null;
  private lastRender: string = '';
  private capabilities: ReturnType<typeof PlatformDetector.getCapabilities>;
  
  // Console interception
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;
  private messageBuffer: BufferedMessage[] = [];
  
  // Progress tracking
  private progressTracker: SessionProgressTracker | null = null;
  
  constructor(options: LoadingScreenOptions = {}) {
    this.options = {
      enableVerboseMode: false,
      updateInterval: 100, // 100ms for smooth updates
      showInfo: true,
      showProgress: true,
      showKeyboardShortcuts: true,
      ...options
    };

    this.state = {
      isActive: false,
      verboseMode: this.options.enableVerboseMode || false,
      progressDescription: 'Preparing...'
    };
    
    this.progressTracker = options.progressTracker || null;

    this.capabilities = PlatformDetector.getCapabilities();

    // Initialize components
    this.loadingText = new LoadingText(options.loadingText);
    this.loadingInfo = new LoadingInfo();
    this.progressBar = new LoadingProgressBar();
  }

  /**
   * Start the loading screen display
   */
  start(): void {
    if (this.state.isActive) {
      return;
    }

    // Don't show loading screen in verbose mode
    if (this.state.verboseMode) {
      return;
    }

    this.state.isActive = true;
    this.loadingText.start();
    
    // Intercept console output to prevent interference
    this.interceptConsole();

    // Start the update loop if we can use advanced features
    if (this.capabilities.hasFullAnsiSupport) {
      this.startUpdateLoop();
    } else {
      // Fallback: just show initial loading message
      this.safeConsoleLog(this.loadingText.getFormattedText());
    }
  }

  /**
   * Stop the loading screen and clean up
   */
  stop(): void {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    this.loadingText.stop();
    this.stopUpdateLoop();
    
    // Restore console output
    this.restoreConsole();

    // Clear the loading screen if we were using log-update
    if (this.capabilities.hasFullAnsiSupport) {
      logUpdate.clear();
    }
    
    // Flush buffered messages in verbose mode
    if (this.state.verboseMode) {
      this.flushBufferedMessages();
    }
  }

  /**
   * Update loading text context and words
   */
  updateLoadingContext(context: 'crawling' | 'testing' | 'processing' | 'reporting'): void {
    if (this.state.verboseMode) {
      return;
    }

    this.loadingText.destroy();
    this.loadingText = LoadingText.createForContext(context);
    
    if (this.state.isActive) {
      this.loadingText.start();
    }
  }

  /**
   * Update thread/parallel execution information
   */
  updateThreadInfo(activeThreads: number, maxThreads: number): void {
    if (this.state.verboseMode) {
      return;
    }

    this.loadingInfo.updateActiveThreads(activeThreads, maxThreads);
  }

  /**
   * Update task progress information with context
   */
  updateTaskProgress(completed: number, total: number, context?: string): void {
    if (this.state.verboseMode) {
      return;
    }

    this.loadingInfo.updateTaskProgress(completed, total);
    
    // Use session progress tracker if available, otherwise fall back to local progress
    if (this.progressTracker) {
      this.progressTracker.updateTestProgress(completed);
      const overallProgress = this.progressTracker.getOverallProgress();
      const description = this.progressTracker.getProgressDescription();
      
      this.progressBar.updateProgress(overallProgress, 100);
      this.progressBar.setLabel(''); // Clear any hardcoded labels
      this.state.progressDescription = description;
    } else {
      this.progressBar.updateProgress(completed, total);
      if (context) {
        this.progressBar.setLabel(context);
        this.state.currentContext = context;
      }
    }
  }

  /**
   * Update current phase information
   */
  updatePhase(phase: number, totalPhases: number, phaseName: string): void {
    if (this.state.verboseMode) {
      return;
    }

    this.state.currentPhase = phase;
    this.state.totalPhases = totalPhases;
    this.state.phaseName = phaseName;

    // Update progress tracker if available
    if (this.progressTracker) {
      this.progressTracker.startPhase(phase);
      this.state.progressDescription = this.progressTracker.getProgressDescription();
    }

    this.loadingInfo.updatePhase(phase.toString(), phaseName);
    this.progressBar.updatePhase(phase, totalPhases, '');
  }

  /**
   * Set progress context (replaces hardcoded labels)
   */
  setProgressContext(context: string): void {
    if (this.state.verboseMode) {
      return;
    }

    this.state.currentContext = context;
    // Don't set hardcoded labels on progress bar anymore
  }

  /**
   * Enable/disable verbose mode (falls back to traditional logging)
   */
  setVerboseMode(enabled: boolean): void {
    this.state.verboseMode = enabled;
    
    if (enabled && this.state.isActive) {
      // Switch to verbose mode - stop loading screen
      this.stop();
    } else if (!enabled && !this.state.isActive) {
      // Switch back from verbose mode - can restart loading screen
      // (Note: caller should call start() if they want to resume)
    }
  }

  /**
   * Check if loading screen is currently active
   */
  isActive(): boolean {
    return this.state.isActive && !this.state.verboseMode;
  }

  /**
   * Check if we're in verbose mode
   */
  isVerboseMode(): boolean {
    return this.state.verboseMode;
  }

  /**
   * Log a message (will either buffer for verbose mode or be ignored in clean mode)
   */
  log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (this.state.verboseMode) {
      // Use original console methods to avoid interception
      this.safeConsoleLog(message);
    } else {
      // Buffer the message for potential later display
      this.messageBuffer.push({
        message,
        type,
        timestamp: new Date()
      });
    }
  }

  /**
   * Start the update loop for smooth rendering
   */
  private startUpdateLoop(): void {
    if (this.updateTimer) {
      return;
    }

    this.updateTimer = setInterval(() => {
      this.render();
    }, this.options.updateInterval);

    // Initial render
    this.render();
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Render the current loading screen state
   */
  private render(): void {
    if (!this.state.isActive || this.state.verboseMode) {
      return;
    }

    const lines: string[] = [];

    // Loading text with current context
    const loadingText = this.loadingText.getFormattedText();
    if (this.state.progressDescription) {
      lines.push(`${loadingText}`);
      lines.push(`${this.state.progressDescription}`);
    } else {
      lines.push(loadingText);
    }

    // Progress bar (if enabled and has data)
    if (this.options.showProgress) {
      const progressText = this.progressBar.getFormattedProgressBar();
      if (progressText) {
        lines.push(progressText);
      }

      // Phase progress (if available)
      const phaseText = this.progressBar.getPhaseProgress();
      if (phaseText) {
        lines.push(phaseText);
      }
    }

    // Loading info (if enabled and has data)
    if (this.options.showInfo && this.loadingInfo.hasData()) {
      const infoText = this.loadingInfo.getFormattedInfo();
      if (infoText) {
        lines.push(infoText);
      }
    }

    // Keyboard shortcuts (if enabled)
    if (this.options.showKeyboardShortcuts) {
      const shortcutsText = this.renderKeyboardShortcuts();
      if (shortcutsText) {
        lines.push('');  // Add blank line for separation
        lines.push(shortcutsText);
      }
    }

    const currentRender = lines.join('\n');

    // Only update if content has changed (reduces flicker)
    if (currentRender !== this.lastRender) {
      if (this.capabilities.hasFullAnsiSupport) {
        logUpdate(currentRender);
      } else {
        // Fallback for limited terminals - use safe console
        this.safeConsoleLog(currentRender);
      }
      this.lastRender = currentRender;
    }
  }

  /**
   * Get current state (for debugging or testing)
   */
  getState(): LoadingScreenState {
    return { ...this.state };
  }

  /**
   * Force a render update (useful for external updates)
   */
  forceUpdate(): void {
    if (this.state.isActive && !this.state.verboseMode) {
      this.render();
    }
  }

  /**
   * Create a loading screen configured for a specific phase
   */
  static createForPhase(phase: number, totalPhases: number, phaseName: string): LoadingScreen {
    const contextMap: Record<number, 'crawling' | 'testing' | 'processing' | 'reporting'> = {
      1: 'crawling',
      2: 'testing', 
      3: 'reporting'
    };

    const loadingScreen = new LoadingScreen({
      loadingText: {
        words: LoadingText.createForContext(contextMap[phase] || 'processing').getCurrentText().split(' ').slice(0, -1)
      }
    });

    loadingScreen.updatePhase(phase, totalPhases, phaseName);
    return loadingScreen;
  }

  /**
   * Set the progress tracker for session-wide progress
   */
  setProgressTracker(tracker: SessionProgressTracker): void {
    this.progressTracker = tracker;
  }

  /**
   * Render keyboard shortcuts section
   */
  private renderKeyboardShortcuts(): string {
    const shortcuts = [
      { key: 'Ctrl+C', description: 'Exit cleanly' }
    ];

    const shortcutText = shortcuts
      .map(shortcut => `${chalk.cyan(shortcut.key)} ${chalk.gray('–')} ${chalk.white(shortcut.description)}`)
      .join('  ');
    
    return `${chalk.gray('Keyboard shortcuts:')} ${shortcutText}`;
  }

  /**
   * Intercept console output to prevent interference with loading screen
   */
  private interceptConsole(): void {
    if (this.originalConsole || this.state.verboseMode) {
      return; // Already intercepted or in verbose mode
    }

    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    // Replace console methods with buffering versions
    console.log = (...args: any[]) => {
      this.messageBuffer.push({
        message: args.join(' '),
        type: 'info',
        timestamp: new Date()
      });
    };

    console.warn = (...args: any[]) => {
      this.messageBuffer.push({
        message: args.join(' '),
        type: 'warning',
        timestamp: new Date()
      });
    };

    console.error = (...args: any[]) => {
      this.messageBuffer.push({
        message: args.join(' '),
        type: 'error',
        timestamp: new Date()
      });
    };
  }

  /**
   * Restore original console methods
   */
  private restoreConsole(): void {
    if (!this.originalConsole) {
      return;
    }

    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    
    this.originalConsole = null;
  }

  /**
   * Use original console methods safely without interception
   */
  private safeConsoleLog(message: string): void {
    if (this.originalConsole) {
      this.originalConsole.log(message);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  }

  /**
   * Flush buffered messages (used when switching to verbose mode or cleanup)
   */
  private flushBufferedMessages(): void {
    if (this.messageBuffer.length === 0) {
      return;
    }

    this.messageBuffer.forEach(msg => {
      let formattedMessage = msg.message;
      switch (msg.type) {
        case 'success':
          formattedMessage = chalk.green(msg.message);
          break;
        case 'warning':
          formattedMessage = chalk.yellow(msg.message);
          break;
        case 'error':
          formattedMessage = chalk.red(msg.message);
          break;
      }
      this.safeConsoleLog(formattedMessage);
    });
    
    this.messageBuffer = [];
  }

  /**
   * Cleanup resources and stop all timers
   */
  destroy(): void {
    this.stop();
    this.loadingText.destroy();
    this.restoreConsole();
    this.messageBuffer = [];
  }
}