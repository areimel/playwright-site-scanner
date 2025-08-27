# AI Chatbot Service

This directory contains the AI chatbot implementation for the Playwright Site Scanner, enabling interactive conversations about your test results using Google Gemini AI with RAG (Retrieval Augmented Generation) capabilities.

## Overview

The AI Chatbot service provides:
- **Interactive conversations** about your test results through CLI chat interface
- **Context-aware responses** using RAG system to analyze your specific test data
- **Natural language queries** (e.g., "What SEO issues should I fix first?")
- **Session management** with conversation history and context switching
- **Smart recommendations** with actionable insights and follow-up questions

## Files

- **`chatbot-service.ts`** - Main chatbot service with Google Gemini integration and RAG capabilities
- **`rag-system.ts`** - RAG (Retrieval Augmented Generation) system for context-aware responses
- **`README.md`** - This documentation file

## CLI Usage

The chatbot is available through the CLI with the `chat` command:

```bash
# Start interactive AI chat
npm run dev
# or
node dist/cli.js chat

# Get help
node dist/cli.js chat --help
```

## Quick Start

### 1. Set up Google AI API Key

```bash
# Option 1: Environment Variable (Recommended)
export GOOGLE_API_KEY="your_api_key_here"

# Option 2: Windows Command Prompt
set GOOGLE_API_KEY=your_api_key_here

# Option 3: Windows PowerShell
$env:GOOGLE_API_KEY="your_api_key_here"
```

Get your API key from: https://makersuite.google.com/app/apikey

### 2. Run Tests First (Optional)

```bash
# Run website tests to generate data for chat context
node dist/cli.js start
# or
node dist/cli.js scan https://example.com
```

### 3. Start AI Chat

```bash
# Start interactive chat session
node dist/cli.js chat
```

The chat interface will guide you through:
- Choosing general chat or loading specific test session data
- Interactive conversation with context-aware responses
- Follow-up questions and recommendations
- Command help and session management

## Features

### Interactive Chat Interface
- **CLI Integration**: Seamless integration with existing CLI commands
- **Menu-driven Navigation**: Easy-to-use interface with inquirer.js prompts
- **Session Selection**: Load and discuss specific test sessions
- **Context Switching**: Switch between different pages or test sessions during chat
- **Command Support**: Built-in commands like `/help`, `/history`, `/exit`

### AI-Powered Conversations
- **Google Gemini Integration**: Uses Gemini Pro for intelligent responses
- **Context-aware Responses**: RAG system provides relevant information from test results
- **Natural Language Processing**: Understands various ways of asking about test data
- **Follow-up Questions**: AI generates relevant follow-up questions
- **Analysis Types**: Detects and responds with technical, recommendation, explanation, or brainstorming content

### Smart Context Management
- **Test Data Integration**: Automatically loads test results for context
- **Session Management**: Manages conversation history and state
- **Real-time Context**: Updates context as conversation progresses
- **Multi-page Analysis**: Can focus on specific pages or analyze entire sites

## API Reference

### ChatbotService

#### Methods

##### `startChatSession(sessionId?: string): Promise<string>`
Start a new chat session, optionally with test result context.
- **sessionId**: Optional session ID to load test data for context
- **Returns**: Unique chat session ID

##### `sendMessage(message: string): Promise<AIResponse>`
Send a message to the AI and get a response.
- **message**: User message/question
- **Returns**: AI response with content, suggestions, and analysis type

##### `setContext(context: ChatContext): void`
Update the current conversation context.
- **context**: New context information (session, page, test data)

##### `getConversationHistory(): ChatMessage[]`
Get the conversation history (excluding system messages).
- **Returns**: Array of user and assistant messages

##### `endSession(): Promise<void>`
End the current chat session and save conversation history.

##### `getAvailableSessions(): Promise<string[]>`
Get list of available test sessions for context loading.
- **Returns**: Array of session IDs sorted by date (newest first)

### Response Types

#### AIResponse
Response from the chatbot with additional metadata:

```typescript
interface AIResponse {
  content: string;                    // Main AI response
  suggestions?: string[];             // Action suggestions (max 3)
  relatedQuestions?: string[];        // Follow-up questions (max 2)
  analysisType: 'technical' | 'recommendation' | 'explanation' | 'brainstorming';
}
```

