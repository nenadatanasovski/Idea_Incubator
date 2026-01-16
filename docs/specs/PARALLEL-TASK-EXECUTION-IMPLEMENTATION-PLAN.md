# Parallel Task Execution Implementation Plan

**Created:** 2026-01-13
**Purpose:** Comprehensive implementation plan for automated task grouping, flat task IDs, and parallel execution
**Status:** Ready for Development
**Estimated Effort:** 15-20 development sessions

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Database Schema Evolution](#phase-1-database-schema-evolution)
4. [Phase 2: Task Identity Refactoring](#phase-2-task-identity-refactoring)
5. [Phase 3: Evaluation Queue & Listless Tasks](#phase-3-evaluation-queue--listless-tasks)
6. [Phase 4: File Impact Analysis](#phase-4-file-impact-analysis)
7. [Phase 5: Parallelism Engine](#phase-5-parallelism-engine)
8. [Phase 6: Build Agent Parallelism](#phase-6-build-agent-parallelism)
9. [Phase 7: Auto-Grouping Engine](#phase-7-auto-grouping-engine)
10. [Phase 8: UI Implementation](#phase-8-ui-implementation)
11. [Phase 9: Telegram Integration](#phase-9-telegram-integration)
12. [Phase 10: E2E Testing & Documentation](#phase-10-e2e-testing--documentation)
13. [Reference Documents](#reference-documents)

---

## 1. Executive Summary

### 1.1 Goals

This implementation plan delivers five major capabilities:

| Capability                | Description                                  | Business Value                             |
| ------------------------- | -------------------------------------------- | ------------------------------------------ |
| **Listless Tasks**        | Tasks can exist without being in a task list | Faster idea capture, reduced friction      |
| **Flat Task IDs**         | UUID-based with unlimited relationships      | Flexible task hierarchies, no depth limits |
| **Automated Grouping**    | Task Agent suggests task list groupings      | Reduced manual organization overhead       |
| **File Impact Analysis**  | Pre-execution file conflict detection        | Enables safe parallel execution            |
| **Unlimited Parallelism** | Multiple Build Agents per task list          | Fastest possible task completion           |

### 1.2 Key Design Decisions

| Decision                | Choice                                      | Rationale                                         |
| ----------------------- | ------------------------------------------- | ------------------------------------------------- |
| Task ID Format          | UUID PK + computed `display_id`             | True uniqueness + human readability               |
| Orphan Task Storage     | Evaluation Queue (pseudo-list)              | Clear staging area for ungrouped tasks            |
| Grouping Trigger        | Event-driven (creation + dependency change) | Balance responsiveness and efficiency             |
| File Impact Granularity | File + operation type                       | Optimal conflict detection without AST complexity |
| Build Agent Model       | 1 agent = 1 task, unlimited agents          | Maximum parallelism, simple failure isolation     |
| Circular Dependency     | Proactive prevention + reactive resolution  | Minimize user intervention                        |

### 1.3 Architecture Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER INTERFACES                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   Web UI    │    │  Telegram   │    │    API      │                      │
│  │ Quick Add   │    │ /newtask    │    │ POST /tasks │                      │
│  │ Kanban      │    │ NLP Parse   │    │             │                      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                      │
│         │                  │                  │                              │
│         └──────────────────┼──────────────────┘                              │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TASK AGENT                                   │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │    │
│  │  │  Evaluation   │  │ Auto-Grouping │  │  Parallelism  │            │    │
│  │  │    Queue      │  │    Engine     │  │    Engine     │            │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │    │
│  │  │ Circular Dep  │  │  File Impact  │  │   Priority    │            │    │
│  │  │  Prevention   │  │   Analyzer    │  │  Calculator   │            │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    BUILD AGENT ORCHESTRATOR                          │    │
│  │                                                                      │    │
│  │   Task List A              Task List B              Task List C      │    │
│  │   ┌─────┐ ┌─────┐         ┌─────┐ ┌─────┐         ┌─────┐          │    │
│  │   │ BA1 │ │ BA2 │         │ BA3 │ │ BA4 │         │ BA5 │          │    │
│  │   └─────┘ └─────┘         └─────┘ └─────┘         └─────┘          │    │
│  │                                                                      │    │
│  │   • 1 Build Agent = 1 Task                                          │    │
│  │   • Unlimited Build Agents per Task List                            │    │
│  │   • Multiple Task Lists can execute simultaneously                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### 2.1 Component Inventory

| Component        | Location                                         | Changes Required           |
| ---------------- | ------------------------------------------------ | -------------------------- |
| Task Agent       | `server/services/task-agent/`                    | Major - new engines        |
| Build Agent      | `coding-loops/agents/build_agent.py`             | Major - parallelism        |
| Database         | `database/migrations/`                           | New tables + modifications |
| Types            | `types/task-agent.ts`                            | New interfaces             |
| API Routes       | `server/routes/`                                 | New endpoints              |
| UI Components    | `components/`                                    | Kanban + Quick Add         |
| Telegram Handler | `server/services/task-agent/telegram-handler.ts` | New commands               |

### 2.2 Data Flow: Listless Task Creation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW: LISTLESS TASK → GROUPED EXECUTION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. TASK CREATION (any entry point)                                          │
│     │                                                                        │
│     ├─► UI: Quick Add button                                                │
│     ├─► Telegram: /newtask or natural language                              │
│     └─► API: POST /api/tasks                                                │
│              │                                                               │
│              ▼                                                               │
│  2. TASK STORED IN EVALUATION QUEUE                                          │
│     │                                                                        │
│     │  tasks table:                                                         │
│     │  ┌────────────────────────────────────────────────────────────────┐   │
│     │  │ id: uuid-xxx                                                   │   │
│     │  │ display_id: TU-PROJ-FEA-042                                   │   │
│     │  │ queue: 'evaluation'                                           │   │
│     │  │ status: 'evaluating'                                          │   │
│     │  │ task_list_id: NULL                                            │   │
│     │  └────────────────────────────────────────────────────────────────┘   │
│              │                                                               │
│              ▼                                                               │
│  3. IMMEDIATE ANALYSIS                                                       │
│     │                                                                        │
│     ├─► File Impact Estimation (AI + patterns)                              │
│     ├─► Relationship Detection (similarity + dependencies)                  │
│     ├─► Duplicate Check (embedding similarity)                              │
│     └─► Circular Dependency Validation                                      │
│              │                                                               │
│              ▼                                                               │
│  4. GROUPING SUGGESTION                                                      │
│     │                                                                        │
│     │  Task Agent sends to Telegram:                                        │
│     │  "Found 3 related tasks. Create task list?"                          │
│     │  [Create List] [Keep Separate] [Details]                             │
│              │                                                               │
│              ▼                                                               │
│  5. USER APPROVES GROUPING                                                   │
│     │                                                                        │
│     │  Tasks moved from Evaluation Queue to Task List                       │
│     │  task_list_items records created                                     │
│     │  Parallelism opportunities calculated                                 │
│              │                                                               │
│              ▼                                                               │
│  6. PARALLEL EXECUTION                                                       │
│                                                                              │
│     Task Agent spawns Build Agents:                                         │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Wave 1: T-042, T-043, T-044 (no conflicts) → 3 Build Agents    │    │
│     │ Wave 2: T-045 (depends on T-042) → 1 Build Agent when ready    │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema Evolution

**Sessions:** 2-3
**Priority:** P1 (Foundation)
**Dependencies:** None

### 1.1 Migration 070: Task Identity Refactoring

**File:** `database/migrations/070_task_identity_refactoring.sql`

| Task ID | Description                         | Pass Criteria                     |
| ------- | ----------------------------------- | --------------------------------- |
| PTE-001 | Add `display_id` column to tasks    | Column exists, nullable initially |
| PTE-002 | Add `queue` column to tasks         | ENUM: null, 'evaluation'          |
| PTE-003 | Make `task_list_id` nullable        | Foreign key allows NULL           |
| PTE-004 | Add display_id generation trigger   | Auto-generates on INSERT          |
| PTE-005 | Backfill existing tasks             | All tasks have display_id         |
| PTE-006 | Add unique constraint on display_id | No duplicates allowed             |

### 1.2 Migration 071: File Impact Tracking

**File:** `database/migrations/071_file_impact_tracking.sql`

| Task ID | Description                         | Pass Criteria                 |
| ------- | ----------------------------------- | ----------------------------- |
| PTE-007 | Create `task_file_impacts` table    | Table exists with all columns |
| PTE-008 | Add operation type enum             | CREATE, UPDATE, DELETE, READ  |
| PTE-009 | Add confidence tracking             | 0.0-1.0 scale                 |
| PTE-010 | Add source tracking                 | ai, pattern, user, validated  |
| PTE-011 | Create indexes for conflict queries | Fast file path lookups        |

### 1.3 Migration 072: Parallelism Tracking

**File:** `database/migrations/072_parallelism_tracking.sql`

| Task ID | Description                             | Pass Criteria              |
| ------- | --------------------------------------- | -------------------------- |
| PTE-012 | Create `parallelism_analysis` table     | Stores task pair analysis  |
| PTE-013 | Create `parallel_execution_waves` table | Tracks execution waves     |
| PTE-014 | Create `build_agent_instances` table    | Tracks active Build Agents |
| PTE-015 | Add heartbeat tracking                  | Lock management support    |

### 1.4 Migration 073: Auto-Grouping Support

**File:** `database/migrations/073_auto_grouping_support.sql`

| Task ID | Description                              | Pass Criteria                        |
| ------- | ---------------------------------------- | ------------------------------------ |
| PTE-016 | Create `grouping_suggestions` table      | Stores pending suggestions           |
| PTE-017 | Create `grouping_criteria_weights` table | User-configurable weights            |
| PTE-018 | Add suggestion status tracking           | pending, accepted, rejected, expired |

---

## Phase 2: Task Identity Refactoring

**Sessions:** 1-2
**Priority:** P1
**Dependencies:** Phase 1

### 2.1 TypeScript Types Update

**File:** `types/task-agent.ts`

| Task ID | Description                         | Pass Criteria         |
| ------- | ----------------------------------- | --------------------- |
| PTE-019 | Add `TaskIdentity` interface        | UUID + display_id     |
| PTE-020 | Add `EvaluationQueueTask` type      | Tasks in queue        |
| PTE-021 | Add `FileImpact` interface          | File impact tracking  |
| PTE-022 | Add `ParallelismAnalysis` interface | Pair analysis results |
| PTE-023 | Add `GroupingSuggestion` interface  | Auto-grouping         |
| PTE-024 | Update existing Task interface      | Include new fields    |

### 2.2 Display ID Generator Service

**File:** `server/services/task-agent/display-id-generator.ts`

| Task ID | Description                     | Pass Criteria                |
| ------- | ------------------------------- | ---------------------------- |
| PTE-025 | Implement `generateDisplayId()` | Returns formatted ID         |
| PTE-026 | Implement sequence tracking     | Per-project sequence numbers |
| PTE-027 | Implement category code mapping | All 16 categories mapped     |
| PTE-028 | Add collision handling          | Retry on conflict            |

---

## Phase 3: Evaluation Queue & Listless Tasks

**Sessions:** 2-3
**Priority:** P1
**Dependencies:** Phases 1-2

### 3.1 Evaluation Queue Manager

**File:** `server/services/task-agent/evaluation-queue-manager.ts`

| Task ID | Description                       | Pass Criteria                        |
| ------- | --------------------------------- | ------------------------------------ |
| PTE-029 | Implement `addToQueue()`          | Task created with queue='evaluation' |
| PTE-030 | Implement `getQueuedTasks()`      | Returns tasks in Evaluation Queue    |
| PTE-031 | Implement `moveToTaskList()`      | Removes from queue, adds to list     |
| PTE-032 | Implement `getStaleQueuedTasks()` | Tasks > 3 days old                   |
| PTE-033 | Implement queue notifications     | Daily digest via Telegram            |

### 3.2 Task Creation Service (Updated)

**File:** `server/services/task-agent/task-creation-service.ts`

| Task ID | Description                         | Pass Criteria                     |
| ------- | ----------------------------------- | --------------------------------- |
| PTE-034 | Implement `createListlessTask()`    | Creates task in Evaluation Queue  |
| PTE-035 | Implement `createTaskInList()`      | Creates task directly in list     |
| PTE-036 | Integrate file impact estimation    | Estimated on creation             |
| PTE-037 | Trigger analysis pipeline           | Relationships, duplicates checked |
| PTE-038 | Integrate circular dependency check | Prevents invalid deps             |

### 3.3 Task Analysis Pipeline

**File:** `server/services/task-agent/task-analysis-pipeline.ts`

| Task ID | Description                        | Pass Criteria               |
| ------- | ---------------------------------- | --------------------------- |
| PTE-039 | Implement `analyzeTask()`          | Full analysis on task       |
| PTE-040 | Implement `findRelatedTasks()`     | Embedding similarity search |
| PTE-041 | Implement `detectDuplicates()`     | >0.85 similarity flagged    |
| PTE-042 | Implement `suggestGrouping()`      | Returns GroupingSuggestion  |
| PTE-043 | Implement `validateDependencies()` | Detects circular deps       |

---

## Phase 4: File Impact Analysis

**Sessions:** 2-3
**Priority:** P1
**Dependencies:** Phase 3

### 4.1 File Impact Analyzer

**File:** `server/services/task-agent/file-impact-analyzer.ts`

| Task ID | Description                           | Pass Criteria                   |
| ------- | ------------------------------------- | ------------------------------- |
| PTE-044 | Implement `estimateFileImpacts()`     | AI-based estimation             |
| PTE-045 | Implement `matchHistoricalPatterns()` | Pattern-based estimation        |
| PTE-046 | Implement `mergeEstimates()`          | Combine sources with confidence |
| PTE-047 | Implement `validateFileImpacts()`     | Post-execution validation       |
| PTE-048 | Implement `recordActualImpact()`      | Update with actual results      |

### 4.2 File Conflict Detector

**File:** `server/services/task-agent/file-conflict-detector.ts`

| Task ID | Description                      | Pass Criteria                       |
| ------- | -------------------------------- | ----------------------------------- |
| PTE-049 | Implement `detectConflicts()`    | Returns all conflicts between tasks |
| PTE-050 | Implement conflict type logic    | write-write, write-delete, etc.     |
| PTE-051 | Implement `canRunParallel()`     | Binary check for two tasks          |
| PTE-052 | Implement `getConflictDetails()` | Detailed breakdown                  |

**Conflict Matrix:**

| Task A Op | Task B Op | Conflict? | Reason                            |
| --------- | --------- | --------- | --------------------------------- |
| CREATE    | CREATE    | YES       | Same file cannot be created twice |
| CREATE    | UPDATE    | NO        | Different files                   |
| CREATE    | DELETE    | YES       | Race condition                    |
| CREATE    | READ      | NO        | Safe                              |
| UPDATE    | UPDATE    | YES       | Concurrent modification           |
| UPDATE    | DELETE    | YES       | File may not exist                |
| UPDATE    | READ      | NO        | Safe (read before write)          |
| DELETE    | DELETE    | YES       | Double delete                     |
| DELETE    | READ      | YES       | File may not exist                |
| READ      | READ      | NO        | Safe                              |

---

## Phase 5: Parallelism Engine

**Sessions:** 2-3
**Priority:** P1
**Dependencies:** Phase 4

### 5.1 Parallelism Calculator

**File:** `server/services/task-agent/parallelism-calculator.ts`

| Task ID | Description                      | Pass Criteria                 |
| ------- | -------------------------------- | ----------------------------- |
| PTE-053 | Implement `analyzeParallelism()` | Analyzes all task pairs       |
| PTE-054 | Implement `calculateWaves()`     | Groups into execution waves   |
| PTE-055 | Implement `getMaxParallelism()`  | Returns max concurrent tasks  |
| PTE-056 | Implement `invalidateAnalysis()` | Marks stale when tasks change |
| PTE-057 | Implement caching layer          | Cache with invalidation       |

### 5.2 SQL Queries for Parallelism

**File:** `server/services/task-agent/parallelism-queries.ts`

| Task ID | Description                        | Pass Criteria             |
| ------- | ---------------------------------- | ------------------------- |
| PTE-058 | Query: Find parallel opportunities | Returns task pairs        |
| PTE-059 | Query: Get file conflicts          | Returns conflicting files |
| PTE-060 | Query: Get dependency chain        | Returns transitive deps   |
| PTE-061 | Query: Invalidate stale analyses   | Bulk update               |

**See [SQL Query Reference](./PTE-sql-query-reference.md) for full queries.**

---

## Phase 6: Build Agent Parallelism

**Sessions:** 3-4
**Priority:** P1
**Dependencies:** Phase 5

### 6.1 Build Agent Orchestrator

**File:** `server/services/task-agent/build-agent-orchestrator.ts`

| Task ID | Description                         | Pass Criteria              |
| ------- | ----------------------------------- | -------------------------- |
| PTE-062 | Implement `spawnBuildAgent()`       | Creates new Build Agent    |
| PTE-063 | Implement `assignTaskToAgent()`     | 1:1 task:agent assignment  |
| PTE-064 | Implement `monitorAgents()`         | Health check via heartbeat |
| PTE-065 | Implement `terminateAgent()`        | Clean shutdown             |
| PTE-066 | Implement `handleAgentCompletion()` | Spawn next wave            |
| PTE-067 | Implement `handleAgentFailure()`    | Stop dependents only       |

### 6.2 Build Agent Worker (Python)

**File:** `coding-loops/agents/build_agent_worker.py`

| Task ID | Description                     | Pass Criteria             |
| ------- | ------------------------------- | ------------------------- |
| PTE-068 | Update to single-task execution | One task per agent        |
| PTE-069 | Implement heartbeat reporting   | Regular heartbeats        |
| PTE-070 | Implement file lock checking    | Verify locks before write |
| PTE-071 | Report actual file changes      | Post-execution report     |

---

## Phase 7: Auto-Grouping Engine

**Sessions:** 2-3
**Priority:** P2
**Dependencies:** Phase 5

### 7.1 Auto-Grouping Service

**File:** `server/services/task-agent/auto-grouping-engine.ts`

| Task ID | Description                          | Pass Criteria              |
| ------- | ------------------------------------ | -------------------------- |
| PTE-072 | Implement `analyzeTasks()`           | Scores all ungrouped tasks |
| PTE-073 | Implement `calculateGroupingScore()` | Weighted scoring           |
| PTE-074 | Implement `generateSuggestion()`     | Creates GroupingSuggestion |
| PTE-075 | Implement `handleTrigger()`          | Event-driven analysis      |
| PTE-076 | Implement suggestion expiration      | Auto-expire after 7 days   |

### 7.2 Circular Dependency Prevention

**File:** `server/services/task-agent/circular-dependency-prevention.ts`

| Task ID | Description                        | Pass Criteria                |
| ------- | ---------------------------------- | ---------------------------- |
| PTE-077 | Implement `wouldCreateCycle()`     | Detects before creation      |
| PTE-078 | Implement `detectExistingCycles()` | Finds cycles in graph        |
| PTE-079 | Implement `generateResolution()`   | AI-powered recommendation    |
| PTE-080 | Implement `applyResolution()`      | Removes cycle-causing dep    |
| PTE-081 | Implement near-cycle warning       | Warns when 1 step from cycle |

---

## Phase 8: UI Implementation

**Sessions:** 2-3
**Priority:** P2
**Dependencies:** Phase 3

### 8.1 Quick Add Task Component

**File:** `components/tasks/QuickAddTask.tsx`

| Task ID | Description                   | Pass Criteria          |
| ------- | ----------------------------- | ---------------------- |
| PTE-082 | Create QuickAddTask component | Renders input + button |
| PTE-083 | Implement keyboard shortcut   | Ctrl+Shift+T opens     |
| PTE-084 | Implement API integration     | POST /api/tasks        |
| PTE-085 | Add success/error feedback    | Toast notifications    |

### 8.2 Evaluation Queue Kanban Lane

**File:** `components/kanban/EvaluationQueueLane.tsx`

| Task ID | Description                       | Pass Criteria              |
| ------- | --------------------------------- | -------------------------- |
| PTE-086 | Create EvaluationQueueLane        | Renders as first lane      |
| PTE-087 | Implement task card with analysis | Shows related tasks        |
| PTE-088 | Implement drag-to-list            | Move to task list          |
| PTE-089 | Add grouping suggestion UI        | Accept/reject buttons      |
| PTE-090 | Add stale task indicator          | Visual warning for >3 days |

### 8.3 Parallelism Visualization

**File:** `components/execution/ParallelismView.tsx`

| Task ID | Description                      | Pass Criteria           |
| ------- | -------------------------------- | ----------------------- |
| PTE-091 | Create ParallelismView component | Shows execution waves   |
| PTE-092 | Implement real-time status       | WebSocket updates       |
| PTE-093 | Add swimlane visualization       | Per-task progress       |
| PTE-094 | Show opportunity indicators      | Blue for could-parallel |
| PTE-095 | Add Build Agent status cards     | Per-agent health        |

---

## Phase 9: Telegram Integration

**Sessions:** 2
**Priority:** P2
**Dependencies:** Phase 3

### 9.1 New Telegram Commands

**File:** `server/services/task-agent/telegram-commands/`

| Task ID | Description                            | Pass Criteria            |
| ------- | -------------------------------------- | ------------------------ |
| PTE-096 | Implement `/newtask` command           | Creates listless task    |
| PTE-097 | Implement natural language parsing     | AI parses intent         |
| PTE-098 | Implement message forwarding           | Forward creates task     |
| PTE-099 | Update `/status` for parallelism       | Shows parallel execution |
| PTE-100 | Implement grouping suggestion messages | Accept/reject buttons    |

**Commands:**

```
/newtask <description>    - Create a new task in Evaluation Queue
/queue                    - Show Evaluation Queue status
/suggest                  - Get grouping suggestions
/parallel                 - Show parallelism opportunities
/agents                   - Show active Build Agents
```

### 9.2 Natural Language Task Creation

**File:** `server/services/task-agent/natural-language-parser.ts`

| Task ID | Description                   | Pass Criteria            |
| ------- | ----------------------------- | ------------------------ |
| PTE-101 | Implement `parseTaskIntent()` | Extracts title, category |
| PTE-102 | Implement `confirmWithUser()` | Shows parsed result      |
| PTE-103 | Implement edit flow           | User can modify          |

---

## Phase 10: E2E Testing & Documentation

**Sessions:** 2-3
**Priority:** P2
**Dependencies:** All previous phases

### 10.1 E2E Test Scenarios

| Task ID | Description                             | Pass Criteria            |
| ------- | --------------------------------------- | ------------------------ |
| PTE-104 | Test: Listless task creation (UI)       | Task in Evaluation Queue |
| PTE-105 | Test: Listless task creation (Telegram) | Task in Evaluation Queue |
| PTE-106 | Test: Auto-grouping suggestion          | Suggestion received      |
| PTE-107 | Test: Parallel execution (2 agents)     | Both complete            |
| PTE-108 | Test: Parallel execution (5 agents)     | All complete             |
| PTE-109 | Test: Failure isolation                 | Only dependents blocked  |
| PTE-110 | Test: Circular dependency prevention    | Cycle rejected           |
| PTE-111 | Test: File conflict detection           | Conflict detected        |

**See [E2E Scenarios](./PTE-e2e-scenarios.md) for detailed scenario diagrams.**

### 10.2 Documentation Updates

| Task ID | Description                    | Pass Criteria             |
| ------- | ------------------------------ | ------------------------- |
| PTE-112 | Update task-data-model.md      | New tables documented     |
| PTE-113 | Update task-agent-arch.md      | New components documented |
| PTE-114 | Update E2E-SCENARIOS.md        | New scenarios added       |
| PTE-115 | Update AGENT-SPECIFICATIONS.md | Build Agent parallelism   |
| PTE-116 | Create task-example.md         | Reference task format     |
| PTE-117 | Update CLAUDE.md               | New conventions           |

---

## Reference Documents

| Document                                                      | Description                                    |
| ------------------------------------------------------------- | ---------------------------------------------- |
| [Task Example Reference](./task-example-reference.md)         | Canonical task format with all required fields |
| [SQL Query Reference](./PTE-sql-query-reference.md)           | All SQL queries for parallelism engine         |
| [E2E Scenarios](./PTE-e2e-scenarios.md)                       | Detailed E2E scenario diagrams                 |
| [API & WebSocket Reference](./PTE-api-websocket-reference.md) | Complete API endpoints and WebSocket events    |
| [Telegram Templates](./PTE-telegram-templates.md)             | Message templates for Telegram integration     |
| [Appendix: Additional Tasks](./PTE-appendix-tasks.md)         | Gap-filling tasks and Task Agent constraint    |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION DEPENDENCY GRAPH                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: Database Schema                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Migration 070   Migration 071   Migration 072   Migration 073       │    │
│  │ (Task Identity) (File Impacts) (Parallelism)   (Auto-Grouping)     │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 2: Task Identity Refactoring                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ TypeScript Types              Display ID Generator                  │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 3: Evaluation Queue                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Queue Manager    Task Creation Service    Analysis Pipeline         │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 4: File Impact Analysis                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ File Impact Analyzer          File Conflict Detector                │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 5: Parallelism Engine                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Parallelism Calculator        SQL Queries                           │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│           ┌──────────────────────┼──────────────────────┐                   │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  PHASE 6: Build Agent    PHASE 7: Auto-Grouping    PHASE 8: UI              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Orchestrator    │    │ Grouping Engine │    │ Quick Add       │         │
│  │ Worker Updates  │    │ Circular Dep    │    │ Kanban Lane     │         │
│  └────────┬────────┘    └────────┬────────┘    │ Parallelism View│         │
│           │                      │             └────────┬────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 9: Telegram Integration                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ New Commands                  Natural Language Parser               │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│                                  ▼                                           │
│  PHASE 10: E2E Testing & Documentation                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Test Scenarios                Documentation Updates                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric                           | Target                      | How to Measure                        |
| -------------------------------- | --------------------------- | ------------------------------------- |
| Listless task creation time      | < 5 seconds                 | Time from input to confirmation       |
| Auto-grouping accuracy           | > 80% acceptance rate       | Accepted / total suggestions          |
| Parallelism utilization          | > 70% of opportunities used | Parallel tasks / parallelizable tasks |
| Failure isolation accuracy       | 100%                        | Only dependent tasks blocked          |
| Circular dependency prevention   | 0 cycles created            | No cycles in production               |
| Build Agent spawn time           | < 2 seconds                 | Time from unblock to spawn            |
| File conflict detection accuracy | > 95%                       | True positives / total predictions    |

---

## Risk Mitigation

| Risk                                 | Likelihood | Impact | Mitigation                                                  |
| ------------------------------------ | ---------- | ------ | ----------------------------------------------------------- |
| File impact estimation inaccuracy    | Medium     | Medium | Pattern matching improves over time; user can override      |
| Parallelism calculation performance  | Low        | High   | Caching with invalidation; limit to 50 tasks per analysis   |
| Build Agent resource exhaustion      | Low        | High   | Heartbeat monitoring; automatic termination of stuck agents |
| Circular dependency in existing data | Low        | Medium | One-time scan on deployment; alert if found                 |
| Migration complexity                 | Medium     | Medium | Phased rollout; backwards compatible changes                |

---

## Related Documents

| Document                           | Updates Required                         |
| ---------------------------------- | ---------------------------------------- |
| `task-data-model.md`               | New tables, updated schema               |
| `task-agent-arch.md`               | New components, parallelism architecture |
| `AGENT-SPECIFICATIONS-PIPELINE.md` | Build Agent parallelism model            |
| `E2E-SCENARIOS-CORE.md`            | New listless task scenario               |
| `E2E-SCENARIOS-ADVANCED.md`        | Parallel execution with failure scenario |
| `task-agent-test-plan.md`          | New test flows for parallelism           |
| `CLAUDE.md`                        | New conventions for parallel execution   |

---

_This implementation plan provides a complete roadmap for building automated task grouping, flat task IDs, and parallel execution capabilities._

_Total Tasks: 143 (see [Appendix: Additional Tasks](./PTE-appendix-tasks.md) for complete breakdown)_
