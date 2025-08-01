# New Test Setup Guide

This document provides a step-by-step guide for adding new test types to the playwright-site-scanner project. Follow these patterns to maintain consistency with the existing architecture.

## Overview

The project uses an **orchestrator pattern** where the `TestOrchestrator` coordinates different test implementations. Each test type is implemented as a separate class in the `src/lib/` directory and integrated through several key files.

## Step-by-Step Implementation Process

### 1. Create the Test Class

**Location**: `src/lib/[test-name]-tester.ts`

**Template Pattern**:
```typescript
import { Page } from 'playwright';
import chalk from 'chalk';
import { TestResult } from '../types/index.js';
import { SessionManager } from '../utils/session-manager.js';

export class [TestName]Tester {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async run[TestName]Test(
    page: Page, 
    pageUrl: string, 
    sessionId: string
  ): Promise<TestResult> {
    const startTime = new Date();
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    const testResult: TestResult = {
      testType: '[test-type-id]',
      status: 'pending',
      startTime
    };

    try {
      console.log(chalk.gray(`    🔧 Running [test name]...`));

      // Your test implementation here
      const testData = await this.extractTestData(page);
      const outputPath = await this.generateOutput(testData, sessionId, pageName);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();
      
      console.log(chalk.green(`    ✅ [Test name] completed`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ [Test name] failed: ${testResult.error}`));
    }

    return testResult;
  }

  private async extractTestData(page: Page): Promise<any> {
    // Implement data extraction logic
  }

  private async generateOutput(data: any, sessionId: string, pageName: string): Promise<string> {
    // Implement output generation logic
    // Return the path to the generated file
  }
}
```

### 2. Update TypeScript Types

**File**: `src/types/index.ts`

Add any new interfaces or extend existing ones if needed:

```typescript
// Add new test-specific interfaces at the top
export interface [TestName]Data {
  // Define your test data structure
}

// No changes needed to existing TestResult interface - it's generic enough
```

### 3. Update the Walkthrough

**File**: `src/commands/walkthrough.ts`

Add your new test to the `AVAILABLE_TESTS` array:

```typescript
const AVAILABLE_TESTS: TestType[] = [
  // ... existing tests
  {
    id: '[test-type-id]',
    name: '[Display Name]',
    description: '[Brief description for CLI]',
    enabled: false
  }
];
```

### 4. Update the Test Orchestrator

**File**: `src/orchestrator/test-orchestrator.ts`

#### 4a. Import the new tester class
```typescript
import { [TestName]Tester } from '../lib/[test-name]-tester.js';
```

#### 4b. Add tester instance to constructor
```typescript
constructor() {
  // ... existing tester instances
  this.[testName]Tester = new [TestName]Tester();
}
```

#### 4c. Add property declaration
```typescript
export class TestOrchestrator {
  // ... existing properties
  private [testName]Tester: [TestName]Tester;
```

#### 4d. Add case to executeTest method
```typescript
private async executeTest(
  testType: string, 
  page: Page, 
  pageUrl: string, 
  config: TestConfig, 
  sessionId: string
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  switch (testType) {
    // ... existing cases
    
    case '[test-type-id]':
      const [testName]Result = await this.[testName]Tester.run[TestName]Test(page, pageUrl, sessionId);
      results.push([testName]Result);
      break;

    default:
      console.warn(chalk.yellow(`⚠️  Unknown test type: ${testType}`));
  }

  return results;
}
```

### 5. Update Session Manager (If Needed)

**File**: `src/utils/session-manager.ts`

Add new path helper methods if your test generates files in custom locations:

```typescript
get[TestName]Path(sessionId: string, pageName: string, filename: string): string {
  return path.join(this.outputDir, sessionId, pageName, 'custom-folder', filename);
}

// Or for session-level files (like sitemaps):
get[TestName]SessionPath(sessionId: string, filename: string): string {
  return path.join(this.outputDir, sessionId, filename);
}
```

If you need custom directories, update the `createPageDirectory` method:
```typescript
async createPageDirectory(sessionId: string, pageName: string): Promise<string> {
  // ... existing code
  
  // Add your custom subdirectory
  await fs.mkdir(path.join(pagePath, 'custom-folder'), { recursive: true });
  
  return pagePath;
}
```

## Test Implementation Patterns

### Console Logging Standards
- **Starting**: `console.log(chalk.gray('    🔧 Running [test name]...'))`
- **Success**: `console.log(chalk.green('    ✅ [Test name] completed'))`
- **Error**: `console.log(chalk.red('    ❌ [Test name] failed: ${error}'))`
- **Sub-steps**: `console.log(chalk.gray('      📄 [Sub-step description]'))`

### Error Handling Pattern
```typescript
try {
  // Test implementation
  testResult.status = 'success';
  testResult.endTime = new Date();
} catch (error) {
  testResult.status = 'failed';
  testResult.error = error instanceof Error ? error.message : String(error);
  testResult.endTime = new Date();
}
```

### File Output Patterns

#### Per-Page Files
Use for tests that generate individual results for each page:
```typescript
const outputPath = this.sessionManager.getScanPath(sessionId, pageName, '[test-type]');
await fs.writeFile(outputPath, content, 'utf8');
```

#### Session-Level Files  
Use for tests that generate site-wide results:
```typescript
const outputPath = path.join(this.sessionManager.getSessionPath(sessionId), '[filename]');
await fs.writeFile(outputPath, content, 'utf8');
```

## Test Categories

### Page-Level Tests
Tests that run on each individual page (like screenshots, SEO, accessibility):
- Generate per-page results
- Store output in page subdirectories
- Return single TestResult per execution

### Site-Level Tests
Tests that analyze the entire site (like sitemap generation):
- Run once per session, not per page
- Store output at session root level
- May need special handling in orchestrator

### Content Extraction Tests
Tests that extract and transform page content:
- May download external resources (images, etc.)
- Generate formatted output (markdown, JSON, etc.)
- Handle resource cleanup and organization

## Testing Your Implementation

### 1. Build and Test
```bash
npm run build
npm start
```

### 2. Verification Checklist
- [ ] New test appears in interactive walkthrough
- [ ] Test can be selected and runs without errors
- [ ] Generated files appear in correct session directory structure
- [ ] Console output follows established patterns
- [ ] Error handling works correctly (test with invalid URLs)
- [ ] TypeScript compilation succeeds without warnings

### 3. Integration Testing
- [ ] Test works with both single page and site crawling modes
- [ ] Test integrates properly with session summary generation
- [ ] Test results appear correctly in session reports
- [ ] Performance is acceptable for typical website sizes

## Common Pitfalls to Avoid

1. **File Path Issues**: Always use `path.join()` for cross-platform compatibility
2. **Async/Await**: Don't forget to await Promise-based operations
3. **Error Propagation**: Always catch and handle errors within test methods
4. **Resource Cleanup**: Close any opened resources (files, network connections)
5. **Type Safety**: Ensure all TypeScript interfaces are properly defined
6. **Console Output**: Follow the established color and symbol patterns
7. **File Naming**: Use consistent naming patterns for output files

## Example Implementation Reference

See existing test implementations:
- `src/lib/screenshot-tester.ts` - Per-page file generation
- `src/lib/seo-tester.ts` - Content extraction and analysis
- `src/lib/accessibility-tester.ts` - External library integration

For site-level tests, the new implementations (sitemap, site-summary) provide additional patterns to follow.