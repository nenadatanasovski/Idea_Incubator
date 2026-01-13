# Task Agent Bootstrap Plan

**Created:** 2026-01-13
**Purpose:** Minimal bootstrap to get Task Agent online and self-hosting
**Status:** Ready for Execution

---

## Strategy Overview

The goal is to get the Task Agent system bootstrapped with the **minimum viable infrastructure** so it can manage its own remaining tasks. This creates a "self-hosting" loop:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BOOTSTRAP → SELF-HOSTING                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: Bootstrap (Human-Driven via Coding Agents)                │
│  ─────────────────────────────────────────────────────              │
│  • Create database migrations (050-054)                             │
│  • Create TypeScript types                                          │
│  • Create minimal API routes                                        │
│  • Create task importer script                                      │
│                                                                      │
│  PHASE 2: Self-Hosting Transition                                    │
│  ─────────────────────────────────────────────────────              │
│  • Import remaining TAK-* tasks into database                       │
│  • Task Agent manages its own completion                            │
│  • All new tasks created via API, stored in DB                      │
│                                                                      │
│  PHASE 3: Full Operation                                             │
│  ─────────────────────────────────────────────────────              │
│  • Task Agent online with Telegram integration                      │
│  • Continuous suggestion loop active                                │
│  • Self-improving via SIA integration                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Critical Path Analysis

### What Already Exists (Leverage)

| Component | Migration | Status |
|-----------|-----------|--------|
| `task_queue` | 034 | ✅ Has basic task storage |
| `executor_state` | 034 | ✅ Tracks executor status |
| `task_executions` | 025 | ✅ Individual task runs |
| `task_agent_bindings` | 035 | ✅ Agent assignments |
| `questions` | 030 | ✅ Question queue exists |
| `active_agents` | 030 | ✅ Agent registration |
| `notifications` | 030 | ✅ Notification delivery |

### What's Missing (Must Build)

| Component | Migration | Priority | Blocks |
|-----------|-----------|----------|--------|
| `tasks` table | 050 | P1 | Everything |
| `task_relationships` | 051 | P1 | Dependencies, duplicates |
| `task_lists` | 052 | P1 | Grouped execution |
| `task_list_items` | 053 | P1 | List membership |
| `validation_rules` | 054 | P1 | Validation gate |
| TypeScript types | - | P1 | All services |
| Task CRUD API | - | P1 | Frontend, importers |
| Task Importer | - | P1 | Self-hosting |

---

## Bootstrap Task List (Simplified)

Below are the **minimal bootstrap tasks** with just IDs and descriptions. These are designed to be given directly to coding agents.

### Phase 1: Database (6 tasks)

| ID | Description | Depends On |
|----|-------------|------------|
| BOOT-001 | Create migration 050_tasks_schema.sql with tasks table | - |
| BOOT-002 | Create migration 051_task_relationships.sql with 11 relationship types | BOOT-001 |
| BOOT-003 | Create migration 052_task_lists.sql with task_lists table | BOOT-001 |
| BOOT-004 | Create migration 053_task_list_items.sql junction table | BOOT-001, BOOT-003 |
| BOOT-005 | Create migration 054_validation_rules.sql with default rules | - |
| BOOT-006 | Run migrations and verify schema with test data | BOOT-001 to BOOT-005 |

### Phase 2: Types (2 tasks)

| ID | Description | Depends On |
|----|-------------|------------|
| BOOT-007 | Create types/task-agent.ts with Task, TaskList, TaskRelationship interfaces | BOOT-006 |
| BOOT-008 | Create types/task-validation.ts with ValidationRule, ValidationResult interfaces | BOOT-006 |

### Phase 3: Core API (4 tasks)

| ID | Description | Depends On |
|----|-------------|------------|
| BOOT-009 | Create server/routes/tasks-v2.ts with CRUD endpoints | BOOT-007, BOOT-008 |
| BOOT-010 | Create server/routes/task-lists-v2.ts with list management | BOOT-007 |
| BOOT-011 | Add routes to server/api.ts at /api/v2/tasks and /api/v2/task-lists | BOOT-009, BOOT-010 |
| BOOT-012 | Add WebSocket events for task:created, task:updated, task:deleted | BOOT-011 |

