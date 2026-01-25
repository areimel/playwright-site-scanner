import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { CrawlCheckpoint, CrawlStatistics, FailedUrl } from '@shared/index.js';
import { SessionManager } from '@utils/session-manager.js';

interface CheckpointOptions {
  checkpointInterval?: number;
  maxRetries?: number;
}

/**
 * Manages checkpoint files for deep crawl resilience.
 * Checkpoints are session-only and cleaned up on successful completion.
 */
export class CrawlCheckpointManager {
  private sessionManager: SessionManager;
  private checkpointPath: string | null = null;
  private checkpoint: CrawlCheckpoint | null = null;
  private pagesSinceLastSave: number = 0;
  private checkpointInterval: number;
  private maxRetries: number;
  private startTime: Date;

  constructor(options: CheckpointOptions = {}) {
    this.sessionManager = new SessionManager();
    this.checkpointInterval = options.checkpointInterval || 100;
    this.maxRetries = options.maxRetries || 3;
    this.startTime = new Date();
  }

  /**
   * Initialize checkpoint for a new crawl session
   */
  async createCheckpoint(
    sessionId: string,
    startUrl: string,
    crawlerType: 'playwright' | 'cheerio'
  ): Promise<void> {
    this.checkpointPath = this.getCheckpointPath(sessionId);

    const now = new Date().toISOString();

    this.checkpoint = {
      version: '1.0.0',
      sessionId,
      startUrl,
      crawlerType,
      createdAt: now,
      lastUpdatedAt: now,
      status: 'in-progress',
      statistics: {
        totalDiscovered: 0,
        totalCrawled: 0,
        totalFailed: 0,
        totalPending: 0,
        elapsedTimeMs: 0,
        averagePageTimeMs: 0,
        startTime: now
      },
      discoveredUrls: [],
      crawledUrls: [],
      pendingUrls: [],
      failedUrls: []
    };

    await this.saveCheckpoint();
    console.log(chalk.gray(`    💾 Checkpoint initialized at ${this.checkpointPath}`));
  }

  /**
   * Load an existing checkpoint from a session
   */
  async loadCheckpoint(sessionId: string): Promise<CrawlCheckpoint | null> {
    this.checkpointPath = this.getCheckpointPath(sessionId);

    try {
      const data = await fs.readFile(this.checkpointPath, 'utf-8');
      this.checkpoint = JSON.parse(data) as CrawlCheckpoint;

      // Restore start time from checkpoint
      this.startTime = new Date(this.checkpoint.statistics.startTime);

      console.log(chalk.gray(`    📂 Loaded checkpoint from ${this.checkpointPath}`));
      console.log(chalk.gray(`       Crawled: ${this.checkpoint.crawledUrls.length}, Pending: ${this.checkpoint.pendingUrls.length}`));

      return this.checkpoint;
    } catch (error) {
      // Checkpoint doesn't exist or is corrupted
      return null;
    }
  }

