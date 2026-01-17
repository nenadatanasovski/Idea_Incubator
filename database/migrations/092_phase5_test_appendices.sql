-- =============================================================================
-- Migration: 092_phase5_test_appendices.sql
-- Purpose: Add test_commands and acceptance_criteria appendices for Phase 5 tasks
-- Created: 2026-01-17
-- Reference: tests/e2e/test-obs-phase5-api.py
-- =============================================================================

-- Note: Using 'test_context' for test commands and 'acceptance_criteria' for AC
-- These are valid appendix_type values per migration 079

-- =============================================================================
-- OBS-300: Execution Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-300-test', 'obs-300', 'test_context', 'inline',
     '## Test Commands for OBS-300: Execution Service

```bash
# Run Phase 5 API tests (all)
python3 tests/e2e/test-obs-phase5-api.py

# Run specific OBS-300 tests via grep
python3 tests/e2e/test-obs-phase5-api.py 2>&1 | grep -A5 "OBS-300"

# Verify service file exists
test -f server/services/observability/execution-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/execution-service.ts

# Test API endpoints manually
curl -s http://localhost:3001/api/observability/executions | jq .success
curl -s http://localhost:3001/api/observability/executions/test-id | jq .success
```',
     0, datetime('now')),

    ('app-300-criteria', 'obs-300', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-300: Execution Service

- [ ] **AC1**: File `server/services/observability/execution-service.ts` exists
- [ ] **AC2**: `listExecutions()` returns paginated list with stats
- [ ] **AC3**: `getExecution()` returns single execution with correct shape
- [ ] **AC4**: Stats include `totalToolUses` (number)
- [ ] **AC5**: Stats include `totalAssertions` (number)
- [ ] **AC6**: Stats include `passRate` (number 0-1)
- [ ] **AC7**: Stats include `errorCount` (number)
- [ ] **AC8**: Stats include `durationMs` (number)
- [ ] **AC9**: Pagination works correctly (limit, offset, hasMore)
- [ ] **AC10**: Returns 404 for non-existent execution
- [ ] **AC11**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-301: Transcript Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-301-test', 'obs-301', 'test_context', 'inline',
     '## Test Commands for OBS-301: Transcript Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/transcript-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/transcript-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/transcript" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/transcript?entryType=tool_use" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/transcript?category=lifecycle" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/transcript?taskId=TASK_ID" | jq .success
```',
     0, datetime('now')),

    ('app-301-criteria', 'obs-301', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-301: Transcript Service

- [ ] **AC1**: File `server/services/observability/transcript-service.ts` exists
- [ ] **AC2**: `getTranscript()` returns paginated entries
- [ ] **AC3**: Supports cursor-based pagination (limit, offset, hasMore)
- [ ] **AC4**: Supports filtering by `entryTypes` (array of TranscriptEntryType)
- [ ] **AC5**: Supports filtering by `categories` (array of EntryCategory)
- [ ] **AC6**: Supports filtering by `taskId`
- [ ] **AC7**: Supports filtering by `since` (timestamp)
- [ ] **AC8**: Supports filtering by `until` (timestamp)
- [ ] **AC9**: `getEntry()` returns single entry
- [ ] **AC10**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-302: Tool Use Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-302-test', 'obs-302', 'test_context', 'inline',
     '## Test Commands for OBS-302: Tool Use Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/tool-use-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/tool-use-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/tool-uses" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/tool-uses?tool=Read" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/tool-uses?category=shell" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/tool-summary" | jq .success
```',
     0, datetime('now')),

    ('app-302-criteria', 'obs-302', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-302: Tool Use Service

- [ ] **AC1**: File `server/services/observability/tool-use-service.ts` exists
- [ ] **AC2**: `getToolUses()` returns paginated tool uses
- [ ] **AC3**: `getToolSummary()` returns aggregated stats by tool and category
- [ ] **AC4**: Supports filtering by `tools` (array of ToolName)
- [ ] **AC5**: Supports filtering by `categories` (array of ToolCategory)
- [ ] **AC6**: Supports filtering by `status` (done, error, blocked)
- [ ] **AC7**: Supports filtering by `taskId`
- [ ] **AC8**: Summary includes `byTool` breakdown
- [ ] **AC9**: Summary includes `byCategory` breakdown
- [ ] **AC10**: Summary includes `avgDurationMs`, `errorRate`, `blockRate`
- [ ] **AC11**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-303: Assertion Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-303-test', 'obs-303', 'test_context', 'inline',
     '## Test Commands for OBS-303: Assertion Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/assertion-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/assertion-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/assertions" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/assertions?result=pass" | jq .success
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/assertion-summary" | jq .success
```',
     0, datetime('now')),

    ('app-303-criteria', 'obs-303', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-303: Assertion Service

- [ ] **AC1**: File `server/services/observability/assertion-service.ts` exists
- [ ] **AC2**: `getAssertions()` returns paginated assertions
- [ ] **AC3**: `getAssertionSummary()` returns aggregated stats
- [ ] **AC4**: `getChains()` returns assertion chains
- [ ] **AC5**: Supports filtering by `categories` (array of AssertionCategory)
- [ ] **AC6**: Supports filtering by `result` (pass, fail, skip, warn)
- [ ] **AC7**: Supports filtering by `taskId`
- [ ] **AC8**: Summary includes `passRate`, `total`, `passed`, `failed`, `skipped`
- [ ] **AC9**: Summary includes `byCategory` breakdown
- [ ] **AC10**: Summary includes `chains` info (total, passed, failed, partial)
- [ ] **AC11**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-304: Skill Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-304-test', 'obs-304', 'test_context', 'inline',
     '## Test Commands for OBS-304: Skill Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/skill-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/skill-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/executions/EXEC_ID/skills" | jq .success
```',
     0, datetime('now')),

    ('app-304-criteria', 'obs-304', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-304: Skill Service

- [ ] **AC1**: File `server/services/observability/skill-service.ts` exists
- [ ] **AC2**: `getSkillTraces()` returns paginated skill traces
- [ ] **AC3**: `getSkillTrace()` returns single trace with nested tool calls
- [ ] **AC4**: `getSkillsSummary()` returns aggregated stats
- [ ] **AC5**: Skill traces include `toolCalls` array (nested tool use IDs)
- [ ] **AC6**: Skill traces include `subSkills` array (nested skill IDs)
- [ ] **AC7**: Summary includes skill usage counts
- [ ] **AC8**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-305: Cross-Reference Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-305-test', 'obs-305', 'test_context', 'inline',
     '## Test Commands for OBS-305: Cross-Reference Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/cross-reference-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/cross-reference-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/cross-refs/tool_use/TOOL_USE_ID" | jq .success
curl -s "http://localhost:3001/api/observability/cross-refs/assertion/ASSERTION_ID" | jq .success
curl -s "http://localhost:3001/api/observability/cross-refs/skill_trace/SKILL_ID" | jq .success
curl -s "http://localhost:3001/api/observability/cross-refs/transcript/TRANSCRIPT_ID" | jq .success
```',
     0, datetime('now')),

    ('app-305-criteria', 'obs-305', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-305: Cross-Reference Service

- [ ] **AC1**: File `server/services/observability/cross-reference-service.ts` exists
- [ ] **AC2**: `getCrossReferences()` works for `tool_use` entity type
- [ ] **AC3**: `getCrossReferences()` works for `assertion` entity type
- [ ] **AC4**: `getCrossReferences()` works for `skill_trace` entity type
- [ ] **AC5**: `getCrossReferences()` works for `transcript` entity type
- [ ] **AC6**: Returns related entities with type and id
- [ ] **AC7**: `getRelatedEntities()` returns fully loaded related entities
- [ ] **AC8**: Returns 400 for unknown entity type
- [ ] **AC9**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-306: Message Bus Service
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-306-test', 'obs-306', 'test_context', 'inline',
     '## Test Commands for OBS-306: Message Bus Service

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify service file exists
test -f server/services/observability/message-bus-service.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/services/observability/message-bus-service.ts

# Test API endpoints manually
curl -s "http://localhost:3001/api/observability/logs/message-bus" | jq .success
curl -s "http://localhost:3001/api/observability/logs/message-bus?severity=error" | jq .success
curl -s "http://localhost:3001/api/observability/logs/message-bus?category=lifecycle" | jq .success
curl -s "http://localhost:3001/api/observability/logs/message-bus?source=build-agent" | jq .success
```',
     0, datetime('now')),

    ('app-306-criteria', 'obs-306', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-306: Message Bus Service

- [ ] **AC1**: File `server/services/observability/message-bus-service.ts` exists
- [ ] **AC2**: `getLogs()` returns paginated message bus entries
- [ ] **AC3**: `getCorrelatedEvents()` returns all events with same correlationId
- [ ] **AC4**: Supports filtering by `eventTypes` (array of event type strings)
- [ ] **AC5**: Supports filtering by `sources` (array of source strings)
- [ ] **AC6**: Supports filtering by `severity` (info, warning, error, critical)
- [ ] **AC7**: Supports filtering by `executionId`
- [ ] **AC8**: Supports filtering by `taskId`
- [ ] **AC9**: Entries include `humanSummary` (human-readable description)
- [ ] **AC10**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-307: Service Index
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-307-test', 'obs-307', 'test_context', 'inline',
     '## Test Commands for OBS-307: Service Index

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify index file exists
test -f server/services/observability/index.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check - ensure all exports work
npx tsc --noEmit server/services/observability/index.ts

# Check that imports work
echo "import { ExecutionService, TranscriptService, ToolUseService } from ''./server/services/observability'';" > /tmp/test-import.ts
npx tsc --noEmit /tmp/test-import.ts
```',
     0, datetime('now')),

    ('app-307-criteria', 'obs-307', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-307: Service Index

- [ ] **AC1**: File `server/services/observability/index.ts` exists (may need UPDATE)
- [ ] **AC2**: Exports `ExecutionService` (or equivalent functions)
- [ ] **AC3**: Exports `TranscriptService` (or equivalent functions)
- [ ] **AC4**: Exports `ToolUseService` (or equivalent functions)
- [ ] **AC5**: Exports `AssertionService` (or equivalent functions)
- [ ] **AC6**: Exports `SkillService` (or equivalent functions)
- [ ] **AC7**: Exports `CrossReferenceService` (or equivalent functions)
- [ ] **AC8**: Exports `MessageBusService` (or equivalent functions)
- [ ] **AC9**: Uses named exports (not default)
- [ ] **AC10**: Check if index.ts exists first before creating
- [ ] **AC11**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-308: Observability Routes
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-308-test', 'obs-308', 'test_context', 'inline',
     '## Test Commands for OBS-308: Observability Routes

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify routes file exists
test -f server/routes/observability.ts && echo "PASS" || echo "FAIL"

# TypeScript compilation check
npx tsc --noEmit server/routes/observability.ts

# Test all endpoints exist (should not return "Cannot GET")
curl -s "http://localhost:3001/api/observability/executions" | jq -e .success
curl -s "http://localhost:3001/api/observability/executions/test-id" | jq -e .error
curl -s "http://localhost:3001/api/observability/logs/message-bus" | jq -e .success
curl -s "http://localhost:3001/api/observability/cross-refs/tool_use/test-id" | jq -e .success
```',
     0, datetime('now')),

    ('app-308-criteria', 'obs-308', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-308: Observability Routes

- [ ] **AC1**: File `server/routes/observability.ts` exists (may need UPDATE)
- [ ] **AC2**: Implements `GET /executions` - list executions
- [ ] **AC3**: Implements `GET /executions/:id` - single execution
- [ ] **AC4**: Implements `GET /executions/:id/transcript` - transcript entries
- [ ] **AC5**: Implements `GET /executions/:id/tool-uses` - tool uses (with filters)
- [ ] **AC6**: Implements `GET /executions/:id/tool-summary` - aggregated tool stats
- [ ] **AC7**: Implements `GET /executions/:id/assertions` - assertions (with filters)
- [ ] **AC8**: Implements `GET /executions/:id/assertion-summary` - aggregated assertion stats
- [ ] **AC9**: Implements `GET /executions/:id/skills` - skill traces
- [ ] **AC10**: Implements `GET /cross-refs/:entityType/:entityId` - cross references
- [ ] **AC11**: Implements `GET /logs/message-bus` - message bus entries
- [ ] **AC12**: All endpoints return `{ success: true, data: ... }` format
- [ ] **AC13**: Error responses return `{ success: false, error: ... }`
- [ ] **AC14**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- OBS-309: Route Registration
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-309-test', 'obs-309', 'test_context', 'inline',
     '## Test Commands for OBS-309: Route Registration

```bash
# Run Phase 5 API tests
python3 tests/e2e/test-obs-phase5-api.py

# Verify routes are registered in server/api.ts
grep -n "observability" server/api.ts

# Test routes are accessible
curl -s "http://localhost:3001/api/observability/executions" | jq .success
curl -s "http://localhost:3001/api/observability/stats" | jq .success
curl -s "http://localhost:3001/api/observability/health" | jq .success

# These endpoints should be at /api/observability/...
curl -s "http://localhost:3001/api/observability/logs/message-bus" | jq .success
```',
     0, datetime('now')),

    ('app-309-criteria', 'obs-309', 'acceptance_criteria', 'inline',
     '## Acceptance Criteria for OBS-309: Route Registration

- [ ] **AC1**: `server/api.ts` imports observabilityRoutes
- [ ] **AC2**: Main routes mounted at `/api/observability`
- [ ] **AC3**: `/api/observability/executions` accessible
- [ ] **AC4**: `/api/observability/stats` accessible
- [ ] **AC5**: `/api/observability/health` accessible
- [ ] **AC6**: `/api/observability/activity` accessible
- [ ] **AC7**: `/api/observability/search` accessible
- [ ] **AC8**: `/api/observability/logs/message-bus` accessible
- [ ] **AC9**: No route conflicts with other API routes
- [ ] **AC10**: TypeScript compiles without errors',
     1, datetime('now'));

