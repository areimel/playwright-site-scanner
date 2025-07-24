"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEOTester = void 0;
const chalk_1 = __importDefault(require("chalk"));
const session_manager_js_1 = require("../utils/session-manager.js");
class SEOTester {
    sessionManager;
    constructor() {
        this.sessionManager = new session_manager_js_1.SessionManager();
    }
    async runSEOScan(page, pageUrl, sessionId) {
        const startTime = new Date();
        const pageName = this.sessionManager.getPageName(pageUrl);
        const testResult = {
            testType: 'seo-scan',
            status: 'pending',
            startTime
        };
        try {
            console.log(chalk_1.default.gray(`    🔍 Running SEO scan...`));
            const seoData = await this.extractSEOData(page);
            const seoReport = this.generateSEOReport(seoData, pageUrl);
            await this.sessionManager.createPageDirectory(sessionId, pageName);
            const scanPath = this.sessionManager.getScanPath(sessionId, pageName, 'seo-scan');
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.writeFile(scanPath, seoReport, 'utf8');
            testResult.status = 'success';
            testResult.outputPath = scanPath;
            testResult.endTime = new Date();
            console.log(chalk_1.default.green(`    ✅ SEO scan completed`));
        }
        catch (error) {
            testResult.status = 'failed';
            testResult.error = error instanceof Error ? error.message : String(error);
            testResult.endTime = new Date();
            console.log(chalk_1.default.red(`    ❌ SEO scan failed: ${testResult.error}`));
        }
        return testResult;
    }
    async extractSEOData(page) {
        return await page.evaluate(() => {
            const seoData = {
                title: document.title || '',
                metaDescription: '',
                metaKeywords: '',
                headings: {},
                images: [],
                links: [],
                openGraph: {},
                canonicalUrl: '',
                robots: '',
                structuredData: []
            };
            // Meta tags
            const metaTags = document.querySelectorAll('meta');
            metaTags.forEach((meta) => {
                const name = meta.getAttribute('name')?.toLowerCase();
                const property = meta.getAttribute('property')?.toLowerCase();
                const content = meta.getAttribute('content') || '';
                if (name === 'description')
                    seoData.metaDescription = content;
                if (name === 'keywords')
                    seoData.metaKeywords = content;
                if (name === 'robots')
                    seoData.robots = content;
                if (property?.startsWith('og:')) {
                    seoData.openGraph[property] = content;
                }
            });
            // Canonical URL
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical)
                seoData.canonicalUrl = canonical.href;
            // Headings
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
                const elements = document.querySelectorAll(tag);
                seoData.headings[tag] = Array.from(elements).map((el) => el.textContent?.trim() || '');
            });
            // Images
            const images = document.querySelectorAll('img');
            seoData.images = Array.from(images).map((img) => ({
                src: img.src,
                alt: img.alt || ''
            }));
            // Links
            const links = document.querySelectorAll('a[href]');
            seoData.links = Array.from(links).map((link) => {
                const anchorLink = link;
                const href = anchorLink.href;
                const text = anchorLink.textContent?.trim() || '';
                const isExternal = !href.startsWith(window.location.origin) &&
                    (href.startsWith('http') || href.startsWith('//'));
                return { href, text, isExternal };
            });
            // Structured data
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            jsonLdScripts.forEach((script) => {
                const scriptElement = script;
                try {
                    const data = JSON.parse(scriptElement.textContent || '');
                    seoData.structuredData.push(data);
                }
                catch (e) {
                    // Invalid JSON, skip
                }
            });
            return seoData;
        });
    }
    generateSEOReport(seoData, pageUrl) {
        let report = `# SEO Scan Report\n\n`;
        report += `**URL:** ${pageUrl}\n`;
        report += `**Scan Date:** ${new Date().toISOString()}\n\n`;
        // Title Analysis
        report += `## Title Tag\n`;
        if (seoData.title) {
            report += `**Title:** ${seoData.title}\n`;
            report += `**Length:** ${seoData.title.length} characters\n`;
            if (seoData.title.length < 30) {
                report += `⚠️ **Warning:** Title is too short (recommended: 30-60 characters)\n`;
            }
            else if (seoData.title.length > 60) {
                report += `⚠️ **Warning:** Title is too long (recommended: 30-60 characters)\n`;
            }
            else {
                report += `✅ **Good:** Title length is optimal\n`;
            }
        }
        else {
            report += `❌ **Error:** No title tag found\n`;
        }
        report += '\n';
        // Meta Description
        report += `## Meta Description\n`;
        if (seoData.metaDescription) {
            report += `**Description:** ${seoData.metaDescription}\n`;
            report += `**Length:** ${seoData.metaDescription.length} characters\n`;
            if (seoData.metaDescription.length < 120) {
                report += `⚠️ **Warning:** Meta description is too short (recommended: 120-160 characters)\n`;
            }
            else if (seoData.metaDescription.length > 160) {
                report += `⚠️ **Warning:** Meta description is too long (recommended: 120-160 characters)\n`;
            }
            else {
                report += `✅ **Good:** Meta description length is optimal\n`;
            }
        }
        else {
            report += `❌ **Error:** No meta description found\n`;
        }
        report += '\n';
        // Headings Analysis
        report += `## Heading Structure\n`;
        Object.entries(seoData.headings).forEach(([tag, headings]) => {
            if (headings.length > 0) {
                report += `**${tag.toUpperCase()}** (${headings.length}):\n`;
                headings.forEach(heading => {
                    report += `- ${heading}\n`;
                });
                report += '\n';
            }
        });
        if (seoData.headings.h1?.length === 0) {
            report += `❌ **Error:** No H1 tag found\n`;
        }
        else if (seoData.headings.h1?.length > 1) {
            report += `⚠️ **Warning:** Multiple H1 tags found (${seoData.headings.h1.length})\n`;
        }
        else {
            report += `✅ **Good:** Single H1 tag found\n`;
        }
        report += '\n';
        // Images Analysis
        report += `## Images\n`;
        const imagesWithoutAlt = seoData.images.filter(img => !img.alt);
        report += `**Total Images:** ${seoData.images.length}\n`;
        report += `**Images without Alt Text:** ${imagesWithoutAlt.length}\n`;
        if (imagesWithoutAlt.length > 0) {
            report += `⚠️ **Warning:** ${imagesWithoutAlt.length} images missing alt text\n`;
            imagesWithoutAlt.slice(0, 5).forEach(img => {
                report += `- ${img.src}\n`;
            });
            if (imagesWithoutAlt.length > 5) {
                report += `... and ${imagesWithoutAlt.length - 5} more\n`;
            }
        }
        else if (seoData.images.length > 0) {
            report += `✅ **Good:** All images have alt text\n`;
        }
        report += '\n';
        // Links Analysis
        report += `## Links\n`;
        const externalLinks = seoData.links.filter(link => link.isExternal);
        report += `**Total Links:** ${seoData.links.length}\n`;
        report += `**External Links:** ${externalLinks.length}\n`;
        report += `**Internal Links:** ${seoData.links.length - externalLinks.length}\n\n`;
        // Open Graph
        if (Object.keys(seoData.openGraph).length > 0) {
            report += `## Open Graph Tags\n`;
            Object.entries(seoData.openGraph).forEach(([property, content]) => {
                report += `**${property}:** ${content}\n`;
            });
            report += '\n';
        }
        // Canonical URL
        report += `## Canonical URL\n`;
        if (seoData.canonicalUrl) {
            report += `**Canonical:** ${seoData.canonicalUrl}\n`;
            report += `✅ **Good:** Canonical URL is set\n`;
        }
        else {
            report += `⚠️ **Warning:** No canonical URL found\n`;
        }
        report += '\n';
        // Robots
        report += `## Robots Meta Tag\n`;
        if (seoData.robots) {
            report += `**Robots:** ${seoData.robots}\n`;
        }
        else {
            report += `**Robots:** Not specified (defaults to index, follow)\n`;
        }
        report += '\n';
        // Structured Data
        if (seoData.structuredData.length > 0) {
            report += `## Structured Data\n`;
            report += `**Schema.org scripts found:** ${seoData.structuredData.length}\n`;
            seoData.structuredData.forEach((data, index) => {
                const type = data['@type'] || 'Unknown';
                report += `- Schema ${index + 1}: ${type}\n`;
            });
            report += '\n';
        }
        return report;
    }
}
exports.SEOTester = SEOTester;
//# sourceMappingURL=seo-tester.js.map