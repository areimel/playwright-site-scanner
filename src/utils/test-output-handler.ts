import path from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import {
  TestOutputHandler,
  OutputConfiguration,
  OutputResult,
  OutputContext,
  OUTPUT_CONFIGURATIONS,
  OutputTypeUtils
} from '../types/test-output-types.js';
import { TestResult } from '../types/index.js';

/**
 * Centralized handler for all test output operations
 * Implements DRY principles and standardized file management
 */
export class StandardTestOutputHandler implements TestOutputHandler {
  private outputDir: string;

  constructor(outputDir: string = 'playwright-site-scanner-sessions') {
    this.outputDir = outputDir;
  }

  /**
   * Generate the appropriate output path for a test
   */
  generateOutputPath(
    sessionId: string, 
    testType: string, 
    config: OutputConfiguration, 
    context: OutputContext
  ): string {
    const baseDir = path.join(this.outputDir, sessionId);
    
    // Generate filename from pattern
    const filename = this.generateFilename(testType, config, context);
    
    if (config.type === 'per-page') {
      if (!context.pageName) {
        throw new Error(`Page name is required for per-page test output: ${testType}`);
      }
      
      // Per-page tests go in page-specific subdirectories
      const pagePath = path.join(baseDir, context.pageName);
      
      if (config.subdirectory) {
        return path.join(pagePath, config.subdirectory, filename);
      }
      
      return path.join(pagePath, filename);
    } else {
      // Site-wide tests go in session root
      if (config.subdirectory) {
        return path.join(baseDir, config.subdirectory, filename);
      }
      
      return path.join(baseDir, filename);
    }
  }

  /**
   * Save content to the appropriate location
   */
  async saveOutput(
    content: string | Buffer, 
    outputPath: string, 
    config: OutputConfiguration
  ): Promise<OutputResult> {
    try {
      // Ensure directory exists
      await this.ensureOutputDirectory(outputPath);
      
      // Write file
      await fs.writeFile(outputPath, content, 'utf8');
      
      // Get file stats
      const stats = await fs.stat(outputPath);
      
      console.log(chalk.green(`        📄 ${config.type === 'per-page' ? 'Page' : 'Site'} output saved: ${outputPath}`));
      
      return {
        success: true,
        outputPath,
        fileSize: stats.size,
        metadata: {
          type: config.type,
          extension: config.fileExtension,
          mimeType: config.mimeType
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`        ❌ Failed to save output: ${errorMessage}`));
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Ensure the necessary directories exist for the output
   */
  async ensureOutputDirectory(outputPath: string): Promise<void> {
    const dirPath = path.dirname(outputPath);
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Get relative path for use in reports and links
   */
  getRelativePath(outputPath: string, basePath: string): string {
    return path.relative(basePath, outputPath);
  }

  /**
   * Generate standardized filename from pattern and context
   */
  private generateFilename(
    testType: string, 
    config: OutputConfiguration, 
    context: OutputContext
  ): string {
    const pattern = config.filenamePattern || testType;
    
    let filename = OutputTypeUtils.replacePlaceholders(pattern, {
      pageName: context.pageName,
      testType: testType,
      viewport: context.viewport,
      ...context.additionalData
    });
    
    // Ensure filename is safe for filesystem
    filename = this.sanitizeFilename(filename);
    
    return `${filename}.${config.fileExtension}`;
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .toLowerCase();
  }

  /**
   * Create a standardized test result with output information
   */
  static createTestResult(
    testType: string,
    status: 'success' | 'failed' | 'pending',
    outputResult?: OutputResult,
    error?: string
  ): TestResult {
    const config = OUTPUT_CONFIGURATIONS[testType];
    
    return {
      testType,
      status,
      startTime: new Date(),
      endTime: status !== 'pending' ? new Date() : undefined,
      outputPath: outputResult?.outputPath,
      outputType: config?.type,
      error
    };
  }

  /**
   * Update an existing test result with completion information
   */
  static completeTestResult(
    testResult: TestResult,
    status: 'success' | 'failed',
    outputResult?: OutputResult,
    error?: string
  ): TestResult {
    return {
      ...testResult,
      status,
      endTime: new Date(),
      outputPath: outputResult?.outputPath,
      error
    };
  }

  /**
   * Get page name from URL (utility method)
   */
  static getPageNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length === 0) {
        return 'home';
      }
      
      return pathSegments.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    } catch (error) {
      return 'unknown-page';
    }
  }

  /**
   * Filter test results by output type
   */
  static filterResultsByOutputType(
    results: TestResult[], 
    outputType: 'per-page' | 'site-wide'
  ): TestResult[] {
    return results.filter(result => {
      const config = OUTPUT_CONFIGURATIONS[result.testType];
      return config?.type === outputType;
    });
  }

  /**
   * Group per-page results by page
   */
  static groupPerPageResultsByPage(results: TestResult[]): Map<string, TestResult[]> {
    const perPageResults = this.filterResultsByOutputType(results, 'per-page');
    const groupedResults = new Map<string, TestResult[]>();

    for (const result of perPageResults) {
      if (!result.outputPath) continue;
      
      // Extract page name from output path
      const pathParts = result.outputPath.split(path.sep);
      const sessionIndex = pathParts.findIndex(part => part.match(/^\d{2}-\d{2}-\d{4}_\d{2}-\d{2}$/));
      
      if (sessionIndex >= 0 && pathParts.length > sessionIndex + 1) {
        const pageName = pathParts[sessionIndex + 1];
        
        if (!groupedResults.has(pageName)) {
          groupedResults.set(pageName, []);
        }
        
        groupedResults.get(pageName)!.push(result);
      }
    }

    return groupedResults;
  }

  /**
   * Validate output configuration and provide helpful error messages
   */
  static validateConfiguration(testType: string): { valid: boolean; errors: string[] } {
    const config = OUTPUT_CONFIGURATIONS[testType];
    
    if (!config) {
      return {
        valid: false,
        errors: [`No output configuration found for test type: ${testType}`]
      };
    }
    
    return OutputTypeUtils.validateOutputConfig(config);
  }
}