#### ChatMessage
Individual message in conversation history:

```typescript
interface ChatMessage {
  id: string;              // Unique message ID
  role: 'user' | 'assistant' | 'system';
  content: string;         // Message content
  timestamp: Date;         // When message was sent
  context?: ChatContext;   // Associated context
}
```

#### ChatContext
Context information for the conversation:

```typescript
interface ChatContext {
  sessionId?: string;       // Test session being discussed
  pageUrl?: string;         // Specific page focus
  pageName?: string;        // Page identifier
  testType?: string;        // Specific test type focus
  availableData?: TestResultData;  // Available test data
}
```

## Usage Examples

### CLI Chat Interface

```bash
$ node dist/cli.js chat

🤖 AI Assistant for Website Analysis

Ask me anything about your test results, website optimization, 
or web development best practices!

? How would you like to start?
  📊 Chat about test results - Load test session data and discuss results
  💬 Start general chat (no test context) - Chat about web development, SEO, accessibility, etc.
❯ ❓ Help & Commands
  🚪 Exit

# Select a test session
📊 Available Test Sessions:

? Select a test session to analyze:
❯ 08-27-2025_14-32 - 8/27/2025, 2:32:00 PM
  08-26-2025_09-15 - 8/26/2025, 9:15:00 AM
  ← Back to main menu

# Chat with context
🚀 Starting AI chat with test session: 08-27-2025_14-32

🔍 Loading test results from session: 08-27-2025_14-32
✅ Successfully loaded test data from session 08-27-2025_14-32
✅ Chat session ready! You can now ask questions about your test results.

💡 Suggested questions to get started:
  • "What are the main SEO issues I should fix?"
  • "How can I improve my site's accessibility?"
  • "What performance optimizations would you recommend?"
  • "Show me the pages with the most issues"
  • "Help me prioritize my improvements"

You: What are the main SEO issues I should fix?

🤖 AI: Based on your test results, I've identified several critical SEO issues 
that need immediate attention:

**High Priority Issues:**
1. **Missing Meta Descriptions** - 3 out of 5 pages lack meta descriptions
2. **Title Tag Problems** - 2 pages have titles that are too long (>60 characters)
3. **Image Alt Text** - 15 images are missing alt attributes across the site

**Medium Priority Issues:**
1. **Heading Structure** - Multiple H1 tags found on 2 pages
2. **Internal Linking** - Some pages have no internal links pointing to them

💡 Suggestions:
   1. Start with meta descriptions as they directly impact click-through rates
   2. Optimize title tags to 30-60 characters for better search visibility
   3. Add alt text to images for both SEO and accessibility benefits

❓ Related questions:
   1. Which specific pages are missing meta descriptions?
   2. How do I write effective meta descriptions?

? What would you like to do?
❯ 💬 Continue conversation
  🔄 Switch context/page
  📜 Show conversation history
  ❓ Show help
  🚪 End chat session
```

### Example Conversation Flow

