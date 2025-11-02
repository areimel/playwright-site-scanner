import chalk from 'chalk';
import { TestResult, ScrapedContent, SitemapEntry } from '../types/index.js';
import { SessionDataManager } from '../utils/session-data-store.js';
import { SessionManager } from '../utils/session-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RepeatedElements {
  headings: Set<string>;
  paragraphs: Set<string>;
  linkTexts: Set<string>;
}

interface HierarchicalPage {
  url: string;
  title: string;
  content: ScrapedContent;
  depth: number;
  priority: number;
}

interface LlmsTxtMetadata {
  totalPages: number;
  totalWords: number;
  deduplicatedElements: {
    headings: number;
    paragraphs: number;
    linkTexts: number;
  };
  sizeKB: number;
  generatedAt: string;
  processingTime: number;
}

/**
 * LLMs.txt Generator
 *
 * Generates a single llms.txt file following the llmstxt.org standard.
 * Compiles all scraped content with intelligent deduplication and
 * sitemap-based hierarchical organization.
 */
export class LlmsTxtGenerator {
  private sessionManager: SessionManager;
  private readonly REPETITION_THRESHOLD = 0.7; // 70% of pages
  private readonly SHORT_TEXT_THRESHOLD = 50; // words
  private readonly TARGET_MAX_SIZE_KB = 150;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  /**
   * Main method to generate llms.txt file
   */
  async generateLlmsTxt(dataManager: SessionDataManager): Promise<TestResult> {
    const sessionId = dataManager.sessionId;
    const urls = dataManager.getUrls();
    const startTime = new Date();
    console.log(chalk.cyan('  📄 Generating llms.txt file...'));

    const testResult: TestResult = {
      testType: 'llms-txt',
      status: 'pending',
      startTime
    };

    try {
      // 1. Gather all scraped content
      console.log(chalk.gray('    🔍 Gathering scraped content...'));
      const allContent = await this.gatherScrapedContent(dataManager, urls);

      if (allContent.size === 0) {
        throw new Error('No scraped content found. Ensure content-scraping test ran successfully.');
      }

      console.log(chalk.gray(`    ✓ Found content for ${allContent.size} pages`));

      // 2. Get sitemap entries for organization
      const sitemapEntries = await this.getSitemapEntries(dataManager);
      console.log(chalk.gray(`    ✓ Loaded sitemap with ${sitemapEntries.length} entries`));

      // 3. Detect repeated elements across pages
      console.log(chalk.gray('    🔍 Detecting repeated elements...'));
      const repeatedElements = this.detectRepeatedContent(Array.from(allContent.values()));
      console.log(chalk.gray(`    ✓ Found ${repeatedElements.headings.size} repeated headings, ${repeatedElements.paragraphs.size} repeated paragraphs`));

      // 4. Deduplicate content
      console.log(chalk.gray('    🧹 Deduplicating content...'));
      const deduplicatedContent = this.deduplicateAllContent(allContent, repeatedElements);

      // 5. Organize hierarchically
      console.log(chalk.gray('    📊 Organizing content hierarchy...'));
      const hierarchy = this.organizeByHierarchy(deduplicatedContent, sitemapEntries, urls[0]);

      // 6. Generate markdown
      console.log(chalk.gray('    ✍️  Generating llms.txt markdown...'));
      const markdown = this.generateMarkdown(hierarchy, urls[0]);

      // 7. Calculate metadata
      const totalWords = this.countWords(markdown);
      const sizeKB = Buffer.byteLength(markdown, 'utf8') / 1024;

      // 8. Save llms.txt file
      const outputPath = path.join(
        this.sessionManager.getSessionDirectoryPath(sessionId),
        'llms.txt'
      );
      await fs.writeFile(outputPath, markdown, 'utf8');

      // 9. Save metadata
      const metadata: LlmsTxtMetadata = {
        totalPages: allContent.size,
        totalWords,
        deduplicatedElements: {
          headings: repeatedElements.headings.size,
          paragraphs: repeatedElements.paragraphs.size,
          linkTexts: repeatedElements.linkTexts.size
        },
        sizeKB: Math.round(sizeKB * 100) / 100,
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime.getTime()
      };

      const metadataPath = path.join(
        this.sessionManager.getSessionDirectoryPath(sessionId),
        'llms-txt-metadata.json'
      );
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      console.log(chalk.green(`    ✅ Generated llms.txt (${Math.round(sizeKB)}KB, ${totalWords.toLocaleString()} words)`));

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      return testResult;
    } catch (error) {
      console.error(chalk.red(`    ❌ Failed to generate llms.txt: ${error}`));
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.endTime = new Date();
      return testResult;
    }
  }

