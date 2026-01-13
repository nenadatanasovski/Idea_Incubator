# Task Agent Bootstrap Tasks

**Created:** 2026-01-13
**Agent:** Task Agent Bootstrap (BOOT)
**Status:** Ready for Execution
**Total Tasks:** 14
**Priority:** P1

---

## Overview

Minimal bootstrap to get Task Agent self-hosting. Once complete, all remaining TAK-* tasks will be managed via the database.

### Task Naming Convention

`{USER_ID}-{SCOPE_ID}-{TYPE}-{NUMBER}`

For bootstrap: `NA-BOOT-INF-{NUMBER}` (infrastructure tasks for bootstrap)

---

## Phase 1: Database Schema

### NA-BOOT-INF-001
```yaml
id: NA-BOOT-INF-001
phase: database
action: CREATE
file: "database/migrations/050_tasks_schema.sql"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create tasks table migration"
description: |
  Create the core tasks table that serves as the single source of truth
  for all task data. This replaces MD-based task storage per architecture
  decision Q29.

requirements:
  - "Create tasks table with all fields from task-data-model.md"
  - "Include user_id, project_id, idea_id relationships"
  - "Add three-level test columns: codebase_tests, api_tests, ui_tests"
  - "Include priority_score, blocks_count, is_quick_win for computed priority"
  - "Add acceptance_criteria as JSON array"
  - "Include affected_files, execution_log as JSON"
  - "Add embedding BLOB for similarity search"

gotchas:
  - "Use TEXT for dates in SQLite, not DATETIME"
  - "Always include IF NOT EXISTS for idempotency"
  - "JSON columns stored as TEXT in SQLite"
  - "Foreign keys need PRAGMA foreign_keys = ON to enforce"

validation:
  command: "sqlite3 database/ideas.db < database/migrations/050_tasks_schema.sql && sqlite3 database/ideas.db '.schema tasks'"
  expected: "Table schema output showing all columns"

codebase_tests:
  - "npm run migrate"
  - "sqlite3 database/ideas.db '.tables' | grep tasks"

api_tests: []
ui_tests: []

code_template: |
  -- Migration 050: Tasks schema for Task Agent
  -- Created: 2026-01-13
  -- DB is single source of truth (per task-data-model.md)

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,                    -- e.g., "NA-VIBE-FEA-001"

    -- Identifiers
    user_id TEXT NOT NULL DEFAULT 'default',
    project_id TEXT,
    idea_id TEXT,
    parent_task_id TEXT REFERENCES tasks(id),

    -- Core content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,                 -- feature, bug, infrastructure, etc.

    -- Status
    status TEXT NOT NULL DEFAULT 'draft',   -- draft, pending, blocked, in_progress, etc.
    risk_level TEXT NOT NULL DEFAULT 'medium',

    -- Priority (computed per Q15)
    priority_score INTEGER DEFAULT 0,
    blocks_count INTEGER DEFAULT 0,
    is_quick_win INTEGER DEFAULT 0,
    deadline TEXT,

    -- Acceptance Criteria (JSON array)
    acceptance_criteria TEXT NOT NULL DEFAULT '[]',

    -- Three-Level Test Cases (JSON arrays per Q5, Q26)
    codebase_tests TEXT NOT NULL DEFAULT '[]',
    api_tests TEXT NOT NULL DEFAULT '[]',
    ui_tests TEXT NOT NULL DEFAULT '[]',

    -- Execution metadata
    assigned_agent TEXT,
    estimated_effort TEXT,                  -- trivial, small, medium, large, epic
    actual_effort_minutes INTEGER,
    affected_files TEXT DEFAULT '[]',       -- JSON array
    execution_log TEXT DEFAULT '[]',        -- JSON array of attempts

    -- Version control
    version INTEGER NOT NULL DEFAULT 1,
    supersedes_task_id TEXT REFERENCES tasks(id),

    -- Embeddings for similarity search
    embedding BLOB,
    embedding_model TEXT,

    -- Metadata
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  );

  -- Essential indexes
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_idea ON tasks(idea_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
  CREATE INDEX IF NOT EXISTS idx_tasks_risk ON tasks(risk_level);
  CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_score DESC);

depends_on: []

acceptance_criteria:
  - "Table creates successfully without errors"
  - "All columns from task-data-model.md present"
  - "Indexes created for status, category, priority"
  - "Can INSERT and SELECT sample task"
```

