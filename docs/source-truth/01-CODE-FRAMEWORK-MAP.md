# Code-to-Framework Mapping

> Source of truth for mapping existing code to the Agentic Loop Framework.
> 
> **Version:** 1.0  
> **Last Updated:** 2025-02-05  
> **Related:** `docs/agentic-loop-framework.md`, `coding-loops/20260107-multi-agent-coordination-system-FINAL.md`

---

## Executive Summary

The Idea Incubator codebase has **significant existing implementation** that maps to the Agentic Loop Framework. The core insight: existing components are production-ready but **need orchestration** to become a self-evolving system.

**Current State:** ~35% complete on framework components  
**Key Strength:** Ideation Agent is fully built; Intent classification exists  
**Critical Gap:** No proactive loop, no PM Agent, no verification gate

---

## 1. Framework Component Mapping

### 1.1 Entry Points (Chat as Entry Point)

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Intent Agent (AI)** | ✅ Built | `agents/ideation/intent-classifier.ts` | Uses Haiku 4.5 for semantic classification. Detects: execute_selection, execute_all, question, suggestion, continue_conversation |
| **Intent Router (Deterministic)** | ✅ Built | `agents/ideation/orchestrator.ts` (lines 140-200) | Routes based on `shouldSpawnSubtasks`, `respondWithClaude`, `optionsAreDiscussionTopics` |
| **User Message Handler** | ✅ Built | `agents/ideation/orchestrator.ts:processMessage()` | Full message pipeline with context assembly |

**Code Evidence:**
```typescript
// From intent-classifier.ts - Intent types match framework exactly
intent: "execute_selection" | "execute_all" | "question" | "suggestion" | "continue_conversation"
```

### 1.2 Proactive Improvement Loop

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Scheduled Analysis** | ❌ Not Started | - | No cron/scheduler for proactive analysis |
| **Context Assembly (Deterministic)** | 🟡 Partial | `agents/ideation/graph-state-loader.ts` | Loads memory graph context; needs North Star integration |
| **Gap Analysis Agent (AI)** | ❌ Not Started | - | No automated gap detection |
| **Proposal Generator Agent (AI)** | ❌ Not Started | - | Framework describes; not implemented |
| **Proposal Storage (Deterministic)** | ❌ Not Started | - | No proposals table/system |
| **Human Notification (Deterministic)** | ❌ Not Started | - | No proactive notification system |

### 1.3 Execution Pipeline (Post-Approval)

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Task Creation (Deterministic)** | ✅ Built | `schema/entities/task.ts` | Full task entity with status, priority, phases |
| **Context Assembly (Deterministic)** | ✅ Built | `agents/ideation/idea-context-builder.ts` | 54KB of context assembly logic |
| **Execution Agent (AI)** | 🟡 Partial | `agents/ideation/orchestrator.ts` | Main Claude calls; needs task execution mode |
| **Output Validation (Deterministic)** | 🟡 Partial | `agents/specification/core.ts` | Spec validation exists; needs generalization |
| **State Persistence (Deterministic)** | ✅ Built | `agents/ideation/block-extractor.ts` | Auto-extracts and persists to memory graph |
| **Learning (Deterministic + AI)** | 🟡 Partial | `agents/sia/` | SIA extracts patterns/gotchas; needs feedback loop |

### 1.4 Self-Improvement Agent (SIA)

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Execution Analyzer** | ✅ Built | `agents/sia/execution-analyzer.ts` | Analyzes build executions |
| **Pattern Extractor** | ✅ Built | `agents/sia/pattern-extractor.ts` | Extracts reusable patterns |
| **Gotcha Extractor** | ✅ Built | `agents/sia/gotcha-extractor.ts` | Extracts common mistakes |
| **Knowledge Writer** | ✅ Built | `agents/sia/knowledge-writer.ts` | Writes to knowledge base |
| **CLAUDE.md Updater** | ✅ Built | `agents/sia/claude-md-updater.ts` | Proposes KB entries for promotion |
| **Confidence Tracker** | ✅ Built | `agents/sia/confidence-tracker.ts` | Tracks learning confidence |
| **Observability** | ✅ Built | `agents/sia/index.ts` extends `ObservableAgent` | Full observability integration |

### 1.5 North Star Structure

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Vision Storage** | ❌ Not Started | - | No structured vision nodes |
| **Target Capabilities** | ❌ Not Started | - | No capability tracking |
| **Constraints** | ❌ Not Started | - | No constraint storage |
| **Priorities** | 🟡 Partial | `schema/entities/task.ts` (P1-P4) | Task priorities exist; no system-level |
| **Current State** | 🟡 Partial | `schema/entities/memory-block.ts` | Memory blocks track decisions/patterns |

### 1.6 Infrastructure (From Coding-Loops)