  /**
   * Gather all scraped content from the session
   */
  private async gatherScrapedContent(
    dataManager: SessionDataManager,
    urls: string[]
  ): Promise<Map<string, ScrapedContent>> {
    const contentMap = new Map<string, ScrapedContent>();

    for (const url of urls) {
      try {
        const content = dataManager.getScrapedContent(url);
        if (content) {
          contentMap.set(url, content);
        }
      } catch (error) {
        console.warn(chalk.yellow(`    ⚠️  Could not load content for ${url}`));
      }
    }

    return contentMap;
  }

  /**
   * Get sitemap entries for organization
   */
  private async getSitemapEntries(dataManager: SessionDataManager): Promise<SitemapEntry[]> {
    try {
      return dataManager.getSitemapEntries();
    } catch (error) {
      console.warn(chalk.yellow('    ⚠️  Could not load sitemap, using default organization'));
      return [];
    }
  }

  /**
   * Detect repeated content across all pages
   */
  private detectRepeatedContent(allContent: ScrapedContent[]): RepeatedElements {
    const totalPages = allContent.length;
    const threshold = Math.ceil(totalPages * this.REPETITION_THRESHOLD);

    // Count frequency of each heading
    const headingFrequency = new Map<string, number>();
    const paragraphFrequency = new Map<string, number>();
    const linkTextFrequency = new Map<string, number>();

    for (const content of allContent) {
      // Count headings
      const seenHeadings = new Set<string>();
      for (const heading of content.headings) {
        const normalizedText = this.normalizeText(heading.text);
        if (normalizedText && !seenHeadings.has(normalizedText)) {
          seenHeadings.add(normalizedText);
          headingFrequency.set(normalizedText, (headingFrequency.get(normalizedText) || 0) + 1);
        }
      }

      // Count paragraphs (only short ones that might be boilerplate)
      const seenParagraphs = new Set<string>();
      for (const para of content.paragraphs) {
        const normalizedText = this.normalizeText(para);
        const wordCount = normalizedText.split(/\s+/).length;
        if (normalizedText && wordCount < this.SHORT_TEXT_THRESHOLD && !seenParagraphs.has(normalizedText)) {
          seenParagraphs.add(normalizedText);
          paragraphFrequency.set(normalizedText, (paragraphFrequency.get(normalizedText) || 0) + 1);
        }
      }

      // Count link texts
      const seenLinks = new Set<string>();
      for (const link of content.links) {
        const normalizedText = this.normalizeText(link.text);
        if (normalizedText && !seenLinks.has(normalizedText)) {
          seenLinks.add(normalizedText);
          linkTextFrequency.set(normalizedText, (linkTextFrequency.get(normalizedText) || 0) + 1);
        }
      }
    }

    // Identify elements that appear on >= threshold pages
    const repeatedHeadings = new Set<string>();
    const repeatedParagraphs = new Set<string>();
    const repeatedLinkTexts = new Set<string>();

    headingFrequency.forEach((count, text) => {
      if (count >= threshold) {
        repeatedHeadings.add(text);
      }
    });

    paragraphFrequency.forEach((count, text) => {
      if (count >= threshold) {
        repeatedParagraphs.add(text);
      }
    });

    linkTextFrequency.forEach((count, text) => {
      if (count >= threshold) {
        repeatedLinkTexts.add(text);
      }
    });

    return {
      headings: repeatedHeadings,
      paragraphs: repeatedParagraphs,
      linkTexts: repeatedLinkTexts
    };
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Deduplicate content for all pages
   */
  private deduplicateAllContent(
    contentMap: Map<string, ScrapedContent>,
    repeatedElements: RepeatedElements
  ): Map<string, ScrapedContent> {
    const deduplicatedMap = new Map<string, ScrapedContent>();

    for (const [url, content] of contentMap) {
      deduplicatedMap.set(url, this.deduplicatePageContent(content, repeatedElements));
    }

    return deduplicatedMap;
  }

  /**
   * Remove repeated elements from a single page's content
   */
  private deduplicatePageContent(
    content: ScrapedContent,
    repeatedElements: RepeatedElements
  ): ScrapedContent {
    return {
      ...content,
      headings: content.headings.filter(h =>
        !repeatedElements.headings.has(this.normalizeText(h.text))
      ),
      paragraphs: content.paragraphs.filter(p =>
        !repeatedElements.paragraphs.has(this.normalizeText(p))
      ),
      links: content.links.filter(l =>
        !repeatedElements.linkTexts.has(this.normalizeText(l.text))
      )
    };
  }

  /**
   * Organize content into hierarchical structure based on sitemap
   */
  private organizeByHierarchy(
    contentMap: Map<string, ScrapedContent>,
    sitemapEntries: SitemapEntry[],
    baseUrl: string
  ): HierarchicalPage[] {
    const pages: HierarchicalPage[] = [];

    // Create a map of URL to sitemap entry for quick lookup
    const sitemapMap = new Map<string, SitemapEntry>();
    for (const entry of sitemapEntries) {
      sitemapMap.set(entry.url, entry);
    }

    // Build hierarchy
    for (const [url, content] of contentMap) {
      const sitemapEntry = sitemapMap.get(url);
      const depth = this.calculateDepth(url, baseUrl);
      const priority = sitemapEntry?.priority ?? this.calculatePriority(depth);

      pages.push({
        url,
        title: content.title || this.extractPageTitle(url),
        content,
        depth,
        priority
      });
    }

    // Sort by depth (ascending) then priority (descending)
    pages.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return b.priority - a.priority;
    });

