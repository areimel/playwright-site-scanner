"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionDataManager = void 0;
class SessionDataManager {
    data;
    constructor(baseUrl, sessionId) {
        this.data = {
            urls: [],
            baseUrl,
            sessionId,
            scrapedContent: new Map(),
            pageMetrics: new Map(),
            sitemapEntries: [],
            phase1Complete: false,
            phase2Complete: false,
            phase3Complete: false,
            errors: new Map()
        };
    }
    // URL management
    setUrls(urls) {
        this.data.urls = [...urls];
    }
    getUrls() {
        return [...this.data.urls];
    }
    // Scraped content management
    setScrapedContent(url, content) {
        this.data.scrapedContent.set(url, content);
        // Also update page metrics when content is scraped
        this.updatePageMetrics(url, {
            url,
            wordCount: this.calculateWordCount(content),
            imageCount: content.images.length,
            linkCount: content.links.length,
            title: content.title,
            description: content.metadata.description,
            errors: []
        });
    }
    getScrapedContent(url) {
        return this.data.scrapedContent.get(url);
    }
    getAllScrapedContent() {
        return new Map(this.data.scrapedContent);
    }
    // Page metrics management
    updatePageMetrics(url, metrics) {
        const existing = this.data.pageMetrics.get(url) || {
            url,
            wordCount: 0,
            imageCount: 0,
            linkCount: 0,
            title: '',
            description: '',
            errors: []
        };
        this.data.pageMetrics.set(url, { ...existing, ...metrics });
    }
    getPageMetrics(url) {
        return this.data.pageMetrics.get(url);
    }
    getAllPageMetrics() {
        return new Map(this.data.pageMetrics);
    }
    // Sitemap management
    setSitemapEntries(entries) {
        this.data.sitemapEntries = [...entries];
    }
    getSitemapEntries() {
        return [...this.data.sitemapEntries];
    }
    // Phase tracking
    markPhaseComplete(phase) {
        switch (phase) {
            case 1:
                this.data.phase1Complete = true;
                break;
            case 2:
                this.data.phase2Complete = true;
                break;
            case 3:
                this.data.phase3Complete = true;
                break;
        }
    }
    isPhaseComplete(phase) {
        switch (phase) {
            case 1:
                return this.data.phase1Complete;
            case 2:
                return this.data.phase2Complete;
            case 3:
                return this.data.phase3Complete;
            default:
                return false;
        }
    }
    // Error management
    addError(context, error) {
        const existing = this.data.errors.get(context) || [];
        existing.push(error);
        this.data.errors.set(context, existing);
    }
    getErrors(context) {
        if (context) {
            return this.data.errors.get(context) || [];
        }
        return new Map(this.data.errors);
    }
    // Statistics and aggregation
    getTotalWordCount() {
        return Array.from(this.data.pageMetrics.values())
            .reduce((sum, metrics) => sum + metrics.wordCount, 0);
    }
    getTotalImageCount() {
        return Array.from(this.data.pageMetrics.values())
            .reduce((sum, metrics) => sum + metrics.imageCount, 0);
    }
    getTotalLinkCount() {
        return Array.from(this.data.pageMetrics.values())
            .reduce((sum, metrics) => sum + metrics.linkCount, 0);
    }
    getAverageWordsPerPage() {
        const metrics = Array.from(this.data.pageMetrics.values());
        if (metrics.length === 0)
            return 0;
        const totalWords = metrics.reduce((sum, m) => sum + m.wordCount, 0);
        return Math.round(totalWords / metrics.length);
    }
    // Content type analysis
    analyzeContentTypes() {
        const distribution = {};
        for (const url of this.data.urls) {
            const contentType = this.determineContentType(url);
            distribution[contentType] = (distribution[contentType] || 0) + 1;
        }
        return distribution;
    }
    // Page summary generation from stored data
    generatePageSummaries() {
        return this.data.urls.map(url => {
            const content = this.data.scrapedContent.get(url);
            const metrics = this.data.pageMetrics.get(url);
            return {
                url,
                title: metrics?.title || content?.title || this.extractTitleFromUrl(url),
                description: metrics?.description || content?.metadata.description || `Page at ${url}`,
                headings: content?.headings.map(h => h.text) || [],
                wordCount: metrics?.wordCount || 0,
                imageCount: metrics?.imageCount || 0,
                linkCount: metrics?.linkCount || 0,
                lastModified: content?.metadata.modifiedDate,
                contentType: this.determineContentType(url),
                depth: this.calculateUrlDepth(url)
            };
        });
    }
    // Utility methods
    calculateWordCount(content) {
        const textSources = [
            content.title,
            ...content.headings.map(h => h.text),
            ...content.paragraphs,
            ...content.lists.flatMap(l => l.items)
        ];
        return textSources
            .join(' ')
            .split(/\s+/)
            .filter(word => word.length > 0)
            .length;
    }
    determineContentType(url) {
        const urlLower = url.toLowerCase();
        try {
            const urlObj = new URL(url);
            if (urlObj.pathname === '/' || urlObj.pathname === '') {
                return 'homepage';
            }
        }
        catch (error) {
            // Fall through to other checks
        }
        if (urlLower.includes('/blog/') || urlLower.includes('/news/') ||
            urlLower.includes('/post/') || urlLower.includes('/article/')) {
            return 'blog';
        }
        if (urlLower.includes('/product/') || urlLower.includes('/shop/') ||
            urlLower.includes('/store/')) {
            return 'product';
        }
        if (urlLower.includes('/service/') || urlLower.includes('/solution/')) {
            return 'service';
        }
        if (urlLower.includes('/about')) {
            return 'about';
        }
        if (urlLower.includes('/contact')) {
            return 'contact';
        }
        return 'generic';
    }
    calculateUrlDepth(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            return pathSegments.length;
        }
        catch (error) {
            return 0;
        }
    }
    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            if (pathSegments.length === 0) {
                return 'Home';
            }
            const lastSegment = pathSegments[pathSegments.length - 1];
            return lastSegment
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        catch (error) {
            return 'Unknown Page';
        }
    }
    // Getter methods
    get sessionId() {
        return this.data.sessionId;
    }
    get baseUrl() {
        return this.data.baseUrl;
    }
    // Debug and inspection methods
    getSessionStats() {
        return {
            totalUrls: this.data.urls.length,
            scrapedPages: this.data.scrapedContent.size,
            pagesWithMetrics: this.data.pageMetrics.size,
            totalErrors: Array.from(this.data.errors.values()).flat().length,
            phase1Complete: this.data.phase1Complete,
            phase2Complete: this.data.phase2Complete,
            phase3Complete: this.data.phase3Complete
        };
    }
}
exports.SessionDataManager = SessionDataManager;
//# sourceMappingURL=session-data-store.js.map