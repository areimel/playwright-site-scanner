# Playwright Site Scanner

A standalone CLI tool for running comprehensive Playwright tests against any website without requiring project integration.

## Features

🌐 **Universal Testing** - Test any website by URL  
🕷️ **Site Crawling** - Option to crawl and test entire sites  
📸 **Screenshots** - Capture responsive screenshots across viewports  
🔍 **SEO Analysis** - Comprehensive SEO scanning and reporting  
♿ **Accessibility Testing** - WCAG compliance testing with axe-core  
📊 **Progress Tracking** - Real-time progress display and queue management  
📁 **Organized Results** - Timestamped sessions with structured output  

## Installation

```bash
# Clone and setup
git clone <repository-url>
cd playwright-site-scanner
npm install
npm run build
```

## Usage

### Interactive Mode (Recommended)

Simply run the CLI without arguments to start the interactive walkthrough:

```bash
npm start
# or
node dist/cli.js
```

The interactive mode will guide you through:
1. **URL Selection** - Enter the website you want to test
2. **Crawling Option** - Choose to test a single page or crawl the entire site
3. **Test Selection** - Pick from available tests (screenshots, SEO, accessibility)
4. **Confirmation** - Review your settings before starting

### Command Mode

Start the interactive walkthrough explicitly:

```bash
npm start
# or
node dist/cli.js start
```

## Test Types

### 📸 Screenshots
- Captures screenshots across desktop, tablet, and mobile viewports
- Full-page screenshots with disabled animations for consistency
- Organized by viewport in the results folder

### 🔍 SEO Scan
- Title tag analysis (length, presence)
- Meta description evaluation
- Heading structure examination (H1-H6)
- Image alt text validation
- Internal/external link analysis
- Open Graph tag detection
- Canonical URL verification
- Structured data (Schema.org) identification

### ♿ Accessibility Scan
- WCAG 2.1 compliance testing using axe-core
- Categorized issues by severity (critical, serious, moderate, minor)
- Detailed reports with fix recommendations
- Element-specific violation details

## Output Structure

Results are organized in timestamped session folders:

```
playwright-site-scanner-sessions/
├── 07-24-2025_14-30/
│   ├── session-summary.md
│   ├── index/
│   │   ├── index-summary.md
│   │   ├── screenshots/
│   │   │   ├── index-desktop.png
│   │   │   ├── index-tablet.png
│   │   │   └── index-mobile.png
│   │   └── scans/
│   │       ├── index-seo-scan.md
│   │       └── index-accessibility-scan.md
│   └── about/
│       ├── about-summary.md
│       ├── screenshots/
│       └── scans/
```

## Requirements

- Node.js 18.0.0 or higher
- Internet connection for downloading Playwright browsers (automatically handled)

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Clean build directory
npm run clean
```

## Architecture

The tool uses an **orchestrator pattern** with modular test implementations:

- **Test Orchestrator** - Central control and coordination
- **Site Crawler** - Discovers pages to test
- **Screenshot Tester** - Captures responsive screenshots
- **SEO Tester** - Analyzes SEO elements
- **Accessibility Tester** - Runs axe-core accessibility audits
- **Session Manager** - Handles file organization and reporting
- **Progress Tracker** - Real-time status and queue management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC License - see package.json for details

## Troubleshooting

### Common Issues

**Browser Download Fails**
```bash
npx playwright install
```

**Permission Errors on Windows**
```bash
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**TypeScript Build Errors**
```bash
npm run clean
npm run build
```

### Getting Help

- Check the `session-summary.md` file for detailed error information
- Ensure the target website is accessible and not blocking automated tools
- Verify your internet connection for axe-core CDN access

## Roadmap

- [ ] Custom viewport configurations
- [ ] Performance testing integration
- [ ] Form testing capabilities
- [ ] CI/CD integration helpers
- [ ] Custom test rule configurations
- [ ] Export to multiple formats (PDF, HTML)