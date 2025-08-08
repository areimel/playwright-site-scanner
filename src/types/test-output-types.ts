/**
 * Test Output Type System
 * 
 * Defines standardized output behavior for all test types, ensuring consistent
 * file generation and result handling across the application.
 */

export type TestOutputType = 'per-page' | 'site-wide';

/**
 * Configuration for how a test should handle output generation
 */
export interface OutputConfiguration {
  /** Type of output this test generates */
  type: TestOutputType;
  
  /** File extension for output files (without dot) */
  fileExtension: string;
  
  /** Subdirectory within page/session directory for organizing files */
  subdirectory?: string;
  
  /** Custom filename pattern (use {pageName}, {sessionId}, {testType} placeholders) */
  filenamePattern?: string;
  
  /** Whether this output should be included in HTML reports */
  includeInReports: boolean;
  
  /** MIME type for the output file */
  mimeType?: string;
}

/**
 * Result of an output operation
 */
export interface OutputResult {
  /** Whether the output operation was successful */
  success: boolean;
  
  /** Full path to the generated output file */
  outputPath?: string;
  
  /** Error message if operation failed */
  error?: string;
  
  /** Size of generated file in bytes */
  fileSize?: number;
  
  /** Additional metadata about the output */
  metadata?: Record<string, any>;
}

/**
 * Interface for handling test output operations
 */
export interface TestOutputHandler {
  /**
   * Generate the appropriate output path for a test
   */
  generateOutputPath(
    sessionId: string, 
    testType: string, 
    config: OutputConfiguration, 
    context: OutputContext
  ): string;
  
  /**
   * Save content to the appropriate location
   */
  saveOutput(
    content: string | Buffer, 
    outputPath: string, 
    config: OutputConfiguration
  ): Promise<OutputResult>;
  
  /**
   * Ensure the necessary directories exist for the output
   */
  ensureOutputDirectory(outputPath: string): Promise<void>;
  
  /**
   * Get relative path for use in reports and links
   */
  getRelativePath(outputPath: string, basePath: string): string;
}

/**
 * Context information for generating output paths and filenames
 */
export interface OutputContext {
  /** URL being tested (for per-page tests) */
  url?: string;
  
  /** Page name derived from URL */
  pageName?: string;
  
  /** Viewport name (for screenshot tests) */
  viewport?: string;
  
  /** Additional context data specific to the test */
  additionalData?: Record<string, any>;
}

/**
 * Predefined output configurations for common test types
 */
export const OUTPUT_CONFIGURATIONS: Record<string, OutputConfiguration> = {
  'screenshots': {
    type: 'per-page',
    fileExtension: 'png',
    subdirectory: 'screenshots',
    filenamePattern: '{pageName}-{viewport}',
    includeInReports: true,
    mimeType: 'image/png'
  },
  
  'seo': {
    type: 'per-page',
    fileExtension: 'md',
    subdirectory: 'scans',
    filenamePattern: '{pageName}-seo-scan',
    includeInReports: true,
    mimeType: 'text/markdown'
  },
  
  'accessibility': {
    type: 'per-page',
    fileExtension: 'md',
    subdirectory: 'scans',
    filenamePattern: '{pageName}-accessibility-scan',
    includeInReports: true,
    mimeType: 'text/markdown'
  },
  
  'content-scraping': {
    type: 'per-page',
    fileExtension: 'md',
    subdirectory: 'content',
    filenamePattern: '{pageName}-content',
    includeInReports: true,
    mimeType: 'text/markdown'
  },
  
  'sitemap': {
    type: 'site-wide',
    fileExtension: 'xml',
    filenamePattern: 'sitemap',
    includeInReports: true,
    mimeType: 'application/xml'
  },
  
  'site-summary': {
    type: 'site-wide',
    fileExtension: 'md',
    filenamePattern: 'site-summary',
    includeInReports: true,
    mimeType: 'text/markdown'
  },
  
  'api-key-scan': {
    type: 'site-wide',
    fileExtension: 'md',
    filenamePattern: 'api-key-security-report',
    includeInReports: true,
    mimeType: 'text/markdown'
  }
};

/**
 * Utility functions for working with output types
 */
export class OutputTypeUtils {
  /**
   * Check if a test type generates per-page output
   */
  static isPerPageTest(testType: string): boolean {
    const config = OUTPUT_CONFIGURATIONS[testType];
    return config?.type === 'per-page';
  }
  
  /**
   * Check if a test type generates site-wide output
   */
  static isSiteWideTest(testType: string): boolean {
    const config = OUTPUT_CONFIGURATIONS[testType];
    return config?.type === 'site-wide';
  }
  
  /**
   * Get the output configuration for a test type
   */
  static getOutputConfig(testType: string): OutputConfiguration | undefined {
    return OUTPUT_CONFIGURATIONS[testType];
  }
  
  /**
   * Replace placeholders in filename patterns
   */
  static replacePlaceholders(
    pattern: string, 
    context: { 
      pageName?: string; 
      sessionId?: string; 
      testType?: string; 
      viewport?: string;
      [key: string]: any;
    }
  ): string {
    return pattern
      .replace(/{pageName}/g, context.pageName || 'unknown-page')
      .replace(/{sessionId}/g, context.sessionId || 'unknown-session')
      .replace(/{testType}/g, context.testType || 'unknown-test')
      .replace(/{viewport}/g, context.viewport || '');
  }
  
  /**
   * Validate that an output configuration is properly formed
   */
  static validateOutputConfig(config: OutputConfiguration): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.type || !['per-page', 'site-wide'].includes(config.type)) {
      errors.push('Invalid or missing output type');
    }
    
    if (!config.fileExtension || config.fileExtension.trim().length === 0) {
      errors.push('File extension is required');
    }
    
    if (config.fileExtension.includes('.')) {
      errors.push('File extension should not include the dot');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}