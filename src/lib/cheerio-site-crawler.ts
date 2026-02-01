import { CheerioCrawler, Dataset, RequestQueue } from 'crawlee';
import chalk from 'chalk';
import { CrawlCheckpointManager } from './crawl-checkpoint-manager.js';

interface CrawlResult {
  url: string;
  title: string;
  timestamp: string;
}

interface DeepCrawlOptions {
  checkpointManager?: CrawlCheckpointManager;
  resumeFromCheckpoint?: boolean;
  maxPages?: number;  // undefined = unlimited
  concurrency?: number;
  requestTimeoutMs?: number;
}

/**
 * Lightweight HTTP-only crawler using Cheerio (no browser required).
 * Optimized for deep crawls with checkpoint support.
 */
export class CheerioSiteCrawler {
  private discoveredUrls: Set<string> = new Set();
  private checkpointManager: CrawlCheckpointManager | null = null;

  // Patterns that identify INDIVIDUAL templated content pages (not section indexes)
  private readonly TEMPLATE_PATTERNS: { name: string; pattern: RegExp }[] = [
    { name: 'blog-post', pattern: /\/blog\/[^\/]+\/?$/i },
    { name: 'news-article', pattern: /\/news\/[^\/]+\/?$/i },
    { name: 'post', pattern: /\/posts?\/[^\/]+\/?$/i },
    { name: 'article', pattern: /\/articles?\/[^\/]+\/?$/i },
    { name: 'date-yyyy-mm', pattern: /\/\d{4}\/\d{2}\/[^\/]+\/?$/i },
    { name: 'date-yyyy-mm-dd', pattern: /\/\d{4}\/\d{2}\/\d{2}\/[^\/]+\/?$/i },
    { name: 'pagination', pattern: /\/page\/\d+\/?$/i },
    { name: 'pagination-query', pattern: /[?&]page=\d+/i },
    { name: 'product', pattern: /\/products?\/[^\/]+\/?$/i },
    { name: 'category-item', pattern: /\/category\/[^\/]+\/[^\/]+\/?$/i },
    { name: 'tag-item', pattern: /\/tags?\/[^\/]+\/?$/i },
  ];

  // Track which template types have been found (for smart crawl)
  private foundTemplateTypes: Set<string> = new Set();

