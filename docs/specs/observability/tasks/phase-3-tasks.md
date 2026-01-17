# Phase 3: Agent Integration - Task List

> **Format:** Task Agent PIV-style tasks
> **Priority:** P0 (Critical)
> **Prerequisites:** Phase 1 (DB Schema), Phase 2 (Python Producers)

---

## Wave Analysis

```
Wave 1: OBS-100, OBS-110 (parallel - no interdependencies)
Wave 2: OBS-101 (depends on OBS-110)
Wave 3: OBS-102, OBS-105, OBS-106, OBS-107, OBS-108, OBS-109 (parallel)
Wave 4: OBS-103, OBS-104 (depend on OBS-102)
```

---

## Tasks

```yaml
# ==============================================================================
# WAVE 1: Base Infrastructure (Parallel)
# ==============================================================================

- id: OBS-100
  title: "Create Observable Agent Base Class (Python)"
  phase: types
  action: CREATE
  file: "coding-loops/shared/observable_agent.py"
  status: pending
  wave: 1

  requirements:
    - "Extend from object, initialize TranscriptWriter, ToolUseLogger, SkillTracer, AssertionRecorder"
    - "Provide lifecycle methods: log_phase_start, log_phase_end, log_task_start, log_task_end"
    - "Provide tool logging: log_tool_start, log_tool_end, log_tool_blocked"
    - "Provide assertion methods: start_assertion_chain, end_assertion_chain, assert_*"
    - "Provide error logging with stack traces"
    - "Provide discovery logging for SIA-type agents"
    - "Provide coordination logging: log_lock_acquire, log_lock_release, log_checkpoint"
    - "close() method flushes and closes all writers"

  file_impacts:
    - path: "coding-loops/shared/observable_agent.py"
      action: CREATE
    - path: "coding-loops/shared/transcript_writer.py"
      action: READ
    - path: "coding-loops/shared/tool_use_logger.py"
      action: READ
    - path: "coding-loops/shared/skill_tracer.py"
      action: READ
    - path: "coding-loops/shared/assertion_recorder.py"
      action: READ

  gotchas:
    - "Import from shared package using relative imports"
    - "Use uuid.uuid4() for instance IDs"
    - "All methods should return entry_id for cross-referencing"

  validation:
    command: 'python3 -c "from coding_loops.shared.observable_agent import ObservableAgent; print(''OK'')"'
    expected: "exit code 0, stdout contains 'OK'"

  depends_on: []

# ------------------------------------------------------------------------------

- id: OBS-110
  title: "Create TypeScript Observability Services"
  phase: types
  action: CREATE
  file: "server/services/observability/transcript-writer.ts"
  status: pending
  wave: 1

  requirements:
    - "Create TranscriptWriter class that writes to SQLite and JSONL"
    - "Create ToolUseLogger class that logs tool invocations"
    - "Create AssertionRecorder class that manages assertion chains"
    - "All classes use better-sqlite3 for database access"
    - "Proper connection management with close() methods"
    - "Export all classes from index.ts"

  file_impacts:
    - path: "server/services/observability/transcript-writer.ts"
      action: CREATE
    - path: "server/services/observability/tool-use-logger.ts"
      action: CREATE
    - path: "server/services/observability/assertion-recorder.ts"
      action: CREATE
    - path: "server/services/observability/index.ts"
      action: UPDATE
    - path: "database/ideas.db"
      action: READ

  gotchas:
    - "Use better-sqlite3, not sql.js"
    - "Enable foreign keys with pragma"
    - "Create transcript directory if not exists"
    - "Buffer JSONL writes and flush periodically"

  validation:
    command: "npx tsc --noEmit server/services/observability/transcript-writer.ts"
    expected: "exit code 0"

  depends_on: []

# ==============================================================================
# WAVE 2: TypeScript Base Class
# ==============================================================================

- id: OBS-101
  title: "Create Observable Agent Base Class (TypeScript)"
  phase: types
  action: CREATE
  file: "server/agents/observable-agent.ts"
  status: pending
  wave: 2

  requirements:
    - "Abstract class that mirrors Python ObservableAgent functionality"
    - "All lifecycle methods protected for subclass use"
    - "Async close() method for proper cleanup"
    - "TypeScript interfaces for ToolUseBlock, ToolResultBlock"
    - "Import services from server/services/observability/"

  file_impacts:
    - path: "server/agents/observable-agent.ts"
      action: CREATE
    - path: "server/services/observability/transcript-writer.ts"
      action: READ
    - path: "server/services/observability/tool-use-logger.ts"
      action: READ
    - path: "server/services/observability/assertion-recorder.ts"
      action: READ

  gotchas:
    - "Use protected methods, not private"
    - "Handle undefined taskId gracefully in assertions"
    - "Ensure async/await for close() to flush properly"

  validation:
    command: "npx tsc --noEmit server/agents/observable-agent.ts"
    expected: "exit code 0"

  depends_on: ["OBS-110"]

# ==============================================================================
# WAVE 3: Agent Integrations (Parallel)
# ==============================================================================

- id: OBS-102
  title: "Integrate Build Agent Worker - Base"
  phase: api
  action: UPDATE
  file: "coding-loops/agents/build_agent_worker.py"
  status: pending
  wave: 3

  requirements:
    - "Build Agent extends ObservableAgent"
    - "Initialize with execution_id and wave_id"
    - "Call log_task_start/end for each task"
    - "Call log_lock_acquire/release for file locks"
    - "Call log_checkpoint when creating checkpoints"
    - "Call log_error in exception handlers"
    - "Call close() in finally block"

  file_impacts:
    - path: "coding-loops/agents/build_agent_worker.py"
      action: UPDATE
    - path: "coding-loops/shared/observable_agent.py"
      action: READ

  gotchas:
    - "Don't break existing functionality"
    - "Preserve all existing methods"
    - "Add super().__init__() call first in __init__"

  validation:
    command: 'python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print(''OK'')"'
    expected: "exit code 0, stdout contains 'OK'"

  depends_on: ["OBS-100"]

# ------------------------------------------------------------------------------

- id: OBS-105
  title: "Integrate Specification Agent"
  phase: api
  action: UPDATE
  file: "agents/specification/core.ts"
  status: pending
  wave: 3

  requirements:
    - "Spec Agent extends ObservableAgent"
    - "Log all 4 phases: analyze, question, generate, decompose"
    - "Use assertion chains to validate spec.md and tasks.md creation"
    - "Log errors with phase context"
    - "Call close() on completion"

  file_impacts:
    - path: "agents/specification/core.ts"
      action: UPDATE
    - path: "server/agents/observable-agent.ts"
      action: READ

  gotchas:
    - "Check if file exists before asserting file_created"
    - "Phase names must match exactly for filtering"

  validation:
    command: "npx tsc --noEmit agents/specification/core.ts"
    expected: "exit code 0"

  depends_on: ["OBS-101"]

# ------------------------------------------------------------------------------

- id: OBS-106
  title: "Integrate Validation Agent"
  phase: api
  action: UPDATE
  file: "agents/validation/orchestrator.ts"
  status: pending
  wave: 3

  requirements:
    - "Validation Agent extends ObservableAgent"
    - "Each validation check creates an assertion entry"
    - "Evidence includes command output and exit codes"
    - "Chain aggregates all validation results"
    - "Overall validation status logged as phase_end"

  file_impacts:
    - path: "agents/validation/orchestrator.ts"
      action: UPDATE
    - path: "server/agents/observable-agent.ts"
      action: READ

  gotchas:
    - "Truncate long stdout/stderr in evidence"
    - "Handle test timeouts gracefully"

  validation:
    command: "npx tsc --noEmit agents/validation/orchestrator.ts"
    expected: "exit code 0"

  depends_on: ["OBS-101"]

# ------------------------------------------------------------------------------

- id: OBS-107
  title: "Integrate UX Agent"
  phase: api
  action: UPDATE
  file: "agents/ux/orchestrator.ts"
  status: pending
  wave: 3

  requirements:
    - "UX Agent extends ObservableAgent"
    - "Log user journeys as phases"
    - "Log each Puppeteer interaction as tool_use"
    - "Record accessibility checks as assertions"
    - "Reference screenshots in tool output summaries"

  file_impacts:
    - path: "agents/ux/orchestrator.ts"
      action: UPDATE
    - path: "server/agents/observable-agent.ts"
      action: READ

  gotchas:
    - "Screenshots are binary - only reference path in log"
    - "Puppeteer tool names use mcp__ prefix"

  validation:
    command: "npx tsc --noEmit agents/ux/orchestrator.ts"
    expected: "exit code 0"

  depends_on: ["OBS-101"]

# ------------------------------------------------------------------------------

- id: OBS-108
  title: "Integrate Self-Improvement Agent (SIA)"
  phase: api
  action: UPDATE
  file: "agents/sia/index.ts"
  status: pending
  wave: 3

  requirements:
    - "SIA extends ObservableAgent"
    - "Log every discovered pattern/gotcha/decision as discovery entry"
    - "Include confidence scores in discovery details"
    - "Log KB updates as phase completions"
    - "Log analysis failures with context"

  file_impacts:
    - path: "agents/sia/index.ts"
      action: UPDATE
    - path: "server/agents/observable-agent.ts"
      action: READ

  gotchas:
    - "Confidence must be 0.0-1.0 float"
    - "Discovery type must be: gotcha, pattern, or decision"

  validation:
    command: "npx tsc --noEmit agents/sia/index.ts"
    expected: "exit code 0"

  depends_on: ["OBS-101"]

# ------------------------------------------------------------------------------

- id: OBS-109
  title: "Integrate Monitoring Agent"
  phase: api
  action: UPDATE
  file: "server/monitoring/monitoring-agent.ts"
  status: pending
  wave: 3

  requirements:
    - "Monitoring Agent extends ObservableAgent"
    - "Log health checks as validation entries"
    - "Log anomalies as discovery entries"
    - "Log alerts as error with severity levels"
    - "Log overall health status as phase completion"

  file_impacts:
    - path: "server/monitoring/monitoring-agent.ts"
      action: UPDATE
    - path: "server/agents/observable-agent.ts"
      action: READ

  gotchas:
    - "Severity levels: info, warning, error, critical"
    - "Anomaly detection should not block health check completion"

  validation:
    command: "npx tsc --noEmit server/monitoring/monitoring-agent.ts"
    expected: "exit code 0"

  depends_on: ["OBS-101"]

# ==============================================================================
# WAVE 4: Build Agent Extended Integration
# ==============================================================================

- id: OBS-103
  title: "Integrate Build Agent Message Loop"
  phase: api
  action: UPDATE
  file: "coding-loops/agents/build_agent_worker.py"
  status: pending
  wave: 4

  requirements:
    - "Wrap Claude SDK message loop to capture all tool uses"
    - "Call log_tool_start BEFORE tool execution"
    - "Call log_tool_end AFTER tool execution"
    - "Call log_tool_blocked for security-blocked commands"
    - "Log exceptions with tool context"

  file_impacts:
    - path: "coding-loops/agents/build_agent_worker.py"
      action: UPDATE

  gotchas:
    - "ToolUseBlock has id, name, input attributes"
    - "Preserve tool_use_id across start/end calls"
    - "Truncate large inputs in summary"

  validation:
    command: 'python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print(''OK'')"'
    expected: "exit code 0, stdout contains 'OK'"

  depends_on: ["OBS-102"]

# ------------------------------------------------------------------------------

- id: OBS-104
  title: "Integrate Build Agent Validation Phase"
  phase: api
  action: UPDATE
  file: "coding-loops/agents/build_agent_worker.py"
  status: pending
  wave: 4

  requirements:
    - "Use AssertionRecorder for PIV Validate phase"
    - "Create assertion chains for each task validation"
    - "File assertions match task action type (CREATE/UPDATE/DELETE)"
    - "TypeScript compilation checked for .ts/.tsx files"
    - "Support custom validation commands from task definition"
    - "Chain result includes pass/fail counts"

  file_impacts:
    - path: "coding-loops/agents/build_agent_worker.py"
      action: UPDATE

  gotchas:
    - "End assertion chain even if assertions fail"
    - "Log phase_end with chain result status"

  validation:
    command: 'python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print(''OK'')"'
    expected: "exit code 0, stdout contains 'OK'"

  depends_on: ["OBS-102"]
```

