"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressTracker = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ProgressTracker {
    state = {
        currentTest: '',
        completedTests: 0,
        totalTests: 0,
        currentPage: '',
        completedPages: 0,
        totalPages: 0
    };
    phaseState = {
        currentPhase: 0,
        totalPhases: 3,
        phaseName: '',
        phaseProgress: 0
    };
    initialize(initialState) {
        this.state = { ...initialState };
        this.displayProgress();
    }
    updateCurrentTest(testName) {
        this.state.currentTest = testName;
        console.log(chalk_1.default.blue(`  🧪 Running: ${testName}`));
    }
    updateCurrentPage(pageUrl, pageIndex) {
        this.state.currentPage = pageUrl;
        this.displayProgress();
    }
    updateCompletedPages(count) {
        this.state.completedPages = count;
        this.displayProgress();
    }
    incrementCompletedTests(count = 1) {
        this.state.completedTests += count;
        this.displayProgress();
    }
    // Phase-based progress tracking methods
    startPhase(phase, phaseName) {
        this.phaseState.currentPhase = phase;
        this.phaseState.phaseName = phaseName;
        this.phaseState.phaseProgress = 0;
        console.log(chalk_1.default.blue(`\n📋 Phase ${phase}/3: ${phaseName}`));
        console.log(chalk_1.default.gray('━'.repeat(50)));
    }
    updatePhaseProgress(progress) {
        this.phaseState.phaseProgress = Math.min(100, Math.max(0, progress));
        this.displayPhaseProgress();
    }
    completePhase() {
        this.phaseState.phaseProgress = 100;
        console.log(chalk_1.default.green(`✅ Phase ${this.phaseState.currentPhase} completed: ${this.phaseState.phaseName}\n`));
    }
    displayPhaseProgress() {
        const overallProgress = ((this.phaseState.currentPhase - 1) * 100 + this.phaseState.phaseProgress) / this.phaseState.totalPhases;
        const phaseBar = this.createProgressBar(this.phaseState.phaseProgress, 40);
        const overallBar = this.createProgressBar(overallProgress, 40);
        console.log(chalk_1.default.gray(`   Phase: ${phaseBar} ${this.phaseState.phaseProgress.toFixed(0)}%`));
        console.log(chalk_1.default.cyan(`   Overall: ${overallBar} ${overallProgress.toFixed(0)}%`));
    }
    displayProgress() {
        const testProgress = this.state.totalTests > 0
            ? Math.round((this.state.completedTests / this.state.totalTests) * 100)
            : 0;
        const pageProgress = this.state.totalPages > 0
            ? Math.round((this.state.completedPages / this.state.totalPages) * 100)
            : 0;
        const testBar = this.createProgressBar(testProgress, 30);
        const pageBar = this.createProgressBar(pageProgress, 30);
        console.log(chalk_1.default.gray(`  📊 Overall Progress: ${pageBar} ${pageProgress}% (${this.state.completedPages}/${this.state.totalPages} pages)`));
        console.log(chalk_1.default.gray(`  🔬 Test Progress:    ${testBar} ${testProgress}% (${this.state.completedTests}/${this.state.totalTests} tests)`));
    }
    createProgressBar(percentage, width) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        const filledBar = chalk_1.default.green('█'.repeat(filled));
        const emptyBar = chalk_1.default.gray('░'.repeat(empty));
        return `[${filledBar}${emptyBar}]`;
    }
    displayQueueStatus(queue, running, completed) {
        console.log(chalk_1.default.blue('\n📋 Test Queue Status:'));
        if (running.length > 0) {
            console.log(chalk_1.default.yellow(`  🏃 Running (${running.length}):`));
            running.forEach(test => console.log(chalk_1.default.yellow(`    • ${test}`)));
        }
        if (queue.length > 0) {
            console.log(chalk_1.default.gray(`  ⏳ Queued (${queue.length}):`));
            queue.slice(0, 3).forEach(test => console.log(chalk_1.default.gray(`    • ${test}`)));
            if (queue.length > 3) {
                console.log(chalk_1.default.gray(`    ... and ${queue.length - 3} more`));
            }
        }
        if (completed.length > 0) {
            console.log(chalk_1.default.green(`  ✅ Completed (${completed.length}):`));
            completed.slice(-3).forEach(test => console.log(chalk_1.default.green(`    • ${test}`)));
            if (completed.length > 3) {
                console.log(chalk_1.default.green(`    ... and ${completed.length - 3} more`));
            }
        }
        console.log('');
    }
}
exports.ProgressTracker = ProgressTracker;
//# sourceMappingURL=progress-tracker.js.map