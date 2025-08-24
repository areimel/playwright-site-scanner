
# Project: ARDA Site Scan

## Project Overview

ARDA Site Scan is a standalone CLI tool for comprehensive website analysis. It is built with TypeScript and uses Playwright for browser automation and testing. The tool allows users to test any website by providing a URL, and it can crawl the entire site to test all pages.

The main features of ARDA Site Scan include:

*   **Screenshots:** Captures responsive screenshots across different viewports (desktop, tablet, and mobile).
*   **SEO Analysis:** Performs a comprehensive SEO scan, checking for things like meta tags, headings, and image alt text.
*   **Accessibility Testing:** Uses axe-core to test for WCAG compliance and identify accessibility issues.
*   **Sitemap Generation:** Generates an XML sitemap for the website.
*   **Content Scraping:** Extracts page content and images into Markdown files.
*   **Site Summary:** Generates a comprehensive overview report of the entire site.
*   **API Key Security Scan:** Scans the site for exposed API keys and security tokens.

The project is well-structured, with a clear separation of concerns. It uses an orchestrator pattern to manage the test execution flow, and it has a number of specialized modules for handling different tasks, such as browser management, session management, and error handling.

## Building and Running

The project uses npm for package management. The following commands can be used to build and run the project:

*   **Install dependencies:** `npm install`
*   **Build the project:** `npm run build`
*   **Run the interactive walkthrough:** `npm start` or `arda-site-scan` (if installed globally)
*   **Run in development mode:** `npm run dev`
*   **Clean the build directory:** `npm run clean`

## Development Conventions

The project follows standard TypeScript and Node.js development conventions. It uses Prettier for code formatting and ESLint for linting. The code is well-documented with JSDoc comments.

The project also has a strong focus on testing. It uses Jest for unit testing and Playwright for end-to-end testing. The tests are located in the `__tests__` directory.

## Key Files

*   `src/cli.ts`: The main entry point of the application. It uses the `commander` library to handle command-line arguments.
*   `src/commands/walkthrough.ts`: Implements the interactive walkthrough using the `inquirer` library.
*   `src/orchestrator/test-orchestrator.ts`: The core of the application. It manages the entire test execution flow.
*   `src/lib/*`: Contains the different test implementations (e.g., `screenshot-tester.ts`, `seo-tester.ts`, `accessibility-tester.ts`).
*   `package.json`: Defines the project's dependencies, scripts, and other metadata.
*   `tsconfig.json`: The configuration file for the TypeScript compiler.
