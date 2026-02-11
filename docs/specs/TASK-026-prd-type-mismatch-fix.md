# TASK-026: Fix PRD Service Type Mismatches in Tests

**Status:** ✅ ALREADY RESOLVED (Fixed in commit a2128cb)
**Task Type:** Bug Fix
**Component:** Test Suite
**Files Modified:** `tests/task-agent/prd-service.test.ts`

---

## Overview

This specification documents the resolution of TypeScript type mismatches in the PRD (Product Requirements Document) service test suite. The issue involved incorrect property names being used in test cases that didn't match the actual `CreatePrdInput` type definition.

## Problem Statement

### Original Issue

The test file `tests/task-agent/prd-service.test.ts` contained TS2353 errors where test cases were passing properties that didn't exist in the `CreatePrdInput` type interface:

1. **Invalid property: `description`** - Tests used `description` field, but the actual type defines `problemStatement`
2. **Invalid property: `status`** - Tests passed `status` during creation, but status is auto-set to "draft" and not part of CreatePrdInput
3. **Invalid property: `parentId`** - Tests used `parentId`, but the actual property name is `parentPrdId`

### Root Cause

The tests were written based on an outdated or incorrect understanding of the PRD type interface. The actual implementation (defined in `types/prd.ts`) uses different field names than what the tests expected.

## Technical Analysis

### Type Definitions (from `types/prd.ts`)

```typescript
export interface CreatePrdInput {
  title: string;
  slug?: string; // Auto-generated if not provided
  projectId?: string;
  parentPrdId?: string; // ✅ Correct: parentPrdId (not parentId)
  problemStatement?: string; // ✅ Correct: problemStatement (not description)
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
  businessContext?: string[];
  // ❌ status is NOT part of CreatePrdInput - auto-set to "draft"
}
```

### Service Implementation (from `server/services/prd-service.ts`)

The `prdService.create()` method:

- Takes `CreatePrdInput` as first parameter
- Takes `userId: string` as second parameter (required)
- Auto-generates `slug` if not provided
- Always sets initial `status` to "draft" (line 67)
- Maps input fields correctly to database columns

```typescript
async create(input: CreatePrdInput, userId: string): Promise<PRD> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const slug = input.slug || (await this.generateSlug(input.title, input.projectId));

  await run(
    `INSERT INTO prds (..., status, ...) VALUES (?, ..., ?, ...)`,
    [..., "draft", ...]  // Status is always "draft" on creation
  );
  // ...
}
```

## Solution Implemented

The fix (commit a2128cb) corrected all type mismatches:

### 1. Added Helper Function

Created `createTestPRD()` helper to centralize the userId parameter:

```typescript
const TEST_USER_ID = "test-user-prd-service";

async function createTestPRD(input: Parameters<typeof prdService.create>[0]) {
  return prdService.create(input, TEST_USER_ID);
}
```

### 2. Fixed Property Names

Replaced all incorrect property names with correct ones:

| Incorrect             | Correct            | Occurrences  |
| --------------------- | ------------------ | ------------ |
| `description`         | `problemStatement` | 3 instances  |
| `parentId`            | `parentPrdId`      | 4 instances  |
| ~~`status: "draft"`~~ | (removed)          | 12 instances |

### 3. Fixed Method Names

Updated service method calls to match actual API:

| Incorrect             | Correct                        |
| --------------------- | ------------------------------ |
| `getAll()`            | `list()`                       |
| `getByStatus(status)` | `list({ status })`             |
| `archive(id)`         | `updateStatus(id, "archived")` |

### 4. Example Fix - Create Test

**Before:**

```typescript
const prd = await prdService.create({
  title: `${TEST_PREFIX}Test PRD`,
  description: "A test PRD description", // ❌ Wrong field name
  status: "draft", // ❌ Not in CreatePrdInput
});
```

**After:**

```typescript
const prd = await createTestPRD({
  title: `${TEST_PREFIX}Test PRD`,
  problemStatement: "A test PRD problem statement", // ✅ Correct field name
  // status removed - auto-set by service
});
```

## Pass Criteria

### ✅ 1. CreatePrdInput type matches actual PRD service implementation

**Status:** VERIFIED

- Type definition in `types/prd.ts` is correct
- Service implementation in `server/services/prd-service.ts` uses the correct type
- No discrepancies between type and implementation

### ✅ 2. Test updated to use correct property names

**Status:** VERIFIED

- All tests now use `problemStatement` instead of `description`
- All tests now use `parentPrdId` instead of `parentId`
- All tests removed invalid `status` from create calls
- Helper function `createTestPRD()` centralizes userId handling

