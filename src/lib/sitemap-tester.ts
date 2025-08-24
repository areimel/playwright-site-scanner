import { Page } from 'playwright';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { CrawleeSiteCrawler } from './crawlee-site-crawler.js';

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

export class SitemapTester {
  private sessionManager: SessionManager;
  private siteCrawler: CrawleeSiteCrawler;

  constructor() {
    this.sessionManager = new SessionManager();
    this.siteCrawler = new CrawleeSiteCrawler();
  }

  async generateSitemap(
    baseUrl: string,
    sessionId: string,
    crawlSite: boolean = true
  ): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'sitemap',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    🗺️  Generating XML sitemap...`));

      // Discover all pages
      let urls: string[];
      if (crawlSite) {
        console.log(chalk.gray(`      🕷️  Crawling site to discover pages...`));
        urls = await this.siteCrawler.crawlSite(baseUrl);
      } else {
        urls = [baseUrl];
      }

      console.log(chalk.gray(`      📄 Processing ${urls.length} URLs for sitemap`));

      // Generate sitemap entries
      const sitemapEntries = await this.generateSitemapEntries(urls, baseUrl);

      // Create XML sitemap
      const sitemapXml = this.generateSitemapXml(sitemapEntries);

      // Save sitemap to session directory
      const outputPath = await this.saveSitemap(sessionId, sitemapXml);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ Sitemap generated with ${sitemapEntries.length} URLs`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Sitemap generation failed: ${testResult.error}`));
    }

    return testResult;
  }

  /**
   * Generate sitemap using pre-crawled URLs (optimized version)
   * This eliminates redundant site crawling
   */
  async generateSitemapFromUrls(
    urls: string[],
    baseUrl: string,
    sessionId: string
  ): Promise<TestResult> {
    // Create initial test result using simple system
    const testResult = this.sessionManager.createTestResult('sitemap');

    try {
      console.log(chalk.gray(`    🗺️  Generating XML sitemap from ${urls.length} pre-crawled URLs...`));

      // Generate sitemap entries using provided URLs
      const sitemapEntries = await this.generateSitemapEntries(urls, baseUrl);

      // Create XML sitemap
      const sitemapXml = this.generateSitemapXml(sitemapEntries);

      // Generate output path using simple canonical method (site-wide file)
      const filename = 'sitemap.xml';
      const outputPath = this.sessionManager.buildFilePath(sessionId, '', '', filename);
      
      // Ensure directory exists and save file
      await this.sessionManager.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, sitemapXml, 'utf8');
      
      testResult.status = 'success';
      testResult.outputPath = outputPath;
      
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ Sitemap generated with ${sitemapEntries.length} URLs (no redundant crawling)`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Sitemap generation failed: ${testResult.error}`));
    }

    return testResult;
  }

  private async generateSitemapEntries(urls: string[], baseUrl: string): Promise<SitemapEntry[]> {
    const baseUrlObj = new URL(baseUrl);
    const entries: SitemapEntry[] = [];

    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        
        // Calculate priority based on URL depth and type
        const priority = this.calculatePriority(url, baseUrl);
        const changefreq = this.determineChangeFrequency(url);

        entries.push({
          url: url,
          lastmod: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          changefreq,
          priority
        });

      } catch (error) {
        console.log(chalk.yellow(`      ⚠️  Skipping invalid URL: ${url}`));
      }
    }

    // Sort entries by priority (highest first) then by URL length (shorter first)
    entries.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.url.length - b.url.length;
    });

    return entries;
  }

  private calculatePriority(url: string, baseUrl: string): number {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);

      // Homepage gets highest priority
      if (url === baseUrl || urlObj.pathname === '/') {
        return 1.0;
      }

      // Calculate depth based on path segments
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      const depth = pathSegments.length;

      // Priority decreases with depth
      if (depth === 1) return 0.8;
      if (depth === 2) return 0.6;
      if (depth === 3) return 0.4;
      return 0.2;

    } catch (error) {
      return 0.2; // Default low priority for problematic URLs
    }
  }

  private determineChangeFrequency(url: string): 'daily' | 'weekly' | 'monthly' | 'yearly' {
    const urlLower = url.toLowerCase();

    // Blog/news content typically changes more frequently
    if (urlLower.includes('/blog/') || 
        urlLower.includes('/news/') || 
        urlLower.includes('/post/') ||
        urlLower.includes('/article/')) {
      return 'weekly';
    }

    // Product or service pages
    if (urlLower.includes('/product/') || 
        urlLower.includes('/service/') ||
        urlLower.includes('/category/')) {
      return 'monthly';
    }

    // Static pages like about, contact, etc.
    if (urlLower.includes('/about') || 
        urlLower.includes('/contact') ||
        urlLower.includes('/privacy') ||
        urlLower.includes('/terms')) {
      return 'yearly';
    }

    // Default to monthly for most pages
    return 'monthly';
  }

  private generateSitemapXml(entries: SitemapEntry[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const entry of entries) {
      xml += '  <url>\n';
      xml += `    <loc>${this.escapeXml(entry.url)}</loc>\n`;
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>\n';
    return xml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async saveSitemap(sessionId: string, sitemapXml: string): Promise<string> {
    const sessionPath = path.join(this.sessionManager['outputDir'], sessionId);
    const sitemapPath = path.join(sessionPath, 'sitemap.xml');
    
    await fs.writeFile(sitemapPath, sitemapXml, 'utf8');
    return sitemapPath;
  }

  async validateSitemap(sitemapPath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(sitemapPath, 'utf8');
      
      // Basic XML validation
      if (!content.includes('<?xml') || !content.includes('<urlset') || !content.includes('</urlset>')) {
        return false;
      }

      // Check for required elements
      const urlMatches = content.match(/<url>/g);
      const locMatches = content.match(/<loc>/g);
      
      return !!(urlMatches && locMatches && urlMatches.length === locMatches.length);

    } catch (error) {
      return false;
    }
  }

  getSitemapStats(sitemapPath: string): Promise<{ urlCount: number; fileSize: number }> {
    return fs.readFile(sitemapPath, 'utf8').then(content => {
      const urlMatches = content.match(/<url>/g);
      const urlCount = urlMatches ? urlMatches.length : 0;
      const fileSize = Buffer.byteLength(content, 'utf8');
      
      return { urlCount, fileSize };
    });
  }
}