| Framework Component | Status | Existing Code | Notes |
|---------------------|--------|---------------|-------|
| **Message Bus** | ❌ Not Started | - | Coding-loops spec describes; not implemented |
| **Monitor Agent** | ❌ Not Started | - | Health check logic described but not built |
| **PM Agent** | ❌ Not Started | - | Conflict resolution not implemented |
| **Human Interface Agent** | ❌ Not Started | - | No CLI/dashboard for multi-agent |
| **Checkpoint Manager** | ❌ Not Started | - | Git checkpoint strategy described |
| **Budget Manager** | ❌ Not Started | - | Token/time tracking not implemented |
| **Verification Gate** | ❌ Not Started | - | Independent verification not built |
| **Git Manager** | ❌ Not Started | - | Branch-per-loop strategy described |
| **Semantic Analyzer** | ❌ Not Started | - | Cross-agent conflict detection |
| **Knowledge Base** | ✅ Built | `agents/knowledge-base/` | Queries and storage implemented |
| **Regression Monitor** | ❌ Not Started | - | Described in coding-loops |
| **Deadlock Detector** | ❌ Not Started | - | Described in coding-loops |
| **Error Classifier** | ❌ Not Started | - | Described in coding-loops |
| **Degradation Manager** | ❌ Not Started | - | Graceful degradation not implemented |
| **Orphan Cleaner** | ❌ Not Started | - | Described in coding-loops |

---

## 2. Data Model Mapping

### 2.1 Core Entities (Built)

| Entity | File | Framework Mapping |
|--------|------|-------------------|
| `Task` | `schema/entities/task.ts` | Task execution, phases, status |
| `MemoryBlock` | `schema/entities/memory-block.ts` | Knowledge graph nodes, decisions |
| `MemoryLink` | `schema/entities/memory-link.ts` | Graph relationships |
| `Idea` | `schema/entities/idea.ts` | Project/idea context |
| `Project` | `schema/entities/project.ts` | High-level container |

### 2.2 Missing Entities (Need Implementation)

| Entity | Framework Purpose |
|--------|-------------------|
| `Proposal` | Store proactive improvement proposals |
| `NorthStar` | Vision, capabilities, constraints |
| `ApprovalRequest` | Human decision queue |
| `Event` | Message bus event storage |
| `FileLock` | Resource locking |
| `Checkpoint` | Rollback points |
| `BudgetUsage` | Token/time tracking |

---

## 3. Agent Architecture Mapping

### 3.1 Existing Agents

```
agents/
├── ideation/          # ✅ FULLY BUILT - Ideation Agent
│   ├── orchestrator.ts       # Main conversation orchestration
│   ├── intent-classifier.ts  # Intent detection (IS the Intent Agent)
│   ├── block-extractor.ts    # Memory graph extraction
│   ├── signal-extractor.ts   # Signal detection from responses
│   ├── session-manager.ts    # Session state
│   ├── message-store.ts      # Message persistence
│   └── ... (30+ supporting files)
│
├── sia/               # ✅ MOSTLY BUILT - Self-Improvement Agent
│   ├── index.ts              # Observable SIA main class
│   ├── execution-analyzer.ts # Build analysis
│   ├── pattern-extractor.ts  # Pattern learning
│   ├── gotcha-extractor.ts   # Gotcha learning
│   └── knowledge-writer.ts   # KB persistence
│
├── specification/     # 🟡 PARTIAL - Specification Agent
│   ├── core.ts               # Spec generation
│   ├── brief-parser.ts       # Brief parsing
│   ├── task-generator.ts     # Task generation
│   └── gotcha-injector.ts    # Gotcha injection
│
├── knowledge-base/    # ✅ BUILT - Knowledge Base queries
│   ├── index.ts
│   └── queries.ts
│
└── (other agents)     # Various specialized agents
    ├── evaluator.ts
    ├── research.ts
    ├── debate.ts
    └── ...
```

### 3.2 Agent → Framework Role Mapping

| Existing Agent | Framework Role | Integration Status |
|----------------|----------------|-------------------|
| `ideation/orchestrator` | Execution Agent (partial) | Handles chat-based execution |
| `ideation/intent-classifier` | **Intent Agent** | ✅ Complete |
| `sia/index.ts` | Learning component | ✅ Built, needs integration |
| `specification/core.ts` | Task creation pathway | 🟡 Needs proposal flow |
| `server/agents/observable-agent.ts` | Observability base | ✅ All agents extend this |

---

## 4. Coding-Loops Integration

The `coding-loops/20260107-multi-agent-coordination-system-FINAL.md` describes a **parallel execution system** that complements the Agentic Loop Framework.

### 4.1 Key Concepts Mapping

| Coding-Loops Concept | Framework Equivalent | Notes |
|----------------------|---------------------|-------|
| Multiple loops executing | Execution Agents | Parallel task execution |
| Message Bus | Event system | Inter-agent communication |
| Monitor Agent | Drift Detection | Health monitoring |
| PM Agent | Coordination layer | Conflict resolution |
| Verification Gate | Output Validation | Independent checks |
| Knowledge Base | Learning storage | Shared across agents |

