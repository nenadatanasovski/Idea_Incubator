# Observability System - Developer Implementation Guide

> **Location:** `docs/specs/observability/DEVELOPER-BRIEF.md`
> **Purpose:** Complete implementation guide with phases, tasks, and checkpoints
> **Time to read:** 15 minutes

---

## What You're Building

A comprehensive observability system that captures every agent action and surfaces it in real-time:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY SYSTEM OVERVIEW                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ANY AGENT                                                                     │
│   (Build, Spec, Validation, UX, SIA, Monitoring, Custom)                       │
│         │                                                                       │
│         ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐              │
│   │ OBSERVABILITY PRODUCERS                                      │              │
│   │ TranscriptWriter → ToolUseLogger → SkillTracer → Assertions │              │
│   └────────────────────────────────┬────────────────────────────┘              │
│                                    │                                            │
│                                    ▼                                            │
│   ┌─────────────────────────────────────────────────────────────┐              │
│   │ SQLITE DATABASE                                              │              │
│   │ transcript_entries | tool_uses | skill_traces | assertions  │              │
│   └────────────────────────────────┬────────────────────────────┘              │
│                                    │                                            │
│                          ┌─────────┴─────────┐                                 │
│                          ▼                   ▼                                 │
│                   ┌────────────┐      ┌────────────┐                           │
│                   │ REST API   │      │ WebSocket  │                           │
│                   │ 39 SQL     │      │ Real-time  │                           │
│                   │ Tools      │      │ Streaming  │                           │
│                   └─────┬──────┘      └──────┬─────┘                           │
│                         │                    │                                  │
│                         └────────┬───────────┘                                  │
│                                  ▼                                              │
│                   ┌──────────────────────────────┐                              │
│                   │ OBSERVABILITY UI             │                              │
│                   │ Timeline | HeatMap | Sparks  │                              │
│                   │ FlowDiagram | ActivityGraph  │                              │
│                   └──────────────────────────────┘                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Documents to Read

| Priority      | Document                                                               | What You'll Learn                         |
| ------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| **1st**       | [SPEC.md](./SPEC.md)                                                   | System overview, data model, architecture |
| **2nd**       | [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)       | How to integrate any agent                |
| **3rd**       | [python/README.md](./python/README.md)                                 | Python producer class APIs                |
| **4th**       | [appendices/DATABASE.md](./appendices/DATABASE.md)                     | SQL schema details                        |
| **Reference** | [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md) | 39 SQL tool implementations               |
| **Reference** | [appendices/TYPES.md](./appendices/TYPES.md)                           | TypeScript/Python types                   |

---

## Implementation Phases

### Phase 1: Database Schema (P0)

**Goal:** Create all observability tables and indexes.

#### Tasks

| ID      | Task                             | File                                                           |
| ------- | -------------------------------- | -------------------------------------------------------------- |
| OBS-001 | Create core observability tables | `database/migrations/087_observability_schema.sql`             |
| OBS-002 | Create parallel execution tables | `database/migrations/088_parallel_execution_observability.sql` |

#### Migration 087: Core Tables

```sql
-- Tables to create:
-- 1. transcript_entries - Unified event log
-- 2. tool_uses - Tool invocation records
-- 3. skill_traces - Skill invocations
-- 4. assertion_results - Test assertions
-- 5. assertion_chains - Grouped assertions
-- 6. message_bus_log - Human-readable events
```

> **Full Schema:** [appendices/DATABASE.md](./appendices/DATABASE.md)

#### Migration 088: Parallel Execution

```sql
-- Tables to create:
-- 1. wave_statistics - Wave aggregate metrics
-- 2. concurrent_execution_sessions - Multi-list runs
-- Plus: wave_id FKs on core tables
-- Plus: Dashboard views (v_wave_progress, v_active_agents, etc.)
```

> **Full Schema:** [data-model/PARALLEL-EXECUTION-EXTENSIONS.md](./data-model/PARALLEL-EXECUTION-EXTENSIONS.md)

#### Checkpoint

```bash
# Run migrations
npm run migrate

# Verify tables exist
sqlite3 database/ideas.db ".tables" | grep transcript_entries
sqlite3 database/ideas.db ".tables" | grep tool_uses
sqlite3 database/ideas.db ".tables" | grep wave_statistics
```

---

### Phase 2: Python Data Producers (P0)

**Goal:** Create the four producer classes that agents use to emit observability data.

