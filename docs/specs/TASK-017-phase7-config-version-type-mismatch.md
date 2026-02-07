# TASK-017: Fix Phase7 Config Version Type Mismatch

## Status: RESOLVED (No Changes Needed)

## Overview

**What:** The phase7 config test file (`tests/unit/config/phase7-config.test.ts`) was reported to use `"v1"` for version fields instead of the expected `"v2"`, allegedly causing 5 type errors.

**Why:** The config system defaults to `evaluatorMode: "v2"` (parallel specialists). If tests used `"v1"` as the default expectation, they would fail against the current schema and default configuration.

## Investigation

### Current State

The test file already correctly uses `"v2"` as the expected default:

- **Line 24:** `expect(config.evaluatorMode).toBe("v2")` — asserts default is v2
- **Line 68:** `expect(getConfig().evaluatorMode).toBe("v2")` — asserts reset returns to v2
- **Line 37:** `expect(getConfig().evaluatorMode).toBe("v2")` — asserts switching back to v2 works

The test file properly tests switching to `"v1"` using `as const` assertions:

- **Line 28:** `updateConfig({ evaluatorMode: "v1" as const })` — tests v1 switch
- **Line 34:** `updateConfig({ evaluatorMode: "v1" as const })` — tests v1 in persistence
- **Line 84:** `updateConfig({ evaluatorMode: "v1" as const })` — tests combined mode update

### Config Schema (config/default.ts)

```typescript
evaluatorMode: "v2" as "v1" | "v2",
```

The type is `"v1" | "v2"` and the default value is `"v2"`. The test file matches this schema correctly.

### Compilation & Test Results

- **TypeScript compilation:** No errors related to this file
- **Test execution:** All 12 tests pass (vitest v1.6.1)
- **No uncommitted changes:** File matches the committed version

## Requirements

N/A — No changes required.

## Technical Design

N/A — The existing implementation is correct.

## Pass Criteria

1. **All version fields in phase7-config.test.ts use "v2" as default** — VERIFIED: Lines 24, 37, 68 expect `"v2"` as default
2. **tests/unit/config/phase7-config.test.ts compiles without errors** — VERIFIED: TypeScript compilation succeeds
3. **Test assertions still validate correct behavior** — VERIFIED: All 12 tests pass

## Dependencies

- `config/default.ts` — Defines the `Config` type with `evaluatorMode: "v1" | "v2"`
- `config/index.ts` — Exports `getConfig()`, `updateConfig()`, `resetConfig()`, `defaultConfig`

## Open Questions

None. This task is a duplicate of TASK-006 (config-version-mismatch), which was also resolved without code changes. See `docs/specs/TASK-006-config-version-mismatch.md`.

## Resolution

This task was already resolved prior to investigation. The test file correctly:
- Defaults to `"v2"` (matching `config/default.ts`)
- Tests switching to `"v1"` as an alternate mode
- Uses `as const` assertions for type safety when passing literal string values
- Validates reset behavior returns to `"v2"`

No code changes were made.
