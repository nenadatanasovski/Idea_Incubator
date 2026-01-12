---
id: build-agent
title: Build Agent
complexity: complex
status: approved
version: 1.0.0
generated: 2026-01-11
---

# Build Agent

## Overview

**Problem:** After the Spec Agent generates implementation specifications and atomic tasks, there is no automated way to execute these tasks. Manual execution is slow, error-prone, and doesn't scale.

**Solution:** Build Agent is an autonomous code generation and execution system that reads task specifications, generates code using Claude API, writes files safely, validates output, and handles failures with retry logic and checkpoints.

## Functional Requirements

- **[FR-001]** Load and parse tasks.md files from spec output _(must)_
- **[FR-002]** Execute tasks in dependency order using topological sort _(must)_
- **[FR-003]** Prime context with CLAUDE.md, related files, and gotchas _(must)_
- **[FR-004]** Generate code using Claude API based on task requirements _(must)_
- **[FR-005]** Write files safely with backup before overwrite _(must)_
- **[FR-006]** Run validation commands after each task _(must)_
- **[FR-007]** Retry failed tasks up to 3 times with exponential backoff _(must)_
- **[FR-008]** Create checkpoint after each successful task _(must)_
- **[FR-009]** Resume from checkpoint after interruption _(should)_
- **[FR-010]** Ask clarifying questions via Communication Hub when blocked _(should)_
- **[FR-011]** Commit to git after successful task completion _(could)_
- **[FR-012]** Report progress via WebSocket _(should)_

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Build Agent                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Task Loader  │───▶│Task Executor │───▶│  Validator   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │Context Primer│    │Code Generator│    │ File Writer  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             ▼                               │
│                   ┌──────────────────┐                      │
│                   │Checkpoint Manager│                      │
│                   └──────────────────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐          │
│         ▼                   ▼                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │Retry Handler │    │Git Integration│   │Comm Hub Link │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| Task Loader | Parse tasks.md, order by dependencies |
| Context Primer | Load CLAUDE.md, related files, task gotchas |
| Task Executor | Orchestrate task execution loop |
| Code Generator | Call Claude API to generate code |
| File Writer | Safe file operations with backup |
| Validator | Run validation commands |
| Checkpoint Manager | Save/restore execution state |
| Retry Handler | Exponential backoff on failures |
| Git Integration | Commit after successful tasks |
| Comm Hub Link | Ask questions when blocked |

## API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/builds | GET | List all builds |
| /api/builds | POST | Start new build from spec |
| /api/builds/:id | GET | Get build status |
| /api/builds/:id/tasks | GET | Get task execution history |
| /api/builds/:id/resume | POST | Resume from checkpoint |
| /api/builds/:id/cancel | POST | Cancel running build |
| /api/builds/:id/retry/:taskId | POST | Retry failed task |

### Request/Response Examples

**POST /api/builds**
```json
{
  "specPath": "ideas/vibe/feature/build/tasks.md",
  "options": {
    "autoCommit": true,
    "maxRetries": 3
  }
}
```

**GET /api/builds/:id**
```json
{
  "id": "build_abc123",
  "specId": "feature-name",
  "status": "in_progress",
  "currentTaskId": "T-003",
  "progress": {
    "completed": 2,
    "total": 8,
    "percentage": 25
  },
  "startedAt": "2026-01-11T10:00:00Z"
}
```

## Data Models

```typescript
export interface BuildExecution {
  id: string;
  specId: string;
  specPath: string;
  status: BuildStatus;
  currentTaskId: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export type BuildStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TaskExecution {
  id: string;
  buildId: string;
  taskId: string;
  attempt: number;
  status: TaskStatus;
  startedAt: string;
  completedAt: string | null;
  generatedCode: string | null;
  validationOutput: string | null;
  errorMessage: string | null;
}

export type TaskStatus = 'pending' | 'running' | 'validating' | 'completed' | 'failed' | 'skipped';

export interface BuildCheckpoint {
  id: string;
  buildId: string;
  taskId: string;
  stateJson: string;
  createdAt: string;
}

export interface BuildOptions {
  autoCommit?: boolean;
  maxRetries?: number;
  skipValidation?: boolean;
  dryRun?: boolean;
}
```

```sql
-- Build execution tracking
CREATE TABLE IF NOT EXISTS build_executions (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    spec_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    current_task_id TEXT,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_build_executions_status ON build_executions(status);
CREATE INDEX IF NOT EXISTS idx_build_executions_spec_id ON build_executions(spec_id);

-- Task execution history
CREATE TABLE IF NOT EXISTS task_executions (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    attempt INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    generated_code TEXT,
    validation_output TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES build_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_task_executions_build ON task_executions(build_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);

-- Checkpoints for recovery
CREATE TABLE IF NOT EXISTS build_checkpoints (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES build_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_build ON build_checkpoints(build_id);
```

## Known Gotchas

- **SQL-001:** Always use parameterized queries to prevent SQL injection
- **SQL-002:** Use TEXT type for timestamps in SQLite, not DATETIME
- **API-002:** Use try-catch and proper error responses (400, 404, 500)
- **GEN-001:** Use .js extension in imports for ESM compatibility
- **DB-001:** Use db.prepare().run/get/all() pattern from better-sqlite3

## Validation Strategy

1. **Unit Tests:** Test individual components (context primer, file writer, etc.)
2. **Integration Tests:** Test full task execution flow
3. **TypeScript:** Compile without errors (`npx tsc --noEmit`)
4. **E2E Tests:** Execute a simple spec and verify output files

### Test Scenarios

| Scenario | Expected Outcome |
|----------|-----------------|
| Execute simple spec | All 5-8 tasks complete successfully |
| Execute medium spec | All 10-15 tasks complete successfully |
| Task validation fails | Retry up to 3 times, then ask human |
| Interrupted build | Can resume from last checkpoint |
| Invalid task file | Clear error message, build fails gracefully |
