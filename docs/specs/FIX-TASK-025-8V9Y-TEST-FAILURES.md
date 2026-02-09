# FIX-TASK-025-8V9Y: Fix Test Failures After Unused Import Removal

**Status**: READY FOR IMPLEMENTATION
**Created**: 2026-02-08 22:28
**Agent**: Spec Agent
**Priority**: Medium (Test Quality)
**Estimated Effort**: 1-2 hours

---

## Executive Summary

TASK-025 (remove unused imports) was **successfully completed** in commit 29cf072. However, the QA verification revealed 15 test failures unrelated to the import removal. This specification addresses those database schema issues to achieve 100% test pass rate.

## Current Status

### ✅ Completed (Commit 29cf072)
- Removed 58 unused imports across 30+ files
- Fixed 154 TypeScript compilation errors in frontend
- TypeScript compilation now passes with zero TS6133 warnings
- Zero unused imports remain in test files

### ❌ Test Failures (15 failed / 1777 total)

**Test Results:**
```
Test Files: 5 failed | 101 passed (106)
Tests: 15 failed | 1762 passed | 4 skipped (1777)
Pass Rate: 99.2% (target: 100%)
```

**Failed Test Files:**
1. `tests/avatar.test.ts` - 2 failures
2. `tests/preferences.test.ts` - 7 failures  
3. Other files - 6 failures

**Root Cause:** Database table `account_profiles` missing despite migration 026_user_profiles.sql being applied.

## Problem Analysis

### Investigation Findings

1. **Migration Exists and Runs**
   - Migration `026_user_profiles.sql` exists
   - Test output shows: `[SUCCESS] Applied: 026_user_profiles.sql`
   - But table is not available to tests

2. **Error Pattern**
   ```
   DatabaseError: Database error during run: no such table: account_profiles
     at run database/db.ts:146:11
     at updateAvatarPath database/db.ts:883:3
     at AvatarHandler.deleteAvatar server/services/avatar-handler.ts:63:5
   ```

3. **Migration System**
   - Uses custom migration system (database/migrate.ts)
   - Runs in globalSetup (tests/globalSetup.ts)
   - Creates test database at `database/test.db`
   - 133 migrations applied successfully

4. **Ideation Tests Pass**
   - Ideation tests previously failing now pass
   - Issue was race condition, resolved by single-fork execution
   - Tables `ideation_sessions`, etc. exist and work correctly

### Root Cause Hypothesis

One of the following is likely true:

**Hypothesis A**: Migration 026 doesn't create `account_profiles`
- Need to verify SQL content
- May create different table name
- May have been superseded by later migration

**Hypothesis B**: Table created in different database
- Test database path mismatch
- Migration runs against different DB than tests use
- Config path issue

**Hypothesis C**: Table creation fails silently
- SQL syntax error in migration
- Constraint violation during creation
- IF NOT EXISTS preventing creation

## Requirements

### Functional Requirements

**FR1: All Tests Pass**
- 100% test pass rate (1777 / 1777 tests passing)
- Zero test failures in avatar.test.ts
- Zero test failures in preferences.test.ts
- All other test files continue to pass

**FR2: Database Schema Complete**
- All required tables exist after migration
- Tables are accessible to all tests
- Foreign key relationships work correctly
- Constraints are enforced

**FR3: Migration Reliability**
- Migrations run deterministically
- Migration idempotency (safe to run multiple times)
- No race conditions between tests

### Non-Functional Requirements

**NFR1: Test Isolation**
- Tests don't pollute shared database
- Each test file can run independently
- Single-fork mode prevents concurrency issues

**NFR2: Maintainability**
- Clear error messages for schema issues
- Migration failures are visible and actionable
- Test setup validates schema before running tests

## Technical Design

### Investigation Phase

**Step 1: Verify Migration Content**
```bash
# Read migration 026 to confirm it creates account_profiles
cat database/migrations/026_user_profiles.sql
```

**Step 2: Check Test Database State**
```bash
# Run migration and inspect database
npm run schema:migrate
sqlite3 database/test.db ".tables" | grep account
```

**Step 3: Inspect db.ts updateAvatarPath**
```typescript
// Check what table it expects
// Line 883: updateAvatarPath function
```

**Step 4: Check for Table Conflicts**
```bash
# Search for account_profiles references
grep -r "account_profiles" database/migrations/
grep -r "account_profiles" database/db.ts
```

### Implementation Options

**Option A: Fix Migration (If table missing)**

If 026_user_profiles.sql doesn't create `account_profiles`:

