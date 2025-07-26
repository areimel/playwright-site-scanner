import { Browser, Page } from 'playwright';
import { TestResult, PageResult, TestConfig } from '../types/index.js';
export interface ParallelTask<T> {
    id: string;
    name: string;
    execute: () => Promise<T>;
}
export interface PageTestTask {
    url: string;
    testType: string;
    testName: string;
    execute: (page: Page) => Promise<TestResult>;
}
export interface BatchResult<T> {
    successful: {
        id: string;
        result: T;
    }[];
    failed: {
        id: string;
        error: string;
    }[];
    duration: number;
}
export declare class ParallelExecutor {
    private browser;
    private maxConcurrency;
    constructor(browser: Browser, maxConcurrency?: number);
    /**
     * Execute multiple tasks in parallel with concurrency control
     */
    executeTasks<T>(tasks: ParallelTask<T>[], options?: {
        maxConcurrency?: number;
        description?: string;
        onProgress?: (completed: number, total: number) => void;
    }): Promise<BatchResult<T>>;
    /**
     * Execute page-level tests in parallel across multiple pages
     */
    executePageTests(urls: string[], pageTestTasks: PageTestTask[], options?: {
        maxConcurrency?: number;
        onPageProgress?: (completedPages: number, totalPages: number) => void;
        onTestProgress?: (completedTests: number, totalTests: number) => void;
    }): Promise<Map<string, PageResult>>;
    /**
     * Execute screenshot tests across multiple viewports in parallel
     */
    executeScreenshotTests(page: Page, url: string, viewports: Array<{
        name: string;
        width: number;
        height: number;
    }>, sessionId: string, screenshotTester: any): Promise<TestResult[]>;
    /**
     * Create page test tasks for a specific URL and test configuration
     */
    createPageTestTasks(url: string, config: TestConfig, sessionId: string, testers: {
        screenshotTester?: any;
        seoTester?: any;
        accessibilityTester?: any;
        contentScraper?: any;
    }): PageTestTask[];
    /**
     * Utility methods
     */
    private getPageName;
    private generatePageSummary;
    /**
     * Batch processing utility for large datasets
     */
    processBatches<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, batchSize?: number, onBatchComplete?: (batchIndex: number, totalBatches: number) => void): Promise<R[]>;
}
//# sourceMappingURL=parallel-executor.d.ts.map