  /**
   * Check if a valid checkpoint exists that can be resumed
   */
  async canResume(sessionId: string): Promise<boolean> {
    const checkpointPath = this.getCheckpointPath(sessionId);

    try {
      const data = await fs.readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(data) as CrawlCheckpoint;

      // Can resume if status is 'in-progress' or 'failed' (not completed)
      return checkpoint.status !== 'completed' && checkpoint.pendingUrls.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get URLs that still need to be crawled
   */
  getResumeUrls(): string[] {
    if (!this.checkpoint) return [];
    return [...this.checkpoint.pendingUrls];
  }

  /**
   * Get all discovered URLs
   */
  getDiscoveredUrls(): string[] {
    if (!this.checkpoint) return [];
    return [...this.checkpoint.discoveredUrls];
  }

  /**
   * Add newly discovered URLs to the checkpoint
   */
  async addDiscoveredUrls(urls: string[]): Promise<void> {
    if (!this.checkpoint) return;

    const newUrls = urls.filter(url =>
      !this.checkpoint!.discoveredUrls.includes(url) &&
      !this.checkpoint!.crawledUrls.includes(url)
    );

    this.checkpoint.discoveredUrls.push(...newUrls);
    this.checkpoint.pendingUrls.push(...newUrls);
    this.checkpoint.statistics.totalDiscovered += newUrls.length;
    this.checkpoint.statistics.totalPending += newUrls.length;

    if (this.shouldSaveCheckpoint()) {
      await this.saveCheckpoint();
    }
  }

  /**
   * Mark a URL as successfully crawled
   */
  async markUrlCrawled(url: string): Promise<void> {
    if (!this.checkpoint) return;

    // Remove from pending
    const pendingIndex = this.checkpoint.pendingUrls.indexOf(url);
    if (pendingIndex > -1) {
      this.checkpoint.pendingUrls.splice(pendingIndex, 1);
      this.checkpoint.statistics.totalPending--;
    }

    // Add to crawled if not already there
    if (!this.checkpoint.crawledUrls.includes(url)) {
      this.checkpoint.crawledUrls.push(url);
      this.checkpoint.statistics.totalCrawled++;
    }

    this.pagesSinceLastSave++;
    this.updateStatistics();

    if (this.shouldSaveCheckpoint()) {
      await this.saveCheckpoint();
      this.pagesSinceLastSave = 0;
    }
  }

  /**
   * Mark a URL as failed
   */
  async markUrlFailed(url: string, error: string): Promise<void> {
    if (!this.checkpoint) return;

    // Find existing failed entry or create new one
    let failedEntry = this.checkpoint.failedUrls.find(f => f.url === url);

    if (failedEntry) {
      failedEntry.attempts++;
      failedEntry.error = error;
      failedEntry.lastAttemptAt = new Date().toISOString();

      // If max retries reached, remove from pending
      if (failedEntry.attempts >= this.maxRetries) {
        const pendingIndex = this.checkpoint.pendingUrls.indexOf(url);
        if (pendingIndex > -1) {
          this.checkpoint.pendingUrls.splice(pendingIndex, 1);
          this.checkpoint.statistics.totalPending--;
          this.checkpoint.statistics.totalFailed++;
        }
      }
    } else {
      // First failure - add to failed list
      const newFailedEntry: FailedUrl = {
        url,
        error,
        attempts: 1,
        lastAttemptAt: new Date().toISOString()
      };
      this.checkpoint.failedUrls.push(newFailedEntry);
    }

    this.pagesSinceLastSave++;

    if (this.shouldSaveCheckpoint()) {
      await this.saveCheckpoint();
      this.pagesSinceLastSave = 0;
    }
  }

  /**
   * Check if a URL should be retried
   */
  shouldRetryUrl(url: string): boolean {
    if (!this.checkpoint) return true;

    const failedEntry = this.checkpoint.failedUrls.find(f => f.url === url);
    if (!failedEntry) return true;

    return failedEntry.attempts < this.maxRetries;
  }

  /**
   * Check if it's time to save the checkpoint
   */
  shouldSaveCheckpoint(): boolean {
    return this.pagesSinceLastSave >= this.checkpointInterval;
  }

  /**
   * Force save the checkpoint
   */
  async saveCheckpoint(): Promise<void> {
    if (!this.checkpoint || !this.checkpointPath) return;

    this.checkpoint.lastUpdatedAt = new Date().toISOString();
    this.updateStatistics();

    // Ensure directory exists
    const dir = path.dirname(this.checkpointPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      this.checkpointPath,
      JSON.stringify(this.checkpoint, null, 2),
      'utf-8'
    );
  }

  /**
   * Finalize checkpoint - mark as completed or failed
   */
  async finalizeCheckpoint(status: 'completed' | 'failed'): Promise<void> {
    if (!this.checkpoint) return;

    this.checkpoint.status = status;
    this.updateStatistics();
    await this.saveCheckpoint();

    console.log(chalk.gray(`    💾 Checkpoint finalized with status: ${status}`));

    // Clean up checkpoint file on successful completion (session-only)
    if (status === 'completed' && this.checkpointPath) {
      try {
        await fs.unlink(this.checkpointPath);
        console.log(chalk.gray(`    🧹 Checkpoint cleaned up (session completed)`));
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get current statistics
   */
  getStatistics(): CrawlStatistics | null {
    if (!this.checkpoint) return null;
    return { ...this.checkpoint.statistics };
  }

  /**
   * Get checkpoint file path for a session
   */
  private getCheckpointPath(sessionId: string): string {
    const sessionDir = this.sessionManager.getSessionDirectoryPath(sessionId);
    return path.join(sessionDir, 'crawl-checkpoint.json');
  }

  /**
   * Update statistics based on current state
   */
  private updateStatistics(): void {
    if (!this.checkpoint) return;

    const elapsed = Date.now() - this.startTime.getTime();
    this.checkpoint.statistics.elapsedTimeMs = elapsed;

    const crawled = this.checkpoint.statistics.totalCrawled;
    if (crawled > 0) {
      this.checkpoint.statistics.averagePageTimeMs = Math.round(elapsed / crawled);
    }
  }
}