#### Tasks

| ID      | Task                                   | File                                          |
| ------- | -------------------------------------- | --------------------------------------------- |
| OBS-003 | Create TranscriptWriter                | `coding-loops/shared/transcript_writer.py`    |
| OBS-004 | Create ToolUseLogger                   | `coding-loops/shared/tool_use_logger.py`      |
| OBS-005 | Create SkillTracer                     | `coding-loops/shared/skill_tracer.py`         |
| OBS-006 | Create AssertionRecorder               | `coding-loops/shared/assertion_recorder.py`   |
| OBS-007 | Create ObservabilitySkills query class | `coding-loops/shared/observability_skills.py` |

#### TranscriptWriter

```python
class TranscriptWriter:
    def __init__(self, execution_id: str, instance_id: str): ...
    def write(self, entry: TranscriptEntry) -> str: ...
    def flush(self) -> None: ...
    def close(self) -> None: ...
```

> **Full API:** [python/README.md](./python/README.md)

#### ToolUseLogger

```python
class ToolUseLogger:
    def __init__(self, transcript_writer: TranscriptWriter): ...
    def log_start(self, tool_use_block: ToolUseBlock) -> str: ...
    def log_end(self, tool_use_id: str, tool_result_block: ToolResultBlock) -> None: ...
    def log_blocked(self, tool_use_id: str, reason: str) -> None: ...
```

#### Checkpoint

```python
# Test producers work
from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger

tw = TranscriptWriter("test-exec", "test-instance")
tw.write({"entry_type": "phase_start", "summary": "Test"})
tw.flush()

# Verify in database
# SELECT * FROM transcript_entries WHERE execution_id = 'test-exec';
```

---

### Phase 3: Agent Integration (P0)

**Goal:** Integrate observability into agents.

#### Per-Agent Integration Steps

For **each agent type**, follow the template in [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md):

1. **Extend `ObservableAgent`** (or implement the interface)
2. **Wire up lifecycle events:** `log_phase_start/end`, `log_task_start/end`
3. **Wire up tool logging:** Wrap Claude SDK message loop
4. **Wire up assertions:** For agents that run tests
5. **Handle errors:** Call `log_error()` in exception handlers
6. **Cleanup:** Call `close()` in finally blocks

#### Example: Build Agent Integration

```python
# coding-loops/agents/build_agent_worker.py

from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.assertion_recorder import AssertionRecorder

class BuildAgentWorker:
    def __init__(self, execution_id: str, instance_id: str):
        self.transcript = TranscriptWriter(execution_id, instance_id)
        self.tool_logger = ToolUseLogger(self.transcript)
        self.assertions = AssertionRecorder(self.transcript, execution_id)

    def execute_task(self, task):
        self.transcript.write({
            "entry_type": "task_start",
            "task_id": task.id,
            "summary": f"Starting: {task.title}"
        })

        chain_id = self.assertions.start_chain(task.id, "Validate task")

        try:
            # Execute task...

            # Run assertions
            self.assertions.assert_file_created(task.id, task.file)
            self.assertions.assert_typescript_compiles(task.id)

        finally:
            self.assertions.end_chain(chain_id)
            self.transcript.write({
                "entry_type": "task_end",
                "task_id": task.id,
                "summary": "Task completed"
            })
```

#### Agents to Integrate

| Agent            | File                                        | Primary Events                      |
| ---------------- | ------------------------------------------- | ----------------------------------- |
| Build Agent      | `coding-loops/agents/build_agent_worker.py` | task_start/end, checkpoint, lock    |
| Spec Agent       | `agents/specification/core.ts`              | phase_start/end (analyze, generate) |
| Validation Agent | `agents/validation/orchestrator.ts`         | validation, assertion               |
| UX Agent         | `agents/ux/orchestrator.ts`                 | phase_start/end, assertion          |
| SIA              | `agents/sia/index.ts`                       | discovery                           |
| Monitoring Agent | `server/monitoring/monitoring-agent.ts`     | validation, error                   |

#### Checkpoint

```bash
# Run an agent and verify data appears
python3 coding-loops/loop-1-critical-path/run_loop.py --test

# Check transcript entries were created
sqlite3 database/ideas.db "SELECT COUNT(*) FROM transcript_entries;"

# Check tool uses were logged
sqlite3 database/ideas.db "SELECT COUNT(*) FROM tool_uses;"
```

---

