import { PlatformDetector } from './platform-detector.js';
import chalk from 'chalk';

export interface ProgressBarOptions {
  width?: number;
  showPercentage?: boolean;
  showEta?: boolean;
  color?: 'green' | 'blue' | 'cyan' | 'yellow';
  format?: 'bar' | 'dots' | 'blocks';
}

export interface ProgressData {
  current: number;
  total: number;
  startTime?: Date;
  label?: string;
  phase?: {
    current: number;
    total: number;
    name?: string;
  };
}

export class LoadingProgressBar {
  private options: ProgressBarOptions;
  private data: ProgressData;
  private width: number;
  private color: typeof chalk.green;
  private safeChars: ReturnType<typeof PlatformDetector.getSafeChars>;

  constructor(options: ProgressBarOptions = {}) {
    this.options = {
      showPercentage: true,
      showEta: false,
      color: 'green',
      format: 'bar',
      ...options
    };

    this.data = {
      current: 0,
      total: 0,
      startTime: new Date()
    };

    // Get optimal width for current platform
    this.width = options.width || PlatformDetector.getProgressBarWidth();
    this.safeChars = PlatformDetector.getSafeChars();

    // Set color based on platform capabilities
    const capabilities = PlatformDetector.getCapabilities();
    if (capabilities.supportsColor) {
      switch (options.color) {
        case 'blue': this.color = chalk.blue; break;
        case 'cyan': this.color = chalk.cyan; break;
        case 'yellow': this.color = chalk.yellow; break;
        default: this.color = chalk.green; break;
      }
    } else {
      this.color = chalk.white; // Fallback for terminals without color support
    }
  }

  /**
   * Update progress data
   */
  updateProgress(current: number, total?: number): void {
    this.data.current = Math.max(0, current);
    if (total !== undefined) {
      this.data.total = Math.max(0, total);
    }
  }

  /**
   * Set the total value
   */
  setTotal(total: number): void {
    this.data.total = Math.max(0, total);
  }

  /**
   * Increment progress by a given amount
   */
  increment(amount: number = 1): void {
    this.data.current = Math.min(this.data.current + amount, this.data.total);
  }

  /**
   * Set progress label
   */
  setLabel(label: string): void {
    this.data.label = label;
  }

  /**
   * Update phase information for multi-phase progress
   */
  updatePhase(currentPhase: number, totalPhases: number, phaseName?: string): void {
    this.data.phase = {
      current: currentPhase,
      total: totalPhases,
      name: phaseName
    };
    
    // Reset progress timing for new phase
    this.data.startTime = new Date();
  }

