# TASK-025: Specification Status

**Task:** Remove unused imports across test suite
**Status:** ✅ SPECIFICATION COMPLETE - READY FOR BUILD AGENT
**Created:** 2026-02-08
**Agent:** Spec Agent (Autonomous)

---

## Summary

This task already has **two comprehensive technical specifications** ready for implementation:

1. **Primary Spec:** `TASK-025-remove-unused-imports.md` (486 lines)
   - Complete technical design
   - Detailed implementation plan
   - File-by-file breakdown
   - Pass criteria and verification commands

2. **Retry Spec:** `FIX-TASK-025-8V9Y.md` (468 lines)
   - Addresses incomplete prior implementation
   - Batch-by-batch implementation strategy
   - Specific warning samples
   - Success metrics

Both specifications are comprehensive, testable, and ready for the Build Agent.

---

## Current State Verification

**Test File Warnings (as of 2026-02-08):**
```bash
$ npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
47
```

**Total TS6133 Warnings:** 161 (47 in test files, 114 in production code)

**Test Suite Status:**
- ✅ All tests passing (1773 passed, 4 skipped)
- ✅ Build succeeds
- ❌ 47 unused import warnings remain

---

## Specification Quality Assessment

### ✅ Comprehensive Coverage

Both existing specifications include:

- **Overview & Problem Statement** - Clear context and motivation
- **Requirements** - Functional and non-functional requirements
- **Technical Design** - Analysis strategy, implementation approach, file breakdown
- **Implementation Plan** - Step-by-step batched approach with verification
- **Pass Criteria** - Specific, testable success criteria with verification commands
- **Dependencies** - Technical and file dependencies
- **Risk Assessment** - Low/medium risk areas with mitigation strategies
- **Future Improvements** - Next steps (enable noUnusedLocals, ESLint rules)

### ✅ Testable Pass Criteria

All pass criteria are automated and verifiable:

**PC-1: Zero TS6133 warnings in test files**
```bash
npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l
# Expected: 0 (currently 47)
```

**PC-2: All tests still pass**
```bash
npm test --run
# Expected: 1773 passed, 4 skipped (same as current baseline)
```

**PC-3: Build succeeds**
```bash
npm run build
# Expected: Exit code 0
```

**PC-4: No actual usage overlooked**
- Manual review confirms each removal is safe
- No side-effect imports removed
- Variables that must be declared use `_` prefix

### ✅ References Existing Patterns

Both specs reference:
- TypeScript compiler options (`--noUnusedLocals`)
- Vitest patterns and lifecycle hooks
- Project code style conventions
- Git workflow and commit practices
- Related completed task (TASK-016)

---

## Implementation Readiness

**Status:** ✅ READY FOR BUILD AGENT

The specifications provide everything needed:

1. **Clear scope:** 47 warnings across 20 test files
2. **Batched approach:** 7 batches by directory
3. **Verification at each step:** Test after each batch
4. **Safety measures:** Git commits, manual review, `_` prefix convention
5. **Complete warning list:** Sample warnings provided, full list generation command included

**Estimated effort:** 2-3 hours (per both specs)

**Recommended spec to follow:** `FIX-TASK-025-8V9Y.md` (more recent, includes retry context)

---

## Warning Distribution

| Directory | Files | Warnings | Key Issues |
|-----------|-------|----------|------------|
| tests/ideation/ | 5 | 15 | `vi`, lifecycle hooks, destructured variables |
| tests/integration/ | 5 | 14 | Lifecycle hooks, unused variables |
| tests/specification/ | 5 | 9 | Type imports (AtomicTask, Question, Gotcha) |
| tests/spec-agent/ | 1 | 3 | Unused constants |
| tests/ (root) | 2 | 4 | beforeAll, afterAll, variables |
| tests/e2e/ | 1 | 1 | Unused variable (originalTask) |
| tests/graph/ | 1 | 1 | afterEach |
| **Total** | **20** | **47** | |

---

## Next Steps

**For Build Agent:**

1. Review `docs/specs/FIX-TASK-025-8V9Y.md`
2. Generate full warning list:
   ```bash
   npx tsc --noUnusedLocals --noEmit 2>&1 | \
     grep "TS6133" | \
     grep "tests/" | \
     grep -E "\.(test|spec)\.ts" | \
     tee docs/specs/FIX-TASK-025-8V9Y-warnings.txt
   ```
3. Follow batched implementation plan (7 batches)
4. Test after each batch
5. Verify final pass criteria

**Verification Commands:**
```bash
# Before starting
echo "Baseline: $(npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l) warnings"

# After completion
echo "Final: $(npx tsc --noUnusedLocals --noEmit 2>&1 | grep "TS6133" | grep "tests/" | grep -E "\.(test|spec)\.ts" | wc -l) warnings"
npm test --run
npm run build
```

---

## Spec Agent Assessment

**Conclusion:** No new specification needed. Two comprehensive specifications already exist and are ready for implementation. This task should be assigned to the Build Agent for execution.

**Recommended Action:** Route TASK-025 to Build Agent with reference to `docs/specs/FIX-TASK-025-8V9Y.md`

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Created By:** Spec Agent (Autonomous)
**Status:** Specification Complete - Ready for Build Agent
