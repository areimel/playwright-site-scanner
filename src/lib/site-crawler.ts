import { chromium, Browser, Page } from 'playwright';
import chalk from 'chalk';

export class SiteCrawler {
  private browser: Browser | null = null;
  private visited: Set<string> = new Set();
  private toVisit: string[] = [];
  private baseUrl: string = '';
  private maxPages: number = 50; // Limit to prevent infinite crawling

  async crawlSite(startUrl: string, maxPages: number = 50): Promise<string[]> {
    this.maxPages = maxPages;
    this.baseUrl = new URL(startUrl).origin;
    this.visited.clear();
    this.toVisit = [startUrl];

    console.log(chalk.gray(`    🕷️  Starting site crawl from ${startUrl}`));
    console.log(chalk.gray(`    🔗 Will discover up to ${maxPages} pages on ${this.baseUrl}`));

    try {
      this.browser = await chromium.launch({ headless: true });
      const page = await this.browser.newPage();

      while (this.toVisit.length > 0 && this.visited.size < this.maxPages) {
        const currentUrl = this.toVisit.shift()!;
        
        if (this.visited.has(currentUrl)) {
          continue;
        }

        console.log(chalk.gray(`      📄 Crawling: ${currentUrl}`));
        
        try {
          const newUrls = await this.crawlPage(page, currentUrl);
          
          // Add new URLs to visit queue
          newUrls.forEach(url => {
            if (!this.visited.has(url) && !this.toVisit.includes(url)) {
              this.toVisit.push(url);
            }
          });

        } catch (error) {
          console.log(chalk.yellow(`      ⚠️  Could not crawl ${currentUrl}: ${error}`));
        }
      }

      await this.browser.close();
      
      const discoveredPages = Array.from(this.visited);
      console.log(chalk.green(`    ✅ Site crawl completed. Found ${discoveredPages.length} pages`));
      
      return discoveredPages;

    } catch (error) {
      if (this.browser) {
        await this.browser.close();
      }
      console.error(chalk.red(`    ❌ Site crawl failed: ${error}`));
      return [startUrl]; // Return at least the start URL
    }
  }

  private async crawlPage(page: Page, url: string): Promise<string[]> {
    try {
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 10000 // 10 second timeout
      });

      this.visited.add(url);

      // Extract all links on the page
      const links = await page.evaluate((baseUrl) => {
        const linkElements = document.querySelectorAll('a[href]');
        const urls: string[] = [];

        linkElements.forEach((link) => {
          try {
            const anchorLink = link as HTMLAnchorElement;
            const href = anchorLink.href;
            const parsedUrl = new URL(href);
            
            // Only include links from the same origin
            if (parsedUrl.origin === baseUrl) {
              // Remove hash fragments and query parameters for basic deduplication
              const cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
              
              // Filter out common non-page URLs
              if (!this.isPageUrl(cleanUrl)) {
                return;
              }
              
              urls.push(cleanUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        });

        return [...new Set(urls)]; // Remove duplicates
      }, this.baseUrl);

      return links.filter(link => !this.visited.has(link));

    } catch (error) {
      throw new Error(`Failed to crawl page: ${error}`);
    }
  }

  private isPageUrl(url: string): boolean {
    const urlPath = new URL(url).pathname.toLowerCase();
    
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

    // Skip URLs with common non-page query parameters
    const url_obj = new URL(url);
    const skipParams = ['utm_', 'fbclid', 'gclid', 'ref', 'source'];
    if (skipParams.some(param => 
      Array.from(url_obj.searchParams.keys()).some(key => key.startsWith(param))
    )) {
      // Remove query params and use the clean URL
      return this.isPageUrl(`${url_obj.origin}${url_obj.pathname}`);
    }

    return true;
  }

  // Method to crawl specific sections of a site
  async crawlSection(startUrl: string, sectionPath: string, maxPages: number = 20): Promise<string[]> {
    const sectionUrls = await this.crawlSite(startUrl, maxPages);
    
    // Filter URLs that belong to the specific section
    const filteredUrls = sectionUrls.filter(url => {
      const urlPath = new URL(url).pathname;
      return urlPath.startsWith(sectionPath);
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