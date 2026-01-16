# Observability System Specification

> **Location:** `docs/specs/observability/SPEC.md`
> **Purpose:** Master reference for agent observability infrastructure
> **Audience:** Developers implementing and maintaining agents

---

## 1. First Principles: Why This System Exists

### 1.1 The Core Problem

The system generates thousands of events from multiple sources - agents, Telegram bots, scripts, webhooks, and user interactions. Without unified observability:

- **Humans cannot verify**: "Did the agent actually do what it claimed?"
- **Debugging is impossible**: "Why did task T-042 fail at 3am?"
- **Trust cannot be established**: "Should I deploy this agent-generated code?"
- **Cross-channel correlation is lost**: "What happened before that Telegram error?"
- **System-wide visibility is fragmented**: Events from different sources live in silos

### 1.2 The Solution: Unified Event-Agnostic Observability

Every system event - regardless of source - must flow through a unified observability layer. This system implements:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  UNIFIED EVENT-AGNOSTIC DATA FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   EVENT SOURCES          DATABASE            QUERIES           UI       │
│   ─────────────          (SQLite)            (SQL/API)         (React)  │
│                                                                         │
│   ┌──────────┐                                                          │
│   │ AGENTS   │──┐                                                       │
│   │(Build,   │  │       ┌──────────┐        ┌──────────┐     ┌────────┐ │
│   │Spec,UX)  │  │       │transcript│ ◄───── │V001-V007 │ ──► │Timeline│ │
│   └──────────┘  │       │_entries  │        │Validation│     │        │ │
│                 │       └──────────┘        └──────────┘     └────────┘ │
│   ┌──────────┐  │                                                       │
│   │ TELEGRAM │  │       ┌──────────┐        ┌──────────┐     ┌────────┐ │
│   │(Messages,│──┼──────►│tool_uses │ ◄───── │T001-T006 │ ──► │HeatMap │ │
│   │Commands) │  │       │          │        │Troubleshoot    │        │ │
│   └──────────┘  │       └──────────┘        └──────────┘     └────────┘ │
│                 │                                                       │
│   ┌──────────┐  │       ┌──────────┐        ┌──────────┐     ┌────────┐ │
│   │ SCRIPTS  │──┤       │skill_    │ ◄───── │I001-I007 │ ──► │FlowDia │ │
│   │(CLI,Cron)│  │       │traces    │        │Investigate│    │gram    │ │
│   └──────────┘  │       └──────────┘        └──────────┘     └────────┘ │
│                 │                                                       │
│   ┌──────────┐  │       ┌──────────┐        ┌──────────┐     ┌────────┐ │
│   │ WEBHOOKS │──┤       │assertion_│ ◄───── │P001-P007 │ ──► │Spark   │ │
│   │(API,Ext) │  │       │results   │        │Parallel  │     │lines   │ │
│   └──────────┘  │       └──────────┘        └──────────┘     └────────┘ │
│                 │                                                       │
│   ┌──────────┐  │       ┌──────────┐        ┌──────────┐     ┌────────┐ │
│   │ SYSTEM   │──┘       │message_  │ ◄───── │C001-C006 │ ──► │Event   │ │
│   │(Server)  │          │bus_log   │        │Cross-src │     │Stream  │ │
│   └──────────┘          └──────────┘        └──────────┘     └────────┘ │
│                                                                         │
│   ANY SOURCE         UNIFIED STORAGE     UNIFIED QUERIES   HUMAN VIEW  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

| Principle        | Implementation                                                   |
| ---------------- | ---------------------------------------------------------------- |
| **Source-Aware** | Every event declares its source (agent, telegram, script, etc.)  |
| **Complete**     | Every tool call, message, and system event is logged             |
| **Flexible**     | Execution context optional - non-agent events don't need task_id |
| **Linked**       | Events reference parent context when applicable                  |
| **Queryable**    | 45+ SQL tools cover validation, troubleshooting, cross-source    |
| **Visual**       | UI components surface patterns humans can understand             |
| **Real-time**    | WebSocket streaming for live monitoring across all sources       |

