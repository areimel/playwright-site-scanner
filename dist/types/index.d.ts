export interface TestConfig {
    url: string;
    crawlSite: boolean;
    selectedTests: TestType[];
    viewports: ViewportConfig[];
}
export interface TestType {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}
export interface ViewportConfig {
    name: string;
    width: number;
    height: number;
}
export interface SessionSummary {
    sessionId: string;
    url: string;
    startTime: Date;
    endTime?: Date;
    totalPages: number;
    testsRun: number;
    testsSucceeded: number;
    testsFailed: number;
    errors: string[];
}
export interface PageResult {
    url: string;
    pageName: string;
    tests: TestResult[];
    summary: string;
}
export interface TestResult {
    testType: string;
    status: 'success' | 'failed' | 'pending';
    startTime: Date;
    endTime?: Date;
    outputPath?: string;
    error?: string;
}
export interface ProgressState {
    currentTest: string;
    completedTests: number;
    totalTests: number;
    currentPage: string;
    completedPages: number;
    totalPages: number;
}
//# sourceMappingURL=index.d.ts.map