### Phase 4: TypeScript Types (P1)

**Goal:** Create TypeScript interfaces for API layer.

#### Tasks

| ID      | Task                       | File                            |
| ------- | -------------------------- | ------------------------------- |
| OBS-008 | Create observability types | `server/types/observability.ts` |

#### Types to Create

```typescript
// server/types/observability.ts

export interface TranscriptEntry {
  id: string;
  executionId: string;
  taskId?: string;
  waveId?: string;
  entryType: EntryType;
  category: Category;
  summary: string;
  details: Record<string, unknown>;
  timestamp: string;
  sequence: number;
  durationMs?: number;
}

export type EntryType =
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "tool_use"
  | "skill_invoke"
  | "skill_complete"
  | "validation"
  | "assertion"
  | "discovery"
  | "error"
  | "checkpoint"
  | "lock_acquire"
  | "lock_release";

export type Category =
  | "lifecycle"
  | "action"
  | "validation"
  | "knowledge"
  | "coordination";

// ... see appendices/TYPES.md for full definitions
```

> **Full Types:** [appendices/TYPES.md](./appendices/TYPES.md)

---

### Phase 5: API Routes (P1)

**Goal:** Create REST endpoints for observability data.

#### Tasks

| ID      | Task                           | File                                                       |
| ------- | ------------------------------ | ---------------------------------------------------------- |
| OBS-009 | Create observability routes    | `server/routes/observability.ts`                           |
| OBS-010 | Create cross-reference service | `server/services/observability/cross-reference-service.ts` |

#### Endpoints to Create

| Endpoint                                       | Method | Purpose                   |
| ---------------------------------------------- | ------ | ------------------------- |
| `/api/observability/executions`                | GET    | List executions           |
| `/api/observability/executions/:id`            | GET    | Execution details         |
| `/api/observability/executions/:id/transcript` | GET    | Transcript entries        |
| `/api/observability/executions/:id/tool-uses`  | GET    | Tool uses                 |
| `/api/observability/executions/:id/assertions` | GET    | Assertions                |
| `/api/observability/executions/:id/skills`     | GET    | Skill traces              |
| `/api/observability/waves/:id`                 | GET    | Wave details              |
| `/api/observability/agents`                    | GET    | Active agents             |
| `/api/observability/validate/:id`              | GET    | Run validation tools      |
| `/api/observability/troubleshoot/:id`          | GET    | Run troubleshooting tools |

> **Full API Spec:** [api/README.md](./api/README.md)

#### Register Routes

```typescript
// server/index.ts
import observabilityRoutes from "./routes/observability";
app.use("/api/observability", observabilityRoutes);
```

#### Checkpoint

```bash
# Start server
npm run dev

# Test endpoints
curl http://localhost:3001/api/observability/executions
curl http://localhost:3001/api/observability/executions/test-exec/transcript
```

---

### Phase 6: WebSocket Streaming (P1)

**Goal:** Stream observability events in real-time.

#### Tasks

| ID      | Task                     | File                                       |
| ------- | ------------------------ | ------------------------------------------ |
| OBS-011 | Create WebSocket handler | `server/websocket/observability-stream.ts` |

#### Events to Stream

| Event              | When Emitted              |
| ------------------ | ------------------------- |
| `transcript:entry` | New transcript entry      |
| `tool:start`       | Tool invocation begins    |
| `tool:end`         | Tool invocation completes |
| `assertion:result` | Assertion recorded        |
| `wave:status`      | Wave status changes       |
| `agent:heartbeat`  | Agent reports status      |

#### Connection URL

```
ws://localhost:3001/ws?monitor=observability&execution={id}
```

#### Checkpoint

```javascript
// Test WebSocket in browser console
const ws = new WebSocket("ws://localhost:3001/ws?monitor=observability");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

### Phase 7: React Hooks (P2)

**Goal:** Create frontend data layer.

#### Tasks

| ID      | Task                  | File                                           |
| ------- | --------------------- | ---------------------------------------------- |
| OBS-012 | Create WebSocket hook | `frontend/src/hooks/useObservabilityStream.ts` |
| OBS-013 | Create API hooks      | `frontend/src/hooks/useObservability.ts`       |

#### Hooks to Create

```typescript
// useObservabilityStream.ts
export function useObservabilityStream(executionId?: string) {
  // Returns: { isConnected, events, subscribe, unsubscribe }
}

