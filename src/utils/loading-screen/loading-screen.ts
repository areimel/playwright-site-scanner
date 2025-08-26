import logUpdate from 'log-update';
import { PlatformDetector } from './platform-detector.js';
import { LoadingText, LoadingTextOptions } from './loading-text.js';
import { LoadingInfo, LoadingInfoData } from './loading-info.js';
import { LoadingProgressBar, ProgressData } from './loading-progress-bar.js';

export interface LoadingScreenOptions {
  enableVerboseMode?: boolean;
  updateInterval?: number;
  loadingText?: LoadingTextOptions;
  showInfo?: boolean;
  showProgress?: boolean;
}

export interface LoadingScreenState {
  isActive: boolean;
  currentPhase?: number;
  totalPhases?: number;
  phaseName?: string;
  verboseMode: boolean;
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
  
  constructor(options: LoadingScreenOptions = {}) {
    this.options = {
      enableVerboseMode: false,
      updateInterval: 100, // 100ms for smooth updates
      showInfo: true,
      showProgress: true,
      ...options
    };

    this.state = {
      isActive: false,
      verboseMode: this.options.enableVerboseMode || false
    };

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

    // Start the update loop if we can use advanced features
    if (this.capabilities.hasFullAnsiSupport) {
      this.startUpdateLoop();
    } else {
      // Fallback: just show initial loading message
      console.log(this.loadingText.getFormattedText());
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

    // Clear the loading screen if we were using log-update
    if (this.capabilities.hasFullAnsiSupport) {
      logUpdate.clear();
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
   * Update task progress information
   */
  updateTaskProgress(completed: number, total: number): void {
    if (this.state.verboseMode) {
      return;
    }

    this.loadingInfo.updateTaskProgress(completed, total);
    this.progressBar.updateProgress(completed, total);
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

    this.loadingInfo.updatePhase(phase.toString(), phaseName);
    this.progressBar.updatePhase(phase, totalPhases, phaseName);
  }

  /**
   * Set progress label
   */
  setProgressLabel(label: string): void {
    if (this.state.verboseMode) {
      return;
    }

    this.progressBar.setLabel(label);
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
   * Log a message (will either show in loading screen or as verbose output)
   */
  log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (this.state.verboseMode) {
      // Traditional console logging
      console.log(message);
    } else {
      // In loading screen mode, we could queue messages or show them briefly
      // For now, we'll just ignore them to keep the clean loading experience
      // Could be enhanced to show a message queue or flash messages
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

    // Loading text (always shown)
    lines.push(this.loadingText.getFormattedText());

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

    const currentRender = lines.join('\n');

    // Only update if content has changed (reduces flicker)
    if (currentRender !== this.lastRender) {
      if (this.capabilities.hasFullAnsiSupport) {
        logUpdate(currentRender);
      } else {
        // Fallback for limited terminals - just show the loading text
        console.log(this.loadingText.getFormattedText());
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
   * Cleanup resources and stop all timers
   */
  destroy(): void {
    this.stop();
    this.loadingText.destroy();
  }
}