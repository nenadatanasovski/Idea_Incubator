# TASK-023: Fix task-queue-persistence.test.ts Unknown Type Assertions

## Status

**COMPLETED** ✅ (Fixed in commit 26c8366)

## Overview

The test file `tests/task-queue-persistence.test.ts` had 15 TS2571 errors where database query results were typed as `unknown[]` and properties could not be accessed without type assertions. This specification documents the fix that was implemented.

## Problem Statement

### Original Issue

The `query()` function from `database/db.ts` is a generic function that can return typed results:

```typescript
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]>;
```

However, when called without a type parameter, it defaults to `any` in the implementation but TypeScript strict mode treats the results as `unknown[]` in test files. This caused 15 TS2571 errors when trying to access properties on the returned rows.

### Error Examples

```typescript
// ❌ Error: Object is of type 'unknown'
const queueItems = await query(
  "SELECT * FROM task_queue WHERE task_list_path = ? ORDER BY position ASC",
  [testTaskListPath],
);
expect(queueItems[0].task_id).toBe("TST-001"); // TS2571: Cannot access 'task_id' of unknown
```

## Requirements

### Functional Requirements

1. **FR-1**: All database query calls must be properly typed with TypeScript generics
2. **FR-2**: Database row interfaces must accurately reflect the schema
3. **FR-3**: Type safety must be maintained for all database operations
4. **FR-4**: Test assertions must have full type information

### Non-Functional Requirements

1. **NFR-1**: Zero TypeScript compilation errors in the test file
2. **NFR-2**: All tests must continue to pass with proper typing
3. **NFR-3**: Type definitions should be reusable if needed elsewhere

## Technical Design

### Solution Architecture

The fix involves two key changes:

1. **Define Database Row Types**: Create TypeScript interfaces matching the database schema
2. **Add Type Parameters**: Use generic type parameters on `query<T>()` calls

### Database Row Type Definitions

```typescript
// Database row types
interface TaskQueueRow {
  id: string;
  task_list_path: string;
  task_id: string;
  priority: string;
  section: string | null;
  description: string;
  dependencies: string | null;
  status: string;
  assigned_agent: string | null;
  position: number;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ExecutorStateRow {
  id: string;
  task_list_path: string;
  status: string;
  config_json: string | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  skipped_tasks: number;
  current_task_id: string | null;
  started_at: string | null;
  paused_at: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Type Parameter Usage

**Before (15 errors):**

```typescript
const queueItems = await query(
  "SELECT * FROM task_queue WHERE task_list_path = ? ORDER BY position ASC",
  [testTaskListPath],
); // Returns unknown[]
```

**After (typed correctly):**

```typescript
const queueItems = await query<TaskQueueRow>(
  "SELECT * FROM task_queue WHERE task_list_path = ? ORDER BY position ASC",
  [testTaskListPath],
); // Returns TaskQueueRow[]
```

### Implementation Changes

The following query calls were updated with type parameters:

| Line    | Query Target               | Type Parameter     | Occurrences |
| ------- | -------------------------- | ------------------ | ----------- |
| 107-110 | task_queue (all rows)      | `TaskQueueRow`     | 1           |
| 145-148 | executor_state             | `ExecutorStateRow` | 1           |
| 176-179 | task_queue (single task)   | `TaskQueueRow`     | 1           |
| 188-191 | task_queue (all rows)      | `TaskQueueRow`     | 1           |
| 204-207 | executor_state             | `ExecutorStateRow` | 1           |
| 218-221 | task_queue (skipped task)  | `TaskQueueRow`     | 1           |
| 235-238 | task_queue (requeued task) | `TaskQueueRow`     | 1           |

**Total**: 7 distinct query calls, each with 1-3 property accesses = 15 TS2571 errors resolved.

## Schema Alignment

The type definitions align with the database schema defined in `database/migrations/034_task_queue_persistence.sql`:

### task_queue Table

```sql
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    task_list_path TEXT NOT NULL,
    task_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    section TEXT,
    description TEXT NOT NULL,
    dependencies TEXT,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    assigned_agent TEXT,
    position INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    queued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### executor_state Table

```sql
CREATE TABLE executor_state (
    id TEXT PRIMARY KEY,
    task_list_path TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
    config_json TEXT,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    skipped_tasks INTEGER DEFAULT 0,
    current_task_id TEXT,
    started_at TEXT,
    paused_at TEXT,
    stopped_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

## Pass Criteria

### ✅ PC-1: Zero TS2571 Errors

**Status**: PASS
**Evidence**: `npx tsc --noEmit` returns exit code 0 with zero errors

### ✅ PC-2: Proper Type Assertions

**Status**: PASS
**Evidence**: All 7 `query()` calls use generic type parameters (`query<TaskQueueRow>` or `query<ExecutorStateRow>`)

### ✅ PC-3: TypeScript Compilation Passes

**Status**: PASS
**Evidence**:

```bash
$ npx tsc --noEmit
# Exit code: 0 (no errors)
```

### ✅ PC-4: All Tests Pass

**Status**: PASS
**Evidence**:

```bash
$ npm test task-queue-persistence
✓ tests/task-queue-persistence.test.ts (8 tests) 27ms
  Test Files  1 passed (1)
  Tests  8 passed (8)
