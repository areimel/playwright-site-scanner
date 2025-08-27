import { promises as fs } from 'fs';
import path from 'path';
import { TestResultData, PageResult, TestResult } from '../../types/index.js';

/**
 * Simple RAG (Retrieval-Augmented Generation) system for test results
 * This provides context-aware information retrieval for the chatbot
 */
export class RAGSystem {
  
  /**
   * Extract relevant context from test data based on user query
   */
  static extractRelevantContext(query: string, testData: TestResultData): string {
    const lowerQuery = query.toLowerCase();
    let context = '';

    // SEO-related queries
    if (this.isQueryAbout(lowerQuery, ['seo', 'meta', 'title', 'description', 'heading', 'keywords'])) {
      context += this.extractSEOContext(testData);
    }

    // Accessibility-related queries
    if (this.isQueryAbout(lowerQuery, ['accessibility', 'a11y', 'wcag', 'screen reader', 'contrast', 'alt text'])) {
      context += this.extractAccessibilityContext(testData);
    }

    // Performance-related queries
    if (this.isQueryAbout(lowerQuery, ['performance', 'speed', 'loading', 'optimize', 'images', 'size'])) {
      context += this.extractPerformanceContext(testData);
    }

    // Content-related queries
    if (this.isQueryAbout(lowerQuery, ['content', 'text', 'words', 'structure', 'navigation'])) {
      context += this.extractContentContext(testData);
    }

    // Security-related queries
    if (this.isQueryAbout(lowerQuery, ['security', 'api key', 'token', 'vulnerability', 'exposed'])) {
      context += this.extractSecurityContext(testData);
    }

    // Page-specific queries
    if (this.isQueryAbout(lowerQuery, ['page', 'url', 'specific', 'individual'])) {
      context += this.extractPageSpecificContext(testData, lowerQuery);
    }

    // Issues and problems
    if (this.isQueryAbout(lowerQuery, ['issue', 'problem', 'error', 'fix', 'improve', 'wrong'])) {
      context += this.extractIssuesContext(testData);
    }

    // Priority and recommendations
    if (this.isQueryAbout(lowerQuery, ['priority', 'recommend', 'should', 'important', 'first'])) {
      context += this.extractPriorityContext(testData);
    }

    return context.trim() || 'General website analysis context available.';
  }

