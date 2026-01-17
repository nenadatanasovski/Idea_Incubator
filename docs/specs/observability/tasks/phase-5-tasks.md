# Phase 5: API Routes - Task List

> **Format:** Task Agent PIV-style tasks
> **Priority:** P1 (Required for UI)
> **Prerequisites:** Phase 1 (DB Schema), Phase 4 (TypeScript Types)

---

## Wave Analysis

```
Wave 1: OBS-300, OBS-301, OBS-302, OBS-303, OBS-304, OBS-306 (parallel - independent services)
Wave 2: OBS-305 (depends on other services for cross-refs)
Wave 3: OBS-307 (service index - depends on all services)
Wave 4: OBS-308 (routes - depends on index)
Wave 5: OBS-309 (registration - depends on routes)
```

---

## Tasks

```yaml
# ==============================================================================
# WAVE 1: Independent Services (Parallel)
# ==============================================================================

- id: OBS-300
  title: "Create Execution Service"
  phase: api
  action: CREATE
  file: "server/services/observability/execution-service.ts"
  status: pending
  wave: 1

  requirements:
    - "listExecutions() returns paginated execution list with stats"
    - "getExecution() returns single execution with full stats"
    - "Stats include: totalToolUses, totalAssertions, passRate, errorCount, durationMs"
    - "Status computed from latest phase_end entry: running, completed, failed"
    - "Use better-sqlite3 for database access"
    - "close() method for proper cleanup"

  file_impacts:
    - path: "server/services/observability/execution-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ

  gotchas:
    - "Use DISTINCT on execution_id from transcript_entries"
    - "Pass rate = passed / total, default to 1.0 if no assertions"
    - "Duration only available if execution completed"

  validation:
    command: "npx tsc --noEmit server/services/observability/execution-service.ts"
    expected: "exit code 0"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-301
  title: "Create Transcript Service"
  phase: api
  action: CREATE
  file: "server/services/observability/transcript-service.ts"
  status: pending
  wave: 1

  requirements:
    - "getTranscript() returns paginated transcript entries with filtering"
    - "getEntry() returns single transcript entry by ID"
    - "Filter by: entryTypes, categories, taskId, since, until"
    - "Cursor-based pagination using sequence number"
    - "Parse JSON details field"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/transcript-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ

  gotchas:
    - "Use sequence number for cursor, not ID"
    - "Parse details from JSON string"
    - "Handle null taskId gracefully"

  validation:
    command: "npx tsc --noEmit server/services/observability/transcript-service.ts"
    expected: "exit code 0"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-302
  title: "Create Tool Use Service"
  phase: api
  action: CREATE
  file: "server/services/observability/tool-use-service.ts"
  status: pending
  wave: 1

  requirements:
    - "getToolUses() returns paginated tool uses with filtering"
    - "getToolUse() returns single tool use by ID"
    - "getToolSummary() returns aggregated stats by tool and category"
    - "Filter by: tools, categories, status, taskId, since, until"
    - "Optional includeInputs/includeOutputs for large payloads"
    - "Summary includes: byTool, byCategory, timeline, errors, blocked"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/tool-use-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ

  gotchas:
    - "Parse input/output from JSON only if requested"
    - "Boolean fields stored as INTEGER (0/1) in SQLite"
    - "Limit error/blocked lists to 20 entries each"

  validation:
    command: "npx tsc --noEmit server/services/observability/tool-use-service.ts"
    expected: "exit code 0"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-303
  title: "Create Assertion Service"
  phase: api
  action: CREATE
  file: "server/services/observability/assertion-service.ts"
  status: pending
  wave: 1

  requirements:
    - "getAssertions() returns paginated assertions with filtering"
    - "getAssertion() returns single assertion by ID"
    - "getAssertionSummary() returns aggregated stats by category"
    - "getChains() returns all assertion chains for execution"
    - "Filter by: categories, result, taskId, chainId, since"
    - "Chain includes: assertions array, overallResult, pass/fail/skip counts, firstFailure"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/assertion-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ

  gotchas:
    - "Parse evidence from JSON"
    - "Pass rate = passed / total, default to 1.0 if no assertions"
    - "firstFailure references first assertion with result='fail'"

  validation:
    command: "npx tsc --noEmit server/services/observability/assertion-service.ts"
    expected: "exit code 0"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-304
  title: "Create Skill Service"
  phase: api
  action: CREATE
  file: "server/services/observability/skill-service.ts"
  status: pending
  wave: 1

  requirements:
    - "getSkillTraces() returns paginated skill traces with filtering"
    - "getSkillTrace() returns single trace with nested tool calls and sub-skills"
    - "getSkillsSummary() returns aggregated stats by skill name and file"
    - "Filter by: taskId, limit"
    - "Nested data: toolCalls[], subSkills[], assertions[]"
    - "Summary includes: skillFileReferences with lines and sections"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/skill-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/skill.ts"
      action: READ

  gotchas:
    - "subSkills loaded recursively"
    - "toolCalls queried by within_skill foreign key"
    - "lineNumber may be null for dynamic skills"

  validation:
    command: "npx tsc --noEmit server/services/observability/skill-service.ts"
    expected: "exit code 0"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-306
  title: "Create Message Bus Service"
  phase: api
  action: CREATE
  file: "server/services/observability/message-bus-service.ts"
  status: pending
  wave: 1

  requirements:
    - "getLogs() returns paginated message bus entries with filtering"
    - "getCorrelatedEvents() returns all events with same correlationId"
    - "Filter by: since, until, eventTypes, sources, severity, correlationId"
    - "Ordered by timestamp DESC (newest first)"
    - "Parse payload from JSON"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/message-bus-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/message-bus.ts"
      action: READ

  gotchas:
    - "humanSummary is primary display field"
    - "severity filtering uses IN clause"
    - "correlationId may be null"

  validation:
    command: "npx tsc --noEmit server/services/observability/message-bus-service.ts"
    expected: "exit code 0"

  depends_on: []

# ==============================================================================
# WAVE 2: Cross-Reference Service
# ==============================================================================

- id: OBS-305
  title: "Create Cross-Reference Service"
  phase: api
  action: CREATE
  file: "server/services/observability/cross-reference-service.ts"
  status: pending
  wave: 2

  requirements:
    - "getCrossReferences() returns cross-refs for any entity type"
    - "Support 4 entity types: toolUse, assertion, skillTrace, transcriptEntry"
    - "ToolUseCrossRefs: transcriptEntry, task, skill, parentToolUse, childToolUses, relatedAssertions"
    - "AssertionCrossRefs: task, chain, transcriptEntries, toolUses, previousInChain, nextInChain"
    - "SkillTraceCrossRefs: task, transcriptEntries, toolUses, assertions, parentSkill, childSkills"
    - "TranscriptEntryCrossRefs: execution, task, toolUse, skill, assertion, previousEntry, nextEntry"
    - "getRelatedEntities() returns fully loaded related entities"
    - "close() method for cleanup"

  file_impacts:
    - path: "server/services/observability/cross-reference-service.ts"
      action: CREATE
    - path: "database/ideas.db"
      action: READ
    - path: "frontend/src/types/observability/cross-refs.ts"
      action: READ
    - path: "server/services/observability/execution-service.ts"
      action: READ
    - path: "server/services/observability/transcript-service.ts"
      action: READ
    - path: "server/services/observability/tool-use-service.ts"
      action: READ
    - path: "server/services/observability/assertion-service.ts"
      action: READ
    - path: "server/services/observability/skill-service.ts"
      action: READ

  gotchas:
    - "Use LIKE for searching evidence JSON"
    - "Previous/next use sequence/timestamp ordering"
    - "Return null for missing entities"

  validation:
    command: "npx tsc --noEmit server/services/observability/cross-reference-service.ts"
    expected: "exit code 0"

  depends_on: ["OBS-300", "OBS-301", "OBS-302", "OBS-303", "OBS-304"]

# ==============================================================================
# WAVE 3: Service Index
# ==============================================================================

- id: OBS-307
  title: "Create Service Index"
  phase: api
  action: UPDATE
  file: "server/services/observability/index.ts"
  status: pending
  wave: 3

  requirements:
    - "Export ExecutionService from execution-service"
    - "Export TranscriptService from transcript-service"
    - "Export ToolUseService from tool-use-service"
    - "Export AssertionService from assertion-service"
    - "Export SkillService from skill-service"
    - "Export CrossReferenceService from cross-reference-service"
    - "Export MessageBusService from message-bus-service"
    - "Re-export existing TranscriptWriter, ToolUseLogger, AssertionRecorder if present"

  file_impacts:
    - path: "server/services/observability/index.ts"
      action: UPDATE
    - path: "server/services/observability/execution-service.ts"
      action: READ
    - path: "server/services/observability/transcript-service.ts"
      action: READ
    - path: "server/services/observability/tool-use-service.ts"
      action: READ
    - path: "server/services/observability/assertion-service.ts"
      action: READ
    - path: "server/services/observability/skill-service.ts"
      action: READ
    - path: "server/services/observability/cross-reference-service.ts"
      action: READ
    - path: "server/services/observability/message-bus-service.ts"
      action: READ

  gotchas:
    - "Use named exports, not default exports"
    - "Check if index.ts exists first, update if so"

  validation:
    command: "npx tsc --noEmit server/services/observability/index.ts"
    expected: "exit code 0"

  depends_on:
    [
      "OBS-300",
      "OBS-301",
      "OBS-302",
      "OBS-303",
      "OBS-304",
      "OBS-305",
      "OBS-306",
    ]

# ==============================================================================
# WAVE 4: API Routes
# ==============================================================================

- id: OBS-308
  title: "Create Observability Routes"
  phase: api
  action: CREATE
  file: "server/routes/observability.ts"
  status: pending
  wave: 4

  requirements:
    - "GET /api/observability/executions - list executions with pagination"
    - "GET /api/observability/executions/:id - get single execution"
    - "GET /api/observability/executions/:id/transcript - get transcript with filtering"
    - "GET /api/observability/executions/:id/tool-uses - get tool uses with filtering"
    - "GET /api/observability/executions/:id/tool-summary - get aggregated tool stats"
    - "GET /api/observability/executions/:id/assertions - get assertions with filtering"
    - "GET /api/observability/executions/:id/assertion-summary - get aggregated assertion stats"
    - "GET /api/observability/executions/:id/skills - get skill traces"
    - "GET /api/observability/cross-refs/:entityType/:entityId - get cross-references"
    - "GET /api/logs/message-bus - get message bus logs with filtering"
    - "All endpoints return proper error responses with codes"
    - "404 for missing entities, 400 for invalid parameters"

  file_impacts:
    - path: "server/routes/observability.ts"
      action: CREATE
    - path: "server/services/observability/index.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ

  gotchas:
    - "Parse comma-separated query params into arrays"
    - "Parse boolean query params: 'true' -> true"
    - "Validate entityType against allowed values"
    - "Include error code in all error responses"

  validation:
    command: "npx tsc --noEmit server/routes/observability.ts"
    expected: "exit code 0"

  depends_on: ["OBS-307"]

# ==============================================================================
# WAVE 5: Route Registration
# ==============================================================================

- id: OBS-309
  title: "Register Routes in API"
  phase: api
  action: UPDATE
  file: "server/api.ts"
  status: pending
  wave: 5

  requirements:
    - "Import observabilityRoutes from routes/observability"
    - "Mount at /api/observability for main routes"
    - "Mount at /api for logs/message-bus route"
    - "Add after existing route registrations"
    - "No conflicts with existing routes"

  file_impacts:
    - path: "server/api.ts"
      action: UPDATE
    - path: "server/routes/observability.ts"
      action: READ

  gotchas:
    - "Check existing route prefixes for conflicts"
    - "Message bus route at /api/logs/message-bus requires second mount"
    - "Import path uses relative path"

  validation:
    command: "npx tsc --noEmit server/api.ts && curl -s http://localhost:3001/api/observability/executions | head -c 100"
    expected: "exit code 0, JSON response"

  depends_on: ["OBS-308"]
```