---

## 1.4 Event Source Model

The observability system is **source-agnostic**. Every event declares its origin:

### Event Sources

| Source     | Description                        | Example Events                                     |
| ---------- | ---------------------------------- | -------------------------------------------------- |
| `agent`    | Build, Spec, Validation agents     | `task_start`, `tool_use`, `assertion`              |
| `telegram` | Telegram bot messages and commands | `message_received`, `command_invoked`              |
| `script`   | CLI scripts, cron jobs             | `script_run`, `cli_invoked`, `cron_triggered`      |
| `webhook`  | External webhooks, API calls       | `webhook_received`, `api_called`                   |
| `user`     | User interactions in UI            | `button_clicked`, `form_submitted`, `page_viewed`  |
| `system`   | Server lifecycle events            | `server_started`, `health_check`, `config_changed` |
| `ideation` | Ideation session events            | `session_created`, `artifact_saved`                |
| `custom`   | Extensible for future sources      | Any custom event type                              |

### Entry Types by Source

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTRY TYPES BY SOURCE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AGENT EVENTS (existing)          COMMUNICATION EVENTS (new)                 │
│  ─────────────────────            ─────────────────────────                  │
│  phase_start, phase_end           message_received                           │
│  task_start, task_end             message_sent                               │
│  tool_use                         command_invoked                            │
│  skill_invoke, skill_complete     notification_sent                          │
│  assertion, validation            notification_delivered                     │
│  discovery, error                 notification_failed                        │
│  checkpoint                                                                  │
│  lock_acquire, lock_release       SCRIPT EVENTS (new)                        │
│                                   ───────────────────                        │
│  USER INTERACTION EVENTS (new)    script_started                             │
│  ─────────────────────────────    script_completed                           │
│  button_clicked                   script_failed                              │
│  form_submitted                   cli_invoked                                │
│  page_viewed                      cron_triggered                             │
│  modal_opened                                                                │
│  modal_closed                     WEBHOOK EVENTS (new)                       │
│  session_started                  ────────────────────                       │
│  session_ended                    webhook_received                           │
│                                   api_called                                 │
│  SYSTEM EVENTS (new)              api_responded                              │
│  ───────────────────                                                         │
│  server_started                   IDEATION EVENTS (new)                      │
│  server_stopped                   ────────────────────                       │
│  health_check                     session_created                            │
│  config_changed                   session_resumed                            │
│  db_migration                     artifact_created                           │
│  cache_cleared                    artifact_updated                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entry Categories (Extended)

| Category           | Purpose                      | Sources               |
| ------------------ | ---------------------------- | --------------------- |
| `lifecycle`        | Execution flow events        | agent, script, system |
| `action`           | File/code modifications      | agent                 |
| `validation`       | Tests and assertions         | agent                 |
| `knowledge`        | Learning and discoveries     | agent, ideation       |
| `coordination`     | Locks, waves, handoffs       | agent, system         |
| `communication`    | Messages, notifications      | telegram, system      |
| `user_interaction` | UI events, button clicks     | user                  |
| `external`         | Webhooks, external API calls | webhook               |
| `system`           | Server lifecycle, health     | system                |

### Context Model

Events use **optional context** based on their source:

| Context Field    | Agent Events | Telegram Events | Script Events | System Events |
| ---------------- | ------------ | --------------- | ------------- | ------------- |
| `execution_id`   | Required     | Optional        | Optional      | -             |
| `task_id`        | Optional     | -               | Optional      | -             |
| `wave_id`        | Optional     | -               | -             | -             |
| `instance_id`    | Required     | -               | -             | -             |
| `session_id`     | -            | Optional        | -             | -             |
| `user_id`        | -            | Optional        | -             | -             |
| `chat_id`        | -            | Required        | -             | -             |
| `script_name`    | -            | -               | Required      | -             |
| `correlation_id` | Optional     | Optional        | Optional      | Optional      |

