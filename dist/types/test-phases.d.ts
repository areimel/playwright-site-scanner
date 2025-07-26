import { TestConfig } from './index.js';
export type TestPhase = 1 | 2 | 3;
export type TestScope = 'session' | 'page';
export interface PhaseDefinition {
    phase: TestPhase;
    name: string;
    description: string;
    scope: TestScope;
    dependencies: TestPhase[];
    parallelizable: boolean;
}
export interface TestClassification {
    testId: string;
    phase: TestPhase;
    scope: TestScope;
    executionOrder: number;
    dependencies: string[];
    conflictsWith: string[];
    resourceIntensive: boolean;
}
export declare const TEST_CLASSIFICATIONS: Record<string, TestClassification>;
export declare const PHASE_DEFINITIONS: Record<TestPhase, PhaseDefinition>;
export interface PhaseExecutionPlan {
    phase: TestPhase;
    sessionTests: string[];
    pageTests: string[];
    maxConcurrency: number;
    estimatedDuration?: number;
}
export interface ExecutionStrategy {
    phases: PhaseExecutionPlan[];
    totalEstimatedDuration: number;
    parallelPages: boolean;
    maxConcurrentPages: number;
}
export declare class TestPhaseManager {
    /**
     * Organize selected tests into execution phases
     */
    static organizeTestsIntoPhases(config: TestConfig): ExecutionStrategy;
    /**
     * Check if tests can run in parallel (no conflicts)
     */
    static canRunInParallel(testId1: string, testId2: string): boolean;
    /**
     * Get execution order for tests within a phase
     */
    static getExecutionOrder(testIds: string[]): string[];
    /**
     * Check if all dependencies are satisfied
     */
    static validateDependencies(testIds: string[]): {
        valid: boolean;
        missingDependencies: string[];
    };
    /**
     * Get resource requirements for a phase
     */
    static getPhaseResourceRequirements(phase: TestPhase, testIds: string[]): {
        memoryIntensive: number;
        cpuIntensive: number;
        networkIntensive: number;
        recommendedConcurrency: number;
    };
    /**
     * Estimate duration for execution strategy
     */
    private static estimateTotalDuration;
    /**
     * Get phase summary for display
     */
    static getPhaseSummary(phase: TestPhase, testIds: string[]): {
        name: string;
        description: string;
        testCount: number;
        sessionTests: string[];
        pageTests: string[];
        estimatedDuration: number;
    };
}
//# sourceMappingURL=test-phases.d.ts.map