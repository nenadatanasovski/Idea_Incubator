# TASK-016: Clean Up Unused Test Imports

**Created:** 2026-02-08
**Status:** Specification Complete
**Category:** Code Quality
**Priority:** P3
**Effort:** Small

## Overview

Remove unused imports across test files to eliminate TS6133 compilation warnings and improve code quality. This task focuses on cleaning up test files in the `tests/unit/` and `tests/task-agent/` directories that have accumulated unused imports over time, particularly from vitest testing utilities, type definitions, and event emitter contexts.

**Note:** The current `tsconfig.json` has `noUnusedLocals: false` (line 17), which suppresses TS6133 warnings. This cleanup is preventative maintenance to avoid compilation noise if this setting is enabled in the future, and to improve code readability.

## Problem Statement

Test files have accumulated unused imports that create technical debt:

1. **Vitest utilities**: Unused `vi`, `beforeEach`, `afterEach` imports
2. **Type definitions**: Unused type imports like `RedTeamPersona`, `EventContext`, `Category`
3. **Logger utilities**: Unused logger functions in some test files
4. **Event emitter types**: Unused event emitter context imports

While these don't currently generate warnings (due to `noUnusedLocals: false`), they:

- Reduce code readability
- Create confusion about test dependencies
- Would generate TS6133 warnings if stricter compilation is enabled
- Violate code cleanliness principles

## Current State Analysis

### Files with Identified Unused Imports

From analysis of test files:

1. **tests/unit/agents/specialized-evaluators.test.ts** (lines 4, 12-13)
   - Unused: `type Category as _Category` (imported but prefixed with `_`, indicating intentional non-use)

2. **tests/unit/logger.test.ts** (lines 1, 16)
   - All vitest imports are used (`vi`, `beforeEach`, `afterEach`)
   - No unused imports detected in this file

3. **tests/unit/agents/redteam-extended.test.ts** (lines 4)
   - `beforeEach` is imported and used (line 16)
   - No unused imports detected

4. **tests/unit/observability/unified-event-emitter.test.ts** (lines 7, 20-22)
   - All vitest imports used (`vi`, `beforeEach`, `afterEach`)
   - All EventContext/EventPayload types used throughout tests
   - No unused imports detected

5. **tests/unit/config.test.ts** (line 1)
   - `beforeEach` is imported and used (line 11)
   - No unused imports detected

6. **tests/task-agent/question-engine.test.ts** (line 8)
   - All imports used (`beforeAll`, `afterAll`, `beforeEach`)
   - No unused imports detected

### Pattern Analysis

After reviewing the sample files, the primary pattern found is:

- **Intentional unused imports**: Type imports prefixed with `_` (e.g., `_Category`) to acknowledge they're imported for type checking but not directly referenced

This suggests the codebase is already well-maintained. A comprehensive scan is needed to find actual unused imports across all test files.

## Requirements

### Functional Requirements

1. **FR-1: Import Detection**
   - Identify all unused imports in test files
   - Scan both `tests/unit/**/*.test.ts` and `tests/task-agent/**/*.test.ts`
   - Detect unused: vitest utilities, types, logger functions, event contexts

2. **FR-2: Import Removal**
   - Remove confirmed unused imports
   - Preserve intentionally unused imports (prefixed with `_`)
   - Maintain correct import grouping and formatting

3. **FR-3: Validation**
   - Ensure TypeScript compilation succeeds after cleanup
   - Ensure all tests pass after cleanup
   - Verify no runtime errors introduced

### Non-Functional Requirements

1. **NFR-1: Safety**
   - No functional changes to test logic
   - No changes to test assertions or behavior
   - Only import statement modifications

2. **NFR-2: Consistency**
   - Follow existing import style conventions
   - Maintain import ordering (vitest, local imports, types)

3. **NFR-3: Completeness**
   - Clean all test files in scope
   - Don't leave partial cleanup

## Technical Design

### Detection Strategy

Two approaches for identifying unused imports:

**Approach 1: Enable noUnusedLocals Temporarily**

```bash
# Modify tsconfig.json temporarily
# Set "noUnusedLocals": true
npx tsc --noEmit 2>&1 | grep "TS6133"
# Restore "noUnusedLocals": false after cleanup
```

**Approach 2: Use ESLint (Recommended)**

