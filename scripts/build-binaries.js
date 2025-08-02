#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple color functions without chalk dependency
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  white: (text) => `\x1b[37m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Configuration
const PLATFORMS = [
  { target: 'node18-win-x64', name: 'windows', ext: '.exe' },
  { target: 'node18-macos-x64', name: 'macos', ext: '' },
  { target: 'node18-linux-x64', name: 'linux', ext: '' }
];

const OUTPUT_DIR = 'dist/binaries';
const CLI_FILE = 'dist/cli.js';

function log(message, color = 'blue') {
  console.log(colors[color](message));
}

function error(message) {
  console.error(colors.red(`❌ ${message}`));
}

function success(message) {
  console.log(colors.green(`✅ ${message}`));
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`📁 Created directory: ${dir}`);
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  return (fileSizeInBytes / (1024 * 1024)).toFixed(2); // Convert to MB
}

async function buildTypeScript() {
  log('🔨 Building TypeScript...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    success('TypeScript build completed');
  } catch (err) {
    error('TypeScript build failed');
    throw err;
  }
}

async function verifyCliFile() {
  if (!fileExists(CLI_FILE)) {
    throw new Error(`CLI file not found: ${CLI_FILE}`);
  }
  
  log(`📄 CLI file verified: ${CLI_FILE}`);
}

async function buildBinaries() {
  log('\n🎯 Building platform-specific binaries...\n');
  
  ensureDirectoryExists(OUTPUT_DIR);
  
  const results = [];
  
  for (const platform of PLATFORMS) {
    const outputName = `playwright-site-scanner-${platform.name}${platform.ext}`;
    const outputPath = path.join(OUTPUT_DIR, outputName);
    
    log(`📦 Building for ${platform.name} (${platform.target})...`);
    
    try {
      const startTime = Date.now();
      
      // Build the binary
      execSync(`npx pkg ${CLI_FILE} --targets ${platform.target} --output ${outputPath} --compress GZip`, {
        stdio: 'pipe'
      });
      
      const endTime = Date.now();
      const buildTime = ((endTime - startTime) / 1000).toFixed(1);
      
      if (fileExists(outputPath)) {
        const fileSize = getFileSize(outputPath);
        success(`${platform.name} binary created (${fileSize}MB) in ${buildTime}s`);
        
        results.push({
          platform: platform.name,
          target: platform.target,
          path: outputPath,
          size: fileSize,
          buildTime: buildTime,
          success: true
        });
      } else {
        throw new Error('Binary file was not created');
      }
      
    } catch (err) {
      error(`Failed to build ${platform.name} binary: ${err.message}`);
      
      results.push({
        platform: platform.name,
        target: platform.target,
        path: outputPath,
        error: err.message,
        success: false
      });
    }
  }
  
  return results;
}

function displayResults(results) {
  log('\n📊 Build Results Summary:');
  console.log(colors.cyan('═'.repeat(80)));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    log('✅ Successful builds:');
    successful.forEach(result => {
      console.log(colors.white(`   ${result.platform.padEnd(8)} | ${result.size.padStart(8)}MB | ${result.buildTime.padStart(6)}s | ${result.path}`));
    });
  }
  
  if (failed.length > 0) {
    log('\n❌ Failed builds:');
    failed.forEach(result => {
      console.log(colors.red(`   ${result.platform.padEnd(8)} | ${result.error}`));
    });
  }
  
  console.log(colors.cyan('═'.repeat(80)));
  
  const totalSize = successful.reduce((sum, result) => sum + parseFloat(result.size), 0);
  log(`\n📈 Summary: ${successful.length}/${results.length} builds successful, Total size: ${totalSize.toFixed(2)}MB`);
  
  if (successful.length > 0) {
    log('\n💡 Usage:');
    successful.forEach(result => {
      const command = result.platform === 'windows' 
        ? `.\\${path.basename(result.path)}` 
        : `./${path.basename(result.path)}`;
      console.log(colors.gray(`   ${result.platform}: ${command}`));
    });
  }
}

function displayPostBuildInstructions() {
  log('\n📋 Next Steps:');
  console.log(colors.yellow('1. Test binaries on target platforms'));
  console.log(colors.yellow('2. Verify browser detection and download functionality'));
  console.log(colors.yellow('3. Create installers for distribution (optional)'));
  console.log(colors.yellow('4. Update documentation with installation instructions'));
  
  log('\n🔧 Binary Testing Commands:');
  console.log(colors.gray('   ./playwright-site-scanner-windows.exe browsers:check'));
  console.log(colors.gray('   ./playwright-site-scanner-macos browsers:install'));
  console.log(colors.gray('   ./playwright-site-scanner-linux start --download-browsers'));
}

async function main() {
  try {
    console.clear();
    log('🚀 Playwright Site Scanner - Binary Builder\n');
    
    // Step 1: Build TypeScript
    await buildTypeScript();
    
    // Step 2: Verify CLI file exists
    await verifyCliFile();
    
    // Step 3: Build binaries for all platforms
    const results = await buildBinaries();
    
    // Step 4: Display results
    displayResults(results);
    
    // Step 5: Show post-build instructions
    displayPostBuildInstructions();
    
    // Check if all builds were successful
    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
      success('\n🎉 All binaries built successfully!');
    } else {
      log('\n⚠️  Some builds failed. Check the summary above for details.');
      process.exit(1);
    }
    
  } catch (err) {
    error(`Build process failed: ${err.message}`);
    process.exit(1);
  }
}

// Run the build process
if (require.main === module) {
  main();
}

module.exports = { main, buildBinaries, buildTypeScript };