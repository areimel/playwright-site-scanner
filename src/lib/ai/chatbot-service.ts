import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { 
  ChatMessage, 
  ChatContext, 
  ChatSession, 
  AIResponse, 
  TestResultData,
  SessionSummary,
  PageResult,
  TestResult
} from '../../types/index.js';
import { SessionManager } from '../../utils/session-manager.js';
import { RAGSystem } from './rag-system.js';

export class ChatbotService {
  private sessionManager: SessionManager;
  private currentSession?: ChatSession;
  private geminiModel: any;
  private readonly maxContextLength = 100000; // Gemini Pro context limit
  private readonly ragDataCache: Map<string, TestResultData> = new Map();

  constructor() {
    this.sessionManager = new SessionManager();
    this.initializeModel();
  }

  private initializeModel() {
    // Initialize Google Gemini model
    this.geminiModel = google('gemini-pro');
  }

  /**
   * Start a new chat session with context loading
   */
  async startChatSession(sessionId?: string): Promise<string> {
    const chatSessionId = `chat-${Date.now()}`;
    
    this.currentSession = {
      id: chatSessionId,
      startTime: new Date(),
      messages: [],
      totalMessages: 0
    };

    // Load context from session if provided
    if (sessionId) {
      console.log(chalk.blue(`🔍 Loading test results from session: ${sessionId}`));
      const testData = await this.loadSessionData(sessionId);
      
      if (testData) {
        this.ragDataCache.set(chatSessionId, testData);
        this.currentSession.currentContext = {
          sessionId,
          availableData: testData
        };
        
        // Add system message with context
        await this.addSystemMessage(this.generateSystemPrompt(testData));
        console.log(chalk.green(`✅ Successfully loaded test data from session ${sessionId}`));
      } else {
        console.log(chalk.yellow(`⚠️ No test data found for session ${sessionId}, starting without context`));
      }
    } else {
      // Add general system message
      await this.addSystemMessage(this.generateGeneralSystemPrompt());
    }

    console.log(chalk.green(`🤖 AI Chat session started: ${chatSessionId}`));
    return chatSessionId;
  }

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(message: string): Promise<AIResponse> {
    if (!this.currentSession) {
      throw new Error('No active chat session. Call startChatSession() first.');
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      context: this.currentSession.currentContext
    };

    this.currentSession.messages.push(userMessage);
    this.currentSession.totalMessages++;

    try {
      console.log(chalk.gray('🤔 AI is thinking...'));
      
      const response = await this.generateAIResponse(message);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        context: this.currentSession.currentContext
      };

      this.currentSession.messages.push(assistantMessage);
      this.currentSession.totalMessages++;

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`❌ AI response failed: ${errorMessage}`));
      
      return {
        content: `I apologize, but I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question or check your API configuration.`,
        analysisType: 'technical'
      };
    }
  }

  /**
   * Set or update the current context
   */
  setContext(context: ChatContext): void {
    if (!this.currentSession) {
      throw new Error('No active chat session');
    }

    this.currentSession.currentContext = { ...this.currentSession.currentContext, ...context };
    console.log(chalk.blue(`📝 Context updated: ${context.pageUrl || context.sessionId || 'General context'}`));
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return this.currentSession?.messages.filter(m => m.role !== 'system') || [];
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.endTime = new Date();
    
    // Optionally save conversation history
    if (this.currentSession.totalMessages > 1) {
      await this.saveConversationHistory();
    }

    console.log(chalk.green(`📊 Chat session ended. Total messages: ${this.currentSession.totalMessages}`));
    this.currentSession = undefined;
  }

  /**
   * Switch context to a specific page
   */
  async switchToPage(sessionId: string, pageUrl: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active chat session');
    }

    const testData = this.ragDataCache.get(this.currentSession.id);
    if (!testData?.pageResults) {
      console.log(chalk.yellow('⚠️ No page data available for context switching'));
      return;
    }

    const pageResult = testData.pageResults.find(p => p.url === pageUrl);
    if (!pageResult) {
      console.log(chalk.yellow(`⚠️ Page not found: ${pageUrl}`));
      return;
    }

    const pageName = this.sessionManager.getPageName(pageUrl);
    const pageContext: ChatContext = {
      sessionId,
      pageUrl,
      pageName,
      availableData: {
        ...testData,
        pageResults: [pageResult],
        testResults: pageResult.tests
      }
    };

    this.setContext(pageContext);
    
    // Add context switch message
    await this.addSystemMessage(
      `Context switched to page: ${pageUrl}\nPage has ${pageResult.tests.length} test results available for analysis.`
    );
    
    console.log(chalk.green(`🔄 Switched context to: ${pageUrl}`));
  }

  /**
   * Load session data for RAG context
   */
  private async loadSessionData(sessionId: string): Promise<TestResultData | null> {
    try {
      const sessionPath = this.sessionManager.getSessionDirectoryPath(sessionId);
      
      // Check if session exists
      try {
        await fs.access(sessionPath);
      } catch {
        return null;
      }

      const testData: TestResultData = {};

      // Load session summary
      const summaryPath = path.join(sessionPath, 'session-summary.md');
      try {
        testData.rawContent = await fs.readFile(summaryPath, 'utf8');
      } catch {
        // Session summary might not exist yet
      }

      // Load page results by scanning directories
      const entries = await fs.readdir(sessionPath, { withFileTypes: true });
      const pageDirectories = entries.filter(entry => entry.isDirectory());
      
      const pageResults: PageResult[] = [];
      
      for (const pageDir of pageDirectories) {
        const pagePath = path.join(sessionPath, pageDir.name);
        const pageResult = await this.loadPageData(sessionId, pageDir.name, pagePath);
        if (pageResult) {
          pageResults.push(pageResult);
        }
      }

      if (pageResults.length > 0) {
        testData.pageResults = pageResults;
        testData.testResults = pageResults.flatMap(p => p.tests);
      }

      return Object.keys(testData).length > 0 ? testData : null;
    } catch (error) {
      console.error(chalk.red(`Error loading session data: ${error}`));
      return null;
    }
  }

  /**
   * Load data for a specific page
   */
  private async loadPageData(sessionId: string, pageName: string, pagePath: string): Promise<PageResult | null> {
    try {
      const testResults: TestResult[] = [];
      
      // Scan for test result files
      const scansPath = path.join(pagePath, 'scans');
      const screenshotsPath = path.join(pagePath, 'screenshots');
      
      // Check scans directory
      try {
        const scanFiles = await fs.readdir(scansPath);
        for (const file of scanFiles) {
          if (file.endsWith('.md') || file.endsWith('.json')) {
            const testType = this.extractTestTypeFromFilename(file);
            testResults.push({
              testType,
              status: 'success',
              startTime: new Date(),
              endTime: new Date(),
              outputPath: path.join(scansPath, file)
            });
          }
        }
      } catch {
        // Scans directory might not exist
      }

      // Check screenshots directory
      try {
        const screenshotFiles = await fs.readdir(screenshotsPath);
        if (screenshotFiles.length > 0) {
          testResults.push({
            testType: 'screenshots',
            status: 'success',
            startTime: new Date(),
            endTime: new Date(),
            outputPath: screenshotsPath
          });
        }
      } catch {
        // Screenshots directory might not exist
      }

      if (testResults.length === 0) {
        return null;
      }

      // Reconstruct URL from page name (basic approximation)
      const url = `https://example.com/${pageName.replace(/-/g, '/')}`;

      return {
        url,
        pageName,
        tests: testResults,
        summary: `Page with ${testResults.length} completed tests`
      };
    } catch (error) {
      console.error(chalk.red(`Error loading page data for ${pageName}: ${error}`));
      return null;
    }
  }

  /**
   * Extract test type from filename
   */
  private extractTestTypeFromFilename(filename: string): string {
    if (filename.includes('seo')) return 'seo';
    if (filename.includes('accessibility')) return 'accessibility';
    if (filename.includes('content')) return 'content-scraping';
    if (filename.includes('api-key')) return 'api-key-scan';
    return 'unknown';
  }

  /**
   * Generate AI response using Gemini with RAG enhancement
   */
  private async generateAIResponse(userMessage: string): Promise<AIResponse> {
    const context = this.buildContextString();
    const conversationHistory = this.buildConversationHistory();
    
    // Use RAG system to get relevant context if test data is available
    let ragContext = '';
    const testData = this.currentSession?.currentContext?.availableData;
    if (testData) {
      ragContext = RAGSystem.extractRelevantContext(userMessage, testData);
    }
    
    const prompt = `${context}\n${ragContext}\n\nConversation History:\n${conversationHistory}\n\nUser: ${userMessage}\n\nAssistant:`;

    const result = await generateText({
      model: this.geminiModel,
      prompt: prompt,
      temperature: 0.7,
    });

    // Parse response and extract suggestions/questions if AI provides them
    const content = result.text;
    const suggestions = this.extractSuggestions(content);
    const relatedQuestions = this.extractRelatedQuestions(content);
    const analysisType = this.detectAnalysisType(userMessage, content);

    return {
      content: content.trim(),
      suggestions,
      relatedQuestions,
      analysisType
    };
  }

  /**
   * Build context string for AI prompt
   */
  private buildContextString(): string {
    if (!this.currentSession?.currentContext) {
      return "You are an AI assistant specializing in web development and website analysis.";
    }

    const context = this.currentSession.currentContext;
    let contextStr = "You are an AI assistant specializing in website analysis and testing. ";

    if (context.sessionId) {
      contextStr += `You have access to test results from session ${context.sessionId}. `;
    }

    if (context.pageUrl) {
      contextStr += `The current focus is on the page: ${context.pageUrl}. `;
    }

    if (context.availableData) {
      const data = context.availableData;
      if (data.pageResults && data.pageResults.length > 0) {
        contextStr += `Available data includes ${data.pageResults.length} page(s) with test results. `;
      }
      if (data.testResults && data.testResults.length > 0) {
        contextStr += `There are ${data.testResults.length} individual test results available for analysis. `;
      }
    }

    contextStr += "Use this context to provide specific, actionable advice about the test results.";
    return contextStr;
  }

  /**
   * Build conversation history for context
   */
  private buildConversationHistory(): string {
    if (!this.currentSession) return "";
    
    const history = this.currentSession.messages
      .filter(m => m.role !== 'system')
      .slice(-6) // Keep last 6 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    
    return history;
  }

  /**
   * Generate system prompt based on available data
   */
  private generateSystemPrompt(testData: TestResultData): string {
    let prompt = `You are an expert web development and website analysis AI assistant. You have access to comprehensive test results from a website analysis session.

Available Data:
`;

    if (testData.pageResults) {
      prompt += `- ${testData.pageResults.length} pages analyzed\n`;
      prompt += `- Test types: ${Array.from(new Set(testData.testResults?.map(t => t.testType) || [])).join(', ')}\n`;
    }

    prompt += `
Your role is to:
1. Analyze test results and provide actionable insights
2. Explain technical issues in user-friendly terms
3. Suggest specific improvements and best practices
4. Help brainstorm solutions to identified problems
5. Answer questions about SEO, accessibility, performance, and web development

When discussing test results:
- Be specific and reference actual findings
- Provide concrete, actionable recommendations
- Explain the impact of issues on user experience and SEO
- Suggest implementation steps where appropriate

You can discuss:
- SEO optimization strategies
- Accessibility improvements
- Code quality and best practices
- Performance optimizations
- User experience enhancements
- Technical implementation details`;

    return prompt;
  }

  /**
   * Generate general system prompt without specific data
   */
  private generateGeneralSystemPrompt(): string {
    return `You are an expert web development and website analysis AI assistant.

Your role is to help with:
1. Website analysis and testing guidance
2. SEO optimization strategies  
3. Accessibility improvements
4. Performance optimization
5. Code quality and best practices
6. User experience enhancements

You provide:
- Actionable, specific advice
- Technical explanations in user-friendly terms
- Implementation guidance and best practices
- Troubleshooting help for web development issues

You are knowledgeable about modern web technologies, testing tools, and industry standards.`;
  }

  /**
   * Add system message to conversation
   */
  private async addSystemMessage(content: string): Promise<void> {
    if (!this.currentSession) return;

    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date()
    };

    this.currentSession.messages.push(systemMessage);
  }

  /**
   * Extract suggestions from AI response
   */
  private extractSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const suggestion = line.trim().substring(2).trim();
        if (suggestion.length > 10 && suggestion.length < 100) {
          suggestions.push(suggestion);
        }
      }
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Extract related questions from AI response  
   */
  private extractRelatedQuestions(content: string): string[] {
    const questions: string[] = [];
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.endsWith('?') && trimmed.length > 20 && trimmed.length < 100) {
        questions.push(trimmed);
      }
    }
    
    return questions.slice(0, 2); // Return top 2 questions
  }

  /**
   * Detect analysis type from user message and response
   */
  private detectAnalysisType(userMessage: string, aiResponse: string): 'technical' | 'recommendation' | 'explanation' | 'brainstorming' {
    const lowerUser = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();
    
    if (lowerUser.includes('how') || lowerUser.includes('why') || lowerUser.includes('what') || 
        lowerUser.includes('explain')) {
      return 'explanation';
    }
    
    if (lowerUser.includes('improve') || lowerUser.includes('fix') || lowerUser.includes('should') ||
        lowerUser.includes('recommend') || lowerResponse.includes('suggest') || lowerResponse.includes('recommend')) {
      return 'recommendation';
    }
    
    if (lowerUser.includes('idea') || lowerUser.includes('think') || lowerUser.includes('consider') ||
        lowerUser.includes('brainstorm')) {
      return 'brainstorming';
    }
    
    return 'technical';
  }

  /**
   * Save conversation history to file
   */
  private async saveConversationHistory(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const conversationData = {
        sessionId: this.currentSession.id,
        startTime: this.currentSession.startTime,
        endTime: this.currentSession.endTime,
        totalMessages: this.currentSession.totalMessages,
        context: this.currentSession.currentContext,
        messages: this.currentSession.messages.filter(m => m.role !== 'system')
      };

      const filename = `chat-history-${this.currentSession.id}.json`;
      const outputPath = path.join('arda-site-scan-sessions', filename);
      
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(conversationData, null, 2), 'utf8');
      
      console.log(chalk.blue(`💾 Conversation history saved: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Failed to save conversation history: ${error}`));
    }
  }

  /**
   * Get available sessions for context loading
   */
  async getAvailableSessions(): Promise<string[]> {
    try {
      const sessionsPath = 'arda-site-scan-sessions';
      await fs.access(sessionsPath);
      
      const entries = await fs.readdir(sessionsPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && entry.name.match(/^\d{2}-\d{2}-\d{4}_\d{2}-\d{2}$/))
        .map(entry => entry.name)
        .sort()
        .reverse(); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Stream response for real-time chat experience (advanced feature)
   */
  async streamMessage(message: string, onChunk: (chunk: string) => void): Promise<AIResponse> {
    if (!this.currentSession) {
      throw new Error('No active chat session');
    }

    const context = this.buildContextString();
    const conversationHistory = this.buildConversationHistory();
    const prompt = `${context}\n\nConversation History:\n${conversationHistory}\n\nUser: ${message}\n\nAssistant:`;

    let fullResponse = '';

    const result = await streamText({
      model: this.geminiModel,
      prompt: prompt,
      temperature: 0.7,
    });

    for await (const delta of result.textStream) {
      fullResponse += delta;
      onChunk(delta);
    }

    // Add messages to history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      context: this.currentSession.currentContext
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
      context: this.currentSession.currentContext
    };

    this.currentSession.messages.push(userMessage, assistantMessage);
    this.currentSession.totalMessages += 2;

    return {
      content: fullResponse.trim(),
      analysisType: this.detectAnalysisType(message, fullResponse)
    };
  }
}