```bash
# If ESLint is configured with no-unused-vars rule
npx eslint tests/**/*.test.ts --no-eslintrc --parser @typescript-eslint/parser
```

**Approach 3: Manual Analysis**

```bash
# For each test file, check if imported symbols are used
# This is the safest approach for this task
```

### Cleanup Process

1. **Scan Phase**

   ```bash
   # Get all test files
   find tests/unit tests/task-agent -name "*.test.ts"
   ```

2. **Analysis Phase**
   - For each file, read imports
   - Check if each imported symbol is referenced in the file
   - Identify truly unused imports (not prefixed with `_`)

3. **Removal Phase**
   - Remove unused import statements
   - If removing one import from a multi-import statement, update the statement
   - If removing all imports from a statement, remove the entire line

4. **Validation Phase**

   ```bash
   # Verify TypeScript compilation
   npx tsc --noEmit

   # Run all tests
   npm test
   ```

### File-by-File Strategy

For each test file:

```typescript
// Example: tests/unit/example.test.ts

// BEFORE
import { describe, it, expect, vi, beforeEach } from "vitest";
import { someFunction, unusedHelper } from "../../utils/helpers.js";
import type { UnusedType, UsedType } from "../../types.js";

// AFTER (if vi, beforeEach, unusedHelper, UnusedType are unused)
import { describe, it, expect } from "vitest";
import { someFunction } from "../../utils/helpers.js";
import type { UsedType } from "../../types.js";
```

### Edge Cases

1. **Type-only imports with `_` prefix**: Keep these (intentional)

   ```typescript
   import { type Category as _Category } from "./config.js";
   ```

2. **Vitest globals**: If tests use globals, imports might seem unused
   - Check test configuration for vitest globals
   - Current tsconfig has `"types": ["vitest/globals"]`

3. **Re-exported types**: May be imported but not used in file
   - These should be removed unless there's a good reason

## Pass Criteria

### Primary Success Criteria

1. ✅ **PC-1: No TS6133 Warnings**
   - When `noUnusedLocals` is enabled temporarily, no TS6133 errors in test files
   - `npx tsc --noEmit` with modified config shows 0 unused import warnings

2. ✅ **PC-2: TypeScript Compilation**
   - `npx tsc --noEmit` completes successfully
   - Exit code 0, no compilation errors

3. ✅ **PC-3: All Tests Pass**
   - `npm test` runs successfully
   - All existing tests maintain their passing status
   - No new test failures introduced

### Secondary Success Criteria

4. ✅ **SC-1: Code Quality**
   - Import statements are clean and minimal
   - No commented-out imports
   - Consistent import formatting maintained

5. ✅ **SC-2: Documentation**
   - If any intentionally unused imports remain, document why
   - Update this spec with list of cleaned files

### Negative Criteria (Must NOT occur)

- ❌ No removal of actually used imports
- ❌ No changes to test logic or assertions
- ❌ No introduction of new compilation errors
- ❌ No test failures
- ❌ No removal of imports prefixed with `_` (intentional)

## Dependencies

### Code Dependencies

- **TypeScript Compiler**: For validation
- **Vitest**: Test framework
- **tsconfig.json**: Current configuration has `noUnusedLocals: false`

### File Dependencies

- All test files in:
  - `tests/unit/**/*.test.ts` (25 files)
  - `tests/task-agent/**/*.test.ts` (14 files)

### No External Dependencies

This task is self-contained and doesn't depend on other tasks.

## Testing Strategy

### Validation Tests

1. **Pre-cleanup Baseline**

   ```bash
   # Record current test results
   npm test > /tmp/baseline-tests.log 2>&1

   # Record current compilation status
   npx tsc --noEmit > /tmp/baseline-tsc.log 2>&1
   ```

2. **Post-cleanup Validation**

   ```bash
   # Verify TypeScript compilation
   npx tsc --noEmit
   # Expected: Success (exit 0)

   # Verify all tests pass
   npm test
   # Expected: Same number of passing tests as baseline
   ```

3. **Unused Import Detection** (Optional - for verification)
   ```bash
   # Temporarily enable strict checking
   # Edit tsconfig.json: "noUnusedLocals": true
   npx tsc --noEmit 2>&1 | grep "TS6133" | wc -l
   # Expected: 0
   # Restore: "noUnusedLocals": false
   ```

### Manual Verification

For each modified file:

