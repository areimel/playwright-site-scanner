# Standalone CLI Packaging Guide

This document explains how to package the Playwright Site Scanner as standalone executables for distribution without Node.js dependencies.

## Overview

The project uses **yao-pkg** (an active fork of vercel/pkg) to create standalone executables for Windows, macOS, and Linux. The packaging system includes browser management capabilities to handle Playwright's browser binary dependencies.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Development dependencies installed (`npm install`)

## Quick Start

### Build All Binaries
```bash
npm run build:binaries
```

### Build Individual Platform Binaries
```bash
# Windows
npm run pkg:win

# macOS
npm run pkg:mac

# Linux
npm run pkg:linux
```

### Build with Shell Script (Unix-like systems)
```bash
npm run build:binaries:shell
```

## Architecture

### Browser Management System

The packaging system includes a comprehensive browser management system to handle Playwright's browser binary dependencies:

#### BrowserManager Class (`src/utils/browser-manager.ts`)
- **Browser Detection**: Automatically detects installed Playwright browsers
- **System Browser Fallback**: Falls back to system-installed browsers if Playwright browsers aren't available
- **Download Management**: Handles automatic browser downloads when needed
- **Path Resolution**: Resolves browser executable paths for different platforms

#### CLI Browser Commands
```bash
# Check browser installation status
./playwright-site-scanner browsers:check

# List available browsers and their status
./playwright-site-scanner browsers:list

# Install Playwright browsers
./playwright-site-scanner browsers:install

# Install specific browsers
./playwright-site-scanner browsers:install --browsers chromium,firefox
```

#### CLI Options for Browser Management
```bash
# Start with automatic browser download
./playwright-site-scanner start --download-browsers

# Use custom browser path
./playwright-site-scanner start --browser-path /path/to/browser

# Skip browser availability check
./playwright-site-scanner start --skip-browser-check
```

### Build System

#### Configuration (`package.json`)
```json
{
  "pkg": {
    "scripts": ["dist/**/*.js"],
    "assets": ["package.json"],
    "targets": [
      "node18-win-x64",
      "node18-macos-x64", 
      "node18-linux-x64"
    ],
    "outputPath": "dist/binaries",
    "options": [
      "--no-bytecode",
      "--public-packages=*"
    ]
  }
}
```

#### Build Scripts
- **`scripts/build-binaries.js`**: Node.js-based build script with detailed logging
- **`scripts/build-binaries.sh`**: Shell script for Unix-like systems
- Both scripts provide progress tracking, error handling, and post-build instructions

## Platform-Specific Considerations

### Windows
- **Output**: `playwright-site-scanner-win.exe`
- **Size**: ~67MB (includes Node.js runtime)
- **Browser Paths**: Checks Program Files and AppData directories
- **Installation**: Can be distributed as standalone executable

### macOS
- **Output**: `playwright-site-scanner-macos` 
- **Size**: ~65MB (includes Node.js runtime)
- **Browser Paths**: Checks Applications directory
- **Code Signing**: May require code signing for distribution

### Linux
- **Output**: `playwright-site-scanner-linux`
- **Size**: ~65MB (includes Node.js runtime)
- **Browser Paths**: Checks `/usr/bin`, `/snap/bin` directories
- **Dependencies**: May require additional system libraries

## Browser Binary Distribution Strategy

### Challenge
Playwright requires browser binaries (~300MB+ total) that pkg cannot bundle directly due to:
- Binary file size limitations
- Runtime path resolution issues
- Platform-specific browser requirements

### Solution
**External Browser Management** approach:

1. **Standalone Executable**: Contains the CLI logic without browsers
2. **Post-Install Browser Setup**: Users install browsers after executable installation
3. **Smart Detection**: Automatic browser detection and download capabilities
4. **Fallback Support**: System browser detection as fallback option

