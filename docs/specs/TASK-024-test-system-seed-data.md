# TASK-024: Complete Phase 2 Task 2.6 Test System Seed Data

## Overview

**Status**: ✅ COMPLETE

According to PHASES.md Task 2.6 (Create Test System Tables Seed), the test_suites table was created with 16 rows (one per phase), but test_cases, test_steps, and test_assertions for Phase 1 tasks were missing. This blocks proper test tracking and validation queries for the phased implementation approach.

This specification documents the completion of Phase 1 test system seed data, which enables:
- Automated validation of Phase 1 task completion
- Test-driven development workflow
- Proper pass criteria verification through database queries
- Foundation for QA Agent validation loops

## Requirements

### Functional Requirements

**FR-1: Test Suite Creation**
- Create test_suite record for Phase 1 (phase_1_frontend_shell)
- Suite type: verification
- Suite source: phases
- Suite enabled: true

**FR-2: Test Case Creation**
- Create 8 test_cases for Phase 1 tasks:
  1. phase_1_task_1_vite_setup - Vite + React + TypeScript Setup
  2. phase_1_task_2_tailwind - Tailwind CSS Configuration
  3. phase_1_task_3_layout - Three-Column Layout
  4. phase_1_task_4_agent_card - AgentStatusCard Component
  5. phase_1_task_5_event_stream - EventStream Component
  6. phase_1_task_6_task_card - TaskCard Component
  7. phase_1_task_7_routing - Basic Routing
  8. phase_1_task_8_notifications - Notification Center
- Each test_case must reference suite_id 'phase_1_frontend_shell'
- Priority levels: P0-P2 based on task criticality

**FR-3: Test Step Creation**
- Each test_case must have at least 1 test_step defined
- Steps must include:
  - Verification commands (file existence, package.json content, build success)
  - Expected exit codes (default: 0)
  - Expected output patterns (optional)
- Steps ordered by sequence number

**FR-4: Test Assertion Creation**
- Key pass criteria from PHASES.md must be defined as assertions
- Assertion types: exists, contains, equals, matches, truthy
- Each assertion must specify:
  - Target (file path, field, or output)
  - Expected value (if applicable)
  - Error message for failure

**FR-5: Validation Query Support**
- Support validation queries like:
  ```sql
  SELECT * FROM test_case_results
  WHERE case_id = 'phase_1_task_1_vite_setup' AND status = 'passed';
  ```
- Enable Phase 1 completion gate query:
  ```sql
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
  FROM test_case_results
  WHERE case_id LIKE 'phase_1_task_%';
  ```

### Non-Functional Requirements

**NFR-1: Idempotency**
- Seed script must use `ON CONFLICT DO UPDATE` for safe re-runs
- No duplicate records on multiple executions

**NFR-2: Database Integrity**
- All foreign key constraints must be satisfied
- Referential integrity maintained across suite → case → step → assertion chain

**NFR-3: Alignment with PHASES.md**
- Test definitions must match pass criteria in PHASES.md exactly
- Task IDs must follow naming convention: `phase_{N}_task_{M}_{slug}`

## Technical Design

### Database Schema (Relevant Tables)

```sql
-- Test suites (already created in Task 2.6.1)
CREATE TABLE test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('unit', 'integration', 'e2e', 'verification', 'lint', 'typecheck')),
    source TEXT NOT NULL CHECK(source IN ('code', 'phases', 'task_agent', 'planning_agent')),
    phase INTEGER,
    enabled INTEGER DEFAULT 1
);

-- Test cases (TO BE SEEDED)
CREATE TABLE test_cases (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    enabled INTEGER DEFAULT 1
);

-- Test steps (TO BE SEEDED)
CREATE TABLE test_steps (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT,
    expected_exit_code INTEGER DEFAULT 0,
    expected_output_contains TEXT
);

-- Test assertions (TO BE SEEDED)
CREATE TABLE test_assertions (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    assertion_type TEXT NOT NULL CHECK(assertion_type IN ('equals', 'contains', 'matches', 'exists', 'truthy')),
    target TEXT NOT NULL,
    expected_value TEXT,
    error_message TEXT
);
```

### Implementation Approach

**File**: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`

**Structure**:
```typescript
interface SeedTestCase {
  id: string;              // phase_1_task_N_slug
  name: string;            // Human-readable name
  description: string;     // From PHASES.md
  priority: 'P0' | 'P1' | 'P2';
  steps: SeedTestStep[];
}

interface SeedTestStep {
  name: string;
  command: string;
  expectedExitCode?: number;
  expectedOutputContains?: string;
  assertions: SeedAssertion[];
}

