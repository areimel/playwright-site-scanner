import { TestResult, RAGContext as ExistingRAGContext, RAGResult as ExistingRAGResult, RAGSource as ExistingRAGSource, ChatMessage as ExistingChatMessage, ChatContext as ExistingChatContext, ChatSession as ExistingChatSession, UIElement as ExistingUIElement, VisionAnalysis as ExistingVisionAnalysis, LayoutAnalysis as ExistingLayoutAnalysis, VisualAccessibilityIssue as ExistingVisualAccessibilityIssue } from './index.js';

// Enhanced AI Analysis Result Types (extending existing TestResult)
export interface AIAnalysisResult extends TestResult {
  analysisType: AIAnalysisType;
  confidence: number; // 0-1 score indicating AI confidence
  insights: AIInsight[];
  metadata: AIAnalysisMetadata;
  rawResponse?: string; // Original AI response for debugging
}

export type AIAnalysisType = 
  | 'content-intelligence'
  | 'visual-analysis' 
  | 'accessibility-intelligence'
  | 'seo-intelligence'
  | 'user-experience'
  | 'content-quality'
  | 'brand-analysis';

export interface AIInsight {
  type: InsightType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  category: string;
  confidence: number;
  affectedElements?: string[]; // CSS selectors or element descriptions
  evidence?: InsightEvidence[];
}

export type InsightType = 
  | 'opportunity' 
  | 'issue' 
  | 'best-practice'
  | 'optimization'
  | 'compliance'
  | 'accessibility'
  | 'performance';

export interface InsightEvidence {
  type: 'text' | 'image' | 'metric' | 'element';
  description: string;
  value?: string | number;
  location?: string; // CSS selector or coordinate
}

export interface AIAnalysisMetadata {
  modelUsed: string;
  processingTime: number;
  tokensUsed?: number;
  apiCalls: number;
  analysisDate: Date;
  pageContext: {
    url: string;
    title: string;
    contentLength: number;
    viewport?: string;
  };
}

// Enhanced RAG Types (extending existing ones)
export interface EnhancedRAGQuery {
  query: string;
  context: ExistingRAGContext;
  filters?: RAGFilter[];
  maxResults?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
  responseType?: 'summary' | 'detailed' | 'conversational';
}

export interface RAGFilter {
  field: 'url' | 'testType' | 'severity' | 'category' | 'date';
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'in';
  value: string | number | Date | string[];
}

export interface EnhancedRAGResult extends ExistingRAGResult {
  processingTime: number;
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    searchStrategy?: string;
  };
}

// Enhanced Vision Analysis Types (extending existing VisionAnalysis)
export interface EnhancedVisionAnalysis extends ExistingVisionAnalysis {
  aiGenerated: boolean;
  modelUsed?: string;
  branding?: BrandingAnalysis;
  contentAnalysis?: ContentAnalysis;
  processingMetadata?: {
    tokensUsed?: number;
    apiCalls: number;
    confidence: number;
  };
}

// UI Analysis Extensions
export interface UIPattern {
  name: string;
  type: 'navigation' | 'form' | 'content' | 'interaction';
  consistency: number; // 0-1 score
  bestPracticeCompliance: number; // 0-1 score
  recommendations: string[];
}

export interface UIConsistencyScore {
  overall: number; // 0-1 score
  colors: number;
  typography: number;
  spacing: number;
  interactions: number;
}

export interface UsabilityScore {
  overall: number; // 0-1 score
  navigation: number;
  readability: number;
  accessibility: number;
  responsiveness: number;
}

// Enhanced UI Element Extensions
export interface EnhancedUIElement extends ExistingUIElement {
  aiDetected?: boolean;
  patterns?: string[];
  brandConsistency?: number;
  usabilityScore?: number;
}

// Enhanced Accessibility Issues
export interface EnhancedAccessibilityIssue extends ExistingVisualAccessibilityIssue {
  wcagCriterion?: string;
  level?: 'A' | 'AA' | 'AAA';
  autoFixable?: boolean;
  priority?: number;
  impact?: 'minor' | 'moderate' | 'major' | 'severe';
}

// Branding and Content Analysis Types
export interface BrandingAnalysis {
  consistency: number; // 0-1 score
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    consistency: number;
  };
  typography: {
    fonts: string[];
    hierarchy: 'clear' | 'unclear' | 'missing';
    consistency: number;
  };
  imagery: {
    style: 'consistent' | 'mixed' | 'inconsistent';
    quality: 'high' | 'medium' | 'low';
    brandAlignment: number; // 0-1 score
  };
  tone: 'professional' | 'casual' | 'playful' | 'formal' | 'mixed';
}

export interface ContentAnalysis {
  readability: ReadabilityScore;
  structure: ContentStructure;
  quality: ContentQuality;
  seo: SEOIndicators;
}

export interface ReadabilityScore {
  overall: number; // 0-1 score
  sentenceLength: 'short' | 'medium' | 'long';
  vocabularyComplexity: 'simple' | 'moderate' | 'complex';
  gradeLevel: number;
  recommendations: string[];
}

