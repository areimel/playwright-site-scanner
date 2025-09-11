import { TestConfig } from './index.js';
import { getTestClassifications, getPhaseDefinitions } from '../utils/config-loader.js';

export type TestPhase = 1 | 2 | 3 | 4;

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
  outputType: 'per-page' | 'site-wide';
}

// Test classifications loaded from config
let TEST_CLASSIFICATIONS: Record<string, TestClassification> | null = null;

async function getTestClassificationsCache(): Promise<Record<string, TestClassification>> {
  if (!TEST_CLASSIFICATIONS) {
    TEST_CLASSIFICATIONS = await getTestClassifications();
  }
  return TEST_CLASSIFICATIONS;
}

// Phase definitions loaded from config
let PHASE_DEFINITIONS: Record<TestPhase, PhaseDefinition> | null = null;

async function getPhaseDefinitionsCache(): Promise<Record<TestPhase, PhaseDefinition>> {
  if (!PHASE_DEFINITIONS) {
    PHASE_DEFINITIONS = await getPhaseDefinitions();
  }
  return PHASE_DEFINITIONS;
}

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

export class TestPhaseManager {
  /**
   * Organize selected tests into execution phases
   */
  static async organizeTestsIntoPhases(config: TestConfig): Promise<ExecutionStrategy> {
    const testClassifications = await getTestClassificationsCache();
    const selectedTestIds = config.selectedTests
      .filter(test => test.enabled)
      .map(test => test.id);

    const phases: PhaseExecutionPlan[] = [];
    
    // Phase 1: Data Collection
    const phase1Tests = selectedTestIds.filter(testId => 
      testClassifications[testId]?.phase === 1
    );
    
    if (phase1Tests.length > 0 || config.crawlSite) {
      // Always include site crawling if we're crawling the site
      const sessionTests = config.crawlSite ? ['site-crawling'] : [];
      const pageTests: string[] = [];
      
      phase1Tests.forEach(testId => {
        const classification = testClassifications[testId];
        if (classification.scope === 'session') {
          sessionTests.push(testId);
        } else {
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
    const phase2Tests = selectedTestIds.filter(testId => 
      testClassifications[testId]?.phase === 2
    );
    
    if (phase2Tests.length > 0) {
      const sessionTests: string[] = [];
      const pageTests: string[] = [];
      
      phase2Tests.forEach(testId => {
        const classification = testClassifications[testId];
        if (classification.scope === 'session') {
          sessionTests.push(testId);
        } else {
          pageTests.push(testId);
        }
      });

      phases.push({
        phase: 2,
        sessionTests,
        pageTests,
        maxConcurrency: 5 // Higher concurrency for analysis
      });
    }

    // Phase 3: Screenshot Testing
    const phase3Tests = selectedTestIds.filter(testId => 
      testClassifications[testId]?.phase === 3
    );
    
    if (phase3Tests.length > 0) {
      const sessionTests: string[] = [];
      const pageTests: string[] = [];
      
      phase3Tests.forEach(testId => {
        const classification = testClassifications[testId];
        if (classification.scope === 'session') {
          sessionTests.push(testId);
        } else {
          pageTests.push(testId);
        }
      });

      phases.push({
        phase: 3,
        sessionTests,
        pageTests,
        maxConcurrency: 2 // Conservative for screenshot testing
      });
    }

    // Phase 4: Final Analysis & Report Generation
    const phase4Tests = selectedTestIds.filter(testId => 
      testClassifications[testId]?.phase === 4
    );
    
    if (phase4Tests.length > 0) {
      const sessionTests: string[] = [];
      const pageTests: string[] = [];
      
      phase4Tests.forEach(testId => {
        const classification = testClassifications[testId];
        if (classification.scope === 'session') {
          sessionTests.push(testId);
        } else {
          pageTests.push(testId);
        }
      });

      phases.push({
        phase: 4,
        sessionTests,
        pageTests,
        maxConcurrency: 2 // Lower for final analysis and report generation
      });
    }

    return {
      phases,
      totalEstimatedDuration: await this.estimateTotalDuration(phases, config),
      parallelPages: true,
      maxConcurrentPages: 5
    };
  }

  /**
   * Check if tests can run in parallel (no conflicts)
   */
  static async canRunInParallel(testId1: string, testId2: string): Promise<boolean> {
    const testClassifications = await getTestClassificationsCache();
    const test1 = testClassifications[testId1];
    const test2 = testClassifications[testId2];
    
    if (!test1 || !test2) return false;
    
    // Tests in different phases can't run in parallel
    if (test1.phase !== test2.phase) return false;
    
    // Check for conflicts
    return !test1.conflictsWith.includes(testId2) && 
           !test2.conflictsWith.includes(testId1);
  }

  /**
   * Get execution order for tests within a phase
   */
  static async getExecutionOrder(testIds: string[]): Promise<string[]> {
    const testClassifications = await getTestClassificationsCache();
    return testIds
      .filter(testId => testClassifications[testId])
      .sort((a, b) => {
        const orderA = testClassifications[a].executionOrder;
        const orderB = testClassifications[b].executionOrder;
        return orderA - orderB;
      });
  }

  /**
   * Check if all dependencies are satisfied
   */
  static async validateDependencies(testIds: string[]): Promise<{ valid: boolean; missingDependencies: string[] }> {
    const testClassifications = await getTestClassificationsCache();
    const missingDependencies: string[] = [];
    
    for (const testId of testIds) {
      const classification = testClassifications[testId];
      if (!classification) continue;
      
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
  static async getPhaseResourceRequirements(phase: TestPhase, testIds: string[]): Promise<{
    memoryIntensive: number;
    cpuIntensive: number;
    networkIntensive: number;
    recommendedConcurrency: number;
  }> {
    const testClassifications = await getTestClassificationsCache();
    const phaseTests = testIds.filter(testId => 
      testClassifications[testId]?.phase === phase
    );
    
    const resourceIntensiveTests = phaseTests.filter(testId =>
      testClassifications[testId]?.resourceIntensive
    );
    
    let recommendedConcurrency = 5; // Default
    
    switch (phase) {
      case 1:
        // Data collection phase - more conservative
        recommendedConcurrency = Math.max(2, 5 - resourceIntensiveTests.length);
        break;
      case 2:
        // Page analysis phase - can be more aggressive
        recommendedConcurrency = Math.max(3, 7 - resourceIntensiveTests.length);
        break;
      case 3:
        // Screenshot testing phase - very conservative due to resource intensity
        recommendedConcurrency = Math.max(1, 3 - resourceIntensiveTests.length);
        break;
      case 4:
        // Final analysis and report generation - lightweight
        recommendedConcurrency = 2;
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
  private static async estimateTotalDuration(phases: PhaseExecutionPlan[], config: TestConfig): Promise<number> {
    const phaseDefinitions = await getPhaseDefinitionsCache();
    let totalDuration = 0;
    
    for (const phase of phases) {
      const phaseDefinition = phaseDefinitions[phase.phase];
      
      if (phaseDefinition.scope === 'session') {
        // Session-level tests run once
        totalDuration += phase.sessionTests.length * 10; // 10s per session test
      } else {
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
  static async getPhaseSummary(phase: TestPhase, testIds: string[]): Promise<{
    name: string;
    description: string;
    testCount: number;
    sessionTests: string[];
    pageTests: string[];
    estimatedDuration: number;
  }> {
    const phaseDefinitions = await getPhaseDefinitionsCache();
    const testClassifications = await getTestClassificationsCache();
    const phaseDefinition = phaseDefinitions[phase];
    const phaseTests = testIds.filter(testId => 
      testClassifications[testId]?.phase === phase
    );
    
    const sessionTests = phaseTests.filter(testId =>
      testClassifications[testId]?.scope === 'session'
    );
    
    const pageTests = phaseTests.filter(testId =>
      testClassifications[testId]?.scope === 'page'
    );
    
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