---

## Execution Order Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 5 EXECUTION WAVES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WAVE 1 (Parallel - 6 services)                                          │
│  ───────────────────────────────                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                              │
│  │  OBS-300  │ │  OBS-301  │ │  OBS-302  │                              │
│  │ Execution │ │Transcript │ │ Tool Use  │                              │
│  │  Service  │ │  Service  │ │  Service  │                              │
│  └───────────┘ └───────────┘ └───────────┘                              │
│                                                                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                              │
│  │  OBS-303  │ │  OBS-304  │ │  OBS-306  │                              │
│  │ Assertion │ │   Skill   │ │MessageBus │                              │
│  │  Service  │ │  Service  │ │  Service  │                              │
│  └─────┬─────┘ └─────┬─────┘ └───────────┘                              │
│        │             │                                                   │
│        ▼             ▼                                                   │
│  WAVE 2                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-305                     │                            │
│  │       Cross-Reference Service            │                            │
│  └─────────────────┬───────────────────────┘                            │
│                    │                                                     │
│                    ▼                                                     │
│  WAVE 3                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-307                     │                            │
│  │           Service Index                  │                            │
│  └─────────────────┬───────────────────────┘                            │
│                    │                                                     │
│                    ▼                                                     │
│  WAVE 4                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-308                     │                            │
│  │        Observability Routes              │                            │
│  └─────────────────┬───────────────────────┘                            │
│                    │                                                     │
│                    ▼                                                     │
│  WAVE 5                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-309                     │                            │
│  │         Route Registration               │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Conflict Matrix