  /**
   * Check if query is about specific topics
   */
  private static isQueryAbout(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => query.includes(keyword));
  }

  /**
   * Extract SEO-related context
   */
  private static extractSEOContext(testData: TestResultData): string {
    let context = '\n=== SEO ANALYSIS CONTEXT ===\n';
    
    const seoTests = testData.testResults?.filter(test => test.testType === 'seo') || [];
    
    if (seoTests.length > 0) {
      context += `SEO tests completed on ${seoTests.length} page(s).\n`;
      context += `Results available for detailed SEO analysis including:\n`;
      context += `- Title tags and meta descriptions\n`;
      context += `- Heading structure (H1, H2, etc.)\n`;
      context += `- Image alt text analysis\n`;
      context += `- Internal and external link analysis\n`;
      context += `- Open Graph tags\n`;
      context += `- Structured data (Schema.org)\n`;
    }

    return context;
  }

  /**
   * Extract accessibility-related context
   */
  private static extractAccessibilityContext(testData: TestResultData): string {
    let context = '\n=== ACCESSIBILITY ANALYSIS CONTEXT ===\n';
    
    const accessibilityTests = testData.testResults?.filter(test => test.testType === 'accessibility') || [];
    
    if (accessibilityTests.length > 0) {
      context += `Accessibility tests completed on ${accessibilityTests.length} page(s).\n`;
      context += `WCAG compliance analysis available including:\n`;
      context += `- Color contrast issues\n`;
      context += `- Keyboard navigation support\n`;
      context += `- Screen reader compatibility\n`;
      context += `- Form label associations\n`;
      context += `- Image alt text compliance\n`;
      context += `- Heading hierarchy issues\n`;
    }

    return context;
  }

  /**
   * Extract performance-related context
   */
  private static extractPerformanceContext(testData: TestResultData): string {
    let context = '\n=== PERFORMANCE ANALYSIS CONTEXT ===\n';
    
    // Count images from content scraping or SEO tests
    let totalImages = 0;
    testData.pageResults?.forEach(page => {
      // This is an approximation - actual image count would come from test results
      totalImages += 10; // Placeholder
    });

    if (testData.pageResults && testData.pageResults.length > 0) {
      context += `Performance insights available for ${testData.pageResults.length} page(s).\n`;
      context += `Analysis includes:\n`;
      context += `- Image optimization opportunities\n`;
      context += `- Page load time factors\n`;
      context += `- Resource optimization suggestions\n`;
      context += `- Mobile performance considerations\n`;
    }

    return context;
  }

  /**
   * Extract content-related context
   */
  private static extractContentContext(testData: TestResultData): string {
    let context = '\n=== CONTENT ANALYSIS CONTEXT ===\n';
    
    const contentTests = testData.testResults?.filter(test => test.testType === 'content-scraping') || [];
    
    if (contentTests.length > 0) {
      context += `Content analysis completed on ${contentTests.length} page(s).\n`;
      context += `Content structure analysis includes:\n`;
      context += `- Page titles and headings\n`;
      context += `- Text content organization\n`;
      context += `- Navigation structure\n`;
      context += `- Content categorization\n`;
      context += `- Word count and readability\n`;
    }

    return context;
  }

  /**
   * Extract security-related context
   */
  private static extractSecurityContext(testData: TestResultData): string {
    let context = '\n=== SECURITY ANALYSIS CONTEXT ===\n';
    
    const securityTests = testData.testResults?.filter(test => test.testType === 'api-key-scan') || [];
    
    if (securityTests.length > 0) {
      context += `Security scans completed on ${securityTests.length} page(s).\n`;
      context += `Security analysis includes:\n`;
      context += `- API key exposure detection\n`;
      context += `- Authentication token scanning\n`;
      context += `- Sensitive data exposure\n`;
      context += `- Configuration security issues\n`;
    }

    return context;
  }

  /**
   * Extract page-specific context
   */
  private static extractPageSpecificContext(testData: TestResultData, query: string): string {
    let context = '\n=== PAGE-SPECIFIC CONTEXT ===\n';
    
    if (testData.pageResults) {
      context += `Analysis available for ${testData.pageResults.length} page(s):\n`;
      testData.pageResults.forEach((page, index) => {
        context += `${index + 1}. ${page.url} (${page.tests.length} tests)\n`;
      });
    }

    return context;
  }

  /**
   * Extract issues and problems context
   */
  private static extractIssuesContext(testData: TestResultData): string {
    let context = '\n=== ISSUES AND PROBLEMS CONTEXT ===\n';
    
    const failedTests = testData.testResults?.filter(test => test.status === 'failed') || [];
    const successfulTests = testData.testResults?.filter(test => test.status === 'success') || [];
    
    if (failedTests.length > 0) {
      context += `${failedTests.length} test(s) failed and need attention.\n`;
      context += `${successfulTests.length} test(s) completed successfully.\n`;
    }

    context += `Common issues that may need fixing:\n`;
    context += `- Missing or inadequate meta descriptions\n`;
    context += `- Images without alt text\n`;
    context += `- Accessibility violations\n`;
    context += `- Poor heading structure\n`;
    context += `- Performance optimization opportunities\n`;

    return context;
  }

  /**
   * Extract priority and recommendations context
   */
  private static extractPriorityContext(testData: TestResultData): string {
    let context = '\n=== PRIORITY RECOMMENDATIONS CONTEXT ===\n';
    
    context += `Prioritization framework for improvements:\n`;
    context += `1. HIGH PRIORITY: SEO fundamentals (title tags, meta descriptions)\n`;
    context += `2. HIGH PRIORITY: Accessibility violations (WCAG compliance)\n`;
    context += `3. MEDIUM PRIORITY: Image optimization and alt text\n`;
    context += `4. MEDIUM PRIORITY: Content structure and headings\n`;
    context += `5. LOW PRIORITY: Advanced optimizations and enhancements\n`;
    
    if (testData.pageResults) {
      context += `\nRecommendations based on ${testData.pageResults.length} analyzed page(s).\n`;
    }

    return context;
  }

  /**
   * Generate summary statistics for context
   */
  static generateContextSummary(testData: TestResultData): string {
    let summary = '=== TEST RESULTS SUMMARY ===\n';
    
    if (testData.pageResults) {
      summary += `Total pages analyzed: ${testData.pageResults.length}\n`;
    }
    
    if (testData.testResults) {
      const testTypes = Array.from(new Set(testData.testResults.map(t => t.testType)));
      summary += `Test types completed: ${testTypes.join(', ')}\n`;
      
      const successful = testData.testResults.filter(t => t.status === 'success').length;
      const failed = testData.testResults.filter(t => t.status === 'failed').length;
      
      summary += `Successful tests: ${successful}\n`;
      summary += `Failed tests: ${failed}\n`;
    }
    
    return summary;
  }

  /**
   * Extract specific file content for context (if needed)
   */
  static async loadFileContent(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Truncate very large files
      if (content.length > 10000) {
        return content.substring(0, 10000) + '\n\n[Content truncated for brevity...]';
      }
      
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get relevant keywords from query for better context matching
   */
  static extractKeywords(query: string): string[] {
    const commonWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'of', 'in', 'for', 'with', 'by'];
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return Array.from(new Set(words)); // Remove duplicates
  }

  /**
   * Build a comprehensive context prompt for AI
   */
  static buildContextPrompt(query: string, testData: TestResultData): string {
    const relevantContext = this.extractRelevantContext(query, testData);
    const summary = this.generateContextSummary(testData);
    
    return `${summary}\n${relevantContext}\n\nUser Query: ${query}\n\nProvide a helpful, specific response based on the available test data context.`;
  }
}