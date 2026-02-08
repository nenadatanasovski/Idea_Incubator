# FIX-TASK-025-8V9Y: Remove Unused Imports Across Test Suite

**Status**: READY FOR IMPLEMENTATION
**Created**: 2026-02-08
**Agent**: Spec Agent
**Priority**: Low (Code Quality)
**Estimated Effort**: 2-3 hours

---

## Overview

This task addresses the incomplete implementation of TASK-025, which aimed to remove unused imports across test files to eliminate TS6133 TypeScript compiler warnings. While the tests pass and the build succeeds, **47 TS6133 warnings remain in test files**, indicating the original task was not completed.

**Current State:**
- ✅ All tests pass (1773 passed, 4 skipped)
- ✅ Build succeeds (`npm run build` exits cleanly)
- ❌ 47 TS6133 warnings still present in test files
- ❌ Total 161 TS6133 warnings across entire codebase

**Goal:** Remove all 47 unused import warnings from test files without breaking any tests or builds.

## Problem Statement

QA verification for TASK-025 failed because the unused imports were never actually removed. The specification exists (`docs/specs/TASK-025-remove-unused-imports.md`) with detailed analysis, but no implementation occurred.

### Why This Matters

1. **Compiler Noise**: 47 warnings obscure real issues during development
2. **Code Quality**: Indicates incomplete refactoring or copy-paste errors
3. **Maintenance**: Makes it harder to spot actual problems
4. **False Positives**: Can hide real bugs where intended functionality is missing
5. **Standards**: Sets poor precedent for code cleanliness

### Impact of Unused Imports

While these warnings don't break functionality, they indicate:
- **Unused lifecycle hooks** (`beforeEach`, `afterEach`) → incomplete setup/teardown
- **Unused mocking utilities** (`vi`) → abandoned test plans or copy-paste from other tests
- **Unused type imports** → over-importing or removed functionality
- **Unused variables** → potential missed assertions or incomplete tests

## Requirements

### Functional Requirements

**FR1: Zero TS6133 Warnings in Test Files**
- Remove all unused import declarations from test files
- Remove all unused variable declarations (or prefix with `_` if must be declared)
- Ensure the command below returns 0:
  ```bash
  npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
  ```

**FR2: Preserve All Test Functionality**
- All 1773 passing tests must still pass
- No new test failures introduced
- No reduction in test coverage
- No changes to test behavior or assertions

**FR3: Safe Import Removal**
- Do not remove imports with side effects (e.g., `import './setup.js'`)
- Verify each import is genuinely unused before removal
- For variables that must be declared but unused, prefix with `_`

### Non-Functional Requirements

**NFR1: Code Quality**
- Maintain test readability
- Preserve test structure and patterns
- Follow existing code style conventions

**NFR2: Process Safety**
- Work in small batches (one directory at a time)
- Run tests after each batch
- Use git to enable easy rollback
- Document any edge cases or intentional decisions

## Technical Design

### Current Warning Distribution

**47 warnings across 20 test files:**

| Directory | Files | Warnings | Most Common Issues |
|-----------|-------|----------|-------------------|
| tests/ideation/ | 5 | 15 | `vi`, `beforeEach`, `afterEach`, unused destructured variables |
| tests/integration/ | 5 | 14 | Lifecycle hooks, unused variables |
| tests/specification/ | 5 | 9 | Type imports (`AtomicTask`, `Question`, `Gotcha`) |
| tests/spec-agent/ | 1 | 3 | Unused constants |
| tests/ (root) | 2 | 4 | `beforeAll`, `afterAll`, unused variables |
| tests/e2e/ | 1 | 1 | Unused variable |
| tests/graph/ | 1 | 1 | `afterEach` |
| **Total** | **20** | **47** | |

### Sample Warnings (First 20)

