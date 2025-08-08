import { Page } from 'playwright';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { SessionDataManager } from '../utils/session-data-store.js';

interface APIKeyFinding {
  pattern: string;
  value: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  context: string;
  location: string;
  pageUrl: string;
}

interface APIKeyPattern {
  name: string;
  regex: RegExp;
  riskLevel: 'High' | 'Medium' | 'Low';
  description: string;
}

export class APIKeyTester {
  private sessionManager: SessionManager;
  private allFindings: APIKeyFinding[] = [];

  // Comprehensive API key patterns for detection
  private readonly API_KEY_PATTERNS: APIKeyPattern[] = [
    // AWS
    {
      name: 'AWS Access Key ID',
      regex: /AKIA[0-9A-Z]{16}/g,
      riskLevel: 'High',
      description: 'AWS Access Key ID - grants programmatic access to AWS services'
    },
    {
      name: 'AWS Secret Access Key',
      regex: /[A-Za-z0-9/+=]{40}/g,
      riskLevel: 'High',
      description: 'Potential AWS Secret Access Key - 40-character base64-like string'
    },
    // Google API
    {
      name: 'Google API Key',
      regex: /AIza[0-9A-Za-z\\-_]{35}/g,
      riskLevel: 'High',
      description: 'Google API Key - provides access to Google Cloud services'
    },
    // GitHub
    {
      name: 'GitHub Personal Access Token',
      regex: /ghp_[0-9a-zA-Z]{36}/g,
      riskLevel: 'High',
      description: 'GitHub Personal Access Token - grants repository access'
    },
    {
      name: 'GitHub OAuth Token',
      regex: /gho_[0-9a-zA-Z]{36}/g,
      riskLevel: 'High',
      description: 'GitHub OAuth Token - grants application access'
    },
    // Stripe
    {
      name: 'Stripe Live Secret Key',
      regex: /sk_live_[0-9a-zA-Z]{24}/g,
      riskLevel: 'High',
      description: 'Stripe Live Secret Key - enables payment processing'
    },
    {
      name: 'Stripe Live Publishable Key',
      regex: /pk_live_[0-9a-zA-Z]{24}/g,
      riskLevel: 'Medium',
      description: 'Stripe Live Publishable Key - client-side payment key'
    },
    {
      name: 'Stripe Test Secret Key',
      regex: /sk_test_[0-9a-zA-Z]{24}/g,
      riskLevel: 'Medium',
      description: 'Stripe Test Secret Key - test environment access'
    },
    // OpenAI
    {
      name: 'OpenAI API Key',
      regex: /sk-[a-zA-Z0-9]{48}/g,
      riskLevel: 'High',
      description: 'OpenAI API Key - grants access to OpenAI services'
    },
    // JWT Tokens
    {
      name: 'JWT Token',
      regex: /ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
      riskLevel: 'Medium',
      description: 'JSON Web Token - may contain sensitive authentication data'
    },
    // Slack
    {
      name: 'Slack Bot Token',
      regex: /xoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}/g,
      riskLevel: 'High',
      description: 'Slack Bot Token - grants bot access to Slack workspace'
    },
    // Generic patterns
    {
      name: 'Potential API Key (32+ chars)',
      regex: /[a-zA-Z0-9]{32,}/g,
      riskLevel: 'Low',
      description: 'Long alphanumeric string that might be an API key'
    }
  ];

  // Context keywords that increase suspicion
  private readonly CONTEXT_KEYWORDS = [
    'api', 'key', 'secret', 'token', 'auth', 'password', 'credential',
    'access', 'private', 'config', 'env', 'bearer', 'authorization'
  ];

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async scanPageForAPIKeys(
    page: Page,
    pageUrl: string,
    dataManager: SessionDataManager
  ): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'api-key-scan',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`      🔐 Scanning for API keys: ${pageUrl}`));

      // Scan different sources on the page
      const findings = await this.performScan(page, pageUrl);
      
      // Store findings for consolidated report
      this.allFindings.push(...findings);
      
      testResult.status = 'success';
      testResult.endTime = new Date();
      
      const riskCount = this.getRiskLevelCount(findings);
      console.log(chalk.green(`      ✅ API key scan completed: ${findings.length} potential issues found`));
      if (riskCount.high > 0) {
        console.log(chalk.red(`        ⚠️  ${riskCount.high} HIGH RISK findings detected`));
      }
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`      ❌ API key scan failed for ${pageUrl}: ${testResult.error}`));
      dataManager.addError(`api-key-scan-${pageUrl}`, testResult.error);
    }

    return testResult;
  }

  private async performScan(page: Page, pageUrl: string): Promise<APIKeyFinding[]> {
    const findings: APIKeyFinding[] = [];

    // Extract all text content from the page
    const pageContent = await page.evaluate(() => {
      const sources = {
        // DOM text content
        bodyText: document.body?.textContent || '',
        // All script tags content
        scripts: Array.from(document.querySelectorAll('script')).map(script => script.textContent || ''),
        // All inline styles
        styles: Array.from(document.querySelectorAll('style')).map(style => style.textContent || ''),
        // HTML attributes that might contain keys
        attributes: Array.from(document.querySelectorAll('*')).flatMap(el => 
          Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`)
        ),
        // Local storage content
        localStorage: (() => {
          try {
            return Object.keys(window.localStorage).map(key => 
              `${key}: ${window.localStorage.getItem(key) || ''}`
            );
          } catch {
            return [];
          }
        })(),
        // Session storage content
        sessionStorage: (() => {
          try {
            return Object.keys(window.sessionStorage).map(key => 
              `${key}: ${window.sessionStorage.getItem(key) || ''}`
            );
          } catch {
            return [];
          }
        })()
      };
      
      return sources;
    });

    // Scan each source
    findings.push(...this.scanText(pageContent.bodyText, 'DOM Text', pageUrl));
    
    pageContent.scripts.forEach((script, index) => {
      findings.push(...this.scanText(script, `Script ${index + 1}`, pageUrl));
    });
    
    pageContent.styles.forEach((style, index) => {
      findings.push(...this.scanText(style, `Style ${index + 1}`, pageUrl));
    });
    
    pageContent.attributes.forEach((attr, index) => {
      findings.push(...this.scanText(attr, `HTML Attribute ${index + 1}`, pageUrl));
    });
    
    pageContent.localStorage.forEach((item, index) => {
      findings.push(...this.scanText(item, `Local Storage ${index + 1}`, pageUrl));
    });
    
    pageContent.sessionStorage.forEach((item, index) => {
      findings.push(...this.scanText(item, `Session Storage ${index + 1}`, pageUrl));
    });

    return this.deduplicateFindings(findings);
  }

  private scanText(text: string, location: string, pageUrl: string): APIKeyFinding[] {
    const findings: APIKeyFinding[] = [];

    for (const pattern of this.API_KEY_PATTERNS) {
      const matches = text.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          // Filter out obvious false positives
          if (this.isLikelyFalsePositive(match, pattern.name)) {
            continue;
          }

          // Get context around the match
          const context = this.extractContext(text, match);
          
          // Adjust risk level based on context
          const riskLevel = this.assessRiskLevel(pattern, match, context);

          findings.push({
            pattern: pattern.name,
            value: this.maskSensitiveValue(match),
            riskLevel,
            context,
            location,
            pageUrl
          });
        }
      }
    }

    return findings;
  }

  private isLikelyFalsePositive(value: string, patternName: string): boolean {
    // Filter common false positives
    const falsePositives = [
      // Common placeholder values
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'your-api-key-here',
      'sk-1234567890abcdef',
      'AKIAIOSFODNN7EXAMPLE',
      // Common example values
      'example', 'placeholder', 'demo', 'test123',
      // Base64 encoded common strings
      'aGVsbG8gd29ybGQ=', // "hello world"
    ];

    const lowerValue = value.toLowerCase();
    return falsePositives.some(fp => lowerValue.includes(fp.toLowerCase()));
  }

  private extractContext(text: string, match: string): string {
    const index = text.indexOf(match);
    if (index === -1) return '';

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  private assessRiskLevel(pattern: APIKeyPattern, value: string, context: string): 'High' | 'Medium' | 'Low' {
    let riskLevel = pattern.riskLevel;
    
    // Increase risk if found in suspicious context
    const contextLower = context.toLowerCase();
    const hasSuspiciousContext = this.CONTEXT_KEYWORDS.some(keyword => 
      contextLower.includes(keyword)
    );
    
    if (hasSuspiciousContext && riskLevel === 'Low') {
      riskLevel = 'Medium';
    }
    
    // Decrease risk for generic patterns in non-suspicious contexts
    if (pattern.name.includes('Potential API Key') && !hasSuspiciousContext) {
      riskLevel = 'Low';
    }

    return riskLevel;
  }

  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) return value;
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const middle = '*'.repeat(Math.min(value.length - 8, 20));
    
    return `${start}${middle}${end}`;
  }

  private deduplicateFindings(findings: APIKeyFinding[]): APIKeyFinding[] {
    const seen = new Set<string>();
    return findings.filter(finding => {
      const key = `${finding.value}-${finding.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getRiskLevelCount(findings: APIKeyFinding[]) {
    return {
      high: findings.filter(f => f.riskLevel === 'High').length,
      medium: findings.filter(f => f.riskLevel === 'Medium').length,
      low: findings.filter(f => f.riskLevel === 'Low').length
    };
  }

  async generateConsolidatedReport(sessionId: string): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'api-key-security-report',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.blue('🔐 Generating consolidated API key security report...'));
      
      const reportContent = this.generateSecurityReportContent();
      const reportPath = await this.saveSecurityReport(sessionId, reportContent);
      
      testResult.status = 'success';
      testResult.outputPath = reportPath;
      testResult.endTime = new Date();
      
      const riskCount = this.getRiskLevelCount(this.allFindings);
      console.log(chalk.green(`✅ Security report generated: ${this.allFindings.length} total findings`));
      console.log(chalk.blue(`   📄 Report saved: ${reportPath}`));
      
      if (riskCount.high > 0) {
        console.log(chalk.red(`   ⚠️  ${riskCount.high} HIGH RISK findings require immediate attention`));
      }
      
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`❌ Security report generation failed: ${testResult.error}`));
    }

    return testResult;
  }

  private generateSecurityReportContent(): string {
    const riskCount = this.getRiskLevelCount(this.allFindings);
    const uniquePages = [...new Set(this.allFindings.map(f => f.pageUrl))];
    
    let report = `# API Key Security Scan Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Pages Scanned:** ${uniquePages.length}\n`;
    report += `**Total Findings:** ${this.allFindings.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    
    if (this.allFindings.length === 0) {
      report += `✅ **No API keys or sensitive tokens detected** across ${uniquePages.length} pages.\n\n`;
      report += `This is a positive security finding - no obvious API key exposures were identified.\n\n`;
    } else {
      report += `⚠️ **${this.allFindings.length} potential API key or token exposures detected** across ${uniquePages.length} pages.\n\n`;
      
      if (riskCount.high > 0) {
        report += `🚨 **CRITICAL:** ${riskCount.high} HIGH RISK findings require immediate investigation and remediation.\n\n`;
      }
    }

    // Risk Level Breakdown
    if (this.allFindings.length > 0) {
      report += `## Risk Level Breakdown\n\n`;
      report += `| Risk Level | Count | Description |\n`;
      report += `|------------|-------|-------------|\n`;
      report += `| 🔴 High | ${riskCount.high} | Known API key patterns with high confidence |\n`;
      report += `| 🟡 Medium | ${riskCount.medium} | Likely API keys or tokens requiring review |\n`;
      report += `| 🔵 Low | ${riskCount.low} | Potential keys requiring manual verification |\n\n`;
    }

    // Detailed Findings
    if (this.allFindings.length > 0) {
      report += `## Detailed Findings\n\n`;
      
      // Group by risk level
      const groupedFindings = {
        High: this.allFindings.filter(f => f.riskLevel === 'High'),
        Medium: this.allFindings.filter(f => f.riskLevel === 'Medium'),
        Low: this.allFindings.filter(f => f.riskLevel === 'Low')
      };

      for (const [riskLevel, findings] of Object.entries(groupedFindings)) {
        if (findings.length === 0) continue;
        
        const emoji = riskLevel === 'High' ? '🔴' : riskLevel === 'Medium' ? '🟡' : '🔵';
        report += `### ${emoji} ${riskLevel} Risk Findings\n\n`;
        
        findings.forEach((finding, index) => {
          report += `#### Finding ${index + 1}: ${finding.pattern}\n\n`;
          report += `- **Page:** ${finding.pageUrl}\n`;
          report += `- **Location:** ${finding.location}\n`;
          report += `- **Value:** \`${finding.value}\`\n`;
          report += `- **Context:** \`${finding.context}\`\n\n`;
        });
      }
    }

    // Remediation Recommendations
    report += `## Remediation Recommendations\n\n`;
    
    if (riskCount.high > 0) {
      report += `### Immediate Actions Required (High Risk)\n\n`;
      report += `1. **Revoke and rotate** all exposed API keys immediately\n`;
      report += `2. **Audit access logs** for these keys to identify potential unauthorized usage\n`;
      report += `3. **Remove keys** from client-side code and public repositories\n`;
      report += `4. **Implement proper secret management** using environment variables or secret stores\n\n`;
    }
    
    report += `### General Security Best Practices\n\n`;
    report += `- **Never commit API keys** to version control systems\n`;
    report += `- **Use environment variables** for configuration secrets\n`;
    report += `- **Implement key rotation policies** for all API keys\n`;
    report += `- **Use least-privilege access** principles for API keys\n`;
    report += `- **Monitor API key usage** and set up alerts for unusual activity\n`;
    report += `- **Regular security audits** of codebases and deployments\n\n`;

    // False Positive Guidance
    report += `## False Positive Guidance\n\n`;
    report += `This scan uses pattern matching and may produce false positives. Review findings manually:\n\n`;
    report += `- **Example/placeholder values** are common false positives\n`;
    report += `- **Test environment keys** pose lower risk but should still be secured\n`;
    report += `- **Masked or partial keys** shown in logs may be acceptable\n`;
    report += `- **JWT tokens** in examples or documentation may not be active\n\n`;

    // Additional Resources
    report += `## Additional Security Resources\n\n`;
    report += `- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)\n`;
    report += `- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)\n`;
    report += `- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)\n`;
    report += `- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)\n\n`;

    report += `---\n\n`;
    report += `*Report generated by Playwright Site Scanner API Key Detection*\n`;
    
    return report;
  }

  private async saveSecurityReport(sessionId: string, content: string): Promise<string> {
    const outputPath = path.join(
      this.sessionManager['outputDir'],
      sessionId,
      'api-key-security-report.md'
    );
    
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }
}