---

## 2. Folder Structure and File Purposes

```
docs/specs/observability/
├── SPEC.md                              # THIS FILE - Master reference
├── DEVELOPER-BRIEF.md                   # Implementation guide with phases
├── AGENT-INTEGRATION-TEMPLATE.md        # HOW TO INTEGRATE ANY AGENT
│
├── data-model/                          # WHAT DATA IS STORED
│   ├── README.md                        # Core entities: transcript, tools, skills, assertions
│   └── PARALLEL-EXECUTION-EXTENSIONS.md # Waves, agents, concurrent sessions
│
├── python/                              # HOW DATA IS PRODUCED
│   └── README.md                        # TranscriptWriter, ToolUseLogger, SkillTracer, AssertionRecorder
│
├── tools/                               # HOW DATA IS QUERIED
│   ├── README.md                        # Tool categories overview
│   ├── SKILLS.md                        # Agent skills (/obs-validate, /obs-errors, etc.)
│   ├── OBSERVABILITY-SQL-TOOLS.md       # 39 SQL tools with implementations
│   └── DATA-MODEL-ALIGNMENT-REVIEW.md   # Schema validation (all issues resolved)
│
├── api/                                 # HOW DATA IS EXPOSED
│   └── README.md                        # REST endpoints + WebSocket streaming
│
├── ui/                                  # HOW DATA IS DISPLAYED
│   └── README.md                        # React components, visualizations, deep linking
│
└── appendices/                          # REFERENCE MATERIAL
    ├── TYPES.md                         # TypeScript/Python type definitions
    ├── DATABASE.md                      # SQL schema, migrations, indexes
    └── EXAMPLES.md                      # JSON/JSONL samples
```

### 2.1 Reading Order for Developers

| Goal                         | Start Here                       | Then Read              |
| ---------------------------- | -------------------------------- | ---------------------- |
| **Understand the system**    | This file (SPEC.md)              | DEVELOPER-BRIEF.md     |
| **Integrate a new agent**    | AGENT-INTEGRATION-TEMPLATE.md    | python/README.md       |
| **Implement data producers** | python/README.md                 | data-model/README.md   |
| **Write queries**            | tools/OBSERVABILITY-SQL-TOOLS.md | tools/SKILLS.md        |
| **Build UI components**      | ui/README.md                     | api/README.md          |
| **Check types/schema**       | appendices/TYPES.md              | appendices/DATABASE.md |

---

## 3. Core Data Model

Six primary entities store all observability data:

### 3.1 Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ENTITY RELATIONSHIPS                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   task_list_execution_runs                                              │
│           │                                                             │
│           │ 1:N                                                         │
│           ▼                                                             │
│   parallel_execution_waves ─────────────────┐                           │
│           │                                  │                          │
│           │ 1:N                              │ wave_id FK               │
│           ▼                                  ▼                          │
│   wave_task_assignments              ┌──────────────┐                   │
│           │                          │ Core Tables  │                   │
│           │ task_id FK               ├──────────────┤                   │
│           ▼                          │              │                   │
│   ┌───────────────────────┐          │ transcript   │                   │
│   │       tasks           │◄─────────│ _entries     │                   │
│   └───────────────────────┘          │              │                   │
│           ▲                          │ tool_uses    │                   │
│           │ task_id FK               │              │                   │
│           │                          │ skill_traces │                   │
│   ┌───────┴───────┐                  │              │                   │
│   │               │                  │ assertion_   │                   │
│   │ build_agent_  │                  │ results      │                   │
│   │ instances     │                  │              │                   │
│   │               │                  │ assertion_   │                   │
│   └───────────────┘                  │ chains       │                   │
│                                      │              │                   │
│                                      │ message_bus_ │                   │
│                                      │ log          │                   │
│                                      └──────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Tables Summary

