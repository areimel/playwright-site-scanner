import { PlaywrightCrawler, Dataset } from 'crawlee';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CrawlResult {
  url: string;
  title: string;
  timestamp: string;
}

export class CrawleeSiteCrawler {
  private discoveredUrls: Set<string> = new Set();
  private maxPages: number = 50;

  // Patterns that identify INDIVIDUAL templated content pages (not section indexes)
  // These patterns require a slug after the section path, so /blog/ won't match but /blog/my-post/ will
  private readonly TEMPLATE_PATTERNS: { name: string; pattern: RegExp }[] = [
    { name: 'blog-post', pattern: /\/blog\/[^\/]+\/?$/i },         // /blog/my-post/ (NOT /blog/)
    { name: 'news-article', pattern: /\/news\/[^\/]+\/?$/i },      // /news/story/ (NOT /news/)
    { name: 'post', pattern: /\/posts?\/[^\/]+\/?$/i },            // /post/slug/ or /posts/slug/
    { name: 'article', pattern: /\/articles?\/[^\/]+\/?$/i },      // /article/slug/
    { name: 'date-yyyy-mm', pattern: /\/\d{4}\/\d{2}\/[^\/]+\/?$/i },     // /2024/01/title/
    { name: 'date-yyyy-mm-dd', pattern: /\/\d{4}\/\d{2}\/\d{2}\/[^\/]+\/?$/i }, // /2024/01/15/title/
    { name: 'pagination', pattern: /\/page\/\d+\/?$/i },           // /page/2/
    { name: 'pagination-query', pattern: /[?&]page=\d+/i },        // ?page=2
    { name: 'product', pattern: /\/products?\/[^\/]+\/?$/i },      // /product/item/
    { name: 'category-item', pattern: /\/category\/[^\/]+\/[^\/]+\/?$/i }, // /category/tech/post/
    { name: 'tag-item', pattern: /\/tags?\/[^\/]+\/?$/i },         // /tag/javascript/
  ];

  // Track which template types have been found (for smart crawl)
  private foundTemplateTypes: Set<string> = new Set();

  async crawlSite(startUrl: string, maxPages: number = 50, mode: 'smart' | 'full' = 'full'): Promise<string[]> {
    this.maxPages = maxPages;
    this.discoveredUrls.clear();
    this.foundTemplateTypes.clear(); // Reset template tracking for new crawl

    const baseUrl = new URL(startUrl).origin;
    const modeLabel = mode === 'smart' ? 'smart mode (skipping duplicate templates)' : 'full mode';
    console.log(chalk.gray(`    🕷️  Starting site crawl from ${startUrl}`));
    console.log(chalk.gray(`    🔗 Will discover up to ${maxPages} pages on ${baseUrl} [${modeLabel}]`));

    try {
      // Clear any existing dataset
      await this.clearDataset();

      // Capture reference to this instance for use in crawler callbacks
      const self = this;

      const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: maxPages,
        headless: true,
        
        async requestHandler({ request, page, enqueueLinks, log }) {
          try {
            // Double-check URL filtering for any URLs that might have slipped through
            if (!self.isPageUrl(request.loadedUrl || request.url)) {
              console.log(chalk.yellow(`      🚫 Skipping filtered page: ${request.loadedUrl || request.url}`));
              return;
            }

            // Double-check template filtering in smart mode
            if (self.shouldSkipTemplatedUrl(request.loadedUrl || request.url, mode)) {
              console.log(chalk.yellow(`      🔁 Skipping duplicate template page: ${request.loadedUrl || request.url}`));
              return;
            }

            // Wait for page to be fully loaded
            await page.waitForLoadState('networkidle');
            
            const title = await page.title();
            const currentUrl = request.loadedUrl;
            
            console.log(chalk.gray(`      📄 Crawling: ${currentUrl}`));
            
            // Store the result
            await Dataset.pushData({
              url: currentUrl,
              title: title || 'No title',
              timestamp: new Date().toISOString()
            } as CrawlResult);
            
            // Only enqueue links from the same domain and that pass our URL filtering
            await enqueueLinks({
              selector: 'a[href]',
              strategy: 'same-domain',
              transformRequestFunction: (req) => {
                if (!self.isPageUrl(req.url)) {
                  console.log(chalk.gray(`      🚫 Skipping filtered URL: ${req.url}`));
                  return false; // Skip this URL
                }
                if (self.shouldSkipTemplatedUrl(req.url, mode)) {
                  console.log(chalk.gray(`      🔁 Skipping duplicate template: ${req.url}`));
                  return false; // Skip duplicate template
                }
                return req;
              }
            });
            
          } catch (error) {
            log.error(`Error processing ${request.loadedUrl}: ${error}`);
          }
        },

        failedRequestHandler({ request, log }) {
          console.log(chalk.yellow(`      ⚠️  Could not crawl ${request.url}: Request failed`));
        },

        // Configure browser settings
        launchContext: {
          launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        }
      });

