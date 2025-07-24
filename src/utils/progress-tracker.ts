import chalk from 'chalk';
import { ProgressState } from '../types/index.js';

export class ProgressTracker {
  private state: ProgressState = {
    currentTest: '',
    completedTests: 0,
    totalTests: 0,
    currentPage: '',
    completedPages: 0,
    totalPages: 0
  };

  initialize(initialState: ProgressState): void {
    this.state = { ...initialState };
    this.displayProgress();
  }

  updateCurrentTest(testName: string): void {
    this.state.currentTest = testName;
    console.log(chalk.blue(`  🧪 Running: ${testName}`));
  }

  updateCurrentPage(pageUrl: string, pageIndex: number): void {
    this.state.currentPage = pageUrl;
    this.displayProgress();
  }

  updateCompletedPages(count: number): void {
    this.state.completedPages = count;
    this.displayProgress();
  }

  incrementCompletedTests(count: number = 1): void {
    this.state.completedTests += count;
    this.displayProgress();
  }

  private displayProgress(): void {
    const testProgress = this.state.totalTests > 0 
      ? Math.round((this.state.completedTests / this.state.totalTests) * 100)
      : 0;
    
    const pageProgress = this.state.totalPages > 0
      ? Math.round((this.state.completedPages / this.state.totalPages) * 100)
      : 0;

    const testBar = this.createProgressBar(testProgress, 30);
    const pageBar = this.createProgressBar(pageProgress, 30);

    console.log(chalk.gray(`  📊 Overall Progress: ${pageBar} ${pageProgress}% (${this.state.completedPages}/${this.state.totalPages} pages)`));
    console.log(chalk.gray(`  🔬 Test Progress:    ${testBar} ${testProgress}% (${this.state.completedTests}/${this.state.totalTests} tests)`));
  }

  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }

  displayQueueStatus(queue: string[], running: string[], completed: string[]): void {
    console.log(chalk.blue('\n📋 Test Queue Status:'));
    
    if (running.length > 0) {
      console.log(chalk.yellow(`  🏃 Running (${running.length}):`));
      running.forEach(test => console.log(chalk.yellow(`    • ${test}`)));
    }
    
    if (queue.length > 0) {
      console.log(chalk.gray(`  ⏳ Queued (${queue.length}):`));
      queue.slice(0, 3).forEach(test => console.log(chalk.gray(`    • ${test}`)));
      if (queue.length > 3) {
        console.log(chalk.gray(`    ... and ${queue.length - 3} more`));
      }
    }
    
    if (completed.length > 0) {
      console.log(chalk.green(`  ✅ Completed (${completed.length}):`));
      completed.slice(-3).forEach(test => console.log(chalk.green(`    • ${test}`)));
      if (completed.length > 3) {
        console.log(chalk.green(`    ... and ${completed.length - 3} more`));
      }
    }
    
    console.log('');
  }
}