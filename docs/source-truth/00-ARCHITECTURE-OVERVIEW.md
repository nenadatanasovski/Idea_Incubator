# Vibe Architecture Overview

**Source-Truth Document Index**  
**Created:** 2026-01-18  
**Status:** Canonical  
**Scope:** Unified system architecture for Vibe platform

---

## Vision

Vibe is a self-evolving platform that transforms ideas into AI-managed SaaS products. The system operates on a single principle: **deterministic by default, AI only where logic cannot**. Human founders maintain strategic control through approval gates, while autonomous agents handle gap detection, proposal generation, and execution. All knowledge—decisions, requirements, code, and context—lives in a unified graph that agents query deterministically, invoking AI only for reasoning, synthesis, and natural language understanding.

---

## System Layers

The architecture consists of three unified layers that form a single coherent system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           LAYER 1: FRAMEWORK                                │
│                    (Principles, Patterns, Contracts)                        │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │ North Star  │  │   Intent    │  │  Proposal   │  │  Approval   │       │
│   │  Structure  │  │   Routing   │  │   Pattern   │  │    Gates    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│   Defines: What the system believes, how it routes, what requires approval │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                           LAYER 2: PIPELINE                                 │
│                   (Orchestration, Loops, Coordination)                      │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │    Ralph    │  │  Proactive  │  │   Message   │  │ Verification│       │
│   │    Loops    │  │    Loop     │  │     Bus     │  │    Gates    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│   Defines: How work flows, how agents coordinate, how state propagates     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                           LAYER 3: EXECUTION                                │
│                    (Agents, Storage, Observability)                         │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  Ideation   │  │    Spec     │  │    Build    │  │     SIA     │       │
│   │    Agent    │  │    Agent    │  │    Agent    │  │    Agent    │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Neo4j     │  │  Postgres   │  │  Langfuse   │  │  Artifacts  │       │
│   │   (Graph)   │  │   (State)   │  │   (Traces)  │  │   (Files)   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│   Defines: Concrete implementations, data stores, specialized agents       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Relationships

- **Framework** defines the rules → **Pipeline** orchestrates execution → **Execution** does the work
- Each layer is independent but connected through well-defined interfaces
- Lower layers never depend on higher layers (strict hierarchy)
- The "coding-loops" system is absorbed into **Layer 2: Pipeline** as the Ralph Loop orchestration pattern

---

## Source-Truth Document Index

All canonical architecture documentation lives in this directory. Documents are numbered for reading order.

| Document | Purpose | Status |
|----------|---------|--------|
| `00-ARCHITECTURE-OVERVIEW.md` | Master index, system vision, layer diagram | ✅ Active |
| `01-CODE-FRAMEWORK-MAP.md` | Mapping existing code to framework components | ✅ Active |
| `02-NEO4J-SCHEMA.md` | Neo4j node/relationship schema (9 block types) | ✅ Active |
| `03-CONSOLIDATED-PLAN.md` | Implementation phases, dependencies, timeline | ✅ Active |
| `04-CODE-AUDIT-CHECKLIST.md` | How to review existing code against ARCH decisions | ✅ Active |
| `05-PHASE1-FOUNDATION.md` | Neo4j + Prisma migration details | ✅ Active |
| `06-PROACTIVE-LOOP-SPEC.md` | Bidirectional loop implementation | ✅ Active |
| `07-NORTH-STAR-SCHEMA.md` | Vision, capabilities, constraints, priorities | 🔲 Planned |
| `08-AGENT-REGISTRY.md` | Agent types, capabilities, lifecycle | 🔲 Planned |

### Related Documents (Outside Source-Truth)

| Location | Purpose |
|----------|---------|
| `../agentic-loop-framework.md` | Original agentic loop design (historical) |
| `../VIBE-DEVELOPMENT-ROADMAP.md` | Implementation task list and phases |
| `../../coding-loops/README.md` | Ralph loop harness operations |
| `../../coding-loops/docs/ARCHITECTURE.md` | Pipeline-layer implementation details |