---

### NA-BOOT-INF-002
```yaml
id: NA-BOOT-INF-002
phase: database
action: CREATE
file: "database/migrations/051_task_relationships.sql"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create task_relationships table migration"
description: |
  Create table supporting all 11 relationship types between tasks
  per architecture decision Q3. Enables dependency tracking, duplicate
  detection, and task linking.

requirements:
  - "Support all 11 relationship types from task-data-model.md"
  - "Include strength field for similarity scores (0-1)"
  - "Add unique constraint on source+target+type"
  - "Prevent self-referential relationships"
  - "CASCADE delete when source/target task deleted"

gotchas:
  - "CHECK constraint must list all 11 types explicitly"
  - "source_task_id != target_task_id prevents self-links"

validation:
  command: "sqlite3 database/ideas.db < database/migrations/051_task_relationships.sql && echo 'OK'"
  expected: "OK"

codebase_tests:
  - "sqlite3 database/ideas.db '.schema task_relationships'"

api_tests: []
ui_tests: []

code_template: |
  -- Migration 051: Task relationships (11 types per Q3)
  -- Created: 2026-01-13

  CREATE TABLE IF NOT EXISTS task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
      'depends_on',      -- Must complete target first
      'blocks',          -- Source prevents target from starting
      'related_to',      -- Semantic relationship
      'duplicate_of',    -- Same task (for merge)
      'subtask_of',      -- Parent-child hierarchy
      'supersedes',      -- Source replaces target (versioning)
      'implements',      -- Source implements target spec
      'conflicts_with',  -- Cannot run simultaneously
      'enables',         -- Soft dependency
      'inspired_by',     -- Conceptual link
      'tests'            -- Source tests target
    )),

    strength REAL,       -- 0-1 for similarity scores
    notes TEXT,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT,

    UNIQUE(source_task_id, target_task_id, relationship_type),
    CHECK(source_task_id != target_task_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rel_source ON task_relationships(source_task_id);
  CREATE INDEX IF NOT EXISTS idx_rel_target ON task_relationships(target_task_id);
  CREATE INDEX IF NOT EXISTS idx_rel_type ON task_relationships(relationship_type);

depends_on:
  - "NA-BOOT-INF-001"

acceptance_criteria:
  - "Table creates with all 11 relationship types"
  - "Cannot insert self-referential relationship"
  - "Unique constraint prevents duplicate relationships"
```

---

### NA-BOOT-INF-003
```yaml
id: NA-BOOT-INF-003
phase: database
action: CREATE
file: "database/migrations/052_task_lists.sql"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create task_lists table migration"
description: |
  Create task_lists table for grouped task execution per Q24, Q31.
  Each list maps to exactly one Telegram chat per Q25.

requirements:
  - "Support draft, active, paused, completed, failed, archived statuses"
  - "Link to exactly one Telegram chat (UNIQUE constraint)"
  - "Track execution progress (total, completed, failed counts)"
  - "Include user_approval_required and auto_execute_low_risk toggles"
  - "Support priority ordering of lists"

gotchas:
  - "telegram_chat_id must be UNIQUE for one-chat-per-list design"
  - "current_task_id tracks which task is actively executing"

validation:
  command: "sqlite3 database/ideas.db < database/migrations/052_task_lists.sql && echo 'OK'"
  expected: "OK"

codebase_tests:
  - "sqlite3 database/ideas.db '.schema task_lists'"

api_tests: []
ui_tests: []

code_template: |
  -- Migration 052: Task lists for grouped execution
  -- Created: 2026-01-13
  -- One Telegram chat per list (Q25)

  CREATE TABLE IF NOT EXISTS task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    -- Scope (hierarchical per Q2)
    user_id TEXT NOT NULL DEFAULT 'default',
    project_id TEXT,
    idea_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
      'draft', 'active', 'paused', 'completed', 'failed', 'archived'
    )),

    -- Settings (toggles per Q5, Q8)
    user_approval_required INTEGER NOT NULL DEFAULT 1,
    auto_execute_low_risk INTEGER NOT NULL DEFAULT 0,
    auto_answer_medium_low INTEGER NOT NULL DEFAULT 0,

    -- Telegram integration (one chat per list per Q25)
    telegram_chat_id TEXT UNIQUE,

    -- Progress tracking
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

  CREATE INDEX IF NOT EXISTS idx_task_lists_user ON task_lists(user_id);
  CREATE INDEX IF NOT EXISTS idx_task_lists_status ON task_lists(status);
  CREATE INDEX IF NOT EXISTS idx_task_lists_project ON task_lists(project_id);
  CREATE INDEX IF NOT EXISTS idx_task_lists_telegram ON task_lists(telegram_chat_id);

depends_on:
  - "NA-BOOT-INF-001"

acceptance_criteria:
  - "Table creates with all status options"
  - "telegram_chat_id UNIQUE constraint enforced"
  - "Can track progress counters"
```