---

## Execution Order Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3 EXECUTION WAVES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WAVE 1 (Parallel)                                                       │
│  ─────────────────                                                       │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │      OBS-100        │    │      OBS-110        │                     │
│  │  Python Observable  │    │  TS Observability   │                     │
│  │    Agent Base       │    │     Services        │                     │
│  └─────────┬───────────┘    └──────────┬──────────┘                     │
│            │                           │                                 │
│            ▼                           ▼                                 │
│  WAVE 2                                                                  │
│  ──────                                                                  │
│            │                 ┌─────────────────────┐                     │
│            │                 │      OBS-101        │                     │
│            │                 │  TS ObservableAgent │                     │
│            │                 │     Base Class      │                     │
│            │                 └──────────┬──────────┘                     │
│            │                            │                                │
│            ▼                            ▼                                │
│  WAVE 3 (Parallel)                                                       │
│  ─────────────────                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  OBS-102  │ │  OBS-105  │ │  OBS-106  │ │  OBS-107  │ │  OBS-108  │ │
│  │  Build    │ │  Spec     │ │ Validate  │ │    UX     │ │    SIA    │ │
│  │  Agent    │ │  Agent    │ │  Agent    │ │   Agent   │ │   Agent   │ │
│  └─────┬─────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
│        │                                                                 │
│        │       ┌───────────┐                                             │
│        │       │  OBS-109  │                                             │
│        │       │ Monitoring│                                             │
│        │       │   Agent   │                                             │
│        │       └───────────┘                                             │
│        │                                                                 │
│        ▼                                                                 │
│  WAVE 4 (Sequential on OBS-102)                                          │
│  ──────────────────────────────                                          │
│  ┌───────────┐ ┌───────────┐                                             │
│  │  OBS-103  │ │  OBS-104  │                                             │
│  │  Message  │ │ Validate  │                                             │
│  │   Loop    │ │   Phase   │                                             │
│  └───────────┘ └───────────┘                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Conflict Matrix

