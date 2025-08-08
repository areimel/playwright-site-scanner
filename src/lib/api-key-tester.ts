import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { StandardTestOutputHandler } from '../utils/test-output-handler.js';
import { OutputContext } from '../types/test-output-types.js';

interface ApiKeyFinding {
  type: string;
  value: string;
  location: {
    source: 'html' | 'javascript' | 'css' | 'attribute' | 'comment';
    element?: string;
    line?: number;
    context?: string;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  url: string;
}

interface ApiKeyResults {
  findings: ApiKeyFinding[];
  totalFindings: number;
  pagesCanned: number;
  timestamp: string;
}

interface ApiKeyPattern {
  name: string;
  regex: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export class ApiKeyTester {
  private sessionManager: SessionManager;
  private allFindings: ApiKeyFinding[] = [];
  private scannedPages = 0;

  // Comprehensive API key patterns for major providers
  private readonly API_KEY_PATTERNS: ApiKeyPattern[] = [
    // AWS
    { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical', description: 'AWS Access Key ID' },
    { name: 'AWS Secret Access Key', regex: /[0-9a-zA-Z\/+]{40}/g, severity: 'critical', description: 'AWS Secret Access Key (40 chars)' },
    { name: 'AWS Session Token', regex: /AWS[0-9A-Z]{16,}/g, severity: 'critical', description: 'AWS Session Token' },
    
    // Google API Keys
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'high', description: 'Google API Key' },
    { name: 'Google OAuth Token', regex: /ya29\.[0-9A-Za-z\-_]+/g, severity: 'high', description: 'Google OAuth Access Token' },
    { name: 'Google Service Account', regex: /\"type\": \"service_account\"/g, severity: 'critical', description: 'Google Service Account JSON' },
    
    // GitHub
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9]{36}/g, severity: 'high', description: 'GitHub Personal Access Token' },
    { name: 'GitHub App Token', regex: /ghs_[A-Za-z0-9]{36}/g, severity: 'high', description: 'GitHub App Token' },
    { name: 'GitHub Classic Token', regex: /ghp_[A-Za-z0-9]{36}/g, severity: 'high', description: 'GitHub Classic Token' },
    
    // Stripe
    { name: 'Stripe Live Key', regex: /sk_live_[0-9a-zA-Z]{24}/g, severity: 'critical', description: 'Stripe Live Secret Key' },
    { name: 'Stripe Test Key', regex: /sk_test_[0-9a-zA-Z]{24}/g, severity: 'medium', description: 'Stripe Test Secret Key' },
    { name: 'Stripe Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24}/g, severity: 'high', description: 'Stripe Live Publishable Key' },
    { name: 'Stripe Webhook Secret', regex: /whsec_[a-zA-Z0-9]{32}/g, severity: 'high', description: 'Stripe Webhook Secret' },
    
    // PayPal
    { name: 'PayPal Client ID', regex: /A[0-9A-Z]{80}/g, severity: 'high', description: 'PayPal Client ID' },
    
    // Microsoft Azure
    { name: 'Azure Client Secret', regex: /[0-9A-Za-z\-_.~]{34}/g, severity: 'high', description: 'Azure Client Secret' },
    
    // Twilio
    { name: 'Twilio Auth Token', regex: /[0-9a-f]{32}/g, severity: 'high', description: 'Twilio Auth Token' },
    { name: 'Twilio SID', regex: /AC[a-zA-Z0-9]{32}/g, severity: 'medium', description: 'Twilio Account SID' },
    
    // Slack
    { name: 'Slack Token', regex: /xox[bpas]-[0-9]{12}-[0-9]{12}-[0-9a-zA-Z]{24}/g, severity: 'high', description: 'Slack API Token' },
    { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8}\/B[0-9A-Z]{8}\/[0-9a-zA-Z]{24}/g, severity: 'medium', description: 'Slack Webhook URL' },
    
    // SendGrid
    { name: 'SendGrid API Key', regex: /SG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}/g, severity: 'high', description: 'SendGrid API Key' },
    
    // Mailgun
    { name: 'Mailgun API Key', regex: /key-[0-9a-zA-Z]{32}/g, severity: 'high', description: 'Mailgun API Key' },
    
    // Firebase
    { name: 'Firebase URL', regex: /https:\/\/[0-9a-z_-]+\.firebaseio\.com/g, severity: 'medium', description: 'Firebase Database URL' },
    
    // JWT Tokens
    { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, severity: 'medium', description: 'JSON Web Token' },
    
