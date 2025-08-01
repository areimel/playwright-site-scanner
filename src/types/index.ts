export interface TestConfig {
  url: string;
  crawlSite: boolean;
  selectedTests: TestType[];
  viewports: ViewportConfig[];
  reporter?: ReporterConfig;
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