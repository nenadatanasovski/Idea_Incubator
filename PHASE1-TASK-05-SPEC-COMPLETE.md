# PHASE1-TASK-05 Specification Complete

**Task:** Tests validating evaluators receive complete context
**Status:** ✅ SPECIFICATION COMPLETE
**Created:** 2026-02-08
**Spec Agent:** Sonnet 4.5

---

## Summary

Technical specification created for comprehensive test suite to validate that all specialized evaluators receive complete context from:

1. **Q&A answers** from development.md (PHASE1-TASK-01)
2. **User profile context** with category-relevant excerpts (PHASE1-TASK-02)
3. **Web research data** from pre-evaluation research phase (PHASE1-TASK-03)

## Specification Location

**File:** `docs/specs/PHASE1-TASK-05-evaluator-context-tests.md`

## Test Suite Overview

### Existing Tests ✅

- `tests/unit/utils/profile-context.test.ts` - Profile formatting (already complete)

### Tests to Create 📝

1. **Unit Tests:**
   - `tests/unit/context/structured-context.test.ts` - Q&A context loading (8-10 tests)
   - `tests/unit/context/research-context.test.ts` - Research formatting (12-15 tests)

2. **Integration Tests:**
   - `tests/integration/category-specific-context.test.ts` - Context flow per category (6-8 tests)
   - `tests/integration/evidence-based-reasoning.test.ts` - Quality validation (5-6 tests)

3. **E2E Tests:**
   - `tests/e2e/complete-evaluation-context.test.ts` - Full flow validation (3-4 tests)

## Test Coverage

- **Unit Tests:** 90%+ coverage target
- **Integration Tests:** 80%+ coverage target
- **E2E Tests:** Critical paths only (expensive)

## Pass Criteria

### Unit Tests ✅

- Context loaders return correct data structures
- Formatters produce category-specific output
- Null/missing data handled gracefully
- Field extraction works correctly

### Integration Tests ✅

- All 3 context sources passed to evaluators
- Category-specific filtering works:
  - Feasibility: skills + time + Q&A
  - Market: network + research + Q&A
  - Risk: runway + tolerance + Q&A
  - Fit: full profile + Q&A
  - Solution: tech feasibility + Q&A
  - Problem: Q&A only

### E2E Tests ✅

- Full evaluation with complete context succeeds
- Partial context scenarios handled gracefully
- High confidence (>0.7) with complete context
- Lower confidence when context missing

## Implementation Notes

### Test Fixtures Provided

- Mock profile factory
- Mock structured context factory
- Mock research result factory
- Database test helpers (create/cleanup)

### Key Challenges Identified

1. **Prompt Capture Mechanism**
   - Integration tests need to verify correct context in prompts
   - Recommendation: Add test mode to evaluators that returns assembled prompts

2. **E2E Test Cost**
   - Full evaluations cost $1-2 per run
   - Recommendation: Mark as `.skip` by default, run manually

3. **Non-Deterministic LLM Responses**
   - Evidence citation tests need pattern matching, not exact matches
   - Recommendation: Use keyword/phrase detection + snapshots

## Timeline Estimate

- **Phase 1 (Unit Tests):** 1-2 days
- **Phase 2 (Integration Tests):** 2-3 days
- **Phase 3 (E2E Tests):** 1 day
- **Phase 4 (Documentation):** 0.5 days
- **Total:** 4.5-6.5 days

## Dependencies

### Upstream ✅

- PHASE1-TASK-01: Q&A sync (complete)
- PHASE1-TASK-02: Profile context (complete)
- PHASE1-TASK-03: Web research (complete)
- PHASE1-TASK-04: Context integration (complete)

### Downstream

- Phase 2 tasks (can proceed in parallel)
- Future regression testing
- Quality assurance for production

## Next Steps for Build Agent

1. ✅ Create `tests/unit/context/structured-context.test.ts`
2. ✅ Create `tests/unit/context/research-context.test.ts`
3. ✅ Create `tests/integration/category-specific-context.test.ts`
4. ✅ Create `tests/integration/evidence-based-reasoning.test.ts`
5. ✅ Create `tests/e2e/complete-evaluation-context.test.ts`
6. ✅ Add test mode to evaluators for prompt capture
7. ✅ Run tests and fix any issues
8. ✅ Generate coverage report
9. ✅ Validate with QA agent

## Validation Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass (may require prompt capture implementation first)
- [ ] E2E tests created (marked as skip)
- [ ] 90%+ unit test coverage achieved
- [ ] Test fixtures and helpers documented
- [ ] Coverage report generated
- [ ] QA agent validation complete

---

**Specification Status:** ✅ COMPLETE
**Ready for Implementation:** YES
**Build Agent:** Can proceed with test file creation