-- =============================================================================
-- Master Test Command for All Phase 5 Tasks
-- =============================================================================

INSERT OR IGNORE INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
VALUES
    ('app-phase5-master', 'obs-300', 'code_context', 'inline',
     '## Run All Phase 5 Tests

```bash
# Run entire Phase 5 test suite
python3 tests/e2e/test-obs-phase5-api.py

# Run with server startup check
curl -s http://localhost:3001/api/observability/health | jq .success && python3 tests/e2e/test-obs-phase5-api.py

# TypeScript compilation check on all service files
npx tsc --noEmit server/services/observability/*.ts
npx tsc --noEmit server/routes/observability.ts

# Run API tests with curl (quick smoke test)
curl -s http://localhost:3001/api/observability/executions | jq ''.success == true''
curl -s http://localhost:3001/api/observability/logs/message-bus | jq ''.success == true''
```

## Expected Test Count

Total tests: ~50
- OBS-300 (Execution Service): 5 tests
- OBS-301 (Transcript Service): 5 tests
- OBS-302 (Tool Use Service): 6 tests
- OBS-303 (Assertion Service): 4 tests
- OBS-304 (Skill Service): 2 tests
- OBS-305 (Cross-Reference Service): 5 tests
- OBS-306 (Message Bus Service): 5 tests
- OBS-308 (Observability Routes): 1 test
- OBS-309 (Route Registration): 4 tests
- Pagination tests: 3 tests
- Error handling tests: 2 tests
- Analytics tests: 3 tests
- Activity feed: 1 test

## Dependencies

Phase 5 depends on:
- Phase 1 (Schema): Tables must exist (migration 087)
- Phase 4 (Types): TypeScript types for observability',
     2, datetime('now'));
