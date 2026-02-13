import { Page } from 'playwright';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import { TestResult } from '@shared/index.js';
import { SessionManager } from '@utils/session-manager.js';

interface TextSearchMatch {
  context: string;    // ~80 chars of surrounding text
  element: string;    // HTML tag name (e.g., 'p', 'h2', 'span')
  selector: string;   // CSS selector path to the element
}

interface TextSearchPageResult {
  url: string;
  matchCount: number;
  matches: TextSearchMatch[];
}

interface TextSearchReport {
  searchText: string;
  caseSensitive: boolean;
  scanDate: string;
  baseUrl: string;
  totalPagesScanned: number;
  pagesWithMatches: number;
  totalMatches: number;
  results: TextSearchPageResult[];  // Only pages WITH matches
}

export class TextSearchTester {
  private sessionManager: SessionManager;
  private pageResults: TextSearchPageResult[] = [];
  private scannedPages = 0;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async runTextSearch(page: Page, pageUrl: string, searchText: string, caseSensitive: boolean): Promise<TestResult> {
    const testResult = this.sessionManager.createTestResult('text-search');

    try {
      console.log(chalk.gray(`    🔍 Searching for "${searchText}" on page...`));

      const matches: TextSearchMatch[] = await page.evaluate(
        ({ searchText, caseSensitive }) => {
          function buildSelector(el: Element): string {
            const parts: string[] = [];
            let current: Element | null = el;
            let depth = 0;

            while (current && current !== document.body && depth < 4) {
              let part = current.tagName.toLowerCase();
              if (current.className && typeof current.className === 'string') {
                const firstClass = current.className.trim().split(/\s+/)[0];
                if (firstClass) {
                  part += '.' + firstClass;
                }
              }
              parts.unshift(part);
              current = current.parentElement;
              depth++;
            }

            parts.unshift('body');
            return parts.join(' > ');
          }

          const results: { context: string; element: string; selector: string }[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

          let node: Text | null;
          while ((node = walker.nextNode() as Text | null)) {
            const textContent = node.textContent || '';
            if (!textContent.trim()) continue;

            const haystack = caseSensitive ? textContent : textContent.toLowerCase();
            const needle = caseSensitive ? searchText : searchText.toLowerCase();

            let startIndex = 0;
            let foundIndex: number;

            while ((foundIndex = haystack.indexOf(needle, startIndex)) !== -1) {
              // Extract ~80 chars of context centered around the match
              const contextStart = Math.max(0, foundIndex - 40);
              const contextEnd = Math.min(textContent.length, foundIndex + needle.length + 40);
              const context = textContent.substring(contextStart, contextEnd).trim();

              const parentElement = node.parentElement;
              if (parentElement) {
                results.push({
                  context,
                  element: parentElement.tagName.toLowerCase(),
                  selector: buildSelector(parentElement)
                });
              }

              startIndex = foundIndex + needle.length;
            }
          }

          return results;
        },
        { searchText, caseSensitive }
      );

      this.scannedPages++;

      if (matches.length > 0) {
        this.pageResults.push({
          url: pageUrl,
          matchCount: matches.length,
          matches
        });
        console.log(chalk.yellow(`    ⚠️  Found ${matches.length} match(es) for "${searchText}" on this page`));
      } else {
        console.log(chalk.green(`    ✅ No matches found for "${searchText}" on this page`));
      }

      testResult.status = 'success';
      testResult.endTime = new Date();

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();

      console.log(chalk.red(`    ❌ Text search failed: ${testResult.error}`));
    }

    return testResult;
  }

  async generateTextSearchReport(sessionId: string, urls: string[], searchText: string, caseSensitive: boolean): Promise<TestResult> {
    const testResult = this.sessionManager.createTestResult('text-search');

    try {
      console.log(chalk.gray(`    📋 Generating text search report...`));

      const totalMatches = this.pageResults.reduce((sum, r) => sum + r.matchCount, 0);

      const report: TextSearchReport = {
        searchText,
        caseSensitive,
        scanDate: new Date().toISOString(),
        baseUrl: urls.length > 0 ? urls[0] : '',
        totalPagesScanned: this.scannedPages,
        pagesWithMatches: this.pageResults.length,
        totalMatches,
        results: this.pageResults
      };

      const filename = 'text-search-report.json';
      const outputPath = this.sessionManager.buildFilePath(sessionId, '', 'reports', filename);

      await this.sessionManager.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      if (totalMatches > 0) {
        console.log(chalk.yellow(`    ⚠️  Text search completed: "${searchText}" found ${totalMatches} time(s) across ${this.pageResults.length} of ${this.scannedPages} page(s)`));
      } else {
        console.log(chalk.green(`    ✅ Text search completed: "${searchText}" not found across ${this.scannedPages} page(s)`));
      }

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();

      console.log(chalk.red(`    ❌ Failed to generate text search report: ${testResult.error}`));
    }

    return testResult;
  }
}