---

### NA-BOOT-INF-004
```yaml
id: NA-BOOT-INF-004
phase: database
action: CREATE
file: "database/migrations/053_task_list_items.sql"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create task_list_items junction table migration"
description: |
  Create junction table linking tasks to lists with ordering.
  Supports many-to-many per Q1 (same task can be in multiple lists).

requirements:
  - "Track position within list for ordering"
  - "Item-level status (can differ from task status)"
  - "CASCADE delete when list or task deleted"
  - "UNIQUE constraint on list+task and list+position"

gotchas:
  - "position must be unique within a list"
  - "item_status tracks list-specific progress"

validation:
  command: "sqlite3 database/ideas.db < database/migrations/053_task_list_items.sql && echo 'OK'"
  expected: "OK"

codebase_tests:
  - "sqlite3 database/ideas.db '.schema task_list_items'"

api_tests: []
ui_tests: []

code_template: |
  -- Migration 053: Task list items (junction table per Q1)
  -- Created: 2026-01-13

  CREATE TABLE IF NOT EXISTS task_list_items (
    id TEXT PRIMARY KEY,
    task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Ordering within list
    position INTEGER NOT NULL,

    -- Item-level status (can differ from task status)
    item_status TEXT NOT NULL DEFAULT 'pending' CHECK (item_status IN (
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
  CREATE INDEX IF NOT EXISTS idx_list_items_position ON task_list_items(task_list_id, position);

depends_on:
  - "NA-BOOT-INF-001"
  - "NA-BOOT-INF-003"

acceptance_criteria:
  - "Junction table creates successfully"
  - "Can link same task to multiple lists"
  - "Position ordering enforced within list"
```

---

### NA-BOOT-INF-005
```yaml
id: NA-BOOT-INF-005
phase: database
action: CREATE
file: "database/migrations/054_validation_rules.sql"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create validation_rules table with defaults"
description: |
  Create configurable validation rules table with default rules
  for the validation gate per Q5.

requirements:
  - "Support rule types: required_field, test_required, pattern_match, custom, ambiguity_check"
  - "Allow category-specific rules via filter"
  - "Include severity levels: error, warning, info"
  - "blocking flag determines if rule prevents execution"
  - "Insert default validation rules"

gotchas:
  - "config is JSON - validate structure matches rule_type"
  - "category_filter NULL means applies to all categories"

validation:
  command: "sqlite3 database/ideas.db < database/migrations/054_validation_rules.sql && sqlite3 database/ideas.db 'SELECT COUNT(*) FROM validation_rules'"
  expected: "5 (default rules)"

codebase_tests:
  - "sqlite3 database/ideas.db 'SELECT name FROM validation_rules'"

api_tests: []
ui_tests: []

code_template: |
  -- Migration 054: Validation rules for Task Agent
  -- Created: 2026-01-13

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

  -- Default validation rules per Q5
  INSERT OR IGNORE INTO validation_rules (id, name, description, rule_type, config, severity, blocking) VALUES
    ('vr-001', 'title_required', 'Task must have title >= 10 chars', 'required_field', '{"field":"title","minLength":10}', 'error', 1),
    ('vr-002', 'description_required', 'Task must have description >= 50 chars', 'required_field', '{"field":"description","minLength":50}', 'error', 1),
    ('vr-003', 'category_required', 'Task must have category', 'required_field', '{"field":"category"}', 'error', 1),
    ('vr-004', 'acceptance_criteria_required', 'Task must have at least 1 acceptance criterion', 'required_field', '{"field":"acceptance_criteria","minItems":1}', 'error', 1),
    ('vr-005', 'codebase_tests_recommended', 'Feature/bug tasks should have codebase tests', 'test_required', '{"testType":"codebase","categories":["feature","improvement","bug"]}', 'warning', 0);

depends_on: []

acceptance_criteria:
  - "Table creates with rule type constraints"
  - "5 default rules inserted"
  - "Rules can be queried by category_filter"
```

