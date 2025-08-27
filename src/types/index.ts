export interface TestConfig {
  url: string;
  crawlSite: boolean;
  selectedTests: TestType[];
  viewports: ViewportConfig[];
  reporter?: ReporterConfig;
  verboseMode?: boolean;
}

export interface TestType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface ReporterConfig {
  enabled: boolean;
  type: 'html';
  outputPath?: string;
  openBehavior: 'always' | 'never' | 'on-failure';
  includeScreenshots: boolean;
  includeDetailedLogs: boolean;
}

export interface SessionSummary {
  sessionId: string;
  url: string;
  startTime: Date;
  endTime?: Date;
  totalPages: number;
  testsRun: number;
  testsSucceeded: number;
  testsFailed: number;
  errors: string[];
}

export interface PageResult {
  url: string;
  pageName: string;
  tests: TestResult[];
  summary: string;
}

export interface TestResult {
  testType: string;
  status: 'success' | 'failed' | 'pending';
  startTime: Date;
  endTime?: Date;
  outputPath?: string;
  error?: string;
  outputType?: 'per-page' | 'site-wide';
}

export interface ProgressState {
  currentTest: string;
  completedTests: number;
  totalTests: number;
  currentPage: string;
  completedPages: number;
  totalPages: number;
}

// Extended types for new test implementations
export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

export interface ScrapedContent {
  title: string;
  headings: HeadingData[];
  paragraphs: string[];
  lists: ListData[];
  images: ImageData[];
  links: LinkData[];
  metadata: PageMetadata;
}

export interface HeadingData {
  level: number;
  text: string;
  id?: string;
}

export interface ListData {
  type: 'ordered' | 'unordered';
  items: string[];
}

export interface ImageData {
  src: string;
  alt: string;
  title?: string;
  localPath?: string;
  filename?: string;
}

export interface LinkData {
  href: string;
  text: string;
  isExternal: boolean;
}

export interface PageMetadata {
  description: string;
  author: string;
  publishDate: string;
  modifiedDate: string;
  keywords: string[];
}

export interface PageSummary {
  url: string;
  title: string;
  description: string;
  headings: string[];
  wordCount: number;
  imageCount: number;
  linkCount: number;
  lastModified?: string;
  contentType: 'homepage' | 'blog' | 'product' | 'service' | 'about' | 'contact' | 'generic';
  depth: number;
}

export interface SiteSummaryData {
  baseUrl: string;
  totalPages: number;
  generatedAt: string;
  pages: PageSummary[];
  statistics: {
    totalWords: number;
    totalImages: number;
    totalLinks: number;
    averageWordsPerPage: number;
    contentTypeDistribution: { [key: string]: number };
    depthDistribution: { [key: number]: number };
  };
  navigation: {
    maxDepth: number;
    mainSections: string[];
    orphanPages: string[];
  };
}

// AI Vision Analysis Types
export interface VisionAnalysis {
  url: string;
  timestamp: string;
  screenshots: ScreenshotAnalysis[];
  ocrText: string;
  uiElements: UIElement[];
  accessibilityIssues: VisualAccessibilityIssue[];
  layoutAnalysis: LayoutAnalysis;
  recommendations: string[];
  viewportComparison?: ViewportComparison;
}

export interface ScreenshotAnalysis {
  viewport: ViewportConfig;
  imagePath: string;
  analysis: string;
  extractedText: string;
  confidence: number;
}

export interface UIElement {
  type: 'button' | 'link' | 'form' | 'input' | 'image' | 'heading' | 'navigation' | 'content' | 'footer' | 'header' | 'modal' | 'card' | 'menu' | 'unknown';
  text?: string;
  position: ElementPosition;
  attributes: ElementAttributes;
  accessibility: ElementAccessibility;
  confidence: number;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementAttributes {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  visible: boolean;
  clickable: boolean;
}

export interface ElementAccessibility {
  hasAltText: boolean;
  hasLabel: boolean;
  contrastRatio?: number;
  contrastIssue: boolean;
  sizeIssue: boolean;
  tooSmall: boolean;
}

export interface VisualAccessibilityIssue {
  type: 'contrast' | 'text-size' | 'touch-target' | 'missing-labels' | 'color-only' | 'focus-indicator';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  element?: UIElement;
  recommendation: string;
}

export interface LayoutAnalysis {
  responsive: boolean;
  breakpoints: string[];
  overflowIssues: OverflowIssue[];
  spacingIssues: SpacingIssue[];
  alignmentIssues: AlignmentIssue[];
  readabilityScore: number;
  mobileOptimized: boolean;
}

export interface OverflowIssue {
  type: 'horizontal' | 'vertical';
  element: string;
  severity: 'minor' | 'major';
}

export interface SpacingIssue {
  type: 'cramped' | 'excessive' | 'inconsistent';
  elements: string[];
  recommendation: string;
}

export interface AlignmentIssue {
  type: 'misaligned' | 'inconsistent';
  elements: string[];
  severity: 'minor' | 'major';
}

export interface ViewportComparison {
  layoutConsistency: number;
  contentParity: boolean;
  navigationConsistency: boolean;
  differences: ViewportDifference[];
}

export interface ViewportDifference {
  viewport1: string;
  viewport2: string;
  type: 'layout' | 'content' | 'navigation' | 'styling';
  description: string;
  severity: 'minor' | 'major';
}

export interface ScreenshotSet {
  desktop: string;
  tablet: string;
  mobile: string;
  url: string;
  pageName: string;
}

export interface LayoutComparison {
  consistency: number;
  differences: ViewportDifference[];
  recommendations: string[];
}

// RAG Service Types
export interface RAGContext {
  sessionId?: string;
  testTypes?: string[];
  pages?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface RAGResult {
  answer: string;
  confidence: number;
  sources: RAGSource[];
  query: string;
  timestamp: Date;
}

export interface RAGSource {
  documentId: string;
  testType: string;
  page: string;
  sessionId: string;
  relevanceScore: number;
  excerpt: string;
  outputPath?: string;
}

export interface IndexedDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
  chunks?: DocumentChunk[];
}

export interface DocumentMetadata {
  testType: string;
  page: string;
  sessionId: string;
  url: string;
  timestamp: Date;
  outputPath?: string;
  testStatus: 'success' | 'failed' | 'pending';
}

export interface DocumentChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
}

export interface IndexStats {
  totalDocuments: number;
  totalChunks: number;
  indexSize: number;
  lastUpdated: Date;
  testTypeDistribution: { [key: string]: number };
  sessionCount: number;
}

// AI Chatbot Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: ChatContext;
}

export interface ChatContext {
  sessionId?: string;
  pageUrl?: string;
  pageName?: string;
  testType?: string;
  availableData?: TestResultData;
}

export interface TestResultData {
  sessionSummary?: SessionSummary;
  pageResults?: PageResult[];
  testResults?: TestResult[];
  rawContent?: string;
}

export interface ChatSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  messages: ChatMessage[];
  currentContext?: ChatContext;
  totalMessages: number;
}

export interface AIResponse {
  content: string;
  suggestions?: string[];
  relatedQuestions?: string[];
  analysisType?: 'technical' | 'recommendation' | 'explanation' | 'brainstorming';
}