| Task A  | Task B  | Same File? | Conflict? | Resolution                           |
| ------- | ------- | ---------- | --------- | ------------------------------------ |
| OBS-100 | OBS-110 | No         | No        | Parallel OK                          |
| OBS-102 | OBS-103 | Yes        | Yes       | Sequential (Wave 4)                  |
| OBS-102 | OBS-104 | Yes        | Yes       | Sequential (Wave 4)                  |
| OBS-103 | OBS-104 | Yes        | Yes       | Can be parallel (different sections) |
| OBS-105 | OBS-106 | No         | No        | Parallel OK                          |
| OBS-105 | OBS-107 | No         | No        | Parallel OK                          |
| OBS-105 | OBS-108 | No         | No        | Parallel OK                          |
| OBS-105 | OBS-109 | No         | No        | Parallel OK                          |

---

## Validation Commands Summary

| Task    | Validation Command                                                                              | Expected     |
| ------- | ----------------------------------------------------------------------------------------------- | ------------ |
| OBS-100 | `python3 -c "from coding_loops.shared.observable_agent import ObservableAgent; print('OK')"`    | exit 0, 'OK' |
| OBS-110 | `npx tsc --noEmit server/services/observability/transcript-writer.ts`                           | exit 0       |
| OBS-101 | `npx tsc --noEmit server/agents/observable-agent.ts`                                            | exit 0       |
| OBS-102 | `python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print('OK')"` | exit 0, 'OK' |
| OBS-103 | `python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print('OK')"` | exit 0, 'OK' |
| OBS-104 | `python3 -c "from coding_loops.agents.build_agent_worker import BuildAgentWorker; print('OK')"` | exit 0, 'OK' |
| OBS-105 | `npx tsc --noEmit agents/specification/core.ts`                                                 | exit 0       |
| OBS-106 | `npx tsc --noEmit agents/validation/orchestrator.ts`                                            | exit 0       |
| OBS-107 | `npx tsc --noEmit agents/ux/orchestrator.ts`                                                    | exit 0       |
| OBS-108 | `npx tsc --noEmit agents/sia/index.ts`                                                          | exit 0       |
| OBS-109 | `npx tsc --noEmit server/monitoring/monitoring-agent.ts`                                        | exit 0       |

---

## E2E Test

**File:** `tests/e2e/test-obs-phase3-integration.py`

**Run:** `python3 tests/e2e/test-obs-phase3-integration.py`

**Pass Criteria:** `ALL PHASE 3 TESTS PASSED`
