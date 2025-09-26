import { TestConfig } from '@shared/index.js';

export interface PhaseWeighting {
  discovery: number;    // Phase 1: Data Discovery & Collection  
  testing: number;      // Phase 2: Page Analysis & Testing
  reporting: number;    // Phase 3: Report Generation
}

export interface PhaseProgress {
  phase: number;
  name: string;
  progress: number;     // 0-100% for this phase
  startTime?: Date;
  estimatedDuration?: number; // in seconds
}

export interface SessionProgress {
  overallProgress: number;      // 0-100% for entire session
  currentPhase: PhaseProgress;
  totalPages: number;
  totalTests: number;
  completedTests: number;
  estimatedTimeRemaining?: number; // in seconds
  sessionStartTime: Date;
}

/**
 * SessionProgressTracker - Provides accurate, smooth progress tracking across the entire test session
 * Uses weighted phase calculation to prevent backwards progress movement
 */
export class SessionProgressTracker {
  private weights: PhaseWeighting = {
    discovery: 0.2,   // 20% - Site crawling, content scraping, sitemap generation
    testing: 0.7,     // 70% - Screenshots, SEO, accessibility (most time-intensive)
    reporting: 0.1    // 10% - Site summary, report generation
  };

  private phases: PhaseProgress[] = [
    { phase: 1, name: 'Data Discovery & Collection', progress: 0 },
    { phase: 2, name: 'Page Analysis & Testing', progress: 0 },
    { phase: 3, name: 'Report Generation', progress: 0 }
  ];

  private sessionState: SessionProgress;
  private phaseEstimates: number[] = []; // Duration estimates per phase in seconds
  
  constructor(config: TestConfig, totalPages: number) {
    const totalTests = this.calculateTotalTests(config, totalPages);
    
    this.sessionState = {
      overallProgress: 0,
      currentPhase: this.phases[0],
      totalPages,
      totalTests,
      completedTests: 0,
      sessionStartTime: new Date()
    };

    // Calculate estimated durations based on test configuration
    this.calculatePhaseEstimates(config, totalPages);
  }

  /**
   * Update progress for the current phase
   */
  updatePhaseProgress(phase: number, progress: number): void {
    const phaseIndex = phase - 1;
    if (phaseIndex < 0 || phaseIndex >= this.phases.length) return;

    // Ensure progress only goes forward within a phase
    const currentProgress = this.phases[phaseIndex].progress;
    this.phases[phaseIndex].progress = Math.max(currentProgress, Math.min(100, progress));

    // Update current phase if this is the active one
    if (this.sessionState.currentPhase.phase === phase) {
      this.sessionState.currentPhase = { ...this.phases[phaseIndex] };
    }

    this.updateOverallProgress();
    this.updateTimeEstimate();
  }

  /**
   * Start a new phase
   */
  startPhase(phase: number): void {
    const phaseIndex = phase - 1;
    if (phaseIndex < 0 || phaseIndex >= this.phases.length) return;

    // Mark previous phases as 100% complete
    for (let i = 0; i < phaseIndex; i++) {
      this.phases[i].progress = 100;
    }

    this.phases[phaseIndex].startTime = new Date();
    this.sessionState.currentPhase = { ...this.phases[phaseIndex] };
    
    this.updateOverallProgress();
    this.updateTimeEstimate();
  }

  /**
   * Complete a phase (set to 100%)
   */
  completePhase(phase: number): void {
    this.updatePhaseProgress(phase, 100);
  }

  /**
   * Update test completion count
   */
  updateTestProgress(completedTests: number): void {
    this.sessionState.completedTests = Math.min(completedTests, this.sessionState.totalTests);
  }

  /**
   * Get current session progress state
   */
  getSessionProgress(): SessionProgress {
    return { ...this.sessionState };
  }

  /**
   * Get current overall progress (0-100)
   */
  getOverallProgress(): number {
    return this.sessionState.overallProgress;
  }

  /**
   * Get current phase name for display
   */
  getCurrentPhaseName(): string {
    return this.sessionState.currentPhase.name;
  }

  /**
   * Get estimated time remaining in seconds
   */
  getEstimatedTimeRemaining(): number | undefined {
    return this.sessionState.estimatedTimeRemaining;
  }

  /**
   * Get progress for a specific test type within current phase
   * Used for contextual progress labels
   */
  getTestTypeProgress(testType: string, completed: number, total: number): number {
    if (total === 0) return 0;
    
    // Calculate progress within current phase context
    const testProgress = (completed / total) * 100;
    const currentPhaseIndex = this.sessionState.currentPhase.phase - 1;
    
    // Weight the test progress within the phase
    const phaseWeight = this.getPhaseWeight(this.sessionState.currentPhase.phase);
    const testWeight = this.getTestTypeWeight(testType, this.sessionState.currentPhase.phase);
    
    return testProgress * testWeight;
  }

  /**
   * Calculate overall progress using weighted phases
   */
  private updateOverallProgress(): void {
    const phase1Weight = this.weights.discovery;
    const phase2Weight = this.weights.testing;
    const phase3Weight = this.weights.reporting;

    const overallProgress = 
      (this.phases[0].progress * phase1Weight) +
      (this.phases[1].progress * phase2Weight) +
      (this.phases[2].progress * phase3Weight);

    // Ensure progress only moves forward
    this.sessionState.overallProgress = Math.max(
      this.sessionState.overallProgress, 
      Math.min(100, overallProgress)
    );
  }

