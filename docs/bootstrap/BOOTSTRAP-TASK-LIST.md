# Task Agent Bootstrap - Simplified Task List

**For:** Coding Agents
**Purpose:** Execute these 14 tasks to bootstrap Task Agent self-hosting

---

## Instructions for Coding Agent

Execute tasks in order. Each task has:

- **ID**: Task identifier
- **Action**: What to do
- **File**: Target file path
- **Depends**: Tasks that must complete first
- **Validate**: Command to verify completion

Skip to [Task Details](#task-details) for specifications.

---

## Task List

| ID       | Action  | File                                             | Depends              |
| -------- | ------- | ------------------------------------------------ | -------------------- |
| BOOT-001 | CREATE  | `database/migrations/050_tasks_schema.sql`       | -                    |
| BOOT-002 | CREATE  | `database/migrations/051_task_relationships.sql` | BOOT-001             |
| BOOT-003 | CREATE  | `database/migrations/052_task_lists.sql`         | BOOT-001             |
| BOOT-004 | CREATE  | `database/migrations/053_task_list_items.sql`    | BOOT-001, BOOT-003   |
| BOOT-005 | CREATE  | `database/migrations/054_validation_rules.sql`   | -                    |
| BOOT-006 | VERIFY  | Run `npm run migrate`                            | BOOT-001 to BOOT-005 |
| BOOT-007 | CREATE  | `types/task-agent.ts`                            | BOOT-006             |
| BOOT-008 | CREATE  | `types/task-validation.ts`                       | BOOT-006             |
| BOOT-009 | CREATE  | `server/routes/tasks-v2.ts`                      | BOOT-007             |
| BOOT-010 | CREATE  | `server/routes/task-lists-v2.ts`                 | BOOT-007             |
| BOOT-011 | UPDATE  | `server/api.ts` - mount routes                   | BOOT-009, BOOT-010   |
| BOOT-012 | UPDATE  | `server/websocket.ts` - add task events          | BOOT-011             |
| BOOT-013 | CREATE  | `scripts/import-tasks.ts`                        | BOOT-011             |
| BOOT-014 | EXECUTE | Run importer script                              | BOOT-013             |

---

## Task Details

### BOOT-001: tasks table migration

```sql
-- File: database/migrations/050_tasks_schema.sql

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  parent_task_id TEXT REFERENCES tasks(id),
  project_id TEXT,
  idea_slug TEXT,
  acceptance_criteria TEXT DEFAULT '[]',
  codebase_tests TEXT DEFAULT '[]',
  api_tests TEXT DEFAULT '[]',
  ui_tests TEXT DEFAULT '[]',
  priority_score INTEGER DEFAULT 0,
  blocks_count INTEGER DEFAULT 0,
  is_quick_win INTEGER DEFAULT 0,
  deadline TEXT,
  risk_level TEXT DEFAULT 'medium',
  assigned_agent TEXT,
  estimated_effort TEXT,
  actual_effort_minutes INTEGER,
  affected_files TEXT DEFAULT '[]',
  version INTEGER DEFAULT 1,
  supersedes_task_id TEXT REFERENCES tasks(id),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_score DESC);
```

**Validate:** `sqlite3 database/ideas.db ".schema tasks"`

---

### BOOT-002: task_relationships table

```sql
-- File: database/migrations/051_task_relationships.sql

CREATE TABLE IF NOT EXISTS task_relationships (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'depends_on', 'blocks', 'related_to', 'duplicate_of', 'subtask_of',
    'supersedes', 'implements', 'conflicts_with', 'enables', 'inspired_by', 'tests'
  )),
  strength REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE(source_task_id, target_task_id, relationship_type),
  CHECK(source_task_id != target_task_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON task_relationships(source_task_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON task_relationships(target_task_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON task_relationships(relationship_type);
```

---

### BOOT-003: task_lists table

```sql
-- File: database/migrations/052_task_lists.sql

CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_id TEXT,
  idea_slug TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'failed', 'archived'
  )),
  telegram_chat_id TEXT UNIQUE,
  user_approval_required INTEGER DEFAULT 1,
  auto_execute_low_risk INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  current_task_id TEXT,
  priority INTEGER DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_lists_status ON task_lists(status);
CREATE INDEX IF NOT EXISTS idx_task_lists_project ON task_lists(project_id);
```

---

### BOOT-004: task_list_items junction table

```sql
-- File: database/migrations/053_task_list_items.sql

CREATE TABLE IF NOT EXISTS task_list_items (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  item_status TEXT DEFAULT 'pending' CHECK (item_status IN (
    'pending', 'in_progress', 'completed', 'failed', 'skipped'
  )),
  started_at TEXT,
  completed_at TEXT,
  execution_notes TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_list_id, task_id),
  UNIQUE(task_list_id, position)
);

CREATE INDEX IF NOT EXISTS idx_list_items_list ON task_list_items(task_list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_task ON task_list_items(task_id);
CREATE INDEX IF NOT EXISTS idx_list_items_status ON task_list_items(item_status);
```

---

### BOOT-005: validation_rules table

```sql
-- File: database/migrations/054_validation_rules.sql

CREATE TABLE IF NOT EXISTS validation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'required_field', 'test_required', 'pattern_match', 'custom', 'ambiguity_check'
  )),
  category_filter TEXT,
  config TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  blocking INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO validation_rules (id, name, rule_type, config, severity, blocking) VALUES
  ('vr-001', 'title_required', 'required_field', '{"field":"title","minLength":10}', 'error', 1),
  ('vr-002', 'description_required', 'required_field', '{"field":"description","minLength":50}', 'error', 1),
  ('vr-003', 'category_required', 'required_field', '{"field":"category"}', 'error', 1),
  ('vr-004', 'acceptance_criteria_required', 'required_field', '{"field":"acceptance_criteria","minItems":1}', 'error', 1),
  ('vr-005', 'codebase_tests_required', 'test_required', '{"testType":"codebase","categories":["feature","improvement","bug"]}', 'warning', 0);
```

---

### BOOT-006: Run migrations

```bash
npm run migrate
```

**Validate:**

```bash
sqlite3 database/ideas.db ".tables" | grep -E "tasks|task_lists|task_list_items|task_relationships|validation_rules"
```

---

### BOOT-007: TypeScript types

**File:** `types/task-agent.ts`

See full content in TASK-AGENT-BOOTSTRAP-PLAN.md section "BOOT-007".

Key interfaces:

- `Task` - main task entity
- `TaskList` - grouped tasks
- `TaskRelationship` - dependency links
- `TaskListItem` - junction record

**Validate:** `npx tsc --noEmit types/task-agent.ts`

---

### BOOT-008: Validation types

**File:** `types/task-validation.ts`

```typescript
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  ruleType:
    | "required_field"
    | "test_required"
    | "pattern_match"
    | "custom"
    | "ambiguity_check";
  categoryFilter?: string;
  config: Record<string, any>;
  severity: "error" | "warning" | "info";
  blocking: boolean;
  enabled: boolean;
}

export interface ValidationIssue {
  ruleId: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
  blocking: boolean;
  suggestedFix?: string;
}

export interface ValidationResult {
  valid: boolean;
  blocking: boolean;
  issues: ValidationIssue[];
  passedRules: string[];
}
```

---

### BOOT-009: Tasks API routes

**File:** `server/routes/tasks-v2.ts`

Endpoints:

- `GET /api/v2/tasks` - List tasks (with filters)
- `POST /api/v2/tasks` - Create task
- `GET /api/v2/tasks/:id` - Get task
- `PUT /api/v2/tasks/:id` - Update task
- `DELETE /api/v2/tasks/:id` - Delete task
- `POST /api/v2/tasks/:id/status` - Update status

See full implementation in TASK-AGENT-BOOTSTRAP-PLAN.md.

---

### BOOT-010: Task Lists API routes

**File:** `server/routes/task-lists-v2.ts`

Endpoints:

- `GET /api/v2/task-lists` - List task lists
- `POST /api/v2/task-lists` - Create list
- `GET /api/v2/task-lists/:id` - Get list with items
- `PUT /api/v2/task-lists/:id` - Update list
- `DELETE /api/v2/task-lists/:id` - Delete list
- `POST /api/v2/task-lists/:id/items` - Add task to list
- `DELETE /api/v2/task-lists/:id/items/:taskId` - Remove task

---

### BOOT-011: Mount routes

**File:** `server/api.ts`

Add:

```typescript
import tasksV2Router from "./routes/tasks-v2";
import taskListsV2Router from "./routes/task-lists-v2";

// After other route mounts:
app.use("/api/v2/tasks", tasksV2Router);
app.use("/api/v2/task-lists", taskListsV2Router);
```

---

### BOOT-012: WebSocket events

**File:** `server/websocket.ts`

Add to broadcast events:

```typescript
// Task events
"task:created";
"task:updated";
"task:deleted";
"task:status_changed";
"tasklist:created";
"tasklist:updated";
"tasklist:item_added";
```

---

### BOOT-013: Import script

**File:** `scripts/import-tasks.ts`

See full implementation in TASK-AGENT-BOOTSTRAP-PLAN.md.

Function:

1. Parse YAML blocks from TAK-TASK-AGENT.md
2. Map to database schema
3. Insert tasks and relationships
4. Create task list for Task Agent work

---

### BOOT-014: Execute import

```bash
npx ts-node scripts/import-tasks.ts
```

**Validate:**

```bash
sqlite3 database/ideas.db "SELECT COUNT(*) FROM tasks WHERE id LIKE 'TAK-%'"
# Expected: ~47 tasks
```

---

## Completion Checklist

- [ ] BOOT-001: tasks table created
- [ ] BOOT-002: task_relationships table created
- [ ] BOOT-003: task_lists table created
- [ ] BOOT-004: task_list_items table created
- [ ] BOOT-005: validation_rules table + defaults
- [ ] BOOT-006: All migrations ran successfully
- [ ] BOOT-007: TypeScript types compile
- [ ] BOOT-008: Validation types compile
- [ ] BOOT-009: Tasks API responds
- [ ] BOOT-010: Task Lists API responds
- [ ] BOOT-011: Routes mounted in api.ts
- [ ] BOOT-012: WebSocket events fire
- [ ] BOOT-013: Import script created
- [ ] BOOT-014: TAK-\* tasks imported to DB

**Bootstrap Complete!** Task Agent is now self-hosting.
