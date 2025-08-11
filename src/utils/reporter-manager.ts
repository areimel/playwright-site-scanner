import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ReporterConfig, SessionSummary, PageResult, TestResult } from '../types/index.js';
import { HTMLReporter, HTMLReportData } from '../lib/html-reporter.js';

const execAsync = promisify(exec);

export class ReporterManager {
  private config: ReporterConfig;
  private sessionId: string;
  private reporters: HTMLReporter[] = [];

  constructor(config: ReporterConfig, sessionId: string) {
    this.config = config;
    this.sessionId = sessionId;
    
    if (this.config.enabled) {
      this.initializeReporters();
    }
  }

  private initializeReporters(): void {
    if (this.config.type === 'html') {
      const htmlReporter = new HTMLReporter(this.config, this.sessionId);
      this.reporters.push(htmlReporter);
    }
  }

  async generateReports(
    sessionSummary: SessionSummary,
    pageResults: PageResult[]
  ): Promise<{ success: boolean; reportPaths: string[]; errors: string[] }> {
    if (!this.config.enabled || this.reporters.length === 0) {
      return { success: true, reportPaths: [], errors: [] };
    }

    console.log(chalk.blue('\n📊 Generating HTML reports...'));

    const reportPaths: string[] = [];
    const errors: string[] = [];

    try {
      const reportData: HTMLReportData = {
        sessionSummary,
        pageResults,
        generatedAt: new Date().toISOString(),
        baseUrl: sessionSummary.url
      };

      // Generate reports from all configured reporters
      for (const reporter of this.reporters) {
        try {
          const reportPath = await reporter.generateReport(reportData);
          reportPaths.push(reportPath);
          console.log(chalk.green(`   ✅ HTML report generated: ${reportPath}`));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`HTML Reporter failed: ${errorMsg}`);
          console.error(chalk.red(`   ❌ HTML report generation failed: ${errorMsg}`));
        }
      }

      // Handle post-generation actions
      if (reportPaths.length > 0) {
        await this.handleReportOpening(reportPaths[0]);
      }

      return {
        success: errors.length === 0,
        reportPaths,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`   ❌ Report generation failed: ${errorMsg}`));
      return {
        success: false,
        reportPaths: [],
        errors: [errorMsg]
      };
    }
  }

  private async handleReportOpening(reportPath: string): Promise<void> {
    const shouldOpen = this.shouldOpenReport();
    
    if (shouldOpen) {
      try {
        await this.openReport(reportPath);
        console.log(chalk.blue(`   🌐 Opened report in browser: ${reportPath}`));
      } catch (error) {
        console.warn(chalk.yellow(`   ⚠️  Could not open report automatically: ${error}`));
        console.log(chalk.blue(`   📄 Report available at: ${reportPath}`));
      }
    } else {
      console.log(chalk.blue(`   📄 Report available at: ${reportPath}`));
    }
  }

  private shouldOpenReport(): boolean {
    switch (this.config.openBehavior) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'on-failure':
        // Would need access to test results to determine if there were failures
        // For now, default to not opening
        return false;
      default:
        return false;
    }
  }

  private async openReport(reportPath: string): Promise<void> {
    const absolutePath = path.resolve(reportPath);
    const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}`;

    let command: string;
    
    switch (process.platform) {
      case 'darwin': // macOS
        command = `open "${fileUrl}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${fileUrl}"`;
        break;
      case 'linux': // Linux
        command = `xdg-open "${fileUrl}"`;
        break;
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }

    await execAsync(command);
  }

  async getReportSummary(): Promise<{ enabled: boolean; type?: string; outputPath?: string }> {
    return {
      enabled: this.config.enabled,
      type: this.config.enabled ? this.config.type : undefined,
      outputPath: this.config.enabled ? this.config.outputPath : undefined
    };
  }

  static createDefaultConfig(): ReporterConfig {
    return {
      enabled: false,
      type: 'html',
      openBehavior: 'never',
      includeScreenshots: true,
      includeDetailedLogs: false
    };
  }

  static validateConfig(config: ReporterConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.enabled) {
      if (!config.type) {
        errors.push('Reporter type is required when reporter is enabled');
      }

      if (config.type !== 'html') {
        errors.push(`Unsupported reporter type: ${config.type}`);
      }

      if (!['always', 'never', 'on-failure'].includes(config.openBehavior)) {
        errors.push(`Invalid openBehavior: ${config.openBehavior}`);
      }

      if (config.outputPath) {
        // Validate output path format
        if (!path.isAbsolute(config.outputPath) && !config.outputPath.startsWith('./')) {
          errors.push('Output path must be absolute or relative (starting with ./)');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup any temporary files or resources
    // Currently no cleanup needed, but structure for future enhancements
  }

  // Utility method to check if reports were generated successfully
  async verifyReports(reportPaths: string[]): Promise<{ verified: boolean; details: string[] }> {
    const details: string[] = [];
    let allVerified = true;

    for (const reportPath of reportPaths) {
      try {
        const stats = await fs.stat(reportPath);
        if (stats.isFile() && stats.size > 0) {
          details.push(`✅ ${reportPath} (${Math.round(stats.size / 1024)}KB)`);
        } else {
          details.push(`❌ ${reportPath} (empty or invalid)`);
          allVerified = false;
        }
      } catch (error) {
        details.push(`❌ ${reportPath} (not found)`);
        allVerified = false;
      }
    }

    return {
      verified: allVerified,
      details
    };
  }

  // Enhanced version that considers test failures for 'on-failure' behavior
  updateOpenBehaviorBasedOnResults(sessionSummary: SessionSummary): void {
    if (this.config.openBehavior === 'on-failure' && sessionSummary.testsFailed > 0) {
      // Temporarily override to always open if there were failures
      this.config = { ...this.config, openBehavior: 'always' };
    }
  }

  // Get report metadata for display in session summary
  getReportMetadata(): { type: string; outputDir: string; features: string[] } {
    const outputDir = this.config.outputPath || 
      path.join('arda-site-scan-sessions', this.sessionId, 'html-report');
    
    const features: string[] = [];
    if (this.config.includeScreenshots) features.push('Screenshots');
    if (this.config.includeDetailedLogs) features.push('Detailed Logs');
    
    return {
      type: this.config.type,
      outputDir,
      features
    };
  }
}