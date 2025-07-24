"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessibilityTester = void 0;
const chalk_1 = __importDefault(require("chalk"));
const session_manager_js_1 = require("../utils/session-manager.js");
class AccessibilityTester {
    sessionManager;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
    }
    async runAccessibilityScan(page, pageUrl, sessionId) {
        const startTime = new Date();
        const pageName = this.sessionManager.getPageName(pageUrl);
        const testResult = {
            testType: 'accessibility-scan',
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    ♿ Running accessibility scan...`));
            // Inject axe-core library
            await this.injectAxeCore(page);
            // Run accessibility scan
            const results = await this.runAxeScan(page);
            // Generate report
            const report = this.generateAccessibilityReport(results, pageUrl);
            await this.sessionManager.createPageDirectory(sessionId, pageName);
            const scanPath = this.sessionManager.getScanPath(sessionId, pageName, 'accessibility-scan');
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.writeFile(scanPath, report, 'utf8');
            testResult.status = 'success';
            testResult.outputPath = scanPath;
            testResult.endTime = new Date();
            const violationCount = results.violations.length;
            if (violationCount > 0) {
                console.log(chalk_1.default.yellow(`    ⚠️  Accessibility scan completed with ${violationCount} violation(s)`));
            }
            else {
                console.log(chalk_1.default.green(`    ✅ Accessibility scan completed with no violations`));
            }
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ Accessibility scan failed: ${testResult.error}`));
        }
        return testResult;
    }
    async injectAxeCore(page) {
        // Inject axe-core from CDN
        await page.addScriptTag({
            url: 'https://unpkg.com/axe-core@4.8.2/axe.min.js'
        });
        // Wait for axe to be available
        await page.waitForFunction(() => window.axe !== undefined);
    }
    async runAxeScan(page) {
        return await page.evaluate(async () => {
            // Run axe scan with default comprehensive ruleset
            const results = await window.axe.run(document);
            return {
                violations: results.violations,
                passes: results.passes,
                incomplete: results.incomplete,
                url: window.location.href,
                timestamp: new Date().toISOString()
            };
        });
    }
    generateAccessibilityReport(results, pageUrl) {
        let report = `# Accessibility Scan Report\n\n`;
        report += `**URL:** ${pageUrl}\n`;
        report += `**Scan Date:** ${results.timestamp}\n`;
        report += `**Tool:** axe-core\n\n`;
        // Summary
        report += `## Summary\n\n`;
        report += `- **Violations:** ${results.violations.length}\n`;
        report += `- **Passes:** ${results.passes.length}\n`;
        report += `- **Incomplete:** ${results.incomplete.length}\n\n`;
        // Violations by severity
        const violationsBySeverity = this.groupBySeverity(results.violations);
        report += `### Violations by Severity\n`;
        report += `- **Critical:** ${violationsBySeverity.critical?.length || 0}\n`;
        report += `- **Serious:** ${violationsBySeverity.serious?.length || 0}\n`;
        report += `- **Moderate:** ${violationsBySeverity.moderate?.length || 0}\n`;
        report += `- **Minor:** ${violationsBySeverity.minor?.length || 0}\n\n`;
        // Detailed violations
        if (results.violations.length > 0) {
            report += `## Violations\n\n`;
            ['critical', 'serious', 'moderate', 'minor'].forEach(severity => {
                const severityViolations = results.violations.filter(v => v.impact === severity);
                if (severityViolations.length > 0) {
                    report += `### ${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues\n\n`;
                    severityViolations.forEach((violation, index) => {
                        report += `#### ${index + 1}. ${violation.id}\n`;
                        report += `**Impact:** ${violation.impact}\n`;
                        report += `**Description:** ${violation.description}\n`;
                        report += `**Help:** ${violation.help}\n`;
                        report += `**Learn More:** [${violation.helpUrl}](${violation.helpUrl})\n`;
                        report += `**Elements Affected:** ${violation.nodes.length}\n\n`;
                        if (violation.nodes.length > 0) {
                            report += `**Affected Elements:**\n`;
                            violation.nodes.slice(0, 3).forEach((node, nodeIndex) => {
                                report += `${nodeIndex + 1}. Target: \`${node.target.join(', ')}\`\n`;
                                report += `   HTML: \`${node.html.substring(0, 100)}${node.html.length > 100 ? '...' : ''}\`\n`;
                            });
                            if (violation.nodes.length > 3) {
                                report += `... and ${violation.nodes.length - 3} more elements\n`;
                            }
                            report += '\n';
                        }
                    });
                }
            });
        }
        else {
            report += `## ✅ No Violations Found\n\n`;
            report += `Great! This page passed all accessibility tests.\n\n`;
        }
        // Incomplete tests
        if (results.incomplete.length > 0) {
            report += `## Incomplete Tests\n\n`;
            report += `The following tests could not be completed automatically and may require manual review:\n\n`;
            results.incomplete.forEach((item, index) => {
                report += `### ${index + 1}. ${item.id}\n`;
                report += `**Description:** ${item.description}\n`;
                report += `**Help:** ${item.help}\n`;
                report += `**Elements:** ${item.nodes.length}\n\n`;
            });
        }
        // Recommendations
        report += `## Recommendations\n\n`;
        if (results.violations.length === 0) {
            report += `🎉 **Excellent!** This page has no accessibility violations.\n\n`;
            report += `**Maintain Accessibility:**\n`;
            report += `- Continue testing new content and features\n`;
            report += `- Consider user testing with assistive technologies\n`;
            report += `- Keep up with WCAG guidelines updates\n\n`;
        }
        else {
            report += `**Priority Actions:**\n`;
            if (violationsBySeverity.critical?.length > 0) {
                report += `🚨 **Critical:** Address ${violationsBySeverity.critical.length} critical issue(s) immediately\n`;
            }
            if (violationsBySeverity.serious?.length > 0) {
                report += `⚠️  **Serious:** Fix ${violationsBySeverity.serious.length} serious issue(s) soon\n`;
            }
            if (violationsBySeverity.moderate?.length > 0) {
                report += `📋 **Moderate:** Plan to resolve ${violationsBySeverity.moderate.length} moderate issue(s)\n`;
            }
            if (violationsBySeverity.minor?.length > 0) {
                report += `📝 **Minor:** Consider fixing ${violationsBySeverity.minor.length} minor issue(s)\n`;
            }
            report += '\n**General Recommendations:**\n';
            report += '- Focus on critical and serious issues first\n';
            report += '- Test with screen readers and keyboard navigation\n';
            report += '- Validate fixes with automated and manual testing\n';
            report += '- Consider consulting with accessibility experts\n\n';
        }
        // WCAG Compliance
        report += `## WCAG 2.1 Compliance\n\n`;
        const complianceLevel = this.calculateWCAGCompliance(results.violations);
        report += `**Estimated Compliance Level:** ${complianceLevel}\n\n`;
        if (complianceLevel === 'Non-compliant') {
            report += `❌ This page does not meet WCAG 2.1 standards due to critical or serious accessibility violations.\n`;
        }
        else if (complianceLevel === 'AA') {
            report += `✅ This page appears to meet WCAG 2.1 AA standards based on automated testing.\n`;
        }
        else {
            report += `⚠️  This page may have minor accessibility issues that should be addressed.\n`;
        }
        report += `\n**Note:** Automated testing can only detect ~30% of accessibility issues. Manual testing is recommended.\n`;
        return report;
    }
    groupBySeverity(violations) {
        return violations.reduce((groups, violation) => {
            const severity = violation.impact;
            if (!groups[severity]) {
                groups[severity] = [];
            }
            groups[severity].push(violation);
            return groups;
        }, {});
    }
    calculateWCAGCompliance(violations) {
        const hasCritical = violations.some(v => v.impact === 'critical');
        const hasSerious = violations.some(v => v.impact === 'serious');
        const hasModerate = violations.some(v => v.impact === 'moderate');
        if (hasCritical || hasSerious) {
            return 'Non-compliant';
        }
        else if (hasModerate) {
            return 'Partial AA';
        }
        else {
            return 'AA';
        }
    }
}
exports.AccessibilityTester = AccessibilityTester;
//# sourceMappingURL=accessibility-tester.js.map