# TAK-006c: Task Questions Migration

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | 1 - Database Schema |
| **Depends On** | None |
| **Blocks** | TAK-020 (TelegramHandler) |
| **Priority** | P1 |
| **Owner** | Build Agent |

---

## Summary

Create the task_questions table for Task Agent to ask user questions. Named `task_questions` to avoid conflict with existing `questions` table (migration 030).

---

## Context

### Why Separate Table?

| Reason | Description |
|--------|-------------|
| **Different Scope** | Existing questions table links to agent_id/session_id |
| **Task Linkage** | Task questions link to task_id/task_list_id |
| **No Conflict** | Avoids modifying existing table used by other systems |

### Question Types

| Type | Description |
|------|-------------|
| `approval` | Task list ready to execute, need user OK |
| `clarification` | Need more info to proceed |
| `decision` | Multiple valid options, user chooses |
| `escalation` | Task Agent stuck, needs human help |

---

## Requirements

1. **Create task_questions table**:
   - task_id and task_list_id (both optional, at least one required)
   - question_type: approval, clarification, decision, escalation
   - question_text and context (JSON)
   - options (JSON array for decision type)
   - status: pending, answered, expired, cancelled
   - answer and answered_by, answered_at
   - priority and expires_at

2. **Create indexes**:
   - idx_task_questions_status on status
   - idx_task_questions_task on task_id
   - idx_task_questions_list on task_list_id

---

## Pass Criteria

**PASS** when ALL of the following are true:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Migration file exists | `test -f database/migrations/058_task_questions.sql` returns 0 |
| 2 | Has table (task_questions NOT questions) | `grep -q "CREATE TABLE IF NOT EXISTS task_questions" database/migrations/058_task_questions.sql` returns 0 |
| 3 | Has question types | `grep -q "approval.*clarification.*decision.*escalation" database/migrations/058_task_questions.sql` returns 0 |
| 4 | Has answer columns | `grep -q "answered_by.*answered_at" database/migrations/058_task_questions.sql` returns 0 |
| 5 | Migration runs | `sqlite3 :memory: < database/migrations/058_task_questions.sql && echo 'OK'` returns "OK" |

**FAIL** if any criterion is not met.

---

## Output Files

```
database/migrations/
└── 058_task_questions.sql
```

---

## Code Template

```sql
-- Migration 058: Task Questions (Task Agent → User)
-- NOTE: Named task_questions to avoid conflict with questions table (migration 030)

CREATE TABLE IF NOT EXISTS task_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  task_list_id TEXT,

  question_type TEXT NOT NULL CHECK (question_type IN
    ('approval', 'clarification', 'decision', 'escalation')),
  question_text TEXT NOT NULL,
  context TEXT,  -- JSON with relevant context
  options TEXT,  -- JSON array of options for decision type

  status TEXT DEFAULT 'pending' CHECK (status IN
    ('pending', 'answered', 'expired', 'cancelled')),
  answer TEXT,
  answered_by TEXT,
  answered_at TEXT,

  priority INTEGER DEFAULT 50,
  expires_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_questions_status ON task_questions(status);
CREATE INDEX IF NOT EXISTS idx_task_questions_task ON task_questions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_questions_list ON task_questions(task_list_id);
```

---

## Gotchas

- **Table name is `task_questions` NOT `questions`** - The existing `questions` table (migration 030) is for general agent questions with different schema
- At least one of task_id or task_list_id should be provided (enforced in application code)

---

## Validation

```bash
npm run migrate
sqlite3 database/ideas.db ".schema task_questions"
# Verify no conflict with existing questions table
sqlite3 database/ideas.db ".schema questions"
```

---

## Next Steps

After completing: Create TypeScript types (TAK-007).
