# Deep Site Crawl Feature - Development Plan

> **Instructions for Claude Code**: As you complete each step, mark the checkbox with an `[x]`. This helps preserve context across chat sessions and shows the current status of our update.

## Overview

This plan adds a "Deep Site Crawl" mode to the Playwright Site Scanner that:
- Removes all limits on pages and crawl depth
- Is restricted to sitemap generation only (too heavy for screenshots/SEO/accessibility)
- Includes checkpoint/resume functionality for long-running crawls
- Offers a lightweight HTTP-only crawler option for better speed

---

## Phase 1: Type System & Configuration

### 1.1 Update Type Definitions
- [x] **Add 'deep' to CrawlMode type** in `src/types/index.ts`
  ```typescript
  export type CrawlMode = 'single' | 'smart' | 'full' | 'deep';
  ```

- [x] **Add DeepCrawlConfig interface** in `src/types/index.ts`
  ```typescript
  export interface DeepCrawlConfig {
    enabled: boolean;
    crawlerType: 'playwright' | 'cheerio';
    checkpointInterval: number;
    resumeFromCheckpoint: boolean;
  }
  ```

- [x] **Add CrawlCheckpoint interface** in `src/types/index.ts`
  ```typescript
  export interface CrawlCheckpoint {
    version: string;
    sessionId: string;
    startUrl: string;
    crawlerType: 'playwright' | 'cheerio';
    createdAt: string;
    lastUpdatedAt: string;
    status: 'in-progress' | 'completed' | 'failed';
    statistics: CrawlStatistics;
    discoveredUrls: string[];
    crawledUrls: string[];
    pendingUrls: string[];
    failedUrls: FailedUrl[];
  }

  export interface CrawlStatistics {
    totalDiscovered: number;
    totalCrawled: number;
    totalFailed: number;
    totalPending: number;
    elapsedTimeMs: number;
    averagePageTimeMs: number;
  }

  export interface FailedUrl {
    url: string;
    error: string;
    attempts: number;
    lastAttemptAt: string;
  }
  ```

- [x] **Update TestConfig interface** to include optional deepCrawlConfig
  ```typescript
  export interface TestConfig {
    // ... existing fields
    deepCrawlConfig?: DeepCrawlConfig;
  }
  ```

### 1.2 Update Configuration
- [x] **Add deep crawl defaults** to `project-config.yaml` under `execution.crawling`
  ```yaml
  deepCrawl:
    checkpointInterval: 100
    maxRetries: 3
    retryDelayMs: 5000
    requestTimeoutMs: 30000
    cheerioConcurrency: 10
    playwrightConcurrency: 3
  ```

---

## Phase 2: Checkpoint System

### 2.1 Create Checkpoint Manager
- [x] **Create new file** `src/lib/crawl-checkpoint-manager.ts`

- [x] **Implement CrawlCheckpointManager class** with these methods:
  - `constructor(sessionId, options?)` - Initialize with session ID and optional config
  - `async createCheckpoint(startUrl, crawlerType)` - Create new checkpoint file
  - `async loadCheckpoint()` - Load existing checkpoint from file
  - `async saveCheckpoint()` - Save current state to file
  - `async markUrlCrawled(url)` - Mark URL as successfully crawled
  - `async markUrlFailed(url, error)` - Mark URL as failed with error
  - `async addDiscoveredUrls(urls)` - Add newly discovered URLs
  - `getPendingUrls()` - Get URLs that still need processing
  - `shouldSaveCheckpoint()` - Check if it's time to save (based on interval)
  - `async canResume()` - Check if valid checkpoint exists
  - `async finalizeCheckpoint(status)` - Mark checkpoint as completed or failed

- [x] **Add graceful shutdown handler** for SIGINT to save checkpoint on interrupt

### 2.2 Checkpoint File Location
- [x] **Store checkpoint** at `arda-site-scan-sessions/{sessionId}/crawl-checkpoint.json`

---

## Phase 3: Lightweight Cheerio Crawler

### 3.1 Create Cheerio Crawler
- [x] **Create new file** `src/lib/cheerio-site-crawler.ts`

- [x] **Implement CheerioSiteCrawler class** using Crawlee's CheerioCrawler:
  - Import `CheerioCrawler` from 'crawlee' (already a dependency)
  - Same URL filtering logic as existing PlaywrightCrawler
  - Integrate with CrawlCheckpointManager
  - Support unlimited pages when no maxPages specified
  - Support resume from checkpoint

- [x] **Key method signature**:
  ```typescript
  async crawlSite(
    startUrl: string,
    options?: {
      maxPages?: number;  // undefined = unlimited
      checkpointManager?: CrawlCheckpointManager;
      resumeFromCheckpoint?: boolean;
    }
  ): Promise<string[]>
  ```

---

## Phase 4: Update Existing Crawler

### 4.1 Modify CrawleeSiteCrawler
- [x] **Update `src/lib/crawlee-site-crawler.ts`** to support deep mode:
  - Add optional `checkpointManager` parameter
  - When mode is 'deep', don't set `maxRequestsPerCrawl` limit
  - Integrate checkpoint saves during crawl
  - Support resume from checkpoint

