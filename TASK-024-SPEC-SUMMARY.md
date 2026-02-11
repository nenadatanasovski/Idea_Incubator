# TASK-024 Specification Summary

**Status**: ✅ Specification Complete

## Task Overview

Complete Phase 2 Task 2.6 test system seed data to enable proper test tracking and validation queries for the phased implementation approach.

## Current State

- ✅ **Phase 1 complete**: 1 suite, 8 test cases, 21 steps, 28 assertions
- ❌ **Missing**: 15 additional test suites for Phases 2-16
- ❌ **Missing**: Detailed test data for Phase 2 (6 tasks)

## What Needs to Be Built

### 1. Create All 16 Test Suites

- File: `parent-harness/orchestrator/src/db/seed-all-suites.ts`
- Creates suite metadata for all 16 phases
- Lightweight placeholder creation

### 2. Create Phase 2 Detailed Test Data

- File: `parent-harness/orchestrator/src/db/seed-phase2-tests.ts`
- 6 test cases (tasks 2.1-2.6)
- Test steps for each case
- Test assertions for key pass criteria

### 3. Create Verification Script

- File: `parent-harness/orchestrator/src/db/verify-test-seed.ts`
- Validates seed data completeness
- Checks counts match expectations

### 4. Update Main Seed Script

- File: `parent-harness/orchestrator/src/db/seed.ts`
- Import and call new seed functions

## Pass Criteria Summary

1. ✅ **16 test suites created** (query: `SELECT COUNT(*) FROM test_suites`)
2. ✅ **Phase 1 has 8 test cases** (already complete)
3. ✅ **Phase 2 has 6 test cases** (new)
4. ✅ **Each Phase 2 case has ≥1 step** (new)
5. ✅ **Key assertions defined** (≥10 for Phase 2)
6. ✅ **Validation queries work** (Phase completion gates)
7. ✅ **Idempotent seeding** (can re-run safely)
8. ✅ **TypeScript compiles** (no errors)

## Key Design Decisions

✅ **Hybrid approach**: Create all suite placeholders + detailed data for Phases 1-2
✅ **Follow existing pattern**: Mimic `seed-phase1-tests.ts` structure
✅ **Idempotent**: Use `ON CONFLICT` clauses for safe re-runs
✅ **Testable**: Each pass criterion has specific verification query

## Implementation Pattern

```typescript
// Example for Task 2.1: SQLite Database Setup
{
  id: 'phase_2_task_1_sqlite_setup',
  name: 'SQLite Database Setup',
  description: 'Verify database connection and initialization',
  priority: 'P0',
  steps: [
    {
      name: 'Check database file exists',
      command: 'test -f parent-harness/data/harness.db',
      expectedExitCode: 0,
      assertions: [
        {
          type: 'exists',
          target: 'parent-harness/data/harness.db',
          errorMessage: 'Database file should exist'
        }
      ]
    },
    // ... more steps
  ]
}
```

## Files to Create/Modify

| File                   | Action | Purpose                    |
| ---------------------- | ------ | -------------------------- |
| `seed-all-suites.ts`   | CREATE | All 16 test suite records  |
| `seed-phase2-tests.ts` | CREATE | Phase 2 detailed test data |
| `verify-test-seed.ts`  | CREATE | Validation script          |
| `seed.ts`              | MODIFY | Call new seed functions    |

## Next Steps for Build Agent

1. Create `seed-all-suites.ts` with all 16 phase metadata
2. Create `seed-phase2-tests.ts` with 6 test cases following Phase 1 pattern
3. Create `verify-test-seed.ts` to validate results
4. Update `seed.ts` to call new functions
5. Run seed scripts and verify all pass criteria
6. Run TypeScript compiler to ensure no errors

## Reference Documentation

📄 **Full Specification**: `docs/specs/TASK-024-phase2-test-seed-completion.md`
📄 **PHASES.md**: `parent-harness/docs/PHASES.md`
📄 **Schema**: `parent-harness/database/schema.sql`
📄 **Existing Pattern**: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`