interface SeedAssertion {
  type: 'exists' | 'contains' | 'equals';
  target: string;
  expectedValue?: string;
  errorMessage: string;
}
```

**Process**:
1. Create test suite record (or update if exists)
2. For each Phase 1 task (1.1 through 1.8):
   - Create test_case record with task-specific ID
   - Create test_steps based on pass criteria
   - Create test_assertions for key verification points
3. Generate step IDs: `{case_id}_step_{N}`
4. Generate assertion IDs: `{step_id}_assert_{N}`
5. Log progress and final counts

### Data Source: PHASES.md Mapping

Each task's pass criteria from PHASES.md maps to test steps/assertions:

**Example: Task 1.1 (Vite Setup)**
```yaml
Pass Criteria from PHASES.md:
  - dashboard/ folder exists
  - dashboard/package.json contains "vite", "react", "typescript"
  - dashboard/src/main.tsx exists
  - npm run dev starts server on port 5173

Maps to Steps:
  1. Check dashboard folder exists
     Command: test -d parent-harness/dashboard
     Assertion: exists, target=parent-harness/dashboard

  2. Check package.json contains required dependencies
     Command: cat parent-harness/dashboard/package.json
     Assertions:
       - contains "vite"
       - contains "react"
       - contains "typescript"

  3. Check main.tsx exists
     Command: test -f parent-harness/dashboard/src/main.tsx
     Assertion: exists, target=parent-harness/dashboard/src/main.tsx
```

## Pass Criteria

### PC-1: Test Suite Exists ✅
**Criteria**: 1 test_suite record for phase_1_frontend_shell exists
**Validation**:
```sql
SELECT COUNT(*) FROM test_suites WHERE id = 'phase_1_frontend_shell';
-- Must return: 1
```
**Status**: ✅ PASSED

### PC-2: Eight Test Cases Created ✅
**Criteria**: 8 test_cases created for phase_1 tasks (phase_1_task_1_vite_setup through phase_1_task_8_notifications)
**Validation**:
```sql
SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_1_frontend_shell';
-- Must return: 8
```
**Status**: ✅ PASSED

### PC-3: Each Test Case Has Steps ✅
**Criteria**: Each test_case has at least 1 test_step defined
**Validation**:
```sql
SELECT tc.id, COUNT(ts.id) as step_count
FROM test_cases tc
LEFT JOIN test_steps ts ON tc.id = ts.case_id
WHERE tc.suite_id = 'phase_1_frontend_shell'
GROUP BY tc.id
HAVING step_count = 0;
-- Must return: 0 rows (no test cases without steps)
```
**Status**: ✅ PASSED (all 8 test cases have 2-4 steps each, total 21 steps)

### PC-4: Key Assertions Defined ✅
**Criteria**: Critical pass criteria defined as assertions
**Validation**:
```sql
SELECT COUNT(*) FROM test_assertions
WHERE step_id IN (
  SELECT id FROM test_steps
  WHERE case_id IN (
    SELECT id FROM test_cases WHERE suite_id = 'phase_1_frontend_shell'
  )
);
-- Must return: > 0 (at least some assertions exist)
```
**Status**: ✅ PASSED (28 assertions created)

### PC-5: Validation Query Works ✅
**Criteria**: Validation query returns expected structure
**Validation**:
```sql
-- This query should not error (structure exists)
SELECT * FROM test_case_results
WHERE case_id = 'phase_1_task_1_vite_setup' AND status = 'passed'
LIMIT 1;
```
**Status**: ✅ PASSED (query executes successfully, returns 0 rows until tests run)

### PC-6: Phase 1 Task Tracking ✅
**Criteria**: Phase 1 task completion can be properly tracked
**Validation**:
```sql
-- All 8 Phase 1 test cases are queryable
SELECT id, name FROM test_cases
WHERE suite_id = 'phase_1_frontend_shell'
ORDER BY id;
-- Must return: 8 rows with correct IDs
```
**Status**: ✅ PASSED

## Dependencies

### Input Dependencies
- ✅ `parent-harness/docs/PHASES.md` - Source of truth for task definitions and pass criteria
- ✅ `parent-harness/database/schema.sql` - Test system table definitions
- ✅ `parent-harness/orchestrator/src/db/index.ts` - Database connection utilities

### Output Dependencies (Consumed By)
- QA Agent - Uses test_case_results to validate task completion
- Orchestrator - Checks validation queries before proceeding to next task
- Test Runner - Executes test steps and records results
- Phase Gate Validators - Verify phase completion via aggregated queries

## Implementation Details

### Seed Script Location
`parent-harness/orchestrator/src/db/seed-phase1-tests.ts`

### Execution Method
```bash
# From project root
cd parent-harness/orchestrator
npx tsx src/db/seed-phase1-tests.ts

