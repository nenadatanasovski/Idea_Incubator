# Phase 4: TypeScript Types - Task List

> **Format:** Task Agent PIV-style tasks
> **Priority:** P1 (Required for UI)
> **Prerequisites:** Phase 1 (DB Schema)

---

## Wave Analysis

```
Wave 1: OBS-200 (foundational types - no deps)
Wave 2: OBS-201, OBS-204, OBS-205 (parallel - depend on OBS-200)
Wave 3: OBS-202, OBS-203, OBS-206, OBS-211 (parallel - depend on Wave 2)
Wave 4: OBS-207, OBS-208 (parallel - depend on Wave 3)
Wave 5: OBS-209 (depends on most types)
Wave 6: OBS-210 (depends on OBS-209)
Wave 7: OBS-212 (exports everything)
```

---

## Tasks

```yaml
# ==============================================================================
# WAVE 1: Foundational Types
# ==============================================================================

- id: OBS-200
  title: "Create Core Transcript Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/transcript.ts"
  status: pending
  wave: 1

  requirements:
    - "Define TranscriptEntryType enum with all 15 entry types"
    - "Define EntryCategory enum: lifecycle, tool_use, assertion, decision, discovery, coordination"
    - "Define TranscriptEntry interface with all database fields"
    - "Define PaginatedResponse<T> generic for API responses"
    - "Use ISO8601 string for timestamps"

  file_impacts:
    - path: "frontend/src/types/observability/transcript.ts"
      action: CREATE
    - path: "frontend/src/types/observability/"
      action: CREATE

  gotchas:
    - "Create observability directory first"
    - "Use string literals for enums for JSON compat"
    - "Include optional waveNumber field"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/transcript.ts"
    expected: "exit code 0"

  depends_on: []

# ==============================================================================
# WAVE 2: Core Entity Types (Parallel)
# ==============================================================================

- id: OBS-201
  title: "Create Tool Use Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/tool-use.ts"
  status: pending
  wave: 2

  requirements:
    - "Define ToolCategory enum: file_read, file_write, file_edit, shell, search, web, mcp, agent"
    - "Define ToolResultStatus enum: done, error, blocked"
    - "Define ToolUse interface with all database fields"
    - "Define ToolUseQuery interface for API filtering"
    - "Include isError, isBlocked, errorMessage, blockReason fields"

  file_impacts:
    - path: "frontend/src/types/observability/tool-use.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ

  gotchas:
    - "Optional input/output fields for large payloads"
    - "Include withinSkill for skill context"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/tool-use.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200"]

# ------------------------------------------------------------------------------

- id: OBS-204
  title: "Create Assertion Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/assertion.ts"
  status: pending
  wave: 2

  requirements:
    - "Define AssertionCategory enum with all 9 categories"
    - "Define AssertionResultType enum: pass, fail, skip, warn"
    - "Define AssertionResult interface with evidence"
    - "Define AssertionChain interface with aggregated results"
    - "Define AssertionEvidence interface: command, expected, actual, diff, exitCode"
    - "Define AssertionQuery and AssertionSummaryResponse interfaces"

  file_impacts:
    - path: "frontend/src/types/observability/assertion.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ

  gotchas:
    - "Evidence includes passRate as 0.0-1.0"
    - "firstFailure in chain references assertion ID"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/assertion.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200"]

# ------------------------------------------------------------------------------

- id: OBS-205
  title: "Create Message Bus Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/message-bus.ts"
  status: pending
  wave: 2

  requirements:
    - "Define MessageBusSeverity enum: info, warning, error, critical"
    - "Define MessageBusCategory enum: lifecycle, coordination, failure, decision"
    - "Define MessageBusLogEntry interface"
    - "Define MessageBusQuery interface"
    - "Include correlationId for related events"

  file_impacts:
    - path: "frontend/src/types/observability/message-bus.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ

  gotchas:
    - "humanSummary is the primary display field"
    - "payload is optional JSON"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/message-bus.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200"]

# ==============================================================================
# WAVE 3: Derived Types (Parallel)
# ==============================================================================

- id: OBS-202
  title: "Create Tool Input/Output Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/tool-io.ts"
  status: pending
  wave: 3

  requirements:
    - "Define specific input types: ReadInput, WriteInput, EditInput, BashInput, etc."
    - "Define specific output types: ReadOutput, WriteOutput, etc."
    - "Define ToolInputUnion and ToolOutputUnion discriminated unions"
    - "Include all MCP tool input types"

  file_impacts:
    - path: "frontend/src/types/observability/tool-io.ts"
      action: CREATE
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ

  gotchas:
    - "Use discriminated unions with 'tool' as discriminant"
    - "BashInput includes command, timeout, description"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/tool-io.ts"
    expected: "exit code 0"

  depends_on: ["OBS-201"]

# ------------------------------------------------------------------------------

- id: OBS-203
  title: "Create Skill Trace Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/skill.ts"
  status: pending
  wave: 3

  requirements:
    - "Define SkillReference interface: skillName, skillFile, lineNumber, sectionTitle"
    - "Define SkillTrace interface with nested toolCalls and subSkills"
    - "Define SkillStatus enum: success, partial, failed"
    - "Define SkillsUsageSummary interface for aggregations"
    - "Define SkillFileReference for file-based groupings"

  file_impacts:
    - path: "frontend/src/types/observability/skill.ts"
      action: CREATE
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ

  gotchas:
    - "subSkills is recursive - same type"
    - "toolCalls references ToolUse IDs"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/skill.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200", "OBS-201"]

# ------------------------------------------------------------------------------

- id: OBS-206
  title: "Create WebSocket Event Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/websocket.ts"
  status: pending
  wave: 3

  requirements:
    - "Define ObservabilityEventType enum with all event types"
    - "Define base ObservabilityEvent interface"
    - "Define specific event interfaces: TranscriptEntryEvent, ToolUseEvent, AssertionEvent"
    - "Define ExecutionStartEvent, ExecutionCompleteEvent"
    - "Define WaveStartEvent, WaveCompleteEvent"
    - "Define ObservabilityEventUnion discriminated union"

  file_impacts:
    - path: "frontend/src/types/observability/websocket.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ

  gotchas:
    - "Include timestamp in all events"
    - "executionId required in all events"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/websocket.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200", "OBS-201", "OBS-204"]

# ------------------------------------------------------------------------------

- id: OBS-211
  title: "Create Security Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/security.ts"
  status: pending
  wave: 3

  requirements:
    - "Define BlockedCommand interface with reason and suggestion"
    - "Define SecurityValidation interface for bash commands"
    - "Define DangerousPattern enum: rm -rf, sudo, etc."
    - "Include blockedAt timestamp and instanceId"

  file_impacts:
    - path: "frontend/src/types/observability/security.ts"
      action: CREATE
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ

  gotchas:
    - "Include original command in blocked entry"
    - "Suggestion field for safer alternatives"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/security.ts"
    expected: "exit code 0"

  depends_on: ["OBS-201"]

# ==============================================================================
# WAVE 4: API Types (Parallel)
# ==============================================================================

- id: OBS-207
  title: "Create API Request/Response Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/api.ts"
  status: pending
  wave: 4

  requirements:
    - "Define ExecutionResponse with stats"
    - "Define TranscriptQuery, ToolUseQuery, AssertionQuery interfaces"
    - "Define ToolUsageSummaryResponse with byTool and byCategory"
    - "Define ErrorResponse with code and details"
    - "Re-export PaginatedResponse from transcript.ts"

  file_impacts:
    - path: "frontend/src/types/observability/api.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ
    - path: "frontend/src/types/observability/skill.ts"
      action: READ

  gotchas:
    - "Include nextCursor for pagination"
    - "Stats includes passRate as number 0-1"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/api.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200", "OBS-201", "OBS-203", "OBS-204"]

# ------------------------------------------------------------------------------

- id: OBS-208
  title: "Create Cross-Reference Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/cross-refs.ts"
  status: pending
  wave: 4

  requirements:
    - "Define CrossRefEntityType: toolUse, assertion, skillTrace, transcriptEntry"
    - "Define ToolUseCrossRefs, AssertionCrossRefs, SkillTraceCrossRefs interfaces"
    - "Define TranscriptEntryCrossRefs interface"
    - "Define EntityCrossRefs discriminated union"
    - "Define RelatedEntitiesResult for full entity loading"

  file_impacts:
    - path: "frontend/src/types/observability/cross-refs.ts"
      action: CREATE
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ
    - path: "frontend/src/types/observability/skill.ts"
      action: READ

  gotchas:
    - "previousInChain/nextInChain for assertion navigation"
    - "parentToolUse/childToolUses for nested calls"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/cross-refs.ts"
    expected: "exit code 0"

  depends_on: ["OBS-201", "OBS-203", "OBS-204"]

# ==============================================================================
# WAVE 5: UI Component Props
# ==============================================================================

- id: OBS-209
  title: "Create UI Component Prop Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/ui-props.ts"
  status: pending
  wave: 5

  requirements:
    - "Define ExecutionListProps and ExecutionCardProps"
    - "Define TranscriptViewerProps and TranscriptEntryProps"
    - "Define ToolUseCardProps and ToolUseSummaryProps"
    - "Define AssertionCardProps, AssertionChainProps, AssertionBadgeProps"
    - "Define SkillTraceCardProps and SkillTreeProps"
    - "Define MessageBusLogProps and MessageBusEntryProps"
    - "Define FilterPanelProps with onFilterChange callbacks"

  file_impacts:
    - path: "frontend/src/types/observability/ui-props.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ
    - path: "frontend/src/types/observability/skill.ts"
      action: READ
    - path: "frontend/src/types/observability/message-bus.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ

  gotchas:
    - "Include onClick handlers for navigation"
    - "Include loading/error states"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/ui-props.ts"
    expected: "exit code 0"

  depends_on: ["OBS-200", "OBS-201", "OBS-203", "OBS-204", "OBS-205", "OBS-207"]

# ==============================================================================
# WAVE 6: React Hook Types
# ==============================================================================

- id: OBS-210
  title: "Create React Hook Types"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/hooks.ts"
  status: pending
  wave: 6

  requirements:
    - "Define UseExecutionListResult with data, loading, error, refetch"
    - "Define UseExecutionResult for single execution"
    - "Define UseTranscriptResult with pagination"
    - "Define UseToolUsesResult and UseAssertionsResult"
    - "Define UseObservabilityStreamResult for WebSocket connection"
    - "Define UseFiltersResult for filter state management"

  file_impacts:
    - path: "frontend/src/types/observability/hooks.ts"
      action: CREATE
    - path: "frontend/src/types/observability/ui-props.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ
    - path: "frontend/src/types/observability/websocket.ts"
      action: READ

  gotchas:
    - "Include refetch function type"
    - "Connection status for WebSocket hooks"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/hooks.ts"
    expected: "exit code 0"

  depends_on: ["OBS-209"]

# ==============================================================================
# WAVE 7: Index Export
# ==============================================================================

- id: OBS-212
  title: "Create Index Export File"
  phase: types
  action: CREATE
  file: "frontend/src/types/observability/index.ts"
  status: pending
  wave: 7

  requirements:
    - "Export all types from transcript.ts"
    - "Export all types from tool-use.ts and tool-io.ts"
    - "Export all types from skill.ts"
    - "Export all types from assertion.ts"
    - "Export all types from message-bus.ts"
    - "Export all types from websocket.ts"
    - "Export all types from api.ts"
    - "Export all types from cross-refs.ts"
    - "Export all types from ui-props.ts"
    - "Export all types from hooks.ts"
    - "Export all types from security.ts"

  file_impacts:
    - path: "frontend/src/types/observability/index.ts"
      action: CREATE
    - path: "frontend/src/types/observability/transcript.ts"
      action: READ
    - path: "frontend/src/types/observability/tool-use.ts"
      action: READ
    - path: "frontend/src/types/observability/tool-io.ts"
      action: READ
    - path: "frontend/src/types/observability/skill.ts"
      action: READ
    - path: "frontend/src/types/observability/assertion.ts"
      action: READ
    - path: "frontend/src/types/observability/message-bus.ts"
      action: READ
    - path: "frontend/src/types/observability/websocket.ts"
      action: READ
    - path: "frontend/src/types/observability/api.ts"
      action: READ
    - path: "frontend/src/types/observability/cross-refs.ts"
      action: READ
    - path: "frontend/src/types/observability/ui-props.ts"
      action: READ
    - path: "frontend/src/types/observability/hooks.ts"
      action: READ
    - path: "frontend/src/types/observability/security.ts"
      action: READ

  gotchas:
    - "Use export * from syntax"
    - "Order alphabetically for consistency"

  validation:
    command: "npx tsc --noEmit frontend/src/types/observability/index.ts"
    expected: "exit code 0"

  depends_on:
    [
      "OBS-200",
      "OBS-201",
      "OBS-202",
      "OBS-203",
      "OBS-204",
      "OBS-205",
      "OBS-206",
      "OBS-207",
      "OBS-208",
      "OBS-209",
      "OBS-210",
      "OBS-211",
    ]
```