```
You: How can I improve my site's accessibility?

🤖 AI: Based on your accessibility test results, here are the key areas 
to focus on:

**Critical Issues (Need Immediate Fix):**
- **Color Contrast**: 8 elements fail WCAG AA contrast requirements
- **Missing ARIA Labels**: 5 interactive elements lack proper labeling
- **Keyboard Navigation**: 3 pages have keyboard trap issues

**Recommended Actions:**
1. **Increase Color Contrast**: Update text/background color combinations
2. **Add ARIA Labels**: Provide descriptive labels for buttons and form controls
3. **Fix Keyboard Navigation**: Ensure all interactive elements are keyboard accessible

Would you like me to explain how to fix any of these specific issues?

You: Yes, explain how to fix color contrast issues

🤖 AI: Here's how to resolve color contrast issues:

**Understanding the Requirements:**
- WCAG AA requires a contrast ratio of at least 4.5:1 for normal text
- Large text (18pt+ or 14pt+ bold) needs at least 3:1
- WCAG AAA requires 7:1 for normal text (recommended for better accessibility)

**Step-by-step Fix Process:**

1. **Identify Problem Areas**:
   - Text on colored backgrounds
   - Button text and button backgrounds
   - Link colors on various backgrounds

2. **Use Contrast Checking Tools**:
   - Online: WebAIM Contrast Checker
   - Browser extensions: WAVE, aXe DevTools
   - Design tools: Built-in contrast checkers in Figma/Sketch

3. **Common Solutions**:
   - **Dark text on light backgrounds**: Use #333333 or darker on white
   - **Light text on dark backgrounds**: Use #ffffff or very light colors
   - **Colored text**: Ensure sufficient darkness/lightness difference

4. **CSS Implementation**:
   ```css
   /* Before: Poor contrast */
   .button {
     background: #ffcc00;  /* Light yellow */
     color: #ffffff;       /* White text - fails contrast */
   }
   
   /* After: Good contrast */
   .button {
     background: #b8860b;  /* Darker yellow */
     color: #ffffff;       /* White text - passes contrast */
   }
   ```

💡 Suggestions:
   1. Create a color palette that meets contrast requirements from the start
   2. Test contrast during design phase, not just after development
   3. Consider users with visual impairments in all design decisions

❓ Related questions:
   1. What tools can I use to test contrast automatically?
   2. How do I handle brand colors that don't meet contrast requirements?

You: /help

❓ AI Chat Help

Available Commands:
  /help     - Show this help message
  /history  - Show conversation history
  /context  - Switch context or focus
  /clear    - Clear the screen
  /exit     - End chat session

Chat Tips:
  • Ask specific questions about your test results
  • Request explanations for technical terms
  • Ask for step-by-step improvement guides
  • Use "Ctrl+C" to exit at any time

Example Questions:
  • "What SEO issues should I prioritize?"
  • "How do I fix accessibility violations?"
  • "Explain the performance impact of large images"
  • "What are best practices for meta descriptions?"
```

### Programmatic Usage

```typescript
import { ChatbotService } from './lib/ai/chatbot-service.js';

const chatbot = new ChatbotService();

// Start session with test data context
const sessionId = await chatbot.startChatSession('08-27-2025_14-32');

// Send messages and get responses
const response1 = await chatbot.sendMessage("What are the main SEO issues?");
console.log(response1.content);
console.log('Suggestions:', response1.suggestions);

const response2 = await chatbot.sendMessage("How do I fix the title tag issues?");
console.log(response2.content);

// Get conversation history
const history = chatbot.getConversationHistory();
console.log(`Conversation has ${history.length} messages`);

// End session
await chatbot.endSession();
```

## Query Examples

Here are example queries you can use with your test results:

### SEO Analysis
- "What SEO issues were found across all pages?"
- "Which pages are missing meta descriptions?"
- "What are the heading structure problems?"
- "Are there any duplicate title tags?"

### Accessibility Analysis
- "What accessibility violations need attention?"
- "Which pages have color contrast issues?"
- "Are there missing alt attributes on images?"
- "What ARIA label problems were found?"

### Content Analysis
- "What is the main content focus of each page?"
- "Which pages have the most/least content?"
- "What are the key topics covered on the site?"
- "Are there any broken internal links?"

### General Site Analysis
- "What are the most critical issues to fix first?"
- "Which pages perform best/worst overall?"
- "What patterns do you see across all test results?"
- "What would you recommend to improve this website?"

## Configuration

### Google AI Configuration

The service uses Google AI for both text generation (Gemini) and embeddings:

```typescript
// Default configuration
{
  model: 'gemini-1.5-pro-latest',
  embedModel: 'text-embedding-004',
  maxTokens: 1000,
  temperature: 0.1  // Low temperature for factual responses
}
```

### Index Configuration

```typescript
// Chunking settings
chunkSize: 1000,      // Characters per chunk
chunkOverlap: 200,    // Overlap between chunks

// Storage location
indexPath: 'rag-index/vector-index.json'
```

## Performance Considerations

### Indexing Performance
- **Batch Processing**: Indexes documents in batches of 5 to avoid rate limits
- **Rate Limiting**: 1-second delays between batches
- **Chunk Strategy**: Optimizes chunk size for retrieval vs. storage efficiency
- **Filtering**: Indexes only successful test results to avoid noise

### Query Performance
- **Vector Search**: Uses cosine similarity for fast semantic matching
- **Result Limiting**: Limits to top 10 most relevant documents
- **Caching**: Index is loaded once and kept in memory
- **Confidence Thresholds**: Filters low-relevance results