      // Start crawling
      await crawler.run([startUrl]);

      // Collect results from dataset
      const results = await this.collectResults();
      
      console.log(chalk.green(`    ✅ Site crawl completed. Found ${results.length} pages`));
      
      return results;

    } catch (error) {
      console.error(chalk.red(`    ❌ Site crawl failed: ${error}`));
      return [startUrl]; // Return at least the start URL
    } finally {
      // Clean up dataset
      await this.clearDataset();
    }
  }

  private async collectResults(): Promise<string[]> {
    try {
      const datasetItems = await Dataset.getData();
      const urls = datasetItems.items.map((item: any) => item.url as string);
      
      // Remove duplicates and return
      return Array.from(new Set(urls));
    } catch (error) {
      console.error(chalk.red(`Error collecting crawl results: ${error}`));
      return [];
    }
  }

  private async clearDataset(): Promise<void> {
    try {
      // Clear the default dataset
      await Dataset.open().then(dataset => dataset.drop());
    } catch (error) {
      // Dataset might not exist, which is fine
    }
  }

  private isPageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname.toLowerCase();
      
      // Skip common non-page files
      const skipExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', // Images
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // Documents
        '.zip', '.rar', '.tar', '.gz', // Archives
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', // Media
        '.css', '.js', '.json', '.xml', '.rss', // Assets
        '.txt', '.log' // Text files
      ];

      if (skipExtensions.some(ext => urlPath.endsWith(ext))) {
        return false;
      }

      // Skip common non-page paths
      const skipPaths = [
        '/api/', '/admin/', '/wp-admin/', '/wp-content/',
        '/assets/', '/static/', '/images/', '/img/', '/css/', '/js/',
        '/fonts/', '/downloads/', '/uploads/',
        '/search?', '/tag/', '/category/', '/author/',
        '/feed', '/rss', '/sitemap'
      ];

      if (skipPaths.some(path => urlPath.includes(path))) {
        return false;
      }

      // Skip URLs with common tracking parameters
      const skipParams = ['utm_', 'fbclid', 'gclid', 'ref', 'source'];
      if (skipParams.some(param => 
        Array.from(urlObj.searchParams.keys()).some(key => key.startsWith(param))
      )) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if URL matches a template pattern and whether we should skip it (smart mode)
   * Returns true if the URL should be skipped
   */
  private shouldSkipTemplatedUrl(url: string, mode: 'smart' | 'full'): boolean {
    if (mode === 'full') return false;

    try {
      const urlPath = new URL(url).pathname;

      for (const { name, pattern } of this.TEMPLATE_PATTERNS) {
        if (pattern.test(urlPath)) {
          if (this.foundTemplateTypes.has(name)) {
            // Already have one of this template type, skip
            return true;
          }
          // First of this type, allow it but mark as found
          this.foundTemplateTypes.add(name);
          return false;
        }
      }

      return false; // Not a template, allow it
    } catch (error) {
      return false;
    }
  }

  // Method to crawl specific sections of a site
  async crawlSection(startUrl: string, sectionPath: string, maxPages: number = 20): Promise<string[]> {
    const allUrls = await this.crawlSite(startUrl, maxPages);
    
    // Filter URLs that belong to the specific section
    const filteredUrls = allUrls.filter(url => {
      try {
        const urlPath = new URL(url).pathname;
        return urlPath.startsWith(sectionPath);
      } catch (error) {
        return false;
      }
    });

    console.log(chalk.blue(`    📂 Found ${filteredUrls.length} pages in section '${sectionPath}'`));
    return filteredUrls;
  }

  // Method to get a sample of pages (useful for large sites)
  async getSamplePages(startUrl: string, sampleSize: number = 10): Promise<string[]> {
    const allPages = await this.crawlSite(startUrl, Math.max(sampleSize * 3, 30));
    
    if (allPages.length <= sampleSize) {
      return allPages;
    }

    // Ensure we always include the home page
    const sample = [startUrl];
    const otherPages = allPages.filter(url => url !== startUrl);
    
    // Randomly sample from the remaining pages
    const shuffled = otherPages.sort(() => Math.random() - 0.5);
    sample.push(...shuffled.slice(0, sampleSize - 1));

    console.log(chalk.blue(`    🎲 Selected ${sample.length} sample pages from ${allPages.length} discovered pages`));
    return sample;
  }
}