    // Generic patterns
    { name: 'Generic API Key', regex: /['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][0-9a-zA-Z]{16,}['\"]/gi, severity: 'medium', description: 'Generic API Key pattern' },
    { name: 'Generic Access Token', regex: /['\"]?access[_-]?token['\"]?\s*[:=]\s*['\"][0-9a-zA-Z]{16,}['\"]/gi, severity: 'medium', description: 'Generic Access Token pattern' },
    { name: 'Generic Secret', regex: /['\"]?secret['\"]?\s*[:=]\s*['\"][0-9a-zA-Z]{16,}['\"]/gi, severity: 'medium', description: 'Generic Secret pattern' },
    { name: 'Generic Password', regex: /['\"]?password['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]/gi, severity: 'medium', description: 'Generic Password pattern' }
  ];

  // High entropy string patterns (for unknown API keys)
  private readonly HIGH_ENTROPY_PATTERNS = [
    { name: 'High Entropy String', regex: /[A-Za-z0-9+/]{32,}={0,2}/g, minEntropy: 4.5, severity: 'low' as const, description: 'High entropy string (possible API key)' },
    { name: 'Base64 Pattern', regex: /[A-Za-z0-9+/]{20,}={0,2}/g, minEntropy: 4.0, severity: 'low' as const, description: 'Base64 encoded string' },
    { name: 'Hex Pattern', regex: /[a-fA-F0-9]{32,}/g, minEntropy: 2.0, severity: 'low' as const, description: 'Long hexadecimal string' }
  ];

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async runApiKeyScan(page: Page, pageUrl: string, sessionId: string): Promise<TestResult> {
    const pageName = StandardTestOutputHandler.getPageNameFromUrl(pageUrl);
    
    // Create initial test result using standardized system
    const testResult = this.sessionManager.createStandardTestResult('api-key-scan', 'pending');

    try {
      console.log(chalk.gray(`    🔐 Scanning for API keys...`));

      // Scan the page for API keys
      const pageFindings = await this.scanPageForApiKeys(page, pageUrl);
      
      // Add findings to the global collection
      this.allFindings.push(...pageFindings);
      this.scannedPages++;

      // Check if this is the last page to process (we'll generate report in the orchestrator)
      testResult.status = 'success';
      testResult.endTime = new Date();

      if (pageFindings.length > 0) {
        console.log(chalk.yellow(`    ⚠️  Found ${pageFindings.length} potential API key(s) on this page`));
      } else {
        console.log(chalk.green(`    ✅ No API keys found on this page`));
      }

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ API key scan failed: ${testResult.error}`));
    }

    return testResult;
  }

  async generateFinalReport(sessionId: string, totalUrls: string[]): Promise<TestResult> {
    const testResult = this.sessionManager.createStandardTestResult('api-key-scan', 'pending');
    
    try {
      console.log(chalk.gray(`    📋 Generating API key security report...`));

      const results: ApiKeyResults = {
        findings: this.allFindings,
        totalFindings: this.allFindings.length,
        pagesCanned: this.scannedPages,
        timestamp: new Date().toISOString()
      };

      // Generate comprehensive security report
      const report = this.generateApiKeyReport(results, totalUrls);

      // Save using the standardized output system
      const context: OutputContext = {
        url: 'site-wide',
        pageName: 'api-key-security-report'
      };

      const saveResult = await this.sessionManager.saveTestOutput(report, sessionId, 'api-key-scan', context);
      
      if (saveResult.success) {
        testResult.status = 'success';
        testResult.outputPath = saveResult.outputPath;
      } else {
        throw new Error(saveResult.error || 'Failed to save API key security report');
      }
      
      testResult.endTime = new Date();
      
      if (this.allFindings.length > 0) {
        const criticalCount = this.allFindings.filter(f => f.severity === 'critical').length;
        const highCount = this.allFindings.filter(f => f.severity === 'high').length;
        console.log(chalk.red(`    🚨 API key scan completed: ${this.allFindings.length} findings (${criticalCount} critical, ${highCount} high)`));
      } else {
        console.log(chalk.green(`    ✅ API key scan completed: No API keys found across ${this.scannedPages} pages`));
      }

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Failed to generate API key report: ${testResult.error}`));
    }

    return testResult;
  }

  private async scanPageForApiKeys(page: Page, pageUrl: string): Promise<ApiKeyFinding[]> {
    const findings: ApiKeyFinding[] = [];

    // Get page content for scanning
    const pageContent = await page.evaluate(() => {
      return {
        html: document.documentElement.outerHTML,
        scripts: Array.from(document.querySelectorAll('script')).map(script => ({
          content: script.textContent || '',
          src: script.src || ''
        })),
        styles: Array.from(document.querySelectorAll('style')).map(style => style.textContent || ''),
        links: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => (link as HTMLLinkElement).href)
      };
    });

    // Scan HTML content
    findings.push(...this.scanContent(pageContent.html, 'html', pageUrl));

    // Scan JavaScript content
    pageContent.scripts.forEach(script => {
      if (script.content) {
        findings.push(...this.scanContent(script.content, 'javascript', pageUrl, script.src));
      }
    });

    // Scan CSS content
    pageContent.styles.forEach(style => {
      findings.push(...this.scanContent(style, 'css', pageUrl));
    });

    // Additional external resources scan
    try {
      const externalJs = await this.scanExternalResources(page, pageUrl);
      findings.push(...externalJs);
    } catch (error) {
      // Silently continue if external resource scanning fails
    }

    return findings;
  }

  private scanContent(content: string, source: 'html' | 'javascript' | 'css' | 'attribute' | 'comment', url: string, context?: string): ApiKeyFinding[] {
    const findings: ApiKeyFinding[] = [];

    // Scan with defined patterns
    this.API_KEY_PATTERNS.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Skip if match is too common (reduce false positives)
        if (this.isLikelyFalsePositive(match[0], pattern.name)) {
          continue;
        }

        findings.push({
          type: pattern.name,
          value: this.maskSensitiveValue(match[0]),
          location: {
            source,
            context: context || this.getContext(content, match.index, 50),
            line: this.getLineNumber(content, match.index)
          },
          severity: pattern.severity,
          confidence: this.calculateConfidence(match[0], pattern.name, content, match.index),
          url
        });
      }
    });

