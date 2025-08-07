import { Page } from 'playwright';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { TestResult } from '../types/index';
import { SessionManager } from '../utils/session-manager';
import { SessionDataManager } from '../utils/session-data-store';
import { CrawleeSiteCrawler } from './crawlee-site-crawler';

interface PageSummary {
  url: string;
  title: string;
  description: string;
  headings: string[];
  wordCount: number;
  imageCount: number;
  linkCount: number;
  lastModified?: string;
  contentType: 'homepage' | 'blog' | 'product' | 'service' | 'about' | 'contact' | 'generic';
  depth: number;
}

interface SiteSummaryData {
  baseUrl: string;
  totalPages: number;
  generatedAt: string;
  pages: PageSummary[];
  statistics: {
    totalWords: number;
    totalImages: number;
    totalLinks: number;
    averageWordsPerPage: number;
    contentTypeDistribution: { [key: string]: number };
    depthDistribution: { [key: number]: number };
  };
  navigation: {
    maxDepth: number;
    mainSections: string[];
    orphanPages: string[];
  };
}

export class SiteSummaryTester {
  private sessionManager: SessionManager;
  private siteCrawler: CrawleeSiteCrawler;

  constructor() {
    this.sessionManager = new SessionManager();
    this.siteCrawler = new CrawleeSiteCrawler();
  }

