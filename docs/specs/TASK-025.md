# TASK-025: Remove Unused Imports Across Test Suite

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-08
**Agent:** Spec Agent
**Priority:** Low (Code Quality)
**Estimated Effort:** 2-3 hours
**Related Specs:** FIX-TASK-025-8V9Y.md (detailed analysis)

---

## Overview

Remove all unused imports from test files to eliminate 47 TS6133 TypeScript compiler warnings. These warnings create noise in compilation output and indicate incomplete refactoring or abandoned test code paths. While not blocking functionality, they reduce code quality and make it harder to spot real issues.

**Current State:**
- ✅ Build succeeds (`npm run build`)
- ✅ Most tests pass (1761 passed, 4 skipped, 1 failing due to unrelated DB issue)
- ❌ **47 TS6133 warnings remain in 20 test files**
- ❌ 161 total TS6133 warnings across entire codebase (113 in non-test files - out of scope)

**Goal:** Eliminate all 47 unused import warnings from test files without breaking any tests or builds.

---

## Requirements

### Functional Requirements

**FR1: Zero TS6133 Warnings in Test Files**
- Remove all unused import declarations from `.test.ts` and `.spec.ts` files
- Remove all unused variable declarations or prefix with `_` if structurally required
- Verification command must return 0:
  ```bash
  npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
  ```

**FR2: Preserve All Test Functionality**
- All passing tests must continue to pass (1761 tests)
- No new test failures introduced
- No reduction in test coverage
- No changes to test behavior or assertions

**FR3: Safe Import Removal**
- Do not remove imports with side effects (e.g., `import './setup.js'`)
- Verify each import is genuinely unused before removal
- For variables that must be declared (destructuring position matters), prefix with `_`
- Do not break type checking or JSDoc references

### Non-Functional Requirements

**NFR1: Code Quality**
- Maintain test readability and structure
- Follow existing code style conventions
- Preserve test patterns

**NFR2: Process Safety**
- Work in small batches (one directory at a time)
- Run tests after each batch to catch breakage early
- Use git commits for easy rollback
- Document any edge cases or intentional decisions

---

## Technical Design

### Current Warning Distribution

**47 warnings across 20 test files:**

| Directory | Files | Warnings | Most Common Issues |
|-----------|-------|----------|-------------------|
| tests/ideation/ | 5 | 15 | `vi`, `beforeEach`, `afterEach`, unused destructured variables |
| tests/integration/ | 5 | 14 | Lifecycle hooks, unused variables |
| tests/specification/ | 5 | 9 | Type imports (`AtomicTask`, `Question`, `Gotcha`) |
| tests/ (root) | 2 | 4 | `beforeAll`, `afterAll`, unused variables |
| tests/spec-agent/ | 1 | 3 | Unused constants |
| tests/e2e/ | 1 | 1 | Unused variable |
| tests/graph/ | 1 | 1 | `afterEach` |
| **Total** | **20** | **47** | |

### Most Common Unused Import Categories

1. **`vi` from vitest** (8 occurrences) - Mock utility that was planned but never used
2. **Lifecycle hooks** (7 occurrences) - `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
3. **Type imports** (9 occurrences) - TypeScript types (`AtomicTask`, `Gotcha`, etc.)
4. **Destructured variables** (12 occurrences) - Variables from destructuring that aren't used

### Implementation Strategy

**Phase 1: Generate Complete Warning List (5 minutes)**

```bash
# Generate full list with line numbers
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  tee docs/specs/TASK-025-warnings.txt
```

**Phase 2: Process by Directory (2 hours)**

Work in **7 batches**, one directory at a time. For each batch:

1. **Read** the warning list for that directory
2. **Open** each file and locate the unused import/variable
3. **Verify** it's truly unused:
   - Search the file for all uses of the identifier
   - Check for string references (e.g., in mock paths)
   - Check for JSDoc or type-only usage
   - Check for side-effect imports
4. **Remove** the unused import or variable:
   - Remove entire import line if all specifiers unused
   - Remove only the unused specifier if others are used
   - For variables that must be declared (destructuring), prefix with `_`
5. **Test** the changes:
   ```bash
   npm test -- tests/[directory]/ --run
   ```
6. **Verify** warning eliminated:
   ```bash
   npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/[directory]/"
   ```
7. **Commit** with clear message:
   ```bash
   git add tests/[directory]/
   git commit -m "fix(tests): remove unused imports from [directory] tests"
   ```

**Phase 3: Final Verification (30 minutes)**

```bash
# 1. Verify zero test file warnings
npx tsc --noUnusedLocals --noEmit 2>&1 | \
  grep "TS6133" | \
  grep "tests/" | \
  grep -E "\.(test|spec)\.ts" | \
  wc -l
# Expected: 0 (down from 47)

# 2. Run full test suite
npm test --run
# Expected: 1761 passed, 4 skipped (same as before, excluding DB corruption issue)

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
// Before
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

1. **Side-effect imports:** Keep imports like `import './setup.js'` even if they appear unused
2. **Type-only usage:** Verify type imports aren't used in JSDoc or inline annotations
3. **String references:** Check if identifier appears in strings (e.g., mock module paths)
4. **Destructuring position:** For variables from destructuring, use `_` prefix if position matters
5. **Test incompleteness:** Unused lifecycle hooks may indicate incomplete setup/teardown logic

