-- =============================================================================
-- Migration: 091_phase4_test_appendices.sql
-- Purpose: Add test_commands and acceptance_criteria appendices for Phase 4 tasks
-- Created: 2026-01-17
-- Reference: tests/e2e/obs-phase4-types.test.ts
-- =============================================================================

-- =============================================================================
-- OBS-200: Core Transcript Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-200-test', 'obs-200', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-200
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-200"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/transcript.ts

# Verify file exists
test -f frontend/src/types/observability/transcript.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-200-criteria', 'obs-200', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/transcript.ts` exists
- [ ] **AC2**: `TranscriptEntryType` enum/type has exactly 15 values:
  - phase_start, phase_end, task_start, task_end, tool_use
  - skill_invoke, assertion, discovery, error, decision
  - checkpoint, rollback, lock_acquire, lock_release, validation
- [ ] **AC3**: `EntryCategory` enum/type exists with values: lifecycle, coordination, failure, decision, system
- [ ] **AC4**: `TranscriptEntry` interface exists with fields:
  - id, timestamp, sequence, executionId, taskId, instanceId
  - waveNumber, entryType, category, summary, details
  - skillRef, toolCalls, assertions, durationMs, tokenEstimate, createdAt
- [ ] **AC5**: `PaginatedResponse<T>` generic exists with: data: T[], total, limit, offset, hasMore
- [ ] **AC6**: TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] **AC7**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-201: Tool Use Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-201-test', 'obs-201', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-201
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-201"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/tool-use.ts

# Verify file exists
test -f frontend/src/types/observability/tool-use.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-201-criteria', 'obs-201', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/tool-use.ts` exists
- [ ] **AC2**: `ToolCategory` enum/type has exactly 8 values:
  - file_read, file_write, file_edit, shell, search, web, mcp, agent
- [ ] **AC3**: `ToolResultStatus` enum/type exists with: done, error, blocked
- [ ] **AC4**: `ToolUse` interface exists with all database fields:
  - id, executionId, taskId, transcriptEntryId, tool, toolCategory
  - input, inputSummary, resultStatus, output, outputSummary
  - isError, isBlocked, errorMessage, blockReason
  - startTime, endTime, durationMs, withinSkill, parentToolUseId, createdAt
- [ ] **AC5**: `ToolName` type exists with all Claude Code tools
- [ ] **AC6**: TypeScript compiles without errors
- [ ] **AC7**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-202: Tool Input/Output Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-202-test', 'obs-202', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-202
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-202"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/tool-io.ts

# Verify file exists
test -f frontend/src/types/observability/tool-io.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-202-criteria', 'obs-202', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/tool-io.ts` exists
- [ ] **AC2**: Input interfaces exist: ReadInput, WriteInput, EditInput, BashInput
- [ ] **AC3**: ReadInput has: file_path, offset?, limit?
- [ ] **AC4**: WriteInput has: file_path, content
- [ ] **AC5**: EditInput has: file_path, old_string, new_string, replace_all?
- [ ] **AC6**: BashInput has: command, description?, timeout?, run_in_background?
- [ ] **AC7**: `ToolInputUnion` discriminated union exists (combines all inputs)
- [ ] **AC8**: `ToolOutputUnion` discriminated union exists (ReadOutput, BashOutput, etc.)
- [ ] **AC9**: TypeScript compiles without errors
- [ ] **AC10**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-203: Skill Trace Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-203-test', 'obs-203', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-203
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-203"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/skill.ts

# Verify file exists
test -f frontend/src/types/observability/skill.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-203-criteria', 'obs-203', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/skill.ts` exists
- [ ] **AC2**: `SkillReference` interface exists with: skillName, skillFile, lineNumber?, sectionTitle?
- [ ] **AC3**: `SkillTrace` interface exists with:
  - id, executionId, taskId, skillName, skillFile, lineNumber, sectionTitle
  - inputSummary, outputSummary, startTime, endTime, durationMs, tokenEstimate
  - status, errorMessage, toolCalls (nested), subSkills (nested), createdAt
- [ ] **AC4**: `SkillStatus` enum exists with: success, partial, failed
- [ ] **AC5**: `SkillsUsageSummary` interface exists for aggregated stats
- [ ] **AC6**: TypeScript compiles without errors
- [ ] **AC7**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-204: Assertion Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-204-test', 'obs-204', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-204
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-204"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/assertion.ts

# Verify file exists
test -f frontend/src/types/observability/assertion.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-204-criteria', 'obs-204', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/assertion.ts` exists
- [ ] **AC2**: `AssertionCategory` enum/type has exactly 9 values:
  - file_created, file_modified, file_deleted
  - tsc_compiles, test_passes, lint_passes, build_succeeds
  - runtime_check, custom