### 4.2 Integration Strategy

The coding-loops system should be **layered beneath** the Agentic Loop Framework:

```
┌─────────────────────────────────────────┐
│     Agentic Loop Framework              │
│  (North Star, Gap Analysis, Proposals)  │
├─────────────────────────────────────────┤
│     Multi-Agent Coordination            │
│  (Message Bus, PM, Monitor, etc.)       │
├─────────────────────────────────────────┤
│     Existing Agents                     │
│  (Ideation, SIA, Spec, etc.)            │
└─────────────────────────────────────────┘
```

---

## 5. Gap Analysis

### 5.1 Critical Gaps (Must Have)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **Proactive Loop** | No self-evolution without it | Large | P1 |
| **North Star Storage** | Gaps can't be detected | Medium | P1 |
| **Message Bus** | Agents can't coordinate | Medium | P1 |
| **Verification Gate** | No independent validation | Medium | P2 |

### 5.2 Important Gaps (Should Have)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| PM Agent | No conflict resolution | Medium | P2 |
| Monitor Agent | No health tracking | Small | P2 |
| Human Interface CLI | Manual intervention hard | Medium | P2 |
| Checkpoint Manager | No rollback capability | Small | P3 |

### 5.3 Nice-to-Have Gaps

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Deadlock Detector | Edge case handling | Small | P3 |
| Semantic Analyzer | Advanced conflict detection | Large | P4 |
| Budget Manager | Resource visibility | Small | P3 |

---

## 6. Recommended Build Order

Based on dependencies and framework architecture:

### Phase 1: Foundation (Week 1-2)
1. **North Star Schema** - Store vision, capabilities, constraints
2. **Proposal Entity** - Track improvement proposals
3. **Event Schema** - Message bus foundation

### Phase 2: Core Loop (Week 2-3)
4. **Context Assembly Enhancement** - Add North Star loading
5. **Gap Analysis Agent** - Compare current vs target state
6. **Proposal Generator Agent** - Create structured proposals
7. **Basic Notification** - Alert human of pending proposals

### Phase 3: Coordination (Week 3-4)
8. **Message Bus Implementation** - SQLite-based event system
9. **Monitor Agent** - Health checks, stuck detection
10. **PM Agent** - Conflict resolution, priority management

### Phase 4: Safety (Week 4-5)
11. **Verification Gate** - Independent TypeScript/test validation
12. **Checkpoint Manager** - Git-based rollback
13. **Human Interface CLI** - Status, pause, resume, decide

### Phase 5: Polish (Week 5-6)
14. **Budget Manager** - Token/time tracking
15. **Regression Monitor** - Continuous test monitoring
16. **Error Classifier** - Category-based handling

---

## 7. Key Architectural Decisions

### 7.1 Existing Decisions to Preserve

1. **SQLite as primary database** - Schema entities use Drizzle ORM
2. **Anthropic Claude as LLM** - All agents use claude-sonnet
3. **Observable agents pattern** - All agents extend `ObservableAgent`
4. **Memory graph for context** - Blocks and links for knowledge
5. **Haiku for fast classification** - Intent detection uses Haiku 4.5

### 7.2 New Decisions Needed

1. **Proactive loop scheduling** - Cron vs event-driven?
2. **Proposal approval UX** - Chat-based vs separate UI?
3. **Multi-loop execution** - Truly parallel vs sequential?
4. **Git branch strategy** - Branch-per-task vs branch-per-loop?

---

## 8. File Reference Quick Index

### Entry Point Files
- `agents/ideation/orchestrator.ts` - Main orchestration (62KB)
- `agents/ideation/intent-classifier.ts` - Intent detection (9KB)

### State/Context Files
- `agents/ideation/graph-state-loader.ts` - Context loading (22KB)
- `agents/ideation/idea-context-builder.ts` - Context building (54KB)
- `agents/ideation/block-extractor.ts` - Block extraction (28KB)

### Learning/SIA Files
- `agents/sia/index.ts` - SIA main (10KB)
- `agents/sia/execution-analyzer.ts` - Analysis (9KB)
- `agents/knowledge-base/queries.ts` - KB queries (3KB)

### Schema Files
- `schema/entities/task.ts` - Task entity (4KB)
- `schema/entities/memory-block.ts` - Memory blocks (3KB)

### Framework References
- `docs/agentic-loop-framework.md` - Framework spec
- `coding-loops/20260107-multi-agent-coordination-system-FINAL.md` - Multi-agent spec

---

## Appendix: Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Built | Production-ready, tested |
| 🟡 Partial | Exists but incomplete or needs integration |
| ❌ Not Started | Described in specs but not implemented |

---

*This document should be updated as components are built. Use it to track progress and ensure alignment with the Agentic Loop Framework.*
