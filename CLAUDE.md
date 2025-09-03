# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
- `npm run build` - Clean and compile TypeScript to `dist/` directory
- `npm start` - Run the CLI tool (starts interactive walkthrough)
- `npm run dev` - Build and start in one command (development workflow)
- `npm run clean` - Remove the `arda-site-scan-sessions/` directory

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
- `content-scraper.ts` - Extracts page content and images to markdown files
- `sitemap-tester.ts` - Generates XML sitemaps for search engine submission
- `site-summary-tester.ts` - Creates comprehensive site overview reports

**Utilities** (`src/utils/`)
- `session-manager.ts` - File organization and report generation
- `progress-tracker.ts` - Real-time progress display during execution
- `validation.ts` - URL validation for user input
- `ascii-art.ts` - CLI branding and welcome screens
- `parallel-executor.ts` - Task parallelization with concurrency control
- `session-data-store.ts` - Data persistence and retrieval for test sessions

### Key Implementation Details

**Three-Phase Execution Strategy** (`src/types/test-phases.ts`)
The orchestrator organizes tests into three sequential phases for optimal performance:

1. **Phase 1: Data Discovery & Collection**
   - Site crawling (discovers all pages)
   - Content scraping for all pages
   - Sitemap generation from discovered URLs

2. **Phase 2: Page Analysis & Testing**
   - Screenshots across all viewports (desktop, tablet, mobile)
   - SEO scans (meta tags, headings, links, structured data)
   - Accessibility testing with axe-core

3. **Phase 3: Report Generation & Finalization**
   - Site summary using scraped content
   - Session reports and statistics

**Parallel Execution System**
- Uses `ParallelExecutor` utility for concurrent task execution
- Configurable concurrency limits per phase (Phase 1: 3, Phase 2: 5, Phase 3: 2)
- Progress tracking with real-time updates
- Error handling with graceful degradation

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

**HTML Reporter Integration**
- Interactive HTML reports generated using custom `HTMLReporter` class
- Cross-platform auto-opening functionality with user-configurable behavior
- Screenshot embedding with click-to-enlarge modal functionality
- Integrated with three-phase orchestrator pattern for comprehensive test result display

**TypeScript Configuration**
- Targets ES2022 with CommonJS modules
- Outputs to `dist/` with source maps and declarations
- Strict mode enabled with comprehensive type checking

## Known Issues & Fixes

### HTML Reporter Duplicate Test Results (Fixed - August 2025)

**Issue**: HTML Reporter was displaying duplicate content-scraping tests under each page, showing all content-scraping results from all pages rather than just the relevant tests for each specific page.

**Root Cause**: Flawed filtering logic in `TestOrchestrator.ts` at two locations (lines 369-373 and 493-497) that included a redundant condition:

```typescript
// Problematic filtering logic
const pageTests = this.allTestResults.filter(result => {
  return result.outputPath?.includes(this.sessionManager.getPageName(url)) ||
         result.testType === 'content-scraping'; // ← This was the problem
});
```

The `|| result.testType === 'content-scraping'` condition incorrectly included ALL content-scraping tests from all pages for every page's results, causing massive duplication in multi-page crawls.

**Solution**: Removed the redundant `|| result.testType === 'content-scraping'` condition from both filtering locations, leaving only the page-specific outputPath matching:

```typescript
// Corrected filtering logic
const pageTests = this.allTestResults.filter(result => {
  return result.outputPath?.includes(this.sessionManager.getPageName(url));
});
```

**Result**: Each page in HTML reports now shows only its own test results, eliminating duplicate display while maintaining all correct functionality.

**Files Modified**: `src/orchestrator/test-orchestrator.ts` (both `generateFinalSessionSummary()` and `generateHTMLReports()` methods)

## Adding New Playwright Tests

This section provides a comprehensive workflow for adding new test capabilities to the Playwright Site Scanner. Follow these steps to ensure proper integration with the orchestrator pattern and three-phase execution system.

### Test Implementation Architecture

The project uses a **modular orchestrator pattern** where:
- **Test Orchestrator** (`src/orchestrator/test-orchestrator.ts`) coordinates all testing
- **Individual Test Classes** (`src/lib/*-tester.ts`) implement specific testing capabilities
- **Phase Classification System** (`src/types/test-phases.ts`) organizes tests into execution phases
- **Walkthrough Interface** (`src/commands/walkthrough.ts`) presents test options to users

