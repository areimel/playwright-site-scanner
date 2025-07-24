"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawleeSiteCrawler = void 0;
const crawlee_1 = require("crawlee");
const chalk_1 = __importDefault(require("chalk"));
class CrawleeSiteCrawler {
    discoveredUrls = new Set();
    maxPages = 50;
    async crawlSite(startUrl, maxPages = 50) {
        this.maxPages = maxPages;
        this.discoveredUrls.clear();
        const baseUrl = new URL(startUrl).origin;
        console.log(chalk_1.default.gray(`    🕷️  Starting site crawl from ${startUrl}`));
        console.log(chalk_1.default.gray(`    🔗 Will discover up to ${maxPages} pages on ${baseUrl}`));
        try {
            // Clear any existing dataset
            await this.clearDataset();
            const crawler = new crawlee_1.PlaywrightCrawler({
                maxRequestsPerCrawl: maxPages,
                headless: true,
                async requestHandler({ request, page, enqueueLinks, log }) {
                    try {
                        // Wait for page to be fully loaded
                        await page.waitForLoadState('networkidle');
                        const title = await page.title();
                        const currentUrl = request.loadedUrl;
                        console.log(chalk_1.default.gray(`      📄 Crawling: ${currentUrl}`));
                        // Store the result
                        await crawlee_1.Dataset.pushData({
                            url: currentUrl,
                            title: title || 'No title',
                            timestamp: new Date().toISOString()
                        });
                        // Only enqueue links from the same domain
                        await enqueueLinks({
                            selector: 'a[href]',
                            strategy: 'same-domain'
                        });
                    }
                    catch (error) {
                        log.error(`Error processing ${request.loadedUrl}: ${error}`);
                    }
                },
                failedRequestHandler({ request, log }) {
                    console.log(chalk_1.default.yellow(`      ⚠️  Could not crawl ${request.url}: Request failed`));
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
            console.log(chalk_1.default.green(`    ✅ Site crawl completed. Found ${results.length} pages`));
            return results;
        }
        catch (error) {
            console.error(chalk_1.default.red(`    ❌ Site crawl failed: ${error}`));
            return [startUrl]; // Return at least the start URL
        }
        finally {
            // Clean up dataset
            await this.clearDataset();
        }
    }
    async collectResults() {
        try {
            const datasetItems = await crawlee_1.Dataset.getData();
            const urls = datasetItems.items.map((item) => item.url);
            // Remove duplicates and return
            return Array.from(new Set(urls));
        }
        catch (error) {
            console.error(chalk_1.default.red(`Error collecting crawl results: ${error}`));
            return [];
        }
    }
    async clearDataset() {
        try {
            // Clear the default dataset
            await crawlee_1.Dataset.open().then(dataset => dataset.drop());
        }
        catch (error) {
            // Dataset might not exist, which is fine
        }
    }
    isPageUrl(url) {
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
            if (skipParams.some(param => Array.from(urlObj.searchParams.keys()).some(key => key.startsWith(param)))) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    // Method to crawl specific sections of a site
    async crawlSection(startUrl, sectionPath, maxPages = 20) {
        const allUrls = await this.crawlSite(startUrl, maxPages);
        // Filter URLs that belong to the specific section
        const filteredUrls = allUrls.filter(url => {
            try {
                const urlPath = new URL(url).pathname;
                return urlPath.startsWith(sectionPath);
            }
            catch (error) {
                return false;
            }
        });
        console.log(chalk_1.default.blue(`    📂 Found ${filteredUrls.length} pages in section '${sectionPath}'`));
        return filteredUrls;
    }
    // Method to get a sample of pages (useful for large sites)
    async getSamplePages(startUrl, sampleSize = 10) {
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
        console.log(chalk_1.default.blue(`    🎲 Selected ${sample.length} sample pages from ${allPages.length} discovered pages`));
        return sample;
    }
}
exports.CrawleeSiteCrawler = CrawleeSiteCrawler;
//# sourceMappingURL=crawlee-site-crawler.js.map