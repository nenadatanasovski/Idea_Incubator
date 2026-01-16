# Task Data Model

**Part of:** Parallel Task Execution System
**Updated:** 2026-01-13

---

## Overview

This document defines the data model for the Task Agent's parallel task execution system, including all database tables, TypeScript interfaces, and their relationships.

---

## Database Schema

### Core Tables

#### tasks

The primary table for storing all tasks.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  display_id TEXT UNIQUE NOT NULL,           -- Human-readable ID (e.g., TU-PROJ-FEA-042)
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'task'      -- feature, bug, task, story, epic
    CHECK(category IN ('feature', 'bug', 'task', 'story', 'epic')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'evaluating', 'ready', 'in_progress', 'completed', 'failed', 'skipped', 'blocked')),
  queue TEXT                                  -- NULL or 'evaluation'
    CHECK(queue IS NULL OR queue = 'evaluation'),
  task_list_id TEXT REFERENCES task_lists_v2(id),
  project_id TEXT REFERENCES projects(id),
  priority TEXT NOT NULL DEFAULT 'P2'
    CHECK(priority IN ('P0', 'P1', 'P2', 'P3')),
  effort TEXT NOT NULL DEFAULT 'medium'
    CHECK(effort IN ('trivial', 'small', 'medium', 'large', 'epic')),
  phase INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT 'build_agent'
    CHECK(owner IN ('human', 'build_agent', 'task_agent')),
  assigned_agent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);
```

#### task_lists_v2

Task list container for grouped tasks.

```sql
CREATE TABLE task_lists_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'ready', 'in_progress', 'paused', 'completed', 'archived')),
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### task_relationships

Tracks dependencies and relationships between tasks.

```sql
CREATE TABLE task_relationships (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'depends_on'
    CHECK(relationship_type IN ('depends_on', 'blocks', 'relates_to', 'duplicates')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_task_id, target_task_id, relationship_type)
);
```

### Parallel Execution Tables

#### task_file_impacts

Tracks estimated and actual file impacts for conflict detection.

```sql
CREATE TABLE task_file_impacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL
    CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
  confidence REAL NOT NULL DEFAULT 0.5
    CHECK(confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'ai_estimate'
    CHECK(source IN ('ai_estimate', 'pattern_match', 'user_declared', 'validated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, file_path, operation)
);
```

#### parallelism_analysis

Caches parallelism analysis between task pairs.

```sql
CREATE TABLE parallelism_analysis (
  id TEXT PRIMARY KEY,
  task_a_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_b_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  can_parallel INTEGER NOT NULL DEFAULT 0,
  conflict_reason TEXT,
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  UNIQUE(task_a_id, task_b_id)
);
```

#### parallel_execution_waves

Tracks execution waves for a task list.

```sql
CREATE TABLE parallel_execution_waves (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id) ON DELETE CASCADE,
  wave_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
  task_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  UNIQUE(task_list_id, wave_number)
);
```

#### build_agent_instances

Tracks active Build Agent instances.

```sql
CREATE TABLE build_agent_instances (
  id TEXT PRIMARY KEY,
  task_list_id TEXT REFERENCES task_lists_v2(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  wave_id TEXT REFERENCES parallel_execution_waves(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'spawning'
    CHECK(status IN ('spawning', 'running', 'completing', 'terminated', 'failed')),
  process_id TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_heartbeat_at TEXT,
  completed_at TEXT,
  error_message TEXT
);
```

### Auto-Grouping Tables

#### grouping_suggestions

Stores AI-generated grouping suggestions.

```sql
CREATE TABLE grouping_suggestions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'accepted', 'rejected', 'expired', 'superseded')),
  suggested_name TEXT NOT NULL,
  suggested_tasks TEXT NOT NULL,           -- JSON array of task IDs
  grouping_reason TEXT NOT NULL,
  similarity_score REAL,
  project_id TEXT REFERENCES projects(id),
  triggered_by TEXT,
  trigger_task_id TEXT REFERENCES tasks(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  resolved_at TEXT,
  resolved_by TEXT
);
```

#### display_id_sequences

Tracks sequence numbers for display ID generation.

```sql
CREATE TABLE display_id_sequences (
  project_id TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## TypeScript Interfaces

### Core Types

```typescript
// Task identity with human-readable ID
export interface TaskIdentity {
  id: string; // UUID
  displayId: string; // TU-PROJ-FEA-042
}

// Task categories
export type TaskCategory = "feature" | "bug" | "task" | "story" | "epic";

// Task status values
export type TaskStatus =
  | "pending"
  | "evaluating"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";

// Queue types
export type TaskQueue = "evaluation" | null;