    // Scan for high entropy strings
    this.HIGH_ENTROPY_PATTERNS.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const entropy = this.calculateEntropy(match[0]);
        if (entropy >= pattern.minEntropy && !this.isLikelyFalsePositive(match[0], pattern.name)) {
          findings.push({
            type: pattern.name,
            value: this.maskSensitiveValue(match[0]),
            location: {
              source,
              context: context || this.getContext(content, match.index, 50),
              line: this.getLineNumber(content, match.index)
            },
            severity: pattern.severity,
            confidence: Math.min(0.8, entropy / 6), // Scale entropy to confidence
            url
          });
        }
      }
    });

    return findings;
  }

  private async scanExternalResources(page: Page, pageUrl: string): Promise<ApiKeyFinding[]> {
    const findings: ApiKeyFinding[] = [];
    
    try {
      // Get all script sources
      const scriptSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script[src]')).map(script => (script as HTMLScriptElement).src);
      });

      // Limit to same-origin scripts to avoid CORS issues
      const sameOriginScripts = scriptSrcs.filter(src => {
        try {
          const scriptUrl = new URL(src);
          const pageUrlObj = new URL(pageUrl);
          return scriptUrl.origin === pageUrlObj.origin;
        } catch {
          return false;
        }
      });

      // Scan a limited number of external scripts to avoid performance issues
      for (const src of sameOriginScripts.slice(0, 5)) {
        try {
          const response = await page.goto(src, { timeout: 5000, waitUntil: 'domcontentloaded' });
          if (response && response.ok()) {
            const scriptContent = await response.text();
            findings.push(...this.scanContent(scriptContent, 'javascript', pageUrl, src));
          }
        } catch {
          // Silently continue if script loading fails
        }
      }
    } catch {
      // Silently continue if external resource scanning fails
    }

    return findings;
  }

  private isLikelyFalsePositive(value: string, patternName: string): boolean {
    const falsePositivePatterns = [
      /^(example|test|demo|placeholder|sample)/i,
      /^(your|my|the)[_-]?(api|key|token)/i,
      /^(xxx|yyy|zzz)/i,
      /^[0]+$/,
      /^[1]+$/,
      /lorem ipsum/i,
      /^(null|undefined|empty)$/i
    ];

    // Check against common false positive patterns
    if (falsePositivePatterns.some(pattern => pattern.test(value))) {
      return true;
    }

    // Pattern-specific false positive checks
    if (patternName.includes('AWS') && value.length < 16) {
      return true;
    }

    if (patternName.includes('JWT') && value.split('.').length !== 3) {
      return true;
    }

    return false;
  }

  private calculateConfidence(value: string, patternName: string, content: string, index: number): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for specific patterns
    if (patternName.includes('AWS') || patternName.includes('Google') || patternName.includes('Stripe')) {
      confidence += 0.3;
    }

    // Check context for additional confidence indicators
    const context = this.getContext(content, index, 100).toLowerCase();
    
    // Positive indicators
    if (context.includes('api') || context.includes('key') || context.includes('token') || context.includes('secret')) {
      confidence += 0.2;
    }

    if (context.includes('auth') || context.includes('bearer') || context.includes('header')) {
      confidence += 0.15;
    }

    // Negative indicators
    if (context.includes('example') || context.includes('test') || context.includes('demo')) {
      confidence -= 0.3;
    }

    if (context.includes('placeholder') || context.includes('sample')) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: { [key: string]: number } = {};
    
    for (let i = 0; i < len; i++) {
      const char = str.charAt(i);
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  private getContext(content: string, index: number, length: number): string {
    const start = Math.max(0, index - length / 2);
    const end = Math.min(content.length, index + length / 2);
    return content.substring(start, end).replace(/\s+/g, ' ').trim();
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) {
      return value.substring(0, 2) + '*'.repeat(value.length - 2);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  private generateApiKeyReport(results: ApiKeyResults, scannedUrls: string[]): string {
    let report = `# API Key Security Scan Report\n\n`;
    report += `**Scan Date:** ${results.timestamp}\n`;
    report += `**Pages Scanned:** ${results.pagesCanned}\n`;
    report += `**Total Findings:** ${results.totalFindings}\n\n`;

    // Executive Summary
    report += `## 🚨 Executive Summary\n\n`;
    
    if (results.totalFindings === 0) {
      report += `✅ **No API keys or sensitive tokens were detected** across ${results.pagesCanned} page(s).\n\n`;
      report += `This is excellent! Your website appears to be free of exposed API keys and authentication tokens.\n\n`;
    } else {
      const severityCounts = this.groupBySeverity(results.findings);
      report += `⚠️  **${results.totalFindings} potential security issue(s) detected** across ${results.pagesCanned} page(s).\n\n`;
      
      report += `**Severity Breakdown:**\n`;
      if (severityCounts.critical > 0) report += `- 🔴 **Critical:** ${severityCounts.critical} findings\n`;
      if (severityCounts.high > 0) report += `- 🟠 **High:** ${severityCounts.high} findings\n`;
      if (severityCounts.medium > 0) report += `- 🟡 **Medium:** ${severityCounts.medium} findings\n`;
      if (severityCounts.low > 0) report += `- 🟢 **Low:** ${severityCounts.low} findings\n`;
      report += '\n';

      // Immediate actions required
      if (severityCounts.critical > 0 || severityCounts.high > 0) {
        report += `🚨 **IMMEDIATE ACTION REQUIRED**: Critical or high-severity findings require urgent attention.\n\n`;
      }
    }

    // Detailed Findings
    if (results.totalFindings > 0) {
      report += `## 🔍 Detailed Findings\n\n`;
      
      const findingsByPage = this.groupByUrl(results.findings);
      
      Object.entries(findingsByPage).forEach(([url, findings]) => {
        report += `### ${url}\n\n`;
        
        findings.forEach((finding, index) => {
          const severityIcon = this.getSeverityIcon(finding.severity);
          const confidencePercent = Math.round(finding.confidence * 100);
          
          report += `#### ${severityIcon} Finding ${index + 1}: ${finding.type}\n`;
          report += `**Severity:** ${finding.severity.toUpperCase()}\n`;
          report += `**Confidence:** ${confidencePercent}%\n`;
          report += `**Location:** ${finding.location.source}`;
          if (finding.location.line) report += ` (line ${finding.location.line})`;
          report += '\n';
          report += `**Value:** \`${finding.value}\`\n`;
          if (finding.location.context) {
            report += `**Context:** \`${finding.location.context}\`\n`;
          }
          report += '\n';
        });
      });
    }

    // Risk Assessment
    report += `## 🎯 Risk Assessment\n\n`;
    
    if (results.totalFindings === 0) {
      report += `**Overall Risk Level: LOW** ✅\n\n`;
      report += `No exposed API keys were found. Continue monitoring for new deployments.\n\n`;
    } else {
      const severityCounts = this.groupBySeverity(results.findings);
      let riskLevel = 'LOW';
      
      if (severityCounts.critical > 0) riskLevel = 'CRITICAL';
      else if (severityCounts.high > 0) riskLevel = 'HIGH';
      else if (severityCounts.medium > 0) riskLevel = 'MEDIUM';
      
      const riskIcon = riskLevel === 'CRITICAL' ? '🔴' : riskLevel === 'HIGH' ? '🟠' : riskLevel === 'MEDIUM' ? '🟡' : '🟢';
      
      report += `**Overall Risk Level: ${riskLevel}** ${riskIcon}\n\n`;
      
      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
        report += `⚠️  **High-priority security vulnerabilities detected.** Exposed API keys can lead to:\n`;
        report += `- Unauthorized access to services and data\n`;
        report += `- Financial losses from abuse of paid APIs\n`;
        report += `- Data breaches and compliance violations\n`;
        report += `- Reputation damage and loss of customer trust\n\n`;
      }
    }

    // Remediation Steps
    report += `## 🔧 Remediation Steps\n\n`;
    
    if (results.totalFindings > 0) {
      report += `**Immediate Actions:**\n`;
      report += `1. **Revoke exposed API keys immediately** - Generate new keys for all exposed credentials\n`;
      report += `2. **Remove sensitive data from code** - Never store API keys in client-side code\n`;
      report += `3. **Implement environment variables** - Use server-side environment variables for secrets\n`;
      report += `4. **Add secrets to .gitignore** - Prevent future commits of sensitive data\n`;
      report += `5. **Audit git history** - Check if keys were committed to version control\n\n`;
    }
    
    report += `**Security Best Practices:**\n`;
    report += `- Use environment variables for all API keys and secrets\n`;
    report += `- Implement key rotation policies\n`;
    report += `- Use least-privilege access principles\n`;
    report += `- Monitor API usage for anomalies\n`;
    report += `- Implement proper secret management solutions\n`;
    report += `- Regular security audits and scans\n\n`;

    // Prevention Guide
    report += `## 🛡️  Prevention Guide\n\n`;
    report += `**Development Practices:**\n`;
    report += `- Never hardcode API keys in source code\n`;
    report += `- Use configuration files that are not tracked by version control\n`;
    report += `- Implement pre-commit hooks to detect secrets\n`;
    report += `- Use secret scanning tools in CI/CD pipelines\n`;
    report += `- Regular developer security training\n\n`;
    
    report += `**Deployment Practices:**\n`;
    report += `- Use container orchestration secrets management\n`;
    report += `- Implement proper IAM roles and policies\n`;
    report += `- Monitor and log all API key usage\n`;
    report += `- Regular security assessments\n\n`;

    // Compliance Notes
    report += `## 📋 Compliance & Standards\n\n`;
    report += `**Security Frameworks:**\n`;
    report += `- OWASP Top 10 - A02:2021 Cryptographic Failures\n`;
    report += `- NIST Cybersecurity Framework\n`;
    report += `- SOC 2 Type II compliance requirements\n`;
    report += `- PCI DSS for payment-related keys\n\n`;

    // Scan Details
    report += `## 📊 Scan Details\n\n`;
    report += `**Pages Scanned:**\n`;
    scannedUrls.forEach((url, index) => {
      report += `${index + 1}. ${url}\n`;
    });
    report += '\n';
    
    report += `**Detection Patterns Used:**\n`;
    report += `- ${this.API_KEY_PATTERNS.length} specific API key patterns\n`;
    report += `- ${this.HIGH_ENTROPY_PATTERNS.length} entropy-based detection patterns\n`;
    report += `- Context-aware false positive reduction\n`;
    report += `- Confidence scoring algorithm\n\n`;
    
    report += `**Generated by:** Playwright Site Scanner API Key Security Test\n`;
    report += `**Report Version:** 1.0\n`;

    return report;
  }

  private groupBySeverity(findings: ApiKeyFinding[]): { critical: number; high: number; medium: number; low: number } {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };
  }

  private groupByUrl(findings: ApiKeyFinding[]): { [url: string]: ApiKeyFinding[] } {
    return findings.reduce((groups, finding) => {
      if (!groups[finding.url]) {
        groups[finding.url] = [];
      }
      groups[finding.url].push(finding);
      return groups;
    }, {} as { [url: string]: ApiKeyFinding[] });
  }

  private getSeverityIcon(severity: string): string {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return icons[severity as keyof typeof icons] || '⚪';
  }
}