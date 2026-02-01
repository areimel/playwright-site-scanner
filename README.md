```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   █████╗     ██████╗     ██████╗      █████╗                          ║             
║  ██╔══██╗    ██╔══██╗    ██╔══██╗    ██╔══██╗                         ║             
║  ███████║    ██████╔╝    ██║  ██║    ███████║                         ║             
║  ██╔══██║    ██╔══██╗    ██║  ██║    ██╔══██║                         ║             
║  ██║  ██║██╗ ██║  ██║██╗ ██████╔╝██╗ ██║  ██║██╗                      ║             
║  ╚═╝  ╚═╝╚═╝ ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝ ╚═╝  ╚═╝╚═╝                      ║
║                                                                       ║
║  ███████╗██╗████████╗███████╗    ███████╗ ██████╗ █████╗ ███╗   ██╗   ║
║  ██╔════╝██║╚══██╔══╝██╔════╝    ██╔════╝██╔════╝██╔══██╗████╗  ██║   ║
║  ███████╗██║   ██║   █████╗      ███████╗██║     ███████║██╔██╗ ██║   ║
║  ╚════██║██║   ██║   ██╔══╝      ╚════██║██║     ██╔══██║██║╚██╗██║   ║
║  ███████║██║   ██║   ███████╗    ███████║╚██████╗██║  ██║██║ ╚████║   ║
║  ╚══════╝╚═╝   ╚═╝   ╚══════╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝   ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

# ARDA Site Scan

A comprehensive TypeScript CLI tool for automated website testing and analysis using Playwright. Features modular architecture with orchestrated test execution, interactive UI, and detailed reporting.

## Features

🌐 **Universal Testing** - Test any website by URL
🕷️ **Site Crawling** - Option to crawl and test entire sites
📸 **Screenshots** - Capture responsive screenshots across viewports
🔍 **SEO Analysis** - Comprehensive SEO scanning and reporting
♿ **Accessibility Testing** - WCAG compliance testing with axe-core
📄 **Content Scraping** - Extract and organize page content
🗺️ **Sitemap Generation** - Create XML sitemaps for SEO
📊 **Site Summary** - AI-powered comprehensive site analysis
🎯 **Progress Tracking** - Real-time progress display with loading screens
📁 **Organized Results** - Timestamped sessions with HTML and markdown reports
🔧 **Configurable** - Flexible test configuration and viewport options

## Links
NPM: https://www.npmjs.com/package/arda-site-scan
Github: https://github.com/areimel/playwright-site-scanner
Landing Page: COMING SOON

## Installation

### Global Installation - Use as a global command-line tool

```bash
# Install the package globally
pnpm add -g arda-site-scan

# Install Playwright browser binaries (required)
pnpm exec playwright install
```

### Local Development Setup - Customize your own version

```bash
# Clone and setup for development
git clone <repository-url>
cd playwright-site-scanner
pnpm install
pnpm run build
```

## Usage

### Interactive Mode (Recommended)

Simply run the CLI without arguments to start the interactive walkthrough:

```bash
# Global Tool
arda-site-scan

# Local Dev
pnpm start
```

The interactive mode will guide you through:
1. **URL Selection** - Enter the website you want to test
2. **Crawling Option** - Choose to test a single page or crawl the entire site
3. **Test Selection** - Pick from available tests (screenshots, SEO, accessibility)
4. **Confirmation** - Review your settings before starting

## Test Types

### 📸 Screenshots
- Captures screenshots across multiple viewports:
 - desktop (1920x1080) 
 - tablet (768x1024) 
 - mobile (375x667)
- Options for capturing both full-page and "above-the-fold" screenshots
- High-quality PNG output organized by viewport

### 🔍 SEO Scan
- Title tag analysis (length, presence, uniqueness)
- Meta description evaluation and optimization suggestions
- Heading structure examination (H1-H6 hierarchy)
- Image alt text validation and accessibility
- Internal/external link analysis with broken link detection
- Open Graph and Twitter Card tag detection
- Canonical URL verification
- Structured data (Schema.org) identification and validation

### ♿ Accessibility Scan
- WCAG 2.1 AA/AAA compliance testing using axe-core
- Categorized issues by severity (critical, serious, moderate, minor)
- Detailed violation reports with fix recommendations
- Element-specific violation details with CSS selectors
- Color contrast analysis and keyboard navigation testing

### 📄 Content Scraping
- Full page content extraction to structured markdown
- Image inventory with metadata and optimization suggestions
- Link cataloging with categorization (internal/external)
- Text content analysis for SEO and readability

### 🗺️ Sitemap Generation
- XML sitemap creation from discovered pages
- SEO-optimized with proper priority and change frequency
- Automatically excludes error pages and redirects

### 📊 Site Summary
- Quick reference for full scan session results
- Technology stack detection and recommendations
- Performance insights and optimization suggestions
- Content strategy analysis and SEO recommendations

## Requirements

- Node.js 18.0.0 or higher
- Playwright browser binaries (install with `pnpm exec playwright install`)

## Roadmap

### Planned Features
- [ ] **Improved Results Dashboard** - more user-friendly and interactive HTML dashboard
- [ ] **Security Issue Testing** - API key exposure, 
- [ ] **Performance Testing Integration** - Lighthouse-powered performance audits
- [ ] **Form Testing capabilities** - Automated form validation and accessibility
- [ ] **CI/CD Integration Helpers** - Integrate this tool into your build pipeline
- [ ] **Custom Test Rule Configurations** - User-defined SEO and accessibility rules