| Task A  | Task B  | Same File? | Conflict? | Resolution            |
| ------- | ------- | ---------- | --------- | --------------------- |
| OBS-300 | OBS-301 | No         | No        | Parallel OK           |
| OBS-300 | OBS-302 | No         | No        | Parallel OK           |
| OBS-300 | OBS-303 | No         | No        | Parallel OK           |
| OBS-300 | OBS-304 | No         | No        | Parallel OK           |
| OBS-300 | OBS-306 | No         | No        | Parallel OK           |
| OBS-307 | OBS-308 | No         | No        | Sequential (Wave 3→4) |
| OBS-308 | OBS-309 | No         | No        | Sequential (Wave 4→5) |

All Wave 1 services are independent and can be executed fully in parallel.

---

## Validation Commands Summary

| Task    | Validation Command                                                          | Expected |
| ------- | --------------------------------------------------------------------------- | -------- |
| OBS-300 | `npx tsc --noEmit server/services/observability/execution-service.ts`       | exit 0   |
| OBS-301 | `npx tsc --noEmit server/services/observability/transcript-service.ts`      | exit 0   |
| OBS-302 | `npx tsc --noEmit server/services/observability/tool-use-service.ts`        | exit 0   |
| OBS-303 | `npx tsc --noEmit server/services/observability/assertion-service.ts`       | exit 0   |
| OBS-304 | `npx tsc --noEmit server/services/observability/skill-service.ts`           | exit 0   |
| OBS-305 | `npx tsc --noEmit server/services/observability/cross-reference-service.ts` | exit 0   |
| OBS-306 | `npx tsc --noEmit server/services/observability/message-bus-service.ts`     | exit 0   |
| OBS-307 | `npx tsc --noEmit server/services/observability/index.ts`                   | exit 0   |
| OBS-308 | `npx tsc --noEmit server/routes/observability.ts`                           | exit 0   |
| OBS-309 | `npx tsc --noEmit server/api.ts`                                            | exit 0   |

