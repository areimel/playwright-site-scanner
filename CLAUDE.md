# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
- `npm run build` - Compile TypeScript to `dist/` directory
- `npm start` - Run the CLI tool (starts interactive walkthrough)
- `npm run dev` - Build and start in one command (development workflow)
- `npm run clean` - Remove the `dist/` directory

### Running the Tool
The CLI defaults to interactive mode when run without arguments:
```bash
npm start
# or
node dist/cli.js
```

Explicit command to start walkthrough:
```bash
node dist/cli.js start
```

## Architecture Overview

This is a TypeScript CLI tool for automated website testing using Playwright. The architecture follows an **orchestrator pattern** with modular test implementations.

### Core Components

**Entry Point** (`src/cli.ts`)
- Commander.js-based CLI that defaults to interactive walkthrough
- Displays ASCII art banner and starts the walkthrough flow

**Test Orchestrator** (`src/orchestrator/test-orchestrator.ts`)
- Central coordinator that manages the entire testing session
- Handles browser lifecycle (Chromium via Playwright)
- Coordinates page discovery, test execution, and result generation
- Manages session directories and progress tracking

**Interactive Walkthrough** (`src/commands/walkthrough.ts`)
- Inquirer.js-based prompts for configuration
- Guides users through URL input, crawling options, and test selection
- Available tests: Screenshots, SEO Scan, Accessibility Scan
- Default viewports: desktop (1920x1080), tablet (768x1024), mobile (375x667)

**Test Libraries** (`src/lib/`)
- `crawlee-site-crawler.ts` - Site discovery using Crawlee with PlaywrightCrawler
- `screenshot-tester.ts` - Multi-viewport screenshot capture
- `seo-tester.ts` - SEO element analysis (meta tags, headings, links, etc.)
- `accessibility-tester.ts` - WCAG compliance testing with axe-core

**Utilities** (`src/utils/`)
- `session-manager.ts` - File organization and report generation
- `progress-tracker.ts` - Real-time progress display during execution
- `validation.ts` - URL validation for user input
- `ascii-art.ts` - CLI branding and welcome screens

### Key Implementation Details

**Session Management**
- Results organized in timestamped directories: `playwright-site-scanner-sessions/MM-DD-YYYY_HH-MM/`
- Each page gets its own subdirectory with screenshots and scan reports
- Session-level summary with statistics and error tracking

**Site Crawling**
- Uses Crawlee's PlaywrightCrawler for page discovery
- Restricts crawling to same domain as starting URL
- Configurable max pages (default: 50) to prevent runaway crawls
- Respects `networkidle` state for consistent page loading

**Browser Management**
- Single Chromium browser instance managed by TestOrchestrator
- Headless mode with sandbox disabled for compatibility
- New page context per URL to isolate tests
- Proper cleanup on session completion or error

**Test Execution Flow**
1. Browser initialization
2. Page discovery (single URL or site crawl)
3. Session directory creation
4. Per-page testing loop with progress tracking
5. Result aggregation and summary generation
6. Browser cleanup

**TypeScript Configuration**
- Targets ES2022 with CommonJS modules
- Outputs to `dist/` with source maps and declarations
- Strict mode enabled with comprehensive type checking