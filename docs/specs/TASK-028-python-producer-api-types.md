# TASK-028: Fix python-producer-api.test.ts Unknown Type Errors

## Overview

The `tests/integration/observability/python-producer-api.test.ts` file has multiple TS2571 errors at lines 315, 342, 343, 378, and 394 where API response objects are typed as 'unknown'. This occurs because query results are cast to `any[]`, and when accessing array elements and their properties under strict type checking, TypeScript cannot infer proper types.

This specification defines the solution: create proper TypeScript interfaces for Python-produced observability data structures and replace `any[]` type assertions with properly typed interfaces.

## Problem Analysis

### Current Implementation Issues

1. **Overly Broad Type Assertions**: All database query results use `as any[]` casting:
   ```typescript
   const result = await query("SELECT * FROM message_bus_log WHERE id = ?", [
     pythonProducedLog.id,
   ]) as any[];
   ```

2. **Loss of Type Safety**: Accessing `result[0]` returns `any`, and accessing properties on `any` can result in `unknown` types under certain TypeScript configurations.

3. **No Reusable Type Definitions**: Each test manually defines the structure of Python-produced data without shared type definitions.

4. **Potential Runtime Errors**: Without proper typing, typos in property names (e.g., `result[0].event_tipe` instead of `result[0].event_type`) won't be caught at compile time.

### Affected Lines

- **Line 315**: `const toolCalls = JSON.parse(result[0].tool_calls);`
- **Line 342**: `expect(result[0].status).toBe("active");`
- **Line 343**: `expect(result[0].current_task_id).toBe("task-001");`
- **Line 378**: `expect(toolUseResult[0].transcript_entry_id).toBe(transcriptEntryId);`
- **Line 394**: `expect(result[0].execution_run_id).toBe(executionId);`

All of these access properties on `result[0]` where `result` is typed as `any[]`, causing TypeScript to infer property access as `unknown` under strict type checking.

## Requirements

### FR-1: Type Definitions for Observability Tables
Create TypeScript interfaces for all Python-produced observability data structures tested in the file:

1. `MessageBusLogRecord` - Message bus event logs
2. `TranscriptEntryRecord` - Agent transcript entries
3. `ToolUseRecord` - Tool usage records
4. `AssertionResultRecord` - Test assertion results
5. `SkillTraceRecord` - Skill execution traces
6. `BuildAgentInstanceRecord` - Agent instance metadata
7. `ParallelExecutionWaveRecord` - Wave execution metadata

### FR-2: Replace Type Assertions
Replace all `as any[]` type assertions with properly typed interfaces:

```typescript
// Before
const result = await query("SELECT * FROM message_bus_log WHERE id = ?", [
  pythonProducedLog.id,
]) as any[];

// After
const result = await query("SELECT * FROM message_bus_log WHERE id = ?", [
  pythonProducedLog.id,
]) as MessageBusLogRecord[];
```

### FR-3: Type-Safe Property Access
Ensure all property accesses are type-safe and compile without TS2571 errors:

```typescript
// This should compile without errors
expect(result[0].event_type).toBe("task.started");
const payload = JSON.parse(result[0].payload);
```

### NFR-1: Backward Compatibility
- Tests must continue to pass with identical behavior
- No changes to test logic or assertions
- Only type annotations should change

### NFR-2: Maintainability
- Type definitions should be in a separate file for reusability
- Type definitions should match actual database schema
- Use consistent naming conventions with database column names

### NFR-3: Documentation
- Add JSDoc comments to type interfaces describing their purpose
- Document which Python script produces each data structure
- Include field descriptions for non-obvious properties

## Technical Design

### 1. Type Definitions Location

Create a new file: `tests/integration/observability/types.ts`

This file will contain all observability record type definitions used by the integration tests.

### 2. Interface Definitions

#### MessageBusLogRecord
```typescript
/**
 * Message Bus Log Record
 * Produced by Python observability producers for event logging
 */
export interface MessageBusLogRecord {
  id: string;
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
  correlation_id: string | null;
  human_summary: string;
  severity: string;
  category: string;
  transcript_entry_id: string;
  task_id: string;
  execution_id: string;
  payload: string; // JSON string
  created_at: string;
}
```

#### TranscriptEntryRecord
```typescript
/**
 * Transcript Entry Record
 * Produced by Python agents for execution transcripts
 */
export interface TranscriptEntryRecord {
  id: string;
  timestamp: string;
  sequence: number;
  source: string;
  execution_id: string;
  task_id: string;
  instance_id: string;
  wave_id: string;
  wave_number: number;
  entry_type: string;
  category: string;
  summary: string;
  details: string; // JSON string
  duration_ms: number;
  token_estimate: number;
}
```

