# TASK-025: Remove Unused Imports Across Test Suite

**Status**: 📋 SPECIFICATION
**Created**: 2026-02-08
**Agent**: Spec Agent
**Priority**: Low (Code Quality Improvement)
**Complexity**: Simple (Mechanical cleanup task)

---

## Overview

TypeScript compilation with `--noUnusedLocals` flag reveals **47 TS6133 warnings** for unused imports and variables across test files. While these warnings do not block functionality or test execution, they create noise in compilation output and indicate code quality issues. This specification documents the systematic removal of these unused imports to improve code maintainability and reduce developer confusion.

### Scope

- **Target**: Test files only (`tests/**/*.test.ts`)
- **Issue Type**: TS6133 "declared but never read" warnings
- **Count**: 47 warnings across 21+ test files
- **Impact**: Non-blocking (tests pass, no runtime errors)

### Why This Matters

1. **Reduced Noise**: Clean compilation output makes real issues more visible
2. **Code Hygiene**: Indicates ongoing maintenance and attention to detail
3. **Developer Experience**: Reduces confusion about what's actually being used
4. **Future Compatibility**: Prepares for potential stricter TypeScript configurations

---

## Problem Statement

### Current State

Running `npx tsc --noUnusedLocals --noEmit` produces 47 TS6133 warnings in test files:

**Common Patterns Identified:**

1. **Unused Vitest Imports** (12 instances)
   - `vi` - Mock utility imported but not used
   - `beforeEach` - Setup hook imported but no setup needed
   - `afterEach` - Teardown hook imported but no teardown needed
   - `beforeAll`, `afterAll` - Suite-level hooks imported but unused

2. **Unused Type Imports** (18 instances)
   - Test-specific types imported but tests simplified
   - Types imported for documentation but not enforced
   - Legacy types from refactored tests

3. **Unused Variables** (17 instances)
   - Database handles declared but operations inlined
   - Results captured but not asserted
   - Mock objects created but tests don't need them

### Example Files Affected

```
tests/ideation/streaming.test.ts:1:38 - 'beforeEach' is declared but never read
tests/ideation/witty-interjections.test.ts:1:34 - 'vi' is declared but never read
tests/ideation/witty-interjections.test.ts:1:38 - 'beforeEach' is declared but never read
tests/ideation/witty-interjections.test.ts:1:50 - 'afterEach' is declared but never read
tests/ideation/witty-interjections.test.ts:5:3 - 'maybeInjectWit' is declared but never read
tests/integration/anthropic-client.test.ts:1:32 - 'vi' is declared but never read
tests/specification/question-generator.test.ts:8:3 - 'Question' is declared but never read
tests/specification/question-generator.test.ts:9:3 - 'QuestionType' is declared but never read
tests/specification/question-generator.test.ts:10:3 - 'QuestionResult' is declared but never read
```

### Root Causes

1. **Test Refactoring**: Tests simplified but imports not cleaned up
2. **Copy-Paste Templates**: Boilerplate imports included unnecessarily
3. **Incomplete Implementation**: Tests scaffolded but not fully developed
4. **Type Import Redundancy**: TypeScript can infer types in many test contexts

---

## Requirements

### Functional Requirements

**FR-1**: Remove all unused imports identified by TS6133 in test files
**FR-2**: Remove all unused variables identified by TS6133 in test files
**FR-3**: Preserve all imports/variables that are actually used
**FR-4**: Maintain test functionality and assertions

### Non-Functional Requirements

**NFR-1**: All existing tests must continue to pass after cleanup
**NFR-2**: TypeScript compilation must succeed without new errors
**NFR-3**: No changes to test behavior or coverage
**NFR-4**: Git history should show clear, focused changes per file

---

## Technical Design

### Approach

This is a **mechanical cleanup task** with low risk. The implementation follows a systematic, file-by-file approach:

#### Phase 1: Verification (Pre-Flight Check)

```bash
# Capture baseline
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" > /tmp/baseline-warnings.txt

# Verify tests pass
npm test

# Count warnings
wc -l /tmp/baseline-warnings.txt  # Should show 47 lines
```

#### Phase 2: Systematic Removal

For each warning in the baseline:

1. **Read the file** to understand context
2. **Verify the import/variable is truly unused**
   - Search for usage in the file
   - Check for indirect usage (e.g., type inference)
   - Confirm no runtime dependencies
