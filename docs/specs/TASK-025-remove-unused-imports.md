# TASK-025: Remove Unused Imports Across Test Suite

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-08
**Type:** Code Quality / Maintenance
**Priority:** Low
**Estimated Effort:** 2-3 hours

## Overview

Remove unused imports across test files to eliminate TS6133 TypeScript compiler warnings. Currently, 47 test files contain unused imports including vitest utilities (`vi`, `beforeEach`, `afterEach`), type imports, and variable declarations. While these warnings don't block execution, they create noise in compilation output and indicate potential code quality issues.

## Background

TypeScript's `--noUnusedLocals` compiler option detects declared variables, imports, and parameters that are never used. The project currently has 160 total TS6133 warnings across the codebase, with 47 warnings in test files (`.test.ts` and `.spec.ts`).

**Current State:**

- Total TS6133 warnings: 160
- Test file warnings: 47
- Non-test warnings: 113 (agents, server, scripts)

**Note:** TASK-016 previously addressed test imports in `tests/unit/` and `tests/task-agent/` directories, which are now clean. This task focuses on the remaining test warnings in other directories (`tests/e2e/`, `tests/integration/`, `tests/ideation/`, `tests/graph/`, `tests/spec-agent/`, `tests/specification/`, `tests/sync-development.test.ts`, `tests/knowledge-base.test.ts`).

## Problem Statement

Unused imports in test files:

1. Create compilation noise that obscures real issues
2. Indicate incomplete test refactoring or abandoned code paths
3. Suggest potential confusion about test requirements
4. Add unnecessary dependencies to test modules
5. Can mask real bugs where intended functionality is missing

## Requirements

### Functional Requirements

1. **Eliminate TS6133 Warnings in Test Files**
   - Remove all unused import declarations
   - Remove all unused variable declarations that are import-related
   - Ensure no test file generates TS6133 warnings

2. **Preserve Test Functionality**
   - All existing tests must continue passing
   - No test behavior changes
   - No coverage reduction

3. **Handle Different Import Categories**
   - **Vitest utilities**: `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
   - **Type imports**: TypeScript types used only in type annotations
   - **Utility functions**: Imported but never called
   - **Module imports**: Imported for side effects but unused

### Non-Functional Requirements

1. **Code Quality**
   - Maintain test readability
   - Preserve test structure and patterns
   - Follow existing code style

2. **Safety**
   - No accidental removal of imports that appear unused but have side effects
   - Verify each removal with test execution

3. **Completeness**
   - Address all 47 test file warnings
   - Document any intentionally retained "unused" imports

## Technical Design

### Analysis Strategy

1. **Generate Complete Warning List**

   ```bash
   npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" > unused-imports.txt
   ```

2. **Categorize Warnings by Type**
   - Unused vitest utilities (lifecycle hooks, mocking)
   - Unused type imports
   - Unused function imports
   - Unused variable declarations

3. **Prioritize by Impact**
   - High: Imports that are clearly unused (wrong test expectations)
   - Medium: Lifecycle hooks that suggest incomplete setup/teardown
   - Low: Type imports (may be used in JSDoc or for future use)

### Implementation Approach

**Phase 1: Automated Detection (5 minutes)**

```bash
# Generate full list with line numbers
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  sort > task-025-warnings.txt
```

**Phase 2: Manual Review & Removal (2 hours)**

For each warning:

1. **Read the file** to understand context
2. **Verify the import is truly unused**:
   - Check for string references (mock paths)
   - Check for type-only usage
   - Check for side-effect imports
3. **Remove the unused import**:

   ```typescript
   // Before
   import { describe, it, expect, vi, beforeEach } from "vitest";

   // After (if vi and beforeEach unused)
   import { describe, it, expect } from "vitest";
   ```

4. **For unused variables**, consider if the test is incomplete:
   ```typescript
   // Warning indicates potential bug
   const { session } = await createSession(); // session unused
   // Should we be asserting something about session?
   ```

**Phase 3: Testing & Verification (30 minutes)**

After each batch of changes:

```bash
# Run affected tests
npm test -- path/to/modified/tests --run

