# TASK-025: Technical Specification - COMPLETE

**Task ID**: TASK-025
**Title**: Remove unused imports across test suite
**Spec Agent**: Autonomous Spec Agent v0.1
**Date**: 2026-02-08 15:48 GMT+11
**Status**: ✅ SPECIFICATION COMPLETE

---

## Task Completion Summary

The Spec Agent has completed its role for TASK-025. A comprehensive technical specification already exists and has been verified for completeness and accuracy.

### Deliverables

1. **Primary Specification**: `docs/specs/FIX-TASK-025-8V9Y.md` (16,168 bytes)
   - Complete technical design
   - 7-batch implementation plan
   - 3 testable pass criteria
   - Risk assessment and mitigation
   - Git workflow guidance

2. **Warning List**: `docs/specs/FIX-TASK-025-8V9Y-warnings.txt` (3.7 KB)
   - All 47 TS6133 warnings in test files
   - Line-by-line breakdown with file paths
   - Generated using: `npx tsc --noUnusedLocals --noEmit`

3. **Status Document**: `docs/specs/TASK-025-SPECIFICATION-STATUS.md`
   - Current state verification
   - Specification quality assessment
   - Implementation readiness checklist

---

## Verification Results

### ✅ Warning Count Confirmed
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
47
```
**Result**: Matches specification exactly

### ✅ Build Status Verified
```bash
$ npm run build
> tsc
```
**Result**: Build succeeds with no errors

### ✅ Baseline Documented
```bash
$ npm test -- --run
Test Files  21 failed | 85 passed (106)
Tests       30 failed | 1589 passed | 4 skipped (1777)
```
**Note**: Current test failures are unrelated to unused imports and should be addressed separately.

---

## Specification Overview

### Scope
Remove all 47 TS6133 "unused import/variable" warnings from test files without breaking functionality.

### Affected Files (20 total)
- `tests/e2e/` - 1 file, 1 warning
- `tests/graph/` - 1 file, 1 warning
- `tests/ideation/` - 5 files, 15 warnings
- `tests/integration/` - 5 files, 14 warnings
- `tests/spec-agent/` - 1 file, 3 warnings
- `tests/specification/` - 5 files, 9 warnings
- `tests/` (root) - 2 files, 4 warnings

### Implementation Strategy
Batch-by-batch cleanup with testing after each batch:
1. Tests/e2e (10 min)
2. Tests/graph (10 min)
3. Tests/ideation (30 min)
4. Tests/integration (30 min)
5. Tests/spec-agent (15 min)
6. Tests/specification (20 min)
7. Tests root files (15 min)

**Total Estimated Time**: 2-3 hours

---

## Pass Criteria

The specification defines 3 testable pass criteria:

### PC1: All tests pass
```bash
npm test -- --pool=forks --poolOptions.forks.maxForks=1
```
**Expected**: Same test count as baseline (no new failures)

### PC2: Build succeeds
```bash
npm run build
```
**Expected**: Exit code 0, no TypeScript errors

### PC3: Zero test file warnings
```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
```
**Expected**: 0 (down from 47)

---

## Technical Design Highlights

### Removal Patterns Documented
1. **Remove entire import line** - When all specifiers are unused
2. **Remove specific specifier** - When only some specifiers are unused
3. **Prefix with underscore** - For destructured variables that must stay
4. **Remove type imports** - Verify not used in JSDoc first

### Edge Cases Identified
- Side-effect imports (keep even if appear unused)
- Type-only usage in JSDoc comments
- String references in mock paths
- Destructuring where position matters

### Risk Mitigation
- Work in small batches
- Run tests after each batch
- Git commit after each batch
- Manual review of each change
- Careful verification of type imports

---

## Dependencies

### Required Tools
- TypeScript compiler (`tsc`) with `--noUnusedLocals` flag
- Vitest test framework (`npm test`)
- Node.js >= 18

### Related Tasks
- **TASK-016**: Previously cleaned `tests/unit/` and `tests/task-agent/` (completed)
- **TASK-026**: Future task for non-test warnings (113 warnings in `agents/`, `server/`, `scripts/`)

---

## Implementation Readiness Checklist

- [x] Complete technical specification exists
- [x] All 47 warnings identified and documented
- [x] Warning list file generated
- [x] Implementation strategy defined
- [x] Pass criteria are testable
- [x] Edge cases documented
- [x] Risk mitigation strategies defined
- [x] Batch plan with time estimates
- [x] Git workflow documented
- [x] Success metrics defined

**Status**: ✅ READY FOR IMPLEMENTATION

---

## Next Steps

1. **Build Agent** should implement using `docs/specs/FIX-TASK-025-8V9Y.md`
2. Follow the 7-batch implementation plan
3. Verify each pass criterion after completion
4. Update `.build-checkpoints/test-build.json` when complete

---

## Spec Agent Sign-Off

As the Spec Agent for TASK-025, I confirm:

✅ Technical specification is complete and comprehensive
✅ All requirements are documented
✅ Pass criteria are testable and specific
✅ Implementation plan is detailed and actionable
✅ Dependencies are identified
✅ Risks are assessed with mitigation strategies
✅ Specification follows codebase patterns and standards

**Specification Location**: `docs/specs/FIX-TASK-025-8V9Y.md`

**Ready for**: Build Agent implementation

---

**Document Version**: 1.0
**Spec Agent**: Autonomous Spec Agent v0.1
**Completion Time**: 2026-02-08 15:48 GMT+11