export interface ContentStructure {
  headingHierarchy: 'clear' | 'unclear' | 'missing';
  paragraphLength: 'short' | 'medium' | 'long';
  listUsage: 'appropriate' | 'overused' | 'underused';
  scannability: number; // 0-1 score
}

export interface ContentQuality {
  relevance: number; // 0-1 score
  accuracy: number; // 0-1 score (if determinable)
  completeness: number; // 0-1 score
  freshness: 'current' | 'recent' | 'outdated' | 'unknown';
  engagement: number; // 0-1 score
}

export interface SEOIndicators {
  titleOptimization: number; // 0-1 score
  metaDescriptionPresence: boolean;
  headingStructure: number; // 0-1 score
  keywordDensity: 'low' | 'optimal' | 'high';
  internalLinkingOpportunities: number;
}

// Enhanced Chatbot Types (extending existing ones)
export interface EnhancedChatSession extends ExistingChatSession {
  aiProvider?: string;
  modelUsed?: string;
  totalTokensUsed?: number;
  averageConfidence?: number;
  conversationQuality?: number; // 0-1 score
}

export interface EnhancedChatMessage extends ExistingChatMessage {
  type?: 'text' | 'query' | 'analysis-request' | 'report-summary';
  metadata?: {
    confidence?: number;
    sources?: ExistingRAGSource[];
    processingTime?: number;
    intent?: string;
    tokensUsed?: number;
  };
}

// Enhanced Chat Context
export interface EnhancedChatContext extends ExistingChatContext {
  userPreferences?: {
    detailLevel: 'summary' | 'detailed' | 'technical';
    priorities: ('accessibility' | 'seo' | 'performance' | 'usability')[];
    reportFormat: 'conversational' | 'structured' | 'actionable';
  };
  conversationHistory?: {
    totalQueries: number;
    commonTopics: string[];
    lastActiveTime: Date;
  };
}

// AI Service Configuration Types
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryAttempts?: number;
  rateLimiting?: RateLimitConfig;
}

export type AIProvider = 'google-gemini' | 'openai' | 'anthropic' | 'azure' | 'local';

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  burstLimit?: number;
}

export interface AICapabilityConfig {
  contentAnalysis: boolean;
  visionAnalysis: boolean;
  ragQueries: boolean;
  chatbot: boolean;
  reportGeneration: boolean;
  autoInsights: boolean;
}

export interface AIFeatureFlags {
  enableContentIntelligence: boolean;
  enableVisualAnalysis: boolean;
  enableRAGSearch: boolean;
  enableChatbot: boolean;
  enableAutoRecommendations: boolean;
  enableBatchAnalysis: boolean;
  requireExplicitConsent: boolean;
  logAnalytics: boolean;
}

export interface AIAnalysisRequest {
  sessionId: string;
  type: AIAnalysisType;
  targets: AIAnalysisTarget[];
  options?: AIAnalysisOptions;
}

export interface AIAnalysisTarget {
  type: 'url' | 'screenshot' | 'content' | 'test-result';
  identifier: string; // URL, file path, or ID
  metadata?: Record<string, any>;
}

export interface AIAnalysisOptions {
  priority: 'low' | 'normal' | 'high';
  maxProcessingTime?: number;
  includeRecommendations: boolean;
  confidenceThreshold?: number;
  focusAreas?: string[];
  excludeTypes?: AIAnalysisType[];
}

// Consolidated export type for convenience
export type EnhancedAITypes = {
  // Core Analysis
  AIAnalysisResult: AIAnalysisResult;
  AIInsight: AIInsight;
  AIAnalysisMetadata: AIAnalysisMetadata;
  
  // Enhanced RAG System
  EnhancedRAGQuery: EnhancedRAGQuery;
  EnhancedRAGResult: EnhancedRAGResult;
  RAGFilter: RAGFilter;
  
  // Enhanced Vision Analysis
  EnhancedVisionAnalysis: EnhancedVisionAnalysis;
  EnhancedUIElement: EnhancedUIElement;
  EnhancedAccessibilityIssue: EnhancedAccessibilityIssue;
  
  // Enhanced Chat System
  EnhancedChatSession: EnhancedChatSession;
  EnhancedChatMessage: EnhancedChatMessage;
  EnhancedChatContext: EnhancedChatContext;
  
  // Content & Branding Analysis
  BrandingAnalysis: BrandingAnalysis;
  ContentAnalysis: ContentAnalysis;
  ReadabilityScore: ReadabilityScore;
  ContentQuality: ContentQuality;
  SEOIndicators: SEOIndicators;
  
  // UI Analysis
  UIPattern: UIPattern;
  UIConsistencyScore: UIConsistencyScore;
  UsabilityScore: UsabilityScore;
  
  // Configuration & Service
  AIServiceConfig: AIServiceConfig;
  AICapabilityConfig: AICapabilityConfig;
  AIFeatureFlags: AIFeatureFlags;
  AIAnalysisRequest: AIAnalysisRequest;
  AIAnalysisTarget: AIAnalysisTarget;
  AIAnalysisOptions: AIAnalysisOptions;
};