# Verify warning is eliminated
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "path/to/file"
```

### File-by-File Breakdown

Based on current analysis, the 47 warnings span multiple test directories:

**tests/e2e/** (1 warning)

- `task-atomic-anatomy.test.ts:708` - unused `originalTask` variable

**tests/graph/** (1 warning)

- `block-extractor.test.ts:5` - unused `afterEach` import

**tests/ideation/** (15 warnings)

- `message-store.test.ts` - 2 unused `message` variables
- `pre-answered-mapper.test.ts` - unused `createEmptySignals` import
- `session-manager.test.ts` - 4 unused `saveDb` variables, 1 unused `session`
- `streaming.test.ts` - unused `beforeEach` import
- `web-search.test.ts` - unused `vi` import
- `witty-interjections.test.ts` - unused `vi`, `beforeEach`, `afterEach`, `maybeInjectWit`

**tests/integration/** (14 warnings)

- `anthropic-client.test.ts` - unused `vi` import
- `memory-graph-migration.test.ts` - 4 warnings (`beforeAll`, `vi`, `graphQueryService`, `db`)
- `observability/api-to-db.test.ts` - 3 unused lifecycle hooks
- `observability/python-producer-api.test.ts` - unused `transcriptResult`
- `parallel-execution.test.ts` - unused `vi`, `duration`
- `supersession-flow.test.ts` - unused `vi`, `beforeEach`, `conversationMessages`

**tests/spec-agent/** (3 warnings)

- `acceptance.test.ts` - unused `VALID_PHASES`, `refSections`, `refFrontmatter`

**tests/specification/** (9 warnings)

- `claude-client.test.ts` - unused `AtomicTask`, `Gotcha` types
- `context-loader.test.ts` - unused `path` import
- `gotcha-injector.test.ts` - unused `Gotcha` type
- `question-generator.test.ts` - unused `Question`, `QuestionType`, `QuestionResult` types
- `task-generator.test.ts` - unused `AtomicTask`, `TaskGeneratorOptions`, `GeneratedTasks` types

**tests/knowledge-base.test.ts** (2 warnings)

- Unused `pattern` variables

**tests/sync-development.test.ts** (2 warnings)

- Unused `beforeAll`, `afterAll` imports

### Special Considerations

**1. Type-Only Imports**
Some imports may appear unused but are referenced in JSDoc or type annotations:

```typescript
import type { SessionData } from "../types.js"; // May appear unused

// But used here:
/** @type {SessionData} */
const data = loadSession();
```

**2. Side-Effect Imports**
Some imports are needed for their side effects:

```typescript
import "./setup-global-mocks.js"; // Appears unused but essential
```

**3. Mock Utilities**
`vi` from vitest may be imported for future mocking that hasn't been implemented yet. Verify if the test is incomplete or if mocking isn't needed.

**4. Lifecycle Hooks**
Unused `beforeEach`, `afterEach`, etc., might indicate:

- Incomplete test setup/teardown
- Refactored tests where cleanup was removed
- Copy-paste from other tests

### Automated Tooling

Consider using ESLint rules for ongoing prevention:

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ]
  }
}
```

For variables that must be declared but unused, use `_` prefix:

```typescript
const { _unused, needed } = complexObject;
```

## Implementation Plan

### Step 1: Generate Warning Report (5 min)

```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  tee docs/specs/TASK-025-warnings.txt
```

### Step 2: Process by Directory (2 hours)

