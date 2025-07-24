import { ProgressState } from '../types/index.js';
export declare class ProgressTracker {
    private state;
    initialize(initialState: ProgressState): void;
    updateCurrentTest(testName: string): void;
    updateCurrentPage(pageUrl: string, pageIndex: number): void;
    updateCompletedPages(count: number): void;
    incrementCompletedTests(count?: number): void;
    private displayProgress;
    private createProgressBar;
    displayQueueStatus(queue: string[], running: string[], completed: string[]): void;
}
//# sourceMappingURL=progress-tracker.d.ts.map