# Alias Path Migration Checklist

## Overview
Converting relative imports to alias paths for better modularity. Keeping same-directory imports as relative paths.

**Alias Mappings:**
- `@commands/*` → `src/commands/*`
- `@lib/*` → `src/lib/*`
- `@orchestrator/*` → `src/orchestrator/*`
- `@shared/*` → `src/types/*` (renamed from @types to avoid TypeScript conflicts)
- `@utils/*` → `src/utils/*`

## ✅ MIGRATION COMPLETE
**Status**: All files successfully updated and verified
**Build Status**: ✅ Successful
**Runtime Status**: ✅ Working with tsconfig-paths

## Files by Directory

### Root Level (2 files)
- [ ] `src/cli.ts` - 6 cross-directory imports to convert

### Commands Directory (1 file)
- [ ] `src/commands/walkthrough.ts` - 5 cross-directory imports to convert

### Library Directory (11 files)
- [ ] `src/lib/accessibility-tester.ts` - 2 cross-directory imports to convert
- [ ] `src/lib/api-key-tester.ts` - 2 cross-directory imports to convert
- [ ] `src/lib/content-scraper.ts` - 3 cross-directory imports to convert
- [ ] `src/lib/crawlee-site-crawler.ts` - No cross-directory imports (same-dir only)
- [ ] `src/lib/html-reporter.ts` - 1 cross-directory import to convert
- [ ] `src/lib/screenshot-tester.ts` - 2 cross-directory imports to convert
- [ ] `src/lib/seo-tester.ts` - 2 cross-directory imports to convert
- [ ] `src/lib/site-summary-tester.ts` - 3 cross-directory imports to convert
- [ ] `src/lib/sitemap-tester.ts` - 2 cross-directory imports to convert

### Orchestrator Directory (7 files)
- [ ] `src/orchestrator/browser-manager.ts` - 1 cross-directory import to convert
- [ ] `src/orchestrator/error-handler.ts` - 1 cross-directory import to convert
- [ ] `src/orchestrator/results-manager.ts` - 4 cross-directory imports to convert
- [ ] `src/orchestrator/test-config-manager.ts` - 3 cross-directory imports to convert
- [ ] `src/orchestrator/test-orchestrator.ts` - 16 cross-directory imports to convert
- [ ] `src/orchestrator/test-runner.ts` - 13 cross-directory imports to convert
- [ ] `src/orchestrator/ui-styler.ts` - 2 cross-directory imports to convert

### Types Directory (2 files)
- [ ] `src/types/config-types.ts` - No cross-directory imports
- [ ] `src/types/index.ts` - No cross-directory imports
- [ ] `src/types/test-phases.ts` - 1 cross-directory import to convert

### Utils Directory (15 files)
- [ ] `src/utils/ascii-art.ts` - Same-directory imports only
- [ ] `src/utils/config-loader.ts` - 2 cross-directory imports to convert
- [ ] `src/utils/parallel-executor.ts` - 1 cross-directory import to convert
- [ ] `src/utils/progress-tracker.ts` - 1 cross-directory import to convert
- [ ] `src/utils/qr-code.ts` - No cross-directory imports
- [ ] `src/utils/reporter-manager.ts` - 2 cross-directory imports to convert
- [ ] `src/utils/session-data-store.ts` - 1 cross-directory import to convert
- [ ] `src/utils/session-manager.ts` - 1 cross-directory import to convert
- [ ] `src/utils/session-progress-tracker.ts` - 1 cross-directory import to convert
- [ ] `src/utils/validation.ts` - No cross-directory imports
- [ ] `src/utils/loading-screen/index.ts` - Same-directory imports only
- [ ] `src/utils/loading-screen/loading-info.ts` - Same-directory imports only
- [ ] `src/utils/loading-screen/loading-progress-bar.ts` - Same-directory imports only
- [ ] `src/utils/loading-screen/loading-screen.ts` - 1 cross-directory import to convert
- [ ] `src/utils/loading-screen/loading-text.ts` - Same-directory imports only
- [ ] `src/utils/loading-screen/platform-detector.ts` - No imports

## Summary
- **Total Files**: 35
- **Files with Cross-Directory Imports**: 25
- **Total Cross-Directory Import Statements**: ~73
- **Files Requiring Updates**: 25
- **Files Keeping Relative Paths**: 10

## Agent Assignment
- **Agent 1**: Root + Types (3 files)
- **Agent 2**: Commands (1 file)
- **Agent 3**: Library (11 files)
- **Agent 4**: Orchestrator (7 files)
- **Agent 5**: Utils (15 files)