### Browser Installation Workflow
```bash
# 1. Download and run standalone executable
./playwright-site-scanner

# 2. Install browsers (first-time setup)
./playwright-site-scanner browsers:install

# 3. Verify installation
./playwright-site-scanner browsers:check

# 4. Run tests
./playwright-site-scanner start
```

## Known Issues and Solutions

### ES Module Compatibility
**Issue**: ES modules (like chalk v5+) cause runtime errors in packaged binaries.

**Solution**: Use CommonJS-compatible versions:
```bash
npm install chalk@4  # Use v4 instead of v5+
```

### Browser Path Resolution
**Issue**: Packaged executables may not find browser binaries.

**Solutions**:
1. Use `--browser-path` to specify custom browser location
2. Install browsers using built-in commands
3. Use system browsers as fallback

### Large Binary Size
**Issue**: Binaries are 65-67MB due to bundled Node.js runtime.

**Mitigation**:
- GZip compression enabled (`--compress GZip`)
- Only essential dependencies bundled
- Browser binaries distributed separately

## Testing Binaries

### Basic Functionality Test
```bash
# Test CLI help
./playwright-site-scanner --help

# Test browser commands
./playwright-site-scanner browsers:list
./playwright-site-scanner browsers:check
```

### Full Integration Test
```bash
# Install browsers
./playwright-site-scanner browsers:install

# Run complete test with browser download
./playwright-site-scanner start --download-browsers
```

## Distribution Options

### Current: Standalone Executables
- ✅ No Node.js dependency
- ✅ Single file distribution
- ❌ Large file size (~67MB)
- ❌ Browser binaries separate

### Future: Platform-Specific Installers
- 📋 Windows: MSI installer with browser bundling
- 📋 macOS: PKG installer with browser bundling  
- 📋 Linux: AppImage or deb/rpm packages

### Alternative: Containerized Distribution
- 📋 Docker image with all dependencies
- 📋 Reduces distribution complexity
- 📋 Requires Docker runtime

## Development Workflow

### Making Changes
1. Modify source code in `src/`
2. Test with `npm run dev`
3. Build and test binary: `npm run pkg:win` (or your platform)
4. Test binary functionality
5. Create full release: `npm run build:binaries`

### Debugging Binary Issues
1. **Check Node.js version compatibility**: Binary uses Node.js 18
2. **Verify dependencies**: Ensure all deps are CommonJS compatible
3. **Test without pkg**: Run `node dist/cli.js` to isolate packaging issues
4. **Check browser paths**: Use browser management commands for debugging

## Troubleshooting

### Binary Won't Start
- Check execution permissions: `chmod +x ./playwright-site-scanner-*`
- Verify platform compatibility (x64 required)
- Check antivirus/security software blocking execution

### Browser Not Found Errors
```bash
# Install browsers
./playwright-site-scanner browsers:install

# Or specify custom path
./playwright-site-scanner start --browser-path /path/to/browser
```

### Import/Module Errors
- Ensure all dependencies are CommonJS compatible
- Check for ES module imports in error messages
- Downgrade problematic dependencies if necessary

## Performance Optimization

### Binary Size Reduction
- Use `--no-bytecode` flag (already enabled)
- Minimize dependencies in `package.json`
- Consider dependency bundling optimizations

### Startup Time
- Browser caching reduces subsequent startup time
- Consider lazy loading of heavy dependencies
- Optimize import statements

## Future Enhancements

### High Priority
- [ ] Platform-specific installer creation
- [ ] Code signing for macOS and Windows
- [ ] Browser binary bundling options

### Medium Priority  
- [ ] Alternative packaging with nexe
- [ ] AppImage creation for Linux
- [ ] Automatic update mechanism

### Low Priority
- [ ] Browser version management
- [ ] Portable mode (no installation required)
- [ ] Plugin system for extensions

## References

- [yao-pkg Documentation](https://github.com/yao-pkg/pkg)
- [Playwright Installation Guide](https://playwright.dev/docs/installation)
- [Node.js Binary Compilation Best Practices](https://nodejs.org/en/docs/guides/binary-compilation/)