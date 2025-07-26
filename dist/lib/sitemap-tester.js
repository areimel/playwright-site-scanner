"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitemapTester = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const session_manager_js_1 = require("../utils/session-manager.js");
const crawlee_site_crawler_js_1 = require("./crawlee-site-crawler.js");
class SitemapTester {
    sessionManager;
    siteCrawler;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
        this.siteCrawler = new crawlee_site_crawler_js_1.CrawleeSiteCrawler();
    }
    async generateSitemap(baseUrl, sessionId, crawlSite = true) {
        const startTime = new Date();
        const testResult = {
            testType: 'sitemap',
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    🗺️  Generating XML sitemap...`));
            // Discover all pages
            let urls;
            if (crawlSite) {
                console.log(chalk_1.default.gray(`      🕷️  Crawling site to discover pages...`));
                urls = await this.siteCrawler.crawlSite(baseUrl);
            }
            else {
                urls = [baseUrl];
            }
            console.log(chalk_1.default.gray(`      📄 Processing ${urls.length} URLs for sitemap`));
            // Generate sitemap entries
            const sitemapEntries = await this.generateSitemapEntries(urls, baseUrl);
            // Create XML sitemap
            const sitemapXml = this.generateSitemapXml(sitemapEntries);
            // Save sitemap to session directory
            const outputPath = await this.saveSitemap(sessionId, sitemapXml);
            testResult.status = 'success';
            testResult.outputPath = outputPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`    ✅ Sitemap generated with ${sitemapEntries.length} URLs`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ Sitemap generation failed: ${testResult.error}`));
        }
        return testResult;
    }
    async generateSitemapEntries(urls, baseUrl) {
        const baseUrlObj = new URL(baseUrl);
        const entries = [];
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
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`      ⚠️  Skipping invalid URL: ${url}`));
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
    calculatePriority(url, baseUrl) {
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
            if (depth === 1)
                return 0.8;
            if (depth === 2)
                return 0.6;
            if (depth === 3)
                return 0.4;
            return 0.2;
        }
        catch (error) {
            return 0.2; // Default low priority for problematic URLs
        }
    }
    determineChangeFrequency(url) {
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
    generateSitemapXml(entries) {
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
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    async saveSitemap(sessionId, sitemapXml) {
        const sessionPath = path_1.default.join(this.sessionManager['outputDir'], sessionId);
        const sitemapPath = path_1.default.join(sessionPath, 'sitemap.xml');
        await fs_1.promises.writeFile(sitemapPath, sitemapXml, 'utf8');
        return sitemapPath;
    }
    async validateSitemap(sitemapPath) {
        try {
            const content = await fs_1.promises.readFile(sitemapPath, 'utf8');
            // Basic XML validation
            if (!content.includes('<?xml') || !content.includes('<urlset') || !content.includes('</urlset>')) {
                return false;
            }
            // Check for required elements
            const urlMatches = content.match(/<url>/g);
            const locMatches = content.match(/<loc>/g);
            return !!(urlMatches && locMatches && urlMatches.length === locMatches.length);
        }
        catch (error) {
            return false;
        }
    }
    getSitemapStats(sitemapPath) {
        return fs_1.promises.readFile(sitemapPath, 'utf8').then(content => {
            const urlMatches = content.match(/<url>/g);
            const urlCount = urlMatches ? urlMatches.length : 0;
            const fileSize = Buffer.byteLength(content, 'utf8');
            return { urlCount, fileSize };
        });
    }
}
exports.SitemapTester = SitemapTester;
//# sourceMappingURL=sitemap-tester.js.map