#### ToolUseRecord
```typescript
/**
 * Tool Use Record
 * Produced by Python agents for tool usage tracking
 */
export interface ToolUseRecord {
  id: string;
  transcript_entry_id: string;
  tool: string;
  input_summary: string;
  output_summary: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  is_error: number; // SQLite boolean (0 or 1)
  is_blocked: number; // SQLite boolean (0 or 1)
  error_message: string | null;
  blocked_reason: string | null;
  task_id: string;
  execution_id: string;
  within_skill: string | null;
}
```

#### AssertionResultRecord
```typescript
/**
 * Assertion Result Record
 * Produced by Python QA agents for test assertions
 */
export interface AssertionResultRecord {
  id: string;
  description: string;
  category: string;
  result: string; // 'pass' | 'fail'
  timestamp: string;
  task_id: string;
  execution_id: string;
  chain_id: string;
  evidence: string; // JSON string
}
```

#### SkillTraceRecord
```typescript
/**
 * Skill Trace Record
 * Produced by Python agents for skill execution tracking
 */
export interface SkillTraceRecord {
  id: string;
  skill_name: string;
  skill_file: string;
  line_number: number;
  section_title: string;
  status: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  token_estimate: number;
  tool_calls: string; // JSON string array
  execution_id: string;
  task_id: string;
}
```

#### BuildAgentInstanceRecord
```typescript
/**
 * Build Agent Instance Record
 * Produced by Python orchestrator for agent lifecycle tracking
 */
export interface BuildAgentInstanceRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  current_task_id: string;
  wave_id: string;
  spawned_at: string;
  last_heartbeat: string;
  terminated_at: string | null;
  claude_session_id: string;
}
```

#### ParallelExecutionWaveRecord
```typescript
/**
 * Parallel Execution Wave Record
 * Produced by Python orchestrator for wave execution tracking
 */
export interface ParallelExecutionWaveRecord {
  id: string;
  execution_run_id: string;
  wave_number: number;
}
```

### 3. Implementation Changes

#### Step 1: Create Type Definitions File
Create `tests/integration/observability/types.ts` with all interface definitions listed above.

#### Step 2: Update Test Imports
Add import statement to `python-producer-api.test.ts`:

```typescript
import {
  MessageBusLogRecord,
  TranscriptEntryRecord,
  ToolUseRecord,
  AssertionResultRecord,
  SkillTraceRecord,
  BuildAgentInstanceRecord,
  ParallelExecutionWaveRecord,
} from "./types";
```

#### Step 3: Replace Type Assertions
Update all occurrences of `as any[]` to use appropriate typed interfaces:

**Line 49-51** (Message Bus Log Format test):
```typescript
const result = await query("SELECT * FROM message_bus_log WHERE id = ?", [
  pythonProducedLog.id,
]) as MessageBusLogRecord[];
```

**Line 73** (Python timestamp format test):
```typescript
const result = await query("SELECT * FROM message_bus_log LIMIT 1") as MessageBusLogRecord[];
```

**Line 109-112** (Transcript Entry Format test):
```typescript
const result = await query(
  "SELECT * FROM transcript_entries WHERE id = ?",
  [pythonTranscriptEntry.id],
) as TranscriptEntryRecord[];
```

**Line 139** (Wave event entries test):
```typescript
const result = await query("SELECT * FROM transcript_entries LIMIT 1") as TranscriptEntryRecord[];
```

**Line 170-172** (Tool Use Format test):
```typescript
const result = await query("SELECT * FROM tool_uses WHERE id = ?", [
  pythonToolUse.id,
]) as ToolUseRecord[];
```

**Line 191** (Tool errors test):
```typescript
const result = await query("SELECT * FROM tool_uses WHERE is_error = 1") as ToolUseRecord[];
```

**Line 211-213** (Blocked tools test):
```typescript
const result = await query(
  "SELECT * FROM tool_uses WHERE is_blocked = 1",
) as ToolUseRecord[];
```

**Line 242-245** (Assertion Result Format test):
```typescript
const result = await query(
  "SELECT * FROM assertion_results WHERE id = ?",
  [pythonAssertion.id],
) as AssertionResultRecord[];
```

**Line 274-276** (Failed assertions test):
```typescript
const result = await query(
  "SELECT * FROM assertion_results WHERE result = 'fail'",
) as AssertionResultRecord[];
```

