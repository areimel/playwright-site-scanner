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

### Global Installation (Recommended)

```bash
# Install the package globally
npm install -g arda-site-scan

# Install Playwright browser binaries (required)
npx playwright install
```

### Local Development Setup

```bash
# Clone and setup for development
git clone <repository-url>
cd playwright-site-scanner
npm install
npm run build
```

## Usage

### Interactive Mode (Recommended)

Simply run the CLI without arguments to start the interactive walkthrough:

```bash
# Global installation
arda-site-scan

# Local development
npm start
# or
node dist/cli.js
```

The interactive mode will guide you through:
1. **URL Selection** - Enter the website you want to test
2. **Crawling Option** - Choose to test a single page or crawl the entire site
3. **Test Selection** - Pick from available tests (screenshots, SEO, accessibility)
4. **Confirmation** - Review your settings before starting

### Command Mode

Start the interactive walkthrough explicitly:

```bash
# Global installation
arda-site-scan start

# Local development
npm start
# or
node dist/cli.js start
```

## Test Types

### 📸 Screenshots
- Captures full-page screenshots across desktop (1920x1080), tablet (768x1024), and mobile (375x667) viewports
- Disabled animations and reduced motion for consistent results
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
- Comprehensive site overview using AI analysis
- Technology stack detection and recommendations
- Performance insights and optimization suggestions
- Content strategy analysis and SEO recommendations

## File Structure

```
playwright-site-scanner/
├── src/
│   ├── cli.ts                          # CLI entry point with Commander.js
│   ├── commands/
│   │   └── walkthrough.ts              # Interactive configuration wizard
│   ├── lib/                           # Test implementation modules
│   │   ├── accessibility-tester.ts     # WCAG compliance testing
│   │   ├── api-key-tester.ts          # API key validation (future)
│   │   ├── content-scraper.ts         # Page content extraction
│   │   ├── crawlee-site-crawler.ts    # Site discovery and crawling
│   │   ├── html-reporter.ts           # Interactive HTML report generation
│   │   ├── screenshot-tester.ts       # Multi-viewport screenshot capture
│   │   ├── seo-tester.ts             # SEO element analysis
│   │   ├── site-summary-tester.ts    # AI-powered site analysis
│   │   └── sitemap-tester.ts         # XML sitemap generation
│   ├── orchestrator/                  # Core coordination layer
│   │   ├── browser-manager.ts         # Playwright browser lifecycle
│   │   ├── error-handler.ts          # Centralized error management
│   │   ├── results-manager.ts        # Test result aggregation
│   │   ├── test-config-manager.ts    # Configuration management
│   │   ├── test-orchestrator.ts      # Main orchestration controller
│   │   ├── test-runner.ts           # Test execution coordination
│   │   └── ui-styler.ts             # Console output styling
│   ├── types/                        # TypeScript type definitions
│   │   ├── config-types.ts          # Configuration interfaces
│   │   ├── index.ts                 # Core type definitions
│   │   └── test-phases.ts           # Phase-based execution types
│   └── utils/                       # Utility modules
│       ├── loading-screen/          # Interactive loading components
│       │   ├── index.ts
│       │   ├── loading-info.ts
│       │   ├── loading-progress-bar.ts
│       │   ├── loading-screen.ts
│       │   ├── loading-text.ts
│       │   └── platform-detector.ts
│       ├── ascii-art.ts            # CLI branding and banners
│       ├── config-loader.ts        # Configuration file handling
│       ├── parallel-executor.ts    # Concurrent task execution
│       ├── progress-tracker.ts     # Real-time progress display
│       ├── qr-code.ts             # QR code generation
│       ├── reporter-manager.ts     # Report output coordination
│       ├── session-data-store.ts  # Session data persistence
│       ├── session-manager.ts     # File organization and cleanup
│       ├── session-progress-tracker.ts # Session-level progress
│       └── validation.ts          # Input validation utilities
├── dist/                          # Compiled JavaScript output
├── arda-site-scan-sessions/       # Test session results (generated)
├── package.json                   # Project configuration and scripts
├── tsconfig.json                  # TypeScript configuration
├── CLAUDE.md                      # Development guidelines and architecture
└── README.md                      # Project documentation
```

## Output Structure

Results are organized in timestamped session folders with comprehensive reports:

