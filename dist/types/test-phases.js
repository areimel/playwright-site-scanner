"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestPhaseManager = exports.PHASE_DEFINITIONS = exports.TEST_CLASSIFICATIONS = void 0;
// Test classifications for all available tests
exports.TEST_CLASSIFICATIONS = {
    // Phase 1: Data Discovery & Collection
    'site-crawling': {
        testId: 'site-crawling',
        phase: 1,
        scope: 'session',
        executionOrder: 1,
        dependencies: [],
        conflictsWith: [],
        resourceIntensive: true
    },
    'sitemap': {
        testId: 'sitemap',
        phase: 1,
        scope: 'session',
        executionOrder: 2,
        dependencies: ['site-crawling'],
        conflictsWith: [],
        resourceIntensive: false
    },
    'content-scraping': {
        testId: 'content-scraping',
        phase: 1,
        scope: 'page',
        executionOrder: 3,
        dependencies: ['site-crawling'],
        conflictsWith: [],
        resourceIntensive: true
    },
    // Phase 2: Page Analysis & Testing
    'screenshots': {
        testId: 'screenshots',
        phase: 2,
        scope: 'page',
        executionOrder: 1,
        dependencies: [],
        conflictsWith: ['accessibility'], // Both modify viewport
        resourceIntensive: true
    },
    'seo': {
        testId: 'seo',
        phase: 2,
        scope: 'page',
        executionOrder: 2,
        dependencies: [],
        conflictsWith: [],
        resourceIntensive: false
    },
    'accessibility': {
        testId: 'accessibility',
        phase: 2,
        scope: 'page',
        executionOrder: 3,
        dependencies: [],
        conflictsWith: ['screenshots'], // Both modify viewport
        resourceIntensive: true
    },
    'api-key-scan': {
        testId: 'api-key-scan',
        phase: 2,
        scope: 'page',
        executionOrder: 4,
        dependencies: [],
        conflictsWith: [],
        resourceIntensive: false
    },
    // Phase 3: Report Generation & Finalization
    'site-summary': {
        testId: 'site-summary',
        phase: 3,
        scope: 'session',
        executionOrder: 1,
        dependencies: ['content-scraping'],
        conflictsWith: [],
        resourceIntensive: false
    }
};
// Phase definitions
exports.PHASE_DEFINITIONS = {
    1: {
        phase: 1,
        name: 'Data Discovery',
        description: 'Site crawling, content extraction, and initial data collection',
        scope: 'session',
        dependencies: [],
        parallelizable: true
    },
    2: {
        phase: 2,
        name: 'Page Analysis',
        description: 'Screenshots, SEO scans, accessibility testing across all pages',
        scope: 'page',
        dependencies: [1],
        parallelizable: true
    },
    3: {
        phase: 3,
        name: 'Report Generation',
        description: 'Site summaries, aggregated reports, and final analysis',
        scope: 'session',
        dependencies: [1, 2],
        parallelizable: true
    }
};
class TestPhaseManager {
    /**
     * Organize selected tests into execution phases
     */
    static organizeTestsIntoPhases(config) {
        const selectedTestIds = config.selectedTests
            .filter(test => test.enabled)
            .map(test => test.id);
        const phases = [];
        // Phase 1: Data Collection
        const phase1Tests = selectedTestIds.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.phase === 1);
        if (phase1Tests.length > 0 || config.crawlSite) {
            // Always include site crawling if we're crawling the site
            const sessionTests = config.crawlSite ? ['site-crawling'] : [];
            const pageTests = [];
            phase1Tests.forEach(testId => {
                const classification = exports.TEST_CLASSIFICATIONS[testId];
                if (classification.scope === 'session') {
                    sessionTests.push(testId);
                }
                else {
                    pageTests.push(testId);
                }
            });
            phases.push({
                phase: 1,
                sessionTests: [...new Set(sessionTests)], // Remove duplicates
                pageTests,
                maxConcurrency: 3 // Conservative for data collection
            });
        }
        // Phase 2: Page Analysis
        const phase2Tests = selectedTestIds.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.phase === 2);
        if (phase2Tests.length > 0) {
            phases.push({
                phase: 2,
                sessionTests: [],
                pageTests: phase2Tests,
                maxConcurrency: 5 // Higher concurrency for analysis
            });
        }
        // Phase 3: Report Generation
        const phase3Tests = selectedTestIds.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.phase === 3);
        if (phase3Tests.length > 0) {
            const sessionTests = [];
            const pageTests = [];
            phase3Tests.forEach(testId => {
                const classification = exports.TEST_CLASSIFICATIONS[testId];
                if (classification.scope === 'session') {
                    sessionTests.push(testId);
                }
                else {
                    pageTests.push(testId);
                }
            });
            phases.push({
                phase: 3,
                sessionTests,
                pageTests,
                maxConcurrency: 2 // Lower for report generation
            });
        }
        return {
            phases,
            totalEstimatedDuration: this.estimateTotalDuration(phases, config),
            parallelPages: true,
            maxConcurrentPages: 5
        };
    }
    /**
     * Check if tests can run in parallel (no conflicts)
     */
    static canRunInParallel(testId1, testId2) {
        const test1 = exports.TEST_CLASSIFICATIONS[testId1];
        const test2 = exports.TEST_CLASSIFICATIONS[testId2];
        if (!test1 || !test2)
            return false;
        // Tests in different phases can't run in parallel
        if (test1.phase !== test2.phase)
            return false;
        // Check for conflicts
        return !test1.conflictsWith.includes(testId2) &&
            !test2.conflictsWith.includes(testId1);
    }
    /**
     * Get execution order for tests within a phase
     */
    static getExecutionOrder(testIds) {
        return testIds
            .filter(testId => exports.TEST_CLASSIFICATIONS[testId])
            .sort((a, b) => {
            const orderA = exports.TEST_CLASSIFICATIONS[a].executionOrder;
            const orderB = exports.TEST_CLASSIFICATIONS[b].executionOrder;
            return orderA - orderB;
        });
    }
    /**
     * Check if all dependencies are satisfied
     */
    static validateDependencies(testIds) {
        const missingDependencies = [];
        for (const testId of testIds) {
            const classification = exports.TEST_CLASSIFICATIONS[testId];
            if (!classification)
                continue;
            for (const dependency of classification.dependencies) {
                if (!testIds.includes(dependency)) {
                    missingDependencies.push(dependency);
                }
            }
        }
        return {
            valid: missingDependencies.length === 0,
            missingDependencies: [...new Set(missingDependencies)]
        };
    }
    /**
     * Get resource requirements for a phase
     */
    static getPhaseResourceRequirements(phase, testIds) {
        const phaseTests = testIds.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.phase === phase);
        const resourceIntensiveTests = phaseTests.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.resourceIntensive);
        let recommendedConcurrency = 5; // Default
        switch (phase) {
            case 1:
                // Data collection phase - more conservative
                recommendedConcurrency = Math.max(2, 5 - resourceIntensiveTests.length);
                break;
            case 2:
                // Analysis phase - can be more aggressive
                recommendedConcurrency = Math.max(3, 7 - resourceIntensiveTests.length);
                break;
            case 3:
                // Report generation - usually lightweight
                recommendedConcurrency = 3;
                break;
        }
        return {
            memoryIntensive: resourceIntensiveTests.filter(t => ['screenshots', 'content-scraping'].includes(t)).length,
            cpuIntensive: resourceIntensiveTests.filter(t => ['accessibility', 'site-crawling'].includes(t)).length,
            networkIntensive: phaseTests.filter(t => ['site-crawling', 'content-scraping'].includes(t)).length,
            recommendedConcurrency
        };
    }
    /**
     * Estimate duration for execution strategy
     */
    static estimateTotalDuration(phases, config) {
        let totalDuration = 0;
        for (const phase of phases) {
            const phaseDefinition = exports.PHASE_DEFINITIONS[phase.phase];
            if (phaseDefinition.scope === 'session') {
                // Session-level tests run once
                totalDuration += phase.sessionTests.length * 10; // 10s per session test
            }
            else {
                // Page-level tests run per page
                const testsPerPage = phase.pageTests.length;
                const totalPageTests = testsPerPage * (config.crawlSite ? 10 : 1); // Estimate 10 pages if crawling
                const parallelizedDuration = Math.ceil(totalPageTests / phase.maxConcurrency) * 5; // 5s per test
                totalDuration += parallelizedDuration;
            }
        }
        return totalDuration; // in seconds
    }
    /**
     * Get phase summary for display
     */
    static getPhaseSummary(phase, testIds) {
        const phaseDefinition = exports.PHASE_DEFINITIONS[phase];
        const phaseTests = testIds.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.phase === phase);
        const sessionTests = phaseTests.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.scope === 'session');
        const pageTests = phaseTests.filter(testId => exports.TEST_CLASSIFICATIONS[testId]?.scope === 'page');
        return {
            name: phaseDefinition.name,
            description: phaseDefinition.description,
            testCount: phaseTests.length,
            sessionTests,
            pageTests,
            estimatedDuration: sessionTests.length * 10 + pageTests.length * 5
        };
    }
}
exports.TestPhaseManager = TestPhaseManager;
//# sourceMappingURL=test-phases.js.map