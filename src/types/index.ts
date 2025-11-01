export interface TestConfig {
  url: string;
  crawlSite: boolean;
  selectedTests: TestType[];
  viewports: ViewportConfig[];
  reporter?: ReporterConfig;
  verboseMode?: boolean;
  usedPlaylist?: string | null;
}

export interface TestType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface PlaylistType {
  id: string;
  name: string;
  description: string;
  tests: string[];
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

export interface ContentElement {
  type: 'heading' | 'paragraph' | 'list' | 'image' | 'blockquote' | 'code';
  data: HeadingData | ParagraphData | ListData | ImageData | BlockquoteData | CodeData;
  indentLevel: number; // For preserving hierarchy
}

export interface ScrapedContent {
  title: string;
  content: ContentElement[]; // Sequential content in DOM order
  metadata: PageMetadata;
  // Keep these for backward compatibility with existing code
  headings: HeadingData[];
  paragraphs: string[];
  lists: ListData[];
  images: ImageData[];
  links: LinkData[];
}

export interface HeadingData {
  level: number;
  text: string;
  id?: string;
}

export interface ParagraphData {
  text: string;
  links?: LinkData[]; // Inline links within the paragraph
}

export interface ListData {
  type: 'ordered' | 'unordered';
  items: string[];
  nestedLevel?: number; // For preserving nested list hierarchy
}

export interface BlockquoteData {
  text: string;
}

export interface CodeData {
  language?: string;
  code: string;
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