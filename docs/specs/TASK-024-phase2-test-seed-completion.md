# TASK-024: Complete Phase 2 Task 2.6 Test System Seed Data

## Overview

Task 2.6 in PHASES.md (Create Test System Tables Seed) is partially complete. Phase 1 test data exists with 8 test cases, 21 test steps, and 28 test assertions. However, according to PHASES.md, there should be 16 test suites (one per phase) with complete test data. This specification addresses the completion of the test system seed data for proper test tracking and validation queries across the phased implementation approach.

## Current State

### What Exists ✅

- **1 test suite**: `phase_1_frontend_shell` (Phase 1: Frontend Shell)
- **8 test cases** for Phase 1 tasks:
  - `phase_1_task_1_vite_setup` (3 steps, 3 assertions)
  - `phase_1_task_2_tailwind` (4 steps, 5 assertions)
  - `phase_1_task_3_layout` (2 steps, 5 assertions)
  - `phase_1_task_4_agent_card` (2 steps, 2 assertions)
  - `phase_1_task_5_event_stream` (2 steps, 3 assertions)
  - `phase_1_task_6_task_card` (2 steps, 2 assertions)
  - `phase_1_task_7_routing` (4 steps, 4 assertions)
  - `phase_1_task_8_notifications` (2 steps, 2 assertions)
