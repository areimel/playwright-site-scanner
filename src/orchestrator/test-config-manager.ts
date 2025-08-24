import { TestConfig, TestType } from '../types/index.js';
import { TestPhaseManager, ExecutionStrategy, TEST_CLASSIFICATIONS } from '../types/test-phases.js';

/**
 * TestConfigManager handles all test configuration processing and validation
 * Provides stateless utilities for configuration operations
 */
export class TestConfigManager {
  /**
   * Maps test IDs to display names (exact copy from original getTestName method)
   */
  static getTestName(testId: string): string {
    const testNames: Record<string, string> = {
      'site-crawling': 'Site Crawling',
      'sitemap': 'Sitemap Generation',
      'content-scraping': 'Content Scraping',
      'screenshots': 'Screenshots',
      'seo': 'SEO Scan',
      'accessibility': 'Accessibility Scan',
      'site-summary': 'Site Summary',
      'api-key-scan': 'API Key Security Scan'
    };
    
    return testNames[testId] || testId;
  }

  /**
   * Gets test description from test classifications
   */
  static getTestDescription(testId: string): string {
    const testDescriptions: Record<string, string> = {
      'site-crawling': 'Discovers all pages on the website by crawling internal links',
      'sitemap': 'Generates XML sitemap for search engine submission',
      'content-scraping': 'Extracts page content and images to markdown files',
      'screenshots': 'Captures screenshots across different viewports (desktop, tablet, mobile)',
      'seo': 'Analyzes SEO elements including meta tags, headings, and structured data',
      'accessibility': 'Checks for accessibility issues and WCAG compliance using axe-core',
      'site-summary': 'Generates comprehensive site overview report using scraped content',
      'api-key-scan': 'Scans site for exposed API keys and security tokens'
    };
    
    return testDescriptions[testId] || 'No description available';
  }