**Line 306-308** (Skill Trace Format test):
```typescript
const result = await query("SELECT * FROM skill_traces WHERE id = ?", [
  pythonSkillTrace.id,
]) as SkillTraceRecord[];
```

**Line 337-340** (Build Agent Instance Format test):
```typescript
const result = await query(
  "SELECT * FROM build_agent_instances WHERE id = ?",
  [pythonAgent.id],
) as BuildAgentInstanceRecord[];
```

**Line 369-372** (Cross-source transcript entries test):
```typescript
const transcriptResult = await query(
  "SELECT * FROM transcript_entries WHERE id = ?",
  [transcriptEntryId],
) as TranscriptEntryRecord[];
```

**Line 373-376** (Cross-source tool uses test):
```typescript
const toolUseResult = await query(
  "SELECT * FROM tool_uses WHERE transcript_entry_id = ?",
  [transcriptEntryId],
) as ToolUseRecord[];
```

**Line 389-392** (Links execution runs test):
```typescript
const result = await query(
  "SELECT * FROM parallel_execution_waves WHERE execution_run_id = ?",
  [executionId],
) as ParallelExecutionWaveRecord[];
```

### 4. TypeScript Compilation Verification

After implementing changes, verify TypeScript compilation:

```bash
npx tsc --noEmit
```

Should produce **zero TS2571 errors** for `python-producer-api.test.ts`.

## Pass Criteria

### PC1: TypeScript Compilation
**Description**: TypeScript compiles without TS2571 errors
**Verification**:
```bash
npx tsc --noEmit 2>&1 | grep -c "TS2571.*python-producer-api.test.ts"
# Expected output: 0
```
**Status**: ❌ Not Started

### PC2: Type Definitions Created
**Description**: `types.ts` file exists with all required interfaces
**Verification**:
```bash
test -f tests/integration/observability/types.ts && \
grep -q "export interface MessageBusLogRecord" tests/integration/observability/types.ts && \
grep -q "export interface ToolUseRecord" tests/integration/observability/types.ts && \
grep -q "export interface BuildAgentInstanceRecord" tests/integration/observability/types.ts
# Expected exit code: 0
```
**Status**: ❌ Not Started

### PC3: Type Assertions Replaced
**Description**: No `as any[]` assertions remain in python-producer-api.test.ts
**Verification**:
```bash
grep -c "as any\[\]" tests/integration/observability/python-producer-api.test.ts
# Expected output: 0
```
**Status**: ❌ Not Started

### PC4: Tests Pass
**Description**: All tests in the file pass successfully
**Verification**:
```bash
# Note: Integration tests are excluded by default in vitest.config.ts
# This is intentional as they require database setup
# Verify the file has no runtime errors by checking imports compile:
npx tsc --noEmit tests/integration/observability/python-producer-api.test.ts
# Expected exit code: 0
```
**Status**: ❌ Not Started

### PC5: No Regressions
**Description**: Full test suite continues to pass
**Verification**:
```bash
npm test
# Expected: All tests pass (same count as before changes)
```
**Status**: ❌ Not Started

## Dependencies

### Internal Dependencies
- `tests/integration/observability/python-producer-api.test.ts` (file to be modified)
- `database/db.js` (mocked query function)

### External Dependencies
- TypeScript 5.x
- Vitest testing framework

### Blockers
None

## Implementation Notes

### Why Not Use Drizzle/Zod Schema?
The main codebase uses Drizzle ORM with Zod schemas in `schema/entities/`. However:

1. These tests are for the **parent-harness** orchestrator database, not the main Idea Incubator database
2. The parent-harness uses raw SQL migrations (`parent-harness/orchestrator/database/migrations/001_vibe_patterns.sql`)
3. The test file mocks the database layer, so it doesn't need full Drizzle integration
4. Creating lightweight interfaces is more appropriate for mock-based testing

### Alternative: Generate Types from SQL Schema
For future iterations, consider using tools like `sql-ts` or `kysely-codegen` to auto-generate TypeScript interfaces from the SQL migration files. This would ensure types stay in sync with database schema changes.

### Testing Strategy
Since integration tests are excluded by default (they require database setup), the primary verification is:
1. TypeScript compilation succeeds
2. No type errors in the file
3. Full test suite continues to pass (unit tests only)

## Related Tasks
- None

## References
- TypeScript Documentation: [Object is of type 'unknown' (TS2571)](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- Test file: `tests/integration/observability/python-producer-api.test.ts`
- Database schema: `parent-harness/orchestrator/database/migrations/001_vibe_patterns.sql`
