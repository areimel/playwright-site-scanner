import chalk from 'chalk';
import { RAGService } from './rag-service.js';
import { GoogleAIConfigManager } from './google-ai-config.js';
import { PageResult, SessionSummary } from '../../types/index.js';

/**
 * Example integration showing how to add RAG capabilities to the TestOrchestrator
 * 
 * This demonstrates the integration pattern without modifying the existing orchestrator.
 * You can copy this pattern into your orchestrator when ready to add RAG support.
 */
export class RAGIntegrationExample {
  private ragService: RAGService;
  private configManager: GoogleAIConfigManager;

  constructor() {
    this.ragService = new RAGService();
    this.configManager = new GoogleAIConfigManager();
  }

  /**
   * Method to add to TestOrchestrator after session completion
   * Call this after all tests are complete and before generating final reports
   */
  async indexSessionForRAG(sessionId: string, pageResults: PageResult[]): Promise<void> {
    try {
      // Check if RAG is configured
      if (!(await this.configManager.isConfigured())) {
        console.log(chalk.gray('ℹ️  RAG indexing skipped - Google AI API key not configured'));
        console.log(chalk.gray('   To enable RAG features, set GOOGLE_AI_API_KEY environment variable'));
        return;
      }

      console.log(chalk.blue('🧠 Starting RAG indexing...'));
      
      // Filter successful results only
      const successfulResults = pageResults.map(pageResult => ({
        ...pageResult,
        tests: pageResult.tests.filter(test => test.status === 'success' && test.outputPath)
      })).filter(pageResult => pageResult.tests.length > 0);

      if (successfulResults.length === 0) {
        console.log(chalk.yellow('⚠️  No successful test results to index for RAG'));
        return;
      }

      // Index the results
      await this.ragService.indexSessionResults(sessionId, successfulResults);
      
      // Show indexing stats
      const stats = await this.ragService.getIndexStats();
      console.log(chalk.green(`✅ RAG indexing complete - ${stats.totalDocuments} documents indexed`));
      
      // Offer interactive query option (optional)
      await this.offerInteractiveQuerying();
      
    } catch (error) {
      console.error(chalk.red(`❌ RAG indexing failed: ${error}`));
      // Don't let RAG errors block the main workflow
    }
  }

  /**
   * Optional interactive querying after indexing
   */
  private async offerInteractiveQuerying(): Promise<void> {
    try {
      // In a real implementation, you might use inquirer.js for interactive prompts
      console.log(chalk.cyan('\n💡 RAG service is now ready for queries!'));
      console.log(chalk.gray('   You can now ask questions about your test results:'));
      console.log(chalk.gray('   - "What SEO issues were found?"'));
      console.log(chalk.gray('   - "Are there any accessibility violations?"'));
      console.log(chalk.gray('   - "What are the main recommendations?"'));
      console.log(chalk.gray('   - "Which pages have the most issues?"'));
      
      // Example of how to run a sample query
      const sampleQuery = "What are the main issues found across all pages?";
      console.log(chalk.cyan(`\n🔍 Sample query: "${sampleQuery}"`));
      
      const result = await this.ragService.query(sampleQuery);
      console.log(chalk.green(`📝 Answer: ${result.answer.slice(0, 300)}...`));
      console.log(chalk.gray(`   Confidence: ${Math.round(result.confidence * 100)}%, Sources: ${result.sources.length}`));
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Sample query failed: ${error}`));
    }
  }

  /**
   * Add this method to handle RAG queries during or after test execution
   */
  async queryTestResults(query: string, sessionId?: string): Promise<string> {
    try {
      const context = sessionId ? { sessionId } : undefined;
      const result = await this.ragService.query(query, context);
      
      console.log(chalk.green(`🤖 RAG Answer (${Math.round(result.confidence * 100)}% confidence):`));
      console.log(chalk.white(result.answer));
      
      if (result.sources.length > 0) {
        console.log(chalk.gray(`📚 Based on ${result.sources.length} source(s)`));
      }
      
      return result.answer;
      
    } catch (error) {
      const errorMsg = `Failed to process query: ${error}`;
      console.error(chalk.red(`❌ ${errorMsg}`));
      return errorMsg;
    }
  }

  /**
   * Get RAG system statistics
   */
  async getRAGStats(): Promise<string> {
    try {
      const stats = await this.ragService.getIndexStats();
      
      let report = `📊 RAG Index Statistics:\n`;
      report += `  • Documents: ${stats.totalDocuments}\n`;
      report += `  • Chunks: ${stats.totalChunks}\n`;
      report += `  • Sessions: ${stats.sessionCount}\n`;
      report += `  • Index Size: ${Math.round(stats.indexSize / 1024)} KB\n`;
      report += `  • Last Updated: ${stats.lastUpdated.toLocaleString()}\n`;
      
      if (Object.keys(stats.testTypeDistribution).length > 0) {
        report += `  • Test Types:\n`;
        Object.entries(stats.testTypeDistribution).forEach(([type, count]) => {
          report += `    - ${type}: ${count} documents\n`;
        });
      }
      
      return report;
      
    } catch (error) {
      return `Error getting RAG stats: ${error}`;
    }
  }

  /**
   * Clear the RAG index (useful for testing or cleanup)
   */
  async clearRAGIndex(): Promise<void> {
    try {
      await this.ragService.clearIndex();
      console.log(chalk.green('✅ RAG index cleared successfully'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to clear RAG index: ${error}`));
    }
  }
}