- **21 test steps** total
- **28 test assertions** total
- Implementation in: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`

### What's Missing ❌

- **15 additional test suites** (Phases 2-16)
- **Test cases** for tasks in Phases 2-16
- **Test steps** for each test case
- **Test assertions** for key pass criteria

According to PHASES.md:

- Phase 1: 8 tasks ✅ (complete)
- Phase 2: 6 tasks ⚠️ (needs test data)
- Phase 3: 7 tasks ⚠️ (needs test data)
- Phases 4-16: 85+ tasks ⚠️ (needs test data)

## Requirements

### Must Have (P0)

1. **All 16 test suites created** - One per phase with proper metadata (name, description, phase number, type='verification', source='phases')
2. **Complete Phase 2 test data** - 6 test cases for Phase 2 tasks (2.1-2.6) with steps and assertions
3. **Seed script execution** - Script runs without errors and creates all required records
4. **Validation queries work** - Phase completion validation queries return expected results

### Should Have (P1)

5. **Phase 3 test data** - 7 test cases for Phase 3 tasks (3.1-3.7) with steps and assertions
6. **Idempotent seeding** - Script can be re-run safely using `ON CONFLICT` clauses
7. **Verification script** - Script to verify seed data completeness

### Nice to Have (P2)

8. **Phases 4-16 placeholder suites** - Test suites created for remaining phases (even if cases are TODO)
9. **Documentation** - README explaining test system seed data structure

## Technical Design

### Database Schema Reference

From `parent-harness/database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('unit', 'integration', 'e2e', 'verification', 'lint', 'typecheck')),
    source TEXT NOT NULL CHECK(source IN ('code', 'phases', 'task_agent', 'planning_agent')),
    file_path TEXT,
    phase INTEGER,
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    timeout_ms INTEGER DEFAULT 30000,
    retry_limit INTEGER DEFAULT 5,
    depends_on TEXT,  -- JSON array of test_case IDs
    tags TEXT,  -- JSON array
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_steps (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT,
    expected_exit_code INTEGER DEFAULT 0,
    expected_output_contains TEXT,
    timeout_ms INTEGER DEFAULT 10000,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_assertions (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    assertion_type TEXT NOT NULL CHECK(assertion_type IN ('equals', 'contains', 'matches', 'exists', 'truthy')),
    target TEXT NOT NULL,
    expected_value TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Files to Modify

1. **`parent-harness/orchestrator/src/db/seed-phase2-tests.ts`** (CREATE)
   - New seed script for Phase 2 test data
   - Follows same pattern as `seed-phase1-tests.ts`
   - Creates 1 suite + 6 test cases + steps + assertions

2. **`parent-harness/orchestrator/src/db/seed-all-suites.ts`** (CREATE)
   - Creates all 16 test suite records (placeholders for phases without detailed test data)
   - Lightweight script that just creates suite metadata

3. **`parent-harness/orchestrator/src/db/verify-test-seed.ts`** (CREATE)
   - Verification script to check seed data completeness
   - Validates counts match expectations

4. **`parent-harness/orchestrator/src/db/seed.ts`** (MODIFY)
   - Import and call new seed functions
   - Ensure proper execution order

### Implementation Pattern

Follow the existing pattern from `seed-phase1-tests.ts`:

```typescript
export function seedPhase2Tests(): void {
  console.log("🧪 Seeding Phase 2 test data...");

  const suiteId = "phase_2_data_model";

  // Create test suite
  run(
    `
    INSERT INTO test_suites (id, name, description, type, source, phase, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description
  `,
    [
      suiteId,
      "Phase 2: Data Model",
      "Database ready with schema and seed data",
      "verification",
      "phases",
      2,
      1,
    ],
  );

  // Define test cases with steps and assertions
  const testCases = [
    {
      id: "phase_2_task_1_sqlite_setup",
      name: "SQLite Database Setup",
      description: "Verify database connection and initialization",
      priority: "P0" as const,
      steps: [
        {
          name: "Check database file exists",
          command: "test -f parent-harness/data/harness.db",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/data/harness.db",
              errorMessage: "Database file should exist",
            },
          ],
        },
        {
          name: "Verify database connection works",
          command: 'sqlite3 parent-harness/data/harness.db "SELECT 1"',
          expectedExitCode: 0,
          expectedOutputContains: "1",
          assertions: [
            {
              type: "equals" as const,
              target: "exit_code",
              expectedValue: "0",
              errorMessage: "Database should be accessible",
            },
          ],
        },
      ],
    },
    // ... more test cases for tasks 2.2-2.6
  ];

  // Insert test cases, steps, and assertions (same pattern as Phase 1)
  // ...
}
```

### Phase 2 Test Cases to Create

Based on PHASES.md:

1. **Task 2.1: SQLite Database Setup** (`phase_2_task_1_sqlite_setup`)
   - Check database file exists
   - Verify connection works
   - Validate simple query execution

2. **Task 2.2: Run Schema** (`phase_2_task_2_schema`)
   - Verify 33 tables created
   - Check indexes created
   - Validate table structure

3. **Task 2.3: Seed Agents** (`phase_2_task_3_seed_agents`)
   - Verify 13 agent rows exist
   - Check all agent types present
   - Validate telegram_channel field

4. **Task 2.4: Seed Sample Tasks** (`phase_2_task_4_seed_tasks`)
   - Verify task_lists table has rows
   - Check 5+ sample tasks exist
   - Validate task relationships

5. **Task 2.5: Create Query Functions** (`phase_2_task_5_queries`)
   - Verify TypeScript files exist (agents.ts, tasks.ts, sessions.ts, events.ts)
   - Check npm run typecheck passes
   - Validate exported functions

6. **Task 2.6: Create Test System Tables Seed** (`phase_2_task_6_test_seed`)
   - Verify 16 test suites exist
   - Check Phase 1 has 8 test cases
   - Validate test steps and assertions exist

### All Phases Test Suites

Create placeholder suites for all 16 phases:

```typescript
const allPhases = [
  {
    phase: 1,
    id: "phase_1_frontend_shell",
    name: "Phase 1: Frontend Shell",
    description: "Static dashboard that can be tested independently",
    tasks: 8,
  },
  {
    phase: 2,
    id: "phase_2_data_model",
    name: "Phase 2: Data Model",
    description: "Database ready with schema and seed data",
    tasks: 6,
  },
  {
    phase: 3,
    id: "phase_3_backend_api",
    name: "Phase 3: Backend API",
    description: "REST API serving real data",
    tasks: 7,
  },
  {
    phase: 4,
    id: "phase_4_frontend_api",
    name: "Phase 4: Frontend + API",
    description: "Dashboard connected to real API",
    tasks: 7,
  },
  {
    phase: 5,
    id: "phase_5_websocket",
    name: "Phase 5: WebSocket",
    description: "Real-time updates via WebSocket",
    tasks: 7,
  },
  {
    phase: 6,
    id: "phase_6_telegram_bot",
    name: "Phase 6: Telegram Bot",
    description: "Agent notifications via Telegram",
    tasks: 7,
  },
  {
    phase: 7,
    id: "phase_7_orchestrator",
    name: "Phase 7: Orchestrator",
    description: "Task assignment and orchestration logic",
    tasks: 8,
  },
  {
    phase: 8,
    id: "phase_8_clarification",
    name: "Phase 8: Clarification Agent",
    description: "Ask clarifying questions for vague tasks",
    tasks: 6,
  },
  {
    phase: 9,
    id: "phase_9_agent_spawner",
    name: "Phase 9: Agent Spawner",
    description: "Spawn agent instances dynamically",
    tasks: 7,
  },
  {
    phase: 10,
    id: "phase_10_agent_memory",
    name: "Phase 10: Agent Memory",
    description: "Persistent agent memory and context",
    tasks: 5,
  },
  {
    phase: 11,
    id: "phase_11_qa_validation",
    name: "Phase 11: QA Validation",
    description: "Automated QA validation loops",
    tasks: 6,
  },
  {
    phase: 12,
    id: "phase_12_human_sim",
    name: "Phase 12: Human Sim Agent",
    description: "Multi-persona usability testing",
    tasks: 6,
  },
  {
    phase: 13,
    id: "phase_13_wave_execution",
    name: "Phase 13: Wave Execution",
    description: "Parallel task execution in waves",
    tasks: 6,
  },
  {
    phase: 14,
    id: "phase_14_planning_agent",
    name: "Phase 14: Planning Agent",
    description: "Strategic planning and task breakdown",
    tasks: 6,
  },
  {
    phase: 15,
    id: "phase_15_self_improvement",
    name: "Phase 15: Self-Improvement",
    description: "Platform improves itself autonomously",
    tasks: 5,
  },
  {
    phase: 16,
    id: "phase_16_polish",
    name: "Phase 16: Polish",
    description: "Final polish and production readiness",
    tasks: 9,
  },
];
```

## Pass Criteria

### 1. All 16 Test Suites Created

**Verification Method**: Query test_suites table

```sql
SELECT COUNT(*) FROM test_suites WHERE source = 'phases';
-- Expected: 16
```

**Expected Outcome**: 16 test suites exist with proper metadata

### 2. Phase 1 Test Data Complete

**Verification Method**: Query test_cases, test_steps, test_assertions for phase 1

```sql
SELECT
  COUNT(DISTINCT tc.id) as case_count,
  COUNT(DISTINCT ts.id) as step_count,
  COUNT(DISTINCT ta.id) as assertion_count
FROM test_cases tc
LEFT JOIN test_steps ts ON tc.id = ts.case_id
LEFT JOIN test_assertions ta ON ts.id = ta.step_id
WHERE tc.suite_id = 'phase_1_frontend_shell';
-- Expected: case_count=8, step_count=21, assertion_count=28
```

**Expected Outcome**: Phase 1 has 8 cases, 21 steps, 28 assertions

### 3. Phase 2 Test Data Complete

**Verification Method**: Query test_cases for phase 2

```sql
SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_2_data_model';
-- Expected: 6
```

**Expected Outcome**: Phase 2 has 6 test cases (one per task 2.1-2.6)

### 4. Each Phase 2 Test Case Has Steps

**Verification Method**: Query test_steps for phase 2 cases

```sql
SELECT case_id, COUNT(*) as step_count
FROM test_steps
WHERE case_id LIKE 'phase_2_task_%'
GROUP BY case_id;
-- Expected: Each case has at least 1 step (6 rows returned)
```

**Expected Outcome**: All 6 Phase 2 test cases have test steps defined

### 5. Key Assertions Defined

**Verification Method**: Query test_assertions for phase 2

```sql
SELECT COUNT(*) FROM test_assertions
WHERE step_id IN (
  SELECT id FROM test_steps
  WHERE case_id LIKE 'phase_2_task_%'
);
-- Expected: At least 10 assertions (average ~2 per case)
```

**Expected Outcome**: Phase 2 test cases have assertions for key pass criteria

### 6. Validation Query Works

**Verification Method**: Run Phase 2 completion validation query

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN tcr.status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results tcr
JOIN test_cases tc ON tcr.case_id = tc.id
WHERE tc.suite_id = 'phase_2_data_model';
-- Expected: Query runs without error (results may be 0/0 initially)
```

**Expected Outcome**: Query executes successfully and returns result set

### 7. Seed Script Is Idempotent

**Verification Method**: Run seed script twice

```bash
cd parent-harness/orchestrator
npm run seed-phase2-tests
npm run seed-phase2-tests  # Should not fail or create duplicates
```

**Expected Outcome**: Second run completes successfully with no duplicate records

### 8. TypeScript Compiles Successfully

**Verification Method**: Run TypeScript compiler

```bash
cd parent-harness/orchestrator
npm run typecheck
```

**Expected Outcome**: No TypeScript errors

## Dependencies

### Required Before This Task

- ✅ Phase 2 Task 2.1: SQLite Database Setup (complete)
- ✅ Phase 2 Task 2.2: Run Schema (complete - tables exist)
- ✅ `parent-harness/orchestrator/src/db/index.ts` (complete - DB connection)
- ✅ `parent-harness/database/schema.sql` (complete - test system tables)

### Required After This Task

- Phase 3 tasks can reference test system for validation
- Build Agent can use test data for pass criteria validation
- QA Agent can query test results for verification

### External Dependencies

- better-sqlite3 (already installed)
- TypeScript + tsx (already installed)
- Node.js runtime

## Implementation Notes

### Execution Order

1. Create `seed-all-suites.ts` first (creates all 16 suite records)
2. Create `seed-phase2-tests.ts` (adds detailed Phase 2 test data)
3. Update `seed.ts` to call both functions
4. Create `verify-test-seed.ts` for validation

### Testing Strategy

1. **Unit test**: Verify seed functions create expected records
2. **Integration test**: Run full seed script and validate counts
3. **Manual test**: Run verification script and check output

### Rollback Plan

If seed data is incorrect:

```sql
DELETE FROM test_suites WHERE source = 'phases';
-- Will cascade delete all test_cases, test_steps, test_assertions
```

### Performance Considerations

- Use transactions for batch inserts
- Use `ON CONFLICT` for idempotency
- Seed scripts should complete in <1 second

## Open Questions

None - requirements are clear from PHASES.md

## Alternative Approaches Considered

### Approach 1: Single Monolithic Seed Script

**Pros**: One file to maintain
**Cons**: Hard to debug, slow to run, difficult to extend
**Decision**: ❌ Rejected - not maintainable

### Approach 2: Separate Script Per Phase (16 files)

**Pros**: Maximum separation of concerns
**Cons**: Too many files, repetitive code
**Decision**: ❌ Rejected - too granular

### Approach 3: Hybrid (Suites + Detailed Phase Data) ✅ CHOSEN

**Pros**: Scalable, maintainable, follows existing pattern
**Cons**: Multiple files to maintain
**Decision**: ✅ Accepted - best balance of concerns

## References

- **PHASES.md**: `/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator/parent-harness/docs/PHASES.md`
- **Schema**: `parent-harness/database/schema.sql`
- **Existing seed**: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`
- **Task description**: TASK-024 brief