- [ ] **AC3**: `AssertionResult` type exists with: pass, fail, skip, warn
- [ ] **AC4**: `AssertionResultEntry` interface exists (individual assertion)
- [ ] **AC5**: `AssertionChain` interface exists with:
  - id, taskId, executionId, description, overallResult
  - passCount, failCount, skipCount, firstFailureId, startedAt, completedAt, createdAt
- [ ] **AC6**: `AssertionEvidence` interface exists with:
  - command?, exitCode?, stdout?, stderr?, filePath?, expected?, actual?, diff?
- [ ] **AC7**: TypeScript compiles without errors
- [ ] **AC8**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-205: Message Bus Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-205-test', 'obs-205', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-205
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-205"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/message-bus.ts

# Verify file exists
test -f frontend/src/types/observability/message-bus.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-205-criteria', 'obs-205', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/message-bus.ts` exists
- [ ] **AC2**: `MessageBusSeverity` enum/type exists with: info, warning, error, critical
- [ ] **AC3**: `MessageBusCategory` enum/type exists with: lifecycle, coordination, failure, decision
- [ ] **AC4**: `MessageBusLogEntry` interface exists with:
  - id, eventId, timestamp, source, eventType, correlationId
  - humanSummary, severity, category, transcriptEntryId
  - taskId, executionId, payload, createdAt
- [ ] **AC5**: `MessageBusQuery` interface exists for filtering
- [ ] **AC6**: `correlationId` field present for related events tracking
- [ ] **AC7**: TypeScript compiles without errors
- [ ] **AC8**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-206: WebSocket Event Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-206-test', 'obs-206', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-206
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-206"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/websocket.ts

# Verify file exists
test -f frontend/src/types/observability/websocket.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-206-criteria', 'obs-206', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/websocket.ts` exists
- [ ] **AC2**: `ObservabilityEventType` enum/type exists with events:
  - transcript:entry, tooluse:start, tooluse:end, tooluse:output
  - assertion:result, skill:start, skill:end, messagebus:event
- [ ] **AC3**: Base `ObservabilityEvent` interface exists with: type, timestamp, executionId?, taskId?
- [ ] **AC4**: Specific event interfaces exist: TranscriptEvent, ToolUseEvent, AssertionEvent
- [ ] **AC5**: Events carry typed payloads matching their entity types
- [ ] **AC6**: TypeScript compiles without errors
- [ ] **AC7**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-207: API Request/Response Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-207-test', 'obs-207', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-207
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-207"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/api.ts

# Verify file exists
test -f frontend/src/types/observability/api.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-207-criteria', 'obs-207', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/api.ts` exists
- [ ] **AC2**: `ExecutionResponse` interface exists with execution data and stats
- [ ] **AC3**: Query interfaces exist: TranscriptQuery, ToolUseQuery, AssertionQuery
- [ ] **AC4**: `ToolUsageSummaryResponse` interface exists with aggregated tool stats
- [ ] **AC5**: `AssertionSummaryResponse` interface exists with pass rates
- [ ] **AC6**: `ErrorResponse` interface exists with: success: false, error, code?
- [ ] **AC7**: All query interfaces support pagination (limit, offset)
- [ ] **AC8**: TypeScript compiles without errors
- [ ] **AC9**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-208: Cross-Reference Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-208-test', 'obs-208', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-208
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-208"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/cross-refs.ts

# Verify file exists
test -f frontend/src/types/observability/cross-refs.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-208-criteria', 'obs-208', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/cross-refs.ts` exists
- [ ] **AC2**: `CrossRefEntityType` enum/type exists with:
  - execution, task, transcript, tool_use, skill_trace, assertion, assertion_chain, message_bus
- [ ] **AC3**: `ToolUseCrossRefs` interface exists with refs to: transcriptEntry, skill?, parentToolUse?, childToolUses?
- [ ] **AC4**: `AssertionCrossRefs` interface exists with refs to: transcriptEntry?, chain?, task
- [ ] **AC5**: `SkillTraceCrossRefs` interface exists with refs to: toolCalls[], subSkills[], parentSkill?
- [ ] **AC6**: `EntityCrossRefs` discriminated union exists (combines all cross-ref types)
- [ ] **AC7**: TypeScript compiles without errors
- [ ] **AC8**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-209: UI Component Prop Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-209-test', 'obs-209', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-209
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-209"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/ui-props.ts

# Verify file exists
test -f frontend/src/types/observability/ui-props.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-209-criteria', 'obs-209', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/ui-props.ts` exists
- [ ] **AC2**: `ExecutionListProps` interface exists
- [ ] **AC3**: `TranscriptViewerProps` interface exists
- [ ] **AC4**: `ToolUseCardProps` interface exists with: toolUse, onClick?, expanded?
- [ ] **AC5**: `AssertionCardProps` interface exists with: assertion, showEvidence?
- [ ] **AC6**: `SkillTraceCardProps` interface exists with: skillTrace, depth?
- [ ] **AC7**: `MessageBusLogProps` interface exists with: entries, filters?
- [ ] **AC8**: `FilterPanelProps` interface exists with: filters, onFilterChange
- [ ] **AC9**: TypeScript compiles without errors
- [ ] **AC10**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-210: React Hook Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-210-test', 'obs-210', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-210
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-210"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/hooks.ts