| Table                | Purpose               | Key Columns                                         | Foreign Keys                         |
| -------------------- | --------------------- | --------------------------------------------------- | ------------------------------------ |
| `transcript_entries` | Unified event log     | `entry_type`, `summary`, `details`                  | `execution_id`, `task_id`, `wave_id` |
| `tool_uses`          | Every tool invocation | `tool`, `input`, `result_status`, `duration_ms`     | `transcript_entry_id`, `wave_id`     |
| `skill_traces`       | Skill invocations     | `skill_name`, `skill_file`, `line_number`, `status` | `execution_id`, `task_id`            |
| `assertion_results`  | Test assertions       | `category`, `result`, `evidence`                    | `chain_id`, `task_id`, `wave_id`     |
| `assertion_chains`   | Grouped assertions    | `overall_result`, `started_at`, `completed_at`      | `task_id`, `execution_id`            |
| `message_bus_log`    | Human-readable events | `event_type`, `human_summary`, `severity`           | `execution_id`, `task_id`            |

### 3.3 Parallel Execution Tables

| Table                           | Purpose              | Key Columns                                            |
| ------------------------------- | -------------------- | ------------------------------------------------------ |
| `parallel_execution_waves`      | Wave tracking        | `wave_number`, `status`, `started_at`, `completed_at`  |
| `wave_task_assignments`         | Task-to-wave mapping | `wave_id`, `task_id`, `status`                         |
| `build_agent_instances`         | Active agents        | `process_id`, `task_id`, `status`, `last_heartbeat_at` |
| `wave_statistics`               | Aggregate metrics    | `task_count`, `duration_ms`, `max_parallel_agents`     |
| `concurrent_execution_sessions` | Multi-list runs      | `session_type`, `status`, `total_waves`                |

> **Full Schema:** [appendices/DATABASE.md](./appendices/DATABASE.md)
> **Type Definitions:** [appendices/TYPES.md](./appendices/TYPES.md)

---

## 4. Supported Agent Types

The observability system is **agent-agnostic**. Any agent can integrate with it:

| Agent Type              | Primary Events                                   | Example Use                  |
| ----------------------- | ------------------------------------------------ | ---------------------------- |
| **Build Agent**         | task_start/end, checkpoint, lock_acquire/release | Executing atomic tasks       |
| **Specification Agent** | phase_start/end (analyze, question, generate)    | Generating specs from briefs |
| **Validation Agent**    | validation, assertion                            | Running test suites          |
| **UX Agent**            | phase_start/end, assertion (a11y checks)         | User journey testing         |
| **SIA**                 | discovery (patterns, gotchas)                    | Self-improvement learning    |
| **Monitoring Agent**    | validation, error (alerts)                       | System health monitoring     |
| **Custom Agents**       | Any entry type                                   | Your future agents           |

> **Integration Guide:** See [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md) for the standard pattern.

---

## 5. Data Producers (Python/TypeScript)

Four producer classes run inside agent workers to produce observability data:

### 5.1 Producer Classes

| Class               | File                                        | Responsibility                                     |
| ------------------- | ------------------------------------------- | -------------------------------------------------- |
| `TranscriptWriter`  | `coding-loops/shared/transcript_writer.py`  | Write unified transcript entries to JSONL + SQLite |
| `ToolUseLogger`     | `coding-loops/shared/tool_use_logger.py`    | Log every tool invocation with inputs/outputs      |
| `SkillTracer`       | `coding-loops/shared/skill_tracer.py`       | Trace skill invocations with file:line references  |
| `AssertionRecorder` | `coding-loops/shared/assertion_recorder.py` | Record test assertions with evidence linking       |

### 5.2 Integration Pattern

```python
from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.skill_tracer import SkillTracer
from shared.assertion_recorder import AssertionRecorder

class MyAgent:  # Works for any agent type
    def __init__(self, agent_type: str, execution_id: str, instance_id: str):
        self.agent_type = agent_type
        self.transcript = TranscriptWriter(execution_id, instance_id)
        self.tool_logger = ToolUseLogger(self.transcript)
        self.skill_tracer = SkillTracer(self.transcript, self.tool_logger)
        self.assertions = AssertionRecorder(self.transcript, execution_id)
```