---

## Key Principles

### 1. Deterministic by Default, AI Where Needed

| Step Type | Deterministic | AI |
|-----------|---------------|-----|
| Receive message | ✅ | |
| Parse intent from natural language | | ✅ |
| Route intent to handler | ✅ | |
| Assemble context from graph | ✅ | |
| Analyze gaps against north star | | ✅ |
| Generate proposals | | ✅ |
| Store proposals | ✅ | |
| Notify human | ✅ | |
| Execute approved work | | ✅ |
| Validate output | ✅ | |
| Persist to graph | ✅ | |

**Result:** ~72% of steps are deterministic. AI handles only: intent detection, gap analysis, proposal generation, and task execution.

### 2. Human in the Loop

- **Proposals require approval** before execution (no auto-execute)
- **North star is human-edited** (agents propose changes, humans decide)
- **Rejection is data** (informs future proposal quality)
- **Escalation is mandatory** when agents are stuck

### 3. Graph-First Knowledge

- All relationships live in Neo4j (decisions → requirements → code → tests)
- Agents query the graph deterministically before reasoning
- Context assembly is a graph traversal, not an AI task
- 15 block types model all knowledge (no migration needed)

### 4. Unified Loop Pattern

All autonomous work follows the Ralph Loop pattern:
1. Load test/task with dependencies met
2. Assemble context from graph
3. Execute with AI agent
4. Validate output deterministically
5. Persist results and update state
6. Repeat until complete or blocked

---

## Core Architecture Decisions

These decisions are **locked** unless explicitly reopened by the founder.

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| `ARCH-001` | **Consolidate to 9 block types** | Cleaner model aligned with framework; migrate from 15 organic types | 2026-02-05 |
| `ARCH-002` | **Use Neo4j for graph storage** | Robust for AI agents, handles complex traversals, battle-tested | 2026-01-18 |
| `ARCH-003` | **Scale target: ~100K nodes** | Small team (~100 ideas), not enterprise scale yet | 2026-01-18 |
| `ARCH-004` | **Absorb coding-loops into unified architecture** | Ralph loops are the Pipeline layer, not a separate system | 2026-01-18 |
| `ARCH-005` | **Framework + Pipeline = layers of same system** | Not separate projects; one coherent architecture | 2026-01-18 |
| `ARCH-006` | **Postgres for operational state** | ACID transactions for tasks, sessions, audit logs | 2026-01-18 |
| `ARCH-007` | **Langfuse for observability** | Trace all agent actions, enable debugging | 2026-01-18 |
| `ARCH-008` | **Pydantic AI for agent framework** | Typed outputs, structured tool use | 2026-01-18 |
| `ARCH-009` | **Ralph loops as Execution Agent tool** | Execution Agent invokes Ralph for coding; other modes for other tasks | 2026-02-05 |
| `ARCH-010` | **Drift detection: on-commit + on-evaluation** | Git hooks catch immediate drift; periodic eval for full alignment | 2026-02-05 |
| `ARCH-011` | **Evidence-grounded scoring with confidence** | Scores include evidence sources + confidence level (high/med/low) | 2026-02-05 |
| `ARCH-012` | **SIA: shared system, two pattern spaces** | One codebase, separate "platform" and "user-apps" pattern domains | 2026-02-05 |
| `ARCH-013` | **Proactive loop: event-driven + daily cron** | Trigger on significant changes; daily fallback ensures analysis | 2026-02-05 |
| `ARCH-014` | **Approval UX: chat-primary, web for complex** | Simple approvals via Telegram; complex proposals link to web view | 2026-02-05 |
| `ARCH-015` | **Multi-loop: parallel with coordination** | Loops run in parallel; message bus + file locking prevents conflicts | 2026-02-05 |
| `ARCH-016` | **Git: branch-per-loop with task checkpoints** | Each loop has branch; tasks are commits; PM triggers merge to main | 2026-02-05 |
| `ARCH-017` | **Debate for proposal validation** | Proposals undergo red-team debate before presenting to human | 2026-02-05 |
| `ARCH-018` | **Architecture proposals as 5th type** | System can propose changes to its own architecture | 2026-02-05 |
| `ARCH-019` | **All 6 entry points supported** | Web UI, CLI, API, Chat, Cron, Git hooks all valid entry points | 2026-02-05 |
| `ARCH-020` | **Notifications via Telegram + all channels** | Primary: Telegram; also support email, CLI, web dashboard | 2026-02-05 |
| `ARCH-021` | **North Star as Neo4j subgraph** | Uses existing block types; queryable via graph traversal | 2026-02-05 |
| `ARCH-022` | **Dimensions as JSON array property** | Many-to-many categorization; flexible without schema change | 2026-02-05 |
| `ARCH-023` | **Auto-debate before proposal presentation** | Red team vets proposals; you see pre-strengthened suggestions | 2026-02-05 |
| `ARCH-024` | **3-tier evidence system** | AI-estimated → Research-backed → Reality-grounded; auto-upgrades | 2026-02-05 |
| `ARCH-025` | **Build order: Neo4j → North Star → Proactive Loop** | Foundation first; everything queries graph | 2026-02-05 |
| `ARCH-026` | **Same architecture for users and platform** | Vibe is "idea #0"; learnings transfer; single system | 2026-02-05 |
| `ARCH-027` | **MVP loop: "decisions lacking evidence"** | First self-evolution loop tests full pipeline with simple task | 2026-02-05 |
| `ARCH-028` | **Proposal batching: theme + max 5** | Group by theme, prioritize by impact, max 5 per notification | 2026-02-05 |
| `ARCH-029` | **Learn from rejections** | Track why (Never/Not now/Bad approach); adapt future proposals | 2026-02-05 |
| `ARCH-030` | **Tiered meta-autonomy** | Auto-approve knowledge; require approval for code/decisions/North Star | 2026-02-05 |
| `ARCH-031` | **Prisma for Postgres operational layer** | Better DX for nested relations, visual tooling, established ecosystem | 2026-02-05 |
| `ARCH-032` | **FastAPI for Python agent coordination** | Internal API for agent-to-agent communication, health checks, job triggers | 2026-02-05 |