---

## Execution Order Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 4 EXECUTION WAVES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WAVE 1                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────┐                                                │
│  │      OBS-200        │                                                │
│  │  Core Transcript    │                                                │
│  │      Types          │                                                │
│  └─────────┬───────────┘                                                │
│            │                                                             │
│            ▼                                                             │
│  WAVE 2 (Parallel)                                                       │
│  ─────────────────                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    OBS-201      │  │    OBS-204      │  │    OBS-205      │         │
│  │   Tool Use      │  │   Assertion     │  │  Message Bus    │         │
│  │    Types        │  │    Types        │  │    Types        │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           ▼                    ▼                    ▼                   │
│  WAVE 3 (Parallel)                                                       │
│  ─────────────────                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐               │
│  │  OBS-202  │ │  OBS-203  │ │  OBS-206  │ │  OBS-211  │               │
│  │ Tool I/O  │ │   Skill   │ │ WebSocket │ │ Security  │               │
│  │  Types    │ │  Traces   │ │  Events   │ │  Types    │               │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────────┘               │
│        │             │             │                                    │
│        ▼             ▼             ▼                                    │
│  WAVE 4 (Parallel)                                                       │
│  ─────────────────                                                       │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │      OBS-207        │    │      OBS-208        │                     │
│  │   API Req/Res       │    │   Cross-Refs        │                     │
│  │      Types          │    │      Types          │                     │
│  └─────────┬───────────┘    └─────────┬───────────┘                     │
│            │                          │                                  │
│            ▼                          ▼                                  │
│  WAVE 5                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-209                     │                            │
│  │         UI Component Props               │                            │
│  └─────────────────┬───────────────────────┘                            │
│                    │                                                     │
│                    ▼                                                     │
│  WAVE 6                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-210                     │                            │
│  │          React Hook Types                │                            │
│  └─────────────────┬───────────────────────┘                            │
│                    │                                                     │
│                    ▼                                                     │
│  WAVE 7                                                                  │
│  ──────                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │              OBS-212                     │                            │
│  │           Index Exports                  │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Conflict Matrix