// useObservability.ts
export function useTranscript(executionId: string) { ... }
export function useToolUses(executionId: string, filters?: ToolUseFilters) { ... }
export function useAssertions(executionId: string) { ... }
export function useSkillTraces(executionId: string) { ... }
```

---

### Phase 8: UI Components (P2)

**Goal:** Build visualization components.

#### Tasks

| ID      | Task                       | File                                                            |
| ------- | -------------------------- | --------------------------------------------------------------- |
| OBS-014 | ObservabilityHub container | `frontend/src/components/observability/ObservabilityHub.tsx`    |
| OBS-015 | ExecutionTimeline          | `frontend/src/components/observability/ExecutionTimeline.tsx`   |
| OBS-016 | ToolUseHeatMap             | `frontend/src/components/observability/ToolUseHeatMap.tsx`      |
| OBS-017 | AssertionSparklines        | `frontend/src/components/observability/AssertionSparklines.tsx` |
| OBS-018 | SkillFlowDiagram           | `frontend/src/components/observability/SkillFlowDiagram.tsx`    |
| OBS-019 | AgentActivityGraph         | `frontend/src/components/observability/AgentActivityGraph.tsx`  |
| OBS-020 | EvidenceViewerModal        | `frontend/src/components/observability/EvidenceViewerModal.tsx` |
| OBS-021 | MessageBusLogViewer        | `frontend/src/components/observability/MessageBusLogViewer.tsx` |

#### Component Hierarchy

```
ObservabilityHub
├── QuickStats (active executions, tool calls/min, pass rate, errors)
├── ViewSelector (Timeline | HeatMap | Sparklines | Flow | Activity)
└── ViewContainer
    ├── ExecutionTimeline (Gantt-style phases/tasks)
    ├── ToolUseHeatMap (activity density grid)
    ├── AssertionSparklines (pass/fail trends)
    ├── SkillFlowDiagram (nested tool calls)
    ├── AgentActivityGraph (real-time status)
    └── MessageBusLog (human-readable events)
```

> **Full UI Spec:** [ui/README.md](./ui/README.md)

#### Checkpoint

```bash
# Start frontend
cd frontend && npm run dev

# Navigate to /observability
# Verify all components render
```

---

### Phase 9: Routing (P2)

**Goal:** Add deep linking support.

#### Tasks

| ID      | Task                     | File                   |
| ------- | ------------------------ | ---------------------- |
| OBS-022 | Add observability routes | `frontend/src/App.tsx` |

#### Routes to Add

| Route                                         | Component        |
| --------------------------------------------- | ---------------- |
| `/observability`                              | ObservabilityHub |
| `/observability/exec/:id`                     | ExecutionDetail  |
| `/observability/exec/:id/task/:taskId`        | TaskDetail       |
| `/observability/exec/:id/tool/:toolId`        | ToolUseDetail    |
| `/observability/exec/:id/assertion/:assertId` | AssertionDetail  |
| `/observability/exec/:id/wave/:waveNum`       | WaveDetail       |
| `/observability/agent/:instanceId`            | AgentDetail      |

---

### Phase 10: Log Retention (P3)

**Goal:** Implement archival and cleanup.

#### Tasks

| ID      | Task                | File                                |
| ------- | ------------------- | ----------------------------------- |
| OBS-023 | Create archival job | `coding-loops/jobs/log_archival.py` |
| OBS-024 | Add CLI commands    | `coding-loops/cli.py`               |

#### Retention Policy

| Data Type           | Hot (SQLite) | Warm (Archive) | Cold (Deep) |
| ------------------- | ------------ | -------------- | ----------- |
| Transcript entries  | 7 days       | 30 days        | 1 year      |
| Tool uses           | 7 days       | 30 days        | 1 year      |
| Skill traces        | 7 days       | 30 days        | 1 year      |
| Assertion results   | 30 days      | 90 days        | 2 years     |
| Message bus log     | 7 days       | 30 days        | 90 days     |
| Execution summaries | Indefinite   | -              | -           |

#### CLI Commands

```bash
# Archive old transcripts (run daily)
python3 coding-loops/cli.py archive transcripts --older-than 7d

# Archive old assertions (run weekly)
python3 coding-loops/cli.py archive assertions --older-than 30d