```
tests/e2e/task-atomic-anatomy.test.ts(708,11): error TS6133: 'originalTask' is declared but its value is never read.
tests/graph/block-extractor.test.ts(5,48): error TS6133: 'afterEach' is declared but its value is never read.
tests/ideation/message-store.test.ts(63,13): error TS6133: 'message' is declared but its value is never read.
tests/ideation/message-store.test.ts(114,13): error TS6133: 'message' is declared but its value is never read.
tests/ideation/pre-answered-mapper.test.ts(12,10): error TS6133: 'createEmptySignals' is declared but its value is never read.
tests/ideation/session-manager.test.ts(63,13): error TS6133: 'session' is declared but its value is never read.
tests/ideation/session-manager.test.ts(275,22): error TS6133: 'saveDb' is declared but its value is never read.
tests/ideation/streaming.test.ts(1,38): error TS6133: 'beforeEach' is declared but its value is never read.
tests/ideation/web-search.test.ts(1,34): error TS6133: 'vi' is declared but its value is never read.
tests/ideation/witty-interjections.test.ts(1,34): error TS6133: 'vi' is declared but its value is never read.
tests/ideation/witty-interjections.test.ts(1,38): error TS6133: 'beforeEach' is declared but its value is never read.
tests/ideation/witty-interjections.test.ts(1,50): error TS6133: 'afterEach' is declared but its value is never read.
tests/ideation/witty-interjections.test.ts(5,3): error TS6133: 'maybeInjectWit' is declared but its value is never read.
tests/integration/anthropic-client.test.ts(1,32): error TS6133: 'vi' is declared but its value is never read.
```

### Implementation Strategy

**Phase 1: Generate Complete Warning List (5 minutes)**

```bash
# Generate full list with line numbers and save to file
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  tee docs/specs/FIX-TASK-025-8V9Y-warnings.txt
```

**Phase 2: Process by Directory (2 hours)**

Work in small, testable batches. For each directory:

1. **Read** the warning list for that directory
2. **Open** each file and locate the unused import/variable
3. **Verify** it's truly unused:
   - Search the file for all uses of the identifier
   - Check for string references (e.g., in mock paths)
   - Check for type-only usage or JSDoc
4. **Remove** the unused import or variable:
   - Remove entire import line if all specifiers unused
   - Remove only the unused specifier if others are used
   - For variables that must be declared, prefix with `_`
5. **Test** the changes:
   ```bash
   npm test -- tests/[directory]/ --run
   ```
6. **Verify** warning eliminated:
   ```bash
   npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/[directory]/"
   ```
7. **Commit** with clear message

**Phase 3: Final Verification (30 minutes)**

```bash
# 1. Verify zero test file warnings
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  wc -l
# Expected: 0

# 2. Run full test suite
npm test --run
# Expected: 1773 passed, 4 skipped (same as before)

# 3. Build verification
npm run build
# Expected: Success with no errors
```

### Removal Patterns

**Pattern 1: Remove entire import line**
```typescript
// Before
import { vi } from "vitest";  // vi is unused

// After
// (entire line removed)
```

**Pattern 2: Remove specific specifier**
```typescript
// Before
import { describe, it, expect, vi, beforeEach } from "vitest";  // vi and beforeEach unused

// After
import { describe, it, expect } from "vitest";
```

**Pattern 3: Prefix unused variables**
```typescript
// Before (warning on line 708)
const { session, originalTask } = await setupTest();  // originalTask unused

// After (if originalTask must be declared for destructuring)
const { session, _originalTask } = await setupTest();
```

**Pattern 4: Remove unused type imports**
```typescript
// Before
import type { AtomicTask, Gotcha } from '../types.js';  // Both unused

// After
// (entire line removed)
```

### Edge Cases to Handle

1. **Side-effect imports**: Keep imports like `import './setup.js'` even if they appear unused
2. **Type-only usage**: Verify type imports aren't used in JSDoc or inline annotations
3. **String references**: Check if identifier appears in strings (e.g., mock module paths)
4. **Destructuring**: For variables from destructuring, use `_` prefix if position matters

## Implementation Plan

