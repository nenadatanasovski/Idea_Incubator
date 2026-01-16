# TAK-006b: Task List Items Migration

---

## Metadata

| Field          | Value                      |
| -------------- | -------------------------- |
| **Phase**      | 1 - Database Schema        |
| **Depends On** | TAK-001, TAK-006a          |
| **Blocks**     | TAK-015c (TaskListManager) |
| **Priority**   | P1                         |
| **Owner**      | Build Agent                |

---

## Summary

Create the task_list_items junction table linking tasks to task lists. Supports adding the same task to multiple lists with position and status tracking.

---

## Requirements

1. **Create task_list_items table**:
   - task_list_id and task_id references
   - position for ordering within list
   - status: pending, in_progress, completed, skipped, failed
   - Timestamps: added_at, started_at, completed_at
   - UNIQUE constraints on (task_list_id, task_id) and (task_list_id, position)

2. **Create indexes**:
   - idx_list_items_list on task_list_id
   - idx_list_items_task on task_id
   - idx_list_items_status on status

---

## Pass Criteria

**PASS** when ALL of the following are true:

| #   | Criterion              | How to Verify                                                                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Migration file exists  | `test -f database/migrations/057_task_list_items.sql` returns 0                                              |
| 2   | Has table              | `grep -q "CREATE TABLE IF NOT EXISTS task_list_items" database/migrations/057_task_list_items.sql` returns 0 |
| 3   | Has unique constraints | `grep -q "UNIQUE.*task_list_id.*task_id" database/migrations/057_task_list_items.sql` returns 0              |
| 4   | Has position unique    | `grep -q "UNIQUE.*task_list_id.*position" database/migrations/057_task_list_items.sql` returns 0             |
| 5   | Migration runs         | `sqlite3 :memory: < database/migrations/057_task_list_items.sql && echo 'OK'` returns "OK"                   |

**FAIL** if any criterion is not met.

---

## Output Files

```
database/migrations/
└── 057_task_list_items.sql
```

---

## Code Template

```sql
-- Migration 057: Task list items (junction table)

CREATE TABLE IF NOT EXISTS task_list_items (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN
    ('pending', 'in_progress', 'completed', 'skipped', 'failed')),

  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,

  UNIQUE(task_list_id, task_id),
  UNIQUE(task_list_id, position)
);

CREATE INDEX IF NOT EXISTS idx_list_items_list ON task_list_items(task_list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_task ON task_list_items(task_id);
CREATE INDEX IF NOT EXISTS idx_list_items_status ON task_list_items(status);
```

---

## Validation

```bash
npm run migrate
sqlite3 database/ideas.db ".schema task_list_items"
```

---

## Next Steps

After completing: Create task_questions table (TAK-006c).
