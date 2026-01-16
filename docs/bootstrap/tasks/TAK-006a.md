# TAK-006a: Task Lists Migration

---

## Metadata

| Field          | Value                                |
| -------------- | ------------------------------------ |
| **Phase**      | 1 - Database Schema                  |
| **Depends On** | TAK-001                              |
| **Blocks**     | TAK-006b, TAK-015c (TaskListManager) |
| **Priority**   | P1                                   |
| **Owner**      | Build Agent                          |

---

## Summary

Create the task_lists table for grouping tasks into executable lists. Each task list maps to exactly one Telegram chat for human interaction.

---

## Context

### Task List Purpose

| Feature               | Description                                 |
| --------------------- | ------------------------------------------- |
| **Grouping**          | Organize related tasks together             |
| **Telegram Link**     | One chat per task list (one-to-one mapping) |
| **Execution Modes**   | Sequential, parallel, or priority-based     |
| **Progress Tracking** | Track completion percentage                 |

---

## Requirements

1. **Create task_lists table**:
   - name and description
   - status: draft, active, paused, completed, archived
   - project_id and idea_slug for scoping
   - telegram_chat_id (UNIQUE) - one chat per list
   - execution_mode: sequential, parallel, priority
   - Progress: current_task_id, tasks_completed, tasks_total
   - Timestamps: created_at, updated_at, started_at, completed_at

2. **Create indexes**:
   - idx_task_lists_status on status
   - idx_task_lists_telegram on telegram_chat_id

---

## Pass Criteria

**PASS** when ALL of the following are true:

| #   | Criterion                   | How to Verify                                                                                      |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Migration file exists       | `test -f database/migrations/056_task_lists.sql` returns 0                                         |
| 2   | Has table                   | `grep -q "CREATE TABLE IF NOT EXISTS task_lists" database/migrations/056_task_lists.sql` returns 0 |
| 3   | Has telegram_chat_id UNIQUE | `grep -q "telegram_chat_id TEXT UNIQUE" database/migrations/056_task_lists.sql` returns 0          |
| 4   | Has execution modes         | `grep -q "sequential.*parallel.*priority" database/migrations/056_task_lists.sql` returns 0        |
| 5   | Migration runs              | `sqlite3 :memory: < database/migrations/056_task_lists.sql && echo 'OK'` returns "OK"              |

**FAIL** if any criterion is not met.

---

## Output Files

```
database/migrations/
└── 056_task_lists.sql
```

---

## Code Template

```sql
-- Migration 056: Task lists
-- Per task-data-model.md - One Telegram chat per task list

CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Scope
  project_id TEXT,
  idea_slug TEXT,

  -- Telegram integration (one chat per list)
  telegram_chat_id TEXT UNIQUE,
  telegram_thread_id TEXT,

  -- Execution tracking
  execution_mode TEXT DEFAULT 'sequential' CHECK (execution_mode IN
    ('sequential', 'parallel', 'priority')),
  current_task_id TEXT,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_lists_status ON task_lists(status);
CREATE INDEX IF NOT EXISTS idx_task_lists_telegram ON task_lists(telegram_chat_id);
```

---

## Validation

```bash
npm run migrate
sqlite3 database/ideas.db ".schema task_lists"
```

---

## Next Steps

After completing: Create task_list_items junction table (TAK-006b).