> **Full Template:** See [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md) for complete base class.

### 5.3 What Gets Logged

| Event            | Entry Type                       | Producer          |
| ---------------- | -------------------------------- | ----------------- |
| Phase start/end  | `phase_start`, `phase_end`       | TranscriptWriter  |
| Task start/end   | `task_start`, `task_end`         | TranscriptWriter  |
| Tool invocation  | `tool_use`                       | ToolUseLogger     |
| Skill invocation | `skill_invoke`, `skill_complete` | SkillTracer       |
| Test assertion   | `assertion`                      | AssertionRecorder |
| File lock        | `lock_acquire`, `lock_release`   | TranscriptWriter  |
| Error            | `error`                          | TranscriptWriter  |
| Checkpoint       | `checkpoint`                     | TranscriptWriter  |

> **Full API:** [python/README.md](./python/README.md)

---

## 6. Query Tools (SQL)

39 SQL tools organized into 6 categories for querying observability data:

### 6.1 Tool Categories

| Category               | Tools     | Purpose                                                       |
| ---------------------- | --------- | ------------------------------------------------------------- |
| **Validation**         | V001-V007 | Verify data integrity and completeness                        |
| **Troubleshooting**    | T001-T006 | Find errors, blocked commands, stuck operations               |
| **Investigation**      | I001-I007 | Trace task execution, file modifications, agent communication |
| **Aggregation**        | A001-A006 | Summarize execution metrics, tool usage, skill patterns       |
| **Parallel Execution** | P001-P007 | Monitor waves, agents, bottlenecks, conflicts                 |
| **Anomaly Detection**  | D001-D006 | Identify outliers, performance issues, unusual patterns       |

### 6.2 Key Tools

| Tool ID | Name                 | Use Case                                          |
| ------- | -------------------- | ------------------------------------------------- |
| V001    | Data Completeness    | "Are all transcript entries properly linked?"     |
| T001    | Error Root Cause     | "What caused task T-042 to fail?"                 |
| T002    | Blocked Commands     | "What security-blocked commands occurred?"        |
| I001    | Task Execution Trace | "Show me everything that happened for task T-042" |
| P001    | Wave Status          | "What's the current state of parallel execution?" |
| P002    | Active Agents        | "Which agents are currently running?"             |
| D001    | Duration Outliers    | "Which operations took unusually long?"           |

### 6.3 Agent Skills

10 agent skills wrap the SQL tools for easy invocation:

| Skill                  | SQL Tools Used | Purpose                        |
| ---------------------- | -------------- | ------------------------------ |
| `/obs-validate`        | V001-V007      | Run all validation checks      |
| `/obs-errors`          | T001, T003     | Find errors with root cause    |
| `/obs-blocked`         | T002           | Find security-blocked commands |
| `/obs-stuck`           | T003           | Find incomplete operations     |
| `/obs-task-trace`      | I001, I002     | Trace task execution           |
| `/obs-file-activity`   | I003           | See all file operations        |
| `/obs-summary`         | A001-A004      | Execution summary              |
| `/obs-parallel-health` | P001-P004      | Parallel execution health      |
| `/obs-anomalies`       | D001-D006      | Detect anomalies               |
| `/obs-bottlenecks`     | P003           | Find slowest tasks             |

> **Full SQL Implementations:** [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md)
> **Skill Definitions:** [tools/SKILLS.md](./tools/SKILLS.md)

---

## 7. API Layer

### 7.1 REST Endpoints

