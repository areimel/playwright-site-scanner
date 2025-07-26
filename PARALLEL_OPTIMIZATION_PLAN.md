# Parallel Test Execution Optimization Plan

## Current Problems Identified

### 1. Redundant Site Crawling
- **Issue**: Site crawling happens multiple times per session
- **Location**: `test-orchestrator.ts:114` (discoverPages), `sitemap-tester.ts:45`, `site-summary-tester.ts:71`
- **Impact**: 3x slower for site-wide tests, wasted resources

### 2. Session-Level Tests Running Per Page
- **Issue**: Sitemap and Site Summary tests run once per page instead of once per session
- **Location**: `test-orchestrator.ts:198, 209` in `executeTest()`
- **Impact**: Exponential inefficiency - if testing 10 pages, sitemap runs 10 times

### 3. Sequential Page Processing
- **Issue**: Pages are processed one at a time in a for loop
- **Location**: `test-orchestrator.ts:73-87`
- **Impact**: No parallelization, slow execution

### 4. Missing Data Sharing
- **Issue**: Content scraper extracts actual page data but site summary uses placeholder data
- **Location**: `site-summary-tester.ts:123` (hardcoded 0 values), `content-scraper.ts:109` (real extraction)
- **Impact**: Inaccurate reports, missed optimization opportunities

### 5. Poor Test Dependencies
- **Issue**: No coordination between tests that could share data
- **Examples**: SEO scan and content scraping both extract metadata; screenshots and accessibility both need page navigation

## Proposed Solution: Three-Phase Parallel Execution

### Phase 1: Data Discovery & Collection (Session-Level)
**Purpose**: Gather all foundational data needed by other tests
**Parallelization**: Tests in this phase can run in parallel with each other
**Tests**:
- Site crawling (single execution, shared results)
- Sitemap generation (depends on crawling)
- Content scraping for all pages (collect real content data)

### Phase 2: Page Analysis & Testing (Page-Level Parallel)
**Purpose**: Run analysis tests that depend on Phase 1 data
**Parallelization**: All pages can be tested in parallel, multiple tests per page in parallel
**Tests**:
- Screenshots (multiple viewports in parallel)
- SEO scans (can use scraped content data)
- Accessibility scans

### Phase 3: Report Generation & Finalization (Session-Level)
**Purpose**: Generate comprehensive reports using all collected data
**Parallelization**: Reports can be generated in parallel
**Tests**:
- Site summary (using real scraped content data)
- Session report compilation
- Statistics aggregation

## Implementation Strategy

### 1. Shared Data Store
Create a session-level data store to share results between tests:
```typescript
interface SessionDataStore {
  urls: string[];
  scrapedContent: Map<string, ScrapedContent>;
  sitemapEntries: SitemapEntry[];
  pageMetrics: Map<string, PageMetrics>;
}
```

### 2. Phase-Based Orchestrator
Refactor TestOrchestrator to execute in phases:
```typescript
async runTestsInPhases(config: TestConfig): Promise<void> {
  const dataStore = new SessionDataStore();
  
  // Phase 1: Data Collection
  await this.executePhase1(config, dataStore);
  
  // Phase 2: Page Analysis (Parallel)
  await this.executePhase2(config, dataStore);
  
  // Phase 3: Report Generation
  await this.executePhase3(config, dataStore);
}
```

### 3. Test Classification
Categorize tests by execution phase:
- **Session-Level Tests**: sitemap, site-summary
- **Page-Level Tests**: screenshots, seo, accessibility, content-scraping
- **Report Tests**: final aggregation and analysis

### 4. Parallel Execution Utilities
Implement parallel execution helpers:
```typescript
async executePageTestsInParallel(pages: string[], tests: TestType[]): Promise<PageResult[]>
async executeTestsInParallel(tests: TestFunction[]): Promise<TestResult[]>
```

## Expected Performance Improvements

### Current Performance (Sequential)
- **10 pages, 3 tests**: ~10 × 3 × avg_test_time + 10 × crawl_time
- **Site crawling**: Happens 3 times (once per site-level test)
- **Page processing**: Sequential, one at a time

### Optimized Performance (Parallel)
- **10 pages, 3 tests**: max(phase1_time, phase2_time, phase3_time)
- **Site crawling**: Happens once, shared across all tests
- **Page processing**: All pages processed simultaneously
- **Expected speedup**: 5-10x faster for multi-page sites

## Implementation Files to Modify

### Core Files
1. `src/orchestrator/test-orchestrator.ts` - Main refactor for phase-based execution
2. `src/types/index.ts` - Add SessionDataStore and phase-related types
3. `src/utils/session-data-store.ts` - New file for shared data management

### Test Files
4. `src/lib/site-summary-tester.ts` - Use real scraped content data
5. `src/lib/sitemap-tester.ts` - Accept pre-crawled URLs
6. `src/lib/content-scraper.ts` - Support batch processing
7. `src/utils/parallel-executor.ts` - New file for parallel execution utilities

### Configuration
8. `src/types/test-phases.ts` - New file defining test phase classifications
9. `src/commands/walkthrough.ts` - Update progress tracking for phases

## Backward Compatibility
- Maintain existing test interfaces
- Support both sequential and parallel modes
- Keep existing CLI commands working
- Preserve output formats and session structure

## Testing Strategy
- Unit tests for parallel execution utilities
- Integration tests for phase coordination
- Performance benchmarks comparing sequential vs parallel
- Error handling tests for failed parallel operations

## Migration Path
1. Implement parallel utilities without breaking existing code
2. Add phase-based orchestrator as alternative execution path
3. Test extensively with existing test suite
4. Switch default execution to parallel mode
5. Deprecate sequential mode after validation period