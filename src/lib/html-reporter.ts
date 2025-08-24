import fs from 'fs/promises';
import path from 'path';
import { TestResult, PageResult, SessionSummary, ReporterConfig } from '../types/index.js';

export interface HTMLReportData {
  sessionSummary: SessionSummary;
  pageResults: PageResult[];
  generatedAt: string;
  baseUrl: string;
}

export class HTMLReporter {
  private config: ReporterConfig;
  private outputDir: string;

  constructor(config: ReporterConfig, sessionId: string) {
    this.config = config;
    // Default output path within session directory
    this.outputDir = config.outputPath || path.join('arda-site-scan-sessions', sessionId, 'html-report');
  }

  async generateReport(data: HTMLReportData): Promise<string> {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });

    // Generate main HTML report
    const reportPath = await this.generateMainReport(data);

    // Generate assets (CSS, JS)
    await this.generateAssets();

    // Copy screenshots if enabled
    if (this.config.includeScreenshots) {
      await this.copyScreenshots(data);
    }

    return reportPath;
  }

  private async generateMainReport(data: HTMLReportData): Promise<string> {
    const html = this.generateHTMLContent(data);
    const reportPath = path.join(this.outputDir, 'index.html');
    
    await fs.writeFile(reportPath, html, 'utf8');
    return reportPath;
  }

  private generateHTMLContent(data: HTMLReportData): string {
    const { sessionSummary, pageResults } = data;
    const duration = sessionSummary.endTime 
      ? Math.round((sessionSummary.endTime.getTime() - sessionSummary.startTime.getTime()) / 1000)
      : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Site Scanner Report</title>
    <link rel="stylesheet" href="assets/report.css">
</head>
<body>
    <div class="report-container">
        <header class="report-header">
            <h1>🎭 Playwright Site Scanner Report</h1>
            <div class="report-meta">
                <span class="meta-item">📅 ${data.generatedAt}</span>
                <span class="meta-item">🌐 ${sessionSummary.url}</span>
                <span class="meta-item">⏱️ ${duration}s</span>
            </div>
        </header>

        <div class="summary-section">
            <div class="summary-card">
                <h2>Test Summary</h2>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value">${sessionSummary.totalPages}</span>
                        <span class="stat-label">Pages Tested</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${sessionSummary.testsRun}</span>
                        <span class="stat-label">Total Tests</span>
                    </div>
                    <div class="stat-item success">
                        <span class="stat-value">${sessionSummary.testsSucceeded}</span>
                        <span class="stat-label">Passed</span>
                    </div>
                    <div class="stat-item ${sessionSummary.testsFailed > 0 ? 'failed' : 'success'}">
                        <span class="stat-value">${sessionSummary.testsFailed}</span>
                        <span class="stat-label">Failed</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="results-section">
            <h2>Test Results by Page</h2>
            ${this.generatePageResults(pageResults)}
        </div>

        ${sessionSummary.errors.length > 0 ? this.generateErrorSection(sessionSummary.errors) : ''}
    </div>

    <script src="assets/report.js"></script>
</body>
</html>`;
  }

  private generatePageResults(pageResults: PageResult[]): string {
    return pageResults.map(page => {
      const totalTests = page.tests.length;
      const passedTests = page.tests.filter(t => t.status === 'success').length;
      const failedTests = page.tests.filter(t => t.status === 'failed').length;
      const pendingTests = page.tests.filter(t => t.status === 'pending').length;

      return `
        <div class="page-result">
            <div class="page-header" onclick="togglePageDetails('${page.pageName}')">
                <h3>${page.pageName}</h3>
                <div class="page-url">${page.url}</div>
                <div class="test-badges">
                    ${passedTests > 0 ? `<span class="badge success">${passedTests} passed</span>` : ''}
                    ${failedTests > 0 ? `<span class="badge failed">${failedTests} failed</span>` : ''}
                    ${pendingTests > 0 ? `<span class="badge pending">${pendingTests} pending</span>` : ''}
                </div>
            </div>
            <div class="page-details" id="details-${page.pageName}" style="display: none;">
                ${this.generateTestDetails(page.tests, page.pageName)}
            </div>
        </div>`;
    }).join('');
  }

  private generateTestDetails(tests: TestResult[], pageName: string): string {
    return tests.map(test => {
      const duration = test.endTime && test.startTime 
        ? Math.round((test.endTime.getTime() - test.startTime.getTime())) 
        : 0;

      return `
        <div class="test-result ${test.status}">
            <div class="test-header">
                <span class="test-name">${this.formatTestName(test.testType)}</span>
                <span class="test-status ${test.status}">${test.status}</span>
                <span class="test-duration">${duration}ms</span>
            </div>
            ${test.error ? `<div class="test-error">${test.error}</div>` : ''}
            ${test.outputPath ? `<div class="test-output">
                <a href="${this.getRelativeOutputPath(test.outputPath)}" target="_blank">View Output</a>
            </div>` : ''}
            ${this.generateTestAttachments(test, pageName)}
        </div>`;
    }).join('');
  }

  private generateTestAttachments(test: TestResult, pageName: string): string {
    if (!this.config.includeScreenshots) return '';

    // Generate screenshot attachments for screenshot tests
    if (test.testType.includes('screenshots')) {
      const screenshotTypes = ['desktop', 'tablet', 'mobile'];
      const attachments = screenshotTypes.map(type => {
        const screenshotPath = `screenshots/${pageName}-${type}.png`;
        return `<div class="attachment">
          <span class="attachment-type">📸 Screenshot (${type})</span>
          <img src="${screenshotPath}" alt="${pageName} ${type} screenshot" class="screenshot-preview" />
        </div>`;
      }).join('');
      
      return `<div class="test-attachments">${attachments}</div>`;
    }

    return '';
  }

  private generateErrorSection(errors: string[]): string {
    return `
      <div class="errors-section">
        <h2>Session Errors</h2>
        <div class="error-list">
          ${errors.map(error => `<div class="error-item">${error}</div>`).join('')}
        </div>
      </div>`;
  }

  private formatTestName(testType: string): string {
    const testNames: Record<string, string> = {
      'screenshots': '📸 Screenshots',
      'seo': '🔍 SEO Scan',
      'accessibility': '♿ Accessibility Scan',
      'sitemap': '🗺️ Sitemap Generation',
      'content-scraping': '📄 Content Scraping',
      'site-summary': '📊 Site Summary'
    };
    
    return testNames[testType] || testType;
  }

  private getRelativeOutputPath(outputPath: string): string {
    // Convert absolute path to relative path for HTML report
    const relativePath = path.relative(this.outputDir, outputPath);
    return relativePath.replace(/\\/g, '/'); // Normalize path separators for web
  }

  private async generateAssets(): Promise<void> {
    const assetsDir = path.join(this.outputDir, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    // Generate CSS
    await fs.writeFile(path.join(assetsDir, 'report.css'), this.generateCSS());
    
    // Generate JavaScript
    await fs.writeFile(path.join(assetsDir, 'report.js'), this.generateJS());
  }

  private generateCSS(): string {
    return `
/* Playwright Site Scanner Report Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
}

.report-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.report-header {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.report-header h1 {
  font-size: 2.5em;
  margin-bottom: 15px;
  color: #2563eb;
}

.report-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.meta-item {
  background: #f1f5f9;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.summary-section {
  margin-bottom: 30px;
}

.summary-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.summary-card h2 {
  margin-bottom: 20px;
  color: #1e293b;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  border-radius: 6px;
  background: #f8fafc;
}

.stat-item.success {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
}

.stat-item.failed {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.stat-value {
  display: block;
  font-size: 2em;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
}

.results-section h2 {
  margin-bottom: 20px;
  color: #1e293b;
}

.page-result {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 15px;
  overflow: hidden;
}

.page-header {
  padding: 20px;
  cursor: pointer;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.page-header:hover {
  background: #f8fafc;
}

.page-header h3 {
  color: #1e293b;
  margin: 0;
}

.page-url {
  font-size: 14px;
  color: #64748b;
  margin-top: 5px;
}

.test-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge.success {
  background: #dcfce7;
  color: #166534;
}

.badge.failed {
  background: #fef2f2;
  color: #dc2626;
}

.badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.page-details {
  padding: 0 20px 20px;
}

.test-result {
  border-left: 4px solid #e2e8f0;
  padding: 15px;
  margin-bottom: 10px;
  background: #f8fafc;
  border-radius: 0 4px 4px 0;
}

.test-result.success {
  border-left-color: #22c55e;
}

.test-result.failed {
  border-left-color: #ef4444;
}

.test-result.pending {
  border-left-color: #f59e0b;
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.test-name {
  font-weight: 500;
  color: #1e293b;
}

.test-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.test-status.success {
  background: #dcfce7;
  color: #166534;
}

.test-status.failed {
  background: #fef2f2;
  color: #dc2626;
}

.test-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.test-duration {
  font-size: 12px;
  color: #64748b;
}

.test-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  font-family: monospace;
  font-size: 13px;
  color: #dc2626;
}

.test-output {
  margin-top: 10px;
}

.test-output a {
  color: #2563eb;
  text-decoration: none;
}

.test-output a:hover {
  text-decoration: underline;
}

.test-attachments {
  margin-top: 15px;
}

.attachment {
  margin-bottom: 10px;
}

.attachment-type {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 5px;
}

.screenshot-preview {
  max-width: 200px;
  max-height: 150px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
}

.screenshot-preview:hover {
  opacity: 0.8;
}

.errors-section {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-top: 20px;
}

.errors-section h2 {
  color: #dc2626;
  margin-bottom: 20px;
}

.error-item {
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-family: monospace;
  font-size: 13px;
}

@media (max-width: 768px) {
  .report-container {
    padding: 10px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .test-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .summary-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;
  }

  private generateJS(): string {
    return `
// Playwright Site Scanner Report JavaScript
function togglePageDetails(pageName) {
  const details = document.getElementById('details-' + pageName);
  if (details) {
    details.style.display = details.style.display === 'none' ? 'block' : 'none';
  }
}

// Screenshot click to enlarge
document.addEventListener('DOMContentLoaded', function() {
  const screenshots = document.querySelectorAll('.screenshot-preview');
  screenshots.forEach(screenshot => {
    screenshot.addEventListener('click', function() {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.style.cssText = \`
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
      \`;
      
      const img = document.createElement('img');
      img.src = this.src;
      img.style.cssText = \`
        max-width: 90%;
        max-height: 90%;
        border: 2px solid white;
        border-radius: 4px;
      \`;
      
      modal.appendChild(img);
      document.body.appendChild(modal);
      
      modal.addEventListener('click', function() {
        document.body.removeChild(modal);
      });
    });
  });
});

// Auto-open report based on configuration
if (window.reportConfig && window.reportConfig.openBehavior === 'always') {
  console.log('Report opened automatically');
}
`;
  }

  private async copyScreenshots(data: HTMLReportData): Promise<void> {
    const screenshotsDir = path.join(this.outputDir, 'screenshots');
    
    // Clean screenshots directory first to prevent cross-session contamination
    try {
      await fs.rm(screenshotsDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist yet, that's fine
    }
    
    await fs.mkdir(screenshotsDir, { recursive: true });

    // Copy screenshots from each page result
    for (const page of data.pageResults) {
      const screenshotTests = page.tests.filter(test => test.testType.includes('screenshots'));
      
      for (const test of screenshotTests) {
        if (test.outputPath && test.status === 'success') {
          try {
            const sourcePath = test.outputPath;
            const filename = path.basename(sourcePath);
            const destPath = path.join(screenshotsDir, filename);
            
            await fs.copyFile(sourcePath, destPath);
          } catch (error) {
            // Silently continue if file copy fails
            continue;
          }
        }
      }
    }
  }
}