| Endpoint                                       | Method | Purpose                      |
| ---------------------------------------------- | ------ | ---------------------------- |
| `/api/observability/executions`                | GET    | List executions with filters |
| `/api/observability/executions/:id`            | GET    | Execution details            |
| `/api/observability/executions/:id/transcript` | GET    | Transcript entries           |
| `/api/observability/executions/:id/tool-uses`  | GET    | Tool uses with filters       |
| `/api/observability/executions/:id/assertions` | GET    | Assertion results            |
| `/api/observability/executions/:id/skills`     | GET    | Skill traces                 |
| `/api/observability/waves/:id`                 | GET    | Wave details                 |
| `/api/observability/agents`                    | GET    | Active agent instances       |
| `/api/observability/validate/:id`              | GET    | Run validation tools         |
| `/api/observability/troubleshoot/:id`          | GET    | Run troubleshooting tools    |

### 7.2 WebSocket Streaming

```
ws://localhost:3001/ws?monitor=observability&execution={id}
```

| Event Type         | Payload         | When Emitted              |
| ------------------ | --------------- | ------------------------- |
| `transcript:entry` | TranscriptEntry | New transcript entry      |
| `tool:start`       | ToolUseStart    | Tool invocation begins    |
| `tool:end`         | ToolUseEnd      | Tool invocation completes |
| `assertion:result` | AssertionResult | Assertion recorded        |
| `wave:status`      | WaveStatus      | Wave status changes       |
| `agent:heartbeat`  | AgentHeartbeat  | Agent reports status      |

> **Full API Spec:** [api/README.md](./api/README.md)

---

## 8. UI Components

### 8.1 Component Hierarchy

```
ObservabilityHub (Container)
├── ExecutionTimeline      # Gantt-style phase/task visualization
├── ToolUseHeatMap         # Activity density by tool type
├── AssertionSparklines    # Pass/fail trends by category
├── SkillFlowDiagram       # Nested tool calls within skills
├── AgentActivityGraph     # Real-time agent status
├── MessageBusLog          # Human-readable event stream
└── EvidenceViewerModal    # Assertion evidence inspection
```

### 8.2 Component Files

| Component             | File                                                            | Data Source          |
| --------------------- | --------------------------------------------------------------- | -------------------- |
| `ObservabilityHub`    | `frontend/src/components/observability/ObservabilityHub.tsx`    | All endpoints        |
| `ExecutionTimeline`   | `frontend/src/components/observability/ExecutionTimeline.tsx`   | `transcript_entries` |
| `ToolUseHeatMap`      | `frontend/src/components/observability/ToolUseHeatMap.tsx`      | `tool_uses`          |
| `AssertionSparklines` | `frontend/src/components/observability/AssertionSparklines.tsx` | `assertion_results`  |
| `SkillFlowDiagram`    | `frontend/src/components/observability/SkillFlowDiagram.tsx`    | `skill_traces`       |
| `AgentActivityGraph`  | `frontend/src/components/observability/AgentActivityGraph.tsx`  | WebSocket            |
| `EvidenceViewerModal` | `frontend/src/components/observability/EvidenceViewerModal.tsx` | `assertion_results`  |

### 8.3 Deep Linking Schema

Every entity is addressable via URL:

| Entity    | URL Pattern                                     | Example                                         |
| --------- | ----------------------------------------------- | ----------------------------------------------- |
| Execution | `/observability/exec/{id}`                      | `/observability/exec/exec-123`                  |
| Task      | `/observability/exec/{id}/task/{taskId}`        | `/observability/exec/exec-123/task/T-042`       |
| Tool Use  | `/observability/exec/{id}/tool/{toolId}`        | `/observability/exec/exec-123/tool/tu-789`      |
| Assertion | `/observability/exec/{id}/assertion/{assertId}` | `/observability/exec/exec-123/assertion/ar-456` |
| Wave      | `/observability/exec/{id}/wave/{waveNum}`       | `/observability/exec/exec-123/wave/3`           |
| Agent     | `/observability/agent/{instanceId}`             | `/observability/agent/agent-001`                |

> **Full UI Spec:** [ui/README.md](./ui/README.md)

---

## 9. Database Migrations

### 9.1 Migration Files

