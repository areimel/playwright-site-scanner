# Implementation Plan: Text Search Scan

## Overview

Add a new scan option (`text-search`) that searches for a user-specified text string across all crawled pages and outputs a single site-wide JSON report. This gives developers a quick reference for where old text appears across a site.

## Architecture Decision

Follow the **api-key-scan dual pattern**: per-page scanning during Phase 2 unified page processing (reusing already-loaded pages, no extra page loads) + a session-level report generation step that writes the final JSON file.

- **Phase**: 2 (Page Analysis & Testing)
- **Scope**: `page` for per-page scanning + `session` for final report
- **Output**: Single site-wide JSON file at session root

## JSON Output Format

```json
{
  "searchText": "old brand name",
  "caseSensitive": false,
  "scanDate": "2025-08-23T21:48:00.000Z",
  "baseUrl": "https://example.com",
  "totalPagesScanned": 15,
  "pagesWithMatches": 3,
  "totalMatches": 7,
  "results": [
    {
      "url": "https://example.com/about",
      "matchCount": 3,
      "matches": [
        {
          "context": "...surrounding text with the old brand name in context...",
          "element": "p",
          "selector": "body > div.content > p:nth-child(3)"
        }
      ]
    },
    {
      "url": "https://example.com/products",
      "matchCount": 1,
      "matches": [
        {
          "context": "...still using the old brand name here...",
          "element": "h2",
          "selector": "body > main > section > h2"
        }
      ]
    }
  ]
}
```

## Files to Create

### 1. `src/lib/text-search-tester.ts`

New tester class following established patterns:

- **Class**: `TextSearchTester`
- **Constructor**: Initializes `SessionManager`, empty results accumulator
- **`runTextSearch(page, pageUrl, searchText, caseSensitive)`**: Per-page method called during unified page processing
  - Uses `page.evaluate()` to walk the DOM text nodes
  - Finds all occurrences of the search string in visible text content
  - For each match, captures: surrounding context (~80 chars), element tag, a CSS selector path
  - Accumulates results internally (like `ApiKeyTester.allFindings`)
  - Returns `TestResult` with status
- **`generateTextSearchReport(sessionId, urls, searchText, caseSensitive)`**: Session-level method
  - Assembles the final JSON from accumulated per-page results
  - Writes to `{sessionId}/text-search-report.json` using `sessionManager.buildFilePath(sessionId, '', 'reports', 'text-search-report.json')`
  - Returns `TestResult` with `outputPath`

## Files to Modify

### 2. `project-config.yaml`

Add the test definition under the `tests:` section:

```yaml
text-search:
  id: "text-search"
  name: "Text Search"
  description: "Search for specific text across all pages and generate a JSON report of matches"
  enabled: false
  phase: 2
  scope: "session"       # session because the final output is site-wide
  executionOrder: 5       # after api-key-scan (4)
  dependencies: []
  conflictsWith: []
  resourceIntensive: false
  outputType: "site-wide"
```

### 3. `src/types/index.ts`

Add an optional `searchText` field to `TestConfig`:

```typescript
export interface TestConfig {
  // ...existing fields...
  searchText?: string;              // Text string to search for (used by text-search scan)
  searchCaseSensitive?: boolean;    // Whether text search is case-sensitive (default: false)
}
```

### 4. `src/commands/walkthrough.ts`

After the test selection step (after `selectedTests` is populated), add a conditional prompt:

```typescript
// If text-search is selected, prompt for the search string
let searchText: string | undefined;
let searchCaseSensitive = false;

if (selectedTests.some(t => t.id === 'text-search')) {
  const { text } = await inquirer.prompt([{
    type: 'input',
    name: 'text',
    message: 'What text would you like to search for?',
    validate: (input) => input.trim().length > 0 ? true : 'Please enter a non-empty search string.'
  }]);
  searchText = text;

  const { caseSensitive } = await inquirer.prompt([{
    type: 'confirm',
    name: 'caseSensitive',
    message: 'Should the search be case-sensitive?',
    default: false
  }]);
  searchCaseSensitive = caseSensitive;
}
```

Pass `searchText` and `searchCaseSensitive` into the `TestConfig` object passed to `showConfirmation()`.

Also display the search text in the confirmation summary when present.

### 5. `src/orchestrator/test-orchestrator.ts`

- Import `TextSearchTester`
- Instantiate it in `initializeSession()` and pass to `TestRunner` constructor

```typescript
import { TextSearchTester } from '@lib/text-search-tester.js';

// In initializeSession():
this.testRunner = new TestRunner(
  // ...existing params...,
  new TextSearchTester(),
  // ...
);
```

### 6. `src/orchestrator/test-runner.ts`

- Import `TextSearchTester`
- Add as constructor parameter and instance property
- Add to `getParallelTestGroups()` nonConflicting list (text search only reads DOM, no modifications)
- Add case in `processPageCompletely()` switch for `'text-search'`:

```typescript
case 'text-search':
  this.uiStyler.displayTestProgress('🔍 Text search');
  return await this.textSearchTester.runTextSearch(
    page!, url, config.searchText!, config.searchCaseSensitive ?? false
  );
```

- Add case in `executePhase2()` session tests switch for generating the final report:

```typescript
case 'text-search':
  return await this.textSearchTester.generateTextSearchReport(
    this.dataManager.sessionId, urls,
    config.searchText!, config.searchCaseSensitive ?? false
  );
```

- Add to `getTestName()` map: `'text-search': 'Text Search'`

### 7. `src/orchestrator/test-config-manager.ts`

- Add `'text-search'` to the `getTestName()` static method mapping
- Add validation: if `text-search` is selected but `searchText` is empty/undefined, report a validation error

## Execution Flow

1. **Walkthrough**: User selects "Text Search" from test menu -> prompted for search string and case sensitivity
2. **Phase 1**: Site crawling discovers URLs (no text search involvement)
3. **Phase 2 - Unified Page Processing**: For each URL, `processPageCompletely()` loads the page once and runs text search alongside other non-conflicting tests (content-scraping, SEO, api-key-scan). The `TextSearchTester` accumulates per-page results in memory.
4. **Phase 2 - Session Tests**: `generateTextSearchReport()` is called, assembling all accumulated results into a single JSON file and writing it to the session directory.
5. **Result**: Single `text-search-report.json` file at `{session}/text-search-report.json`

## Key Design Notes

- **No extra page loads**: Text search piggybacks on unified page processing in Phase 2, reading the already-loaded page DOM
- **Case sensitivity option**: Defaults to case-insensitive for practical use
- **Context capture**: Each match includes ~80 characters of surrounding text so developers can identify the exact location without opening the page
- **JSON output**: Machine-readable format makes it easy to pipe into other tools or scripts
- **Matches only**: The JSON `results` array only includes pages where the text was found, keeping the output concise and scannable. The `totalPagesScanned` field still tells you how many pages were checked.
