import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { google } from '@ai-sdk/google';
import { embed, generateText } from 'ai';
import crypto from 'crypto';
import {
  RAGContext,
  RAGResult,
  RAGSource,
  IndexedDocument,
  DocumentMetadata,
  DocumentChunk,
  IndexStats,
  PageResult,
  TestResult,
  SessionSummary
} from '../../types/index.js';
import { SessionManager } from '../../utils/session-manager.js';

interface VectorIndex {
  documents: Map<string, IndexedDocument>;
  embeddings: Map<string, number[]>;
  metadata: {
    created: Date;
    lastUpdated: Date;
    totalDocuments: number;
    version: string;
  };
}

export class RAGService {
  private sessionManager: SessionManager;
  private vectorIndex: VectorIndex;
  private indexPath: string;
  private model: any;
  private embedModel: any;
  private chunkSize: number = 1000;
  private chunkOverlap: number = 200;
  private initialized: boolean = false;

  constructor() {
    this.sessionManager = new SessionManager();
    this.indexPath = path.join('rag-index', 'vector-index.json');
    this.vectorIndex = {
      documents: new Map(),
      embeddings: new Map(),
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        totalDocuments: 0,
        version: '1.0.0'
      }
    };
    
    this.loadIndex();
  }

  /**
   * Initialize the RAG service with proper API configuration
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check for Google AI API key in environment
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY environment variable not set');
      }
      
      // Set environment variable for AI SDK
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
      
      // Initialize Google AI models
      this.model = google('gemini-1.5-pro-latest');
      this.embedModel = google('text-embedding-004');
      
      this.initialized = true;
      console.log(chalk.gray('🤖 RAG service initialized with Google AI'));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`RAG initialization failed: ${errorMessage}\n\nPlease set GOOGLE_AI_API_KEY environment variable.`);
    }
  }

  /**
   * Index session results for RAG queries
   */
  async indexSessionResults(sessionId: string, results: PageResult[]): Promise<void> {
    await this.initialize();
    
    try {
      console.log(chalk.gray(`🧠 Indexing ${results.length} page results for RAG...`));
      
      const documents: IndexedDocument[] = [];
      
      for (const pageResult of results) {
        // Index each test result
        for (const testResult of pageResult.tests) {
          if (testResult.status === 'success' && testResult.outputPath) {
            const document = await this.createDocumentFromTestResult(
              pageResult,
              testResult,
              sessionId
            );
            if (document) {
              documents.push(document);
            }
          }
        }
      }

      // Process documents in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await this.indexDocumentBatch(batch);
        
        // Small delay between batches
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update index metadata
      this.vectorIndex.metadata.lastUpdated = new Date();
      this.vectorIndex.metadata.totalDocuments = this.vectorIndex.documents.size;
      
      await this.saveIndex();
      console.log(chalk.green(`✅ Successfully indexed ${documents.length} documents`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to index session results: ${error}`));
      throw error;
    }
  }

  /**
   * Query the RAG system with natural language
   */
  async query(query: string, context?: RAGContext): Promise<RAGResult> {
    await this.initialize();
    
    try {
      console.log(chalk.gray(`🔍 Processing RAG query: "${query}"`));
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Find relevant documents using semantic search
      const relevantSources = await this.findRelevantDocuments(
        queryEmbedding,
        context,
        10 // top 10 results
      );
      
      if (relevantSources.length === 0) {
        return {
          answer: "I don't have any relevant information in the indexed test results to answer your question. Please make sure you've run tests and indexed the results first.",
          confidence: 0,
          sources: [],
          query,
          timestamp: new Date()
        };
      }

      // Build context for the AI model
      const contextText = this.buildContextFromSources(relevantSources);
      
      // Generate response using Google Gemini
      const response = await this.generateAnswer(query, contextText);
      
      const result: RAGResult = {
        answer: response.answer,
        confidence: this.calculateConfidence(relevantSources, response.answer),
        sources: relevantSources,
        query,
        timestamp: new Date()
      };

      console.log(chalk.green(`✅ Generated RAG response (confidence: ${Math.round(result.confidence * 100)}%)`));
      return result;
      
    } catch (error) {
      console.error(chalk.red(`❌ RAG query failed: ${error}`));
      throw error;
    }
  }

  /**
   * Clear the entire index
   */
  async clearIndex(): Promise<void> {
    try {
      this.vectorIndex = {
        documents: new Map(),
        embeddings: new Map(),
        metadata: {
          created: new Date(),
          lastUpdated: new Date(),
          totalDocuments: 0,
          version: '1.0.0'
        }
      };
      
      await this.saveIndex();
      console.log(chalk.green('✅ RAG index cleared successfully'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to clear index: ${error}`));
      throw error;
    }
  }

  /**
   * Get statistics about the current index
   */
  async getIndexStats(): Promise<IndexStats> {
    const testTypeDistribution: { [key: string]: number } = {};
    const sessionIds = new Set<string>();

    for (const [_, doc] of this.vectorIndex.documents) {
      testTypeDistribution[doc.metadata.testType] = 
        (testTypeDistribution[doc.metadata.testType] || 0) + 1;
      sessionIds.add(doc.metadata.sessionId);
    }

    const totalChunks = Array.from(this.vectorIndex.documents.values())
      .reduce((total, doc) => total + (doc.chunks?.length || 0), 0);

    return {
      totalDocuments: this.vectorIndex.metadata.totalDocuments,
      totalChunks,
      indexSize: this.calculateIndexSize(),
      lastUpdated: this.vectorIndex.metadata.lastUpdated,
      testTypeDistribution,
      sessionCount: sessionIds.size
    };
  }

  // Private helper methods

  private async createDocumentFromTestResult(
    pageResult: PageResult,
    testResult: TestResult,
    sessionId: string
  ): Promise<IndexedDocument | null> {
    try {
      if (!testResult.outputPath) return null;

      // Read the test result file
      const content = await fs.readFile(testResult.outputPath, 'utf8');
      
      const documentId = this.generateDocumentId(sessionId, pageResult.pageName, testResult.testType);
      
      const metadata: DocumentMetadata = {
        testType: testResult.testType,
        page: pageResult.pageName,
        sessionId,
        url: pageResult.url,
        timestamp: testResult.startTime,
        outputPath: testResult.outputPath,
        testStatus: testResult.status
      };

      // Create document chunks for better retrieval
      const chunks = this.createDocumentChunks(content, documentId);

      return {
        id: documentId,
        content,
        metadata,
        chunks
      };
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Couldn't process test result: ${error}`));
      return null;
    }
  }

  private createDocumentChunks(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const contentLength = content.length;
    
    for (let i = 0; i < contentLength; i += this.chunkSize - this.chunkOverlap) {
      const endIndex = Math.min(i + this.chunkSize, contentLength);
      const chunkContent = content.slice(i, endIndex);
      
      // Skip very small chunks
      if (chunkContent.trim().length < 50) continue;
      
      chunks.push({
        id: `${documentId}_chunk_${chunks.length}`,
        content: chunkContent.trim(),
        startIndex: i,
        endIndex
      });
      
      if (endIndex >= contentLength) break;
    }
    
    return chunks;
  }

  private async indexDocumentBatch(documents: IndexedDocument[]): Promise<void> {
    for (const document of documents) {
      // Generate embeddings for the full document
      const documentEmbedding = await this.generateEmbedding(document.content);
      
      // Generate embeddings for chunks
      if (document.chunks) {
        for (const chunk of document.chunks) {
          chunk.embedding = await this.generateEmbedding(chunk.content);
        }
      }
      
      // Store in index
      this.vectorIndex.documents.set(document.id, document);
      this.vectorIndex.embeddings.set(document.id, documentEmbedding);
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Clean and truncate text for embedding
      const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 8000);
      
      const { embedding } = await embed({
        model: this.embedModel,
        value: cleanText,
      });
      
      return embedding;
      
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Embedding generation failed, using zero vector: ${error}`));
      // Return zero vector as fallback
      return new Array(768).fill(0);
    }
  }

  private async findRelevantDocuments(
    queryEmbedding: number[],
    context?: RAGContext,
    limit: number = 10
  ): Promise<RAGSource[]> {
    const candidates: Array<{ source: RAGSource; similarity: number }> = [];
    
    for (const [docId, document] of this.vectorIndex.documents) {
      // Apply context filters
      if (!this.documentMatchesContext(document, context)) {
        continue;
      }
      
      // Calculate similarity with document-level embedding
      const docEmbedding = this.vectorIndex.embeddings.get(docId);
      if (docEmbedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
        
        candidates.push({
          source: {
            documentId: docId,
            testType: document.metadata.testType,
            page: document.metadata.page,
            sessionId: document.metadata.sessionId,
            relevanceScore: similarity,
            excerpt: this.createExcerpt(document.content),
            outputPath: document.metadata.outputPath
          },
          similarity
        });
      }
      
      // Also check chunk-level similarities for better granularity
      if (document.chunks) {
        for (const chunk of document.chunks) {
          if (chunk.embedding) {
            const chunkSimilarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
            
            if (chunkSimilarity > 0.7) { // High threshold for chunks
              candidates.push({
                source: {
                  documentId: chunk.id,
                  testType: document.metadata.testType,
                  page: document.metadata.page,
                  sessionId: document.metadata.sessionId,
                  relevanceScore: chunkSimilarity,
                  excerpt: this.createExcerpt(chunk.content),
                  outputPath: document.metadata.outputPath
                },
                similarity: chunkSimilarity
              });
            }
          }
        }
      }
    }
    
    // Sort by similarity and return top results
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(candidate => candidate.source);
  }

  private documentMatchesContext(document: IndexedDocument, context?: RAGContext): boolean {
    if (!context) return true;
    
    if (context.sessionId && document.metadata.sessionId !== context.sessionId) {
      return false;
    }
    
    if (context.testTypes && !context.testTypes.includes(document.metadata.testType)) {
      return false;
    }
    
    if (context.pages && !context.pages.some(page => 
      document.metadata.page.toLowerCase().includes(page.toLowerCase())
    )) {
      return false;
    }
    
    if (context.dateRange) {
      const docDate = document.metadata.timestamp;
      if (docDate < context.dateRange.start || docDate > context.dateRange.end) {
        return false;
      }
    }
    
    return true;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private createExcerpt(content: string, maxLength: number = 200): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    
    return cleaned.slice(0, maxLength) + '...';
  }

  private buildContextFromSources(sources: RAGSource[]): string {
    let context = "Based on the following test results and analysis:\n\n";
    
    sources.forEach((source, index) => {
      context += `[Source ${index + 1}] ${source.testType} test for page "${source.page}":\n`;
      context += `${source.excerpt}\n\n`;
    });
    
    return context;
  }

  private async generateAnswer(query: string, context: string): Promise<{ answer: string }> {
    const systemPrompt = `You are an expert web developer and SEO analyst helping analyze website test results. 
    
Your role is to provide accurate, helpful answers based on the indexed test results from Playwright Site Scanner tests including:
- SEO analysis (meta tags, headings, structured data)
- Accessibility testing (WCAG compliance, axe-core results)  
- Screenshot analysis across different viewports
- Content analysis and site structure
- Performance metrics and recommendations

Guidelines:
- Answer based only on the provided test result data
- Be specific and cite which tests/pages you're referencing
- Provide actionable recommendations when appropriate
- If the data doesn't contain enough information, say so clearly
- Use technical terms appropriately but explain them when helpful
- Focus on practical, implementable advice`;

    const userPrompt = `Context from test results:
${context}

Question: ${query}

Please provide a comprehensive answer based on the test results data above.`;

    try {
      const { text } = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1, // Low temperature for more factual responses
      });

      return { answer: text };
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate answer: ${error}`));
      return { 
        answer: "I encountered an error while generating a response. Please try again or rephrase your question." 
      };
    }
  }

  private calculateConfidence(sources: RAGSource[], answer: string): number {
    if (sources.length === 0) return 0;
    
    // Base confidence on number and quality of sources
    const avgRelevanceScore = sources.reduce((sum, source) => sum + source.relevanceScore, 0) / sources.length;
    const sourceCountFactor = Math.min(sources.length / 5, 1); // Normalize to max of 5 sources
    
    // Penalize if answer is very short (might indicate uncertainty)
    const lengthFactor = Math.min(answer.length / 100, 1);
    
    return Math.min(avgRelevanceScore * sourceCountFactor * lengthFactor, 1);
  }

  private generateDocumentId(sessionId: string, pageName: string, testType: string): string {
    const input = `${sessionId}-${pageName}-${testType}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  private calculateIndexSize(): number {
    let totalSize = 0;
    
    for (const [_, document] of this.vectorIndex.documents) {
      totalSize += JSON.stringify(document).length;
    }
    
    for (const [_, embedding] of this.vectorIndex.embeddings) {
      totalSize += embedding.length * 8; // Assuming 8 bytes per number
    }
    
    return totalSize;
  }

  private async loadIndex(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      
      if (await this.fileExists(this.indexPath)) {
        const indexData = await fs.readFile(this.indexPath, 'utf8');
        const parsed = JSON.parse(indexData);
        
        // Reconstruct Maps from JSON
        this.vectorIndex.documents = new Map(parsed.documents);
        this.vectorIndex.embeddings = new Map(parsed.embeddings);
        this.vectorIndex.metadata = {
          ...parsed.metadata,
          created: new Date(parsed.metadata.created),
          lastUpdated: new Date(parsed.metadata.lastUpdated)
        };
        
        console.log(chalk.gray(`📚 Loaded RAG index with ${this.vectorIndex.documents.size} documents`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not load existing index, starting fresh: ${error}`));
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const indexData = {
        documents: Array.from(this.vectorIndex.documents.entries()),
        embeddings: Array.from(this.vectorIndex.embeddings.entries()),
        metadata: this.vectorIndex.metadata
      };
      
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      await fs.writeFile(this.indexPath, JSON.stringify(indexData, null, 2), 'utf8');
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save index: ${error}`));
      throw error;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}