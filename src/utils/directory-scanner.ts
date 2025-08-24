import { promises as fs } from 'fs';
import path from 'path';
import { PageResult, TestResult } from '../types/index.js';

/**
 * DirectoryScanner - Simple, reliable file discovery by reading actual directory structure
 * 
 * This replaces complex filtering logic with direct filesystem scanning.
 * If a file exists in a session directory, it belongs to that session - period.
 */
export class DirectoryScanner {
  private readonly outputDir = 'arda-site-scan-sessions';

  /**
   * Scan a session directory and build PageResult[] from actual files found
   * 
   * Directory structure:
   * arda-site-scan-sessions/{sessionId}/
   * ├── {pageName}/
   * │   ├── screenshots/
   * │   ├── scans/
   * │   └── content/
   * ├── sitemap.xml
   * └── site-summary.md
   */
  async scanSession(sessionId: string): Promise<PageResult[]> {
    const sessionPath = path.join(this.outputDir, sessionId);
    
    try {
      const entries = await fs.readdir(sessionPath, { withFileTypes: true });
      const pageResults: PageResult[] = [];

      // Find all page directories (ignore files like sitemap.xml, site-summary.md)
      const pageDirs = entries.filter(entry => entry.isDirectory());

      for (const pageDir of pageDirs) {
        const pageName = pageDir.name;
        const pageResult = await this.scanPageDirectory(sessionId, pageName);
        pageResults.push(pageResult);
      }

      // Add site-wide files to first page result (if any pages exist)
      if (pageResults.length > 0) {
        const siteWideTests = await this.scanSiteWideFiles(sessionId);
        if (siteWideTests.length > 0) {
          pageResults[0].tests.push(...siteWideTests);
        }
      }

      return pageResults;
    } catch (error) {
      console.error(`Failed to scan session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Scan a specific page directory for test results
   */
  private async scanPageDirectory(sessionId: string, pageName: string): Promise<PageResult> {
    const pageDir = path.join(this.outputDir, sessionId, pageName);
    const tests: TestResult[] = [];

    try {
      // Scan each test type subdirectory
      const testTypes = ['screenshots', 'scans', 'content'];
      
      for (const testType of testTypes) {
        const testDir = path.join(pageDir, testType);
        
        try {
          const files = await fs.readdir(testDir);
          
          for (const file of files) {
            const filePath = path.join(testDir, file);
            const testResult = this.createTestResultFromFile(filePath, testType, file);
            tests.push(testResult);
          }
        } catch (error) {
          // Directory might not exist - that's fine, just skip it
        }
      }

      // Reconstruct URL from page name (basic reconstruction - could be improved)
      const url = this.reconstructUrlFromPageName(pageName);

      return {
        url,
        pageName,
        tests,
        summary: `Page: ${pageName} | Tests: ${tests.length}`
      };
    } catch (error) {
      console.error(`Failed to scan page directory ${pageName}:`, error);
      return {
        url: 'unknown',
        pageName,
        tests: [],
        summary: `Error scanning page: ${pageName}`
      };
    }
  }

  /**
   * Scan for site-wide files (sitemap.xml, site-summary.md, etc.)
   */
  private async scanSiteWideFiles(sessionId: string): Promise<TestResult[]> {
    const sessionDir = path.join(this.outputDir, sessionId);
    const tests: TestResult[] = [];

    try {
      const entries = await fs.readdir(sessionDir, { withFileTypes: true });
      const files = entries.filter(entry => entry.isFile());

      for (const file of files) {
        const filePath = path.join(sessionDir, file.name);
        const testType = this.getTestTypeFromFileName(file.name);
        const testResult = this.createTestResultFromFile(filePath, testType, file.name);
        tests.push(testResult);
      }
    } catch (error) {
      console.error(`Failed to scan site-wide files for session ${sessionId}:`, error);
    }

    return tests;
  }

  /**
   * Create TestResult from file path and metadata
   */
  private createTestResultFromFile(filePath: string, testType: string, fileName: string): TestResult {
    return {
      testType,
      status: 'success', // If file exists, test succeeded
      startTime: new Date(), // We don't have this info, use current time
      endTime: new Date(),
      outputPath: filePath
    };
  }

  /**
   * Determine test type from file name
   */
  private getTestTypeFromFileName(fileName: string): string {
    if (fileName.endsWith('.xml')) return 'sitemap';
    if (fileName.includes('site-summary')) return 'site-summary';
    if (fileName.includes('api-key')) return 'api-key-scan';
    if (fileName.includes('seo')) return 'seo';
    if (fileName.includes('accessibility')) return 'accessibility';
    if (fileName.includes('content')) return 'content-scraping';
    if (fileName.endsWith('.png')) return 'screenshots';
    
    return 'unknown';
  }

  /**
   * Basic URL reconstruction from page name
   * This is a simple approach - could be improved with stored metadata
   */
  private reconstructUrlFromPageName(pageName: string): string {
    if (pageName === 'home') return '/';
    
    // Convert page name back to URL path
    // projects-project-a -> /projects/project-a
    const parts = pageName.split('-');
    return '/' + parts.join('/');
  }

  /**
   * Check if a session directory exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const sessionPath = path.join(this.outputDir, sessionId);
    
    try {
      const stats = await fs.stat(sessionPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * List all available sessions
   */
  async listSessions(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.outputDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => b.localeCompare(a)); // Most recent first
    } catch {
      return [];
    }
  }
}