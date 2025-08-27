#!/usr/bin/env node

/**
 * Simple test script to verify RAG service functionality
 * Run with: node dist/lib/ai/test-rag.js
 */

import chalk from 'chalk';
import { RAGService } from './rag-service.js';
import { GoogleAIConfigManager } from './google-ai-config.js';

async function testRAGService(): Promise<void> {
  console.log(chalk.blue('🧪 Testing RAG Service...'));

  try {
    // Test configuration manager
    const configManager = new GoogleAIConfigManager();
    const isConfigured = await configManager.isConfigured();
    
    if (isConfigured) {
      console.log(chalk.green('✅ Google AI API key is configured'));
    } else {
      console.log(chalk.yellow('⚠️  Google AI API key not configured'));
      console.log(chalk.gray('Set GOOGLE_AI_API_KEY environment variable to test further'));
      console.log(configManager.getSetupInstructions());
      return;
    }

    // Test RAG service initialization
    const ragService = new RAGService();
    console.log(chalk.green('✅ RAG service created successfully'));

    // Test getting index stats (should work even with empty index)
    const stats = await ragService.getIndexStats();
    console.log(chalk.green('✅ Index stats retrieved'));
    console.log(chalk.gray(`   Documents: ${stats.totalDocuments}`));
    console.log(chalk.gray(`   Chunks: ${stats.totalChunks}`));
    console.log(chalk.gray(`   Sessions: ${stats.sessionCount}`));

    if (stats.totalDocuments > 0) {
      // Test a simple query if we have data
      console.log(chalk.blue('\n🔍 Testing query functionality...'));
      
      const testQuery = "What are the main findings?";
      const result = await ragService.query(testQuery);
      
      console.log(chalk.green('✅ Query executed successfully'));
      console.log(chalk.gray(`   Query: "${testQuery}"`));
      console.log(chalk.gray(`   Answer: ${result.answer.slice(0, 100)}...`));
      console.log(chalk.gray(`   Confidence: ${Math.round(result.confidence * 100)}%`));
      console.log(chalk.gray(`   Sources: ${result.sources.length}`));
      
    } else {
      console.log(chalk.yellow('⚠️  No indexed data found for query testing'));
      console.log(chalk.gray('Run some tests first, then try: npm start'));
    }

    console.log(chalk.blue('\n✅ RAG Service test completed successfully!'));

  } catch (error) {
    console.error(chalk.red('❌ RAG Service test failed:'));
    console.error(chalk.red(`   Error: ${error}`));
    
    if (error instanceof Error && error.message.includes('API key')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure to set your Google AI API key:'));
      console.log(chalk.gray('   export GOOGLE_AI_API_KEY="your_api_key_here"'));
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testRAGService().catch(console.error);
}

export { testRAGService };