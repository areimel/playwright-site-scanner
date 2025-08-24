# ARDA Site Scan - Project Context

## Project Overview

ARDA Site Scan is a standalone CLI tool for comprehensive website analysis. It allows users to test any website for screenshots, SEO, and accessibility without requiring project integration. The tool is built with TypeScript and uses Playwright for browser automation.

Key features include:
- Universal testing by URL
- Site crawling option
- Responsive screenshots
- SEO analysis
- Accessibility testing with axe-core
- Progress tracking
- Organized results in timestamped sessions

## Project Structure

```
src/
├── cli.ts                  # Entry point for the CLI application
├── commands/               # CLI command implementations
│   └── walkthrough.ts      # Interactive walkthrough command
├── orchestrator/           # Core test orchestration logic
│   ├── test-orchestrator.ts # Main orchestrator class
│   ├── test-runner.ts       # Executes test phases
│   ├── browser-manager.ts   # Manages Playwright browser instances
│   ├── results-manager.ts   # Handles test results aggregation
│   ├── ui-styler.ts         # UI/UX for console output
│   ├── error-handler.ts     # Centralized error handling
│   └── test-config-manager.ts # Configuration validation and processing
├── lib/                    # Individual test implementations
│   ├── screenshot-tester.ts
│   ├── seo-tester.ts
│   ├── accessibility-tester.ts
│   ├── crawlee-site-crawler.ts
│   ├── sitemap-tester.ts
│   ├── content-scraper.ts
│   ├── site-summary-tester.ts
│   └── api-key-tester.ts
├── utils/                  # Utility functions and helpers
│   ├── session-manager.ts
│   ├── progress-tracker.ts
│   ├── validation.ts
│   ├── ascii-art.ts
│   ├── parallel-executor.ts
│   ├── reporter-manager.ts
│   ├── session-data-store.ts
│   ├── test-output-handler.ts
└── types/                  # TypeScript type definitions
```

## Key Components

### Test Orchestrator
The `TestOrchestrator` is the central component that manages the overall test execution flow. It delegates responsibilities to specialized modules while maintaining session state.

### Individual Testers
- `ScreenshotTester`: Captures responsive screenshots across different viewports
- `SEOTester`: Analyzes SEO elements like meta tags, headings, images, etc.
- `AccessibilityTester`: Runs WCAG compliance testing using axe-core
- `CrawleeSiteCrawler`: Discovers pages to test when crawling is enabled

### Utilities
- `SessionManager`: Handles file organization and session creation
- `ProgressTracker`: Provides real-time progress updates in the console
- `Validation`: URL validation and sanitization functions

## Building and Running

### Prerequisites
- Node.js 18.0.0 or higher
- Playwright browser binaries (install with `npx playwright install`)

### Development Commands
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

### Running the CLI
```bash
# Global installation
arda-site-scan

# Local development
npm start
# or
node dist/cli.js
```

## Development Conventions

- Written in TypeScript with strict typing
- Uses ES2022 target with commonjs module system
- Follows a modular architecture with clear separation of concerns
- Uses chalk for colored console output
- Uses inquirer for interactive command-line prompts
- Uses commander for CLI argument parsing
- Uses Playwright for browser automation
- Uses Crawlee for site crawling capabilities

## Output Structure

Results are organized in timestamped session folders:
```
arda-site-scan-sessions/
├── 07-24-2025_14-30/
│   ├── session-summary.md
│   ├── index/
│   │   ├── index-summary.md
│   │   ├── screenshots/
│   │   │   ├── index-desktop.png
│   │   │   ├── index-tablet.png
│   │   │   └── index-mobile.png
│   │   └── scans/
│   │       ├── index-seo-scan.md
│   │       └── index-accessibility-scan.md
│   └── about/
│       ├── about-summary.md
│       ├── screenshots/
│       └── scans/
```