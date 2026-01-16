# Documentation Index & Developer Reference

**Created:** 2026-01-12
**Purpose:** Navigate the documentation system - know what to read and when
**Audience:** Developers implementing or maintaining the Vibe platform

---

## Quick Navigation

```
docs/specs/
├── DOCUMENTATION-INDEX.md          ← YOU ARE HERE
│
├── Agent Specifications/
│   ├── AGENT-SPECIFICATIONS-PIPELINE.md      # Ideation → Task → Build agents
│   └── AGENT-SPECIFICATIONS-INFRASTRUCTURE.md # SIA, Monitor, PM + cross-cutting
│
├── End-to-End Scenarios/
│   ├── E2E-SCENARIOS-CORE.md        # Idea→App, Bug Fix, Stuck Recovery
│   └── E2E-SCENARIOS-ADVANCED.md    # Parallel Agents, Decommission, Knowledge
│
├── Architecture & Planning/
│   ├── AGENT-ARCHITECTURE.md        # Database schemas, system design
│   └── IMPLEMENTATION-PLAN.md       # Development roadmap, milestones
│
├── Feature Specifications/
│   ├── ENGAGEMENT-AND-ORCHESTRATION-UI.md  # UI/UX specifications
│   └── SELF-BUILDING-BOOTSTRAP.md          # Bootstrap process
│
├── observability/                                # Observability & Operations
│   ├── SPEC.md                             # Logging, transcripts, assertions, human review
│   ├── DEVELOPER-BRIEF.md                  # Skeletal structure for implementation planning
│   ├── appendices/
│   │   ├── TYPES.md                        # TypeScript type definitions
│   │   ├── DATABASE.md                     # SQL schema and migrations
│   │   └── EXAMPLES.md                     # JSON/JSONL examples
│   ├── api/
│   │   └── README.md                       # REST and WebSocket API specs
│   ├── data-model/
│   │   ├── README.md                       # ER diagrams and data model docs
│   │   └── PARALLEL-EXECUTION-EXTENSIONS.md # Wave execution tracking
│   ├── ui/
│   │   └── README.md                       # React component specifications
│   └── python/
│       └── README.md                       # Python data producer classes
│
├── Parallel Execution/                      # NEW (2026-01-13)
│   ├── PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md  # 117 tasks, 10 phases
│   ├── task-example-reference.md            # Canonical task format
│   └── TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md # Developer implementation guide (62 items, 8 phases)
│
└── Task Agent Design/
    ├── ../bootstrap/tasks/
    │   └── TAK-TASK-AGENT.md        # Implementation tasks (53 tasks, YAML specs)
    └── ../architecture/
        ├── task-agent-arch.md       # Task Agent architecture
        ├── task-data-model.md       # Database schema for tasks
        ├── task-agent-test-plan.md  # 10 human-in-loop test flows
        └── TASK-AGENT-QUESTIONS.md  # Design decisions Q&A
```

---

## What Should I Read?

### By Role