  /**
   * Generate the formatted progress bar for display
   */
  getFormattedProgressBar(): string {
    if (this.data.total === 0) {
      return this.formatEmptyProgress();
    }

    const percentage = Math.min(100, Math.max(0, (this.data.current / this.data.total) * 100));
    const progressBar = this.createProgressBar(percentage);
    
    const parts: string[] = [];

    // Add the progress bar (no hardcoded labels)
    parts.push(progressBar);

    // Add percentage if enabled
    if (this.options.showPercentage) {
      parts.push(`${Math.round(percentage)}%`);
    }

    // Add ETA if enabled and we have enough data
    if (this.options.showEta && this.data.startTime && percentage > 0 && percentage < 100) {
      const eta = this.calculateETA(percentage);
      if (eta) {
        parts.push(`ETA: ${eta}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Get phase-specific progress information
   */
  getPhaseProgress(): string | null {
    if (!this.data.phase) {
      return null;
    }

    const { current, total, name } = this.data.phase;
    const phaseName = name ? ` (${name})` : '';
    return chalk.dim(`Phase ${current}/${total}${phaseName}`);
  }

  /**
   * Create the visual progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round((percentage / 100) * this.width);
    const empty = this.width - filled;

    let bar: string;
    switch (this.options.format) {
      case 'dots':
        bar = this.createDotProgress(filled, empty);
        break;
      case 'blocks':
        bar = this.createBlockProgress(filled, empty);
        break;
      default:
        bar = this.createBarProgress(filled, empty);
        break;
    }

    return `[${bar}]`;
  }

  /**
   * Create standard bar progress (default)
   */
  private createBarProgress(filled: number, empty: number): string {
    const filledBar = this.color(this.safeChars.progressFilled.repeat(filled));
    const emptyBar = chalk.dim(this.safeChars.progressEmpty.repeat(empty));
    return filledBar + emptyBar;
  }

  /**
   * Create dot-style progress
   */
  private createDotProgress(filled: number, empty: number): string {
    const filledDots = this.color(this.safeChars.bullet.repeat(filled));
    const emptyDots = chalk.dim('.'.repeat(empty));
    return filledDots + emptyDots;
  }

  /**
   * Create block-style progress
   */
  private createBlockProgress(filled: number, empty: number): string {
    const capabilities = PlatformDetector.getCapabilities();
    
    if (capabilities.supportsUnicode) {
      const filledBlocks = this.color('■'.repeat(filled));
      const emptyBlocks = chalk.dim('□'.repeat(empty));
      return filledBlocks + emptyBlocks;
    } else {
      // Fallback to standard bar on systems without Unicode
      return this.createBarProgress(filled, empty);
    }
  }

  /**
   * Format progress when total is 0 or unknown
   */
  private formatEmptyProgress(): string {
    const spinner = this.safeChars.spinner[0];
    return `${spinner} Initializing...`;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(percentage: number): string | null {
    if (!this.data.startTime || percentage <= 0) {
      return null;
    }

    const elapsed = Date.now() - this.data.startTime.getTime();
    const estimatedTotal = (elapsed / percentage) * 100;
    const remaining = estimatedTotal - elapsed;

    if (remaining < 0 || remaining > 600000) { // Don't show ETA > 10 minutes
      return null;
    }

    const seconds = Math.round(remaining / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  /**
   * Get current progress data
   */
  getProgress(): ProgressData {
    return { ...this.data };
  }

  /**
   * Get progress percentage
   */
  getPercentage(): number {
    if (this.data.total === 0) return 0;
    return Math.min(100, (this.data.current / this.data.total) * 100);
  }

  /**
   * Check if progress is complete
   */
  isComplete(): boolean {
    return this.data.total > 0 && this.data.current >= this.data.total;
  }

  /**
   * Reset progress to initial state
   */
  reset(): void {
    this.data = {
      current: 0,
      total: 0,
      startTime: new Date()
    };
  }

  /**
   * Create a compact single-line progress display
   */
  getCompactProgress(): string {
    if (this.data.total === 0) {
      return this.formatEmptyProgress();
    }

    const percentage = Math.round(this.getPercentage());
    const compactWidth = Math.min(15, this.width);
    const filled = Math.round((percentage / 100) * compactWidth);
    const empty = compactWidth - filled;

    const bar = this.color(this.safeChars.progressFilled.repeat(filled)) + 
                chalk.dim(this.safeChars.progressEmpty.repeat(empty));

    return `[${bar}] ${percentage}%`;
  }

  /**
   * Get current progress value and total for external calculations
   */
  getCurrentProgress(): { current: number; total: number } {
    return {
      current: this.data.current,
      total: this.data.total
    };
  }

  /**
   * Check if progress has meaningful data to display
   */
  hasProgress(): boolean {
    return this.data.total > 0 && this.data.current >= 0;
  }

  /**
   * Get the visual progress bar without labels or percentages
   */
  getBarOnly(): string {
    if (this.data.total === 0) {
      return this.formatEmptyProgress();
    }

    const percentage = Math.min(100, Math.max(0, (this.data.current / this.data.total) * 100));
    return this.createProgressBar(percentage);
  }

  /**
   * Create phase-aware progress bar for multi-phase operations
   */
  static createForPhase(phase: number, totalPhases: number, phaseName?: string): LoadingProgressBar {
    const phaseColors: Record<number, 'green' | 'blue' | 'cyan' | 'yellow'> = {
      1: 'cyan',   // Data Discovery & Collection
      2: 'blue',   // Page Analysis & Testing  
      3: 'green'   // Report Generation & Finalization
    };

    const progressBar = new LoadingProgressBar({
      color: phaseColors[phase] || 'green',
      showEta: true
    });

    progressBar.updatePhase(phase, totalPhases, phaseName);
    return progressBar;
  }
}