/**
 * Example of how to integrate RAG into the existing TestOrchestrator
 * 
 * Add these modifications to your TestOrchestrator class:
 */
export const ORCHESTRATOR_INTEGRATION_EXAMPLE = `
// 1. Add to TestOrchestrator imports:
import { RAGService } from '../lib/ai/rag-service.js';
import { GoogleAIConfigManager } from '../lib/ai/google-ai-config.js';

// 2. Add to TestOrchestrator class properties:
private ragService: RAGService | null = null;
private ragConfigManager: GoogleAIConfigManager | null = null;

// 3. Add to TestOrchestrator constructor:
constructor() {
  // ... existing initialization ...
  this.ragService = new RAGService();
  this.ragConfigManager = new GoogleAIConfigManager();
}

// 4. Add this method to TestOrchestrator:
private async indexResultsForRAG(): Promise<void> {
  if (!this.ragService || !this.ragConfigManager) return;
  
  try {
    // Check if RAG is configured
    if (!(await this.ragConfigManager.isConfigured())) {
      console.log(chalk.gray('ℹ️  RAG indexing skipped - Google AI API key not configured'));
      return;
    }

    console.log(chalk.blue('🧠 Indexing test results for RAG...'));
    
    // Get successful page results
    const successfulResults = this.resultsManager.getSuccessfulPageResults();
    
    if (successfulResults.length > 0) {
      await this.ragService.indexSessionResults(
        this.dataManager!.sessionId, 
        successfulResults
      );
      console.log(chalk.green('✅ RAG indexing complete'));
    }
    
  } catch (error) {
    console.error(chalk.yellow(\`⚠️  RAG indexing failed: \${error}\`));
    // Don't let RAG errors block the main workflow
  }
}

// 5. Add this call in your main execution method after tests complete:
async runTests(config: TestConfig): Promise<SessionSummary> {
  // ... existing test execution logic ...
  
  // After all tests are complete and before final cleanup:
  await this.indexResultsForRAG();
  
  // ... continue with existing cleanup and summary generation ...
}

// 6. Optional: Add a method for querying:
async queryTestResults(query: string): Promise<string> {
  if (!this.ragService) return "RAG service not available";
  
  try {
    const result = await this.ragService.query(query, {
      sessionId: this.dataManager?.sessionId
    });
    return result.answer;
  } catch (error) {
    return \`Query failed: \${error}\`;
  }
}
`;

console.log(chalk.blue('📖 RAG Integration Example Loaded'));
console.log(chalk.gray('This file demonstrates how to integrate RAG capabilities into your Playwright Site Scanner.'));
console.log(chalk.gray('See the ORCHESTRATOR_INTEGRATION_EXAMPLE constant for specific integration code.'));