| If you are...                  | Start with                                              | Then read                            |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------ |
| **New to the project**         | This document → E2E-SCENARIOS-CORE.md                   | AGENT-SPECIFICATIONS-PIPELINE.md     |
| **Building an agent**          | AGENT-SPECIFICATIONS-PIPELINE.md (your agent's section) | INFRASTRUCTURE.md §6 (Questions)     |
| **Working on Task Agent**      | task-agent-arch.md                                      | PIPELINE.md §6, task-data-model.md   |
| **Working on Build Agent**     | PIPELINE.md §5                                          | E2E-SCENARIOS-CORE.md §3             |
| **Working on SIA**             | INFRASTRUCTURE.md §1                                    | E2E-SCENARIOS-ADVANCED.md §6         |
| **Debugging agent issues**     | E2E-SCENARIOS-CORE.md §3 (Stuck Recovery)               | INFRASTRUCTURE.md §2-3 (Monitor, PM) |
| **Adding a new feature**       | E2E-SCENARIOS-ADVANCED.md §4 (Parallel)                 | PIPELINE.md §2 (Routing)             |
| **Reviewing agent work**       | observability/SPEC.md                                   | E2E-SCENARIOS-CORE.md                |
| **Adding logging/tracing**     | observability/SPEC.md §2-4                              | INFRASTRUCTURE.md §2 (Monitor)       |
| **Implementing observability** | observability/DEVELOPER-BRIEF.md                        | observability/SPEC.md (full spec)    |

### By Task

| I need to...                            | Read this                                                |
| --------------------------------------- | -------------------------------------------------------- |
| Understand how ideas become apps        | E2E-SCENARIOS-CORE.md §1                                 |
| Know which agent handles what           | PIPELINE.md §1.1 (Registry), §2.1 (Routing)              |
| Add a new event type                    | PIPELINE.md §2.2 (Subscriptions)                         |
| Understand task priorities              | PIPELINE.md §6.4 (Priority Calculator)                   |
| Add agent questions                     | INFRASTRUCTURE.md §6 (Proactive Questioning)             |
| Query the Knowledge Base                | INFRASTRUCTURE.md §5                                     |
| Handle stuck/failing tasks              | E2E-SCENARIOS-CORE.md §3, INFRASTRUCTURE.md §2-3         |
| Implement parallel execution            | PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md           |
| Decommission a feature                  | E2E-SCENARIOS-ADVANCED.md §5                             |
| Create listless tasks                   | PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md Phase 3   |
| Understand task format                  | task-example-reference.md                                |
| Understand task anatomy (comprehensive) | TASK-ATOMIC-ANATOMY.md                                   |
| Add file impact analysis                | PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md Phase 4   |
| Configure auto-grouping                 | PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md Phase 7   |
| Understand PRD structure                | TASK-ATOMIC-ANATOMY.md §6                                |
| Understand task impacts (CRUD)          | TASK-ATOMIC-ANATOMY.md §3                                |
| Understand task appendices              | TASK-ATOMIC-ANATOMY.md §5                                |
| Task Agent decision interfaces          | TASK-ATOMIC-ANATOMY.md §10                               |
| Implement Task System V2                | TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md                    |
| Database migrations for new entities    | TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md Phase 1            |
| Create PRD services                     | TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md Phase 3            |
| Build cascade system                    | TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md IMPL-3.7, IMPL-3.8 |
| Understand unified transcripts          | observability/SPEC.md §2                                 |
| Add skill tracing                       | observability/SPEC.md §4                                 |
| Implement assertion-based validation    | observability/SPEC.md §6                                 |
| Expose Message Bus to humans            | observability/SPEC.md §5                                 |
| Build execution review UI               | observability/SPEC.md §7                                 |
| Review Build Agent work                 | observability/SPEC.md §7.1                               |
| Plan observability implementation       | observability/DEVELOPER-BRIEF.md                         |

---

## Document Summaries

### AGENT-SPECIFICATIONS-PIPELINE.md

**When:** Building or modifying core pipeline agents
**Contains:**

- §1: Agent Registry, lifecycle states, **terminology definitions**
- §2: Routing logic, event subscriptions
- §3: Ideation Agent (user conversations → idea candidates)
- §4: Specification Agent **(⚠️ DEPRECATED - see §6)**
- §5: Build Agent (task execution, PIV loop)
- §6: Task Agent (orchestration, Telegram, spec generation)

**Key Concepts:**

- Phase 1 = Spec generation (triggered by `ideation.completed`)
- Phase 2 = Ongoing orchestration (always-on)
- `tasklist.generated` = spec/tasks created, pending approval
- `tasklist.ready` = approved, Build Agent can start

---

### AGENT-SPECIFICATIONS-INFRASTRUCTURE.md

**When:** Working on support agents or cross-cutting concerns
**Contains:**

- §1: SIA (Self-Improvement Agent) - learning from outcomes
- §2: Monitor Agent - health checks, stuck detection
- §3: PM Agent - conflict resolution, coordination
- §4: Context Loading Strategies - lazy vs eager loading
- §5: Knowledge Base Integration - gotchas, patterns
- §6: Proactive Questioning - question YAML specs per agent

**Key Concepts:**

- Responsibility hierarchy: Monitor → PM → Task → SIA
- SIA spawns only after 3+ failures on same pattern
- Questions have priorities: blocking (100) > approval (80) > decision (40)

---

### E2E-SCENARIOS-CORE.md

**When:** Understanding the main flows, debugging issues
**Contains:**

- §1: Idea → Working App (full pipeline walkthrough)
- §2: Bug Fix Flow (quick spec → quick build)
- §3: Stuck Agent Recovery (detection → resolution)

**Use For:**

- Tracing data through the system
- Understanding database writes at each step
- Seeing exact event payloads

---

### E2E-SCENARIOS-ADVANCED.md

**When:** Handling complex scenarios
**Contains:**

- §4: Parallel Agents (file locking, conflict resolution)
- §5: Feature Decommission (safe removal workflow)
- §6: Knowledge Propagation (how gotchas prevent future failures)

**Use For:**

- Understanding multi-loop coordination
- Safe deletion patterns
- How the system learns over time

---

### task-agent-arch.md (in docs/architecture/)

**When:** Deep-diving into Task Agent implementation
**Contains:**

- Detailed architecture diagrams
- State machine definitions
- Telegram integration details
- Priority calculation formulas

---

### task-data-model.md (in docs/architecture/)

**When:** Working with task-related database tables
**Contains:**

- `task_lists` schema
- `tasks` schema
- `task_list_items` schema
- `task_relationships` schema (11 relationship types)

---

### PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md (NEW)

**When:** Implementing parallel execution, listless tasks, auto-grouping
**Contains:**

- 10 implementation phases (117 tasks total)
- Database migrations (070-073)
- Evaluation Queue system
- File impact analysis
- Parallelism engine with SQL queries
- Build Agent orchestration (1:1 agent:task model)
- Auto-grouping with configurable weights
- Circular dependency prevention
- UI components (Quick Add, Kanban, Parallelism View)
- Telegram commands (/newtask, natural language)
- E2E scenarios

**Key Concepts:**

- **Listless Tasks:** Tasks can exist without a task list (Evaluation Queue)
- **Flat Task IDs:** UUID + display_id (no hierarchical limits)
- **1:1 Agent:Task:** Each Build Agent handles exactly one task
- **Unlimited Parallelism:** Spawn as many Build Agents as file conflicts allow
- **Proactive Grouping:** Task Agent suggests task list groupings automatically

---

### task-example-reference.md

**When:** Creating or validating task format
**Contains:**

- Complete task format with all fields
- Category reference (16 categories)
- Status reference (8 statuses)
- Relationship type reference (11 types)
- File operation reference (4 operations)
- Minimal task format for quick creation
- Full example task

---

### TASK-ATOMIC-ANATOMY.md (NEW - 2026-01-14)

**When:** Understanding task structure, PRDs, impacts, or appendices
**Audience:** Developers implementing the system + AI agents consuming tasks
**Contains:**

- §1: First Principles - What is a task, Task Agent's role, database as truth
- §2: Core Task Schema - ER diagram, TypeScript interfaces, field definitions
- §3: Task Impact Model - Files/APIs/functions/DB/types with CRUD operations
- §4: Task Relationships - 11 relationship types, versioning cascade logic
- §5: Task Appendices - PRD reference, code context, gotchas, test data
- §6: PRD Integration - PRD schema, hierarchy, visualization model
- §7: Task Creation Pipeline - Instruction intake, questioning style, decomposition
- §8: Effort & Priority Model - Bucket definitions, priority calculation
- §9: Testing Integration - 3-level test framework, requirements by category
- §10: Task Agent Decision Interfaces - Estimation, conflict, atomicity, cascade

**Key Concepts:**

- Tasks are **created by Task Agent**, not users (removes cognitive burden)
- Tasks live in **database**, not files
- **PRDs** are product descriptions that group task lists and tasks
- **Impacts** capture files/APIs/functions/DB/types with CRUD operations
- **Appendices** are optional attachments to brief the Build Agent
- **Versioning** creates new versions; changes may cascade to related tasks
- **auto_approve_reviews** flag on task_lists controls cascade approval

---

### TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md (NEW - 2026-01-14)

**When:** Implementing the Task System V2 features from TASK-ATOMIC-ANATOMY.md
**Audience:** Developers building the system
**Contains:**

- Phase 1: Database Schema (9 migrations)
- Phase 2: TypeScript Types (7 type files)
- Phase 3: Core Services (10 CRUD services)
- Phase 4: Task Agent Services (8 AI/analysis services)
- Phase 5: API Routes (11 route files)
- Phase 6: Telegram Integration (5 command groups)
- Phase 7: UI Components (15 React components)
- Phase 8: Testing & Validation (11 test files)

**Key Features:**

- 62 implementation items with unique IDs (IMPL-X.X)
- Full SQL schemas with indexes and constraints
- Complete TypeScript interface definitions
- Function signatures for all services
- API route tables with HTTP methods
- File checklist (~70 files to create)
- Risk mitigation and rollout strategy

**How to Use:**

1. Follow phases in order (Phase 1 blocks 2-4)
2. Each IMPL item has acceptance criteria
3. Check off items as completed
4. Run verification commands between phases

---

### observability/SPEC.md

**When:** Implementing logging, tracing, or human review capabilities
**Audience:** Developers building observability infrastructure + Human reviewers
**Contains:**

- §1: First Principles - Why observability matters, design decisions
- §2: Unified Transcript Schema - Chronological JSONL format for Build Agent activity
- §3: Tool Use Logging - Every tool invocation with inputs/outputs
- §4: Skill Invocation Logging - Full traces with SKILLS.md file references
- §5: Message Bus Exposure - Human-readable log stream from events
- §6: Assertion-Based Test Validation - Pass/fail with evidence links
- §7: UI Components for Human Review - Dashboards, viewers, modals
- §8: Database Schema - New tables for transcripts, assertions, skill traces
- §9: Log Retention and Archival - Hot/warm/cold storage policies

**Related Files:**

- `observability/DEVELOPER-BRIEF.md` - Implementation guide with phases
- `observability/appendices/TYPES.md` - TypeScript type definitions
- `observability/appendices/DATABASE.md` - SQL schema and migrations
- `observability/appendices/EXAMPLES.md` - JSON/JSONL examples

**Key Concepts:**

- **Unified Transcript**: Single chronological log of all Build Agent activity (JSONL)
- **Tool Use Logging**: Every tool call with inputs, outputs, duration, status
- **Skill Traces**: First-class logging of SKILLS.md invocations with file:line references
- **Assertion Framework**: Pass/fail with evidence links (command output, diffs, API responses)
- **Evidence Linking**: Every assertion links to supporting evidence for human review
- **Message Bus Log**: Human-readable event stream (no SQL needed)

**Design Decisions:**

- API Logging: Structured summaries + SKILLS.md usage (not full prompts)
- Transcript Format: Unified chronological (not separate streams)
- Test Validation: Assertion-based with evidence links
- Skill Logging: Full traces (skills are first-class entities)

---

## Key Data Models

### Tables (New Schema)

```
task_lists          # Grouped collections of tasks
├── tasks           # Individual atomic work units
├── task_list_items # Links tasks to lists (with position)
└── task_relationships # Dependencies between tasks
```

### Tables (Parallel Execution - Migration 070-073)

```
task_file_impacts       # Which files each task affects (CREATE/UPDATE/DELETE/READ)
parallelism_analysis    # Can task A run parallel with task B?
parallel_execution_waves # Groups of tasks that execute together
wave_tasks              # Links tasks to waves
build_agent_instances   # Active Build Agent workers (1:1 with tasks)
grouping_suggestions    # Auto-generated task list suggestions
grouping_criteria_weights # User-configurable grouping weights per project
```

### Tables (Observability - Migration 077)

```
transcript_entries      # Unified transcript of Build Agent activity (JSONL)
skill_traces            # Full traces of SKILLS.md invocations
assertion_results       # Pass/fail with evidence for test validation
assertion_chains        # Ordered assertions per task
message_bus_log         # Human-readable log stream from events
```

### Tables (Legacy - being migrated)

```
specifications      # → Replaced by task_lists
atomic_tasks        # → Replaced by tasks
```

### Event Flow

```
ideation.completed
    │
    ▼
Task Agent Phase 1 (spec generation)
    │
    ▼
tasklist.generated ─────► User reviews in UI
    │
    ▼
tasklist.ready ─────────► Task Agent spawns Build Agents
    │
    ├─────────────────────────────────────────────────────┐
    │                                                      │
    ▼                                                      ▼
task.ready ────────────► Build Agent #1           task.ready ────────────► Build Agent #2
    │                          │                          │
    ▼                          ▼                          ▼
task.started              task.started               task.started
    │                          │                          │
    ▼                          ▼                          ▼
task.completed            task.completed             task.failed
    │                          │                          │
    │                          └──────────────────────────┘
    ▼
Next wave spawns (unblocked tasks)
    │
    ▼
build.completed ────────► SIA reviews
```

### Listless Task Flow (NEW)

```
task.created (no task_list_id)
    │
    ▼
Evaluation Queue (queue='evaluation')
    │
    ▼
Task Agent analyzes (file impacts, relationships, duplicates)
    │
    ▼
grouping.suggested ─────► User reviews suggestion
    │
    ▼
grouping.accepted ──────► Tasks moved to new task list
    │
    ▼
(Standard task list flow continues)
```

---

## Cross-Reference Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT RELATIONSHIPS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PIPELINE.md ◄───────────────────────► INFRASTRUCTURE.md               │
│       │                                        │                         │
│       │ "How agents work"          "Support systems"                    │
│       │                                        │                         │
│       ▼                                        ▼                         │
│   E2E-CORE.md ◄──────────────────────► E2E-ADVANCED.md                 │
│       │                                        │                         │
│       │ "Main flows"                   "Complex scenarios"              │
│       │                                        │                         │
│       └────────────────┬───────────────────────┘                        │
│                        │                                                 │
│                        ▼                                                 │
│              task-agent-arch.md                                         │
│              task-data-model.md                                         │
│                        │                                                 │
│                        │ "Implementation details"                       │
│                        │                                                 │
│                        ▼                                                 │
│              AGENT-ARCHITECTURE.md                                      │
│              IMPLEMENTATION-PLAN.md                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Terminology Quick Reference

| Term                             | Definition                                                                      | Defined In                                                |
| -------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Task**                         | Single atomic unit of work (file + action + requirements)                       | PIPELINE.md §1.3                                          |
| **Task List**                    | Grouped collection of tasks for an idea/feature                                 | PIPELINE.md §1.3                                          |
| **Execution**                    | Single Build Agent run processing a task list                                   | PIPELINE.md §1.3                                          |
| **Loop**                         | Build Agent instance (e.g., loop-1-critical-path)                               | PIPELINE.md §1.3                                          |
| **Phase 1**                      | Task Agent's spec generation phase                                              | PIPELINE.md §6                                            |
| **Phase 2**                      | Task Agent's orchestration phase                                                | PIPELINE.md §6                                            |
| **Gotcha**                       | Known mistake to avoid (from Knowledge Base)                                    | INFRASTRUCTURE.md §5                                      |
| **Pattern**                      | Reusable approach (from Knowledge Base)                                         | INFRASTRUCTURE.md §5                                      |
| **PIV Loop**                     | Prime → Iterate → Validate (Build Agent workflow)                               | PIPELINE.md §5                                            |
| **Listless Task**                | Task without a task_list_id, stored in Evaluation Queue                         | PARALLEL-PLAN Phase 3                                     |
| **Evaluation Queue**             | Staging area for ungrouped tasks                                                | PARALLEL-PLAN Phase 3                                     |
| **Display ID**                   | Human-readable task ID (e.g., TU-PROJ-FEA-042)                                  | task-example-reference.md                                 |
| **File Impact**                  | Estimated file changes (CREATE/UPDATE/DELETE/READ)                              | PARALLEL-PLAN Phase 4                                     |
| **Execution Wave**               | Group of tasks that can run in parallel                                         | PARALLEL-PLAN Phase 5                                     |
| **Build Agent Instance**         | Single agent handling exactly one task                                          | PARALLEL-PLAN Phase 6                                     |
| **Auto-Grouping**                | Task Agent suggests task list groupings                                         | PARALLEL-PLAN Phase 7                                     |
| **PRD**                          | Product Requirements Document - product description from functional perspective | TASK-ATOMIC-ANATOMY §6                                    |
| **Task Impact**                  | What a task touches: files, APIs, functions, DB, types with CRUD                | TASK-ATOMIC-ANATOMY §3                                    |
| **Task Appendix**                | Optional attachment to brief agent (PRD ref, code context, gotchas)             | TASK-ATOMIC-ANATOMY §5                                    |
| **Cascade**                      | Version changes propagating to related tasks                                    | TASK-ATOMIC-ANATOMY §4.4                                  |
| **auto_approve_reviews**         | Task list flag for automatic cascade approval                                   | TASK-ATOMIC-ANATOMY §4.4                                  |
| **Atomicity**                    | Task property: single concern, bounded files, testable, independent             | TASK-ATOMIC-ANATOMY §7.4                                  |
| **Unified Transcript**           | Single chronological log of Build Agent activity (JSONL format)                 | observability/SPEC.md §2                                  |
| **Tool Use**                     | Record of single tool invocation with inputs, outputs, status                   | observability/SPEC.md §3                                  |
| **Skill Trace**                  | First-class log of SKILLS.md invocation with file:line references               | observability/SPEC.md §4                                  |
| **Assertion**                    | Pass/fail test result with evidence links for human review                      | observability/SPEC.md §6                                  |
| **Assertion Chain**              | Ordered sequence of assertions for validating a task                            | observability/SPEC.md §6.2                                |
| **Evidence**                     | Supporting data for assertion (command output, diffs, API responses)            | observability/SPEC.md §6.1                                |
| **Message Bus Log**              | Human-readable event stream from Message Bus events                             | observability/SPEC.md §5                                  |
| **Transcript Entry**             | Single line in unified transcript (JSONL object)                                | observability/SPEC.md §2.1                                |
| **Wave Statistics**              | Pre-computed wave metrics (task counts, pass rates, timing)                     | observability/data-model/PARALLEL-EXECUTION-EXTENSIONS.md |
| **Concurrent Execution Session** | Period when multiple task lists execute simultaneously                          | observability/data-model/PARALLEL-EXECUTION-EXTENSIONS.md |
| **Wave Progress View**           | Dashboard view showing wave timeline and progress                               | observability/data-model/PARALLEL-EXECUTION-EXTENSIONS.md |
| **Active Agents View**           | Real-time view of running Build Agents with task context                        | observability/data-model/PARALLEL-EXECUTION-EXTENSIONS.md |

---

## Common Scenarios

### "How do I add a new agent?"

1. Add to Agent Registry: `PIPELINE.md §1.1`
2. Define routing rules: `PIPELINE.md §2.1`
3. Add event subscriptions: `PIPELINE.md §2.2`
4. Define questions: `INFRASTRUCTURE.md §6`
5. Add context loading strategy: `INFRASTRUCTURE.md §4`

### "How do I debug why a task isn't running?"

1. Check task status in DB: `task-data-model.md`
2. Check dependencies: `PIPELINE.md §6.8` (relationship types)
3. Check for blocks: `E2E-CORE.md §3` (stuck recovery)
4. Check Monitor alerts: `INFRASTRUCTURE.md §2`

### "How do I understand the data flow for X?"

1. Start with E2E scenario that matches your case
2. Follow the numbered steps
3. Note the DATABASE WRITES and EVENTS
4. Cross-reference with agent specs for implementation details

### "How do I create a task without a task list?"

1. UI: Click "Quick Add" button, or add from Evaluation Queue lane
2. Telegram: Use `/newtask <description>` or natural language
3. API: POST /api/tasks (without task_list_id)
4. Task appears in Evaluation Queue with status='evaluating'
5. Task Agent analyzes and suggests groupings
6. Read: PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md Phase 3

### "How do I configure parallel execution?"

1. Check file impacts: `task_file_impacts` table
2. View parallelism analysis: `parallelism_analysis` table
3. Configure grouping weights: `grouping_criteria_weights` table
4. Monitor Build Agents: `build_agent_instances` table
5. Read: PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md Phases 4-6

### "How do I review Build Agent work?"

1. Open Execution Review Dashboard: `/api/executions/{id}/review`
2. Check assertions summary (pass rate, failures)
3. Expand failed assertions to see evidence
4. Review unified transcript for execution flow
5. Check skill traces for SKILLS.md usage
6. Read: observability/SPEC.md §7

### "How do I debug why a Build Agent failed?"

1. Get execution ID from `build_agent_instances` table
2. Read unified transcript: `transcripts/{execution_id}/unified.jsonl`
3. Check assertions: `transcripts/{execution_id}/assertions.json`
4. Look at diffs: `transcripts/{execution_id}/diffs/`
5. Query message bus log: `GET /api/logs/message-bus?executionId={id}`
6. Read: observability/SPEC.md §2-6

---

## Version History

| Date       | Change                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| 2026-01-12 | Initial creation from file split                                                  |
| 2026-01-12 | Added Task Agent Phase 1/Phase 2 clarification                                    |
| 2026-01-12 | Standardized table names (tasks, not atomic_tasks)                                |
| 2026-01-12 | Renamed spec.generated → tasklist.generated                                       |
| 2026-01-13 | Added Parallel Execution section with implementation plan                         |
| 2026-01-13 | Added task-example-reference.md (canonical task format)                           |
| 2026-01-13 | Added PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md (117 tasks)                  |
| 2026-01-14 | Added TASK-ATOMIC-ANATOMY.md (comprehensive task structure, PRDs, impacts)        |
| 2026-01-14 | Added TASK-SYSTEM-V2-IMPLEMENTATION-PLAN.md (62 items, 8 phases, developer guide) |
| 2026-01-15 | Added observability/ folder (SPEC.md, DEVELOPER-BRIEF.md, appendices/)            |
| 2026-01-16 | Added observability subfolders: api/, data-model/, ui/, python/                   |
| 2026-01-16 | Created data-model/PARALLEL-EXECUTION-EXTENSIONS.md (wave stats, concurrent exec) |
| 2026-01-16 | Extracted UI section from SPEC.md to ui/README.md (comprehensive UI spec)         |

---

_This document is the starting point. When in doubt, start here._
