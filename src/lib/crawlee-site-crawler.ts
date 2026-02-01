import { PlaywrightCrawler, Dataset, RequestQueue } from 'crawlee';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CrawlCheckpointManager } from './crawl-checkpoint-manager.js';

interface CrawlResult {
  url: string;
  title: string;
  timestamp: string;
}

interface DeepCrawlOptions {
  checkpointManager?: CrawlCheckpointManager;
  resumeFromCheckpoint?: boolean;
  concurrency?: number;
  requestTimeoutMs?: number;
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

  async crawlSite(
    startUrl: string,
    maxPages: number = 50,
    mode: 'smart' | 'full' | 'deep' = 'full',
    options: DeepCrawlOptions = {}
  ): Promise<string[]> {
    const isDeepMode = mode === 'deep';
    this.maxPages = isDeepMode ? Number.MAX_SAFE_INTEGER : maxPages;
    this.discoveredUrls.clear();
    this.foundTemplateTypes.clear();

    const checkpointManager = options.checkpointManager || null;
    const concurrency = options.concurrency || 3;

    const baseUrl = new URL(startUrl).origin;
    const modeLabel = isDeepMode
      ? 'deep mode (unlimited pages, browser-based)'
      : mode === 'smart'
        ? 'smart mode (skipping duplicate templates)'
        : 'full mode';

    console.log(chalk.gray(`    🕷️  Starting site crawl from ${startUrl}`));
    if (isDeepMode) {
      console.log(chalk.gray(`    🔗 Discovering pages on ${baseUrl} [${modeLabel}]`));
      console.log(chalk.gray(`    📊 Max pages: unlimited`));
    } else {
      console.log(chalk.gray(`    🔗 Will discover up to ${maxPages} pages on ${baseUrl} [${modeLabel}]`));
    }

    try {
      // Clear any existing dataset (unless resuming in deep mode)
      if (!isDeepMode || !options.resumeFromCheckpoint) {
        await this.clearDataset();
      }

      // Handle resume from checkpoint
      let initialUrls = [startUrl];
      if (options.resumeFromCheckpoint && checkpointManager) {
        const resumeUrls = checkpointManager.getResumeUrls();
        if (resumeUrls.length > 0) {
          initialUrls = resumeUrls;
          console.log(chalk.green(`    📂 Resuming with ${resumeUrls.length} pending URLs`));
        }
      }

      // Create request queue for deep mode
      const requestQueue = isDeepMode ? await RequestQueue.open() : undefined;
      if (requestQueue) {
        for (const url of initialUrls) {
          await requestQueue.addRequest({ url });
        }
      }

      // Capture reference to this instance for use in crawler callbacks
      const self = this;
      let crawledCount = 0;

      const crawlerOptions: any = {
        headless: true,
        maxConcurrency: concurrency,

        async requestHandler({ request, page, enqueueLinks, log }: any) {
          try {
            const currentUrl = request.loadedUrl || request.url;

            // Double-check URL filtering
            if (!self.isPageUrl(currentUrl)) {
              console.log(chalk.yellow(`      🚫 Skipping filtered page: ${currentUrl}`));
              return;
            }

            // Template filtering (skip in deep mode)
            if (!isDeepMode && self.shouldSkipTemplatedUrl(currentUrl, mode as 'smart' | 'full')) {
              console.log(chalk.yellow(`      🔁 Skipping duplicate template page: ${currentUrl}`));
              return;
            }

            // Wait for page to be fully loaded
            await page.waitForLoadState('networkidle');

            const title = await page.title();

            crawledCount++;
            console.log(chalk.gray(`      📄 [${crawledCount}] ${currentUrl}`));

            // Store the result
            await Dataset.pushData({
              url: currentUrl,
              title: title || 'No title',
              timestamp: new Date().toISOString()
            } as CrawlResult);

            // Mark URL as crawled in checkpoint
            if (checkpointManager) {
              await checkpointManager.markUrlCrawled(currentUrl);
            }

            // Enqueue links
            await enqueueLinks({
              selector: 'a[href]',
              strategy: 'same-domain',
              transformRequestFunction: (req: any) => {
                if (!self.isPageUrl(req.url)) {
                  return false;
                }
                if (!isDeepMode && self.shouldSkipTemplatedUrl(req.url, mode as 'smart' | 'full')) {
                  return false;
                }
                return req;
              }
            });

            // Progress update every 100 pages in deep mode
            if (isDeepMode && crawledCount % 100 === 0) {
              console.log(chalk.cyan(`    📊 Progress: ${crawledCount} pages crawled`));
              if (checkpointManager) {
                const stats = checkpointManager.getStatistics();
                if (stats) {
                  console.log(chalk.gray(`       Pending: ${stats.totalPending}, Failed: ${stats.totalFailed}`));
                }
              }
            }

          } catch (error) {
            log.error(`Error processing ${request.loadedUrl}: ${error}`);
            if (checkpointManager) {
              await checkpointManager.markUrlFailed(
                request.url,
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
          }
        },

        async failedRequestHandler({ request }: any) {
          console.log(chalk.yellow(`      ⚠️  Could not crawl ${request.url}: Request failed`));
          if (checkpointManager) {
            await checkpointManager.markUrlFailed(request.url, 'Request failed');
          }
        },

        launchContext: {
          launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        }
      };

      // Set max requests only for non-deep mode
      if (!isDeepMode) {
        crawlerOptions.maxRequestsPerCrawl = maxPages;
      }

      // Use request queue for deep mode
      if (requestQueue) {
        crawlerOptions.requestQueue = requestQueue;
      }

      const crawler = new PlaywrightCrawler(crawlerOptions);

      // Setup graceful shutdown for deep crawls
      if (isDeepMode && checkpointManager) {
        const shutdownHandler = async () => {
          console.log(chalk.yellow('\n    ⚠️  Interrupt received, saving checkpoint...'));
          await checkpointManager.finalizeCheckpoint('failed');
          process.exit(0);
        };

        process.once('SIGINT', shutdownHandler);
        process.once('SIGTERM', shutdownHandler);
      }

      // Start crawling
      if (isDeepMode) {
        await crawler.run();
      } else {
        await crawler.run([startUrl]);
      }

      // Collect results from dataset
      const results = await this.collectResults();

      // Finalize checkpoint on success
      if (checkpointManager) {
        await checkpointManager.finalizeCheckpoint('completed');
      }

      console.log(chalk.green(`    ✅ Site crawl completed. Found ${results.length} pages`));

      return results;

    } catch (error) {
      console.error(chalk.red(`    ❌ Site crawl failed: ${error}`));

      // Save checkpoint on failure
      if (checkpointManager) {
        await checkpointManager.finalizeCheckpoint('failed');
      }

      return [startUrl];
    } finally {
      // Clean up dataset (don't clean in deep mode failure for resume)
      if (!isDeepMode) {
        await this.clearDataset();
      }
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
  private shouldSkipTemplatedUrl(url: string, mode: 'smart' | 'full' | 'deep'): boolean {
    if (mode === 'full' || mode === 'deep') return false;

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
    const allUrls = await this.crawlSite(startUrl, maxPages, 'full');
    
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