### Phase 4: Importer (2 tasks)

| ID | Description | Depends On |
|----|-------------|------------|
| BOOT-013 | Create scripts/import-tasks.ts to parse TAK-TASK-AGENT.md YAML blocks | BOOT-011 |
| BOOT-014 | Import all TAK-* tasks into database, mark BOOT-* tasks as completed | BOOT-013 |

**Total Bootstrap Tasks: 14**

---

## Detailed Task Specifications

### BOOT-001: Create tasks table migration

**File:** `database/migrations/050_tasks_schema.sql`

```sql
-- Migration 050: Tasks schema for Task Agent
-- DB is single source of truth (per task-data-model.md)

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,                    -- e.g., "NA-VIBE-FEA-001"

  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Hierarchy
  parent_task_id TEXT REFERENCES tasks(id),
  project_id TEXT,
  idea_slug TEXT,

  -- Validation
  acceptance_criteria TEXT DEFAULT '[]',   -- JSON array
  codebase_tests TEXT DEFAULT '[]',        -- JSON array
  api_tests TEXT DEFAULT '[]',             -- JSON array
  ui_tests TEXT DEFAULT '[]',              -- JSON array

  -- Priority (computed)
  priority_score INTEGER DEFAULT 0,
  blocks_count INTEGER DEFAULT 0,
  is_quick_win INTEGER DEFAULT 0,
  deadline TEXT,

  -- Risk
  risk_level TEXT DEFAULT 'medium',

  -- Execution
  assigned_agent TEXT,
  estimated_effort TEXT,
  actual_effort_minutes INTEGER,
  affected_files TEXT DEFAULT '[]',        -- JSON array

  -- Version control
  version INTEGER DEFAULT 1,
  supersedes_task_id TEXT REFERENCES tasks(id),

  -- Metadata
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

**Validation:** `sqlite3 database/ideas.db < database/migrations/050_tasks_schema.sql`

---

### BOOT-002: Create task_relationships migration

**File:** `database/migrations/051_task_relationships.sql`

```sql
-- Migration 051: Task relationships (11 types per architecture)

CREATE TABLE IF NOT EXISTS task_relationships (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'depends_on',     -- Must complete first
    'blocks',         -- Prevents target from starting
    'related_to',     -- Semantic relationship
    'duplicate_of',   -- Same task
    'subtask_of',     -- Parent-child hierarchy
    'supersedes',     -- Replaces older task
    'implements',     -- Implements spec/requirement
    'conflicts_with', -- Cannot run together
    'enables',        -- Soft dependency
    'inspired_by',    -- Conceptual link
    'tests'           -- Tests another task
  )),

  strength REAL,      -- 0-1 for similarity scores
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

### BOOT-003: Create task_lists migration

**File:** `database/migrations/052_task_lists.sql`

```sql
-- Migration 052: Task lists for grouped execution

CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Scope
  project_id TEXT,
  idea_slug TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'failed', 'archived'
  )),

  -- Telegram integration (one chat per list)
  telegram_chat_id TEXT UNIQUE,

  -- Settings
  user_approval_required INTEGER DEFAULT 1,
  auto_execute_low_risk INTEGER DEFAULT 0,

  -- Progress
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  current_task_id TEXT,

  -- Priority for ordering lists
  priority INTEGER DEFAULT 0,

  -- Metadata
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

### BOOT-004: Create task_list_items migration

**File:** `database/migrations/053_task_list_items.sql`

```sql
-- Migration 053: Task list items (junction table)

