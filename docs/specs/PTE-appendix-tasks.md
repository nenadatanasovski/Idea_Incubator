# Appendix: Additional Tasks & Constraints

**Part of:** [Parallel Task Execution Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md)

---

## Additional Tasks (Gaps Filled)

### Phase 3 Additions: Task Editing

| Task ID | Description                                        | Pass Criteria              |
| ------- | -------------------------------------------------- | -------------------------- |
| PTE-118 | Implement `updateTask()` in EvaluationQueueManager | Task fields editable       |
| PTE-119 | Create PUT /api/tasks/:id endpoint                 | Returns updated task       |
| PTE-120 | Trigger re-analysis on significant changes         | New relationships detected |

### Phase 4 Additions: User Override for File Impacts

| Task ID | Description                                      | Pass Criteria                         |
| ------- | ------------------------------------------------ | ------------------------------------- |
| PTE-121 | Create POST /api/tasks/:id/file-impacts endpoint | User can add/remove impacts           |
| PTE-122 | Implement `overrideFileImpact()`                 | Source set to 'user_declared'         |
| PTE-123 | UI for editing file impacts                      | Modal with add/edit/delete            |
| PTE-124 | Recalculate parallelism on override              | Analysis invalidated and recalculated |

### Phase 6 Additions: Multi-Task-List Orchestration

| Task ID | Description                        | Pass Criteria                          |
| ------- | ---------------------------------- | -------------------------------------- |
| PTE-125 | Implement `TaskListOrchestrator`   | Manages multiple concurrent task lists |
| PTE-126 | Cross-list file conflict detection | Detects conflicts across lists         |
| PTE-127 | Global Build Agent pool management | Prevents resource exhaustion           |
| PTE-128 | Add `max_concurrent_lists` config  | User-configurable limit                |

### Phase 7 Additions: Component-Type Grouping

| Task ID | Description                                     | Pass Criteria                        |
| ------- | ----------------------------------------------- | ------------------------------------ |
| PTE-129 | Add `component_type` field to tasks             | database, api, ui, test, etc.        |
| PTE-130 | Implement `calculateComponentScore()`           | Same component type = higher score   |
| PTE-131 | Add component_weight to GroupingCriteriaWeights | Default: 0.15                        |
| PTE-132 | Update grouping algorithm                       | Include component type in clustering |

### Phase 8 Additions: UI Enhancements

| Task ID | Description                       | Pass Criteria            |
| ------- | --------------------------------- | ------------------------ |
| PTE-136 | Create FileImpactEditor component | Add/edit/delete impacts  |
| PTE-137 | Create TaskEditModal component    | Full task editing        |
| PTE-138 | Add component type selector       | Dropdown with categories |
| PTE-139 | Show cross-list conflicts in UI   | Warning indicator        |

### Phase 9 Additions: Telegram Enhancements

| Task ID | Description                                   | Pass Criteria         |
| ------- | --------------------------------------------- | --------------------- |
| PTE-133 | Implement `/edit <task_id>` command           | Opens edit flow       |
| PTE-134 | Implement `/override <task_id>` command       | Override file impacts |
| PTE-135 | Add recommendation to ALL actionable messages | Consistent format     |

---

## Task Agent Per Task List Constraint

### Architecture Constraint

**CRITICAL:** There is exactly ONE Task Agent instance per Task List AND per Telegram Channel.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TASK AGENT ASSIGNMENT MODEL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROJECT: My App                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  Task List: "User Auth Feature"                                       │  │
│  │  ├─ Task Agent Instance: TA-001                                       │  │
│  │  ├─ Telegram Channel: @myapp_auth_bot                                │  │
│  │  └─ Build Agents: BA-001, BA-002, BA-003 (parallel)                  │  │
│  │                                                                        │  │
│  │  Task List: "Dashboard Feature"                                       │  │
│  │  ├─ Task Agent Instance: TA-002                                       │  │
│  │  ├─ Telegram Channel: @myapp_dashboard_bot                           │  │
│  │  └─ Build Agents: BA-004, BA-005 (parallel)                          │  │
│  │                                                                        │  │
│  │  Evaluation Queue (no Task List)                                      │  │
│  │  ├─ Task Agent Instance: TA-EVAL-001                                 │  │
│  │  ├─ Telegram Channel: @myapp_eval_bot                                │  │
│  │  └─ Build Agents: None (not executed)                                │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  RULES:                                                                      │
│  • 1 Task Agent = 1 Task List = 1 Telegram Channel                          │
│  • Task Agent manages: suggestions, approvals, status, questions            │
│  • Task Agent spawns: unlimited Build Agents for parallel execution         │
│  • Evaluation Queue has its own Task Agent for listless tasks               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