### Batch 1: tests/e2e/ (10 minutes)
**File:** `task-atomic-anatomy.test.ts`
**Warning:** Line 708, unused `originalTask`
**Action:** Prefix with `_` or remove if not needed for destructuring
**Test:** `npm test -- tests/e2e/task-atomic-anatomy.test.ts --run`

### Batch 2: tests/graph/ (10 minutes)
**File:** `block-extractor.test.ts`
**Warning:** Line 5, unused `afterEach`
**Action:** Remove from vitest import
**Test:** `npm test -- tests/graph/block-extractor.test.ts --run`

### Batch 3: tests/ideation/ (30 minutes)
**Files:** 5 files, 15 warnings
- `message-store.test.ts` (2 unused `message` variables)
- `pre-answered-mapper.test.ts` (unused `createEmptySignals`)
- `session-manager.test.ts` (4 unused `saveDb`, 1 unused `session`)
- `streaming.test.ts` (unused `beforeEach`)
- `web-search.test.ts` (unused `vi`)
- `witty-interjections.test.ts` (unused `vi`, `beforeEach`, `afterEach`, `maybeInjectWit`)

**Test:** `npm test -- tests/ideation/ --run`

### Batch 4: tests/integration/ (30 minutes)
**Files:** 5 files, 14 warnings
- Focus on lifecycle hooks and unused variables
**Test:** `npm test -- tests/integration/ --run`

### Batch 5: tests/spec-agent/ (15 minutes)
**File:** `acceptance.test.ts`
**Warnings:** 3 unused constants
**Test:** `npm test -- tests/spec-agent/ --run`

### Batch 6: tests/specification/ (20 minutes)
**Files:** 5 files, 9 type import warnings
- `claude-client.test.ts` (unused `AtomicTask`, `Gotcha`)
- `context-loader.test.ts` (unused `path`)
- `gotcha-injector.test.ts` (unused `Gotcha`)
- `question-generator.test.ts` (unused types)
- `task-generator.test.ts` (unused types)

**Test:** `npm test -- tests/specification/ --run`

### Batch 7: tests/ root files (15 minutes)
**Files:** `knowledge-base.test.ts`, `sync-development.test.ts`
**Warnings:** 4 total (lifecycle hooks, unused variables)
**Test:** `npm test -- tests/knowledge-base.test.ts tests/sync-development.test.ts --run`

## Pass Criteria

### ✅ Pass Criterion 1: All tests pass
```bash
npm test -- --pool=forks --poolOptions.forks.maxForks=1
```
**Expected:** All 1773 tests pass (or same count as baseline)

**Verification:**
- No new test failures
- Same number of passing tests as before
- Same number of skipped tests as before (4)

### ✅ Pass Criterion 2: Build succeeds
```bash
npm run build
```
**Expected:** TypeScript compilation completes with exit code 0

**Verification:**
- No TypeScript errors
- No new compilation warnings
- Output matches previous successful builds

### ✅ Pass Criterion 3: TypeScript compiles (Zero test file warnings)
```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
```
**Expected:** 0 (down from 47)

**Verification:**
- No TS6133 warnings in test files
- Non-test warnings (113) may remain (not in scope)
- TypeScript compilation clean for test files

## Dependencies

### Technical Dependencies
- TypeScript compiler with `--noUnusedLocals` flag
- Vitest test framework (`npm test`)
- Node.js >= 18 (for test execution)

### File Dependencies

**Test files across directories:**
- `tests/e2e/task-atomic-anatomy.test.ts`
- `tests/graph/block-extractor.test.ts`
- `tests/ideation/*.test.ts` (5 files)
- `tests/integration/*.test.ts` (5 files)
- `tests/spec-agent/acceptance.test.ts`
- `tests/specification/*.test.ts` (5 files)
- `tests/knowledge-base.test.ts`
- `tests/sync-development.test.ts`

**Related Documentation:**
- `docs/specs/TASK-025-remove-unused-imports.md` (original spec, not implemented)
- `docs/specs/TASK-025-REMOVE-UNUSED-TEST-IMPORTS.md` (duplicate spec)