All Phase 4 tasks create different files - no conflicts within phase.

| Task A  | Task B  | Same File? | Conflict? |
| ------- | ------- | ---------- | --------- |
| OBS-200 | OBS-201 | No         | No        |
| OBS-201 | OBS-204 | No         | No        |
| OBS-204 | OBS-205 | No         | No        |
| OBS-202 | OBS-203 | No         | No        |
| OBS-206 | OBS-211 | No         | No        |
| OBS-207 | OBS-208 | No         | No        |

All parallel waves can execute fully in parallel.

---

## Validation Commands Summary

| Task    | Validation Command                                                 | Expected |
| ------- | ------------------------------------------------------------------ | -------- |
| OBS-200 | `npx tsc --noEmit frontend/src/types/observability/transcript.ts`  | exit 0   |
| OBS-201 | `npx tsc --noEmit frontend/src/types/observability/tool-use.ts`    | exit 0   |
| OBS-202 | `npx tsc --noEmit frontend/src/types/observability/tool-io.ts`     | exit 0   |
| OBS-203 | `npx tsc --noEmit frontend/src/types/observability/skill.ts`       | exit 0   |
| OBS-204 | `npx tsc --noEmit frontend/src/types/observability/assertion.ts`   | exit 0   |
| OBS-205 | `npx tsc --noEmit frontend/src/types/observability/message-bus.ts` | exit 0   |
| OBS-206 | `npx tsc --noEmit frontend/src/types/observability/websocket.ts`   | exit 0   |
| OBS-207 | `npx tsc --noEmit frontend/src/types/observability/api.ts`         | exit 0   |
| OBS-208 | `npx tsc --noEmit frontend/src/types/observability/cross-refs.ts`  | exit 0   |
| OBS-209 | `npx tsc --noEmit frontend/src/types/observability/ui-props.ts`    | exit 0   |
| OBS-210 | `npx tsc --noEmit frontend/src/types/observability/hooks.ts`       | exit 0   |
| OBS-211 | `npx tsc --noEmit frontend/src/types/observability/security.ts`    | exit 0   |
| OBS-212 | `npx tsc --noEmit frontend/src/types/observability/index.ts`       | exit 0   |

---

## E2E Test

**File:** `tests/e2e/test-obs-phase4-types.ts`

**Run:** `npx ts-node tests/e2e/test-obs-phase4-types.ts`

**Pass Criteria:** `ALL PHASE 4 TESTS PASSED`