  /**
   * Validates test configuration and returns validation results
   */
  static validateConfig(config: TestConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate URL
    if (!config.url || typeof config.url !== 'string') {
      errors.push('URL is required and must be a string');
    } else {
      try {
        new URL(config.url);
      } catch (error) {
        errors.push('URL must be a valid URL format');
      }
    }

    // Validate crawlSite
    if (typeof config.crawlSite !== 'boolean') {
      errors.push('crawlSite must be a boolean');
    }

    // Validate selectedTests
    if (!Array.isArray(config.selectedTests)) {
      errors.push('selectedTests must be an array');
    } else {
      config.selectedTests.forEach((test, index) => {
        if (!test.id || typeof test.id !== 'string') {
          errors.push(`selectedTests[${index}].id is required and must be a string`);
        }
        if (!test.name || typeof test.name !== 'string') {
          errors.push(`selectedTests[${index}].name is required and must be a string`);
        }
        if (typeof test.enabled !== 'boolean') {
          errors.push(`selectedTests[${index}].enabled must be a boolean`);
        }
      });
    }

    // Validate viewports
    if (!Array.isArray(config.viewports)) {
      errors.push('viewports must be an array');
    } else if (config.viewports.length === 0) {
      errors.push('At least one viewport must be configured');
    } else {
      config.viewports.forEach((viewport, index) => {
        if (!viewport.name || typeof viewport.name !== 'string') {
          errors.push(`viewports[${index}].name is required and must be a string`);
        }
        if (typeof viewport.width !== 'number' || viewport.width <= 0) {
          errors.push(`viewports[${index}].width must be a positive number`);
        }
        if (typeof viewport.height !== 'number' || viewport.height <= 0) {
          errors.push(`viewports[${index}].height must be a positive number`);
        }
      });
    }

    // Validate reporter config if present
    if (config.reporter) {
      if (typeof config.reporter.enabled !== 'boolean') {
        errors.push('reporter.enabled must be a boolean');
      }
      if (config.reporter.type !== 'html') {
        errors.push('reporter.type must be "html"');
      }
      if (config.reporter.openBehavior && 
          !['always', 'never', 'on-failure'].includes(config.reporter.openBehavior)) {
        errors.push('reporter.openBehavior must be "always", "never", or "on-failure"');
      }
      if (typeof config.reporter.includeScreenshots !== 'boolean') {
        errors.push('reporter.includeScreenshots must be a boolean');
      }
      if (typeof config.reporter.includeDetailedLogs !== 'boolean') {
        errors.push('reporter.includeDetailedLogs must be a boolean');
      }
    }

    // Validate test dependencies
    const enabledTestIds = this.getEnabledTestIds(config);
    
    // If crawlSite is true, add 'site-crawling' to the enabled test IDs for dependency validation
    const validationTestIds = config.crawlSite 
      ? [...enabledTestIds, 'site-crawling'] 
      : enabledTestIds;
      
    const dependencyValidation = TestPhaseManager.validateDependencies(validationTestIds);
    if (!dependencyValidation.valid) {
      errors.push(`Missing dependencies: ${dependencyValidation.missingDependencies.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Creates execution strategy from test configuration
   */
  static processExecutionStrategy(config: TestConfig): ExecutionStrategy {
    return TestPhaseManager.organizeTestsIntoPhases(config);
  }

  /**
   * Extracts enabled test IDs from configuration
   */
  static getEnabledTestIds(config: TestConfig): string[] {
    return config.selectedTests
      .filter(test => test.enabled)
      .map(test => test.id);
  }

  /**
   * Checks if any tests are enabled in the configuration
   */
  static hasEnabledTests(config: TestConfig): boolean {
    return config.selectedTests.some(test => test.enabled);
  }

  /**
   * Formats configuration summary for display
   */
  static formatConfigSummary(config: TestConfig): string {
    const enabledTests = this.getEnabledTestIds(config);
    const enabledTestNames = enabledTests.map(id => this.getTestName(id));
    
    let summary = `Configuration Summary:\n`;
    summary += `• URL: ${config.url}\n`;
    summary += `• Crawl Site: ${config.crawlSite ? 'Yes' : 'No'}\n`;
    summary += `• Viewports: ${config.viewports.map(v => `${v.name} (${v.width}x${v.height})`).join(', ')}\n`;
    summary += `• Enabled Tests (${enabledTests.length}): ${enabledTestNames.join(', ')}\n`;
    
    if (config.reporter?.enabled) {
      summary += `• Reporter: HTML (${config.reporter.openBehavior})\n`;
    }
    
    return summary;
  }

  /**
   * Gets all available test IDs from classifications
   */
  static getAllAvailableTestIds(): string[] {
    return Object.keys(TEST_CLASSIFICATIONS);
  }

  /**
   * Gets tests by phase
   */
  static getTestsByPhase(phase: 1 | 2 | 3): string[] {
    return Object.entries(TEST_CLASSIFICATIONS)
      .filter(([, classification]) => classification.phase === phase)
      .map(([testId]) => testId);
  }

  /**
   * Gets test classification information
   */
  static getTestClassification(testId: string) {
    return TEST_CLASSIFICATIONS[testId] || null;
  }

  /**
   * Checks if a test requires site crawling
   */
  static testRequiresCrawling(testId: string): boolean {
    const classification = TEST_CLASSIFICATIONS[testId];
    if (!classification) return false;
    
    return classification.dependencies.includes('site-crawling') || 
           classification.scope === 'session';
  }

  /**
   * Gets resource-intensive tests from configuration
   */
  static getResourceIntensiveTests(config: TestConfig): string[] {
    const enabledTestIds = this.getEnabledTestIds(config);
    return enabledTestIds.filter(testId => {
      const classification = TEST_CLASSIFICATIONS[testId];
      return classification?.resourceIntensive || false;
    });
  }

  /**
   * Estimates total test count based on configuration
   */
  static estimateTestCount(config: TestConfig): number {
    const enabledTestIds = this.getEnabledTestIds(config);
    let totalTests = 0;
    
    // Count session-level tests (run once)
    const sessionTests = enabledTestIds.filter(testId => {
      const classification = TEST_CLASSIFICATIONS[testId];
      return classification?.scope === 'session';
    });
    totalTests += sessionTests.length;
    
    // Count page-level tests (multiply by estimated pages)
    const pageTests = enabledTestIds.filter(testId => {
      const classification = TEST_CLASSIFICATIONS[testId];
      return classification?.scope === 'page';
    });
    
    // Screenshot tests count as multiple (one per viewport)
    let pageTestMultiplier = 1;
    if (pageTests.includes('screenshots')) {
      pageTestMultiplier = config.viewports.length;
      // Remove screenshots from count since we're handling it specially
      const screenshotIndex = pageTests.indexOf('screenshots');
      pageTests.splice(screenshotIndex, 1);
    }
    
    const estimatedPages = config.crawlSite ? 10 : 1; // Rough estimate
    totalTests += (pageTests.length * estimatedPages) + 
                  (pageTests.includes('screenshots') ? 0 : config.viewports.length * estimatedPages);
    
    return totalTests;
  }

  /**
   * Creates a default test configuration
   */
  static createDefaultConfig(url: string): TestConfig {
    const defaultTests: TestType[] = [
      { id: 'screenshots', name: 'Screenshots', description: 'Capture screenshots across viewports', enabled: true },
      { id: 'seo', name: 'SEO Scan', description: 'Analyze SEO elements', enabled: true },
      { id: 'accessibility', name: 'Accessibility Scan', description: 'Check WCAG compliance', enabled: false },
      { id: 'sitemap', name: 'Sitemap Generation', description: 'Generate XML sitemap', enabled: false },
      { id: 'content-scraping', name: 'Content Scraping', description: 'Extract page content', enabled: false },
      { id: 'site-summary', name: 'Site Summary', description: 'Generate site overview', enabled: false },
      { id: 'api-key-scan', name: 'API Key Security Scan', description: 'Scan for exposed API keys', enabled: false }
    ];

    return {
      url,
      crawlSite: true,
      selectedTests: defaultTests,
      viewports: [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 375, height: 667 }
      ],
      reporter: {
        enabled: true,
        type: 'html',
        openBehavior: 'on-failure',
        includeScreenshots: true,
        includeDetailedLogs: false
      }
    };
  }

  /**
   * Merges partial configuration with defaults
   */
  static mergeWithDefaults(partialConfig: Partial<TestConfig>, baseUrl: string): TestConfig {
    const defaultConfig = this.createDefaultConfig(baseUrl);
    
    return {
      url: partialConfig.url || defaultConfig.url,
      crawlSite: partialConfig.crawlSite ?? defaultConfig.crawlSite,
      selectedTests: partialConfig.selectedTests || defaultConfig.selectedTests,
      viewports: partialConfig.viewports || defaultConfig.viewports,
      reporter: partialConfig.reporter ? 
        { ...defaultConfig.reporter, ...partialConfig.reporter } : 
        defaultConfig.reporter
    };
  }
}