| Task ID | Description                                            | Pass Criteria            |
| ------- | ------------------------------------------------------ | ------------------------ |
| PTE-140 | Create `task_agent_instances` table                    | One row per task list    |
| PTE-141 | Link Task Agent to Telegram channel                    | Foreign key relationship |
| PTE-142 | Implement Task Agent lifecycle (spawn, run, terminate) | Clean lifecycle          |
| PTE-143 | Prevent multiple Task Agents per list                  | Unique constraint        |

### Database Schema Addition (Migration 074)

```sql
-- Migration 074: Task Agent Instance Tracking
CREATE TABLE IF NOT EXISTS task_agent_instances (
  id TEXT PRIMARY KEY,

  -- Assignment (mutually exclusive)
  task_list_id TEXT UNIQUE REFERENCES task_lists(id) ON DELETE CASCADE,
  is_evaluation_queue INTEGER DEFAULT 0,  -- Boolean, only one per project

  -- Telegram binding
  telegram_channel_id TEXT UNIQUE NOT NULL,
  telegram_bot_token TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'terminated')),

  -- Metadata
  project_id TEXT NOT NULL REFERENCES projects(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Ensure only one eval queue per project
  UNIQUE(project_id, is_evaluation_queue)
);

CREATE INDEX IF NOT EXISTS idx_task_agent_project ON task_agent_instances(project_id);
```

---

## Updated Task Count

| Phase     | Original Tasks | Added Tasks            | Total   |
| --------- | -------------- | ---------------------- | ------- |
| 1         | 18             | 0                      | 18      |
| 2         | 10             | 0                      | 10      |
| 3         | 15             | 3 (PTE-118 to PTE-120) | 18      |
| 4         | 9              | 4 (PTE-121 to PTE-124) | 13      |
| 5         | 9              | 0                      | 9       |
| 6         | 10             | 4 (PTE-125 to PTE-128) | 14      |
| 7         | 10             | 4 (PTE-129 to PTE-132) | 14      |
| 8         | 14             | 4 (PTE-136 to PTE-139) | 18      |
| 9         | 8              | 3 (PTE-133 to PTE-135) | 11      |
| 10        | 14             | 4 (PTE-140 to PTE-143) | 18      |
| **Total** | **117**        | **26**                 | **143** |

---

## Task ID Summary

| Task ID Range      | Phase   | Description                    |
| ------------------ | ------- | ------------------------------ |
| PTE-001 to PTE-006 | 1       | Migration 070: Task Identity   |
| PTE-007 to PTE-011 | 1       | Migration 071: File Impacts    |
| PTE-012 to PTE-015 | 1       | Migration 072: Parallelism     |
| PTE-016 to PTE-018 | 1       | Migration 073: Auto-Grouping   |
| PTE-019 to PTE-024 | 2       | TypeScript Types               |
| PTE-025 to PTE-028 | 2       | Display ID Generator           |
| PTE-029 to PTE-033 | 3       | Evaluation Queue Manager       |
| PTE-034 to PTE-038 | 3       | Task Creation Service          |
| PTE-039 to PTE-043 | 3       | Task Analysis Pipeline         |
| PTE-044 to PTE-048 | 4       | File Impact Analyzer           |
| PTE-049 to PTE-052 | 4       | File Conflict Detector         |
| PTE-053 to PTE-057 | 5       | Parallelism Calculator         |
| PTE-058 to PTE-061 | 5       | SQL Queries                    |
| PTE-062 to PTE-067 | 6       | Build Agent Orchestrator       |
| PTE-068 to PTE-071 | 6       | Build Agent Worker             |
| PTE-072 to PTE-076 | 7       | Auto-Grouping Engine           |
| PTE-077 to PTE-081 | 7       | Circular Dependency Prevention |
| PTE-082 to PTE-085 | 8       | Quick Add Component            |
| PTE-086 to PTE-090 | 8       | Evaluation Queue Lane          |
| PTE-091 to PTE-095 | 8       | Parallelism View               |
| PTE-096 to PTE-100 | 9       | Telegram Commands              |
| PTE-101 to PTE-103 | 9       | Natural Language Parser        |
| PTE-104 to PTE-111 | 10      | E2E Test Scenarios             |
| PTE-112 to PTE-117 | 10      | Documentation Updates          |
| PTE-118 to PTE-143 | Various | Additional Tasks (Gaps Filled) |

**Total Tasks: 143**