# Or add to package.json scripts
npm run seed-phase1-tests
```

### Database Path
The script uses the database connection from `src/db/index.ts`, which points to:
`parent-harness/data/harness.db`

### Idempotency Strategy
All INSERT statements use `ON CONFLICT(id) DO UPDATE SET` to allow safe re-runs:
```sql
INSERT INTO test_cases (id, suite_id, name, description, priority, enabled)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  priority = excluded.priority
```

## Test Data Summary

### Created Records

| Entity | Count | Details |
|--------|-------|---------|
| test_suites | 1 | phase_1_frontend_shell |
| test_cases | 8 | phase_1_task_1 through phase_1_task_8 |
| test_steps | 21 | 2-4 steps per test case |
| test_assertions | 28 | Verification points for pass criteria |

### Test Case Breakdown

| ID | Name | Steps | Priority |
|----|------|-------|----------|
| phase_1_task_1_vite_setup | Vite + React + TypeScript Setup | 3 | P0 |
| phase_1_task_2_tailwind | Tailwind CSS Configuration | 4 | P0 |
| phase_1_task_3_layout | Three-Column Layout | 2 | P0 |
| phase_1_task_4_agent_card | AgentStatusCard Component | 2 | P1 |
| phase_1_task_5_event_stream | EventStream Component | 2 | P1 |
| phase_1_task_6_task_card | TaskCard Component | 2 | P1 |
| phase_1_task_7_routing | Basic Routing | 4 | P0 |
| phase_1_task_8_notifications | Notification Center | 2 | P2 |

## Verification Results

### Execution Output
```
🧪 Seeding Phase 1 test data...
  📂 Created suite: phase_1_frontend_shell
  📝 Created case: phase_1_task_1_vite_setup
  📝 Created case: phase_1_task_2_tailwind
  📝 Created case: phase_1_task_3_layout
  📝 Created case: phase_1_task_4_agent_card
  📝 Created case: phase_1_task_5_event_stream
  📝 Created case: phase_1_task_6_task_card
  📝 Created case: phase_1_task_7_routing
  📝 Created case: phase_1_task_8_notifications

✅ Phase 1 seed complete:
   - 1 suite: phase_1_frontend_shell
   - 8 test cases
   - 21 test steps
   - 28 test assertions
```

### Database Verification Queries

```sql
-- Verify suite
SELECT * FROM test_suites WHERE id = 'phase_1_frontend_shell';
-- Result: 1 row ✅

-- Verify cases
SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_1_frontend_shell';
-- Result: 8 ✅

-- Verify steps per case
SELECT tc.id, tc.name, COUNT(ts.id) as step_count
FROM test_cases tc
LEFT JOIN test_steps ts ON tc.id = ts.case_id
WHERE tc.suite_id = 'phase_1_frontend_shell'
GROUP BY tc.id;
-- Result: All 8 cases have 2-4 steps ✅

-- Verify total steps
SELECT COUNT(*) FROM test_steps
WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = 'phase_1_frontend_shell');
-- Result: 21 ✅

-- Verify total assertions
SELECT COUNT(*) FROM test_assertions
WHERE step_id IN (
  SELECT id FROM test_steps
  WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = 'phase_1_frontend_shell')
);
-- Result: 28 ✅
```

## Related Tasks

- **Task 2.1-2.5**: Database setup, schema migration, and query functions (prerequisites)
- **Task 2.6.1**: Create test_suites for all 16 phases (completed) ✅
- **Task 2.6.2-2.6.4**: Create test_cases, test_steps, test_assertions for Phase 1 (THIS TASK) ✅
- **Future Tasks**: Seed test data for Phases 2-16

## Notes

### Why Phase 1 Only?
Task 2.6 focuses on Phase 1 seed data because:
1. Phase 1 is the foundation for all subsequent work
2. Test system must be validated before proceeding
3. Phase 2+ test data can be seeded as those phases are implemented
4. Demonstrates the pattern for future phase seeding

### Test Execution vs. Test Definition
This task creates test **definitions** (metadata about what to test). Actual test **execution** (running commands, recording results) is handled by:
- Test Runner service (Phase 3+)
- QA Agent validation loops (Phase 11)
- Build Agent pass criteria verification

### Future Enhancements
- Create test_runs and test_*_results records when tests actually execute
- Add test_fix_attempts tracking for failing tests
- Link tasks to test_cases via task_test_links table
- Create verification scripts for automated phase gate validation

## Conclusion

✅ **TASK-024 COMPLETE**

All pass criteria met:
1. ✅ 8 test_cases created for phase_1 tasks
2. ✅ Each test_case has at least 1 test_step defined (21 total)
3. ✅ Key assertions defined for critical pass criteria (28 total)
4. ✅ Validation queries return expected results
5. ✅ Phase 1 task completion can be properly tracked

The test system seed data is complete and ready for use by the orchestrator, QA Agent, and test runner services.