### ✅ 3. TypeScript compilation passes for prd-service.test.ts

**Status:** VERIFIED

```bash
$ npx tsc --noEmit tests/task-agent/prd-service.test.ts
# No TS2353 errors related to PRD types
# Only unrelated Vite dependency error (TS2307)
```

### ✅ 4. PRD service tests pass successfully

**Status:** VERIFIED

```bash
$ npm test tests/task-agent/prd-service.test.ts
✓ tests/task-agent/prd-service.test.ts  (12 tests) 221ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

All 12 test cases passing:

1. ✅ create - should create a new PRD
2. ✅ create - should create a child PRD with parent reference
3. ✅ getById - should return a PRD by ID
4. ✅ getById - should return null for non-existent ID
5. ✅ list - should return all PRDs
6. ✅ list - should filter by status
7. ✅ update - should update PRD fields
8. ✅ approve - should approve a PRD
9. ✅ approve - should throw when approving non-existent PRD
10. ✅ updateStatus - should update PRD status
11. ✅ getChildren - should return child PRDs
12. ✅ delete - should delete a PRD

## Dependencies

### Type System

- `types/prd.ts` - PRD type definitions (no changes needed)
- `server/services/prd-service.ts` - Service implementation (no changes needed)

### Database Schema

- Migration `080_create_prds.sql` defines the database schema
- Column names: `problem_statement`, `parent_prd_id` (snake_case in DB, camelCase in types)

### Related Tests

This fix ensures consistency across the PRD testing ecosystem:

- All PRD-related tests now use correct property names
- Test patterns can be replicated for future PRD tests
- Helper function `createTestPRD()` provides reusable pattern

## Implementation Details

### Commit Information

- **Commit:** a2128cbee4732cfe7b04c57a28b105a89e1202ea
- **Date:** 2026-02-05 21:49:17 +1100
- **Message:** "fix: prd-service tests (12/12)"
- **Files Changed:** 1 file, 36 insertions(+), 45 deletions(-)

### Testing Approach

The fix was verified through:

1. TypeScript compilation (no TS2353 errors)
2. Full test suite execution (12/12 passing)
3. Individual test inspection (correct field names used)
4. Type checking (tests now type-safe with CreatePrdInput)

## Lessons Learned

### Best Practices

1. **Always reference type definitions** - Check `types/*.ts` files before writing tests
2. **Use type inference** - Helper like `Parameters<typeof service.method>[0]` ensures type safety
3. **Centralize common patterns** - Helper functions reduce duplication and enforce consistency
4. **Validate against implementation** - Compare tests to actual service code, not assumptions

### Type Safety Improvements

The fix demonstrates the value of TypeScript's type system:

- TS2353 errors caught the interface mismatches at compile time
- Type-safe helper function prevents future mistakes
- IDE autocomplete now works correctly with proper types

### Documentation

This specification serves as:

- Historical record of the issue and resolution
- Reference for PRD service testing patterns
- Guide for similar type mismatch issues in other services

## Future Considerations

### Preventing Similar Issues

1. **Code review checklist** - Verify property names match type definitions
2. **Type testing** - Consider adding type-level tests for complex interfaces
3. **Documentation** - Keep examples in sync with actual types
4. **Linting rules** - Consider custom rules to catch common naming mistakes

### PRD Service Evolution

If the PRD interface needs to change in the future:

1. Update type definition in `types/prd.ts`
2. Update service implementation in `server/services/prd-service.ts`
3. Update database migration if schema changes
4. Update ALL tests to use new property names
5. Run full test suite to verify no breakage

## Verification Commands

```bash
# Verify TypeScript compilation
npx tsc --noEmit tests/task-agent/prd-service.test.ts

# Run PRD service tests
npm test tests/task-agent/prd-service.test.ts

# Check test file for correct property usage
grep -E "(problemStatement|parentPrdId)" tests/task-agent/prd-service.test.ts

# Verify no references to old property names
grep -E "(description:|parentId:)" tests/task-agent/prd-service.test.ts
# Should return no matches (except in comments)
```

## Conclusion

**Task Status:** ✅ COMPLETE

All pass criteria have been met. The PRD service test suite now correctly uses the `CreatePrdInput` type interface with proper property names (`problemStatement`, `parentPrdId`), invalid fields removed (`status`, `description`), and all 12 tests passing successfully.

The fix improves code quality through:

- Type safety (no more TS2353 errors)
- Consistency (tests match implementation)
- Maintainability (helper function reduces duplication)
- Documentation (this spec captures the resolution)

No further action required for TASK-026.
