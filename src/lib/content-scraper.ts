import { Page } from 'playwright';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { ScrapedContent, TestResult, HeadingData, ParagraphData, ListData, ImageData, LinkData, PageMetadata, BlockquoteData, CodeData } from '@shared/index.js';
import { SessionManager } from '@utils/session-manager.js';
import { SessionDataManager } from '@utils/session-data-store.js';

export class ContentScraper {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async scrapePageContent(
    page: Page,
    pageUrl: string,
    sessionId: string
  ): Promise<TestResult> {
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    // Create initial test result using simple system
    const testResult = this.sessionManager.createTestResult('content-scraping');

    try {
      console.log(chalk.gray(`    📝 Scraping page content...`));

      // Extract all content from the page
      const scrapedContent = await this.extractPageContent(page, pageUrl);

      // Create images directory for this session if it doesn't exist
      await this.createImagesDirectory(sessionId);

      // Download and save images locally
      console.log(chalk.gray(`      🖼️  Processing ${scrapedContent.images.length} images...`));
      const processedImages = await this.processImages(page, scrapedContent.images, sessionId, pageName);
      scrapedContent.images = processedImages;

      // Generate markdown content
      const markdownContent = this.generateMarkdown(scrapedContent, pageUrl);

      // Generate output path using simple canonical method
      const filename = `${pageName}-content.md`;
      const outputPath = this.sessionManager.buildFilePath(sessionId, pageName, 'content', filename);
      
      // Ensure directory exists and save file
      await this.sessionManager.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, markdownContent, 'utf8');
      
      testResult.status = 'success';
      testResult.outputPath = outputPath;
      
      testResult.endTime = new Date();

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ Content scraping failed: ${testResult.error}`));
    }

    return testResult;
  }

  /**
   * Scrape page content and save directly to SessionDataStore
   * This method integrates with the parallel execution system
   */
  async scrapePageContentToStore(
    page: Page,
    pageUrl: string,
    dataManager: SessionDataManager
  ): Promise<TestResult> {
    const startTime = new Date();
    
    const testResult: TestResult = {
      testType: 'content-scraping',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`      📄 Scraping content from: ${pageUrl}`));

      // Extract content from the page
      const scrapedContent = await this.extractPageContent(page, pageUrl);

      // Save content to the data manager (which handles images and metrics)
      dataManager.setScrapedContent(pageUrl, scrapedContent);

      // Also generate and save markdown files for user visibility
      const pageName = this.sessionManager.getPageName(pageUrl);
      
      // Create images directory for this session if it doesn't exist
      await this.createImagesDirectory(dataManager.sessionId);

      // Download and save images locally
      console.log(chalk.gray(`        🖼️  Processing ${scrapedContent.images.length} images...`));
      const processedImages = await this.processImages(page, scrapedContent.images, dataManager.sessionId, pageName);
      scrapedContent.images = processedImages;

      // Generate markdown content
      const markdownContent = this.generateMarkdown(scrapedContent, pageUrl);

      // Save markdown file
      const outputPath = await this.saveMarkdownContent(dataManager.sessionId, pageName, markdownContent);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`      ✅ Content scraped: ${scrapedContent.headings.length} headings, ${scrapedContent.paragraphs.length} paragraphs, ${scrapedContent.images.length} images`));
      console.log(chalk.green(`        📄 Markdown saved: ${outputPath}`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`      ❌ Content scraping failed for ${pageUrl}: ${testResult.error}`));
      
      // Add error to data manager
      dataManager.addError(`content-scraping-${pageUrl}`, testResult.error);
    }

    return testResult;
  }

  private async extractPageContent(page: Page, pageUrl: string): Promise<ScrapedContent> {
    return await page.evaluate((url) => {
      // Helper interfaces for browser context
      interface ContentElement {
        type: 'heading' | 'paragraph' | 'list' | 'image' | 'blockquote' | 'code';
        data: any;
        indentLevel: number;
      }

      interface ScrapedContent {
        title: string;
        content: ContentElement[];
        metadata: any;
        headings: any[];
        paragraphs: string[];
        lists: any[];
        images: any[];
        links: any[];
      }

      const content: ScrapedContent = {
        title: document.title || '',
        content: [], // Sequential content in DOM order
        metadata: {
          description: '',
          author: '',
          publishDate: '',
          modifiedDate: '',
          keywords: []
        },
        // Backward compatibility arrays
        headings: [],
        paragraphs: [],
        lists: [],
        images: [],
        links: []
      };

      // Extract metadata
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach((meta: HTMLMetaElement) => {
        const name = meta.getAttribute('name')?.toLowerCase();
        const property = meta.getAttribute('property')?.toLowerCase();
        const content_attr = meta.getAttribute('content') || '';

        if (name === 'description') content.metadata.description = content_attr;
        if (name === 'author') content.metadata.author = content_attr;
        if (name === 'keywords') content.metadata.keywords = content_attr.split(',').map(k => k.trim());
        if (property === 'article:published_time') content.metadata.publishDate = content_attr;
        if (property === 'article:modified_time') content.metadata.modifiedDate = content_attr;
      });

      // Helper function to extract inline links from an element
      const extractInlineLinks = (element: Element): any[] => {
        const links: any[] = [];
        const anchorElements = element.querySelectorAll('a[href]');
        anchorElements.forEach((link: Element) => {
          const anchorLink = link as HTMLAnchorElement;
          const href = anchorLink.href;
          const text = anchorLink.textContent?.trim() || '';

          if (text && href) {
            const isExternal = !href.startsWith(window.location.origin) &&
                             (href.startsWith('http') || href.startsWith('//'));
            links.push({ href, text, isExternal });
          }
        });
        return links;
      };

      // Helper function to convert element text with inline links to markdown
      const getTextWithInlineLinks = (element: Element): string => {
        let text = '';
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                return NodeFilter.FILTER_ACCEPT;
              }
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            }
          }
        );

        let currentNode: Node | null;
        while (currentNode = walker.nextNode()) {
          if (currentNode.nodeType === Node.TEXT_NODE) {
            text += currentNode.textContent || '';
          } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const linkElement = currentNode as HTMLAnchorElement;
            const linkText = linkElement.textContent?.trim() || '';
            const href = linkElement.href;
            if (linkText && href) {
              text += `[${linkText}](${href})`;
            }
          }
        }
        return text.trim();
      };

      // Helper function to convert relative URLs to absolute
      const makeAbsoluteUrl = (src: string): string => {
        if (src.startsWith('/')) {
          const baseUrl = new URL(url);
          return baseUrl.origin + src;
        } else if (src.startsWith('./') || !src.startsWith('http')) {
          try {
            return new URL(src, url).href;
          } catch (e) {
            return src; // Return original if conversion fails
          }
        }
        return src;
      };

      // Recursive function to walk DOM and extract content in order
      const processedElements = new Set<Element>(); // Track processed elements to avoid duplicates

      const walkDOM = (node: Element, indentLevel: number = 0) => {
        // Skip if already processed (prevents duplicate nested lists)
        if (processedElements.has(node)) {
          return;
        }

        const tagName = node.tagName;

        // Process headings
        if (/^H[1-6]$/.test(tagName)) {
          processedElements.add(node);
          const level = parseInt(tagName.charAt(1));
          const text = getTextWithInlineLinks(node);
          const id = node.getAttribute('id') || undefined;

          if (text) {
            const headingData = { level, text, id };
            content.content.push({
              type: 'heading',
              data: headingData,
              indentLevel
            });
            // Backward compatibility
            content.headings.push(headingData);
          }
          return; // Don't process children of headings
        }

        // Process paragraphs
        if (tagName === 'P') {
          processedElements.add(node);
          const text = getTextWithInlineLinks(node);
          const links = extractInlineLinks(node);

          if (text && text.length > 10) {
            const paragraphData = { text, links: links.length > 0 ? links : undefined };
            content.content.push({
              type: 'paragraph',
              data: paragraphData,
              indentLevel
            });
            // Backward compatibility
            content.paragraphs.push(text);
            content.links.push(...links);
          }
          return; // Don't process children of paragraphs
        }

        // Process lists (UL/OL)
        if (tagName === 'UL' || tagName === 'OL') {
          processedElements.add(node);
          const type = tagName === 'UL' ? 'unordered' : 'ordered';
          const items: string[] = [];

          // Only get direct children LI elements
          const directListItems = Array.from(node.children).filter(child => child.tagName === 'LI');
          directListItems.forEach((li: Element) => {
            const text = getTextWithInlineLinks(li);
            if (text) {
              items.push(text);
            }
            // Extract links from list items
            const links = extractInlineLinks(li);
            content.links.push(...links);
          });

          if (items.length > 0) {
            const listData = { type, items, nestedLevel: indentLevel };
            content.content.push({
              type: 'list',
              data: listData,
              indentLevel
            });
            // Backward compatibility
            content.lists.push({ type, items });
          }
          return; // Don't process children of lists
        }

        // Process images
        if (tagName === 'IMG') {
          processedElements.add(node);
          const img = node as HTMLImageElement;
          const src = makeAbsoluteUrl(img.src);
          const alt = img.alt || '';
          const title = img.title || undefined;

          const imageData = { src, alt, title };
          content.content.push({
            type: 'image',
            data: imageData,
            indentLevel
          });
          // Backward compatibility
          content.images.push(imageData);
          return;
        }

        // Process blockquotes
        if (tagName === 'BLOCKQUOTE') {
          processedElements.add(node);
          const text = getTextWithInlineLinks(node);
          const links = extractInlineLinks(node);

          if (text) {
            content.content.push({
              type: 'blockquote',
              data: { text },
              indentLevel
            });
            content.links.push(...links);
          }
          return; // Don't process children of blockquotes
        }

        // Process code blocks
        if (tagName === 'PRE') {
          processedElements.add(node);
          const codeElement = node.querySelector('code');
          const code = codeElement ? codeElement.textContent || '' : node.textContent || '';
          const language = codeElement?.className.match(/language-(\w+)/)?.[1];

          if (code.trim()) {
            content.content.push({
              type: 'code',
              data: { code: code.trim(), language },
              indentLevel
            });
          }
          return; // Don't process children of code blocks
        }

        // Recursively process children
        for (const child of Array.from(node.children)) {
          walkDOM(child, indentLevel);
        }
      };

      // Start walking from body
      walkDOM(document.body, 0);

      return content;
    }, pageUrl);
  }

  private async createImagesDirectory(sessionId: string): Promise<void> {
    const imagesPath = path.join(this.sessionManager['outputDir'], sessionId, 'images');
    await fs.mkdir(imagesPath, { recursive: true });
  }

  private async processImages(
    page: Page,
    images: ImageData[],
    sessionId: string,
    pageName: string
  ): Promise<ImageData[]> {
    const processedImages: ImageData[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      try {
        console.log(chalk.gray(`        📷 Processing image ${i + 1}/${images.length}`));
        
        // Generate a safe filename
        const url = new URL(image.src);
        const originalExtension = path.extname(url.pathname) || '.jpg';
        const safeFilename = `${pageName}-image-${i + 1}${originalExtension}`;
        
        // Download image
        const response = await page.request.get(image.src);
        if (response.ok()) {
          const buffer = await response.body();
          const imagePath = path.join(this.sessionManager['outputDir'], sessionId, 'images', safeFilename);
          
          await fs.writeFile(imagePath, buffer);
          
          // Update image data with local path
          processedImages.push({
            ...image,
            localPath: imagePath,
            filename: safeFilename
          });
        } else {
          console.log(chalk.yellow(`        ⚠️  Failed to download image: ${image.src}`));
          // Keep original image data without local path
          processedImages.push(image);
        }
      } catch (error) {
        console.log(chalk.yellow(`        ⚠️  Error processing image: ${image.src}`));
        // Keep original image data without local path
        processedImages.push(image);
      }
    }

    return processedImages;
  }

  private generateMarkdown(content: ScrapedContent, pageUrl: string): string {
    let markdown = `# ${content.title}\n\n`;

    // Add metadata
    markdown += `**URL:** ${pageUrl}\n`;
    markdown += `**Scraped:** ${new Date().toISOString()}\n\n`;

    if (content.metadata.description) {
      markdown += `**Description:** ${content.metadata.description}\n\n`;
    }

    if (content.metadata.author) {
      markdown += `**Author:** ${content.metadata.author}\n\n`;
    }

    if (content.metadata.keywords.length > 0) {
      markdown += `**Keywords:** ${content.metadata.keywords.join(', ')}\n\n`;
    }

    markdown += `---\n\n`;

    // Render content in sequential DOM order
    for (const element of content.content) {
      const indent = '  '.repeat(element.indentLevel); // 2 spaces per indent level

      switch (element.type) {
        case 'heading': {
          const data = element.data as HeadingData;
          const headingMarkdown = '#'.repeat(data.level) + ' ' + data.text + '\n\n';
          markdown += headingMarkdown;
          break;
        }

        case 'paragraph': {
          const data = element.data as ParagraphData;
          markdown += `${indent}${data.text}\n\n`;
          break;
        }

        case 'list': {
          const data = element.data as ListData;
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (data.type === 'ordered') {
              markdown += `${indent}${i + 1}. ${item}\n`;
            } else {
              markdown += `${indent}- ${item}\n`;
            }
          }
          markdown += '\n';
          break;
        }

        case 'image': {
          const data = element.data as ImageData;
          const altText = data.alt || 'Image';

          if (data.filename) {
            // Use local image reference
            markdown += `${indent}![${altText}](../images/${data.filename})`;
            if (data.title) {
              markdown += ` "${data.title}"`;
            }
            markdown += '\n\n';
          } else {
            // Use original URL if local download failed
            markdown += `${indent}![${altText}](${data.src})`;
            if (data.title) {
              markdown += ` "${data.title}"`;
            }
            markdown += '\n\n';
          }
          break;
        }

        case 'blockquote': {
          const data = element.data as BlockquoteData;
          const lines = data.text.split('\n');
          for (const line of lines) {
            markdown += `${indent}> ${line}\n`;
          }
          markdown += '\n';
          break;
        }

        case 'code': {
          const data = element.data as CodeData;
          markdown += `${indent}\`\`\`${data.language || ''}\n`;
          const codeLines = data.code.split('\n');
          for (const line of codeLines) {
            markdown += `${indent}${line}\n`;
          }
          markdown += `${indent}\`\`\`\n\n`;
          break;
        }
      }
    }

    return markdown;
  }

  private async saveMarkdownContent(
    sessionId: string,
    pageName: string,
    content: string
  ): Promise<string> {
    await this.sessionManager.createPageDirectory(sessionId, pageName);
    const outputPath = path.join(
      this.sessionManager['outputDir'],
      sessionId,
      pageName,
      `${pageName}-content.md`
    );
    
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }

  async getContentStats(markdownPath: string): Promise<{
    wordCount: number;
    imageCount: number;
    linkCount: number;
    headingCount: number;
  }> {
    try {
      const content = await fs.readFile(markdownPath, 'utf8');
      
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
      const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
      const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length - imageCount; // Subtract images from total links
      const headingCount = (content.match(/^#+\s/gm) || []).length;
      
      return { wordCount, imageCount, linkCount, headingCount };
    } catch (error) {
      return { wordCount: 0, imageCount: 0, linkCount: 0, headingCount: 0 };
    }
  }
}