---

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
- `anthropic-client.test.ts` (unused `vi`)
- `memory-graph-migration.test.ts` (4 warnings)
- `observability/api-to-db.test.ts` (3 lifecycle hooks)
- `observability/python-producer-api.test.ts` (unused `transcriptResult`)
- `parallel-execution.test.ts` (unused `vi`, `duration`)
- `supersession-flow.test.ts` (unused `vi`, `beforeEach`, `conversationMessages`)

**Test:** `npm test -- tests/integration/ --run`

### Batch 5: tests/spec-agent/ (15 minutes)
**File:** `acceptance.test.ts`
**Warnings:** 3 unused constants (`VALID_PHASES`, `refSections`, `refFrontmatter`)
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

---

## Pass Criteria

### ✅ Pass Criterion 1: Zero test file warnings
```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
```
**Expected:** 0 (down from 47)

**Verification:**
- No TS6133 warnings in test files
- Non-test warnings (113) may remain (out of scope)

### ✅ Pass Criterion 2: All tests pass
```bash
npm test --run
```
**Expected:** 1761 passed, 4 skipped (same as before, excluding DB issue)

**Verification:**
- No new test failures
- Same number of passing tests as baseline
- Same number of skipped tests

### ✅ Pass Criterion 3: Build succeeds
```bash
npm run build
```
**Expected:** TypeScript compilation completes with exit code 0

**Verification:**
- No TypeScript errors
- No new compilation warnings
- dist/ directory generated successfully

### ✅ Pass Criterion 4: No actual usage overlooked
**Manual verification:**
- Each removed import was genuinely unused
- No side-effect imports removed
- No type imports removed that broke type checking
- No string references or JSDoc usage missed

---

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

### Related Tasks
- **TASK-016:** Previously cleaned `tests/unit/` and `tests/task-agent/` (completed)
- **Future TASK-026:** Clean 113 non-test warnings in `agents/`, `server/`, `scripts/` (out of scope)

---

## Risk Assessment

### Low Risk ✅
- Removing truly unused imports has zero runtime impact
- Changes are localized to test files only
- Full test suite validates no breakage after each batch
- Git enables easy rollback if needed

### Medium Risk ⚠️
- **Type imports** that appear unused but are referenced in JSDoc
- **Side-effect imports** that configure test environment (e.g., `import './setup'`)
- **Variables from destructuring** where position matters for correct unpacking

### Mitigation Strategies
1. **Manual review** of each change before committing
2. **Batch testing** after each directory is processed
3. **Git commits** after each batch for easy rollback
4. **Careful verification** of type imports and side-effect imports
5. **Use `_` prefix** for variables that must be declared but are unused

---

## Success Metrics

### Before Implementation
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
47

$ npm test --run | grep "Test Files"
 Test Files  106 passed (106)
      Tests  1761 passed | 4 skipped (1777)
```

### After Implementation
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
0  # ← Must be 0

$ npm test --run | grep "Test Files"
 Test Files  106 passed (106)  # ← Same as before
      Tests  1761 passed | 4 skipped (1777)  # ← Same as before
```

---

## Implementation Notes

### Git Workflow

```bash
# Work on dev branch or create feature branch
git checkout dev  # or: git checkout -b fix/task-025-remove-unused-test-imports

# Work in batches, commit after each
git add tests/e2e/task-atomic-anatomy.test.ts
git commit -m "fix(tests): remove unused originalTask in e2e test"

git add tests/graph/
git commit -m "fix(tests): remove unused afterEach from graph tests"

git add tests/ideation/
git commit -m "fix(tests): remove 15 unused imports from ideation tests"

# Continue for remaining batches...

# Final verification commit
git commit -m "verify: all 47 TS6133 warnings removed from test files (TASK-025)"
```

### Quality Checklist

For each file modified:
- [ ] Read full test file to understand context
- [ ] Verify import/variable is truly unused (search entire file)
- [ ] Check for string references or JSDoc usage
- [ ] Check for side-effect imports
- [ ] Remove unused import or prefix variable with `_`
- [ ] Run specific test file: `npm test -- path/to/file --run`
- [ ] Verify warning eliminated: `npx tsc --noUnusedLocals --noEmit 2>&1 | grep "filename"`
- [ ] Commit with descriptive message

---

## Future Improvements

After this task is complete, consider:

1. **Enable `noUnusedLocals` in tsconfig.json**
   - Currently: `"noUnusedLocals": false`
   - Future: `"noUnusedLocals": true`
   - Prevents future unused imports from being committed

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

3. **Pre-commit hook**
   ```bash
   # .husky/pre-commit
   npx tsc --noUnusedLocals --noEmit
   ```

4. **CI/CD check**
   - Add TypeScript unused check to CI pipeline
   - Fail builds with new unused imports

5. **Create TASK-026** for non-test warnings
   - 113 warnings remain in `agents/`, `server/`, `scripts/`
   - Larger scope requiring different approach and careful review

---

## Related Documentation

- **FIX-TASK-025-8V9Y.md** - Detailed analysis of the 47 warnings with sample warnings and context
- **TASK-025-remove-unused-imports.md** - Original specification (duplicate)
- **TASK-016** - Previous test import cleanup (completed)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig#noUnusedLocals) - Official docs
- [Vitest API Reference](https://vitest.dev/api/) - For understanding test utility imports

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** READY FOR IMPLEMENTATION
**Next Step:** Build Agent should begin with Batch 1 (tests/e2e/)
