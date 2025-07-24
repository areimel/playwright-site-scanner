"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const validation_js_1 = require("./validation.js");
class SessionManager {
    outputDir = 'playwright-site-scanner-sessions';
    createSessionId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${month}-${day}-${year}_${hours}-${minutes}`;
    }
    async createSessionDirectory(sessionId) {
        const sessionPath = path_1.default.join(this.outputDir, sessionId);
        await fs_1.promises.mkdir(sessionPath, { recursive: true });
    }
    async createPageDirectory(sessionId, pageName) {
        const pagePath = path_1.default.join(this.outputDir, sessionId, pageName);
        await fs_1.promises.mkdir(pagePath, { recursive: true });
        // Create subdirectories for different test types
        await fs_1.promises.mkdir(path_1.default.join(pagePath, 'screenshots'), { recursive: true });
        await fs_1.promises.mkdir(path_1.default.join(pagePath, 'scans'), { recursive: true });
        return pagePath;
    }
    getPageName(url) {
        return (0, validation_js_1.sanitizePageName)(url);
    }
    getPagePath(sessionId, pageName) {
        return path_1.default.join(this.outputDir, sessionId, pageName);
    }
    getScreenshotPath(sessionId, pageName, viewportName) {
        return path_1.default.join(this.outputDir, sessionId, pageName, 'screenshots', `${pageName}-${viewportName}.png`);
    }
    getScanPath(sessionId, pageName, scanType) {
        return path_1.default.join(this.outputDir, sessionId, pageName, 'scans', `${pageName}-${scanType}.md`);
    }
    async savePageSummary(sessionId, pageResult) {
        const pagePath = await this.createPageDirectory(sessionId, pageResult.pageName);
        const summaryPath = path_1.default.join(pagePath, `${pageResult.pageName}-summary.md`);
        const summaryContent = this.generatePageSummaryMarkdown(pageResult);
        await fs_1.promises.writeFile(summaryPath, summaryContent, 'utf8');
    }
    async generateSessionSummary(summary, pageResults) {
        const sessionPath = path_1.default.join(this.outputDir, summary.sessionId);
        const summaryPath = path_1.default.join(sessionPath, 'session-summary.md');
        const summaryContent = this.generateSessionSummaryMarkdown(summary, pageResults);
        await fs_1.promises.writeFile(summaryPath, summaryContent, 'utf8');
    }
    generatePageSummaryMarkdown(pageResult) {
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
                markdown += `- **Output:** [${path_1.default.basename(test.outputPath)}](${test.outputPath})\n`;
            }
            if (test.error) {
                markdown += `- **Error:** ${test.error}\n`;
            }
            markdown += '\n';
        }
        return markdown;
    }
    generateSessionSummaryMarkdown(summary, pageResults) {
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
exports.SessionManager = SessionManager;
//# sourceMappingURL=session-manager.js.map