- [x] **Update method signature**:
  ```typescript
  async crawlSite(
    startUrl: string,
    maxPages: number = 50,
    mode: 'smart' | 'full' | 'deep' = 'full',
    options?: {
      checkpointManager?: CrawlCheckpointManager;
      resumeFromCheckpoint?: boolean;
    }
  ): Promise<string[]>
  ```

- [x] **Modify clearDataset()** to NOT clear in deep mode (preserve for resume)

---

## Phase 5: Test Restriction System

### 5.1 Update Test Config Manager
- [x] **Add `filterTestsForDeepCrawl()` method** to `src/orchestrator/test-config-manager.ts`:
  ```typescript
  static async filterTestsForDeepCrawl(config: TestConfig): Promise<{
    filteredConfig: TestConfig;
    disabledTests: string[];
  }> {
    const allowedDeepCrawlTests = ['sitemap'];
    // Filter out all tests except sitemap
    // Return list of disabled tests for user notification
  }
  ```

- [x] **Add `getDeepCrawlAllowedTests()` method** returning `['sitemap']`

---

## Phase 6: Walkthrough UI Updates

### 6.1 Add Deep Crawl Option
- [x] **Update crawl mode choices** in `src/commands/walkthrough.ts` (around line 49):
  ```typescript
  {
    name: chalk.yellow('Deep site crawl - No page limit, sitemap-only (for large sites)'),
    value: 'deep',
    short: 'Deep crawl'
  }
  ```

- [x] **Update crawlMessages** to include deep mode message

### 6.2 Add Deep Crawl Prompts
- [x] **Add crawler type selection** (only shown when deep mode selected):
  ```typescript
  if (crawlMode === 'deep') {
    const { crawlerType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'crawlerType',
        message: 'Which crawler would you like to use?',
        choices: [
          { name: 'Lightweight (HTTP-only) - Faster, works for most sites', value: 'cheerio' },
          { name: 'Full browser - Slower, required for JavaScript-heavy sites', value: 'playwright' }
        ],
        default: 'cheerio'
      }
    ]);
  }
  ```

- [x] **Add resume from checkpoint prompt** (only for deep mode)

- [x] **Display deep crawl warning** about test restrictions

### 6.3 Update Confirmation Display
- [x] **Add deep crawl info** to `showConfirmation()` function
- [x] **Show which tests are disabled** in deep mode

---

## Phase 7: Orchestrator Updates

### 7.1 Update Test Orchestrator
- [x] **Update `src/orchestrator/test-orchestrator.ts`** to filter tests for deep crawl mode (handled via TestConfigManager)

### 7.2 Update Test Runner
- [x] **Update `src/orchestrator/test-runner.ts`** `executePhase1()` method:
  - Check for deep crawl mode
  - Create CrawlCheckpointManager
  - Select appropriate crawler (Cheerio or Playwright)
  - Handle checkpoint resume

- [x] **Add `executeDeepCrawl()` private method**:
  ```typescript
  private async executeDeepCrawl(config: TestConfig): Promise<string[]> {
    // Create checkpoint manager
    // Check for resume capability
    // Select crawler based on config
    // Execute crawl with checkpointing
    // Return discovered URLs
  }
  ```

---

## Phase 8: Testing & Validation

### 8.1 Build Verification
- [x] **Run build** with `pnpm run build` - ensure no TypeScript errors

### 8.2 Functional Testing
- [ ] **Test single page mode** - verify unchanged behavior
- [ ] **Test smart crawl mode** - verify unchanged behavior
- [ ] **Test full crawl mode** - verify unchanged behavior
- [ ] **Test deep crawl with Cheerio** on a small site
- [ ] **Test deep crawl with Playwright** on a small site
- [ ] **Test interrupt (Ctrl+C) and verify checkpoint saved**
- [ ] **Test resume from checkpoint** after interrupt
- [ ] **Test that only sitemap is available** in deep mode

### 8.3 Edge Cases
- [ ] **Test with JavaScript-heavy site** using Playwright crawler
- [ ] **Test memory usage** with larger crawl (500+ pages)
- [ ] **Test checkpoint file format** is valid JSON

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/crawl-checkpoint-manager.ts` | Checkpoint save/load/resume system |
| `src/lib/cheerio-site-crawler.ts` | Lightweight HTTP-only crawler |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add 'deep' to CrawlMode, add new interfaces |
| `project-config.yaml` | Add deep crawl defaults |
| `src/lib/crawlee-site-crawler.ts` | Add deep mode support, checkpoint integration |
| `src/commands/walkthrough.ts` | Add deep crawl UI option and prompts |
| `src/orchestrator/test-config-manager.ts` | Add filterTestsForDeepCrawl() |
| `src/orchestrator/test-runner.ts` | Handle deep crawl execution |

---

## Notes

- **Crawlee CheerioCrawler** is already available (crawlee is a dependency at ^3.13.10)
- **Checkpoint interval default**: Save every 100 pages
- **Checkpoint persistence**: Session-only (cleaned up on successful completion, useful for crash recovery)
- **Deep mode restriction**: Only sitemap generation allowed (screenshots, SEO, accessibility disabled)
- **Resume behavior**: Automatically detect and offer to resume if checkpoint exists from interrupted session
- **Lightweight crawler**: CheerioCrawler from Crawlee (HTTP-only, no browser)