  /**
   * Crawl a site using lightweight HTTP requests (no browser)
   * For deep mode, maxPages should be undefined for unlimited crawling
   */
  async crawlSite(
    startUrl: string,
    mode: 'smart' | 'full' | 'deep' = 'full',
    options: DeepCrawlOptions = {}
  ): Promise<string[]> {
    this.discoveredUrls.clear();
    this.foundTemplateTypes.clear();
    this.checkpointManager = options.checkpointManager || null;

    const baseUrl = new URL(startUrl).origin;
    const isDeepMode = mode === 'deep';
    const maxPages = isDeepMode ? undefined : (options.maxPages || 50);
    const concurrency = options.concurrency || 10;
    const requestTimeout = options.requestTimeoutMs || 30000;

    const modeLabel = isDeepMode
      ? 'deep mode (unlimited pages)'
      : mode === 'smart'
        ? 'smart mode (skipping duplicate templates)'
        : 'full mode';

    console.log(chalk.gray(`    🕷️  Starting lightweight site crawl from ${startUrl}`));
    console.log(chalk.gray(`    🔗 Discovering pages on ${baseUrl} [${modeLabel}]`));
    if (maxPages) {
      console.log(chalk.gray(`    📊 Max pages: ${maxPages}`));
    } else {
      console.log(chalk.gray(`    📊 Max pages: unlimited`));
    }

    try {
      // Clear any existing dataset
      await this.clearDataset();

      // Handle resume from checkpoint
      let initialUrls = [startUrl];
      if (options.resumeFromCheckpoint && this.checkpointManager) {
        const resumeUrls = this.checkpointManager.getResumeUrls();
        if (resumeUrls.length > 0) {
          initialUrls = resumeUrls;
          console.log(chalk.green(`    📂 Resuming with ${resumeUrls.length} pending URLs`));
        }
      }

      // Create request queue for better control
      const requestQueue = await RequestQueue.open();
      for (const url of initialUrls) {
        await requestQueue.addRequest({ url });
      }

      // Capture reference for callbacks
      const self = this;
      let crawledCount = 0;

      const crawler = new CheerioCrawler({
        requestQueue,
        maxRequestsPerCrawl: maxPages,
        maxConcurrency: concurrency,
        requestHandlerTimeoutSecs: Math.ceil(requestTimeout / 1000),

        async requestHandler({ request, $, enqueueLinks, log }) {
          try {
            const currentUrl = request.loadedUrl || request.url;

            // URL filtering
            if (!self.isPageUrl(currentUrl)) {
              console.log(chalk.yellow(`      🚫 Skipping filtered page: ${currentUrl}`));
              return;
            }

            // Template filtering in smart mode
            if (!isDeepMode && self.shouldSkipTemplatedUrl(currentUrl, mode)) {
              console.log(chalk.yellow(`      🔁 Skipping duplicate template: ${currentUrl}`));
              return;
            }

            // Get page title
            const title = $('title').text() || 'No title';

            crawledCount++;
            console.log(chalk.gray(`      📄 [${crawledCount}] ${currentUrl}`));

            // Store the result
            await Dataset.pushData({
              url: currentUrl,
              title: title.trim(),
              timestamp: new Date().toISOString()
            } as CrawlResult);

            // Mark URL as crawled in checkpoint
            if (self.checkpointManager) {
              await self.checkpointManager.markUrlCrawled(currentUrl);
            }

            // Extract and enqueue links
            const links: string[] = [];
            $('a[href]').each((_, el) => {
              const href = $(el).attr('href');
              if (href) {
                try {
                  const absoluteUrl = new URL(href, currentUrl).href;
                  links.push(absoluteUrl);
                } catch {
                  // Invalid URL, skip
                }
              }
            });

            // Filter and enqueue valid links
            const validLinks = links.filter(url => {
              try {
                const linkOrigin = new URL(url).origin;
                if (linkOrigin !== baseUrl) return false; // Same domain only
                if (!self.isPageUrl(url)) return false;
                if (!isDeepMode && self.shouldSkipTemplatedUrl(url, mode)) return false;
                return true;
              } catch {
                return false;
              }
            });

            // Add to checkpoint if in deep mode
            if (self.checkpointManager && validLinks.length > 0) {
              await self.checkpointManager.addDiscoveredUrls(validLinks);
            }

            await enqueueLinks({
              urls: validLinks,
              transformRequestFunction: (req) => {
                if (!self.isPageUrl(req.url)) return false;
                if (!isDeepMode && self.shouldSkipTemplatedUrl(req.url, mode)) return false;
                return req;
              }
            });

            // Progress update every 100 pages in deep mode
            if (isDeepMode && crawledCount % 100 === 0) {
              console.log(chalk.cyan(`    📊 Progress: ${crawledCount} pages crawled`));
              if (self.checkpointManager) {
                const stats = self.checkpointManager.getStatistics();
                if (stats) {
                  console.log(chalk.gray(`       Pending: ${stats.totalPending}, Failed: ${stats.totalFailed}`));
                }
              }
            }

          } catch (error) {
            log.error(`Error processing ${request.url}: ${error}`);
            if (self.checkpointManager) {
              await self.checkpointManager.markUrlFailed(
                request.url,
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
          }
        },

        async failedRequestHandler({ request }) {
          console.log(chalk.yellow(`      ⚠️  Failed: ${request.url}`));
          if (self.checkpointManager) {
            await self.checkpointManager.markUrlFailed(request.url, 'Request failed');
          }
        },
      });

      // Setup graceful shutdown for deep crawls
      if (isDeepMode && this.checkpointManager) {
        const checkpointMgr = this.checkpointManager;
        const shutdownHandler = async () => {
          console.log(chalk.yellow('\n    ⚠️  Interrupt received, saving checkpoint...'));
          await checkpointMgr.finalizeCheckpoint('failed');
          process.exit(0);
        };

        process.once('SIGINT', shutdownHandler);
        process.once('SIGTERM', shutdownHandler);
      }

      // Start crawling
      await crawler.run();

      // Collect results
      const results = await this.collectResults();

      // Finalize checkpoint on success
      if (this.checkpointManager) {
        await this.checkpointManager.finalizeCheckpoint('completed');
      }

      console.log(chalk.green(`    ✅ Crawl completed. Found ${results.length} pages`));

      return results;

    } catch (error) {
      console.error(chalk.red(`    ❌ Site crawl failed: ${error}`));

      // Save checkpoint on failure
      if (this.checkpointManager) {
        await this.checkpointManager.finalizeCheckpoint('failed');
      }

      return [startUrl];
    } finally {
      await this.clearDataset();
    }
  }

  private async collectResults(): Promise<string[]> {
    try {
      const datasetItems = await Dataset.getData();
      const urls = datasetItems.items.map((item: any) => item.url as string);
      return Array.from(new Set(urls));
    } catch (error) {
      console.error(chalk.red(`Error collecting crawl results: ${error}`));
      return [];
    }
  }

  private async clearDataset(): Promise<void> {
    try {
      await Dataset.open().then(dataset => dataset.drop());
    } catch {
      // Dataset might not exist
    }
  }

  private isPageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname.toLowerCase();

      // Skip common non-page files
      const skipExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.tar', '.gz',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv',
        '.css', '.js', '.json', '.xml', '.rss',
        '.txt', '.log'
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

      // Skip URLs with tracking parameters
      const skipParams = ['utm_', 'fbclid', 'gclid', 'ref', 'source'];
      if (skipParams.some(param =>
        Array.from(urlObj.searchParams.keys()).some(key => key.startsWith(param))
      )) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private shouldSkipTemplatedUrl(url: string, mode: 'smart' | 'full' | 'deep'): boolean {
    if (mode === 'full' || mode === 'deep') return false;

    try {
      const urlPath = new URL(url).pathname;

      for (const { name, pattern } of this.TEMPLATE_PATTERNS) {
        if (pattern.test(urlPath)) {
          if (this.foundTemplateTypes.has(name)) {
            return true;
          }
          this.foundTemplateTypes.add(name);
          return false;
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}
