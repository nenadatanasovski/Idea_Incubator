# TASK-022: Fix task-version-service diff Property Type Errors

## Overview

**Task**: Fix TypeScript compilation errors in `tests/task-agent/task-version-service.test.ts` where the `diff` property's `from` and `to` fields were being called as functions instead of accessed as object properties.

**Status**: Resolved — the test file has already been corrected.

## Problem Description

The original issue reported TS2349 "This expression is not callable" errors at lines 205-206 of `tests/task-agent/task-version-service.test.ts`, where code attempted to call `diff.from()` and `diff.to()` as functions.

The `VersionDiff` type (defined in `types/task-version.ts`) defines `changes` as:

```ts
export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
}
```

The `diff()` method in `TaskVersionService` (at `server/services/task-agent/task-version-service.ts:197-226`) returns a `VersionDiff` with `changes` as an array of objects, each containing `field`, `from`, and `to` as plain data properties.

## Root Cause

The test code originally attempted to use a stale API pattern where `diff.from()` and `diff.to()` were callable methods. The actual implementation returns `VersionDiff.changes` as an array of `{ field, from, to }` objects that must be accessed via property syntax, not function calls.

## Resolution

The test file was corrected in commit `c438035` ("fix: task-version-service tests (8/11, 3 skipped)"). The diff test section (lines 188-208) now correctly uses:

```ts
const diff = await taskVersionService.diff(testTaskId, 1, 2);
expect(diff.changes).toBeDefined();
expect(diff.changes.some((c) => c.field === "title")).toBe(true);
expect(diff.changes.some((c) => c.field === "priority")).toBe(true);
```

This correctly accesses `diff.changes` as an array and iterates with `.some()` to find changes by `field` name.

## Pass Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | diff property either changed to methods or tests updated to access as properties | PASS | Tests updated to access `diff.changes` as property array (lines 204-206) |
| 2 | TypeScript compilation passes for task-version-service.test.ts | PASS | `npx tsc --noEmit` produces zero errors for this file |
| 3 | All version service tests pass successfully | PARTIAL | Tests compile but fail at runtime due to missing `task_versions` table (database schema migration issue, out of scope for TASK-022) |

## Technical Details

### Files Involved

- **`types/task-version.ts`** — Defines `VersionDiff` interface with `changes: Array<{ field: string; from: unknown; to: unknown }>`
- **`server/services/task-agent/task-version-service.ts`** — `diff()` method (lines 197-226) builds and returns the changes array
- **`tests/task-agent/task-version-service.test.ts`** — Test suite with corrected diff assertions (lines 188-208)

### Remaining Runtime Issue

The test suite fails with `no such table: task_versions` because the database migration creating this table has not been applied in the test environment. This is a separate infrastructure issue unrelated to the TypeScript type errors described in TASK-022.

## Dependencies

- `types/task-version.ts` — Type definitions (no changes needed)
- `server/services/task-agent/task-version-service.ts` — Service implementation (no changes needed)
- Database schema must include `task_versions` table for runtime test execution