```

**Test Coverage:**

- ✓ should persist queue to database on load
- ✓ should restore queue from database on restart
- ✓ should persist executor state
- ✓ should update queue status when task is executed
- ✓ should maintain priority order in persisted queue
- ✓ should persist state changes when pausing
- ✓ should handle skip task persistence
- ✓ should handle requeue task persistence

## Dependencies

### Files Modified

- `tests/task-queue-persistence.test.ts` (52 lines changed in commit 26c8366)

### Files Referenced

- `database/db.ts` - Generic `query<T>()` function
- `database/migrations/034_task_queue_persistence.sql` - Schema definitions
- `server/services/task-executor.ts` - TaskExecutor implementation

### Related Tasks

- **EXE-004**: Task Queue Persistence (parent feature)
- **TASK-012**: TaskTestService type fixes (similar type assertion issue)
- **TASK-021**: QuestionEngine type fixes (similar pattern)

## Alternative Approaches Considered

### Alternative 1: Type Assertion with `as`

```typescript
const queueItems = (await query(...)) as TaskQueueRow[];
```

**Rejected**: Less type-safe, bypasses TypeScript checking, doesn't leverage generics

### Alternative 2: Inline Type Definitions

```typescript
const queueItems = await query<{
  id: string;
  task_id: string;
  // ... all fields
}>(...);
```

**Rejected**: Verbose, not reusable, hard to maintain

### Alternative 3: Central Type Definition File

Create `types/database-rows.ts` with all row types.
**Rejected**: Over-engineering for test-only usage, but could be reconsidered if types are needed elsewhere

### Selected Approach: Local Interface Definitions ✅

Define interfaces at the top of the test file and use generic type parameters.
**Selected**: Clean, type-safe, reusable within the file, easy to maintain

## Testing Strategy

### Unit Tests

All existing tests in `tests/task-queue-persistence.test.ts` verify the fix:

1. **Type Safety**: TypeScript compiler enforces correct types
2. **Runtime Behavior**: Tests verify database operations work correctly
3. **Property Access**: All property accesses are type-checked

### Verification Commands

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Run tests
npm test task-queue-persistence

# Check specific file
npx tsc --noEmit tests/task-queue-persistence.test.ts
```

## Documentation

### Related Documentation

- [Task Queue Persistence](../task-execution/queue-persistence.md) - Feature documentation
- [Database Schema](../../database/schema.sql) - Schema reference
- [Migration 034](../../database/migrations/034_task_queue_persistence.sql) - Table definitions

### Code Comments

Inline comment added to clarify purpose of type definitions:

```typescript
// Database row types
interface TaskQueueRow { ... }
interface ExecutorStateRow { ... }
```

## Lessons Learned

### Pattern for Database Query Typing

When using the generic `query<T>()` function from `database/db.ts`:

1. **Always provide type parameter**: `query<RowType>()` not `query()`
2. **Define row types locally**: Match database schema exactly
3. **Handle nullable fields**: Use `string | null`, not just `string`
4. **SQLite type mapping**:
   - `TEXT` → `string`
   - `INTEGER` → `number`
   - Nullable columns → `type | null`
   - Timestamps → `string` (SQLite stores as TEXT)

### Similar Issues in Codebase

This same pattern was applied to fix:

- **TASK-012**: TaskTestService type errors (verification #S257)
- **TASK-021**: QuestionEngine type errors (verification #S256)

### Prevention

To prevent similar issues in the future:

1. **Use strict TypeScript mode** in test files
2. **Always type database queries** with generics
3. **Create row type interfaces** matching schema
4. **Run TypeScript checks** before committing tests

## Implementation Notes

### Commit Information

- **Commit**: 26c8366
- **Message**: "save"
- **Files Changed**: 1 (tests/task-queue-persistence.test.ts)
- **Lines Changed**: +52 (added type definitions and type parameters)

### Implementation Date

Implemented prior to 2026-02-08 (task verification session #S250, #S252)

### Implementation Approach

1. Analyzed TS2571 errors to identify all affected query calls
2. Reviewed database schema to create accurate type definitions
3. Added `TaskQueueRow` and `ExecutorStateRow` interfaces
4. Updated all 7 `query()` calls to use type parameters
5. Verified TypeScript compilation passes
6. Ran tests to confirm functionality preserved

## Conclusion

TASK-023 was successfully completed by adding TypeScript type definitions for database row types and using generic type parameters on all `query()` function calls. This eliminated all 15 TS2571 "Object is of type 'unknown'" errors while maintaining full test functionality and type safety.

The solution is clean, maintainable, and follows TypeScript best practices for generic function usage. All pass criteria are met, and the implementation serves as a reference pattern for similar database query typing issues.