# Clean up archived data (run monthly)
python3 coding-loops/cli.py cleanup archives --older-than 1y
```

---

## File Location Summary

### Database Layer

| File                                                           | Purpose            |
| -------------------------------------------------------------- | ------------------ |
| `database/migrations/087_observability_schema.sql`             | Core tables        |
| `database/migrations/088_parallel_execution_observability.sql` | Parallel execution |

### Python Layer

| File                                          | Purpose                   |
| --------------------------------------------- | ------------------------- |
| `coding-loops/shared/transcript_writer.py`    | Unified transcript writer |
| `coding-loops/shared/tool_use_logger.py`      | Tool invocation logging   |
| `coding-loops/shared/skill_tracer.py`         | Skill tracing             |
| `coding-loops/shared/assertion_recorder.py`   | Assertion recording       |
| `coding-loops/shared/observability_skills.py` | Query tools (39 SQL)      |
| `coding-loops/jobs/log_archival.py`           | Archival jobs             |

### TypeScript Server Layer

| File                                                       | Purpose               |
| ---------------------------------------------------------- | --------------------- |
| `server/types/observability.ts`                            | TypeScript interfaces |
| `server/routes/observability.ts`                           | REST endpoints        |
| `server/services/observability/cross-reference-service.ts` | Cross-references      |
| `server/websocket/observability-stream.ts`                 | WebSocket handler     |

### React Frontend Layer

| File                                           | Purpose        |
| ---------------------------------------------- | -------------- |
| `frontend/src/hooks/useObservabilityStream.ts` | WebSocket hook |
| `frontend/src/hooks/useObservability.ts`       | API hooks      |
| `frontend/src/components/observability/*.tsx`  | UI components  |

---

## Validation Checkpoints

### Phase 1 Complete

- [ ] All tables created in database
- [ ] All indexes and triggers active
- [ ] Views return data

### Phase 2 Complete

- [ ] `TranscriptWriter.write()` inserts rows
- [ ] `ToolUseLogger.log_start/end()` creates records
- [ ] Unit tests pass for all producers

### Phase 3 Complete

- [ ] Running any agent produces transcript entries
- [ ] Tool uses logged during execution
- [ ] Blocked commands logged with `is_blocked=1`

### Phase 5 Complete

- [ ] `GET /api/observability/executions` returns list
- [ ] Filtering works on all endpoints

### Phase 6 Complete

- [ ] WebSocket connects at `/ws?monitor=observability`
- [ ] Events stream within 100ms of occurrence

### Phase 8 Complete

- [ ] Observability tab visible in Agent Dashboard
- [ ] All visualization components render
- [ ] Real-time updates appear in UI

---

## Key Decisions

| Decision             | Options                     | Recommended |
| -------------------- | --------------------------- | ----------- |
| Charting library     | Chart.js, Recharts, Visx    | Recharts    |
| Flow diagram library | React Flow, Mermaid, custom | React Flow  |
| State management     | React Query, SWR, custom    | React Query |
| JSONL file location  | Local fs, S3                | Local fs    |
| Retention scheduler  | cron, node-schedule         | cron        |

---

## Quick Reference: Task IDs

| Phase                | Task IDs                 | Priority |
| -------------------- | ------------------------ | -------- |
| 1. Database          | OBS-001, OBS-002         | P0       |
| 2. Python Producers  | OBS-003 to OBS-007       | P0       |
| 3. Agent Integration | Per-agent (see template) | P0       |
| 4. TypeScript Types  | OBS-008                  | P1       |
| 5. API Routes        | OBS-009, OBS-010         | P1       |
| 6. WebSocket         | OBS-011                  | P1       |
| 7. React Hooks       | OBS-012, OBS-013         | P2       |
| 8. UI Components     | OBS-014 to OBS-021       | P2       |
| 9. Routing           | OBS-022                  | P2       |
| 10. Log Retention    | OBS-023, OBS-024         | P3       |

---

## Getting Help

| Topic             | Document                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| System overview   | [SPEC.md](./SPEC.md)                                                   |
| Agent integration | [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)       |
| Python APIs       | [python/README.md](./python/README.md)                                 |
| SQL tools         | [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md) |
| TypeScript types  | [appendices/TYPES.md](./appendices/TYPES.md)                           |
| Database schema   | [appendices/DATABASE.md](./appendices/DATABASE.md)                     |
| JSON examples     | [appendices/EXAMPLES.md](./appendices/EXAMPLES.md)                     |
| UI components     | [ui/README.md](./ui/README.md)                                         |

---

_This guide provides the implementation skeleton. The specification documents provide the muscle._
