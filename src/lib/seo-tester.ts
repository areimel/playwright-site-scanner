import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';
import { StandardTestOutputHandler } from '../utils/test-output-handler.js';
import { OutputContext } from '../types/test-output-types.js';

interface SEOData {
  title: string;
  metaDescription: string;
  metaKeywords: string;
  headings: { [key: string]: string[] };
  images: { src: string; alt: string }[];
  links: { href: string; text: string; isExternal: boolean }[];
  openGraph: { [key: string]: string };
  canonicalUrl: string;
  robots: string;
  structuredData: any[];
}

export class SEOTester {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async runSEOScan(page: Page, pageUrl: string, sessionId: string): Promise<TestResult> {
    const pageName = StandardTestOutputHandler.getPageNameFromUrl(pageUrl);
    
    // Create initial test result using standardized system
    const testResult = this.sessionManager.createStandardTestResult('seo', 'pending');

    try {
      console.log(chalk.gray(`    🔍 Running SEO scan...`));

      const seoData = await this.extractSEOData(page);
      const seoReport = this.generateSEOReport(seoData, pageUrl);

      // Prepare output context for the SEO scan
      const context: OutputContext = {
        url: pageUrl,
        pageName
      };
      
      // Save using the standardized output system
      const saveResult = await this.sessionManager.saveTestOutput(seoReport, sessionId, 'seo', context);
      
      if (saveResult.success) {
        testResult.status = 'success';
        testResult.outputPath = saveResult.outputPath;
      } else {
        throw new Error(saveResult.error || 'Failed to save SEO report');
      }
      
      testResult.endTime = new Date();

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ SEO scan failed: ${testResult.error}`));
    }

    return testResult;
  }

  private async extractSEOData(page: Page): Promise<SEOData> {
    return await page.evaluate(() => {
      const seoData: SEOData = {
        title: document.title || '',
        metaDescription: '',
        metaKeywords: '',
        headings: {},
        images: [],
        links: [],
        openGraph: {},
        canonicalUrl: '',
        robots: '',
        structuredData: []
      };

      // Meta tags
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach((meta: HTMLMetaElement) => {
        const name = meta.getAttribute('name')?.toLowerCase();
        const property = meta.getAttribute('property')?.toLowerCase();
        const content = meta.getAttribute('content') || '';

        if (name === 'description') seoData.metaDescription = content;
        if (name === 'keywords') seoData.metaKeywords = content;
        if (name === 'robots') seoData.robots = content;
        
        if (property?.startsWith('og:')) {
          seoData.openGraph[property] = content;
        }
      });

      // Canonical URL
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (canonical) seoData.canonicalUrl = canonical.href;

      // Headings
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
        const elements = document.querySelectorAll(tag);
        seoData.headings[tag] = Array.from(elements).map((el: Element) => el.textContent?.trim() || '');
      });

      // Images
      const images = document.querySelectorAll('img');
      seoData.images = Array.from(images).map((img: HTMLImageElement) => ({
        src: img.src,
        alt: img.alt || ''
      }));

      // Links
      const links = document.querySelectorAll('a[href]');
      seoData.links = Array.from(links).map((link) => {
        const anchorLink = link as HTMLAnchorElement;
        const href = anchorLink.href;
        const text = anchorLink.textContent?.trim() || '';
        const isExternal = !href.startsWith(window.location.origin) && 
                          (href.startsWith('http') || href.startsWith('//'));
        
        return { href, text, isExternal };
      });

      // Structured data
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach((script) => {
        const scriptElement = script as HTMLScriptElement;
        try {
          const data = JSON.parse(scriptElement.textContent || '');
          seoData.structuredData.push(data);
        } catch (e) {
          // Invalid JSON, skip
        }
      });

      return seoData;
    });
  }

  private generateSEOReport(seoData: SEOData, pageUrl: string): string {
    let report = `# SEO Scan Report\n\n`;
    report += `**URL:** ${pageUrl}\n`;
    report += `**Scan Date:** ${new Date().toISOString()}\n\n`;

    // Title Analysis
    report += `## Title Tag\n`;
    if (seoData.title) {
      report += `**Title:** ${seoData.title}\n`;
      report += `**Length:** ${seoData.title.length} characters\n`;
      if (seoData.title.length < 30) {
        report += `⚠️ **Warning:** Title is too short (recommended: 30-60 characters)\n`;
      } else if (seoData.title.length > 60) {
        report += `⚠️ **Warning:** Title is too long (recommended: 30-60 characters)\n`;
      } else {
        report += `✅ **Good:** Title length is optimal\n`;
      }
    } else {
      report += `❌ **Error:** No title tag found\n`;
    }
    report += '\n';

    // Meta Description
    report += `## Meta Description\n`;
    if (seoData.metaDescription) {
      report += `**Description:** ${seoData.metaDescription}\n`;
      report += `**Length:** ${seoData.metaDescription.length} characters\n`;
      if (seoData.metaDescription.length < 120) {
        report += `⚠️ **Warning:** Meta description is too short (recommended: 120-160 characters)\n`;
      } else if (seoData.metaDescription.length > 160) {
        report += `⚠️ **Warning:** Meta description is too long (recommended: 120-160 characters)\n`;
      } else {
        report += `✅ **Good:** Meta description length is optimal\n`;
      }
    } else {
      report += `❌ **Error:** No meta description found\n`;
    }
    report += '\n';

    // Headings Analysis
    report += `## Heading Structure\n`;
    Object.entries(seoData.headings).forEach(([tag, headings]) => {
      if (headings.length > 0) {
        report += `**${tag.toUpperCase()}** (${headings.length}):\n`;
        headings.forEach(heading => {
          report += `- ${heading}\n`;
        });
        report += '\n';
      }
    });

    if (seoData.headings.h1?.length === 0) {
      report += `❌ **Error:** No H1 tag found\n`;
    } else if (seoData.headings.h1?.length > 1) {
      report += `⚠️ **Warning:** Multiple H1 tags found (${seoData.headings.h1.length})\n`;
    } else {
      report += `✅ **Good:** Single H1 tag found\n`;
    }
    report += '\n';

    // Images Analysis
    report += `## Images\n`;
    const imagesWithoutAlt = seoData.images.filter(img => !img.alt);
    report += `**Total Images:** ${seoData.images.length}\n`;
    report += `**Images without Alt Text:** ${imagesWithoutAlt.length}\n`;
    
    if (imagesWithoutAlt.length > 0) {
      report += `⚠️ **Warning:** ${imagesWithoutAlt.length} images missing alt text\n`;
      imagesWithoutAlt.slice(0, 5).forEach(img => {
        report += `- ${img.src}\n`;
      });
      if (imagesWithoutAlt.length > 5) {
        report += `... and ${imagesWithoutAlt.length - 5} more\n`;
      }
    } else if (seoData.images.length > 0) {
      report += `✅ **Good:** All images have alt text\n`;
    }
    report += '\n';

    // Links Analysis
    report += `## Links\n`;
    const externalLinks = seoData.links.filter(link => link.isExternal);
    report += `**Total Links:** ${seoData.links.length}\n`;
    report += `**External Links:** ${externalLinks.length}\n`;
    report += `**Internal Links:** ${seoData.links.length - externalLinks.length}\n\n`;

    // Open Graph
    if (Object.keys(seoData.openGraph).length > 0) {
      report += `## Open Graph Tags\n`;
      Object.entries(seoData.openGraph).forEach(([property, content]) => {
        report += `**${property}:** ${content}\n`;
      });
      report += '\n';
    }

    // Canonical URL
    report += `## Canonical URL\n`;
    if (seoData.canonicalUrl) {
      report += `**Canonical:** ${seoData.canonicalUrl}\n`;
      report += `✅ **Good:** Canonical URL is set\n`;
    } else {
      report += `⚠️ **Warning:** No canonical URL found\n`;
    }
    report += '\n';

    // Robots
    report += `## Robots Meta Tag\n`;
    if (seoData.robots) {
      report += `**Robots:** ${seoData.robots}\n`;
    } else {
      report += `**Robots:** Not specified (defaults to index, follow)\n`;
    }
    report += '\n';

    // Structured Data
    if (seoData.structuredData.length > 0) {
      report += `## Structured Data\n`;
      report += `**Schema.org scripts found:** ${seoData.structuredData.length}\n`;
      seoData.structuredData.forEach((data, index) => {
        const type = data['@type'] || 'Unknown';
        report += `- Schema ${index + 1}: ${type}\n`;
      });
      report += '\n';
    }

    return report;
  }
}