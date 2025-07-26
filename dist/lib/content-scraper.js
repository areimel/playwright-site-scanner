"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentScraper = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const session_manager_js_1 = require("../utils/session-manager.js");
class ContentScraper {
    sessionManager;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
    }
    async scrapePageContent(page, pageUrl, sessionId) {
        const startTime = new Date();
        const pageName = this.sessionManager.getPageName(pageUrl);
        const testResult = {
            testType: 'content-scraping',
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    📝 Scraping page content...`));
            // Extract all content from the page
            const scrapedContent = await this.extractPageContent(page, pageUrl);
            // Create images directory for this session if it doesn't exist
            await this.createImagesDirectory(sessionId);
            // Download and save images locally
            console.log(chalk_1.default.gray(`      🖼️  Processing ${scrapedContent.images.length} images...`));
            const processedImages = await this.processImages(page, scrapedContent.images, sessionId, pageName);
            scrapedContent.images = processedImages;
            // Generate markdown content
            const markdownContent = this.generateMarkdown(scrapedContent, pageUrl);
            // Save markdown file
            const outputPath = await this.saveMarkdownContent(sessionId, pageName, markdownContent);
            testResult.status = 'success';
            testResult.outputPath = outputPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`    ✅ Content scraping completed`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ Content scraping failed: ${testResult.error}`));
        }
        return testResult;
    }
    /**
     * Scrape page content and save directly to SessionDataStore
     * This method integrates with the parallel execution system
     */
    async scrapePageContentToStore(page, pageUrl, dataManager) {
        const startTime = new Date();
        const testResult = {
            testType: 'content-scraping',
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`      📄 Scraping content from: ${pageUrl}`));
            // Extract content from the page
            const scrapedContent = await this.extractPageContent(page, pageUrl);
            // Save content to the data manager (which handles images and metrics)
            dataManager.setScrapedContent(pageUrl, scrapedContent);
            // Also generate and save markdown files for user visibility
            const pageName = this.sessionManager.getPageName(pageUrl);
            // Create images directory for this session if it doesn't exist
            await this.createImagesDirectory(dataManager.sessionId);
            // Download and save images locally
            console.log(chalk_1.default.gray(`        🖼️  Processing ${scrapedContent.images.length} images...`));
            const processedImages = await this.processImages(page, scrapedContent.images, dataManager.sessionId, pageName);
            scrapedContent.images = processedImages;
            // Generate markdown content
            const markdownContent = this.generateMarkdown(scrapedContent, pageUrl);
            // Save markdown file
            const outputPath = await this.saveMarkdownContent(dataManager.sessionId, pageName, markdownContent);
            testResult.status = 'success';
            testResult.outputPath = outputPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`      ✅ Content scraped: ${scrapedContent.headings.length} headings, ${scrapedContent.paragraphs.length} paragraphs, ${scrapedContent.images.length} images`));
            console.log(chalk_1.default.green(`        📄 Markdown saved: ${outputPath}`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`      ❌ Content scraping failed for ${pageUrl}: ${testResult.error}`));
            // Add error to data manager
            dataManager.addError(`content-scraping-${pageUrl}`, testResult.error);
        }
        return testResult;
    }
    async extractPageContent(page, pageUrl) {
        return await page.evaluate((url) => {
            const content = {
                title: document.title || '',
                headings: [],
                paragraphs: [],
                lists: [],
                images: [],
                links: [],
                metadata: {
                    description: '',
                    author: '',
                    publishDate: '',
                    modifiedDate: '',
                    keywords: []
                }
            };
            // Extract metadata
            const metaTags = document.querySelectorAll('meta');
            metaTags.forEach((meta) => {
                const name = meta.getAttribute('name')?.toLowerCase();
                const property = meta.getAttribute('property')?.toLowerCase();
                const content_attr = meta.getAttribute('content') || '';
                if (name === 'description')
                    content.metadata.description = content_attr;
                if (name === 'author')
                    content.metadata.author = content_attr;
                if (name === 'keywords')
                    content.metadata.keywords = content_attr.split(',').map(k => k.trim());
                if (property === 'article:published_time')
                    content.metadata.publishDate = content_attr;
                if (property === 'article:modified_time')
                    content.metadata.modifiedDate = content_attr;
            });
            // Extract headings (H1-H6)
            const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headingElements.forEach((heading) => {
                const level = parseInt(heading.tagName.charAt(1));
                const text = heading.textContent?.trim() || '';
                const id = heading.getAttribute('id') || undefined;
                if (text) {
                    content.headings.push({ level, text, id });
                }
            });
            // Extract paragraphs
            const paragraphElements = document.querySelectorAll('p');
            paragraphElements.forEach((p) => {
                const text = p.textContent?.trim() || '';
                if (text && text.length > 10) { // Filter out very short paragraphs
                    content.paragraphs.push(text);
                }
            });
            // Extract lists
            const listElements = document.querySelectorAll('ul, ol');
            listElements.forEach((list) => {
                const type = list.tagName.toLowerCase() === 'ul' ? 'unordered' : 'ordered';
                const items = [];
                const listItems = list.querySelectorAll('li');
                listItems.forEach((li) => {
                    const text = li.textContent?.trim() || '';
                    if (text) {
                        items.push(text);
                    }
                });
                if (items.length > 0) {
                    content.lists.push({ type, items });
                }
            });
            // Extract images
            const imageElements = document.querySelectorAll('img');
            imageElements.forEach((img) => {
                // Convert relative URLs to absolute
                let src = img.src;
                if (src.startsWith('/')) {
                    const baseUrl = new URL(url);
                    src = baseUrl.origin + src;
                }
                else if (src.startsWith('./') || !src.startsWith('http')) {
                    try {
                        src = new URL(src, url).href;
                    }
                    catch (e) {
                        // Skip malformed URLs
                        return;
                    }
                }
                content.images.push({
                    src: src,
                    alt: img.alt || '',
                    title: img.title || undefined
                });
            });
            // Extract links
            const linkElements = document.querySelectorAll('a[href]');
            linkElements.forEach((link) => {
                const anchorLink = link;
                let href = anchorLink.href;
                const text = anchorLink.textContent?.trim() || '';
                if (text && href) {
                    const isExternal = !href.startsWith(window.location.origin) &&
                        (href.startsWith('http') || href.startsWith('//'));
                    content.links.push({ href, text, isExternal });
                }
            });
            return content;
        }, pageUrl);
    }
    async createImagesDirectory(sessionId) {
        const imagesPath = path_1.default.join(this.sessionManager['outputDir'], sessionId, 'images');
        await fs_1.promises.mkdir(imagesPath, { recursive: true });
    }
    async processImages(page, images, sessionId, pageName) {
        const processedImages = [];
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                console.log(chalk_1.default.gray(`        📷 Processing image ${i + 1}/${images.length}`));
                // Generate a safe filename
                const url = new URL(image.src);
                const originalExtension = path_1.default.extname(url.pathname) || '.jpg';
                const safeFilename = `${pageName}-image-${i + 1}${originalExtension}`;
                // Download image
                const response = await page.request.get(image.src);
                if (response.ok()) {
                    const buffer = await response.body();
                    const imagePath = path_1.default.join(this.sessionManager['outputDir'], sessionId, 'images', safeFilename);
                    await fs_1.promises.writeFile(imagePath, buffer);
                    // Update image data with local path
                    processedImages.push({
                        ...image,
                        localPath: imagePath,
                        filename: safeFilename
                    });
                }
                else {
                    console.log(chalk_1.default.yellow(`        ⚠️  Failed to download image: ${image.src}`));
                    // Keep original image data without local path
                    processedImages.push(image);
                }
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`        ⚠️  Error processing image: ${image.src}`));
                // Keep original image data without local path
                processedImages.push(image);
            }
        }
        return processedImages;
    }
    generateMarkdown(content, pageUrl) {
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
        // Add headings and structure content
        let currentSection = '';
        for (const heading of content.headings) {
            const headingMarkdown = '#'.repeat(heading.level) + ' ' + heading.text + '\n\n';
            markdown += headingMarkdown;
            currentSection = heading.text;
        }
        // Add paragraphs
        if (content.paragraphs.length > 0) {
            markdown += `## Content\n\n`;
            for (const paragraph of content.paragraphs) {
                markdown += `${paragraph}\n\n`;
            }
        }
        // Add lists
        if (content.lists.length > 0) {
            markdown += `## Lists\n\n`;
            for (let i = 0; i < content.lists.length; i++) {
                const list = content.lists[i];
                markdown += `### List ${i + 1}\n\n`;
                for (let j = 0; j < list.items.length; j++) {
                    const item = list.items[j];
                    if (list.type === 'ordered') {
                        markdown += `${j + 1}. ${item}\n`;
                    }
                    else {
                        markdown += `- ${item}\n`;
                    }
                }
                markdown += '\n';
            }
        }
        // Add images
        if (content.images.length > 0) {
            markdown += `## Images\n\n`;
            for (let i = 0; i < content.images.length; i++) {
                const image = content.images[i];
                const altText = image.alt || `Image ${i + 1}`;
                if (image.filename) {
                    // Use local image reference
                    markdown += `![${altText}](../images/${image.filename})\n\n`;
                    if (image.title) {
                        markdown += `*${image.title}*\n\n`;
                    }
                }
                else {
                    // Use original URL if local download failed
                    markdown += `![${altText}](${image.src})\n\n`;
                    if (image.title) {
                        markdown += `*${image.title}*\n\n`;
                    }
                    markdown += `*Note: Image could not be downloaded locally*\n\n`;
                }
            }
        }
        // Add links
        if (content.links.length > 0) {
            markdown += `## Links\n\n`;
            const internalLinks = content.links.filter(link => !link.isExternal);
            const externalLinks = content.links.filter(link => link.isExternal);
            if (internalLinks.length > 0) {
                markdown += `### Internal Links\n\n`;
                for (const link of internalLinks) {
                    markdown += `- [${link.text}](${link.href})\n`;
                }
                markdown += '\n';
            }
            if (externalLinks.length > 0) {
                markdown += `### External Links\n\n`;
                for (const link of externalLinks) {
                    markdown += `- [${link.text}](${link.href})\n`;
                }
                markdown += '\n';
            }
        }
        return markdown;
    }
    async saveMarkdownContent(sessionId, pageName, content) {
        await this.sessionManager.createPageDirectory(sessionId, pageName);
        const outputPath = path_1.default.join(this.sessionManager['outputDir'], sessionId, pageName, `${pageName}-content.md`);
        await fs_1.promises.writeFile(outputPath, content, 'utf8');
        return outputPath;
    }
    async getContentStats(markdownPath) {
        try {
            const content = await fs_1.promises.readFile(markdownPath, 'utf8');
            const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
            const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
            const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length - imageCount; // Subtract images from total links
            const headingCount = (content.match(/^#+\s/gm) || []).length;
            return { wordCount, imageCount, linkCount, headingCount };
        }
        catch (error) {
            return { wordCount: 0, imageCount: 0, linkCount: 0, headingCount: 0 };
        }
    }
}
exports.ContentScraper = ContentScraper;
//# sourceMappingURL=content-scraper.js.map