// Full task interface
export interface Task extends TaskIdentity {
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  queue: TaskQueue;
  taskListId?: string;
  projectId?: string;
  priority: "P0" | "P1" | "P2" | "P3";
  effort: "trivial" | "small" | "medium" | "large" | "epic";
  phase: number;
  position: number;
  owner: "human" | "build_agent" | "task_agent";
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### File Impact Types

```typescript
export type FileOperation = "CREATE" | "UPDATE" | "DELETE" | "READ";
export type ImpactSource =
  | "ai_estimate"
  | "pattern_match"
  | "user_declared"
  | "validated";

export interface FileImpact {
  id: string;
  taskId: string;
  filePath: string;
  operation: FileOperation;
  confidence: number; // 0.0 to 1.0
  source: ImpactSource;
  createdAt: string;
  updatedAt: string;
}

export interface FileConflict {
  filePath: string;
  taskAId: string;
  taskAOperation: FileOperation;
  taskBId: string;
  taskBOperation: FileOperation;
  conflictType: "write-write" | "write-delete" | "delete-read";
}
```

### Parallelism Types

```typescript
export interface ParallelismAnalysis {
  id: string;
  taskAId: string;
  taskBId: string;
  canParallel: boolean;
  conflictReason?: string;
  analyzedAt: string;
  validUntil?: string;
}

export interface ExecutionWave {
  id: string;
  taskListId: string;
  waveNumber: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  taskCount: number;
  completedCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
}

export interface BuildAgentInstance {
  id: string;
  taskListId?: string;
  taskId?: string;
  waveId?: string;
  status: "spawning" | "running" | "completing" | "terminated" | "failed";
  processId?: string;
  startedAt: string;
  lastHeartbeatAt?: string;
  completedAt?: string;
  errorMessage?: string;
}
```

### Grouping Types

```typescript
export interface GroupingSuggestion {
  id: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "superseded";
  suggestedName: string;
  suggestedTasks: string[]; // Task IDs
  groupingReason: string;
  similarityScore?: number;
  projectId?: string;
  triggeredBy?: string;
  triggerTaskId?: string;
  createdAt: string;
  expiresAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIP DIAGRAM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  projects                                                                    │
│  ┌───────────┐                                                              │
│  │ id (PK)   │──────────────────────────────────────────┐                   │
│  │ name      │                                          │                   │
│  └───────────┘                                          │                   │
│       │                                                 │                   │
│       │ 1:N                                             │ 1:N               │
│       ▼                                                 ▼                   │
│  task_lists_v2                                    grouping_suggestions      │
│  ┌───────────────┐                                ┌────────────────────┐    │
│  │ id (PK)       │                                │ id (PK)            │    │
│  │ project_id(FK)│                                │ project_id (FK)    │    │
│  │ name          │                                │ suggested_tasks    │    │
│  │ status        │                                │ status             │    │
│  └───────────────┘                                └────────────────────┘    │
│       │                                                                      │
│       │ 1:N                                                                  │
│       ▼                                                                      │
│  tasks                                                                       │
│  ┌────────────────────┐                                                     │
│  │ id (PK)            │◄────────────────────────────────────────────┐       │
│  │ display_id (UNIQUE)│                                              │       │
│  │ task_list_id (FK)  │                                              │       │
│  │ project_id (FK)    │                                              │       │
│  │ queue              │                                              │       │
│  │ status             │                                              │       │
│  └────────────────────┘                                              │       │
│       │           │                                                  │       │
│       │           │ N:N (via task_relationships)                     │       │
│       │           └──────────────────────────────────────────────────┘       │
│       │                                                                      │
│       │ 1:N                     1:N                      1:N                 │
│       ▼                         ▼                        ▼                   │
│  task_file_impacts     parallelism_analysis     build_agent_instances       │
│  ┌─────────────────┐   ┌────────────────────┐   ┌─────────────────────┐     │
│  │ id (PK)         │   │ id (PK)            │   │ id (PK)             │     │
│  │ task_id (FK)    │   │ task_a_id (FK)     │   │ task_id (FK)        │     │
│  │ file_path       │   │ task_b_id (FK)     │   │ task_list_id (FK)   │     │
│  │ operation       │   │ can_parallel       │   │ status              │     │
│  │ confidence      │   │ conflict_reason    │   │ last_heartbeat_at   │     │
│  └─────────────────┘   └────────────────────┘   └─────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conflict Detection Matrix

| Task A Operation | Task B Operation | Can Parallel? | Reason                            |
| ---------------- | ---------------- | ------------- | --------------------------------- |
| CREATE           | CREATE           | NO            | Same file cannot be created twice |
| CREATE           | UPDATE           | NO            | File must exist for update        |
| CREATE           | DELETE           | NO            | Race condition                    |
| CREATE           | READ             | YES           | Safe                              |
| UPDATE           | UPDATE           | NO            | Concurrent modification           |
| UPDATE           | DELETE           | NO            | File may not exist after delete   |
| UPDATE           | READ             | YES           | Read-before-write is safe         |
| DELETE           | DELETE           | NO            | Double delete                     |
| DELETE           | READ             | NO            | File may not exist                |
| READ             | READ             | YES           | Safe                              |

---

## Index Strategy

```sql
-- Primary lookups
CREATE INDEX idx_tasks_display_id ON tasks(display_id);
CREATE INDEX idx_tasks_queue ON tasks(queue) WHERE queue IS NOT NULL;
CREATE INDEX idx_tasks_list ON tasks(task_list_id) WHERE task_list_id IS NOT NULL;
CREATE INDEX idx_tasks_status ON tasks(status);

-- File impact queries
CREATE INDEX idx_file_impacts_task ON task_file_impacts(task_id);
CREATE INDEX idx_file_impacts_path ON task_file_impacts(file_path);
CREATE INDEX idx_file_impacts_task_path ON task_file_impacts(task_id, file_path);

-- Relationship traversal
CREATE INDEX idx_relationships_source ON task_relationships(source_task_id);
CREATE INDEX idx_relationships_target ON task_relationships(target_task_id);

-- Parallelism analysis
CREATE INDEX idx_parallelism_tasks ON parallelism_analysis(task_a_id, task_b_id);
CREATE INDEX idx_parallelism_valid ON parallelism_analysis(valid_until)
  WHERE valid_until IS NOT NULL;

-- Build agent monitoring
CREATE INDEX idx_agents_status ON build_agent_instances(status);
CREATE INDEX idx_agents_heartbeat ON build_agent_instances(last_heartbeat_at);
```

---

## Related Documents

- [Task Agent Architecture](./task-agent-arch.md) - Component architecture
- [Task Example Reference](./task-example-reference.md) - Canonical task format
- [SQL Query Reference](./PTE-sql-query-reference.md) - Query implementations
- [Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) - Full plan