```sql
-- Create migration 134_fix_account_profiles.sql
CREATE TABLE IF NOT EXISTS account_profiles (
  user_id TEXT PRIMARY KEY,
  avatar_path TEXT,
  display_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Option B: Fix Table Reference (If table has different name)**

If migration creates `user_profiles` but code expects `account_profiles`:

```typescript
// In database/db.ts line 883
// Change FROM:
UPDATE account_profiles SET avatar_path = ? WHERE user_id = ?
// TO:
UPDATE user_profiles SET avatar_path = ? WHERE user_id = ?
```

**Option C: Add Migration Guard (If timing issue)**

If table exists but isn't visible yet:

```typescript
// In tests/globalSetup.ts
export async function setup() {
  // ... existing code ...
  await runMigrations();
  
  // Verify critical tables exist
  const db = await getDb();
  const tables = db.exec(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('account_profiles', 'ideation_sessions')
  `);
  
  if (tables[0]?.values.length !== 2) {
    throw new Error('Critical tables missing after migration');
  }
  
  await closeDb();
}
```

### Recommended Approach

1. **Read `database/migrations/026_user_profiles.sql`**
   - Identify what tables it creates
   - Check for `account_profiles` or similar

2. **Read `database/db.ts` line 880-890**
   - Identify what table `updateAvatarPath` expects
   - Check if name matches migration

3. **Compare and Fix**
   - If migration is wrong: create new migration with correct table
   - If code is wrong: update SQL query to use correct table name
   - If both correct: add validation to globalSetup

4. **Test Fix**
   ```bash
   npm test -- tests/avatar.test.ts
   npm test -- tests/preferences.test.ts
   npm test  # Full suite
   ```

## Pass Criteria

### ✅ Pass Criterion 1: All Tests Pass
```bash
npm test -- --pool=forks --poolOptions.forks.maxForks=1
```
**Expected:**
- Test Files: 106 passed (106)
- Tests: 1777 passed | 4 skipped (1777)
- Zero failures

### ✅ Pass Criterion 2: Build Succeeds
```bash
npm run build
```
**Expected:** Clean build with exit code 0

### ✅ Pass Criterion 3: TypeScript Compiles
```bash
npx tsc --noEmit
```
**Expected:** No errors, no TS6133 warnings (already passing)

### ✅ Pass Criterion 4: Database Tables Exist
```bash
sqlite3 database/test.db "SELECT name FROM sqlite_master WHERE type='table' AND name='account_profiles'"
```
**Expected:** `account_profiles` returned

### ✅ Pass Criterion 5: Avatar Tests Pass
```bash
npm test -- tests/avatar.test.ts --pool=forks
```
**Expected:** 4/4 tests pass

### ✅ Pass Criterion 6: Preferences Tests Pass
```bash
npm test -- tests/preferences.test.ts --pool=forks
```
**Expected:** All tests pass (8/8 or similar)

## Files to Investigate/Modify

### Investigation (Read-Only)
1. `database/migrations/026_user_profiles.sql` - Check what tables are created
2. `database/db.ts` (lines 880-890) - Check updateAvatarPath implementation
3. `tests/avatar.test.ts` - Understand test expectations
4. `tests/preferences.test.ts` - Understand test expectations
5. `tests/globalSetup.ts` - Check migration execution

### Potential Changes
1. **New Migration** (if table missing)
   - `database/migrations/134_fix_account_profiles.sql`

2. **Fix Existing Code** (if table name mismatch)
   - `database/db.ts` (updateAvatarPath function)

3. **Add Validation** (if timing issue)
   - `tests/globalSetup.ts` (add schema validation)

## Dependencies

### Blocked By
- None

### Blocks
- None (quality improvement)

### Related Tasks
- TASK-025: Remove unused imports (✅ completed)
- TASK-001: Fix TypeScript errors (✅ completed)  
- FIX-TASK-025-8V9Y: This task

## Risk Assessment

### Low Risk
- Changes are to database schema or test setup
- Full test suite validates no regressions
- Single-fork mode prevents race conditions
- Changes don't affect production code

### Mitigation
- Test after each change
- Use git for easy rollback
- Verify other tests still pass
- Check migration can run multiple times safely

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Test Pass Rate | 99.2% | 100% |
| Failed Tests | 15 | 0 |
| Passing Tests | 1762 | 1777 |
| TypeScript Errors | 0 ✅ | 0 |
| Unused Imports | 0 ✅ | 0 |

## Implementation Notes

### Debugging Commands

```bash
# Check migration status
npm run schema:migrate -- --status

# Verify test database tables
sqlite3 database/test.db ".tables"

# Check for account_profiles
sqlite3 database/test.db "SELECT sql FROM sqlite_master WHERE name='account_profiles'"

# Run specific failing test with verbose output
npm test -- tests/avatar.test.ts --reporter=verbose

# Check migration content
cat database/migrations/026_user_profiles.sql | grep -A20 "CREATE TABLE"
```

### Git Workflow

```bash
# Make changes
git add database/migrations/134_fix_account_profiles.sql
git commit -m "fix(db): create account_profiles table for avatar tests"

# Or if fixing code
git add database/db.ts
git commit -m "fix(db): use correct table name in updateAvatarPath"

# Verify
npm test
git commit -m "verify: all 1777 tests passing (FIX-TASK-025-8V9Y)"
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-08 22:28  
**Status:** Ready for Implementation  
**Next Step:** Investigate migration 026 content and db.ts updateAvatarPath