    return pages;
  }

  /**
   * Calculate URL depth relative to base URL
   */
  private calculateDepth(url: string, baseUrl: string): number {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);

      if (urlObj.hostname !== baseUrlObj.hostname) return 999; // Different domain

      const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
      return pathSegments.length;
    } catch (error) {
      return 999;
    }
  }

  /**
   * Calculate priority based on depth
   */
  private calculatePriority(depth: number): number {
    switch (depth) {
      case 0: return 1.0;  // Homepage
      case 1: return 0.8;  // Main sections
      case 2: return 0.6;  // Sub-sections
      case 3: return 0.4;  // Deep pages
      default: return 0.2; // Very deep pages
    }
  }

  /**
   * Extract page title from URL
   */
  private extractPageTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);

      if (pathSegments.length === 0) return 'Homepage';

      const lastSegment = pathSegments[pathSegments.length - 1];
      return lastSegment
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize words
    } catch (error) {
      return 'Unknown Page';
    }
  }

  /**
   * Generate the final llms.txt markdown content
   */
  private generateMarkdown(hierarchy: HierarchicalPage[], baseUrl: string): string {
    const lines: string[] = [];
    const homepage = hierarchy.find(p => p.depth === 0);
    const mainPages = hierarchy.filter(p => p.depth === 1);
    const subPages = hierarchy.filter(p => p.depth === 2);
    const optionalPages = hierarchy.filter(p => p.depth >= 3);

    // 1. H1 Title (required)
    const siteName = homepage?.content.title || this.extractSiteName(baseUrl);
    lines.push(`# ${siteName}`);
    lines.push('');

    // 2. Blockquote Summary (optional)
    if (homepage?.content.metadata.description) {
      lines.push(`> ${homepage.content.metadata.description}`);
      lines.push('');
    }

    // 3. Site Overview
    lines.push(`This site contains ${hierarchy.length} pages with information about ${siteName.toLowerCase()}.`);
    lines.push('');

    // 4. Homepage Section
    if (homepage) {
      lines.push('## Homepage');
      lines.push('');
      lines.push(this.formatPageContent(homepage, true)); // Full content for homepage
      lines.push('');
    }

    // 5. Main Sections (Depth 1)
    if (mainPages.length > 0) {
      lines.push('## Main Sections');
      lines.push('');

      for (const page of mainPages) {
        lines.push(`### ${page.title}`);
        lines.push('');
        lines.push(this.formatPageContent(page, false)); // Summary only
        lines.push('');
        lines.push(`**Full content:** [${page.url}](${page.url})`);
        lines.push('');
      }
    }

    // 6. Sub-sections (Depth 2)
    if (subPages.length > 0) {
      lines.push('## Additional Pages');
      lines.push('');

      for (const page of subPages) {
        lines.push(`- **[${page.title}](${page.url})**: ${this.getPageSummary(page)}`);
      }
      lines.push('');
    }

    // 7. Optional Section (Depth 3+)
    if (optionalPages.length > 0) {
      lines.push('## Optional');
      lines.push('');
      lines.push('Additional pages that may contain relevant information:');
      lines.push('');

      for (const page of optionalPages) {
        lines.push(`- [${page.title}](${page.url})`);
      }
      lines.push('');
    }

    // 8. Footer
    lines.push('---');
    lines.push('');
    lines.push('*Generated by Playwright Site Scanner*');
    lines.push(`*Total Pages: ${hierarchy.length} | Generated: ${new Date().toLocaleDateString()}*`);

    return lines.join('\n');
  }

  /**
   * Extract site name from base URL
   */
  private extractSiteName(baseUrl: string): string {
    try {
      const urlObj = new URL(baseUrl);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      return hostname
        .split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
    } catch (error) {
      return 'Website';
    }
  }

  /**
   * Format page content for llms.txt
   */
  private formatPageContent(page: HierarchicalPage, fullContent: boolean): string {
    const lines: string[] = [];
    const content = page.content;

    // Add main headings (H1-H3 only, already deduplicated)
    const mainHeadings = content.headings.filter(h => h.level <= 3);
    if (mainHeadings.length > 0 && fullContent) {
      for (const heading of mainHeadings.slice(0, 5)) { // Max 5 headings
        lines.push(`**${heading.text}**`);
        lines.push('');
      }
    }

    // Add paragraphs (deduplicated)
    const maxParagraphs = fullContent ? 10 : 3;
    const paragraphs = content.paragraphs.slice(0, maxParagraphs);

    for (const para of paragraphs) {
      if (para.trim().length > 20) { // Skip very short paragraphs
        lines.push(para);
        lines.push('');
      }
    }

    // Add key lists if present and full content requested
    if (fullContent && content.lists.length > 0) {
      for (const list of content.lists.slice(0, 2)) { // Max 2 lists
        for (const item of list.items.slice(0, 5)) { // Max 5 items per list
          lines.push(`- ${item}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }

  /**
   * Get a brief summary of the page
   */
  private getPageSummary(page: HierarchicalPage): string {
    // Try meta description first
    if (page.content.metadata.description) {
      return page.content.metadata.description;
    }

    // Otherwise use first paragraph
    if (page.content.paragraphs.length > 0) {
      const firstPara = page.content.paragraphs[0];
      if (firstPara.length > 150) {
        return firstPara.substring(0, 150) + '...';
      }
      return firstPara;
    }

    return 'Additional content available at this page.';
  }

  /**
   * Count total words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}