**Batch 1: tests/e2e/** (10 min)

- Review and fix `task-atomic-anatomy.test.ts`
- Run: `npm test -- tests/e2e/task-atomic-anatomy.test.ts --run`

**Batch 2: tests/graph/** (10 min)

- Review and fix `block-extractor.test.ts`
- Run: `npm test -- tests/graph/block-extractor.test.ts --run`

**Batch 3: tests/ideation/** (30 min)

- Process all 5 files with 15 warnings
- Run: `npm test -- tests/ideation/ --run`

**Batch 4: tests/integration/** (30 min)

- Process all 5 files with 14 warnings
- Run: `npm test -- tests/integration/ --run`

**Batch 5: tests/spec-agent/** (15 min)

- Fix `acceptance.test.ts`
- Run: `npm test -- tests/spec-agent/ --run`

**Batch 6: tests/specification/** (20 min)

- Process 5 files with type import warnings
- Run: `npm test -- tests/specification/ --run`

**Batch 7: Remaining tests** (15 min)

- Fix `knowledge-base.test.ts` and `sync-development.test.ts`
- Run: `npm test -- tests/knowledge-base.test.ts tests/sync-development.test.ts --run`

### Step 3: Final Verification (30 min)

```bash
# Verify no test warnings remain
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
# Expected: 0

# Run full test suite
npm test --run

# Expected: All tests passing, same count as before
```

## Pass Criteria

### Success Criteria

**1. Zero TS6133 Warnings in Test Files**

```bash
# This command must return 0
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  wc -l
```

**2. All Tests Still Pass**

```bash
npm test --run
# All tests that passed before must still pass
# No new test failures introduced
```

**3. No Actual Usage Overlooked**

- Manual review confirms each removed import was genuinely unused
- No "unused" imports that were actually needed for side effects
- No type imports removed that broke type checking

**4. TypeScript Compilation Clean**

```bash
npx tsc --noUnusedLocals --noEmit
# Exit code: 0 (or only non-test warnings remain)
```

### Verification Commands

```bash
# Pre-implementation baseline
echo "Before: $(npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l) warnings"

# Post-implementation verification
echo "After: $(npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l) warnings"

# Test suite verification
npm test --run | tee test-results.txt
grep -E "(passed|failed)" test-results.txt
```

### Expected Outcomes

- **Before**: 47 TS6133 warnings in test files
- **After**: 0 TS6133 warnings in test files
- **Test Status**: Same number of passing tests (or more if incomplete tests are fixed)
- **Side Effects**: None - purely import cleanup

## Dependencies

### Technical Dependencies

- TypeScript compiler (tsc) with `--noUnusedLocals` flag
- Vitest test framework
- Node.js test execution environment

### File Dependencies

Test files across multiple directories:

- `tests/e2e/` - End-to-end tests
- `tests/integration/` - Integration tests
- `tests/ideation/` - Ideation subsystem tests
- `tests/graph/` - Graph subsystem tests
- `tests/spec-agent/` - Specification agent tests
- `tests/specification/` - Specification module tests
- Root test files: `knowledge-base.test.ts`, `sync-development.test.ts`

### Related Tasks

- **TASK-016**: Cleaned up `tests/unit/` and `tests/task-agent/` (completed)
- **Future**: Consider TASK-026 for cleaning 113 non-test warnings in agents/server/scripts

## Risk Assessment

### Low Risk

- Removing truly unused imports has no runtime impact
- Changes are localized to test files
- Full test suite validates no breakage

### Medium Risk

- Type imports that appear unused but are referenced in JSDoc
- Side-effect imports that look unused but configure test environment

### Mitigation

- Manual review of each change
- Run tests after each batch of changes
- Use git to track changes and enable easy rollback
- Test locally before committing

## Implementation Notes

### Conventions

**Prefix unused variables with underscore:**

```typescript
// If variable must be declared but unused
const { _unused, needed } = destructure();
```

**Remove entire import line if all specifiers unused:**

```typescript
// Before
import { vi, beforeEach } from "vitest"; // Both unused

// After
// (entire line removed)
```

**Update multi-line imports:**

```typescript
// Before
import {
  describe,
  it,
  expect,
  vi, // Unused
  beforeEach, // Unused
} from "vitest";

// After
import { describe, it, expect } from "vitest";
```

### Quality Checklist

For each file modified:

- [ ] Read full test file to understand context
- [ ] Verify import is truly unused (search for identifier)
- [ ] Check for string references or JSDoc usage
- [ ] Remove unused import
- [ ] Run specific test file
- [ ] Verify TS6133 warning eliminated
- [ ] Commit with descriptive message

### Git Workflow

```bash
# Create feature branch
git checkout -b fix/task-025-remove-unused-test-imports

# Work in small batches
git add tests/e2e/task-atomic-anatomy.test.ts
git commit -m "fix(tests): remove unused originalTask in task-atomic-anatomy"

# Continue for each batch...

# Final commit
git commit -m "fix(tests): remove all unused imports across test suite (TASK-025)"
```

## Future Improvements

1. **Enable noUnusedLocals in tsconfig.json**
   - Currently: `"noUnusedLocals": false`
   - Future: `"noUnusedLocals": true`
   - Prevents future unused imports

2. **Add ESLint Rule**
   - `@typescript-eslint/no-unused-vars` with error level
   - Catches unused variables during development

3. **Pre-commit Hook**

   ```bash
   # .husky/pre-commit
   npx tsc --noUnusedLocals --noEmit
   ```

4. **CI/CD Check**
   - Add TypeScript unused check to CI pipeline
   - Fail builds with new unused imports

5. **Address Non-Test Warnings**
   - Create TASK-026 for 113 warnings in `agents/`, `server/`, `scripts/`
   - Larger scope, may need different approach

## Related Documentation

- [TASK-016 Specification](./TASK-016-UNUSED-TEST-IMPORTS.md) - Previous test import cleanup
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig#noUnusedLocals)
- [Vitest API Reference](https://vitest.dev/api/) - For understanding test utility imports

## Appendix: Current Warning List

As of 2026-02-08, the 47 warnings are distributed as follows:

| Directory           | File Count | Warning Count |
| ------------------- | ---------- | ------------- |
| tests/e2e           | 1          | 1             |
| tests/graph         | 1          | 1             |
| tests/ideation      | 5          | 15            |
| tests/integration   | 5          | 14            |
| tests/spec-agent    | 1          | 3             |
| tests/specification | 5          | 9             |
| tests/ (root)       | 2          | 4             |
| **Total**           | **20**     | **47**        |

### Most Common Unused Imports

1. `vi` from vitest (8 occurrences) - mocking utility
2. `beforeEach` / `afterEach` (7 occurrences) - lifecycle hooks
3. Type imports (9 occurrences) - TypeScript types
4. Local variables from destructuring (12 occurrences)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** Ready for Implementation
