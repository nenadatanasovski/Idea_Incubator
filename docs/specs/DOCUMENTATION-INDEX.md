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

| If you are... | Start with | Then read |
|---------------|------------|-----------|
| **New to the project** | This document → E2E-SCENARIOS-CORE.md | AGENT-SPECIFICATIONS-PIPELINE.md |
| **Building an agent** | AGENT-SPECIFICATIONS-PIPELINE.md (your agent's section) | INFRASTRUCTURE.md §6 (Questions) |
| **Working on Task Agent** | task-agent-arch.md | PIPELINE.md §6, task-data-model.md |
| **Working on Build Agent** | PIPELINE.md §5 | E2E-SCENARIOS-CORE.md §3 |
| **Working on SIA** | INFRASTRUCTURE.md §1 | E2E-SCENARIOS-ADVANCED.md §6 |
| **Debugging agent issues** | E2E-SCENARIOS-CORE.md §3 (Stuck Recovery) | INFRASTRUCTURE.md §2-3 (Monitor, PM) |
| **Adding a new feature** | E2E-SCENARIOS-ADVANCED.md §4 (Parallel) | PIPELINE.md §2 (Routing) |

### By Task

| I need to... | Read this |
|--------------|-----------|
| Understand how ideas become apps | E2E-SCENARIOS-CORE.md §1 |
| Know which agent handles what | PIPELINE.md §1.1 (Registry), §2.1 (Routing) |
| Add a new event type | PIPELINE.md §2.2 (Subscriptions) |
| Understand task priorities | PIPELINE.md §6.4 (Priority Calculator) |
| Add agent questions | INFRASTRUCTURE.md §6 (Proactive Questioning) |
| Query the Knowledge Base | INFRASTRUCTURE.md §5 |
| Handle stuck/failing tasks | E2E-SCENARIOS-CORE.md §3, INFRASTRUCTURE.md §2-3 |
| Implement parallel execution | E2E-SCENARIOS-ADVANCED.md §4 |
| Decommission a feature | E2E-SCENARIOS-ADVANCED.md §5 |

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

## Key Data Models

### Tables (New Schema)
```
task_lists          # Grouped collections of tasks
├── tasks           # Individual atomic work units
├── task_list_items # Links tasks to lists (with position)
└── task_relationships # Dependencies between tasks
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
tasklist.ready ─────────► Build Agent starts
    │
    ▼
task.started / task.completed / task.failed
    │
    ▼
build.completed ────────► SIA reviews
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

| Term | Definition | Defined In |
|------|------------|------------|
| **Task** | Single atomic unit of work (file + action + requirements) | PIPELINE.md §1.3 |
| **Task List** | Grouped collection of tasks for an idea/feature | PIPELINE.md §1.3 |
| **Execution** | Single Build Agent run processing a task list | PIPELINE.md §1.3 |
| **Loop** | Build Agent instance (e.g., loop-1-critical-path) | PIPELINE.md §1.3 |
| **Phase 1** | Task Agent's spec generation phase | PIPELINE.md §6 |
| **Phase 2** | Task Agent's orchestration phase | PIPELINE.md §6 |
| **Gotcha** | Known mistake to avoid (from Knowledge Base) | INFRASTRUCTURE.md §5 |
| **Pattern** | Reusable approach (from Knowledge Base) | INFRASTRUCTURE.md §5 |
| **PIV Loop** | Prime → Iterate → Validate (Build Agent workflow) | PIPELINE.md §5 |

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

---

## Version History

| Date | Change |
|------|--------|
| 2026-01-12 | Initial creation from file split |
| 2026-01-12 | Added Task Agent Phase 1/Phase 2 clarification |
| 2026-01-12 | Standardized table names (tasks, not atomic_tasks) |
| 2026-01-12 | Renamed spec.generated → tasklist.generated |

---

*This document is the starting point. When in doubt, start here.*
