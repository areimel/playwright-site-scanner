import { PlatformDetector } from './platform-detector.js';
import chalk from 'chalk';

export interface LoadingInfoOptions {
  showActiveThreads?: boolean;
  showCompletedTasks?: boolean;
  showTotalTasks?: boolean;
  color?: 'gray' | 'cyan' | 'blue' | 'green';
}

export interface LoadingInfoData {
  activeThreads: number;
  maxThreads: number;
  completedTasks: number;
  totalTasks: number;
  currentPhase?: string;
  phaseName?: string;
}

export class LoadingInfo {
  private options: LoadingInfoOptions;
  private data: LoadingInfoData;
  private color: typeof chalk.gray;
  private safeChars: ReturnType<typeof PlatformDetector.getSafeChars>;

  constructor(options: LoadingInfoOptions = {}) {
    this.options = {
      showActiveThreads: true,
      showCompletedTasks: true,
      showTotalTasks: true,
      ...options
    };

    this.data = {
      activeThreads: 0,
      maxThreads: 0,
      completedTasks: 0,
      totalTasks: 0
    };

    this.safeChars = PlatformDetector.getSafeChars();

    // Set color based on platform capabilities
    const capabilities = PlatformDetector.getCapabilities();
    if (capabilities.supportsColor) {
      switch (options.color || 'gray') {
        case 'cyan': this.color = chalk.cyan; break;
        case 'blue': this.color = chalk.blue; break;
        case 'green': this.color = chalk.green; break;
        default: this.color = chalk.gray; break;
      }
    } else {
      this.color = chalk.white; // Fallback for terminals without color support
    }
  }

  /**
   * Update the loading information data
   */
  updateData(data: Partial<LoadingInfoData>): void {
    this.data = { ...this.data, ...data };
  }

  /**
   * Update active thread count
   */
  updateActiveThreads(active: number, max?: number): void {
    this.data.activeThreads = active;
    if (max !== undefined) {
      this.data.maxThreads = max;
    }
  }

  /**
   * Update task progress
   */
  updateTaskProgress(completed: number, total?: number): void {
    this.data.completedTasks = completed;
    if (total !== undefined) {
      this.data.totalTasks = total;
    }
  }

  /**
   * Update current phase information
   */
  updatePhase(phase: string, phaseName?: string): void {
    this.data.currentPhase = phase;
    this.data.phaseName = phaseName;
  }

  /**
   * Generate the formatted info text for display
   */
  getFormattedInfo(): string {
    const lines: string[] = [];

    // Phase information (if available)
    if (this.data.currentPhase && this.data.phaseName) {
      lines.push(
        this.color(`Phase ${this.data.currentPhase}: ${this.data.phaseName}`)
      );
    }

    // Active threads information
    if (this.options.showActiveThreads && this.data.maxThreads > 0) {
      const threadText = this.getThreadInfoText();
      if (threadText) {
        lines.push(threadText);
      }
    }

    // Task progress information
    if ((this.options.showCompletedTasks || this.options.showTotalTasks) && this.data.totalTasks > 0) {
      const taskText = this.getTaskProgressText();
      if (taskText) {
        lines.push(taskText);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get thread information text
   */
  private getThreadInfoText(): string {
    const { activeThreads, maxThreads } = this.data;
    
    if (maxThreads === 0) return '';

    const threadIcon = this.safeChars.bullet;
    const activeIcon = activeThreads > 0 ? this.safeChars.spinner[0] : this.safeChars.bullet;
    
    // Show different messages based on thread activity
    if (activeThreads === 0) {
      return this.color(`${threadIcon} Threads: idle (0/${maxThreads})`);
    } else if (activeThreads === maxThreads) {
      return this.color(`${activeIcon} Threads: fully active (${activeThreads}/${maxThreads})`);
    } else {
      return this.color(`${activeIcon} Threads: ${activeThreads}/${maxThreads} active`);
    }
  }

  /**
   * Get task progress text
   */
  private getTaskProgressText(): string {
    const { completedTasks, totalTasks } = this.data;
    
    if (totalTasks === 0) return '';

    const progressIcon = this.safeChars.bullet;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    let progressText = '';
    if (this.options.showCompletedTasks && this.options.showTotalTasks) {
      progressText = `${completedTasks}/${totalTasks} (${percentage}%)`;
    } else if (this.options.showCompletedTasks) {
      progressText = `${completedTasks} completed`;
    } else if (this.options.showTotalTasks) {
      progressText = `${percentage}% complete`;
    }

    return progressText ? this.color(`${progressIcon} Tasks: ${progressText}`) : '';
  }

  /**
   * Get a single line summary for compact display
   */
  getCompactSummary(): string {
    const parts: string[] = [];

    // Thread info
    if (this.data.maxThreads > 0) {
      parts.push(`${this.data.activeThreads}/${this.data.maxThreads} threads`);
    }

    // Task progress
    if (this.data.totalTasks > 0) {
      const percentage = Math.round((this.data.completedTasks / this.data.totalTasks) * 100);
      parts.push(`${percentage}% complete`);
    }

    const summary = parts.join(' • ');
    return summary ? this.color(`[${summary}]`) : '';
  }

  /**
   * Get current data (for testing or external use)
   */
  getData(): LoadingInfoData {
    return { ...this.data };
  }

  /**
   * Reset all data to initial state
   */
  reset(): void {
    this.data = {
      activeThreads: 0,
      maxThreads: 0,
      completedTasks: 0,
      totalTasks: 0
    };
  }

  /**
   * Create context-specific loading info for different phases
   */
  static createForPhase(phase: number, phaseName: string): LoadingInfo {
    const phaseColors: Record<number, 'gray' | 'cyan' | 'blue' | 'green'> = {
      1: 'cyan',   // Data Discovery & Collection
      2: 'blue',   // Page Analysis & Testing
      3: 'green'   // Report Generation & Finalization
    };

    const info = new LoadingInfo({
      color: phaseColors[phase] || 'gray'
    });

    info.updatePhase(phase.toString(), phaseName);
    return info;
  }

  /**
   * Check if there's any meaningful data to display
   */
  hasData(): boolean {
    return this.data.maxThreads > 0 || this.data.totalTasks > 0 || Boolean(this.data.currentPhase);
  }
}