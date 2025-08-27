import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { generateObject, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import {
  TestResult,
  VisionAnalysis,
  ScreenshotAnalysis,
  UIElement,
  VisualAccessibilityIssue,
  LayoutAnalysis,
  ViewportComparison,
  ScreenshotSet,
  LayoutComparison,
  ViewportConfig
} from '../../types/index.js';
import { SessionManager } from '../../utils/session-manager.js';

export class VisionService {
  private sessionManager: SessionManager;
  private model: any;

  constructor() {
    this.sessionManager = new SessionManager();
    
    // Initialize Google Gemini Vision model
    this.model = google('gemini-1.5-pro');
  }

  /**
   * Analyze a screenshot using AI vision capabilities
   */
  async analyzeScreenshot(imagePath: string, pageUrl: string): Promise<VisionAnalysis> {
    const startTime = new Date();
    
    try {
      console.log(chalk.gray(`    🔍 Analyzing screenshot with AI vision...`));

      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Extract viewport info from filename
      const viewport = this.extractViewportFromPath(imagePath);

      // Perform comprehensive AI analysis
      const [ocrText, uiElements, accessibilityIssues, layoutAnalysis] = await Promise.all([
        this.extractTextFromImage(imagePath),
        this.detectUIElements(imagePath),
        this.analyzeAccessibility(imagePath),
        this.analyzeLayout(imagePath)
      ]);

      // Generate overall analysis and recommendations
      const analysisResult = await this.generateOverallAnalysis(
        base64Image, 
        pageUrl, 
        ocrText, 
        uiElements, 
        accessibilityIssues
      );

      const visionAnalysis: VisionAnalysis = {
        url: pageUrl,
        timestamp: startTime.toISOString(),
        screenshots: [{
          viewport,
          imagePath,
          analysis: analysisResult.analysis,
          extractedText: ocrText,
          confidence: analysisResult.confidence
        }],
        ocrText,
        uiElements,
        accessibilityIssues,
        layoutAnalysis,
        recommendations: analysisResult.recommendations,
      };

      return visionAnalysis;

    } catch (error) {
      console.error(chalk.red(`    ❌ Vision analysis failed: ${error}`));
      throw error;
    }
  }

  /**
   * Extract text content from an image using OCR
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `
        Extract all readable text from this screenshot. 
        Focus on:
        - Navigation menus and labels
        - Headings and content text
        - Button labels and form fields
        - Any other visible text elements
        
        Return only the extracted text, separated by newlines, maintaining the reading order from top to bottom, left to right.
      `;

      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Image}`
              }
            ]
          }
        ]
      });

      return result.text.trim();

    } catch (error) {
      console.error(chalk.red(`    ❌ OCR extraction failed: ${error}`));
      return '';
    }
  }

  /**
   * Detect and classify UI elements in the screenshot
   */
  async detectUIElements(imagePath: string): Promise<UIElement[]> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `
        Analyze this screenshot and identify all interactive UI elements. 
        For each element, provide:
        - Type (button, link, form, input, image, heading, navigation, etc.)
        - Visible text or label
        - Approximate position and size
        - Visual attributes (colors, visibility, etc.)
        - Accessibility considerations (alt text, labels, contrast, size)
        
        Focus on elements that users would interact with or that are important for accessibility.
      `;

      const uiElementSchema = z.object({
        elements: z.array(z.object({
          type: z.enum(['button', 'link', 'form', 'input', 'image', 'heading', 'navigation', 'content', 'footer', 'header', 'modal', 'card', 'menu', 'unknown']),
          text: z.string().optional(),
          position: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
          }),
          attributes: z.object({
            color: z.string().optional(),
            backgroundColor: z.string().optional(),
            fontSize: z.number().optional(),
            fontWeight: z.string().optional(),
            visible: z.boolean(),
            clickable: z.boolean()
          }),
          accessibility: z.object({
            hasAltText: z.boolean(),
            hasLabel: z.boolean(),
            contrastRatio: z.number().optional(),
            contrastIssue: z.boolean(),
            sizeIssue: z.boolean(),
            tooSmall: z.boolean()
          }),
          confidence: z.number()
        }))
      });

      const result = await generateObject({
        model: this.model,
        schema: uiElementSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Image}`
              }
            ]
          }
        ]
      });

      return result.object.elements;

    } catch (error) {
      console.error(chalk.red(`    ❌ UI element detection failed: ${error}`));
      return [];
    }
  }

  /**
   * Analyze accessibility issues from visual inspection
   */
  async analyzeAccessibility(imagePath: string): Promise<VisualAccessibilityIssue[]> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `
        Analyze this screenshot for visual accessibility issues:
        
        1. Color contrast problems (text on backgrounds)
        2. Text size issues (too small to read easily)
        3. Touch target size problems (buttons/links too small)
        4. Missing visual labels or descriptions
        5. Information conveyed by color alone
        6. Missing focus indicators
        
        For each issue found, specify the type, severity, description, and recommendation for fixing it.
      `;

      const accessibilitySchema = z.object({
        issues: z.array(z.object({
          type: z.enum(['contrast', 'text-size', 'touch-target', 'missing-labels', 'color-only', 'focus-indicator']),
          severity: z.enum(['low', 'medium', 'high', 'critical']),
          description: z.string(),
          recommendation: z.string()
        }))
      });

      const result = await generateObject({
        model: this.model,
        schema: accessibilitySchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Image}`
              }
            ]
          }
        ]
      });

      return result.object.issues;

    } catch (error) {
      console.error(chalk.red(`    ❌ Accessibility analysis failed: ${error}`));
      return [];
    }
  }

  /**
   * Analyze layout and responsive design aspects
   */
  async analyzeLayout(imagePath: string): Promise<LayoutAnalysis> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const viewport = this.extractViewportFromPath(imagePath);

      const prompt = `
        Analyze this ${viewport.name} (${viewport.width}x${viewport.height}) screenshot for layout quality:
        
        1. Is the layout appropriate for this viewport size?
        2. Are there any overflow issues (horizontal scrolling, cut-off content)?
        3. Are elements properly spaced and aligned?
        4. Is the content readable and well-organized?
        5. Does it appear mobile-optimized (if mobile/tablet)?
        6. Are there any layout inconsistencies or problems?
        
        Provide a readability score from 1-10 and identify specific issues.
      `;

      const layoutSchema = z.object({
        responsive: z.boolean(),
        breakpoints: z.array(z.string()),
        overflowIssues: z.array(z.object({
          type: z.enum(['horizontal', 'vertical']),
          element: z.string(),
          severity: z.enum(['minor', 'major'])
        })),
        spacingIssues: z.array(z.object({
          type: z.enum(['cramped', 'excessive', 'inconsistent']),
          elements: z.array(z.string()),
          recommendation: z.string()
        })),
        alignmentIssues: z.array(z.object({
          type: z.enum(['misaligned', 'inconsistent']),
          elements: z.array(z.string()),
          severity: z.enum(['minor', 'major'])
        })),
        readabilityScore: z.number().min(1).max(10),
        mobileOptimized: z.boolean()
      });

      const result = await generateObject({
        model: this.model,
        schema: layoutSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Image}`
              }
            ]
          }
        ]
      });

      return result.object;

    } catch (error) {
      console.error(chalk.red(`    ❌ Layout analysis failed: ${error}`));
      return {
        responsive: false,
        breakpoints: [],
        overflowIssues: [],
        spacingIssues: [],
        alignmentIssues: [],
        readabilityScore: 5,
        mobileOptimized: false
      };
    }
  }

  /**
   * Compare layouts across different viewports
   */
  async compareViewports(screenshots: ScreenshotSet): Promise<LayoutComparison> {
    try {
      console.log(chalk.gray(`    📊 Comparing viewport layouts...`));

      const imageBuffers = await Promise.all([
        fs.readFile(screenshots.desktop),
        fs.readFile(screenshots.tablet), 
        fs.readFile(screenshots.mobile)
      ]);

      const base64Images = imageBuffers.map(buffer => buffer.toString('base64'));

      const prompt = `
        Compare these three screenshots of the same page across different viewports:
        1. Desktop (1920x1080)
        2. Tablet (768x1024)  
        3. Mobile (375x667)
        
        Analyze:
        - Layout consistency across viewports
        - Content parity (same content visible)
        - Navigation consistency
        - Any significant differences or issues
        - Overall responsive design quality
        
        Rate the layout consistency from 0-100 and identify specific differences.
      `;

      const comparisonSchema = z.object({
        consistency: z.number().min(0).max(100),
        contentParity: z.boolean(),
        navigationConsistency: z.boolean(),
        differences: z.array(z.object({
          viewport1: z.string(),
          viewport2: z.string(),
          type: z.enum(['layout', 'content', 'navigation', 'styling']),
          description: z.string(),
          severity: z.enum(['minor', 'major'])
        })),
        recommendations: z.array(z.string())
      });

      const result = await generateObject({
        model: this.model,
        schema: comparisonSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Images[0]}`
              },
              {
                type: 'image', 
                image: `data:image/png;base64,${base64Images[1]}`
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Images[2]}`
              }
            ]
          }
        ]
      });

      return result.object;

    } catch (error) {
      console.error(chalk.red(`    ❌ Viewport comparison failed: ${error}`));
      return {
        consistency: 50,
        differences: [],
        recommendations: ['Unable to perform comparison due to analysis error']
      };
    }
  }

  /**
   * Run complete AI vision analysis for a page
   */
  async runVisionAnalysis(pageUrl: string, sessionId: string): Promise<TestResult> {
    const pageName = this.sessionManager.getPageName(pageUrl);
    
    // Create initial test result using simple system
    const testResult = this.sessionManager.createTestResult('ai-vision');

    try {
      console.log(chalk.gray(`    🤖 Running AI vision analysis...`));

      // Find existing screenshots for this page
      const screenshotPaths = await this.findScreenshots(sessionId, pageName);
      
      if (screenshotPaths.length === 0) {
        throw new Error('No screenshots found for AI vision analysis. Screenshots test must be run first.');
      }

      // Analyze each screenshot
      const analyses: VisionAnalysis[] = [];
      for (const screenshotPath of screenshotPaths) {
        const analysis = await this.analyzeScreenshot(screenshotPath, pageUrl);
        analyses.push(analysis);
      }

      // If we have multiple viewports, compare them
      let viewportComparison: ViewportComparison | undefined;
      if (screenshotPaths.length >= 3) {
        const screenshotSet = this.organizeScreenshotPaths(screenshotPaths, pageUrl, pageName);
        if (screenshotSet) {
          const comparison = await this.compareViewports(screenshotSet);
          viewportComparison = {
            layoutConsistency: comparison.consistency,
            contentParity: comparison.consistency > 80,
            navigationConsistency: comparison.consistency > 70,
            differences: comparison.differences
          };
        }
      }

      // Combine analyses into comprehensive report
      const combinedAnalysis = this.combineAnalyses(analyses, viewportComparison);
      
      // Generate report
      const report = this.generateVisionReport(combinedAnalysis, pageUrl);

      // Generate output path using simple canonical method
      const filename = `${pageName}-ai-vision-analysis.md`;
      const outputPath = this.sessionManager.buildFilePath(sessionId, pageName, 'scans', filename);
      
      // Ensure directory exists and save file
      await this.sessionManager.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, report, 'utf8');

      testResult.status = 'success';
      testResult.outputPath = outputPath;
      testResult.endTime = new Date();

      console.log(chalk.green(`    ✅ AI vision analysis completed`));

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : String(error);
      testResult.endTime = new Date();
      
      console.log(chalk.red(`    ❌ AI vision analysis failed: ${testResult.error}`));
    }

    return testResult;
  }

  /**
   * Generate overall analysis using AI
   */
  private async generateOverallAnalysis(
    base64Image: string, 
    pageUrl: string, 
    ocrText: string, 
    uiElements: UIElement[], 
    accessibilityIssues: VisualAccessibilityIssue[]
  ): Promise<{ analysis: string; confidence: number; recommendations: string[] }> {
    
    const prompt = `
      Provide a comprehensive analysis of this webpage screenshot.
      
      Context:
      - URL: ${pageUrl}
      - Extracted text: ${ocrText.substring(0, 500)}...
      - UI Elements detected: ${uiElements.length}
      - Accessibility issues found: ${accessibilityIssues.length}
      
      Analyze:
      1. Overall design quality and user experience
      2. Visual hierarchy and content organization  
      3. Brand consistency and professional appearance
      4. Potential usability issues
      5. Mobile responsiveness indicators
      6. Content clarity and readability
      
      Provide an overall confidence score (0-100) for the analysis accuracy.
    `;

    const analysisSchema = z.object({
      analysis: z.string(),
      confidence: z.number().min(0).max(100),
      recommendations: z.array(z.string())
    });

    try {
      const result = await generateObject({
        model: this.model,
        schema: analysisSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/png;base64,${base64Image}`
              }
            ]
          }
        ]
      });

      return result.object;

    } catch (error) {
      return {
        analysis: 'Analysis could not be completed due to an error.',
        confidence: 0,
        recommendations: ['Retry analysis or check screenshot quality']
      };
    }
  }

  /**
   * Find screenshot files for a specific page
   */
  private async findScreenshots(sessionId: string, pageName: string): Promise<string[]> {
    const screenshotsDir = this.sessionManager.buildFilePath(sessionId, pageName, 'screenshots', '');
    
    try {
      const files = await fs.readdir(path.dirname(screenshotsDir));
      const screenshotFiles = files
        .filter(file => file.endsWith('.png') && file.includes(pageName))
        .map(file => path.join(path.dirname(screenshotsDir), file));
      
      return screenshotFiles;
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract viewport configuration from screenshot file path
   */
  private extractViewportFromPath(imagePath: string): ViewportConfig {
    const filename = path.basename(imagePath);
    
    if (filename.includes('desktop')) {
      return { name: 'desktop', width: 1920, height: 1080 };
    } else if (filename.includes('tablet')) {
      return { name: 'tablet', width: 768, height: 1024 };
    } else if (filename.includes('mobile')) {
      return { name: 'mobile', width: 375, height: 667 };
    }
    
    return { name: 'unknown', width: 1920, height: 1080 };
  }

  /**
   * Organize screenshot paths into a ScreenshotSet structure
   */
  private organizeScreenshotPaths(screenshotPaths: string[], pageUrl: string, pageName: string): ScreenshotSet | null {
    const desktop = screenshotPaths.find(path => path.includes('desktop'));
    const tablet = screenshotPaths.find(path => path.includes('tablet'));
    const mobile = screenshotPaths.find(path => path.includes('mobile'));

    if (!desktop || !tablet || !mobile) {
      return null;
    }

    return {
      desktop,
      tablet,
      mobile,
      url: pageUrl,
      pageName
    };
  }

  /**
   * Combine multiple viewport analyses into one comprehensive analysis
   */
  private combineAnalyses(analyses: VisionAnalysis[], viewportComparison?: ViewportComparison): VisionAnalysis {
    if (analyses.length === 0) {
      throw new Error('No analyses to combine');
    }

    const baseAnalysis = analyses[0];
    
    // Combine all screenshots
    const allScreenshots = analyses.flatMap(a => a.screenshots);
    
    // Combine all UI elements (deduplicate similar ones)
    const allUIElements = analyses.flatMap(a => a.uiElements);
    
    // Combine all accessibility issues (deduplicate)
    const allAccessibilityIssues = analyses.flatMap(a => a.accessibilityIssues);
    
    // Combine all recommendations
    const allRecommendations = [...new Set(analyses.flatMap(a => a.recommendations))];
    
    // Combine OCR text from all viewports
    const combinedOCRText = analyses.map(a => a.ocrText).join('\n\n---\n\n');

    return {
      ...baseAnalysis,
      screenshots: allScreenshots,
      ocrText: combinedOCRText,
      uiElements: allUIElements,
      accessibilityIssues: allAccessibilityIssues,
      recommendations: allRecommendations,
      viewportComparison
    };
  }

  /**
   * Generate comprehensive vision analysis report in Markdown format
   */
  private generateVisionReport(analysis: VisionAnalysis, pageUrl: string): string {
    let report = `# AI Vision Analysis Report\n\n`;
    report += `**URL:** ${pageUrl}\n`;
    report += `**Analysis Date:** ${analysis.timestamp}\n`;
    report += `**Screenshots Analyzed:** ${analysis.screenshots.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    if (analysis.screenshots.length > 0) {
      report += `${analysis.screenshots[0].analysis}\n\n`;
      report += `**Analysis Confidence:** ${analysis.screenshots[0].confidence}%\n\n`;
    }

    // Screenshot Analysis by Viewport
    report += `## Viewport Analysis\n\n`;
    for (const screenshot of analysis.screenshots) {
      report += `### ${screenshot.viewport.name.charAt(0).toUpperCase() + screenshot.viewport.name.slice(1)} (${screenshot.viewport.width}x${screenshot.viewport.height})\n\n`;
      report += `**Screenshot:** \`${path.basename(screenshot.imagePath)}\`\n\n`;
      report += `${screenshot.analysis}\n\n`;
      
      if (screenshot.extractedText) {
        report += `**Extracted Text Preview:**\n`;
        report += `\`\`\`\n${screenshot.extractedText.substring(0, 300)}${screenshot.extractedText.length > 300 ? '...' : ''}\n\`\`\`\n\n`;
      }
    }

    // UI Elements Analysis
    if (analysis.uiElements.length > 0) {
      report += `## UI Elements Detected\n\n`;
      report += `**Total Elements:** ${analysis.uiElements.length}\n\n`;
      
      const elementsByType = analysis.uiElements.reduce((acc, element) => {
        acc[element.type] = (acc[element.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `**Element Distribution:**\n`;
      Object.entries(elementsByType).forEach(([type, count]) => {
        report += `- **${type}:** ${count}\n`;
      });
      report += '\n';

      // High-confidence elements
      const highConfidenceElements = analysis.uiElements.filter(el => el.confidence > 80);
      if (highConfidenceElements.length > 0) {
        report += `### Key Interactive Elements\n\n`;
        highConfidenceElements.slice(0, 10).forEach((element, index) => {
          report += `${index + 1}. **${element.type}** ${element.text ? `- "${element.text}"` : ''}\n`;
          report += `   - Position: (${element.position.x}, ${element.position.y}) ${element.position.width}x${element.position.height}\n`;
          report += `   - Clickable: ${element.attributes.clickable ? 'Yes' : 'No'}\n`;
          report += `   - Accessibility: ${element.accessibility.hasLabel ? 'Has Label' : 'Missing Label'}${element.accessibility.contrastIssue ? ', Contrast Issue' : ''}\n\n`;
        });
      }
    }

    // Accessibility Issues
    if (analysis.accessibilityIssues.length > 0) {
      report += `## Visual Accessibility Issues\n\n`;
      report += `**Total Issues Found:** ${analysis.accessibilityIssues.length}\n\n`;

      const issuesBySeverity = analysis.accessibilityIssues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      report += `**Issues by Severity:**\n`;
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        if (issuesBySeverity[severity]) {
          const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : '📝';
          report += `- ${icon} **${severity.charAt(0).toUpperCase() + severity.slice(1)}:** ${issuesBySeverity[severity]}\n`;
        }
      });
      report += '\n';

      // Detailed issues
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const severityIssues = analysis.accessibilityIssues.filter(issue => issue.severity === severity);
        if (severityIssues.length > 0) {
          report += `### ${severity.charAt(0).toUpperCase() + severity.slice(1)} Priority Issues\n\n`;
          severityIssues.forEach((issue, index) => {
            report += `#### ${index + 1}. ${issue.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
            report += `**Description:** ${issue.description}\n`;
            report += `**Recommendation:** ${issue.recommendation}\n\n`;
          });
        }
      });
    } else {
      report += `## Visual Accessibility Issues\n\n`;
      report += `✅ **No visual accessibility issues detected!**\n\n`;
      report += `The AI analysis found no obvious visual accessibility problems, though manual testing is still recommended.\n\n`;
    }

    // Layout Analysis
    if (analysis.layoutAnalysis) {
      report += `## Layout & Responsive Design Analysis\n\n`;
      
      const layout = analysis.layoutAnalysis;
      report += `**Responsive Design:** ${layout.responsive ? '✅ Yes' : '❌ No'}\n`;
      report += `**Mobile Optimized:** ${layout.mobileOptimized ? '✅ Yes' : '❌ No'}\n`;
      report += `**Readability Score:** ${layout.readabilityScore}/10\n\n`;

      if (layout.overflowIssues.length > 0) {
        report += `### Overflow Issues\n\n`;
        layout.overflowIssues.forEach((issue, index) => {
          const severity = issue.severity === 'major' ? '🚨' : '⚠️';
          report += `${index + 1}. ${severity} **${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} overflow** in ${issue.element}\n`;
        });
        report += '\n';
      }

      if (layout.spacingIssues.length > 0) {
        report += `### Spacing Issues\n\n`;
        layout.spacingIssues.forEach((issue, index) => {
          report += `${index + 1}. **${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} spacing** affecting: ${issue.elements.join(', ')}\n`;
          report += `   *Recommendation:* ${issue.recommendation}\n\n`;
        });
      }

      if (layout.alignmentIssues.length > 0) {
        report += `### Alignment Issues\n\n`;
        layout.alignmentIssues.forEach((issue, index) => {
          const severity = issue.severity === 'major' ? '🚨' : '⚠️';
          report += `${index + 1}. ${severity} **${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} alignment** in: ${issue.elements.join(', ')}\n`;
        });
        report += '\n';
      }
    }

    // Viewport Comparison
    if (analysis.viewportComparison) {
      report += `## Cross-Viewport Consistency\n\n`;
      const comparison = analysis.viewportComparison;
      
      report += `**Layout Consistency Score:** ${comparison.layoutConsistency}/100\n`;
      report += `**Content Parity:** ${comparison.contentParity ? '✅ Consistent' : '❌ Inconsistent'}\n`;
      report += `**Navigation Consistency:** ${comparison.navigationConsistency ? '✅ Consistent' : '❌ Inconsistent'}\n\n`;

      if (comparison.differences.length > 0) {
        report += `### Cross-Viewport Differences\n\n`;
        comparison.differences.forEach((diff, index) => {
          const severity = diff.severity === 'major' ? '🚨' : '⚠️';
          report += `${index + 1}. ${severity} **${diff.type.charAt(0).toUpperCase() + diff.type.slice(1)} difference** between ${diff.viewport1} and ${diff.viewport2}\n`;
          report += `   ${diff.description}\n\n`;
        });
      }
    }

    // OCR Text Extract
    if (analysis.ocrText && analysis.ocrText.trim()) {
      report += `## Extracted Text Content\n\n`;
      report += `<details>\n<summary>Click to expand extracted text</summary>\n\n`;
      report += `\`\`\`\n${analysis.ocrText.substring(0, 2000)}${analysis.ocrText.length > 2000 ? '\n\n... (truncated)' : ''}\n\`\`\`\n\n`;
      report += `</details>\n\n`;
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      report += `## AI Recommendations\n\n`;
      analysis.recommendations.forEach((recommendation, index) => {
        report += `${index + 1}. ${recommendation}\n`;
      });
      report += '\n';
    }

    // Technical Details
    report += `## Technical Details\n\n`;
    report += `- **Analysis Engine:** Google Gemini Vision AI\n`;
    report += `- **Processing Date:** ${new Date().toISOString()}\n`;
    report += `- **Screenshots Processed:** ${analysis.screenshots.length}\n`;
    report += `- **UI Elements Detected:** ${analysis.uiElements.length}\n`;
    report += `- **Visual Issues Found:** ${analysis.accessibilityIssues.length}\n\n`;

    report += `---\n\n`;
    report += `*This analysis was generated using AI vision technology and should be supplemented with manual testing and human review.*\n`;

    return report;
  }
}