---

### NA-BOOT-INF-006
```yaml
id: NA-BOOT-INF-006
phase: database
action: VERIFY
file: "database/ideas.db"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Run migrations and verify schema"
description: |
  Execute all bootstrap migrations and verify tables created correctly.
  Test with sample data insertions.

requirements:
  - "Run npm run migrate successfully"
  - "Verify all 5 new tables exist"
  - "Insert and query sample task"
  - "Insert and query sample task list with items"
  - "Verify relationship constraints work"

gotchas:
  - "Run migrations in order (050, 051, 052, 053, 054)"
  - "Foreign key constraints require correct order"

validation:
  command: "npm run migrate && sqlite3 database/ideas.db '.tables' | grep -E 'tasks|task_lists|task_list_items|task_relationships|validation_rules'"
  expected: "All 5 tables listed"

codebase_tests:
  - "npm run migrate"
  - "sqlite3 database/ideas.db '.tables'"
  - "sqlite3 database/ideas.db \"INSERT INTO tasks (id, title, description, category, created_by) VALUES ('TEST-001', 'Test Task', 'Test description for verification', 'infrastructure', 'test')\""
  - "sqlite3 database/ideas.db \"SELECT * FROM tasks WHERE id = 'TEST-001'\""
  - "sqlite3 database/ideas.db \"DELETE FROM tasks WHERE id = 'TEST-001'\""

api_tests: []
ui_tests: []

depends_on:
  - "NA-BOOT-INF-001"
  - "NA-BOOT-INF-002"
  - "NA-BOOT-INF-003"
  - "NA-BOOT-INF-004"
  - "NA-BOOT-INF-005"

acceptance_criteria:
  - "All migrations run without errors"
  - "5 new tables visible in schema"
  - "Sample data can be inserted and queried"
  - "Foreign key relationships work correctly"
```

---

## Phase 2: TypeScript Types