  /**
   * Update estimated time remaining based on current progress
   */
  private updateTimeEstimate(): void {
    const elapsed = Date.now() - this.sessionState.sessionStartTime.getTime();
    const elapsedSeconds = elapsed / 1000;
    
    if (this.sessionState.overallProgress <= 0) {
      // Use initial estimates if no progress yet
      this.sessionState.estimatedTimeRemaining = this.phaseEstimates.reduce((sum, est) => sum + est, 0);
      return;
    }

    // Calculate based on actual progress rate
    const progressRate = this.sessionState.overallProgress / elapsedSeconds; // progress per second
    if (progressRate > 0) {
      const remainingProgress = 100 - this.sessionState.overallProgress;
      this.sessionState.estimatedTimeRemaining = Math.round(remainingProgress / progressRate);
    }

    // Cap at reasonable maximum (30 minutes)
    if (this.sessionState.estimatedTimeRemaining && this.sessionState.estimatedTimeRemaining > 1800) {
      this.sessionState.estimatedTimeRemaining = 1800;
    }
  }

  /**
   * Calculate total number of tests based on configuration
   */
  private calculateTotalTests(config: TestConfig, totalPages: number): number {
    let testsPerPage = 0;
    
    config.selectedTests.forEach(test => {
      if (!test.enabled) return;
      
      switch (test.id) {
        case 'screenshots':
          testsPerPage += config.viewports.length; // One test per viewport
          break;
        case 'seo':
        case 'accessibility':
        case 'content-scraping':
          testsPerPage += 1;
          break;
        case 'sitemap':
        case 'site-summary':
        case 'api-key-scan':
          // These are session-wide tests (count as 1 regardless of pages)
          break;
      }
    });

    // Session-wide tests
    let sessionTests = 0;
    config.selectedTests.forEach(test => {
      if (test.enabled && ['sitemap', 'site-summary', 'api-key-scan'].includes(test.id)) {
        sessionTests += 1;
      }
    });

    return (testsPerPage * totalPages) + sessionTests;
  }

  /**
   * Calculate estimated durations for each phase based on configuration
   */
  private calculatePhaseEstimates(config: TestConfig, totalPages: number): void {
    // Base estimates per page (in seconds)
    const baseEstimates = {
      crawling: 2,        // 2 seconds per page to crawl
      screenshots: 5,     // 5 seconds per viewport
      seo: 3,            // 3 seconds per page
      accessibility: 4,   // 4 seconds per page
      contentScraping: 2, // 2 seconds per page
      reporting: 1        // 1 second per page for aggregation
    };

    // Phase 1: Data Discovery & Collection
    let phase1Duration = totalPages * baseEstimates.crawling;
    if (config.selectedTests.some(t => t.enabled && t.id === 'content-scraping')) {
      phase1Duration += totalPages * baseEstimates.contentScraping;
    }
    if (config.selectedTests.some(t => t.enabled && t.id === 'sitemap')) {
      phase1Duration += 5; // Fixed time for sitemap generation
    }

    // Phase 2: Page Analysis & Testing
    let phase2Duration = 0;
    if (config.selectedTests.some(t => t.enabled && t.id === 'screenshots')) {
      phase2Duration += totalPages * config.viewports.length * baseEstimates.screenshots;
    }
    if (config.selectedTests.some(t => t.enabled && t.id === 'seo')) {
      phase2Duration += totalPages * baseEstimates.seo;
    }
    if (config.selectedTests.some(t => t.enabled && t.id === 'accessibility')) {
      phase2Duration += totalPages * baseEstimates.accessibility;
    }

    // Phase 3: Report Generation
    let phase3Duration = totalPages * baseEstimates.reporting;
    if (config.selectedTests.some(t => t.enabled && t.id === 'site-summary')) {
      phase3Duration += 10; // Fixed time for site summary generation
    }

    this.phaseEstimates = [phase1Duration, phase2Duration, phase3Duration];
  }

  /**
   * Get weight for a specific phase
   */
  private getPhaseWeight(phase: number): number {
    switch (phase) {
      case 1: return this.weights.discovery;
      case 2: return this.weights.testing;
      case 3: return this.weights.reporting;
      default: return 0;
    }
  }

  /**
   * Get relative weight for a test type within its phase
   */
  private getTestTypeWeight(testType: string, phase: number): number {
    // These weights are relative within each phase
    const phaseWeights: Record<number, Record<string, number>> = {
      1: { // Data Discovery & Collection
        'site-crawling': 0.4,
        'content-scraping': 0.5,
        'sitemap': 0.1
      },
      2: { // Page Analysis & Testing
        'screenshots': 0.4,
        'seo': 0.3,
        'accessibility': 0.3,
        'api-key-scan': 0.1
      },
      3: { // Report Generation
        'site-summary': 0.6,
        'session-reporting': 0.4
      }
    };

    return phaseWeights[phase]?.[testType] || 1.0;
  }

  /**
   * Create a progress tracker configured for a specific test configuration
   */
  static createForConfig(config: TestConfig, totalPages: number): SessionProgressTracker {
    return new SessionProgressTracker(config, totalPages);
  }

  /**
   * Get a user-friendly progress description
   */
  getProgressDescription(): string {
    const progress = Math.round(this.sessionState.overallProgress);
    const phaseName = this.sessionState.currentPhase.name;
    
    if (progress === 0) {
      return `Starting ${phaseName}...`;
    } else if (progress >= 100) {
      return 'Testing session complete';
    } else {
      return `${phaseName} (${progress}% complete)`;
    }
  }
}