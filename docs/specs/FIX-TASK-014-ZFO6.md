# FIX-TASK-014-ZFO6: Fix TaskVersionService Test Infrastructure

## Overview

QA verification reported test failures for TASK-014. Investigation reveals the issue is NOT with the TaskVersionService API signature (which is correctly implemented with method overloading), but rather with the test database infrastructure failing to apply migrations, specifically migration 085 which creates the `task_versions` table.

## Problem Analysis

### Surface Issue
```
DatabaseError: Database error during run: no such table: task_versions
 ❯ cleanupTestData tests/task-agent/task-version-service.test.ts:41:3
```

### Root Cause
The test database at `database/test.db` exists but is empty (0 bytes initially, or not properly migrated). The `globalSetup.ts` is supposed to:
1. Delete old test database
2. Configure path to test database
3. Run all migrations
4. Close database

However, the database ends up without any tables, not even the `_migrations` tracking table.

### Verification
```bash
# Database exists but is empty
$ ls -la database/test.db
-rw-rw-r-- 1 user user 3211264 Feb  8 22:14 database/test.db

# No tables present (including _migrations)
$ sqlite3 database/test.db ".tables"
(empty output)

# Migration 085 exists
$ ls database/migrations/085_create_task_versions.sql
database/migrations/085_create_task_versions.sql
```

### API Signature Status
The TaskVersionService API is **correctly implemented** with three method overloads:

```typescript
// Overload 1: Array of changed fields + optional reason/userId
async createVersion(taskId: string, changedFields: string[], reason?: string, userId?: string): Promise<TaskVersion>;

// Overload 2: Update object with fields
async createVersion(taskId: string, update: {
  title?: string;
  description?: string;
  category?: string;
  changedBy?: string;
  changeReason?: string;
}): Promise<TaskVersion>;

// Overload 3: Simple reason + userId
async createVersion(taskId: string, reason: string, userId: string): Promise<TaskVersion>;
```

The tests correctly use Overload 2 (update object signature):
```typescript
await taskVersionService.createVersion(testTaskId, {
  title: "Title v1",
  changeReason: "v1",
  changedBy: "system"
});
```

The VersionDiff type is **correctly defined** with changes as an array:
```typescript
export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
}
```

## Technical Design

### Solution: Fix Test Database Initialization

The issue is in the test infrastructure, not the code being tested. Fix the global setup to ensure migrations run properly.

#### Option 1: Fix globalSetup.ts (Recommended)
Ensure migrations are actually applied by adding better error handling and verification:

```typescript
// tests/globalSetup.ts
export async function setup() {
  const TEST_DB_PATH = path.resolve(process.cwd(), "database/test.db");

  // Remove old test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Configure to use test database
  const { updateConfig } = await import("../config/index.js");
  updateConfig({
    paths: {
      ideas: "./ideas",
      database: TEST_DB_PATH,
      templates: "./templates",
      taxonomy: "./taxonomy",
    },
  } as any);

  // Run all migrations with error handling
  const { runMigrations } = await import("../database/migrate.js");
  try {
    await runMigrations();
  } catch (error) {
    console.error("Failed to apply migrations in test setup:", error);
    throw error;
  }

  // Verify critical tables exist
  const { query } = await import("../database/db.js");
  const tables = await query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tasks', 'task_versions', '_migrations')"
  );

  if (tables.length < 3) {
    throw new Error(`Expected 3 critical tables, found ${tables.length}: ${tables.map(t => t.name).join(', ')}`);
  }

  // Save and close
  const { saveDb, closeDb } = await import("../database/db.js");
  await saveDb();
  await closeDb();
}
```

#### Option 2: Per-Test Migration Check
Add a check at the start of TaskVersionService tests:

```typescript
// tests/task-agent/task-version-service.test.ts
describe("TaskVersionService", () => {
  beforeAll(async () => {
    // Verify task_versions table exists
    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='task_versions'"
    );
    if (tables.length === 0) {
      throw new Error("task_versions table does not exist - migrations not applied");
    }

    await cleanupTestData();
  });
  // ... rest of tests
});
```

### Implementation Steps

1. **Enhance globalSetup.ts** with error handling and verification (Option 1)
2. **Add diagnostic logging** to migration process to track which migrations apply
3. **Verify test database** after setup in CI/test runs
4. **Run tests** to confirm task_versions table is created and tests pass

## Requirements

### Functional Requirements
- FR1: Test database must be created with all migrations applied before tests run
- FR2: Migration 085 (task_versions table) must be applied successfully
- FR3: All TaskVersionService tests must pass
- FR4: Setup must fail fast with clear error if migrations don't apply

### Non-Functional Requirements
- NFR1: Setup process must complete within 5 seconds
- NFR2: Error messages must clearly indicate which migration failed
- NFR3: Test database must be isolated from development database

## Pass Criteria

1. ✅ All tests pass with no database errors:
   ```bash
   npm test -- task-version-service.test.ts --pool=forks --poolOptions.forks.maxForks=1
   # PASS tests/task-agent/task-version-service.test.ts (11 tests)
   ```

2. ✅ Verify task_versions table exists in test database:
   ```bash
   sqlite3 database/test.db ".schema task_versions"
   # Should output CREATE TABLE statement
   ```

3. ✅ Verify all 11 test cases pass:
   - createVersion: initial version (v1)
   - createVersion: increment version numbers
   - createVersion: capture task snapshot
   - getVersions: return all versions
   - getVersion: return specific version
   - getVersion: return null for non-existent
   - createCheckpoint: create named checkpoint
   - getCheckpoints: return only checkpoints
   - diff: calculate diff between versions
   - restore: restore to previous version
   - previewRestore: show what would change

4. ✅ Build succeeds:
   ```bash
   npm run build
   ```

5. ✅ TypeScript compiles:
   ```bash
   npm run typecheck
   ```

## Dependencies

- **database/migrate.ts**: Migration runner
- **tests/globalSetup.ts**: Global test setup
- **database/migrations/085_create_task_versions.sql**: Task versions table migration
- **database/db.ts**: Database connection and operations

## Notes

### Why This Wasn't Caught Earlier
- The test output shows migrations running but with "[INFO] No pending migrations" which suggests either:
  1. The migration glob pattern isn't finding .sql files
  2. All migrations were marked as applied in _migrations table despite tables not existing
  3. A different database instance is being used during migration vs during tests

### Alternative Root Causes to Investigate
If Option 1 doesn't fix the issue, investigate:
- Database connection pooling issues
- Path resolution differences between setup and test execution
- WAL mode conflicts causing schema changes to not be visible
- Migration transaction rollbacks leaving _migrations marked but tables not created

### Success Metrics
- 11/11 tests passing
- No DatabaseError exceptions
- task_versions table present with correct schema
- Migrations applied in sequence (verify _migrations table)