| Migration | File                                                           | Purpose                                                                                                        |
| --------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **087**   | `database/migrations/087_observability_schema.sql`             | Core tables: transcript_entries, tool_uses, skill_traces, assertion_results, assertion_chains, message_bus_log |
| **088**   | `database/migrations/088_parallel_execution_observability.sql` | Parallel execution: wave_statistics, concurrent_execution_sessions, wave_id FKs, dashboard views               |

### 9.2 Database Views

| View                           | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `v_wave_progress`              | Wave completion progress with task counts |
| `v_active_agents`              | Currently running agent instances         |
| `v_wave_tasks`                 | Tasks assigned to each wave               |
| `v_execution_summary`          | High-level execution metrics              |
| `v_concurrent_session_summary` | Multi-list execution summary              |

### 9.3 Running Migrations

```bash
npm run migrate
```

---

## 10. Transcript File Structure

### 10.1 File Locations

```
coding-loops/
├── transcripts/
│   ├── {execution_id}/
│   │   ├── unified.jsonl           # Main transcript (JSONL)
│   │   ├── assertions.json         # All assertions with evidence
│   │   ├── skills-used.json        # Skill invocation summary
│   │   └── diffs/
│   │       ├── {task_id}.diff      # Unified diff per task
│   │       └── combined.diff       # All changes combined
│   └── index.json                  # Index of all executions
│
├── logs/
│   └── message-bus/
│       ├── {date}/
│       │   ├── all.log             # All events
│       │   ├── errors.log          # Errors only
│       │   └── coordination.log    # Locks, conflicts
│       └── latest.log              # Symlink to today
```

### 10.2 Transcript Entry Types

| Type             | When Emitted          | Details                     |
| ---------------- | --------------------- | --------------------------- |
| `phase_start`    | PIV phase begins      | Prime, Iterate, or Validate |
| `phase_end`      | PIV phase ends        | Duration, outcome           |
| `task_start`     | Task execution begins | Task ID, title              |
| `task_end`       | Task execution ends   | Status, duration            |
| `tool_use`       | Tool invoked          | Tool name, input, result    |
| `skill_invoke`   | Skill invoked         | Skill file, line number     |
| `skill_complete` | Skill finished        | Status, duration            |
| `assertion`      | Test assertion        | Category, result, evidence  |
| `error`          | Error occurred        | Message, stack trace        |
| `checkpoint`     | Checkpoint created    | Git commit, files           |
| `lock_acquire`   | File locked           | File path, holder           |
| `lock_release`   | File unlocked         | File path                   |

---

## 11. Log Retention

### 11.1 Retention Policy

| Data Type           | Hot (SQLite) | Warm (Archive) | Cold (Deep Archive) |
| ------------------- | ------------ | -------------- | ------------------- |
| Transcript entries  | 7 days       | 30 days        | 1 year              |
| Tool uses           | 7 days       | 30 days        | 1 year              |
| Skill traces        | 7 days       | 30 days        | 1 year              |
| Assertion results   | 30 days      | 90 days        | 2 years             |
| Message bus log     | 7 days       | 30 days        | 90 days             |
| Execution summaries | Indefinite   | -              | -                   |

### 11.2 Archival Commands

```bash
# Archive old transcripts (run daily)
python3 coding-loops/cli.py archive transcripts --older-than 7d

# Archive old assertions (run weekly)
python3 coding-loops/cli.py archive assertions --older-than 30d

# Clean up archived data (run monthly)
python3 coding-loops/cli.py cleanup archives --older-than 1y
```

---

## 12. Quick Reference

### 12.1 Key Concept Mappings

