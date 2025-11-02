#!/usr/bin/env node

/**
 * Enhanced Build Script
 *
 * Wraps the standard TypeScript build process with detailed feedback:
 * - Build timing and duration
 * - File count statistics
 * - Error/warning summaries
 * - Clear success/failure messages
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Counts files recursively in a directory matching a pattern
 */
function countFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      count += countFiles(fullPath, pattern);
    } else if (pattern.test(item)) {
      count++;
    }
  }

  return count;
}

/**
 * Formats duration in seconds to a readable format
 */
function formatDuration(ms) {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Main build process
 */
async function build() {
  console.log(`${colors.cyan}🔨 Starting build...${colors.reset}\n`);

  const startTime = Date.now();

  // Count source TypeScript files
  const srcDir = path.join(process.cwd(), 'src');
  const tsFileCount = countFiles(srcDir, /\.ts$/);
  console.log(`${colors.dim}📁 Found ${tsFileCount} TypeScript files to compile${colors.reset}`);

  // Step 1: Clean dist directory
  console.log(`${colors.dim}🧹 Cleaning dist/ directory...${colors.reset}`);
  try {
    execSync('rimraf dist', { stdio: 'ignore' });
  } catch (error) {
    console.error(`${colors.red}❌ Failed to clean dist/ directory${colors.reset}`);
    console.error(error.message);
    process.exit(1);
  }

  // Step 2: Run TypeScript compiler
  console.log(`${colors.dim}⚙️  Compiling TypeScript...${colors.reset}\n`);

  let tscOutput = '';
  let hasErrors = false;
  let hasWarnings = false;

  try {
    // Run tsc and capture output
    const tsc = spawn('tsc', [], { shell: true });

    tsc.stdout.on('data', (data) => {
      const output = data.toString();
      tscOutput += output;
      process.stdout.write(output);
    });

    tsc.stderr.on('data', (data) => {
      const output = data.toString();
      tscOutput += output;
      process.stderr.write(output);
    });

    await new Promise((resolve, reject) => {
      tsc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          hasErrors = true;
          resolve(); // Don't reject, we want to show build summary
        }
      });

      tsc.on('error', (error) => {
        reject(error);
      });
    });

    // Analyze output for warnings
    if (tscOutput.includes('warning TS')) {
      hasWarnings = true;
    }

  } catch (error) {
    console.error(`\n${colors.red}❌ TypeScript compilation failed${colors.reset}`);
    console.error(error.message);
    process.exit(1);
  }

  const endTime = Date.now();
  const duration = formatDuration(endTime - startTime);

  console.log(); // Blank line for spacing

  // Build summary
  if (hasErrors) {
    console.log(`${colors.red}${colors.bright}❌ Build failed!${colors.reset}`);
    console.log(`   ${colors.dim}Duration: ${duration}${colors.reset}`);
    console.log(`   ${colors.red}Errors found - see above for details${colors.reset}`);
    process.exit(1);
  }

  // Count output files
  const distDir = path.join(process.cwd(), 'dist');
  const outputFileCount = countFiles(distDir, /.*/);

  if (hasWarnings) {
    console.log(`${colors.yellow}${colors.bright}⚠️  Build completed with warnings${colors.reset}`);
    console.log(`   ${colors.dim}Duration: ${duration}${colors.reset}`);
    console.log(`   ${colors.dim}Compiled: ${tsFileCount} files${colors.reset}`);
    console.log(`   ${colors.dim}Output: ${outputFileCount} files in dist/${colors.reset}`);

    // Count warnings
    const warningMatches = tscOutput.match(/warning TS/g);
    const warningCount = warningMatches ? warningMatches.length : 0;
    console.log(`   ${colors.yellow}Warnings: ${warningCount} (see above)${colors.reset}`);
  } else {
    console.log(`${colors.green}${colors.bright}✅ Build successful!${colors.reset}`);
    console.log(`   ${colors.dim}Duration: ${duration}${colors.reset}`);
    console.log(`   ${colors.dim}Compiled: ${tsFileCount} files${colors.reset}`);
    console.log(`   ${colors.dim}Output: ${outputFileCount} files in dist/${colors.reset}`);
  }
}

// Run the build
build().catch((error) => {
  console.error(`\n${colors.red}${colors.bright}❌ Build process failed${colors.reset}`);
  console.error(error);
  process.exit(1);
});