```
arda-site-scan-sessions/
├── 09-25-2025_14-30/                    # Session timestamp
│   ├── session-summary.md               # Overall session statistics
│   ├── session-report.html             # Interactive HTML dashboard
│   ├── sitemap.xml                     # Generated XML sitemap
│   ├── site-summary.md                 # AI-powered site analysis
│   ├── index/                          # Page-specific results
│   │   ├── index-summary.md            # Page overview
│   │   ├── index-content.md            # Scraped content
│   │   ├── screenshots/
│   │   │   ├── index-desktop.png       # 1920x1080 screenshot
│   │   │   ├── index-tablet.png        # 768x1024 screenshot
│   │   │   └── index-mobile.png        # 375x667 screenshot
│   │   └── scans/
│   │       ├── index-seo-scan.md       # SEO analysis report
│   │       └── index-accessibility-scan.md # WCAG compliance report
│   └── about/                          # Additional discovered pages
│       ├── about-summary.md
│       ├── about-content.md
│       ├── screenshots/
│       └── scans/
```

## Requirements

- Node.js 18.0.0 or higher
- Playwright browser binaries (install with `npx playwright install`)
- Internet connection for axe-core CDN access during accessibility testing

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Clean build directory
npm run clean
```

## Architecture

Built with **TypeScript** using a modular **orchestrator pattern** with three-phase execution:

### Core Architecture Components

- **Test Orchestrator** (`test-orchestrator.ts`) - Central coordination and browser lifecycle management
- **Test Runner** (`test-runner.ts`) - Phase-based test execution with parallel processing
- **Results Manager** (`results-manager.ts`) - Test result aggregation and HTML report generation
- **Browser Manager** (`browser-manager.ts`) - Playwright browser instance management
- **Session Manager** (`session-manager.ts`) - File organization, cleanup, and session persistence

### Three-Phase Execution System

1. **Phase 1: Discovery & Collection** (Concurrency: 3)
   - Site crawling and page discovery
   - Content scraping and extraction
   - Sitemap generation

2. **Phase 2: Analysis & Testing** (Concurrency: 5)
   - Multi-viewport screenshot capture
   - SEO analysis and optimization
   - WCAG accessibility compliance testing

3. **Phase 3: Reporting & Finalization** (Concurrency: 2)
   - AI-powered site summary generation
   - HTML report compilation
   - Session statistics and cleanup

### Modular Test Libraries

- **CrawleeSiteCrawler** - Page discovery using Crawlee with PlaywrightCrawler
- **ScreenshotTester** - Multi-viewport screenshot capture with animation disabling
- **SEOTester** - Comprehensive SEO element analysis and reporting
- **AccessibilityTester** - WCAG compliance testing with axe-core integration
- **ContentScraper** - Page content extraction to structured markdown
- **SitemapTester** - XML sitemap generation for search engines
- **SiteSummaryTester** - AI-powered comprehensive site analysis
- **HTMLReporter** - Interactive HTML dashboard generation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC License - see package.json for details

## Troubleshooting

### Common Issues

**Browser Download Fails**

If you're having issues with browser binaries, ensure they're installed:
```bash
npx playwright install
```

**Command Not Found (arda-site-scan)**

If the global command isn't working after installation:
```bash
# Reinstall globally
npm install -g arda-site-scan

# Or use npx to run without global install
npx arda-site-scan
```

**Permission Errors on Windows**
```bash
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**TypeScript Build Errors**
```bash
npm run clean
npm run build
```

### Getting Help

- Check the `session-summary.md` file for detailed error information
- Ensure the target website is accessible and not blocking automated tools
- Verify your internet connection for axe-core CDN access

## Recent Updates

### Version 2.0+ Features
- ✅ **Three-Phase Execution System** - Optimized parallel processing with phase-based coordination
- ✅ **Interactive HTML Reports** - Rich dashboard with embedded screenshots and navigation
- ✅ **AI-Powered Site Summaries** - Comprehensive site analysis with technology detection
- ✅ **Content Scraping** - Full page content extraction to structured markdown
- ✅ **XML Sitemap Generation** - SEO-optimized sitemaps with proper metadata
- ✅ **Enhanced Loading Screens** - Real-time progress tracking with visual feedback
- ✅ **Configurable Test Selection** - Flexible test combinations and configuration
- ✅ **QR Code Generation** - Easy mobile testing with QR code links
- ✅ **Session Persistence** - Robust session data management and recovery

## Roadmap

### Planned Features
- [ ] **Performance Testing Integration** - Lighthouse-powered performance audits
- [ ] **Form Testing capabilities** - Automated form validation and accessibility
- [ ] **Custom Viewport Configurations** - User-defined screen sizes and devices
- [ ] **CI/CD Integration Helpers** - GitHub Actions and Jenkins integration
- [ ] **Custom Test Rule Configurations** - User-defined SEO and accessibility rules
- [ ] **Export Format Options** - PDF reports and JSON data export
- [ ] **Plugin Architecture** - Extensible test framework for custom analyzers
- [ ] **Multi-language Support** - Internationalization for global testing
- [ ] **API Testing Module** - REST API endpoint validation and documentation
- [ ] **Database Integration** - Test result storage and historical analysis