### NA-BOOT-INF-007
```yaml
id: NA-BOOT-INF-007
phase: types
action: CREATE
file: "types/task-agent.ts"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create Task Agent TypeScript types"
description: |
  Define TypeScript interfaces matching database schema.
  Export for use by API routes and services.

requirements:
  - "Define Task interface with all DB fields"
  - "Define TaskCategory and TaskStatus types"
  - "Define TaskList, TaskListItem, TaskRelationship interfaces"
  - "Define RelationshipType with all 11 types"
  - "Use string for IDs (UUIDs), string for dates (ISO)"

gotchas:
  - "JSON columns in DB become arrays/objects in TS"
  - "Optional fields use ? not null"
  - "Match field names to DB (camelCase in TS, snake_case in DB)"

validation:
  command: "npx tsc --noEmit types/task-agent.ts"
  expected: "exit code 0"

codebase_tests:
  - "npx tsc --noEmit"

api_tests: []
ui_tests: []

code_template: |
  // types/task-agent.ts
  // Task Agent Types - matches database schema from task-data-model.md

  export type TaskCategory =
    | 'feature' | 'improvement' | 'bug' | 'investigation'
    | 'technical_debt' | 'infrastructure' | 'documentation'
    | 'refactoring' | 'security' | 'performance' | 'testing'
    | 'migration' | 'integration' | 'ux_design' | 'maintenance'
    | 'decommissioned';

  export type TaskStatus =
    | 'draft' | 'pending' | 'blocked' | 'in_progress'
    | 'validating' | 'failed' | 'stale' | 'completed' | 'cancelled';

  export type RelationshipType =
    | 'depends_on' | 'blocks' | 'related_to' | 'duplicate_of'
    | 'subtask_of' | 'supersedes' | 'implements' | 'conflicts_with'
    | 'enables' | 'inspired_by' | 'tests';

  export type RiskLevel = 'low' | 'medium' | 'high';
  export type EffortBucket = 'trivial' | 'small' | 'medium' | 'large' | 'epic';

  export interface Task {
    id: string;
    userId: string;
    projectId?: string;
    ideaId?: string;
    parentTaskId?: string;

    title: string;
    description: string;
    category: TaskCategory;
    status: TaskStatus;
    riskLevel: RiskLevel;

    priorityScore: number;
    blocksCount: number;
    isQuickWin: boolean;
    deadline?: string;

    acceptanceCriteria: string[];
    codebaseTests: string[];
    apiTests: string[];
    uiTests: string[];

    assignedAgent?: string;
    estimatedEffort?: EffortBucket;
    actualEffortMinutes?: number;
    affectedFiles: string[];
    executionLog: ExecutionAttempt[];

    version: number;
    supersedesTaskId?: string;

    createdBy: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
  }

  export interface ExecutionAttempt {
    attempt: number;
    startedAt: string;
    endedAt?: string;
    status: 'running' | 'completed' | 'failed';
    agentId?: string;
    error?: string;
  }

  export interface TaskList {
    id: string;
    name: string;
    description?: string;
    userId: string;
    projectId?: string;
    ideaId?: string;
    status: 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'archived';
    userApprovalRequired: boolean;
    autoExecuteLowRisk: boolean;
    autoAnswerMediumLow: boolean;
    telegramChatId?: string;
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

  // Database row types (snake_case)
  export interface TaskRow {
    id: string;
    user_id: string;
    project_id: string | null;
    idea_id: string | null;
    parent_task_id: string | null;
    title: string;
    description: string;
    category: string;
    status: string;
    risk_level: string;
    priority_score: number;
    blocks_count: number;
    is_quick_win: number;
    deadline: string | null;
    acceptance_criteria: string;
    codebase_tests: string;
    api_tests: string;
    ui_tests: string;
    assigned_agent: string | null;
    estimated_effort: string | null;
    actual_effort_minutes: number | null;
    affected_files: string;
    execution_log: string;
    version: number;
    supersedes_task_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

depends_on:
  - "NA-BOOT-INF-006"

acceptance_criteria:
  - "All interfaces compile without errors"
  - "Types match database schema"
  - "Exported for use by other modules"
```

---

### NA-BOOT-INF-008
```yaml
id: NA-BOOT-INF-008
phase: types
action: CREATE
file: "types/task-validation.ts"
status: pending
priority: P1
category: infrastructure
risk_level: low

title: "Create Task validation TypeScript types"
description: |
  Define types for validation rules and results used by validation gate.

requirements:
  - "Define ValidationRule interface matching DB"
  - "Define ValidationIssue for individual problems"
  - "Define ValidationResult for overall validation"
  - "Include suggestedFix for auto-fixable issues"

validation:
  command: "npx tsc --noEmit types/task-validation.ts"
  expected: "exit code 0"

codebase_tests:
  - "npx tsc --noEmit"

api_tests: []
ui_tests: []

code_template: |
  // types/task-validation.ts
  // Validation types for Task Agent validation gate

  export type RuleType =
    | 'required_field'
    | 'test_required'
    | 'pattern_match'
    | 'custom'
    | 'ambiguity_check';

  export type Severity = 'error' | 'warning' | 'info';

  export interface ValidationRule {
    id: string;
    name: string;
    description?: string;
    ruleType: RuleType;
    categoryFilter?: string;
    config: Record<string, unknown>;
    severity: Severity;
    blocking: boolean;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface ValidationIssue {
    ruleId: string;
    ruleName: string;
    field: string;
    message: string;
    severity: Severity;
    blocking: boolean;
    autoFixable: boolean;
    suggestedFix?: string;
  }

  export interface ValidationResult {
    taskId: string;
    valid: boolean;
    blocking: boolean;
    issues: ValidationIssue[];
    passedRules: string[];
    skippedRules: string[];
    validatedAt: string;
  }

  // Rule config types
  export interface RequiredFieldConfig {
    field: string;
    minLength?: number;
    minItems?: number;
  }

  export interface TestRequiredConfig {
    testType: 'codebase' | 'api' | 'ui';
    categories: string[];
    condition?: string;
  }

  export interface PatternMatchConfig {
    field: string;
    pattern: string;
    flags?: string;
  }

  export interface AmbiguityCheckConfig {
    threshold: number;
    vagueTerms: string[];
  }

depends_on:
  - "NA-BOOT-INF-006"

acceptance_criteria:
  - "Types compile without errors"
  - "Config types match database JSON structure"
```