- ✅ Review git diff to ensure only import lines changed
- ✅ Verify no test logic was modified
- ✅ Check that file still imports everything it needs

## Implementation Notes

### Scope Boundaries

**In Scope:**

- Test files: `tests/unit/**/*.test.ts`
- Test files: `tests/task-agent/**/*.test.ts`
- Import statement cleanup only

**Out of Scope:**

- Source files (non-test files)
- Test utilities or helpers
- Mock files
- Configuration files
- Changes to tsconfig.json settings (keep `noUnusedLocals: false`)

### Common Unused Import Patterns

Based on task description and analysis:

1. **Vitest utilities**
   - `vi` - mock/spy utilities
   - `beforeEach` - setup hooks
   - `afterEach` - teardown hooks

2. **Type imports**
   - `RedTeamPersona` types
   - `EventContext` types
   - Category types

3. **Logger utilities**
   - Various logger functions

4. **Event emitter**
   - Event emitter context types

### Safety Guidelines

1. **Always verify usage before removing**
   - Search file for symbol usage
   - Check for destructured usage
   - Check for type-only usage

2. **Preserve formatting**
   - Maintain existing import style
   - Keep proper line breaks
   - Preserve import grouping

3. **Test incrementally**
   - Clean one file at a time (or small batches)
   - Run tests after each change
   - Commit working changes

## Risks and Mitigation

### Risk 1: Removing Actually Used Imports

**Impact:** High - Would break tests
**Likelihood:** Low - TypeScript will catch this
**Mitigation:**

- Run `npx tsc --noEmit` after each change
- Run tests frequently during cleanup
- Review git diff carefully

### Risk 2: Breaking Type Inference

**Impact:** Medium - Could introduce subtle type issues
**Likelihood:** Low - TypeScript strict mode enabled
**Mitigation:**

- Full TypeScript compilation check
- Review any implicit `any` types introduced

### Risk 3: Removing Imports Used Only in Types

**Impact:** Medium - Could break type checking
**Likelihood:** Low - TypeScript will catch this
**Mitigation:**

- Check for type-only usage patterns
- Verify interfaces and type aliases

## Success Metrics

### Quantitative Metrics

- **Test Files Cleaned**: Target all ~39 test files (25 unit + 14 task-agent)
- **Unused Imports Removed**: Track count (TBD during implementation)
- **Tests Still Passing**: 100% (same as before)
- **Compilation Errors**: 0 (same as before)

### Qualitative Metrics

- **Code Readability**: Improved clarity of test dependencies
- **Maintainability**: Easier to understand what each test uses
- **Future-proofing**: Ready for stricter TypeScript settings

## Implementation Checklist

- [ ] Create baseline: Run tests and record results
- [ ] Create baseline: Run TypeScript compilation and record results
- [ ] Scan all test files and identify unused imports
- [ ] Clean unused imports from `tests/unit/` files
- [ ] Clean unused imports from `tests/task-agent/` files
- [ ] Run TypeScript compilation validation
- [ ] Run full test suite validation
- [ ] Review git diff for all changes
- [ ] Document any edge cases or intentional unused imports
- [ ] Update this spec with final counts and results

## Appendix A: Example Files Reviewed

Files analyzed during spec creation:

1. `tests/unit/agents/redteam-extended.test.ts` - Clean ✅
2. `tests/unit/agents/specialized-evaluators.test.ts` - Has intentional unused import (`_Category`)
3. `tests/unit/config.test.ts` - Clean ✅
4. `tests/unit/logger.test.ts` - Clean ✅
5. `tests/unit/observability/unified-event-emitter.test.ts` - Clean ✅
6. `tests/task-agent/question-engine.test.ts` - Clean ✅

**Initial Assessment**: The codebase appears well-maintained. Most test files don't have obvious unused imports. A comprehensive scan with TypeScript compiler (`noUnusedLocals: true`) will reveal the full scope.

## Appendix B: TypeScript Configuration Reference

Current `tsconfig.json` settings (relevant excerpt):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false, // Line 17 - Currently disabled
    "noUnusedParameters": false, // Line 18
    "types": ["vitest/globals"] // Line 21 - Vitest globals enabled
  }
}
```

This configuration means:

- TypeScript won't warn about unused imports (TS6133)
- Vitest functions (`describe`, `it`, `expect`) are available globally
- This cleanup is preventative, not corrective