CREATE TABLE IF NOT EXISTS task_list_items (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Ordering
  position INTEGER NOT NULL,

  -- Item-level status (can differ from task status)
  item_status TEXT DEFAULT 'pending' CHECK (item_status IN (
    'pending', 'in_progress', 'completed', 'failed', 'skipped'
  )),

  -- Execution metadata
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

### BOOT-005: Create validation_rules migration

**File:** `database/migrations/054_validation_rules.sql`

```sql
-- Migration 054: Validation rules for Task Agent

CREATE TABLE IF NOT EXISTS validation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,

  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'required_field',
    'test_required',
    'pattern_match',
    'custom',
    'ambiguity_check'
  )),

  category_filter TEXT,    -- NULL = all categories
  config TEXT NOT NULL,    -- JSON configuration
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  blocking INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default validation rules
INSERT OR IGNORE INTO validation_rules (id, name, rule_type, config, severity, blocking) VALUES
  ('vr-001', 'title_required', 'required_field', '{"field":"title","minLength":10}', 'error', 1),
  ('vr-002', 'description_required', 'required_field', '{"field":"description","minLength":50}', 'error', 1),
  ('vr-003', 'category_required', 'required_field', '{"field":"category"}', 'error', 1),
  ('vr-004', 'acceptance_criteria_required', 'required_field', '{"field":"acceptance_criteria","minItems":1}', 'error', 1),
  ('vr-005', 'codebase_tests_required', 'test_required', '{"testType":"codebase","categories":["feature","improvement","bug"]}', 'warning', 0);
```

---

### BOOT-007: Create TypeScript types

**File:** `types/task-agent.ts`

```typescript
// Task Agent Types - matches database schema

export type TaskCategory =
  | 'feature' | 'improvement' | 'bug' | 'investigation'
  | 'technical_debt' | 'infrastructure' | 'documentation'
  | 'refactoring' | 'security' | 'performance' | 'testing'
  | 'migration' | 'integration' | 'ux_design' | 'maintenance';

export type TaskStatus =
  | 'draft' | 'pending' | 'blocked' | 'in_progress'
  | 'validating' | 'failed' | 'stale' | 'completed' | 'cancelled';

export type RelationshipType =
  | 'depends_on' | 'blocks' | 'related_to' | 'duplicate_of'
  | 'subtask_of' | 'supersedes' | 'implements' | 'conflicts_with'
  | 'enables' | 'inspired_by' | 'tests';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;

  parentTaskId?: string;
  projectId?: string;
  ideaSlug?: string;

  acceptanceCriteria: string[];
  codebaseTests: string[];
  apiTests: string[];
  uiTests: string[];

  priorityScore: number;
  blocksCount: number;
  isQuickWin: boolean;
  deadline?: string;
  riskLevel: 'low' | 'medium' | 'high';

  assignedAgent?: string;
  estimatedEffort?: string;
  actualEffortMinutes?: number;
  affectedFiles: string[];

  version: number;
  supersedesTaskId?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskList {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  ideaSlug?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'archived';
  telegramChatId?: string;
  userApprovalRequired: boolean;
  autoExecuteLowRisk: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskId?: string;
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskRelationship {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationshipType: RelationshipType;
  strength?: number;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TaskListItem {
  id: string;
  taskListId: string;
  taskId: string;
  position: number;
  itemStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  executionNotes?: string;
  addedAt: string;
}
```

---

### BOOT-009: Create tasks API routes

**File:** `server/routes/tasks-v2.ts`

```typescript
// Task Agent API v2 - DB-backed task management
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/db';
import type { Task } from '../../types/task-agent';

const router = Router();

// GET /api/v2/tasks - List tasks
router.get('/', async (req, res) => {
  try {
    const { status, category, projectId, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY priority_score DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const tasks = db.prepare(sql).all(...params);
    res.json({ tasks, total: tasks.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/v2/tasks - Create task
router.post('/', async (req, res) => {
  try {
    const task: Partial<Task> = req.body;
    const id = task.id || `TASK-${uuidv4().slice(0, 8).toUpperCase()}`;

    const sql = `INSERT INTO tasks (
      id, title, description, category, status, parent_task_id, project_id, idea_slug,
      acceptance_criteria, codebase_tests, api_tests, ui_tests,
      priority_score, risk_level, estimated_effort, affected_files, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.prepare(sql).run(
      id,
      task.title,
      task.description,
      task.category || 'feature',
      task.status || 'draft',
      task.parentTaskId || null,
      task.projectId || null,
      task.ideaSlug || null,
      JSON.stringify(task.acceptanceCriteria || []),
      JSON.stringify(task.codebaseTests || []),
      JSON.stringify(task.apiTests || []),
      JSON.stringify(task.uiTests || []),
      task.priorityScore || 0,
      task.riskLevel || 'medium',
      task.estimatedEffort || null,
      JSON.stringify(task.affectedFiles || []),
      task.createdBy || 'system'
    );

    const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/v2/tasks/:id - Get task
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// PUT /api/v2/tasks/:id - Update task
router.put('/:id', (req, res) => {
  const updates = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  // Build dynamic update
  const fields = Object.keys(updates).filter(k => k !== 'id');
  const sql = `UPDATE tasks SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`;

  db.prepare(sql).run(...fields.map(f => {
    const val = updates[f];
    return Array.isArray(val) ? JSON.stringify(val) : val;
  }), req.params.id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/v2/tasks/:id - Delete task
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ deleted: true });
});

// POST /api/v2/tasks/:id/status - Update status
router.post('/:id/status', (req, res) => {
  const { status } = req.body;
  const now = new Date().toISOString();

  let extraFields = '';
  if (status === 'in_progress') extraFields = ', started_at = ?';
  if (status === 'completed') extraFields = ', completed_at = ?';

  const sql = `UPDATE tasks SET status = ?, updated_at = datetime('now')${extraFields} WHERE id = ?`;
  const params = extraFields ? [status, now, req.params.id] : [status, req.params.id];

  db.prepare(sql).run(...params);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
```

---

### BOOT-013: Create task importer script

**File:** `scripts/import-tasks.ts`

```typescript
#!/usr/bin/env npx ts-node
/**
 * Import tasks from TAK-TASK-AGENT.md into database
 *
 * Usage: npx ts-node scripts/import-tasks.ts
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

const SOURCE_FILE = 'docs/bootstrap/tasks/TAK-TASK-AGENT.md';

interface YamlTask {
  id: string;
  phase: string;
  action: string;
  file: string;
  status: string;
  priority: string;
  category: string;
  requirements?: string[];
  gotchas?: string[];
  validation?: { command: string; expected: string };
  depends_on?: string[];
  acceptance_criteria?: string[];
  code_template?: string;
}

function parseMarkdownTasks(content: string): YamlTask[] {
  const tasks: YamlTask[] = [];
  const yamlBlockRegex = /```yaml\n([\s\S]*?)```/g;

  let match;
  while ((match = yamlBlockRegex.exec(content)) !== null) {
    try {
      const parsed = yaml.parse(match[1]);
      if (parsed.id && parsed.id.startsWith('TAK-')) {
        tasks.push(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse YAML block:', e);
    }
  }

  return tasks;
}

function mapToDbTask(yamlTask: YamlTask) {
  return {
    id: yamlTask.id,
    title: `[${yamlTask.phase}] ${yamlTask.action} ${yamlTask.file}`,
    description: yamlTask.requirements?.join('\n') || `${yamlTask.action} ${yamlTask.file}`,
    category: yamlTask.category || 'infrastructure',
    status: yamlTask.status === 'pending' ? 'pending' : 'draft',
    priority_score: yamlTask.priority === 'P1' ? 100 : yamlTask.priority === 'P2' ? 50 : 25,
    risk_level: 'medium',
    acceptance_criteria: JSON.stringify(yamlTask.acceptance_criteria || yamlTask.requirements || []),
    codebase_tests: JSON.stringify(yamlTask.validation ? [yamlTask.validation.command] : []),
    api_tests: JSON.stringify([]),
    ui_tests: JSON.stringify([]),
    affected_files: JSON.stringify([yamlTask.file]),
    estimated_effort: yamlTask.phase === 'database' ? 'small' : 'medium',
    created_by: 'import-script'
  };
}

async function importTasks() {
  console.log('Reading TAK-TASK-AGENT.md...');
  const content = fs.readFileSync(path.join(process.cwd(), SOURCE_FILE), 'utf-8');

  console.log('Parsing YAML blocks...');
  const tasks = parseMarkdownTasks(content);
  console.log(`Found ${tasks.length} TAK-* tasks`);

  // Create task list for Task Agent implementation
  const listId = 'TASKLIST-TASK-AGENT';
  db.prepare(`
    INSERT OR REPLACE INTO task_lists (id, name, description, status, total_tasks, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(listId, 'Task Agent Implementation', 'All TAK-* tasks for Task Agent', 'draft', tasks.length, 'import-script');

  // Import each task
  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, title, description, category, status, priority_score, risk_level,
      acceptance_criteria, codebase_tests, api_tests, ui_tests, affected_files,
      estimated_effort, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertListItem = db.prepare(`
    INSERT OR REPLACE INTO task_list_items (id, task_list_id, task_id, position, item_status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertRelationship = db.prepare(`
    INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
    VALUES (?, ?, ?, ?)
  `);

  let position = 0;
  for (const yamlTask of tasks) {
    const dbTask = mapToDbTask(yamlTask);

    insertTask.run(
      dbTask.id, dbTask.title, dbTask.description, dbTask.category, dbTask.status,
      dbTask.priority_score, dbTask.risk_level, dbTask.acceptance_criteria,
      dbTask.codebase_tests, dbTask.api_tests, dbTask.ui_tests, dbTask.affected_files,
      dbTask.estimated_effort, dbTask.created_by
    );

    insertListItem.run(
      `${listId}-${dbTask.id}`,
      listId,
      dbTask.id,
      position++,
      'pending'
    );

    // Add dependencies
    if (yamlTask.depends_on) {
      for (const depId of yamlTask.depends_on) {
        insertRelationship.run(
          `rel-${dbTask.id}-${depId}`,
          dbTask.id,
          depId,
          'depends_on'
        );
      }
    }

    console.log(`  Imported: ${dbTask.id}`);
  }

  // Mark BOOT-* tasks as completed (since we just did them)
  db.prepare(`UPDATE tasks SET status = 'completed', completed_at = datetime('now') WHERE id LIKE 'BOOT-%'`).run();

  console.log(`\n✅ Imported ${tasks.length} tasks into task list: ${listId}`);
  console.log('Task Agent is now self-hosting!');
}

importTasks().catch(console.error);
```

---

## Execution Order

```
Week 1: Bootstrap
─────────────────
Day 1: BOOT-001, BOOT-002, BOOT-003, BOOT-004, BOOT-005
Day 2: BOOT-006 (run migrations, verify)
Day 3: BOOT-007, BOOT-008 (TypeScript types)
Day 4: BOOT-009, BOOT-010, BOOT-011
Day 5: BOOT-012, BOOT-013, BOOT-014

Self-Hosting Begins
───────────────────
From this point, all remaining TAK-* tasks are managed via:
- Database (single source of truth)
- API endpoints (/api/v2/tasks)
- Task Agent when Phase 3 completes
```

---

## Validation Commands

```bash
# Run migrations
npm run migrate

# Verify schema
sqlite3 database/ideas.db ".schema tasks"
sqlite3 database/ideas.db ".schema task_lists"

# Type check
npx tsc --noEmit types/task-agent.ts

# Test API (after server running)
curl http://localhost:3001/api/v2/tasks

# Import tasks
npx ts-node scripts/import-tasks.ts

# Verify import
sqlite3 database/ideas.db "SELECT COUNT(*) FROM tasks WHERE id LIKE 'TAK-%'"
```

---

## Post-Bootstrap: Remaining Work

After BOOT-014 completes, the following TAK-* tasks will be in the database and managed by the system:

| Phase | Task Count | Description |
|-------|------------|-------------|
| Core Services | 12 | ValidationGate, Deduplication, etc. |
| Telegram | 2 | Bot integration |
| WebSocket | 1 | Real-time events |
| Frontend | 6 | Dashboard, forms, graphs |
| Tests | 12 | Unit, API, UI, E2E |
| Documentation | 2 | CLAUDE.md, docs |
| Enhancements | 6 | P3 features |

**Total Remaining: ~41 tasks (managed in DB)**

---

## References

- `docs/architecture/task-agent-arch.md` - Full architecture
- `docs/architecture/task-data-model.md` - Database schema
- `docs/bootstrap/tasks/TAK-TASK-AGENT.md` - Detailed task specs
- `docs/architecture/TASK-AGENT-TASKS.md` - Original task breakdown