  async generateSiteSummary(
    baseUrl: string,
    sessionId: string,
    crawlSite: boolean = true
  ): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'site-summary',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    📊 Generating site summary report...`));

      // Discover all pages
      let urls: string[];
      if (crawlSite) {
        console.log(chalk.gray(`      🕷️  Crawling site to discover pages...`));
        urls = await this.siteCrawler.crawlSite(baseUrl);
      } else {
        urls = [baseUrl];
      }

      console.log(chalk.gray(`      📄 Analyzing ${urls.length} pages for summary...`));

      // Analyze each page to get summary data
      const pageSummaries = await this.analyzePages(urls, baseUrl);

      // Generate comprehensive site summary
      const siteSummary = this.generateSiteSummaryData(pageSummaries, baseUrl);

      // Create summary report markdown
      const summaryMarkdown = this.generateSummaryMarkdown(siteSummary);

      // Save summary report
      const outputPath = await this.saveSummaryReport(sessionId, summaryMarkdown);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ Site summary completed for ${pageSummaries.length} pages`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Site summary failed: ${testResult.error}`));
    }

    return testResult;
  }

  /**
   * Generate site summary using real scraped content from SessionDataStore
   * This replaces the old method that used placeholder data
   */
  async generateSiteSummaryFromStore(dataManager: SessionDataManager): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'site-summary',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    📊 Generating site summary from real content data...`));

      // Use real page summaries from the data manager
      const pageSummaries = dataManager.generatePageSummaries();
      const baseUrl = dataManager.baseUrl;

      console.log(chalk.gray(`      📄 Analyzing ${pageSummaries.length} pages with real content...`));

      // Generate comprehensive site summary using real data
      const siteSummary = this.generateSiteSummaryData(pageSummaries, baseUrl);

      // Create summary report markdown
      const summaryMarkdown = this.generateSummaryMarkdown(siteSummary);

      // Save summary report
      const outputPath = await this.saveSummaryReport(dataManager.sessionId, summaryMarkdown);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ Site summary completed with real data from ${pageSummaries.length} pages`));
      console.log(chalk.green(`       Total words: ${siteSummary.statistics.totalWords.toLocaleString()}`));
      console.log(chalk.green(`       Average words per page: ${siteSummary.statistics.averageWordsPerPage}`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Site summary failed: ${testResult.error}`));
    }

    return testResult;
  }

  private async analyzePages(urls: string[], baseUrl: string): Promise<PageSummary[]> {
    const summaries: PageSummary[] = [];
    
    // We'll use a simplified approach since we don't have access to individual page objects
    // In a real implementation, you'd want to navigate to each page individually
    // For now, we'll create summaries based on URL analysis and any cached data

    for (const url of urls) {
      try {
        console.log(chalk.gray(`        🔍 Analyzing: ${url}`));
        
        const summary: PageSummary = {
          url,
          title: this.extractTitleFromUrl(url),
          description: `Page at ${url}`, // Placeholder - would be extracted from actual page
          headings: [], // Would be populated from actual page analysis
          wordCount: 0, // Would be calculated from actual content
          imageCount: 0, // Would be counted from actual page
          linkCount: 0, // Would be counted from actual page
          contentType: this.determineContentType(url),
          depth: this.calculateUrlDepth(url, baseUrl)
        };

        summaries.push(summary);
      } catch (error) {
        console.log(chalk.yellow(`        ⚠️  Could not analyze ${url}: ${error}`));
      }
    }

    return summaries;
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length === 0) {
        return 'Home';
      }
      
      const lastSegment = pathSegments[pathSegments.length - 1];
      
      // Convert kebab-case or snake_case to title case
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
        
    } catch (error) {
      return 'Unknown Page';
    }
  }

  private determineContentType(url: string): PageSummary['contentType'] {
    const urlLower = url.toLowerCase();
    
    // Homepage detection
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname === '/' || urlObj.pathname === '') {
        return 'homepage';
      }
    } catch (error) {
      // Fall through to other checks
    }

    // Blog/news content
    if (urlLower.includes('/blog/') || 
        urlLower.includes('/news/') || 
        urlLower.includes('/post/') ||
        urlLower.includes('/article/')) {
      return 'blog';
    }

    // Product pages
    if (urlLower.includes('/product/') || 
        urlLower.includes('/shop/') ||
        urlLower.includes('/store/')) {
      return 'product';
    }

    // Service pages
    if (urlLower.includes('/service/') || 
        urlLower.includes('/solution/')) {
      return 'service';
    }

    // About pages
    if (urlLower.includes('/about')) {
      return 'about';
    }

    // Contact pages
    if (urlLower.includes('/contact')) {
      return 'contact';
    }

    return 'generic';
  }

  private calculateUrlDepth(url: string, baseUrl: string): number {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      return pathSegments.length;
    } catch (error) {
      return 0;
    }
  }

  private generateSiteSummaryData(pages: PageSummary[], baseUrl: string): SiteSummaryData {
    // Calculate statistics
    const totalWords = pages.reduce((sum, page) => sum + page.wordCount, 0);
    const totalImages = pages.reduce((sum, page) => sum + page.imageCount, 0);
    const totalLinks = pages.reduce((sum, page) => sum + page.linkCount, 0);
    const averageWordsPerPage = pages.length > 0 ? Math.round(totalWords / pages.length) : 0;

    // Content type distribution
    const contentTypeDistribution: { [key: string]: number } = {};
    pages.forEach(page => {
      contentTypeDistribution[page.contentType] = (contentTypeDistribution[page.contentType] || 0) + 1;
    });

    // Depth distribution
    const depthDistribution: { [key: number]: number } = {};
    pages.forEach(page => {
      depthDistribution[page.depth] = (depthDistribution[page.depth] || 0) + 1;
    });

    // Navigation analysis
    const maxDepth = Math.max(...pages.map(p => p.depth));
    const mainSections = this.extractMainSections(pages, baseUrl);
    const orphanPages = this.findOrphanPages(pages);

    return {
      baseUrl,
      totalPages: pages.length,
      generatedAt: new Date().toISOString(),
      pages: pages.sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url)),
      statistics: {
        totalWords,
        totalImages,
        totalLinks,
        averageWordsPerPage,
        contentTypeDistribution,
        depthDistribution
      },
      navigation: {
        maxDepth,
        mainSections,
        orphanPages
      }
    };
  }

  private extractMainSections(pages: PageSummary[], baseUrl: string): string[] {
    const sections = new Set<string>();
    
    pages.forEach(page => {
      try {
        const urlObj = new URL(page.url);
        const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
        
        if (pathSegments.length > 0) {
          sections.add(pathSegments[0]);
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });

    return Array.from(sections).sort();
  }

  private findOrphanPages(pages: PageSummary[]): string[] {
    // Simple heuristic: pages at depth > 3 with generic content type might be orphans
    return pages
      .filter(page => page.depth > 3 && page.contentType === 'generic')
      .map(page => page.url);
  }

  private generateSummaryMarkdown(summary: SiteSummaryData): string {
    let markdown = `# Site Summary Report\n\n`;
    
    markdown += `**Website:** ${summary.baseUrl}\n`;
    markdown += `**Total Pages:** ${summary.totalPages}\n`;
    markdown += `**Generated:** ${new Date(summary.generatedAt).toLocaleString()}\n\n`;

    markdown += `---\n\n`;

    // Overview statistics
    markdown += `## Overview Statistics\n\n`;
    markdown += `- **Total Pages Analyzed:** ${summary.totalPages}\n`;
    markdown += `- **Total Word Count:** ${summary.statistics.totalWords.toLocaleString()}\n`;
    markdown += `- **Average Words per Page:** ${summary.statistics.averageWordsPerPage}\n`;
    markdown += `- **Total Images:** ${summary.statistics.totalImages}\n`;
    markdown += `- **Total Links:** ${summary.statistics.totalLinks}\n`;
    markdown += `- **Maximum Site Depth:** ${summary.navigation.maxDepth} levels\n\n`;

    // Content type distribution
    markdown += `## Content Type Distribution\n\n`;
    Object.entries(summary.statistics.contentTypeDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        const percentage = Math.round((count / summary.totalPages) * 100);
        markdown += `- **${type.charAt(0).toUpperCase() + type.slice(1)}:** ${count} pages (${percentage}%)\n`;
      });
    markdown += '\n';

    // Site depth analysis
    markdown += `## Site Depth Analysis\n\n`;
    Object.entries(summary.statistics.depthDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([depth, count]) => {
        const level = parseInt(depth);
        const levelName = level === 0 ? 'Root' : `Level ${level}`;
        markdown += `- **${levelName}:** ${count} pages\n`;
      });
    markdown += '\n';

    // Main sections
    if (summary.navigation.mainSections.length > 0) {
      markdown += `## Main Site Sections\n\n`;
      summary.navigation.mainSections.forEach(section => {
        markdown += `- ${section}\n`;
      });
      markdown += '\n';
    }

    // Page inventory
    markdown += `## Page Inventory\n\n`;
    
    // Group pages by content type
    const pagesByType: { [key: string]: PageSummary[] } = {};
    summary.pages.forEach(page => {
      if (!pagesByType[page.contentType]) {
        pagesByType[page.contentType] = [];
      }
      pagesByType[page.contentType].push(page);
    });

    Object.entries(pagesByType).forEach(([type, pages]) => {
      markdown += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Pages\n\n`;
      pages.forEach(page => {
        markdown += `#### ${page.title}\n`;
        markdown += `- **URL:** ${page.url}\n`;
        markdown += `- **Depth:** Level ${page.depth}\n`;
        if (page.description && page.description !== `Page at ${page.url}`) {
          markdown += `- **Description:** ${page.description}\n`;
        }
        if (page.wordCount > 0) {
          markdown += `- **Word Count:** ${page.wordCount}\n`;
        }
        if (page.imageCount > 0) {
          markdown += `- **Images:** ${page.imageCount}\n`;
        }
        if (page.linkCount > 0) {
          markdown += `- **Links:** ${page.linkCount}\n`;
        }
        markdown += '\n';
      });
    });

    // Orphan pages warning
    if (summary.navigation.orphanPages.length > 0) {
      markdown += `## Potential Orphan Pages\n\n`;
      markdown += `The following pages may be difficult to discover through normal navigation:\n\n`;
      summary.navigation.orphanPages.forEach(url => {
        markdown += `- ${url}\n`;
      });
      markdown += '\n';
    }

    // Recommendations
    markdown += `## Recommendations\n\n`;
    
    if (summary.navigation.maxDepth > 4) {
      markdown += `- **Navigation Depth:** Consider flattening the site structure. Current maximum depth is ${summary.navigation.maxDepth} levels.\n`;
    }
    
    if (summary.statistics.averageWordsPerPage < 300) {
      markdown += `- **Content Length:** Average page content is quite short (${summary.statistics.averageWordsPerPage} words). Consider adding more detailed content.\n`;
    }
    
    if (summary.navigation.orphanPages.length > 0) {
      markdown += `- **Orphan Pages:** ${summary.navigation.orphanPages.length} pages may be difficult to discover. Consider improving internal linking.\n`;
    }

    const homepageCount = summary.statistics.contentTypeDistribution['homepage'] || 0;
    if (homepageCount === 0) {
      markdown += `- **Homepage:** No clear homepage detected. Ensure your main page is properly structured.\n`;
    }

    return markdown;
  }

  private async saveSummaryReport(sessionId: string, content: string): Promise<string> {
    const outputPath = path.join(
      this.sessionManager['outputDir'],
      sessionId,
      'site-summary.md'
    );
    
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }

  async getSummaryStats(summaryPath: string): Promise<{
    pageCount: number;
    sectionCount: number;
    totalWords: number;
    reportSize: number;
  }> {
    try {
      const content = await fs.readFile(summaryPath, 'utf8');
      
      const pageMatches = content.match(/- \*\*URL:\*\*/g);
      const pageCount = pageMatches ? pageMatches.length : 0;
      
      const sectionMatches = content.match(/^###\s/gm);
      const sectionCount = sectionMatches ? sectionMatches.length : 0;
      
      const wordMatches = content.match(/\*\*Total Word Count:\*\* ([\d,]+)/);
      const totalWords = wordMatches ? parseInt(wordMatches[1].replace(/,/g, '')) : 0;
      
      const reportSize = Buffer.byteLength(content, 'utf8');
      
      return { pageCount, sectionCount, totalWords, reportSize };
    } catch (error) {
      return { pageCount: 0, sectionCount: 0, totalWords: 0, reportSize: 0 };
    }
  }
}