### Decision Log Format

Future decisions follow this format:

```markdown
| `ARCH-XXX` | **[Decision]** | [Rationale] | [Date] |
```

Decisions can be:
- **Locked** — Requires explicit founder review to change
- **Provisional** — Open for revision based on implementation learnings
- **Superseded** — Replaced by a newer decision (link to replacement)

---

## The 9 Block Types

The system models all knowledge using 9 block types (ARCH-001). These were consolidated from 15 organic types for clarity.

| # | Block Type | Purpose | Question Answered | Migrates From |
|---|------------|---------|-------------------|---------------|
| 1 | `knowledge` | Verified facts, patterns, insights | "What do we know?" | content, synthesis, pattern |
| 2 | `decision` | Choices made with rationale | "What did we choose?" | decision, option |
| 3 | `assumption` | Unverified beliefs to test | "What do we assume?" | assumption |
| 4 | `question` | Open unknowns, things to investigate | "What don't we know?" | (new) |
| 5 | `requirement` | Constraints, must-haves, acceptance criteria | "What must be true?" | (new) |
| 6 | `task` | Work items, actions to take | "What do we need to do?" | action |
| 7 | `proposal` | Suggested changes awaiting approval | "What might we do?" | (new) |
| 8 | `artifact` | Outputs (code, docs, specs) | "What did we produce?" | (new) |
| 9 | `evidence` | Validation data, proof, measurements | "How do we verify?" | external |

**Removed types:** meta, link (→ graph edges), derived, cycle, placeholder, stakeholder_view, topic (→ dimension tag)

**Kept as dimensions/tags:** topic (problem/solution/market/etc.), abstraction level (vision/strategy/tactic/implementation)

Full schemas are defined in `01-BLOCK-TYPES.md` (planned).