### Step-by-Step Implementation Workflow

#### 1. Create the Test Class

Create a new file in `src/lib/` following the naming convention `*-tester.ts`:

```typescript
// src/lib/my-new-tester.ts
import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';

export class MyNewTester {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async runMyNewTest(page: Page, pageUrl: string, sessionId: string): Promise<TestResult> {
    const startTime = new Date();
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    const testResult: TestResult = {
      testType: 'my-new-test',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    🔍 Running my new test...`));

      // Your test implementation here
      const testData = await this.performTestLogic(page);
      const report = this.generateReport(testData, pageUrl);

      // Save results
      await this.sessionManager.createPageDirectory(sessionId, pageName);
      const outputPath = this.sessionManager.getScanPath(sessionId, pageName, 'my-new-test');
      
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, report, 'utf8');

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      return testResult;
    } catch (error) {
      console.error(chalk.red(`    ❌ My new test failed: ${error}`));
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.endTime = new Date();
      return testResult;
    }
  }

  private async performTestLogic(page: Page): Promise<any> {
    // Implement your test logic here
    return {};
  }

  private generateReport(data: any, pageUrl: string): string {
    // Generate your report format here
    return `# My New Test Report\n\nURL: ${pageUrl}\n\n${JSON.stringify(data, null, 2)}`;
  }
}
```

#### 2. Add Test to Phase Classification System

Update `src/types/test-phases.ts` to include your new test in the `TEST_CLASSIFICATIONS` object:

```typescript
// Add to TEST_CLASSIFICATIONS object
'my-new-test': {
  testId: 'my-new-test',
  phase: 2, // Choose appropriate phase (1, 2, or 3)
  scope: 'page', // 'page' or 'session'
  executionOrder: 4, // Order within the phase
  dependencies: [], // List of test IDs this test depends on
  conflictsWith: [], // List of test IDs that conflict with this test
  resourceIntensive: false // true if this test uses significant resources
}
```

#### 3. Add Test to Walkthrough Options

Update `src/commands/walkthrough.ts` to include your test in the `AVAILABLE_TESTS` array:

```typescript
// Add to AVAILABLE_TESTS array
{
  id: 'my-new-test',
  name: 'My New Test',
  description: 'Description of what this test does',
  enabled: false // Default state in the interactive menu
}
```

#### 4. Integrate with Test Orchestrator

Update `src/orchestrator/test-orchestrator.ts` to integrate your test:

1. **Import your test class:**
```typescript
import { MyNewTester } from '../lib/my-new-tester.js';
```

2. **Add property to the class:**
```typescript
private myNewTester: MyNewTester;
```

3. **Initialize in constructor:**
```typescript
this.myNewTester = new MyNewTester();
```

4. **Add execution logic in the appropriate phase method:**

For Phase 2 tests (most common), add to the test type handling in `executePhase2()`:

```typescript
} else if (testType === 'my-new-test') {
  allPageTasks.push({
    id: `${testType}-${url}`,
    name: `My New Test (${new URL(url).pathname})`,
    execute: async () => {
      const page = await this.browser!.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        return await this.myNewTester.runMyNewTest(page, url, this.dataManager!.sessionId);
      } finally {
        await page.close();
      }
    }
  });
}
```

### Phase Classification Guidelines

#### Phase 1: Data Discovery & Collection
- **Use for:** Site crawling, content extraction, data collection that other tests depend on
- **Scope:** Usually 'session' for site-wide operations, 'page' for per-page data collection
- **Examples:** `site-crawling`, `content-scraping`, `sitemap`
- **Concurrency:** Conservative (3 max) due to resource intensity

#### Phase 2: Page Analysis & Testing  
- **Use for:** Screenshot capture, SEO analysis, accessibility testing, performance testing
- **Scope:** Typically 'page' for per-page analysis
- **Examples:** `screenshots`, `seo`, `accessibility`
- **Concurrency:** Higher (5 max) for parallel page analysis

#### Phase 3: Report Generation & Finalization
- **Use for:** Summary generation, aggregated reports, final analysis
- **Scope:** Usually 'session' for site-wide summaries
- **Examples:** `site-summary`
- **Concurrency:** Lower (2 max) for resource-intensive report generation

### Technical Requirements

#### File Naming and Structure
- **Location:** `src/lib/`
- **Naming:** `*-tester.ts` (e.g., `performance-tester.ts`)
- **Class naming:** PascalCase ending in `Tester` (e.g., `PerformanceTester`)

#### Required Dependencies
- Import `Page` from `playwright` for browser automation
- Import `TestResult` from `../types/index.js` for return type compliance
- Import `SessionManager` from `../utils/session-manager.js` for file management
- Import `chalk` for consistent console output formatting

#### TestResult Interface Compliance
Your test method must return a `TestResult` object with:
- `testType: string` - Unique identifier for your test
- `status: 'pending' | 'success' | 'failed'` - Current test status
- `startTime: Date` - When the test began
- `endTime?: Date` - When the test completed (if finished)
- `outputPath?: string` - Path to generated report file
- `error?: string` - Error message if test failed

#### Session Management Integration
Use `SessionManager` methods for consistent file organization:
- `getPageName(url)` - Convert URL to safe directory name
- `createPageDirectory(sessionId, pageName)` - Ensure page directory exists
- `getScanPath(sessionId, pageName, testType)` - Get standardized file path

#### Error Handling Patterns
Always wrap test execution in try/catch blocks:
- Set `status: 'failed'` on error
- Capture error message in `error` field
- Always set `endTime` even on failure
- Log errors with `chalk.red()` for consistency

### Resource and Concurrency Considerations

#### Resource Intensive Tests
Mark tests as `resourceIntensive: true` if they:
- Generate large files (screenshots, comprehensive reports)
- Perform heavy DOM analysis
- Make many network requests
- Use significant CPU for processing

#### Conflict Management
Use `conflictsWith` array for tests that:
- Modify viewport settings (screenshots vs accessibility)
- Change page state in incompatible ways
- Compete for same resources

#### Dependencies
Use `dependencies` array when your test:
- Requires data from another test (e.g., needs crawling results)
- Must run after specific setup tests
- Depends on session-level configuration

### Testing and Validation

After implementing your new test:

1. **Build and test:**
```bash
npm run build
npm run dev
```

2. **Verify integration:**
- Your test appears in the walkthrough menu
- Test executes in the correct phase
- Results appear in HTML reports
- No TypeScript compilation errors

3. **Test error scenarios:**
- Verify graceful handling of page load failures
- Test behavior with invalid URLs
- Ensure proper cleanup on errors

### Common Implementation Patterns

#### Page Analysis Pattern
```typescript
async runAnalysis(page: Page, pageUrl: string, sessionId: string): Promise<TestResult> {
  // Standard setup
  const startTime = new Date();
  const pageName = this.sessionManager.getPageName(pageUrl);
  const testResult: TestResult = { testType: 'analysis', status: 'pending', startTime };

  try {
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
    // Extract data
    const data = await page.evaluate(() => {
      // Browser context data extraction
      return { /* extracted data */ };
    });
    
    // Process and save results
    const report = this.formatReport(data);
    const outputPath = await this.saveReport(sessionId, pageName, report);
    
    return { ...testResult, status: 'success', outputPath, endTime: new Date() };
  } catch (error) {
    return { ...testResult, status: 'failed', error: error.message, endTime: new Date() };
  }
}
```

#### Session-Level Pattern
```typescript
async generateSessionReport(sessionId: string, urls: string[]): Promise<TestResult> {
  const startTime = new Date();
  const testResult: TestResult = { testType: 'session-report', status: 'pending', startTime };

  try {
    // Aggregate data from all pages
    const aggregatedData = await this.aggregatePageData(sessionId, urls);
    
    // Generate session-level report
    const report = this.createSessionSummary(aggregatedData);
    const outputPath = this.sessionManager.getSessionFilePath(sessionId, 'session-summary.html');
    
    await this.saveSessionReport(outputPath, report);
    
    return { ...testResult, status: 'success', outputPath, endTime: new Date() };
  } catch (error) {
    return { ...testResult, status: 'failed', error: error.message, endTime: new Date() };
  }
}
```

This workflow ensures your new test integrates seamlessly with the existing architecture and maintains consistency with the project's patterns and standards.