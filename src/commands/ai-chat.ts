import inquirer from 'inquirer';
import chalk from 'chalk';
import { ChatbotService } from '../lib/ai/chatbot-service.js';
import { ChatContext, AIResponse } from '../types/index.js';

interface ChatMenuChoice {
  name: string;
  value: string;
  description?: string;
}

export class AIChatCommand {
  private chatbot: ChatbotService;
  private isSessionActive: boolean = false;
  private currentSessionId?: string;

  constructor() {
    this.chatbot = new ChatbotService();
  }

  /**
   * Main entry point for AI chat command
   */
  async start(): Promise<void> {
    console.clear();
    console.log(chalk.blue('🤖 AI Assistant for Website Analysis\n'));
    console.log(chalk.gray('Ask me anything about your test results, website optimization, or web development best practices!\n'));

    try {
      await this.showMainMenu();
    } catch (error) {
      console.error(chalk.red(`❌ Chat session error: ${error}`));
    } finally {
      if (this.isSessionActive) {
        await this.chatbot.endSession();
      }
    }
  }

  /**
   * Display main menu for chat options
   */
  private async showMainMenu(): Promise<void> {
    const availableSessions = await this.chatbot.getAvailableSessions();
    
    const choices: ChatMenuChoice[] = [
      {
        name: '💬 Start general chat (no test context)',
        value: 'general',
        description: 'Chat about web development, SEO, accessibility, etc.'
      }
    ];

    if (availableSessions.length > 0) {
      choices.unshift({
        name: '📊 Chat about test results',
        value: 'test-results',
        description: 'Load test session data and discuss results'
      });
    }

    choices.push(
      { name: '❓ Help & Commands', value: 'help' },
      { name: '🚪 Exit', value: 'exit' }
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to start?',
        choices: choices.map(choice => ({
          name: choice.description 
            ? `${choice.name} - ${chalk.gray(choice.description)}`
            : choice.name,
          value: choice.value
        }))
      }
    ]);

    switch (action) {
      case 'test-results':
        await this.selectTestSession(availableSessions);
        break;
      case 'general':
        await this.startGeneralChat();
        break;
      case 'help':
        await this.showHelp();
        break;
      case 'exit':
        console.log(chalk.yellow('👋 Goodbye!'));
        return;
      default:
        await this.showMainMenu();
    }
  }

  /**
   * Let user select from available test sessions
   */
  private async selectTestSession(availableSessions: string[]): Promise<void> {
    console.log(chalk.blue('\n📊 Available Test Sessions:\n'));

    const sessionChoices = availableSessions.map(sessionId => {
      const date = this.formatSessionDate(sessionId);
      return {
        name: `${sessionId} - ${chalk.gray(date)}`,
        value: sessionId
      };
    });

    sessionChoices.push({
      name: chalk.gray('← Back to main menu'),
      value: 'back'
    });

    const { selectedSession } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSession',
        message: 'Select a test session to analyze:',
        choices: sessionChoices,
        pageSize: 15
      }
    ]);

    if (selectedSession === 'back') {
      await this.showMainMenu();
      return;
    }

    await this.startChatWithContext(selectedSession);
  }

  /**
   * Start chat session with test result context
   */
  private async startChatWithContext(sessionId: string): Promise<void> {
    console.log(chalk.blue(`\n🚀 Starting AI chat with test session: ${sessionId}\n`));
    
    try {
      this.currentSessionId = await this.chatbot.startChatSession(sessionId);
      this.isSessionActive = true;
      
      console.log(chalk.green('✅ Chat session ready! You can now ask questions about your test results.\n'));
      
      // Show suggested questions
      console.log(chalk.blue('💡 Suggested questions to get started:'));
      console.log(chalk.gray('  • "What are the main SEO issues I should fix?"'));
      console.log(chalk.gray('  • "How can I improve my site\'s accessibility?"'));
      console.log(chalk.gray('  • "What performance optimizations would you recommend?"'));
      console.log(chalk.gray('  • "Show me the pages with the most issues"'));
      console.log(chalk.gray('  • "Help me prioritize my improvements"\n'));

      await this.startChatLoop();
    } catch (error) {
      console.error(chalk.red(`Failed to start chat session: ${error}`));
      await this.showMainMenu();
    }
  }

  /**
   * Start general chat without specific context
   */
  private async startGeneralChat(): Promise<void> {
    console.log(chalk.blue('\n🚀 Starting general AI chat session\n'));
    
    try {
      this.currentSessionId = await this.chatbot.startChatSession();
      this.isSessionActive = true;
      
      console.log(chalk.green('✅ Chat session ready! Ask me anything about web development and optimization.\n'));
      
      // Show suggested topics
      console.log(chalk.blue('💡 Topics I can help with:'));
      console.log(chalk.gray('  • SEO optimization strategies'));
      console.log(chalk.gray('  • Accessibility best practices'));
      console.log(chalk.gray('  • Website performance tips'));
      console.log(chalk.gray('  • Modern web development practices'));
      console.log(chalk.gray('  • Troubleshooting technical issues\n'));

      await this.startChatLoop();
    } catch (error) {
      console.error(chalk.red(`Failed to start general chat: ${error}`));
      await this.showMainMenu();
    }
  }

  /**
   * Main chat interaction loop
   */
  private async startChatLoop(): Promise<void> {
    while (this.isSessionActive) {
      try {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.cyan('You:'),
            validate: (input: string) => {
              const trimmed = input.trim();
              if (trimmed.length === 0) {
                return 'Please enter a message';
              }
              return true;
            }
          }
        ]);

        const trimmedMessage = message.trim();

        // Handle special commands
        if (await this.handleSpecialCommands(trimmedMessage)) {
          continue;
        }

        // Send message to AI
        console.log(); // Add spacing
        const response = await this.chatbot.sendMessage(trimmedMessage);
        this.displayAIResponse(response);
        
        // Show context menu after each response
        await this.showContextMenu();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'User force closed the prompt with ctrl+c') {
          console.log(chalk.yellow('\n👋 Chat session ended by user'));
          break;
        }
        console.error(chalk.red(`Error in chat loop: ${errorMessage}`));
        break;
      }
    }

    this.isSessionActive = false;
    if (this.currentSessionId) {
      await this.chatbot.endSession();
    }
  }

  /**
   * Handle special commands like /help, /exit, etc.
   */
  private async handleSpecialCommands(message: string): Promise<boolean> {
    if (message.startsWith('/')) {
      const command = message.substring(1).toLowerCase();
      
      switch (command) {
        case 'help':
          this.showChatHelp();
          return true;
        case 'exit':
        case 'quit':
          this.isSessionActive = false;
          return true;
        case 'history':
          this.showConversationHistory();
          return true;
        case 'context':
          await this.showContextSwitchMenu();
          return true;
        case 'clear':
          console.clear();
          console.log(chalk.blue('🤖 AI Assistant - Chat Cleared\n'));
          return true;
        default:
          console.log(chalk.yellow(`Unknown command: ${command}. Type /help for available commands.`));
          return true;
      }
    }
    
    return false;
  }

  /**
   * Display AI response with formatting
   */
  private displayAIResponse(response: AIResponse): void {
    console.log(chalk.green('🤖 AI:'));
    console.log(chalk.white(response.content));
    
    if (response.suggestions && response.suggestions.length > 0) {
      console.log(chalk.blue('\n💡 Suggestions:'));
      response.suggestions.forEach((suggestion, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${suggestion}`));
      });
    }
    
    if (response.relatedQuestions && response.relatedQuestions.length > 0) {
      console.log(chalk.blue('\n❓ Related questions:'));
      response.relatedQuestions.forEach((question, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${question}`));
      });
    }
    
    console.log(); // Add spacing
  }

  /**
   * Show context menu after each AI response
   */
  private async showContextMenu(): Promise<void> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '💬 Continue conversation', value: 'continue' },
          { name: '🔄 Switch context/page', value: 'switch-context' },
          { name: '📜 Show conversation history', value: 'history' },
          { name: '❓ Show help', value: 'help' },
          { name: '🚪 End chat session', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'continue':
        // Do nothing, continue the loop
        break;
      case 'switch-context':
        await this.showContextSwitchMenu();
        break;
      case 'history':
        this.showConversationHistory();
        break;
      case 'help':
        this.showChatHelp();
        break;
      case 'exit':
        this.isSessionActive = false;
        break;
    }
  }

  /**
   * Show context switching menu
   */
  private async showContextSwitchMenu(): Promise<void> {
    console.log(chalk.blue('\n🔄 Context Switching Options:\n'));
    
    const { contextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'contextAction',
        message: 'Choose context option:',
        choices: [
          { name: '📊 Switch to different session', value: 'switch-session' },
          { name: '📄 Focus on specific page', value: 'switch-page' },
          { name: '🌐 Return to general context', value: 'general' },
          { name: '← Cancel', value: 'cancel' }
        ]
      }
    ]);

    switch (contextAction) {
      case 'switch-session':
        const sessions = await this.chatbot.getAvailableSessions();
        if (sessions.length > 0) {
          await this.selectTestSession(sessions);
        } else {
          console.log(chalk.yellow('No test sessions available'));
        }
        break;
      case 'switch-page':
        console.log(chalk.yellow('Page switching not yet implemented')); // TODO: Implement
        break;
      case 'general':
        this.chatbot.setContext({});
        console.log(chalk.green('✅ Switched to general context'));
        break;
      case 'cancel':
        // Do nothing
        break;
    }
  }

  /**
   * Show conversation history
   */
  private showConversationHistory(): void {
    const history = this.chatbot.getConversationHistory();
    
    if (history.length === 0) {
      console.log(chalk.yellow('📜 No conversation history yet\n'));
      return;
    }

    console.log(chalk.blue('📜 Conversation History:\n'));
    console.log(chalk.cyan('='.repeat(50)));
    
    history.forEach((message, index) => {
      const timestamp = message.timestamp.toLocaleTimeString();
      const role = message.role === 'user' ? chalk.cyan('You') : chalk.green('AI');
      const content = message.content.length > 100 
        ? message.content.substring(0, 100) + '...'
        : message.content;
      
      console.log(`[${timestamp}] ${role}: ${content}`);
      
      if (index < history.length - 1) {
        console.log(chalk.gray('-'.repeat(30)));
      }
    });
    
    console.log(chalk.cyan('='.repeat(50)));
    console.log();
  }

  /**
   * Show help information for chat commands
   */
  private showChatHelp(): void {
    console.log(chalk.blue('\n❓ AI Chat Help\n'));
    console.log(chalk.cyan('Available Commands:'));
    console.log(chalk.gray('  /help     - Show this help message'));
    console.log(chalk.gray('  /history  - Show conversation history'));
    console.log(chalk.gray('  /context  - Switch context or focus'));
    console.log(chalk.gray('  /clear    - Clear the screen'));
    console.log(chalk.gray('  /exit     - End chat session'));
    
    console.log(chalk.cyan('\nChat Tips:'));
    console.log(chalk.gray('  • Ask specific questions about your test results'));
    console.log(chalk.gray('  • Request explanations for technical terms'));
    console.log(chalk.gray('  • Ask for step-by-step improvement guides'));
    console.log(chalk.gray('  • Use "Ctrl+C" to exit at any time'));
    
    console.log(chalk.cyan('\nExample Questions:'));
    console.log(chalk.gray('  • "What SEO issues should I prioritize?"'));
    console.log(chalk.gray('  • "How do I fix accessibility violations?"'));
    console.log(chalk.gray('  • "Explain the performance impact of large images"'));
    console.log(chalk.gray('  • "What are best practices for meta descriptions?"\n'));
  }

  /**
   * Show general help information
   */
  private async showHelp(): Promise<void> {
    console.log(chalk.blue('\n❓ AI Assistant Help\n'));
    
    console.log(chalk.cyan('What I can help with:'));
    console.log(chalk.white('• Analyze your website test results'));
    console.log(chalk.white('• Provide SEO optimization recommendations'));
    console.log(chalk.white('• Explain accessibility issues and fixes'));
    console.log(chalk.white('• Suggest performance improvements'));
    console.log(chalk.white('• Answer web development questions'));
    console.log(chalk.white('• Help prioritize website improvements'));
    
    console.log(chalk.cyan('\nFeatures:'));
    console.log(chalk.white('• Context-aware responses based on your test data'));
    console.log(chalk.white('• Interactive conversation with follow-up questions'));
    console.log(chalk.white('• Switch between different test sessions'));
    console.log(chalk.white('• Conversation history and suggestions'));
    
    console.log(chalk.cyan('\nRequirements:'));
    console.log(chalk.white('• GOOGLE_API_KEY environment variable set'));
    console.log(chalk.white('• Previous test sessions available (optional)'));
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to return to main menu...'
      }
    ]);
    
    await this.showMainMenu();
  }

  /**
   * Format session date for display
   */
  private formatSessionDate(sessionId: string): string {
    try {
      // Parse session ID format: MM-DD-YYYY_HH-MM
      const [datePart, timePart] = sessionId.split('_');
      const [month, day, year] = datePart.split('-');
      const [hour, minute] = timePart.split('-');
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      return date.toLocaleString();
    } catch {
      return 'Unknown date';
    }
  }

  /**
   * Check if API key is configured
   */
  static checkApiKeyConfiguration(): boolean {
    if (!process.env.GOOGLE_API_KEY) {
      console.log(chalk.red('\n❌ Google API Key not configured'));
      console.log(chalk.yellow('Please set the GOOGLE_API_KEY environment variable to use the AI chat feature.'));
      console.log(chalk.gray('\nExample:'));
      console.log(chalk.gray('  export GOOGLE_API_KEY="your-api-key-here"'));
      console.log(chalk.gray('  # or add to your .env file'));
      console.log(chalk.gray('\nGet your API key from: https://makersuite.google.com/app/apikey\n'));
      return false;
    }
    return true;
  }
}

/**
 * Main function to start AI chat
 */
export async function runAIChat(): Promise<void> {
  // Check API key configuration
  if (!AIChatCommand.checkApiKeyConfiguration()) {
    return;
  }

  const chatCommand = new AIChatCommand();
  await chatCommand.start();
}