---

## Storage Strategy Summary

| Data Type | Store | Why |
|-----------|-------|-----|
| Knowledge graph (blocks, relationships) | **Neo4j** | Complex traversals, relationship-first queries |
| Operational state (tasks, sessions, users) | **Postgres** | ACID, relational integrity, familiar tooling |
| Traces and observability | **Langfuse** | Purpose-built, query and visualization |
| Artifacts (code, docs, specs) | **Filesystem** | Git-friendly, human-readable, version control |
| Configuration | **JSON files** | Simple, schema-validated, no DB needed |

---

## Pipeline Layer: Coding Loops Integration

The `coding-loops/` system is now formally part of the Pipeline layer:

```
Pipeline Layer
├── Proactive Loop (scheduled gap analysis)
├── Ralph Loops (test-driven development)
│   ├── Loop 1: Critical Path (UFS → Spec → Build)
│   ├── Loop 2: Infrastructure (Auth → Credits → Hosting)
│   └── Loop 3: Polish (Monitoring → E2E → PWA)
├── Message Bus (event coordination)
└── Verification Gates (output validation)
```

### Loop Maturity Levels

| Level | Description | Status |
|-------|-------------|--------|
| L1 | Configurable, queryable | ✅ Done |
| L2 | Orchestrator-ready | 🔲 Planned |
| L3 | Self-healing | 🔲 Planned |
| L4 | Fully autonomous | 🔲 Planned |

---

## Agent Catalog

| Agent | Layer | Purpose | Status |
|-------|-------|---------|--------|
| Intent Agent | Execution | Parse user message → structured intent | Design |
| Ideation Agent | Execution | Guide idea development conversation | ✅ Complete |
| Specification Agent | Execution | Extract requirements from validated idea | 🔲 Planned |
| Build Agent | Execution | Generate code via Ralph loop | 🔲 Planned |
| SIA (Self-Improvement Agent) | Execution | Improve failed task approaches | 🔲 Planned |
| Orchestrator Agent | Pipeline | Route requests, manage agent lifecycle | 🔲 Planned |
| Monitor Agent | Pipeline | Health checks, stuck detection | 🔲 Planned |
| PM Agent | Pipeline | Progress tracking, timeline management | 🔲 Planned |
| Gap Analysis Agent | Framework | Detect north star vs current state gaps | Design |
| Proposal Generator Agent | Framework | Create proposals from gaps | Design |

---

## What This Document Does NOT Cover

This overview intentionally excludes:

- **Implementation code** — See relevant source files
- **API specifications** — See `API-REFERENCE.md` in coding-loops
- **Database migrations** — See `database/` directories
- **Deployment procedures** — See ops documentation
- **UI/UX design** — See frontend specifications

---

## Next Steps

To complete the source-truth documentation:

1. **Create `03-BLOCK-TYPES.md`** — Define schemas for all 9 block types + migration guide
2. **Update `02-NEO4J-SCHEMA.md`** — Align with 9 block types (currently shows 15)
3. **Create `04-RALPH-LOOP-PATTERN.md`** — Formalize the loop pattern from coding-loops
4. **Create `05-NORTH-STAR-SCHEMA.md`** — Vision, capabilities, constraints storage
5. **Create `06-PROPOSAL-LIFECYCLE.md`** — Gap → Proposal → Debate → Approval → Execution
6. **Update `coding-loops/docs/ARCHITECTURE.md`** — Reference this as the parent architecture

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-18 | Initial creation, unified architecture defined | AI Agent |
| 2026-02-05 | Consolidated to 9 block types; added 12 new decisions (ARCH-009 to ARCH-020) | AI Agent (Kai) |
| 2026-02-05 | Added 6 more decisions (ARCH-021 to ARCH-026): North Star, dimensions, debate, evidence, build order | AI Agent (Kai) |
| 2026-02-05 | Added 4 operational decisions (ARCH-027 to ARCH-030): MVP loop, batching, rejections, autonomy tiers | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
