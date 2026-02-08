# TASK-024: Complete Phase 2 Task 2.6 Test System Seed Data

## Overview

Phase 2 Task 2.6 (Create Test System Tables Seed) is partially complete according to PHASES.md. Test suites have been created (16 rows) but the test_cases, test_steps, and test_assertions for Phase 1 tasks are missing from the database. This task ensures proper test tracking and validation queries for the phased implementation approach.

## Current State Analysis

### What Exists

1. **Schema**: Complete test system schema exists in `parent-harness/database/schema.sql`
   - `test_suites` table
   - `test_cases` table
   - `test_steps` table
   - `test_assertions` table
   - Supporting tables: `test_runs`, `test_case_results`, `test_step_results`, `test_assertion_results`

2. **Seed Scripts**: Implementation complete in `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`
   - Creates 1 test suite: `phase_1_frontend_shell`
   - Creates 8 test cases (one per Phase 1 task 1.1-1.8)
   - Creates 21 test steps across all cases
   - Creates 28 test assertions for validation

3. **Verification Script**: `parent-harness/orchestrator/src/db/verify-phase1-seed.ts`
   - Validates all seed data was inserted correctly
   - Checks pass criteria are met

### What's Missing

**Database is not populated**: The seed script exists but has not been executed against the production database at `parent-harness/orchestrator/data/harness.db`.

**Current state**:
```bash
$ sqlite3 data/harness.db "SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_1_frontend_shell'"
0
```

## Requirements

### Functional Requirements

1. **Execute Seed Script**: Run `npm run seed-phase1-tests` to populate the database
2. **Verify Data Integrity**: Run verification script to confirm all data loaded correctly
3. **Document Process**: Update PHASES.md to mark Task 2.6 as complete

### Data Requirements

Based on `seed-phase1-tests.ts`, the following data must exist in the database:

#### Test Suite
- **ID**: `phase_1_frontend_shell`
- **Name**: "Phase 1: Frontend Shell"
- **Type**: `verification`
- **Phase**: 1
- **Enabled**: 1

#### Test Cases (8 total)

| ID | Name | Priority | Steps |
|----|------|----------|-------|
| `phase_1_task_1_vite_setup` | Vite + React + TypeScript Setup | P0 | 3 |
| `phase_1_task_2_tailwind` | Tailwind CSS Configuration | P0 | 4 |
| `phase_1_task_3_layout` | Three-Column Layout | P0 | 2 |
| `phase_1_task_4_agent_card` | AgentStatusCard Component | P1 | 2 |
| `phase_1_task_5_event_stream` | EventStream Component | P1 | 2 |
| `phase_1_task_6_task_card` | TaskCard Component | P1 | 2 |
| `phase_1_task_7_routing` | Basic Routing | P0 | 4 |
| `phase_1_task_8_notifications` | Notification Center | P2 | 2 |

#### Test Steps (21 total)

Each test case has multiple steps that verify:
- File existence (e.g., `test -f parent-harness/dashboard/src/main.tsx`)
- Package dependencies (e.g., checking `package.json` contents)
- Configuration files (e.g., `vite.config.ts`, `index.css`)
- Component test IDs (e.g., `data-testid="layout-header"`)
- Build success (e.g., `npm run build`)

#### Test Assertions (28 total)

Assertions validate:
- **Type**: `exists`, `contains`, `equals`
- **Target**: File paths or content patterns
- **Expected Values**: Specific strings or patterns
- **Error Messages**: Human-readable failure descriptions

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PHASES.md (Phase 2 Task 2.6)                                │
│ - Documents test seed requirements                          │
│ - Lists pass criteria                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ seed-phase1-tests.ts                                        │
│ - Defines test structure in TypeScript                      │
│ - Inserts suites, cases, steps, assertions                  │
│ - Uses ON CONFLICT for idempotency                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ harness.db (SQLite Database)                                │
│ - test_suites: 1 row                                        │
│ - test_cases: 8 rows                                        │
│ - test_steps: 21 rows                                       │
│ - test_assertions: 28 rows                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ verify-phase1-seed.ts                                       │
│ - Validates data integrity                                  │
│ - Checks pass criteria                                      │
│ - Reports success/failure                                   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

The test system uses cascading deletes to maintain referential integrity:

```sql
test_suites (id PK)
    ↓ (FK suite_id, ON DELETE CASCADE)
test_cases (id PK)
    ↓ (FK case_id, ON DELETE CASCADE)
test_steps (id PK)
    ↓ (FK step_id, ON DELETE CASCADE)
test_assertions (id PK)
```

### Seed Script Implementation

The script uses idempotent inserts with `ON CONFLICT DO UPDATE`:

