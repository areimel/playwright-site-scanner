# Crawlee Implementation Notes

This document contains research findings and implementation patterns for extending the playwright-site-scanner with new Crawlee-based test types.

## Crawlee Architecture Overview

### PlaywrightCrawler Key Features
- **Browser Management**: Automatically manages Chromium, Firefox, and Webkit browsers
- **Parallel Processing**: Supports concurrent crawling with configurable concurrency
- **Request Handling**: Uses `requestHandler` for processing each page
- **Data Storage**: Built-in Dataset API for storing extracted data
- **Link Discovery**: `enqueueLinks` method for automatic link discovery with strategies
- **Error Handling**: `failedRequestHandler` for managing failed requests

### Current Implementation Patterns in Project

#### Existing Crawler (`src/lib/crawlee-site-crawler.ts`)
```typescript
const crawler = new PlaywrightCrawler({
  maxRequestsPerCrawl: maxPages,
  headless: true,
  
  async requestHandler({ request, page, enqueueLinks, log }) {
    // Page processing logic
    await Dataset.pushData({
      url: currentUrl,
      title: title || 'No title',
      timestamp: new Date().toISOString()
    });
    
    // Link discovery with same-domain strategy
    await enqueueLinks({
      selector: 'a[href]',
      strategy: 'same-domain'
    });
  }
});
```

## New Test Type Implementation Patterns

### 1. Sitemap Generation
**Approach**: Enhance existing crawler to collect comprehensive URL data, then generate XML sitemap

**Key Implementation Details**:
- Reuse existing crawlee crawler with enhanced data collection
- Generate standard XML sitemap format for search engines
- Include `<lastmod>` dates and `<priority>` values based on page depth
- Output single `sitemap.xml` file at session level (not per-page)

**Data Structure**:
```typescript
interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}
```

### 2. Content Scraping
**Approach**: Use Playwright's page evaluation to extract content, download images locally

**Key Implementation Details**:
- Extract structured content (headings, paragraphs, lists, images)
- Download images to local session directory structure
- Generate markdown with local image references
- Handle image URL resolution and sanitization
- Process content per-page (follows existing pattern)

**Content Extraction Pattern**:
```typescript
const content = await page.evaluate(() => {
  // Extract headings, paragraphs, images, etc.
  return {
    title: document.title,
    headings: [...], 
    paragraphs: [...],
    images: [...]
  };
});
```

### 3. Site Summary Report
**Approach**: Aggregate crawled page data to create comprehensive site overview

**Key Implementation Details**:
- Collect title and meta description from each discovered page
- Analyze site structure and navigation hierarchy
- Generate summary with page relationships and content overview
- Output single summary report at session level
- Include statistics about site structure

## File Organization Strategy

### Session Directory Structure Extension
```
playwright-site-scanner-sessions/
├── MM-DD-YYYY_HH-MM/
│   ├── session-summary.md
│   ├── sitemap.xml                    // NEW: Site-wide sitemap
│   ├── site-summary.md               // NEW: Site overview report
│   ├── images/                       // NEW: Downloaded images directory
│   │   ├── page1-image1.jpg
│   │   └── page2-image2.png
│   ├── page1/
│   │   ├── page1-summary.md
│   │   ├── page1-content.md          // NEW: Scraped content as markdown
│   │   ├── screenshots/
│   │   └── scans/
│   └── page2/
│       ├── page2-summary.md
│       ├── page2-content.md          // NEW: Scraped content as markdown
│       ├── screenshots/
│       └── scans/
```

## Integration with Existing Architecture

### SessionManager Extensions
- Add methods for new file types: `getContentPath()`, `getSitemapPath()`, `getImagePath()`
- Enhance directory creation to include `images/` subdirectory
- Update summary generation to include new test results

### Test Result Patterns
All new tests follow existing `TestResult` interface:
```typescript
interface TestResult {
  testType: string;           // 'sitemap', 'content-scraping', 'site-summary'
  status: 'success' | 'failed' | 'pending';
  startTime: Date;
  endTime?: Date;
  outputPath?: string;        // Path to generated file
  error?: string;
}
```

### Error Handling Strategy
- Follow existing pattern: try/catch with chalk console logging
- Return failed TestResult with error message on exceptions
- Graceful degradation: continue with other tests if one fails
- Log progress with consistent messaging format

## Crawlee Best Practices Discovered

### Data Extraction
- Use `page.evaluate()` for client-side content extraction
- Batch Dataset operations for better performance
- Clear datasets after use to prevent memory issues

### Image Handling
- Use Playwright's request interception for image downloads
- Implement proper URL resolution for relative image paths
- Sanitize image filenames for filesystem compatibility

### Performance Considerations
- Limit maximum pages crawled (existing: 50 pages)
- Use `networkidle` wait state for consistent page loading
- Configure appropriate browser args for headless operation

### Error Recovery
- Implement retry logic for failed requests
- Handle network timeouts gracefully
- Provide fallback data when extraction fails

## Technical Dependencies

### Existing Dependencies (Already Available)
- `crawlee`: PlaywrightCrawler, Dataset API
- `playwright`: Page evaluation and request handling
- `fs/promises`: File system operations
- `path`: Path manipulation utilities

### New Utility Needs
- XML generation utilities for sitemap
- Markdown formatting utilities
- Image download and processing utilities
- URL sanitization for filenames

## Testing Considerations

### Unit Testing Approach
- Mock Playwright page responses for consistent testing
- Test XML sitemap format validation
- Verify markdown output formatting
- Validate image download and local referencing

### Integration Testing
- Test with various website structures
- Verify error handling with unreachable resources
- Test large site handling (approaching 50 page limit)
- Validate cross-platform file path handling