### Related Tasks
- **TASK-016**: Previously cleaned `tests/unit/` and `tests/task-agent/` (completed)
- **TASK-025**: Original task (incomplete)
- **FIX-TASK-025-8V9Y**: This retry task

## Risk Assessment

### Low Risk Areas
✅ Removing truly unused imports has zero runtime impact
✅ Changes are localized to test files only
✅ Full test suite validates no breakage
✅ Git enables easy rollback if needed

### Medium Risk Areas
⚠️ **Type imports** that appear unused but are referenced in JSDoc
⚠️ **Side-effect imports** that configure test environment (e.g., `import './setup'`)
⚠️ **Variables from destructuring** where position matters

### Mitigation Strategies
1. **Manual review** of each change before committing
2. **Batch testing** after each directory is processed
3. **Git commits** after each batch for easy rollback
4. **Careful verification** of type imports and side-effect imports
5. **Use `_` prefix** for variables that must be declared but are unused

## Success Metrics

### Before Implementation
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
47

$ npm test --run | grep "Test Files"
 Test Files  106 passed (106)
      Tests  1773 passed | 4 skipped (1777)
```

### After Implementation
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
0  # ← Should be 0

$ npm test --run | grep "Test Files"
 Test Files  106 passed (106)  # ← Same as before
      Tests  1773 passed | 4 skipped (1777)  # ← Same as before
```

## Implementation Notes

### Git Workflow

```bash
# Create feature branch (optional, can work on dev)
git checkout -b fix/task-025-remove-unused-test-imports

# Work in batches
git add tests/e2e/task-atomic-anatomy.test.ts
git commit -m "fix(tests): remove unused originalTask in e2e test"

# After each batch
git add tests/ideation/
git commit -m "fix(tests): remove 15 unused imports from ideation tests"

# Final verification commit
git commit -m "verify: all 47 TS6133 warnings removed from test files (FIX-TASK-025-8V9Y)"
```

### Quality Checklist

For each file:
- [ ] Read full test file to understand context
- [ ] Verify import/variable is truly unused (search entire file)
- [ ] Check for string references or JSDoc usage
- [ ] Remove unused import or prefix variable with `_`
- [ ] Run specific test file: `npm test -- path/to/file --run`
- [ ] Verify warning eliminated: `npx tsc --noUnusedLocals --noEmit 2>&1 | grep "filename"`
- [ ] Commit with descriptive message

### Common Unused Import Types

1. **`vi` from vitest** (8 occurrences)
   - Mock utility that was planned but never used
   - Safe to remove if no `vi.mock()`, `vi.fn()`, etc.

2. **Lifecycle hooks** (7 occurrences)
   - `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
   - May indicate incomplete setup/teardown logic
   - Review if test needs them before removing

3. **Type imports** (9 occurrences)
   - TypeScript types used only in annotations
   - Verify not used in JSDoc comments
   - Safe to remove if truly unused

4. **Destructured variables** (12 occurrences)
   - Variables from destructuring that aren't used
   - Prefix with `_` if position in destructure matters
   - Remove entirely if not needed

## Future Improvements

After this task is complete, consider:

1. **Enable `noUnusedLocals` in tsconfig.json**
   - Currently: `"noUnusedLocals": false`
   - Future: `"noUnusedLocals": true`
   - Prevents future unused imports

2. **Add ESLint rule**
   ```json
   {
     "rules": {
       "@typescript-eslint/no-unused-vars": ["error", {
         "argsIgnorePattern": "^_",
         "varsIgnorePattern": "^_"
       }]
     }
   }
   ```

3. **Create TASK-026** for non-test warnings
   - 113 warnings remain in `agents/`, `server/`, `scripts/`
   - Larger scope requiring different approach

## Appendix: Full Warning List

Run this command to generate the complete list:
```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  tee docs/specs/FIX-TASK-025-8V9Y-warnings.txt
```

**Expected:** 47 warnings across 20 files

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08 15:41
**Status:** Ready for Implementation
**Next Step:** Begin Batch 1 (tests/e2e/)