# Verify file exists
test -f frontend/src/types/observability/hooks.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-210-criteria', 'obs-210', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/hooks.ts` exists
- [ ] **AC2**: `UseExecutionListResult` interface exists
- [ ] **AC3**: `UseExecutionResult` interface exists
- [ ] **AC4**: `UseTranscriptResult` interface exists
- [ ] **AC5**: `UseToolUsesResult` interface exists
- [ ] **AC6**: `UseAssertionsResult` interface exists
- [ ] **AC7**: `UseObservabilityStreamResult` interface exists (for WebSocket)
- [ ] **AC8**: `UseFiltersResult` interface exists
- [ ] **AC9**: All hook results follow pattern: { loading, error, data, refetch? }
- [ ] **AC10**: TypeScript compiles without errors
- [ ] **AC11**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-211: Security Types
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-211-test', 'obs-211', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-211
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-211"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/security.ts

# Verify file exists
test -f frontend/src/types/observability/security.ts && echo "PASS" || echo "FAIL"
```',
     datetime('now')),

    ('app-211-criteria', 'obs-211', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/security.ts` exists
- [ ] **AC2**: `BlockedCommand` interface exists with:
  - command, reason, suggestion?, blockedAt, toolUseId?
- [ ] **AC3**: `SecurityValidation` interface exists with:
  - isBlocked, reason?, matchedPattern?, severity?
- [ ] **AC4**: `DangerousPattern` enum/type exists with categories:
  - destructive, privilege_escalation, network, sensitive_data, system_modification
- [ ] **AC5**: TypeScript compiles without errors
- [ ] **AC6**: All types are exported',
     datetime('now'));

-- =============================================================================
-- OBS-212: Index Export File
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-212-test', 'obs-212', 'test_context', 'Test Commands',
     '## Test Commands

```bash
# Run specific test suite for OBS-212
npx vitest run tests/e2e/obs-phase4-types.test.ts -t "OBS-212"

# Run TypeScript compilation check
npx tsc --noEmit frontend/src/types/observability/index.ts

# Verify file exists
test -f frontend/src/types/observability/index.ts && echo "PASS" || echo "FAIL"

# Check all exports compile together
npx tsc --noEmit frontend/src/types/observability/*.ts
```',
     datetime('now')),

    ('app-212-criteria', 'obs-212', 'acceptance_criteria', 'Acceptance Criteria',
     '## Acceptance Criteria

- [ ] **AC1**: File `frontend/src/types/observability/index.ts` exists
- [ ] **AC2**: Uses `export * from` syntax for all type files
- [ ] **AC3**: Exports from all 12 type files:
  - transcript, tool-use, tool-io, skill, assertion
  - message-bus, websocket, api, cross-refs
  - ui-props, hooks, security
- [ ] **AC4**: Exports are in alphabetical order
- [ ] **AC5**: No circular dependencies (index.ts does not import from itself)
- [ ] **AC6**: No file imports from index.ts (would create circular deps)
- [ ] **AC7**: TypeScript compiles without errors
- [ ] **AC8**: Named exports work correctly: `import { TranscriptEntry } from "./types/observability"`',
     datetime('now'));

-- =============================================================================
-- Master Test Command for All Phase 4 Tasks
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, title, content, created_at)
VALUES
    ('app-phase4-master', 'obs-200', 'code_context', 'Phase 4 Master Test',
     '## Run All Phase 4 Tests

```bash
# Run entire Phase 4 test suite
npx vitest run tests/e2e/obs-phase4-types.test.ts

# Run with verbose output
npx vitest run tests/e2e/obs-phase4-types.test.ts --reporter=verbose

# Run TypeScript compilation check on all files
npx tsc --noEmit frontend/src/types/observability/*.ts

# Check for circular dependencies
npx madge --circular frontend/src/types/observability/index.ts
```

## Expected Test Count

Total tests: ~100
- File existence: 13 tests
- OBS-200 (Transcript): 7 tests
- OBS-201 (Tool Use): 6 tests
- OBS-202 (Tool I/O): 6 tests
- OBS-203 (Skill): 5 tests
- OBS-204 (Assertion): 6 tests
- OBS-205 (Message Bus): 6 tests
- OBS-206 (WebSocket): 5 tests
- OBS-207 (API): 7 tests
- OBS-208 (Cross-Refs): 5 tests
- OBS-209 (UI Props): 7 tests
- OBS-210 (Hooks): 8 tests
- OBS-211 (Security): 4 tests
- OBS-212 (Index): 13 tests
- Compilation: 2 tests
- Type compatibility: 6 tests
- Schema alignment: 4 tests',
     datetime('now'));