| Concept                       | Stored In                  | Produced By         | Queried By      | Displayed In          |
| ----------------------------- | -------------------------- | ------------------- | --------------- | --------------------- |
| **What happened?**            | `transcript_entries`       | `TranscriptWriter`  | V001-V003       | `ExecutionTimeline`   |
| **What tools were used?**     | `tool_uses`                | `ToolUseLogger`     | T001-T006       | `ToolUseHeatMap`      |
| **What skills were invoked?** | `skill_traces`             | `SkillTracer`       | I005-I006       | `SkillFlowDiagram`    |
| **Did tests pass?**           | `assertion_results`        | `AssertionRecorder` | V004-V005       | `AssertionSparklines` |
| **What went wrong?**          | `message_bus_log`          | Auto-trigger        | T001, D001-D006 | `MessageBusLog`       |
| **Parallel status?**          | `parallel_execution_waves` | Orchestrator        | P001-P007       | `AgentActivityGraph`  |

### 12.2 Troubleshooting Guide

| Symptom         | Query Tool         | UI Component          | SQL Tool  |
| --------------- | ------------------ | --------------------- | --------- |
| Task failed     | `/obs-errors`      | Timeline + Evidence   | T001      |
| Command blocked | `/obs-blocked`     | ToolUseHeatMap (red)  | T002      |
| Task stuck      | `/obs-stuck`       | Timeline (incomplete) | T003      |
| Slow execution  | `/obs-bottlenecks` | Timeline + Sparklines | P003      |
| Data missing    | `/obs-validate`    | Any (gaps visible)    | V001-V007 |
| Unusual pattern | `/obs-anomalies`   | HeatMap + Sparklines  | D001-D006 |

### 12.3 Implementation Checklist

**Infrastructure (one-time):**

- [ ] Run migrations (087, 088)
- [ ] Deploy API endpoints
- [ ] Connect WebSocket streaming
- [ ] Build UI components
- [ ] Configure log retention

**Per-Agent Integration:**

- [ ] Extend `ObservableAgent` base class (see AGENT-INTEGRATION-TEMPLATE.md)
- [ ] Wire up TranscriptWriter for lifecycle events
- [ ] Wire up ToolUseLogger for all tool invocations
- [ ] Wire up SkillTracer for skill invocations (optional)
- [ ] Wire up AssertionRecorder for test assertions (if applicable)
- [ ] Test with `/obs-validate` skill

---

## 13. Related Documents

| Document                                                                                     | Purpose                            |
| -------------------------------------------------------------------------------------------- | ---------------------------------- |
| [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)                             | **Standard pattern for ANY agent** |
| [DEVELOPER-BRIEF.md](./DEVELOPER-BRIEF.md)                                                   | Implementation guide with phases   |
| [data-model/README.md](./data-model/README.md)                                               | Core entity specifications         |
| [data-model/PARALLEL-EXECUTION-EXTENSIONS.md](./data-model/PARALLEL-EXECUTION-EXTENSIONS.md) | Wave and agent tracking            |
| [python/README.md](./python/README.md)                                                       | Python producer class APIs         |
| [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md)                       | 39 SQL tool implementations        |
| [tools/SKILLS.md](./tools/SKILLS.md)                                                         | Agent skill definitions            |
| [api/README.md](./api/README.md)                                                             | REST and WebSocket specifications  |
| [ui/README.md](./ui/README.md)                                                               | React component specifications     |
| [appendices/TYPES.md](./appendices/TYPES.md)                                                 | TypeScript/Python type definitions |
| [appendices/DATABASE.md](./appendices/DATABASE.md)                                           | SQL schema and migrations          |
| [appendices/EXAMPLES.md](./appendices/EXAMPLES.md)                                           | JSON/JSONL samples                 |

---

## Summary

This observability system provides **complete traceability** of agent execution through:

1. **Data Producers** (Python) - Capture every action as it happens
2. **Data Storage** (SQLite) - Store in linked, queryable tables
3. **Query Tools** (SQL) - 39 tools covering validation, troubleshooting, investigation
4. **API Layer** - REST endpoints + WebSocket streaming
5. **UI Components** - Visual representations for human review

The key insight: **observability is not logging - it's evidence**. Every agent claim ("I created this file", "Tests passed") must be verifiable through the evidence chain.

---

_The best automated systems are the ones humans can understand._