```typescript
run(`
  INSERT INTO test_cases (id, suite_id, name, description, priority, enabled)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    priority = excluded.priority
`, [...])
```

This ensures:
- Script can be run multiple times safely
- Existing data is updated, not duplicated
- No manual cleanup required between runs

### ID Generation Strategy

**Deterministic IDs** are used for test records:
- Suite: `phase_1_frontend_shell`
- Case: `phase_1_task_N_<slug>` (e.g., `phase_1_task_1_vite_setup`)
- Step: `<case_id>_step_N` (e.g., `phase_1_task_1_vite_setup_step_1`)
- Assertion: `<step_id>_assert_N` (e.g., `phase_1_task_1_vite_setup_step_1_assert_1`)

**Benefits**:
- Predictable IDs for validation queries
- Easy to reference in PHASES.md
- No UUID collisions
- Clear hierarchical structure

## Implementation Steps

### Step 1: Run Migration (if needed)

Ensure database schema is up to date:

```bash
cd parent-harness/orchestrator
npm run migrate
```

### Step 2: Execute Seed Script

Populate the test system tables:

```bash
cd parent-harness/orchestrator
npm run seed-phase1-tests
```

**Expected output**:
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

### Step 3: Verify Seed Data

Run verification to confirm all requirements met:

```bash
npx tsx src/db/verify-phase1-seed.ts
```

**Expected output**:
```
🔍 Verification Results:

1. Test Cases: 8/8 ✓
2. Test Steps: 21 (expected at least 8) ✓
3. Test Assertions: 28 (expected at least 8) ✓

📋 Test Cases Created:

   1. phase_1_task_1_vite_setup - Vite + React + TypeScript Setup (P0)
   2. phase_1_task_2_tailwind - Tailwind CSS Configuration (P0)
   3. phase_1_task_3_layout - Three-Column Layout (P0)
   4. phase_1_task_4_agent_card - AgentStatusCard Component (P1)
   5. phase_1_task_5_event_stream - EventStream Component (P1)
   6. phase_1_task_6_task_card - TaskCard Component (P1)
   7. phase_1_task_7_routing - Basic Routing (P0)
   8. phase_1_task_8_notifications - Notification Center (P2)

🔗 Steps per Test Case:

   ✓ Vite + React + TypeScript Setup: 3 steps
   ✓ Tailwind CSS Configuration: 4 steps
   ✓ Three-Column Layout: 2 steps
   ✓ AgentStatusCard Component: 2 steps
   ✓ EventStream Component: 2 steps
   ✓ TaskCard Component: 2 steps
   ✓ Basic Routing: 4 steps
   ✓ Notification Center: 2 steps

🔎 Validation Query Test:

   Total Phase 1 tasks: 8/8

✅ Pass Criteria Status:

   1. 8 test_cases created: ✓ PASS
   2. Each has at least 1 step: ✓ PASS
   3. Key assertions defined: ✓ PASS
   4. Validation query works: ✓ PASS
   5. Phase 1 task tracking: ✓ PASS
```

### Step 4: Update Documentation

Mark Task 2.6 as complete in `parent-harness/docs/PHASES.md`:

```markdown
### Task 2.6: Create Test System Tables Seed

**Test Record:** `phase_2_task_6_test_seed`

**Build Steps:**
- [x] 2.6.1: Create test_suites for each phase (16 suites) ✅
- [x] 2.6.2: Create test_cases for Phase 1 tasks (8 cases) ✅
- [x] 2.6.3: Create test_steps for each case ✅
- [x] 2.6.4: Create test_assertions for key criteria ✅

**Pass Criteria:**
- [x] 16 rows in `test_suites` (one per phase) ✅
- [x] 8 rows in `test_cases` for phase_1 ✅
- [x] Each test_case has at least 1 test_step ✅
- [x] Key assertions defined ✅
```

## Pass Criteria

### 1. Test Cases Created ✓

**Validation Query**:
```sql
SELECT COUNT(*) as count FROM test_cases
WHERE suite_id = 'phase_1_frontend_shell';
```

**Expected Result**: `count = 8`

**Verification**: All 8 Phase 1 tasks have corresponding test cases with appropriate names, descriptions, and priority levels.

### 2. Test Steps Defined ✓

**Validation Query**:
```sql
SELECT case_id, COUNT(*) as step_count
FROM test_steps
WHERE case_id IN (
  SELECT id FROM test_cases
  WHERE suite_id = 'phase_1_frontend_shell'
)
GROUP BY case_id;
```

**Expected Result**: All 8 cases return `step_count >= 1`

**Verification**: Each test case has at least one executable test step with command, expected exit code, and optional output validation.