### Storage Usage
- **Compression**: Efficient JSON storage with minimal overhead
- **Incremental**: Add new sessions without re-indexing existing data
- **Cleanup**: Clear old indices when no longer needed

## Error Handling

The RAG service includes comprehensive error handling:

### Configuration Errors
- Missing API key detection with setup instructions
- Invalid key format validation
- Network connectivity issues

### Indexing Errors
- Graceful handling of unreadable files
- Skip corrupt or invalid test results
- Continue processing on individual document failures

### Query Errors
- Embedding generation fallbacks
- Empty result handling
- API rate limit recovery

### Example Error Recovery

```typescript
try {
  const result = await ragService.query("What issues were found?");
  console.log(result.answer);
} catch (error) {
  if (error.message.includes('API key')) {
    console.log('Please configure your Google AI API key');
  } else if (error.message.includes('No documents')) {
    console.log('Run some tests first to generate data');
  } else {
    console.log('Query failed, please try again');
  }
}
```

## Integration Patterns

### With Test Orchestrator
See `rag-integration-example.ts` for detailed integration code showing how to:
- Add RAG service to the orchestrator
- Index results after test completion  
- Provide query interface to users
- Handle configuration and errors gracefully

### With HTML Reporter
```typescript
// Add RAG query capability to HTML reports
const ragQuery = `
<div class="rag-query">
  <input type="text" placeholder="Ask about these test results...">
  <button onclick="queryRAG()">Ask AI</button>
</div>
`;
```

### CLI Integration
```typescript
// Add interactive RAG queries to your CLI
import inquirer from 'inquirer';

async function interactiveRAGSession() {
  while (true) {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Ask about your test results (or "exit"):',
    }]);
    
    if (query === 'exit') break;
    
    const result = await ragService.query(query);
    console.log(result.answer);
  }
}
```

## Best Practices

### API Key Security
- Use environment variables, never hardcode keys
- Rotate keys periodically
- Monitor API usage for anomalies
- Use separate keys for development and production

### Query Optimization
- Be specific in your questions for better results
- Use context filters to narrow down results
- Check confidence scores to validate answers
- Try rephrasing if results aren't satisfactory

### Index Management
- Clear old indices periodically to save disk space
- Re-index after major test framework changes
- Monitor index size and performance
- Back up indices for important sessions

### Integration Tips
- Make RAG features optional (graceful degradation)
- Provide clear error messages for missing configuration
- Don't let RAG failures break main test workflows
- Consider adding RAG status to your UI/reports

## Troubleshooting

### Common Issues

**"Google AI API key not configured"**
- Set `GOOGLE_AI_API_KEY` environment variable
- Check the key format (should start with "AIza")
- Verify the key is active in Google AI Studio

**"No relevant documents found"**
- Run some tests first to generate indexed data
- Check that tests completed successfully
- Verify the query matches your test types

**"Embedding generation failed"**
- Check internet connectivity
- Verify API key has embedding model access
- Try a shorter query (max 8000 characters)

**"Index file corrupt"**
- Delete the `rag-index` directory to start fresh
- Re-run your tests and re-index
- Check disk space and permissions

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
export DEBUG=rag-service
```

This will show detailed information about:
- Document processing
- Embedding generation
- Query processing
- Vector similarity scores

## Contributing

When extending the RAG service:

1. **Follow TypeScript patterns** from existing codebase
2. **Add proper error handling** for all async operations
3. **Update type definitions** in `../../types/index.ts`
4. **Include tests** for new functionality
5. **Update documentation** for new features
6. **Consider backwards compatibility** when changing APIs

## Future Enhancements

Potential improvements for future versions:

- **Multiple AI Providers**: Support for OpenAI, Anthropic, etc.
- **Advanced Filtering**: More sophisticated context matching
- **Real-time Indexing**: Index results as tests complete
- **Query History**: Save and replay previous queries
- **Custom Prompts**: User-configurable system prompts
- **Export Features**: Export query results to different formats
- **Performance Analytics**: Track query performance and usage

---

For questions or issues with the RAG service, check the troubleshooting section above or refer to the integration examples.