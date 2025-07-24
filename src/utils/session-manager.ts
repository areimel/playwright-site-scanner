import { promises as fs } from 'fs';
import path from 'path';
import { SessionSummary, PageResult } from '../types/index.js';
import { sanitizePageName } from './validation.js';

export class SessionManager {
  private readonly outputDir = 'playwright-site-scanner-sessions';

  createSessionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${month}-${day}-${year}_${hours}-${minutes}`;
  }

  async createSessionDirectory(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.outputDir, sessionId);
    await fs.mkdir(sessionPath, { recursive: true });
  }

  async createPageDirectory(sessionId: string, pageName: string): Promise<string> {
    const pagePath = path.join(this.outputDir, sessionId, pageName);
    await fs.mkdir(pagePath, { recursive: true });
    
    // Create subdirectories for different test types
    await fs.mkdir(path.join(pagePath, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(pagePath, 'scans'), { recursive: true });
    
    return pagePath;
  }

  getPageName(url: string): string {
    return sanitizePageName(url);
  }

  getPagePath(sessionId: string, pageName: string): string {
    return path.join(this.outputDir, sessionId, pageName);
  }

  getScreenshotPath(sessionId: string, pageName: string, viewportName: string): string {
    return path.join(this.outputDir, sessionId, pageName, 'screenshots', `${pageName}-${viewportName}.png`);
  }

  getScanPath(sessionId: string, pageName: string, scanType: string): string {
    return path.join(this.outputDir, sessionId, pageName, 'scans', `${pageName}-${scanType}.md`);
  }

  async savePageSummary(sessionId: string, pageResult: PageResult): Promise<void> {
    const pagePath = await this.createPageDirectory(sessionId, pageResult.pageName);
    const summaryPath = path.join(pagePath, `${pageResult.pageName}-summary.md`);
    
    const summaryContent = this.generatePageSummaryMarkdown(pageResult);
    await fs.writeFile(summaryPath, summaryContent, 'utf8');
  }

  async generateSessionSummary(summary: SessionSummary, pageResults: PageResult[]): Promise<void> {
    const sessionPath = path.join(this.outputDir, summary.sessionId);
    const summaryPath = path.join(sessionPath, 'session-summary.md');
    
    const summaryContent = this.generateSessionSummaryMarkdown(summary, pageResults);
    await fs.writeFile(summaryPath, summaryContent, 'utf8');
  }

  private generatePageSummaryMarkdown(pageResult: PageResult): string {
    const successCount = pageResult.tests.filter(t => t.status === 'success').length;
    const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
    
    let markdown = `# Page Test Summary: ${pageResult.pageName}\n\n`;
    markdown += `**URL:** ${pageResult.url}\n`;
    markdown += `**Tests Completed:** ${pageResult.tests.length}\n`;
    markdown += `**Successful:** ${successCount}\n`;
    markdown += `**Failed:** ${failCount}\n\n`;
    
    markdown += `## Test Results\n\n`;
    
    for (const test of pageResult.tests) {
      const status = test.status === 'success' ? '✅' : '❌';
      const duration = test.endTime && test.startTime 
        ? Math.round((test.endTime.getTime() - test.startTime.getTime()) / 1000)
        : 0;
      
      markdown += `### ${status} ${test.testType}\n`;
      markdown += `- **Status:** ${test.status}\n`;
      markdown += `- **Duration:** ${duration}s\n`;
      
      if (test.outputPath) {
        markdown += `- **Output:** [${path.basename(test.outputPath)}](${test.outputPath})\n`;
      }
      
      if (test.error) {
        markdown += `- **Error:** ${test.error}\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  private generateSessionSummaryMarkdown(summary: SessionSummary, pageResults: PageResult[]): string {
    const duration = summary.endTime 
      ? Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)
      : 0;
    
    let markdown = `# Test Session Summary\n\n`;
    markdown += `**Session ID:** ${summary.sessionId}\n`;
    markdown += `**URL:** ${summary.url}\n`;
    markdown += `**Start Time:** ${summary.startTime.toISOString()}\n`;
    markdown += `**End Time:** ${summary.endTime?.toISOString() || 'N/A'}\n`;
    markdown += `**Duration:** ${duration}s\n\n`;
    
    markdown += `## Overview\n\n`;
    markdown += `- **Pages Tested:** ${summary.totalPages}\n`;
    markdown += `- **Total Tests:** ${summary.testsRun}\n`;
    markdown += `- **Successful Tests:** ${summary.testsSucceeded}\n`;
    markdown += `- **Failed Tests:** ${summary.testsFailed}\n`;
    markdown += `- **Success Rate:** ${summary.testsRun > 0 ? Math.round((summary.testsSucceeded / summary.testsRun) * 100) : 0}%\n\n`;
    
    if (summary.errors.length > 0) {
      markdown += `## Errors\n\n`;
      for (const error of summary.errors) {
        markdown += `- ${error}\n`;
      }
      markdown += '\n';
    }
    
    markdown += `## Page Results\n\n`;
    for (const pageResult of pageResults) {
      const successCount = pageResult.tests.filter(t => t.status === 'success').length;
      const failCount = pageResult.tests.filter(t => t.status === 'failed').length;
      const status = failCount === 0 ? '✅' : '❌';
      
      markdown += `### ${status} ${pageResult.pageName}\n`;
      markdown += `- **URL:** ${pageResult.url}\n`;
      markdown += `- **Tests:** ${pageResult.tests.length} (${successCount} passed, ${failCount} failed)\n`;
      markdown += `- **Details:** [${pageResult.pageName}-summary.md](${pageResult.pageName}/${pageResult.pageName}-summary.md)\n\n`;
    }
    
    return markdown;
  }
}