3. **Remove the unused import/variable**
   - Use Edit tool for surgical precision
   - Remove from import statement or delete variable declaration
4. **Verify no new errors introduced**
   ```bash
   npx tsc --noEmit <file>
   ```

#### Phase 3: Validation (Post-Flight Check)

```bash
# Verify all warnings eliminated
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/"
# Should return 0 results

# Run full test suite
npm test
# Should show all tests passing (same count as baseline)

# Verify TypeScript compilation
npx tsc --noUnusedLocals --noEmit
# Should complete successfully
```

### File-by-File Breakdown

**Category A: Vitest Hook Imports** (12 files)

- Remove unused `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
- Example: `tests/ideation/streaming.test.ts`

**Category B: Type Imports** (18 instances)

- Remove unused type imports
- Example: `tests/specification/question-generator.test.ts`

**Category C: Variable Declarations** (17 instances)

- Remove unused variable assignments
- Example: `tests/ideation/message-store.test.ts`

### Risk Analysis

| Risk                     | Likelihood | Impact | Mitigation                              |
| ------------------------ | ---------- | ------ | --------------------------------------- |
| Remove used import       | Low        | Medium | Search file thoroughly; verify with tsc |
| Break test functionality | Very Low   | High   | Run tests after each change             |
| Introduce new errors     | Very Low   | Medium | Incremental changes + tsc verification  |
| Miss some warnings       | Low        | Low    | Automated final check                   |

**Overall Risk Level**: **Very Low** - Mechanical task with automated verification

---

## Implementation Strategy

### Recommended Order

1. **Start with simple cases** (unused vi, beforeEach, afterEach)
2. **Progress to type imports** (verify no type inference dependencies)
3. **Handle variable declarations last** (may require more context analysis)

### Tools to Use

- **Edit tool**: For surgical removal of imports/variables
- **Read tool**: To understand context before removal
- **Bash tool**: For TypeScript compilation checks and test runs

### Example Implementation

**Before** (`tests/ideation/streaming.test.ts`):

```typescript
import { describe, test, expect, vi, beforeEach } from "vitest";
```

**After**:

```typescript
import { describe, test, expect } from "vitest";
```

**Before** (`tests/specification/question-generator.test.ts`):

```typescript
import {
  QuestionGenerator,
  Question,
  QuestionType,
  QuestionResult,
  createQuestionGenerator,
} from "../../agents/specification/question-generator.js";
```

**After**:

```typescript
import {
  QuestionGenerator,
  createQuestionGenerator,
} from "../../agents/specification/question-generator.js";
```

---

## Pass Criteria

### PC-1: All TS6133 Warnings Eliminated in Test Files

**Verification**:

```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/"
```

**Expected**: No output (0 warnings)

**Baseline**: 47 warnings

**Status**: ❌ Not Met

---

### PC-2: Full Test Suite Passes

**Verification**:

```bash
npm test
```

**Expected**: All tests pass (same count as baseline, currently 1773 tests)

**Status**: ❌ Not Met

---

### PC-3: No Actual Usage of "Unused" Imports Overlooked

**Verification**:

- Manual code review during implementation
- TypeScript compilation succeeds without new errors
- Runtime test execution succeeds

**Expected**: No new TS errors introduced, all tests run successfully

**Status**: ❌ Not Met

---

### PC-4: TypeScript Compilation with --noUnusedLocals Passes

**Verification**:

```bash
npx tsc --noUnusedLocals --noEmit
```

**Expected**: Compilation completes successfully with reduced warning count

**Current**: 160 total TS6133 warnings (47 in tests, 113 in source)

**Target**: 113 warnings (test warnings eliminated, source warnings unchanged)

**Status**: ❌ Not Met

---

## Dependencies

### Upstream Dependencies

None - This is an independent cleanup task

### Downstream Dependencies

None - No other tasks depend on this cleanup

### External Dependencies

- **TypeScript**: v5.x (already installed)
- **Vitest**: For test execution verification
- **npm**: For running test scripts

---

## Testing Strategy

### Test Execution Plan

1. **Baseline Capture**

   ```bash
   npm test > /tmp/baseline-tests.txt 2>&1
   ```

   - Capture test count
   - Capture pass/fail status
   - Save for comparison

2. **Incremental Verification**
   - After each file modification, run:
     ```bash
     npm test -- <modified-file>
     ```
   - Verify file-specific tests still pass

3. **Final Validation**

   ```bash
   npm test > /tmp/final-tests.txt 2>&1
   diff /tmp/baseline-tests.txt /tmp/final-tests.txt
   ```

   - Should show no test count changes
   - All tests should still pass

### TypeScript Verification Plan

1. **Per-File Checks**

   ```bash
   npx tsc --noEmit <file>
   ```

2. **Full Project Check**

   ```bash
   npx tsc --noUnusedLocals --noEmit
   ```

3. **Warning Count Tracking**

   ```bash
   # Before
   npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | wc -l
   # Expected: 160

   # After
   npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | wc -l
   # Expected: 113 (160 - 47)
   ```

---

## Rollback Plan

Given the low-risk nature and incremental approach:

1. **Git Branch Strategy**: Work in feature branch
2. **Incremental Commits**: Commit after each file or logical group
3. **Easy Rollback**: `git revert` specific commits if issues found
4. **No Database Changes**: No schema or data migrations needed

---

## Notes and Considerations

### Future Improvements

After this cleanup, consider:

1. **Enable in tsconfig.json**: Set `"noUnusedLocals": true` to prevent regression
2. **Pre-commit Hook**: Add lint check for unused imports
3. **Source Code Cleanup**: Address remaining 113 TS6133 warnings in source files (separate task)

### Current Configuration

The project's `tsconfig.json` currently has:

```json
{
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

This configuration **allows** unused imports/variables, which is why these warnings don't block builds. This task cleans up existing issues but doesn't prevent future occurrences.

### Excluded from Scope

- **Source code warnings**: 113 TS6133 warnings in non-test files (separate task)
- **Configuration changes**: Not enabling `noUnusedLocals` in tsconfig.json
- **Automated tooling**: Not adding ESLint rules or pre-commit hooks

---

## Affected Files (Complete List)

Based on TypeScript compilation output:

1. tests/e2e/task-atomic-anatomy.test.ts
2. tests/graph/block-extractor.test.ts
3. tests/ideation/message-store.test.ts
4. tests/ideation/pre-answered-mapper.test.ts
5. tests/ideation/session-manager.test.ts
6. tests/ideation/streaming.test.ts
7. tests/ideation/web-search.test.ts
8. tests/ideation/witty-interjections.test.ts
9. tests/integration/anthropic-client.test.ts
10. tests/integration/memory-graph-migration.test.ts
11. tests/integration/observability/api-to-db.test.ts
12. tests/integration/observability/python-producer-api.test.ts
13. tests/integration/parallel-execution.test.ts
14. tests/integration/supersession-flow.test.ts
15. tests/knowledge-base.test.ts
16. tests/spec-agent/acceptance.test.ts
17. tests/specification/claude-client.test.ts
18. tests/specification/context-loader.test.ts
19. tests/specification/gotcha-injector.test.ts
20. tests/specification/question-generator.test.ts
21. tests/specification/task-generator.test.ts
22. tests/sync-development.test.ts

**Total**: 22 files with 47 individual warnings

---

## Success Metrics

| Metric                   | Before          | Target          | Verification           |
| ------------------------ | --------------- | --------------- | ---------------------- |
| TS6133 warnings in tests | 47              | 0               | `tsc --noUnusedLocals` |
| Total TS6133 warnings    | 160             | 113             | `tsc --noUnusedLocals` |
| Test suite status        | ✅ 1773 passing | ✅ 1773 passing | `npm test`             |
| TypeScript compilation   | ✅ Success      | ✅ Success      | `tsc --noEmit`         |
| Files modified           | 0               | 22              | `git diff --stat`      |

---

## Conclusion

This specification provides a clear, systematic approach to eliminating 47 TS6133 warnings across the test suite. The task is low-risk, mechanical in nature, and includes comprehensive verification steps to ensure no functionality is broken. Implementation should take 30-45 minutes with careful, incremental progress.

**Recommended Next Steps**:

1. Create feature branch: `git checkout -b task-025-remove-unused-test-imports`
2. Capture baseline metrics
3. Process files incrementally with verification
4. Final validation and commit