---

## Phase 3: API Routes

### NA-BOOT-INF-009
```yaml
id: NA-BOOT-INF-009
phase: api
action: CREATE
file: "server/routes/tasks-v2.ts"
status: pending
priority: P1
category: feature
risk_level: medium

title: "Create Tasks API v2 routes"
description: |
  REST API for task CRUD operations using new database schema.
  V2 to avoid conflicts with existing task routes.

requirements:
  - "GET /api/v2/tasks - List tasks with filters (status, category, project)"
  - "POST /api/v2/tasks - Create task"
  - "GET /api/v2/tasks/:id - Get task by ID"
  - "PUT /api/v2/tasks/:id - Update task"
  - "DELETE /api/v2/tasks/:id - Delete task"
  - "POST /api/v2/tasks/:id/status - Update status with timestamp"
  - "Parse JSON columns on read, stringify on write"

gotchas:
  - "JSON columns need JSON.parse/JSON.stringify"
  - "snake_case in DB, camelCase in API response"
  - "Return 404 for non-existent tasks"

validation:
  command: "npx tsc --noEmit server/routes/tasks-v2.ts"
  expected: "exit code 0"

codebase_tests:
  - "npx tsc --noEmit"

api_tests:
  - "curl -X POST http://localhost:3001/api/v2/tasks -H 'Content-Type: application/json' -d '{\"title\":\"Test\",\"description\":\"Test description here\",\"category\":\"infrastructure\"}'"
  - "curl http://localhost:3001/api/v2/tasks"

ui_tests: []

depends_on:
  - "NA-BOOT-INF-007"
  - "NA-BOOT-INF-008"

acceptance_criteria:
  - "All CRUD endpoints respond correctly"
  - "Filters work for status, category, project"
  - "JSON columns properly parsed"
  - "Proper error responses (404, 400, 500)"
```

---

### NA-BOOT-INF-010
```yaml
id: NA-BOOT-INF-010
phase: api
action: CREATE
file: "server/routes/task-lists-v2.ts"
status: pending
priority: P1
category: feature
risk_level: medium

title: "Create Task Lists API v2 routes"
description: |
  REST API for task list management with item operations.

requirements:
  - "GET /api/v2/task-lists - List all task lists"
  - "POST /api/v2/task-lists - Create task list"
  - "GET /api/v2/task-lists/:id - Get list with items"
  - "PUT /api/v2/task-lists/:id - Update list"
  - "DELETE /api/v2/task-lists/:id - Delete list (cascades items)"
  - "POST /api/v2/task-lists/:id/items - Add task to list"
  - "DELETE /api/v2/task-lists/:id/items/:taskId - Remove task"
  - "PUT /api/v2/task-lists/:id/items/:taskId - Update item status/position"

gotchas:
  - "Position must be managed when adding/removing items"
  - "Update total_tasks count when items change"

validation:
  command: "npx tsc --noEmit server/routes/task-lists-v2.ts"
  expected: "exit code 0"

codebase_tests:
  - "npx tsc --noEmit"

api_tests:
  - "curl -X POST http://localhost:3001/api/v2/task-lists -H 'Content-Type: application/json' -d '{\"name\":\"Test List\"}'"

ui_tests: []

depends_on:
  - "NA-BOOT-INF-007"

acceptance_criteria:
  - "List CRUD works"
  - "Items can be added/removed"
  - "Position ordering maintained"
  - "Progress counts update correctly"
```

