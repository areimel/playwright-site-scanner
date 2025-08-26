import { platform } from 'os';
import supportsColor from 'supports-color';

export interface PlatformCapabilities {
  supportsColor: boolean;
  supportsUnicode: boolean;
  isWindows: boolean;
  isPowerShell: boolean;
  terminalWidth: number;
  hasFullAnsiSupport: boolean;
}

export class PlatformDetector {
  private static capabilities: PlatformCapabilities | null = null;

  /**
   * Detect platform capabilities once and cache the result
   */
  static getCapabilities(): PlatformCapabilities {
    if (this.capabilities) {
      return this.capabilities;
    }

    const isWindows = platform() === 'win32';
    const terminalWidth = process.stdout.columns || 80;
    
    // Detect PowerShell by checking environment variables
    const isPowerShell = isWindows && (
      process.env.PSModulePath !== undefined ||
      process.env.WT_SESSION !== undefined ||
      process.env.TERM_PROGRAM === 'vscode' // VS Code terminal often uses PowerShell on Windows
    );

    // Check color support using supports-color library
    const colorSupport = supportsColor.stdout;
    const supportsColorOutput = Boolean(colorSupport && colorSupport.level > 0);

    // Unicode support detection
    const supportsUnicode = this.detectUnicodeSupport(isWindows, isPowerShell);

    // Full ANSI support (for cursor positioning, clearing, etc.)
    const hasFullAnsiSupport = supportsColorOutput && (
      !isWindows || 
      isPowerShell || 
      process.env.TERM === 'xterm-256color' ||
      process.env.WT_SESSION !== undefined // Windows Terminal
    );

    this.capabilities = {
      supportsColor: supportsColorOutput,
      supportsUnicode,
      isWindows,
      isPowerShell,
      terminalWidth,
      hasFullAnsiSupport
    };

    return this.capabilities;
  }

  /**
   * Detect Unicode support based on platform and environment
   */
  private static detectUnicodeSupport(isWindows: boolean, isPowerShell: boolean): boolean {
    // Check explicit Unicode environment variables
    if (process.env.TERM && process.env.TERM.includes('unicode')) {
      return true;
    }

    // Windows Terminal and modern PowerShell support Unicode
    if (isWindows) {
      if (process.env.WT_SESSION !== undefined) {
        return true; // Windows Terminal
      }
      if (isPowerShell && process.env.PSVersionTable !== undefined) {
        return true; // Modern PowerShell
      }
      // VS Code terminal on Windows
      if (process.env.TERM_PROGRAM === 'vscode') {
        return true;
      }
      return false; // Conservative default for Windows Command Prompt
    }

    // Non-Windows systems generally support Unicode
    return true;
  }

  /**
   * Get safe characters for the current platform
   */
  static getSafeChars(): {
    spinner: string[];
    progressFilled: string;
    progressEmpty: string;
    bullet: string;
    checkmark: string;
    cross: string;
    info: string;
    warning: string;
  } {
    const capabilities = this.getCapabilities();

    if (capabilities.supportsUnicode) {
      return {
        spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        progressFilled: '█',
        progressEmpty: '░',
        bullet: '•',
        checkmark: '✅',
        cross: '❌',
        info: 'ℹ️',
        warning: '⚠️'
      };
    } else {
      // ASCII fallbacks for Windows Command Prompt or limited terminals
      return {
        spinner: ['|', '/', '-', '\\'],
        progressFilled: '#',
        progressEmpty: '-',
        bullet: '*',
        checkmark: '[OK]',
        cross: '[X]',
        info: '[i]',
        warning: '[!]'
      };
    }
  }

  /**
   * Get appropriate console width for progress bars
   */
  static getProgressBarWidth(): number {
    const capabilities = this.getCapabilities();
    const maxWidth = Math.floor(capabilities.terminalWidth * 0.6); // 60% of terminal width
    return Math.max(20, Math.min(50, maxWidth)); // Between 20 and 50 chars
  }

  /**
   * Check if we can use advanced terminal features
   */
  static canUseAdvancedFeatures(): boolean {
    const capabilities = this.getCapabilities();
    return capabilities.hasFullAnsiSupport && capabilities.supportsColor;
  }

  /**
   * Get platform-specific newline character
   */
  static getNewline(): string {
    return this.getCapabilities().isWindows ? '\r\n' : '\n';
  }

  /**
   * Debug information for troubleshooting
   */
  static getDebugInfo(): Record<string, any> {
    const capabilities = this.getCapabilities();
    return {
      platform: platform(),
      nodeVersion: process.version,
      terminalWidth: capabilities.terminalWidth,
      supportsColor: capabilities.supportsColor,
      supportsUnicode: capabilities.supportsUnicode,
      isWindows: capabilities.isWindows,
      isPowerShell: capabilities.isPowerShell,
      hasFullAnsiSupport: capabilities.hasFullAnsiSupport,
      environment: {
        TERM: process.env.TERM,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
        WT_SESSION: process.env.WT_SESSION,
        PSModulePath: Boolean(process.env.PSModulePath),
        CI: process.env.CI
      }
    };
  }
}