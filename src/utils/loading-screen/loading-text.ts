import { PlatformDetector } from './platform-detector.js';
import chalk from 'chalk';

export interface LoadingTextOptions {
  words?: string[];
  interval?: number;
  color?: 'blue' | 'cyan' | 'green' | 'yellow' | 'magenta';
  showSpinner?: boolean;
}

export class LoadingText {
  private words: string[];
  private currentWordIndex: number = 0;
  private currentSpinnerIndex: number = 0;
  private interval: number;
  private color: typeof chalk.blue;
  private showSpinner: boolean;
  private timer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private safeChars: ReturnType<typeof PlatformDetector.getSafeChars>;

  constructor(options: LoadingTextOptions = {}) {
    this.words = options.words || [
      'Loading',
      'Scanning',
      'Analyzing', 
      'Processing',
      'Compiling',
      'Testing',
      'Validating',
      'Optimizing'
    ];
    this.interval = options.interval || 800; // Slower rotation for better readability
    this.showSpinner = options.showSpinner !== false; // Default true
    this.safeChars = PlatformDetector.getSafeChars();

    // Set color based on platform capabilities
    const capabilities = PlatformDetector.getCapabilities();
    if (capabilities.supportsColor) {
      switch (options.color || 'blue') {
        case 'cyan': this.color = chalk.cyan; break;
        case 'green': this.color = chalk.green; break;
        case 'yellow': this.color = chalk.yellow; break;
        case 'magenta': this.color = chalk.magenta; break;
        default: this.color = chalk.blue; break;
      }
    } else {
      this.color = chalk.white; // Fallback to white on terminals without color support
    }
  }

  /**
   * Start the rotating loading text
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.currentWordIndex = 0;
    this.currentSpinnerIndex = 0;

    // Initial render
    this.render();

    // Set up rotation timer
    this.timer = setInterval(() => {
      if (this.showSpinner) {
        // Advance spinner more frequently than words
        this.currentSpinnerIndex = (this.currentSpinnerIndex + 1) % this.safeChars.spinner.length;
        
        // Change word less frequently 
        if (this.currentSpinnerIndex === 0) {
          this.currentWordIndex = (this.currentWordIndex + 1) % this.words.length;
        }
      } else {
        // Just rotate words if spinner is disabled
        this.currentWordIndex = (this.currentWordIndex + 1) % this.words.length;
      }
      this.render();
    }, this.showSpinner ? this.interval / 4 : this.interval);
  }

  /**
   * Stop the rotating loading text
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isActive = false;
  }

  /**
   * Update the word list without restarting
   */
  updateWords(words: string[]): void {
    this.words = words;
    this.currentWordIndex = 0; // Reset to first word
  }

  /**
   * Get current loading text without rendering (for testing)
   */
  getCurrentText(): string {
    const currentWord = this.words[this.currentWordIndex];
    
    if (this.showSpinner) {
      const spinner = this.safeChars.spinner[this.currentSpinnerIndex];
      return `${spinner} ${currentWord}...`;
    } else {
      return `${currentWord}...`;
    }
  }

  /**
   * Render the current loading text (private method for internal use)
   */
  private render(): void {
    const text = this.getCurrentText();
    // Note: This will be managed by the main LoadingScreen orchestrator
    // Individual components don't directly write to console
  }

  /**
   * Get formatted loading text for display by orchestrator
   */
  getFormattedText(): string {
    const text = this.getCurrentText();
    return this.color(text);
  }

  /**
   * Check if the loading text is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Create a context-specific loading text instance
   */
  static createForContext(context: 'crawling' | 'testing' | 'processing' | 'reporting'): LoadingText {
    const contextWords: Record<string, string[]> = {
      crawling: [
        'Discovering',
        'Crawling', 
        'Exploring',
        'Mapping',
        'Indexing'
      ],
      testing: [
        'Testing',
        'Scanning',
        'Analyzing',
        'Validating',
        'Checking'
      ],
      processing: [
        'Processing',
        'Compiling',
        'Generating',
        'Building',
        'Optimizing'
      ],
      reporting: [
        'Compiling',
        'Generating',
        'Summarizing',
        'Finalizing',
        'Completing'
      ]
    };

    return new LoadingText({
      words: contextWords[context],
      color: context === 'crawling' ? 'cyan' : 
             context === 'testing' ? 'blue' :
             context === 'processing' ? 'yellow' : 'green'
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
  }
}