---

### NA-BOOT-INF-011
```yaml
id: NA-BOOT-INF-011
phase: api
action: UPDATE
file: "server/api.ts"
status: pending
priority: P1
category: integration
risk_level: low

title: "Mount v2 task routes in API"
description: |
  Import and mount the new v2 task and task-list routes.

requirements:
  - "Import tasks-v2 router"
  - "Import task-lists-v2 router"
  - "Mount at /api/v2/tasks"
  - "Mount at /api/v2/task-lists"

gotchas:
  - "Don't conflict with existing /api/tasks routes"
  - "V2 routes are new schema, existing routes stay"

validation:
  command: "curl http://localhost:3001/api/v2/tasks"
  expected: "JSON response (not 404)"

codebase_tests:
  - "npx tsc --noEmit"
  - "npm run dev (verify no startup errors)"

api_tests:
  - "curl http://localhost:3001/api/v2/tasks"
  - "curl http://localhost:3001/api/v2/task-lists"

ui_tests: []

code_template: |
  // Add to server/api.ts imports:
  import tasksV2Router from './routes/tasks-v2';
  import taskListsV2Router from './routes/task-lists-v2';

  // Add after other route mounts:
  app.use('/api/v2/tasks', tasksV2Router);
  app.use('/api/v2/task-lists', taskListsV2Router);

depends_on:
  - "NA-BOOT-INF-009"
  - "NA-BOOT-INF-010"

acceptance_criteria:
  - "Routes respond at /api/v2/tasks"
  - "Routes respond at /api/v2/task-lists"
  - "No conflicts with existing routes"
```

---

### NA-BOOT-INF-012
```yaml
id: NA-BOOT-INF-012
phase: api
action: UPDATE
file: "server/websocket.ts"
status: pending
priority: P1
category: integration
risk_level: low

title: "Add task WebSocket events"
description: |
  Add WebSocket event broadcasting for task changes.

requirements:
  - "Add task:created event"
  - "Add task:updated event"
  - "Add task:deleted event"
  - "Add task:status_changed event"
  - "Add tasklist:created, tasklist:updated events"
  - "Add tasklist:item_added, tasklist:item_removed events"

gotchas:
  - "Use existing WebSocket broadcast infrastructure"
  - "Include task/list ID in event payload"

validation:
  command: "npx tsc --noEmit server/websocket.ts"
  expected: "exit code 0"

codebase_tests:
  - "npx tsc --noEmit"

api_tests: []
ui_tests: []

depends_on:
  - "NA-BOOT-INF-011"

acceptance_criteria:
  - "Events broadcast when tasks created/updated/deleted"
  - "Events broadcast when lists change"
  - "WebSocket clients receive events"
```

---

## Phase 4: Import Script

### NA-BOOT-INF-013
```yaml
id: NA-BOOT-INF-013
phase: api
action: CREATE
file: "scripts/import-tak-tasks.ts"
status: pending
priority: P1
category: migration
risk_level: medium

title: "Create TAK task importer script"
description: |
  Parse YAML blocks from TAK-TASK-AGENT.md and import into database.
  Creates task list for Task Agent implementation work.

requirements:
  - "Parse all ```yaml blocks from TAK-TASK-AGENT.md"
  - "Extract task fields: id, phase, action, file, requirements, gotchas, etc."
  - "Map to database schema"
  - "Create TASKLIST-TASK-AGENT task list"
  - "Add all TAK-* tasks to the list"
  - "Create task_relationships for depends_on"

gotchas:
  - "YAML parsing needs yaml package"
  - "Some fields need array conversion"
  - "Handle missing optional fields"