---

## API Integration Test

After all tasks complete, verify endpoints:

```bash
# Test execution list
curl -s http://localhost:3001/api/observability/executions | jq '.data | length'

# Test single execution (if any exist)
EXEC_ID=$(curl -s http://localhost:3001/api/observability/executions | jq -r '.data[0].id // empty')
if [ -n "$EXEC_ID" ]; then
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID" | jq '.id'
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID/transcript" | jq '.total'
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID/tool-uses" | jq '.total'
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID/tool-summary" | jq '.totalToolUses'
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID/assertions" | jq '.total'
  curl -s "http://localhost:3001/api/observability/executions/$EXEC_ID/assertion-summary" | jq '.summary.passRate'
fi

# Test cross-refs (404 expected for missing entity)
curl -s http://localhost:3001/api/observability/cross-refs/toolUse/nonexistent | jq '.code'

# Test message bus
curl -s http://localhost:3001/api/logs/message-bus | jq '.total'
```

---

## E2E Test

**File:** `tests/e2e/test-obs-phase5-api.py`

**Run:** `python3 tests/e2e/test-obs-phase5-api.py`

**Pass Criteria:** `ALL PHASE 5 TESTS PASSED`

---

## Cross-Phase Dependencies

```
Phase 1 (Schema) ────────────────────────────────┐
                                                  │
Phase 4 (Types) ─────────────────────────────────┤
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │   Phase 5    │
                                           │  API Routes  │
                                           └──────────────┘
```

Phase 5 requires:

- Phase 1 database tables exist
- Phase 4 TypeScript types for proper typing
