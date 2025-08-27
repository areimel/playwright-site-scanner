import chalk from 'chalk';
import { RAGService } from './rag-service.js';
import { GoogleAIConfigManager } from './google-ai-config.js';
import { PageResult, TestResult, RAGContext } from '../../types/index.js';

/**
 * Demo script showing how to use the RAG service
 * This can be used as a reference for integration
 */
export class RAGDemo {
  private ragService: RAGService;
  private configManager: GoogleAIConfigManager;

  constructor() {
    this.ragService = new RAGService();
    this.configManager = new GoogleAIConfigManager();
  }

  /**
   * Run a complete RAG demo
   */
  async runDemo(): Promise<void> {
    try {
      console.log(chalk.blue('\n🤖 RAG Service Demo Starting...'));

      // Check API key configuration
      if (!(await this.configManager.isConfigured())) {
        console.log(chalk.red('❌ Google AI API key not configured'));
        console.log(this.configManager.getSetupInstructions());
        return;
      }

      console.log(chalk.green('✅ Google AI API key configured'));

      // Get index stats
      const stats = await this.ragService.getIndexStats();
      console.log(chalk.gray(`📊 Current index: ${stats.totalDocuments} documents, ${stats.totalChunks} chunks`));

      if (stats.totalDocuments === 0) {
        console.log(chalk.yellow('⚠️  No documents in index. Run some tests first to index results.'));
        console.log(chalk.gray('   Example: npm start -> select tests -> index results -> query'));
        return;
      }

      // Demo queries
      const demoQueries = [
        "What SEO issues were found across all pages?",
        "Are there any accessibility violations that need attention?",
        "What is the overall performance of the website?",
        "Which pages have the most critical issues?",
        "What are the main recommendations for improving this site?"
      ];

      console.log(chalk.blue('\n🔍 Running demo queries...'));

      for (const query of demoQueries) {
        console.log(chalk.cyan(`\nQuery: "${query}"`));
        
        try {
          const result = await this.ragService.query(query);
          
          console.log(chalk.green(`✅ Answer (${Math.round(result.confidence * 100)}% confidence):`));
          console.log(chalk.white(result.answer));
          
          if (result.sources.length > 0) {
            console.log(chalk.gray(`📚 Based on ${result.sources.length} source(s):`));
            result.sources.slice(0, 3).forEach((source, index) => {
              console.log(chalk.gray(`  ${index + 1}. ${source.testType} test for ${source.page}`));
            });
          }
          
        } catch (error) {
          console.error(chalk.red(`❌ Query failed: ${error}`));
        }

        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(chalk.blue('\n✅ RAG Demo completed!'));

    } catch (error) {
      console.error(chalk.red(`❌ Demo failed: ${error}`));
    }
  }

  /**
   * Demo specific context-filtered queries
   */
  async demoContextQueries(): Promise<void> {
    console.log(chalk.blue('\n🎯 Testing context-filtered queries...'));

    const contextQueries = [
      {
        query: "What SEO issues were found?",
        context: { testTypes: ['seo'] }
      },
      {
        query: "Are there accessibility problems?",
        context: { testTypes: ['accessibility'] }
      },
      {
        query: "What issues are on the homepage?",
        context: { pages: ['home', 'index', '/'] }
      }
    ];

    for (const { query, context } of contextQueries) {
      console.log(chalk.cyan(`\nContextual Query: "${query}"`));
      console.log(chalk.gray(`Context: ${JSON.stringify(context)}`));
      
      try {
        const result = await this.ragService.query(query, context as RAGContext);
        console.log(chalk.green(`Answer: ${result.answer.slice(0, 200)}...`));
        console.log(chalk.gray(`Sources: ${result.sources.length}`));
        
      } catch (error) {
        console.error(chalk.red(`❌ Query failed: ${error}`));
      }
    }
  }

  /**
   * Demo index management
   */
  async demoIndexManagement(): Promise<void> {
    console.log(chalk.blue('\n📚 Index Management Demo...'));

    // Show current stats
    const stats = await this.ragService.getIndexStats();
    console.log(chalk.gray('Current Index Stats:'));
    console.log(chalk.gray(`  - Documents: ${stats.totalDocuments}`));
    console.log(chalk.gray(`  - Chunks: ${stats.totalChunks}`));
    console.log(chalk.gray(`  - Sessions: ${stats.sessionCount}`));
    console.log(chalk.gray(`  - Index Size: ${Math.round(stats.indexSize / 1024)} KB`));
    console.log(chalk.gray(`  - Last Updated: ${stats.lastUpdated.toISOString()}`));

    // Show test type distribution
    console.log(chalk.gray('Test Type Distribution:'));
    Object.entries(stats.testTypeDistribution).forEach(([testType, count]) => {
      console.log(chalk.gray(`  - ${testType}: ${count} documents`));
    });
  }

  /**
   * Example of how to index session results
   */
  async exampleIndexing(): Promise<void> {
    console.log(chalk.blue('\n📝 Example: How to index session results'));

    // This is example code showing how to integrate with the orchestrator
    const exampleCode = `
// In your test orchestrator or after test completion:
import { RAGService } from './lib/ai/rag-service.js';

const ragService = new RAGService();

// After completing all tests for a session:
const pageResults: PageResult[] = [
  // Your actual page results from test execution
];

// Index the results
await ragService.indexSessionResults(sessionId, pageResults);

// Now you can query:
const result = await ragService.query("What SEO issues were found?");
console.log(result.answer);
    `;

    console.log(chalk.gray(exampleCode));
  }
}

// Example usage (for manual testing)
export async function runRAGDemo(): Promise<void> {
  const demo = new RAGDemo();
  await demo.runDemo();
}