validation:
  command: "npx ts-node scripts/import-tak-tasks.ts --dry-run"
  expected: "Lists tasks to import without inserting"

codebase_tests:
  - "npx tsc --noEmit scripts/import-tak-tasks.ts"

api_tests: []
ui_tests: []

depends_on:
  - "NA-BOOT-INF-011"

acceptance_criteria:
  - "Parses all TAK-* tasks from MD file"
  - "Creates tasks in database"
  - "Creates task list with all items"
  - "Dependencies created as relationships"
```

---

### NA-BOOT-INF-014
```yaml
id: NA-BOOT-INF-014
phase: api
action: EXECUTE
file: "scripts/import-tak-tasks.ts"
status: pending
priority: P1
category: migration
risk_level: medium

title: "Execute TAK task import"
description: |
  Run the import script to populate database with TAK-* tasks.
  Marks bootstrap complete - system is now self-hosting.

requirements:
  - "Run import script"
  - "Verify all TAK-* tasks imported"
  - "Verify task list created"
  - "Verify relationships created"
  - "Mark NA-BOOT-* tasks as completed"

validation:
  command: "sqlite3 database/ideas.db \"SELECT COUNT(*) FROM tasks WHERE id LIKE 'TAK-%'\""
  expected: ">= 40 tasks"

codebase_tests:
  - "npx ts-node scripts/import-tak-tasks.ts"
  - "sqlite3 database/ideas.db 'SELECT COUNT(*) FROM tasks'"
  - "sqlite3 database/ideas.db 'SELECT COUNT(*) FROM task_lists'"
  - "sqlite3 database/ideas.db 'SELECT COUNT(*) FROM task_list_items'"

api_tests:
  - "curl http://localhost:3001/api/v2/tasks | jq '.total'"
  - "curl http://localhost:3001/api/v2/task-lists"

ui_tests: []

depends_on:
  - "NA-BOOT-INF-013"

acceptance_criteria:
  - "40+ TAK-* tasks in database"
  - "TASKLIST-TASK-AGENT list created"
  - "Dependencies visible as relationships"
  - "Bootstrap tasks marked completed"
  - "System is now self-hosting"
```

---

## Summary

| Phase | Tasks | IDs |
|-------|-------|-----|
| Database | 6 | NA-BOOT-INF-001 to NA-BOOT-INF-006 |
| Types | 2 | NA-BOOT-INF-007 to NA-BOOT-INF-008 |
| API | 4 | NA-BOOT-INF-009 to NA-BOOT-INF-012 |
| Import | 2 | NA-BOOT-INF-013 to NA-BOOT-INF-014 |
| **Total** | **14** | |

---

## Dependency Graph

```
NA-BOOT-INF-001 (tasks table)
    │
    ├──► NA-BOOT-INF-002 (relationships)
    │
    ├──► NA-BOOT-INF-003 (task_lists)
    │       │
    │       └──► NA-BOOT-INF-004 (task_list_items)
    │
    └──────────────────────────────────────────┐
                                               │
NA-BOOT-INF-005 (validation_rules) ────────────┤
                                               │
                                               ▼
                                    NA-BOOT-INF-006 (verify)
                                               │
                                               ▼
                                    NA-BOOT-INF-007 (types)
                                    NA-BOOT-INF-008 (validation types)
                                               │
                                               ▼
                                    NA-BOOT-INF-009 (tasks API)
                                    NA-BOOT-INF-010 (lists API)
                                               │
                                               ▼
                                    NA-BOOT-INF-011 (mount routes)
                                               │
                                               ▼
                                    NA-BOOT-INF-012 (WebSocket)
                                               │
                                               ▼
                                    NA-BOOT-INF-013 (importer)
                                               │
                                               ▼
                                    NA-BOOT-INF-014 (execute import)
                                               │
                                               ▼
                                    ✅ SELF-HOSTING COMPLETE
```

---

## Post-Bootstrap

After NA-BOOT-INF-014 completes:
- All TAK-* tasks are in the database
- Task Agent can manage its own completion
- New tasks created via API, not MD files
- Single source of truth achieved
