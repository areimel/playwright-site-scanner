import { ProgressState } from '../types/index.js';
export interface PhaseProgress {
    currentPhase: number;
    totalPhases: number;
    phaseName: string;
    phaseProgress: number;
}
export declare class ProgressTracker {
    private state;
    private phaseState;
    initialize(initialState: ProgressState): void;
    updateCurrentTest(testName: string): void;
    updateCurrentPage(pageUrl: string, pageIndex: number): void;
    updateCompletedPages(count: number): void;
    incrementCompletedTests(count?: number): void;
    startPhase(phase: number, phaseName: string): void;
    updatePhaseProgress(progress: number): void;
    completePhase(): void;
    private displayPhaseProgress;
    private displayProgress;
    private createProgressBar;
    displayQueueStatus(queue: string[], running: string[], completed: string[]): void;
}
//# sourceMappingURL=progress-tracker.d.ts.map