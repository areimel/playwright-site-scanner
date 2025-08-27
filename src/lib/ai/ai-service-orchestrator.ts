import chalk from 'chalk';
import { TestResult, PageResult, SessionSummary } from '../../types/index.js';
import { SessionManager } from '../../utils/session-manager.js';
import { RAGService } from './rag-service.js';
import { VisionService } from './vision-service.js';
import { ChatbotService } from './chatbot-service.js';
import { isAIFeatureAvailable, getCompleteAIConfig } from '../../utils/ai-config.js';

/**
 * AI Service Orchestrator - Central coordinator for all AI-powered features
 * Manages RAG, Vision, and Chatbot services following the orchestrator pattern
 */
export class AIServiceOrchestrator {
  private sessionManager: SessionManager;
  private ragService: RAGService | null = null;
  private visionService: VisionService | null = null;
  private chatbotService: ChatbotService | null = null;
  private isInitialized: boolean = false;
  private availableServices: Set<string> = new Set();

  constructor() {
    this.sessionManager = new SessionManager();
  }

  /**
   * Initialize AI services based on available configuration
   * Gracefully handles missing API keys or disabled features
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(chalk.blue('🤖 Initializing AI services...'));

    try {
      // Validate AI configuration
      const aiConfig = getCompleteAIConfig();
      
      if (!aiConfig.features.enableContentIntelligence && !aiConfig.features.enableVisualAnalysis && !aiConfig.features.enableChatbot) {
        console.log(chalk.yellow('⚠️  AI features are disabled in configuration'));
        this.isInitialized = true;
        return;
      }

      // Initialize RAG Service
      if (isAIFeatureAvailable('enableContentIntelligence')) {
        try {
          this.ragService = new RAGService();
          // Remove the initialize call since it's private - the constructor handles initialization
          this.availableServices.add('rag');
          console.log(chalk.green('✅ RAG Service initialized'));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  RAG Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }

      // Initialize Vision Service
      if (isAIFeatureAvailable('enableVisualAnalysis')) {
        try {
          this.visionService = new VisionService();
          this.availableServices.add('vision');
          console.log(chalk.green('✅ Vision Service initialized'));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Vision Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }

      // Initialize Chatbot Service
      if (isAIFeatureAvailable('enableChatbot')) {
        try {
          this.chatbotService = new ChatbotService();
          this.availableServices.add('chatbot');
          console.log(chalk.green('✅ Chatbot Service initialized'));
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Chatbot Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }

      this.isInitialized = true;
      
      if (this.availableServices.size === 0) {
        console.log(chalk.yellow('⚠️  No AI services are available. Check your configuration.'));
      } else {
        console.log(chalk.blue(`🤖 ${this.availableServices.size} AI service(s) ready: ${Array.from(this.availableServices).join(', ')}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ AI services initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      this.isInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Run AI RAG analysis on session results
   * Indexes all test results for semantic search and analysis
   */
  async runRAGAnalysis(sessionId: string, pageResults: PageResult[]): Promise<TestResult> {
    const startTime = new Date();
    const testResult: TestResult = {
      testType: 'ai-rag-analysis',
      status: 'pending',
      startTime,
      outputType: 'site-wide'
    };

    try {
      if (!this.ragService || !this.availableServices.has('rag')) {
        throw new Error('RAG Service not available');
      }

      console.log(chalk.gray('🤖 Running RAG analysis...'));

      // Index all session results
      await this.ragService.indexSessionResults(sessionId, pageResults);

      // Generate analysis report
      const analysisQueries = [
        'What are the main SEO issues found across all pages?',
        'What accessibility problems need immediate attention?',
        'What are the key recommendations for improving this website?',
        'Which pages have the most critical issues?'
      ];

      let analysisReport = '# AI RAG Analysis Report\n\n';
      analysisReport += `**Session ID**: ${sessionId}\n`;
      analysisReport += `**Analysis Date**: ${new Date().toISOString()}\n`;
      analysisReport += `**Pages Analyzed**: ${pageResults.length}\n\n`;

      // Run analysis queries
      for (const query of analysisQueries) {
        try {
          const result = await this.ragService.query(query);
          analysisReport += `## ${query}\n\n`;
          analysisReport += `${result.answer}\n\n`;
          
          if (result.sources.length > 0) {
            analysisReport += '**Sources:**\n';
            result.sources.forEach((source, index) => {
              analysisReport += `${index + 1}. ${source}\n`;
            });
            analysisReport += '\n';
          }
        } catch (queryError) {
          console.log(chalk.yellow(`⚠️  Query failed: ${query}`));
          analysisReport += `## ${query}\n\n*Analysis unavailable*\n\n`;
        }
      }

      // Get index statistics
      const indexStats = await this.ragService.getIndexStats();
      analysisReport += '## Index Statistics\n\n';
      analysisReport += `- **Total Documents**: ${indexStats.totalDocuments}\n`;
      analysisReport += `- **Total Chunks**: ${indexStats.totalChunks}\n`;
      analysisReport += `- **Last Updated**: ${indexStats.lastUpdated}\n\n`;

      // Save analysis report
      const outputPath = this.sessionManager.getSessionFilePath(sessionId, 'ai-rag-analysis.md');
      await this.sessionManager.writeFile(outputPath, analysisReport);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      console.log(chalk.green('✅ RAG analysis completed'));
      return testResult;

    } catch (error) {
      console.error(chalk.red(`❌ RAG analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.endTime = new Date();
      return testResult;
    }
  }

  /**
   * Run AI Vision analysis on screenshots
   * Analyzes screenshots for UI elements, accessibility, and visual issues
   */
  async runVisionAnalysis(pageUrl: string, sessionId: string): Promise<TestResult> {
    const startTime = new Date();
    const testResult: TestResult = {
      testType: 'ai-vision-analysis',
      status: 'pending',
      startTime,
      outputType: 'per-page'
    };

    try {
      if (!this.visionService || !this.availableServices.has('vision')) {
        throw new Error('Vision Service not available');
      }

      console.log(chalk.gray(`🤖 Running vision analysis for ${new URL(pageUrl).pathname}...`));

      // Use vision service to analyze screenshots
      const result = await this.visionService.runVisionAnalysis(pageUrl, sessionId);

      return result;

    } catch (error) {
      console.error(chalk.red(`❌ Vision analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.endTime = new Date();
      return testResult;
    }
  }

  /**
   * Generate comprehensive AI insights combining RAG and Vision analysis
   * Creates executive summary and recommendations
   */
  async generateAIInsights(sessionId: string, pageResults: PageResult[]): Promise<TestResult> {
    const startTime = new Date();
    const testResult: TestResult = {
      testType: 'ai-insights-generation',
      status: 'pending',
      startTime,
      outputType: 'site-wide'
    };

    try {
      console.log(chalk.gray('🤖 Generating AI insights...'));

      let insightsReport = '# AI-Powered Website Analysis Summary\n\n';
      insightsReport += `**Session ID**: ${sessionId}\n`;
      insightsReport += `**Analysis Date**: ${new Date().toISOString()}\n`;
      insightsReport += `**Pages Analyzed**: ${pageResults.length}\n\n`;

      // Executive Summary
      insightsReport += '## 🎯 Executive Summary\n\n';
      
      if (this.ragService && this.availableServices.has('rag')) {
        try {
          const summaryQuery = 'Provide an executive summary of the main issues and opportunities found in this website analysis';
          const summaryResult = await this.ragService.query(summaryQuery);
          insightsReport += summaryResult.answer + '\n\n';
        } catch (error) {
          insightsReport += '*Executive summary generation unavailable*\n\n';
        }
      }

      // Priority Recommendations
      insightsReport += '## 🚀 Priority Recommendations\n\n';
      
      if (this.ragService && this.availableServices.has('rag')) {
        try {
          const recommendationsQuery = 'What are the top 5 priority recommendations for improving this website, ranked by impact?';
          const recommendationsResult = await this.ragService.query(recommendationsQuery);
          insightsReport += recommendationsResult.answer + '\n\n';
        } catch (error) {
          insightsReport += '*Priority recommendations generation unavailable*\n\n';
        }
      }

      // Technical Analysis Summary
      insightsReport += '## 🔧 Technical Analysis Summary\n\n';
      
      const totalTests = pageResults.reduce((sum, page) => sum + page.tests.length, 0);
      const successfulTests = pageResults.reduce((sum, page) => 
        sum + page.tests.filter(test => test.status === 'success').length, 0);
      const failedTests = totalTests - successfulTests;

      insightsReport += `- **Total Tests Run**: ${totalTests}\n`;
      insightsReport += `- **Successful Tests**: ${successfulTests}\n`;
      insightsReport += `- **Failed Tests**: ${failedTests}\n`;
      insightsReport += `- **Success Rate**: ${((successfulTests / totalTests) * 100).toFixed(1)}%\n\n`;

      // Available Services Summary
      insightsReport += '## 🤖 AI Analysis Capabilities\n\n';
      insightsReport += `**Active AI Services**: ${Array.from(this.availableServices).join(', ')}\n\n`;
      
      if (this.availableServices.has('rag')) {
        insightsReport += '✅ **RAG Analysis**: Semantic search and intelligent insights available\n';
      }
      if (this.availableServices.has('vision')) {
        insightsReport += '✅ **Vision Analysis**: Screenshot analysis and visual insights available\n';
      }
      if (this.availableServices.has('chatbot')) {
        insightsReport += '✅ **Interactive Chat**: Ask questions about your results using `npm run chat`\n';
      }
      insightsReport += '\n';

      // Usage Instructions
      insightsReport += '## 💬 Interactive Analysis\n\n';
      insightsReport += 'To explore your results interactively:\n\n';
      insightsReport += '```bash\n';
      insightsReport += 'npm run build\n';
      insightsReport += 'node dist/cli.js chat\n';
      insightsReport += '```\n\n';
      insightsReport += 'Ask questions like:\n';
      insightsReport += '- "What are the main accessibility issues?"\n';
      insightsReport += '- "How can I improve my SEO scores?"\n';
      insightsReport += '- "Which pages need the most attention?"\n';
      insightsReport += '- "Give me code examples to fix these issues"\n\n';

      // Save insights report
      const outputPath = this.sessionManager.getSessionFilePath(sessionId, 'ai-insights-summary.md');
      await this.sessionManager.writeFile(outputPath, insightsReport);

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      console.log(chalk.green('✅ AI insights generated'));
      return testResult;

    } catch (error) {
      console.error(chalk.red(`❌ AI insights generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
      testResult.endTime = new Date();
      return testResult;
    }
  }

  /**
   * Check if AI services are available and ready
   */
  isAvailable(): boolean {
    return this.isInitialized && this.availableServices.size > 0;
  }

  /**
   * Get available AI service capabilities
   */
  getAvailableServices(): string[] {
    return Array.from(this.availableServices);
  }

  /**
   * Start an interactive chat session
   */
  async startChatSession(sessionId?: string): Promise<void> {
    if (!this.chatbotService || !this.availableServices.has('chatbot')) {
      console.error(chalk.red('❌ Chatbot service not available'));
      return;
    }

    await this.chatbotService.startChatSession(sessionId);
  }

  /**
   * Cleanup AI services
   */
  async cleanup(): Promise<void> {
    console.log(chalk.blue('🤖 Cleaning up AI services...'));

    if (this.ragService) {
      // RAG service cleanup if needed
    }

    if (this.visionService) {
      // Vision service cleanup if needed
    }

    if (this.chatbotService) {
      await this.chatbotService.endSession();
    }

    console.log(chalk.green('✅ AI services cleanup completed'));
  }
}