### 3. Assertions Defined ✓

**Validation Query**:
```sql
SELECT COUNT(*) as count FROM test_assertions
WHERE step_id IN (
  SELECT id FROM test_steps
  WHERE case_id IN (
    SELECT id FROM test_cases
    WHERE suite_id = 'phase_1_frontend_shell'
  )
);
```

**Expected Result**: `count >= 8` (at least one assertion per case)

**Verification**: Key pass criteria from PHASES.md are encoded as testable assertions with proper types, targets, and error messages.

### 4. Validation Query Works ✓

**Validation Query**:
```sql
SELECT * FROM test_case_results
WHERE case_id = 'phase_1_task_1_vite_setup' AND status = 'passed';
```

**Expected Result**: Query executes without error (may return 0 rows if tests haven't run yet)

**Verification**: The validation query structure matches the format specified in PHASES.md and can be used to check task completion status.

### 5. Phase 1 Task Completion Tracking ✓

**Validation Query**:
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results
WHERE case_id LIKE 'phase_1_task_%';
```

**Expected Result**: Query structure is correct (actual results depend on test execution)

**Verification**: The test system can track which Phase 1 tasks have passed and which are still pending or failed.

## Dependencies

### Prerequisites

1. **Database Schema**: `parent-harness/database/schema.sql` must be applied
2. **Database Connection**: `parent-harness/orchestrator/src/db/index.ts` working
3. **Node Environment**: Node.js with `better-sqlite3` package installed
4. **TypeScript**: `tsx` or `ts-node` for running TypeScript files

### Related Files

- **Schema**: `parent-harness/database/schema.sql`
- **Seed Script**: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts`
- **Verify Script**: `parent-harness/orchestrator/src/db/verify-phase1-seed.ts`
- **Documentation**: `parent-harness/docs/PHASES.md`
- **Database**: `parent-harness/orchestrator/data/harness.db`

### NPM Scripts

```json
{
  "migrate": "tsx src/db/migrate.ts",
  "seed": "tsx src/db/seed.ts",
  "seed-phase1-tests": "tsx src/db/seed-phase1-tests.ts"
}
```

## Testing Strategy

### Manual Verification

1. **Direct SQL Query**:
   ```bash
   sqlite3 data/harness.db "SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_1_frontend_shell'"
   ```
   Should return `8`.

2. **Verification Script**:
   ```bash
   npx tsx src/db/verify-phase1-seed.ts
   ```
   All checks should show `✓ PASS`.

3. **Idempotency Test**:
   ```bash
   npm run seed-phase1-tests
   npm run seed-phase1-tests  # Run twice
   ```
   Should produce identical results without errors.

### Automated Testing

The existing test suite at `parent-harness/orchestrator/tests/` should include:

1. **Database Schema Tests**: Verify tables exist with correct columns
2. **Seed Data Tests**: Verify counts and relationships after seeding
3. **Query Tests**: Verify validation queries return expected structure

### Integration Testing

Test that the seeded data integrates correctly with:

1. **API Endpoints**: `GET /api/tests/suites` returns phase_1_frontend_shell
2. **Dashboard UI**: Test suite appears in test management interface
3. **Orchestrator**: Can read and execute test cases

## Error Handling

### Common Issues

1. **Database Locked**:
   - **Cause**: Another process has database open
   - **Solution**: Close other connections, restart server
   - **Prevention**: Use proper connection pooling

2. **Foreign Key Constraint**:
   - **Cause**: Attempting to insert test_case before test_suite
   - **Solution**: Script inserts in correct order (suite → case → step → assertion)
   - **Prevention**: Use transactions for atomic operations

3. **Duplicate Key**:
   - **Cause**: ID collision with existing data
   - **Solution**: Script uses `ON CONFLICT DO UPDATE` for idempotency
   - **Prevention**: Use deterministic IDs as designed

4. **Missing Database**:
   - **Cause**: `harness.db` doesn't exist
   - **Solution**: Run `npm run migrate` first
   - **Prevention**: Document proper setup sequence

### Rollback Strategy

If seed fails or produces incorrect data:

```bash
# Option 1: Delete test data
sqlite3 data/harness.db "DELETE FROM test_suites WHERE id = 'phase_1_frontend_shell'"

# Option 2: Re-run migration (drops all tables)
npm run migrate

# Option 3: Restore from backup
cp data/harness.db.backup data/harness.db
```

## Performance Considerations

### Seed Performance

- **Expected Duration**: < 1 second for 58 total records (1 suite + 8 cases + 21 steps + 28 assertions)
- **Database Size**: Minimal impact (~5KB increase)
- **Index Usage**: Primary keys and foreign keys are indexed automatically

### Query Performance

Validation queries use indexed columns:
- `test_cases.suite_id` (foreign key, indexed)
- `test_steps.case_id` (foreign key, indexed)
- `test_assertions.step_id` (foreign key, indexed)

All queries should execute in < 10ms.

## Security Considerations

### SQL Injection Prevention

The seed script uses parameterized queries exclusively:

```typescript
run(`INSERT INTO test_cases (...) VALUES (?, ?, ?, ...)`, [id, name, ...])
```

**Never** uses string concatenation for SQL.

### Data Validation

- **IDs**: Constrained to alphanumeric + underscore pattern
- **Priorities**: CHECK constraint limits to P0-P4
- **Foreign Keys**: Enforced at database level
- **NOT NULL**: Applied to required columns

### Access Control

- Seed scripts run locally with file system access
- Production database should have appropriate file permissions
- API endpoints for test management should validate user permissions

## Maintenance

### Future Phases

When adding test data for Phases 2-16:

1. **Create Seed Script**: `seed-phase2-tests.ts`, `seed-phase3-tests.ts`, etc.
2. **Follow Same Pattern**: Suite → Cases → Steps → Assertions
3. **Use Deterministic IDs**: `phase_N_task_M_<slug>`
4. **Add NPM Script**: `"seed-phaseN-tests": "tsx src/db/seed-phaseN-tests.ts"`
5. **Create Verification**: `verify-phaseN-seed.ts` for each phase

### Schema Evolution

If test system schema changes:

1. **Create Migration**: Add to `parent-harness/database/migrations/`
2. **Update Seed Scripts**: Modify to match new schema
3. **Update Verification**: Adjust checks for new columns/constraints
4. **Test Backwards Compatibility**: Ensure existing data migrates cleanly

### Documentation Updates

Keep these files synchronized:

- `PHASES.md`: Source of truth for task structure
- `seed-phase1-tests.ts`: Implementation of seed data
- `verify-phase1-seed.ts`: Validation of requirements
- This spec document: Technical reference

## Success Metrics

### Immediate Success

- ✓ Seed script executes without errors
- ✓ Verification script shows all checks passing
- ✓ All 5 pass criteria met
- ✓ PHASES.md updated with completion checkmarks

### Long-Term Success

- ✓ Test system used to track Phase 1 task completion
- ✓ Validation queries confirm Phase 1 gate before Phase 2 begins
- ✓ Pattern successfully replicated for Phases 2-16
- ✓ Orchestrator can execute tests and record results automatically

## Appendix

### Example Test Case Structure

```typescript
{
  id: 'phase_1_task_1_vite_setup',
  name: 'Vite + React + TypeScript Setup',
  description: 'Verify Vite project is set up correctly',
  priority: 'P0',
  steps: [
    {
      name: 'Check dashboard folder exists',
      command: 'test -d parent-harness/dashboard',
      expectedExitCode: 0,
      assertions: [
        {
          type: 'exists',
          target: 'parent-harness/dashboard',
          errorMessage: 'Dashboard folder should exist'
        }
      ]
    }
  ]
}
```

### Key SQL Queries

**Check Test Suite**:
```sql
SELECT * FROM test_suites WHERE id = 'phase_1_frontend_shell';
```

**List All Phase 1 Cases**:
```sql
SELECT id, name, priority
FROM test_cases
WHERE suite_id = 'phase_1_frontend_shell'
ORDER BY id;
```

**Steps Per Case**:
```sql
SELECT tc.name, COUNT(ts.id) as step_count
FROM test_cases tc
LEFT JOIN test_steps ts ON tc.id = ts.case_id
WHERE tc.suite_id = 'phase_1_frontend_shell'
GROUP BY tc.id;
```

**Assertions Per Step**:
```sql
SELECT ts.name, COUNT(ta.id) as assertion_count
FROM test_steps ts
LEFT JOIN test_assertions ta ON ts.id = ta.step_id
WHERE ts.case_id IN (
  SELECT id FROM test_cases WHERE suite_id = 'phase_1_frontend_shell'
)
GROUP BY ts.id;
```

### Related Documentation

- **Parent Harness Architecture**: `parent-harness/docs/ARCHITECTURE.md`
- **Phase Implementation Guide**: `parent-harness/docs/PHASES.md`
- **Database Schema**: `parent-harness/database/schema.sql`
- **Test System Design**: `parent-harness/docs/TEST_SYSTEM.md` (if exists)

---

**Document Version**: 1.0
**Created**: 2026-02-08
**Task ID**: TASK-024
**Phase**: 2.6
**Status**: Specification Complete - Ready for Implementation
