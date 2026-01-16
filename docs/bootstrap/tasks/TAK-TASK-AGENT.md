# Task Agent Implementation Tasks

**Created:** 2026-01-12
**Updated:** 2026-01-12
**Agent:** Task Agent (TAK)
**Status:** Planning
**Estimated Tasks:** 57
**Priority:** P1

---

## Overview

Implementation of the always-on Task Agent for the Vibe platform with:

- Telegram bot interface (one chat per task list)
- Validation gate (blocks execution on missing fields/tests)
- Deduplication/merge capabilities
- Dependency management (11 relationship types)
- Proactive completion detection
- Continuous suggestion loop
- Priority-based task recommendation
- Task lists for grouped execution
- Three-level test framework (Codebase + API + UI via MCP Puppeteer)

### Task Naming Convention

`{USER_ID}-{SCOPE_ID}-{TYPE}-{NUMBER}[-{SUBTASK}-{VERSION}]`

Example: `TU-VIBE-FEA-001` for user TU, project VIBE, feature #001

### Architecture References

- `docs/architecture/task-agent-arch.md` - Full architecture
- `docs/architecture/task-data-model.md` - Database schema
- `docs/architecture/task-agent-test-plan.md` - Test plan

---

## Task Categories

| Category         | Prefix | Description                       |
| ---------------- | ------ | --------------------------------- |
| `feature`        | FEA    | New functionality                 |
| `improvement`    | IMP    | Enhancement to existing           |
| `bug`            | BUG    | Defect fix                        |
| `investigation`  | INV    | Research/spike                    |
| `technical_debt` | TDB    | Code quality improvements         |
| `infrastructure` | INF    | DevOps/CI/CD                      |
| `documentation`  | DOC    | Docs only                         |
| `refactoring`    | REF    | Structure without behavior change |
| `security`       | SEC    | Security-related                  |
| `performance`    | PER    | Optimization                      |
| `testing`        | TST    | Test coverage                     |
| `migration`      | MIG    | Data/schema/API migration         |
| `integration`    | INT    | Third-party services              |
| `ux_design`      | UXD    | UI/UX improvements                |
| `maintenance`    | MNT    | Dependencies, cleanup             |
| `decommissioned` | DEC    | Deprecated/removed                |

---

## Phase 1: Database Schema

### TAK-001

```yaml
id: TAK-001
phase: database
action: CREATE
file: "database/migrations/050_tasks_schema.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create tasks table with all required fields"
  - "Include validation_status and blocking columns"
  - "Add embedding column for similarity search (BLOB)"
  - "Include project_id, idea_slug, parent_id relationships"
  - "Add acceptance_criteria, api_test_cases, ui_test_cases as JSON"

gotchas:
  - "Use TEXT for dates in SQLite, not DATETIME"
  - "Always include IF NOT EXISTS"
  - "JSON columns stored as TEXT in SQLite"

validation:
  command: "sqlite3 :memory: < database/migrations/050_tasks_schema.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 050: Tasks schema for Task Agent
  -- Created: 2026-01-12

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    priority INTEGER DEFAULT 50,

    -- Relationships
    parent_id TEXT REFERENCES tasks(id),
    project_id TEXT NOT NULL,
    idea_slug TEXT,

    -- Validation
    acceptance_criteria TEXT,  -- JSON array
    api_test_cases TEXT,       -- JSON array
    ui_test_cases TEXT,        -- JSON array
    validation_command TEXT,
    validation_status TEXT DEFAULT 'pending',
    validation_issues TEXT,    -- JSON array
    blocking_reason TEXT,

    -- Execution
    assigned_agent TEXT,
    estimated_effort TEXT,
    actual_effort_minutes INTEGER,

    -- Embeddings
    embedding BLOB,
    embedding_model TEXT,

    -- Metadata
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);

depends_on: []

acceptance_criteria:
  - "Table creates successfully"
  - "All columns have correct types"
  - "Indexes created for performance"
```

### TAK-002

```yaml
id: TAK-002
phase: database
action: CREATE
file: "database/migrations/051_task_relationships.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_relationships table for dependencies/links"
  - "Support 11 relationship types from architecture doc"
  - "Include strength field for similarity scores"
  - "Add unique constraint on source+target+type"

gotchas:
  - "Foreign keys need PRAGMA foreign_keys = ON to enforce"

validation:
  command: "sqlite3 :memory: < database/migrations/050_tasks_schema.sql && sqlite3 :memory: < database/migrations/051_task_relationships.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 051: Task relationships
  -- Supports 11 relationship types per task-data-model.md

  CREATE TABLE IF NOT EXISTS task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL,
    target_task_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN
      ('depends_on', 'blocks', 'related_to', 'duplicate_of', 'subtask_of',
       'supersedes', 'implements', 'conflicts_with', 'enables', 'inspired_by', 'tests')),
    strength REAL,
    metadata TEXT,  -- JSON for type-specific data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT,
    UNIQUE(source_task_id, target_task_id, relationship_type)
  );

  CREATE INDEX IF NOT EXISTS idx_rel_source ON task_relationships(source_task_id);
  CREATE INDEX IF NOT EXISTS idx_rel_target ON task_relationships(target_task_id);
  CREATE INDEX IF NOT EXISTS idx_rel_type ON task_relationships(relationship_type);

depends_on: ["TAK-001"]
```

### TAK-003

```yaml
id: TAK-003
phase: database
action: CREATE
file: "database/migrations/052_task_state_history.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_state_history table for audit trail"
  - "Track all status transitions with reason and actor"
  - "Include timestamp for each transition"

validation:
  command: "sqlite3 :memory: < database/migrations/052_task_state_history.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 052: Task state history

  CREATE TABLE IF NOT EXISTS task_state_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_history_task ON task_state_history(task_id);
  CREATE INDEX IF NOT EXISTS idx_history_time ON task_state_history(changed_at);

depends_on: ["TAK-001"]
```

### TAK-004

```yaml
id: TAK-004
phase: database
action: CREATE
file: "database/migrations/053_task_test_results.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_test_results table"
  - "Track API and UI test execution results"
  - "Include output, error, duration_ms fields"

validation:
  command: "sqlite3 :memory: < database/migrations/053_task_test_results.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 053: Task test results

  CREATE TABLE IF NOT EXISTS task_test_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    test_case_id TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN ('api', 'ui', 'regression')),
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
    output TEXT,
    error TEXT,
    duration_ms INTEGER,
    screenshot_path TEXT,  -- For UI tests
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    executed_by TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_test_task ON task_test_results(task_id);
  CREATE INDEX IF NOT EXISTS idx_test_status ON task_test_results(status);

depends_on: ["TAK-001"]
```

### TAK-005

```yaml
id: TAK-005
phase: database
action: CREATE
file: "database/migrations/054_task_blocks.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_blocks table for tracking blocking reasons"
  - "Support block types: validation, dependency, manual, ambiguous"
  - "Track resolution with resolved_at, resolved_by"

validation:
  command: "sqlite3 :memory: < database/migrations/054_task_blocks.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 054: Task blocks

  CREATE TABLE IF NOT EXISTS task_blocks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    block_type TEXT NOT NULL CHECK (block_type IN
      ('validation', 'dependency', 'manual', 'ambiguous', 'missing_tests')),
    reason TEXT NOT NULL,
    blocking_entity_id TEXT,
    severity TEXT NOT NULL DEFAULT 'error',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_blocks_task ON task_blocks(task_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_unresolved ON task_blocks(task_id)
    WHERE resolved_at IS NULL;

depends_on: ["TAK-001"]
```

### TAK-006

```yaml
id: TAK-006
phase: database
action: CREATE
file: "database/migrations/055_validation_rules.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create validation_rules table for configurable validation"
  - "Support rule types: required_field, test_required, pattern_match, custom"
  - "Allow category-specific rules via filter"
  - "Include enabled flag for toggling rules"

validation:
  command: "sqlite3 :memory: < database/migrations/055_validation_rules.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
  -- Migration 055: Validation rules

  CREATE TABLE IF NOT EXISTS validation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN
      ('required_field', 'test_required', 'pattern_match', 'custom', 'ambiguity_check')),
    category_filter TEXT,  -- NULL = all categories, or specific category
    config TEXT NOT NULL,  -- JSON configuration
    severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
    blocking INTEGER NOT NULL DEFAULT 1,  -- 1 = blocks execution
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
    ('vr-005', 'api_tests_for_backend', 'test_required', '{"testType":"api","categories":["feature","improvement","bug"],"condition":"affects_backend"}', 'error', 1),
    ('vr-006', 'ui_tests_for_frontend', 'test_required', '{"testType":"ui","categories":["feature","improvement","ux_design"],"condition":"affects_frontend"}', 'error', 1),
    ('vr-007', 'ambiguity_check', 'ambiguity_check', '{"threshold":0.3,"vagueTerms":["improve","enhance","better","fix","update","some","various"]}', 'warning', 0);

depends_on: []
```

### TAK-006a

```yaml
id: TAK-006a
phase: database
action: CREATE
file: "database/migrations/056_task_lists.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_lists table for grouping tasks"
  - "Support statuses: draft, active, paused, completed, archived"
  - "Link to exactly one Telegram chat"
  - "Track execution progress"

validation:
  command: "sqlite3 :memory: < database/migrations/056_task_lists.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
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

depends_on: ["TAK-001"]
```

### TAK-006b

```yaml
id: TAK-006b
phase: database
action: CREATE
file: "database/migrations/057_task_list_items.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_list_items junction table"
  - "Track position in list"
  - "Track item-level status"
  - "Support adding same task to multiple lists"

validation:
  command: "sqlite3 :memory: < database/migrations/057_task_list_items.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
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

depends_on: ["TAK-001", "TAK-006a"]
```

### TAK-006c

```yaml
id: TAK-006c
phase: database
action: CREATE
file: "database/migrations/058_task_questions.sql"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Create task_questions table for Task Agent to ask user"
  - "Support question types: approval, clarification, decision"
  - "Track answer and resolution"
  - "Link to task or task list"
  - "NOTE: Named task_questions to avoid conflict with existing questions table (migration 030)"

validation:
  command: "sqlite3 :memory: < database/migrations/058_task_questions.sql && echo 'OK'"
  expected: "exit code 0"

code_template: |
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

depends_on: []
```

---

## Phase 2: TypeScript Types

### TAK-007

```yaml
id: TAK-007
phase: types
action: CREATE
file: "types/task-agent.ts"
status: pending
priority: P1
category: infrastructure

requirements:
  - "Define Task interface with all fields"
  - "Define TaskCategory, TaskStatus enums"
  - "Define ValidationResult, ValidationIssue interfaces"
  - "Define TestCase interfaces for API and UI tests"
  - "Export all types for use by other modules"

gotchas:
  - "IDs are always string (UUIDs)"
  - "Dates are ISO strings"

validation:
  command: "npx tsc --noEmit types/task-agent.ts"
  expected: "exit code 0"

depends_on: ["TAK-001"]

code_template: |
  // Task Agent Types

  export type TaskCategory =
    | 'feature'
    | 'improvement'
    | 'bug'
    | 'investigation'
    | 'technical_debt'
    | 'infrastructure'
    | 'documentation'
    | 'refactoring'
    | 'security'
    | 'performance'
    | 'testing'
    | 'migration'
    | 'integration'
    | 'ux_design'
    | 'maintenance'
    | 'decommissioned';

  export type TaskStatus =
    | 'draft'
    | 'pending'
    | 'blocked'
    | 'in_progress'
    | 'validating'
    | 'failed'
    | 'stale'
    | 'completed'
    | 'cancelled';

  export interface Task {
    id: string;
    title: string;
    description: string;
    category: TaskCategory;
    status: TaskStatus;
    priority: number;

    // Relationships
    parentId?: string;
    projectId: string;
    ideaSlug?: string;

    // Validation
    acceptanceCriteria: string[];
    apiTestCases: APITestCase[];
    uiTestCases: UITestCase[];
    validationCommand?: string;
    validationStatus: 'pending' | 'passed' | 'failed';
    validationIssues: ValidationIssue[];
    blockingReason?: string;

    // Execution
    assignedAgent?: string;
    estimatedEffort?: string;
    actualEffortMinutes?: number;

    // Metadata
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
  }

  export interface ValidationResult {
    valid: boolean;
    blocking: boolean;
    issues: ValidationIssue[];
    suggestions: string[];
  }

  export interface ValidationIssue {
    field: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    ruleId: string;
    autoFixable: boolean;
    suggestedFix?: string;
  }

  export interface APITestCase {
    id: string;
    name: string;
    description: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    endpoint: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    expectedStatus: number;
    expectedBody?: Record<string, unknown>;
    responseValidation?: {
      schema?: object;
      contains?: string[];
      matches?: RegExp;
    };
    setup?: string;
    teardown?: string;
  }

  export interface UITestCase {
    id: string;
    name: string;
    description: string;
    startUrl: string;
    viewport?: { width: number; height: number };
    steps: UITestStep[];
    assertions: UIAssertion[];
    captureScreenshots: boolean;
    screenshotOnFailure: boolean;
  }

  export interface UITestStep {
    action: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'scroll' | 'screenshot' | 'hover';
    selector?: string;
    value?: string;
    timeout?: number;
    description: string;
  }

  export interface UIAssertion {
    type: 'element_exists' | 'element_visible' | 'text_contains' | 'url_matches' | 'element_count';
    selector?: string;
    expected: string | number | boolean;
    description: string;
  }

  export interface TaskRelationship {
    id: string;
    sourceTaskId: string;
    targetTaskId: string;
    relationshipType: 'depends_on' | 'blocks' | 'related_to' | 'duplicate_of';
    strength?: number;
    createdAt: string;
  }

  export interface TaskBlock {
    id: string;
    taskId: string;
    blockType: 'validation' | 'dependency' | 'manual' | 'ambiguous' | 'missing_tests';
    reason: string;
    blockingEntityId?: string;
    severity: 'error' | 'warning';
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
  }
```

---

## Phase 3: Core Services

### TAK-008

```yaml
id: TAK-008
phase: api
action: CREATE
file: "server/services/task-agent/validation-gate.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement ValidationGate class"
  - "Load validation rules from database"
  - "Check required fields with configurable rules"
  - "Check test requirements based on category"
  - "Detect ambiguous descriptions via NLP patterns"
  - "Return blocking vs non-blocking issues"
  - "Create task_blocks records for blocking issues"

gotchas:
  - "Always validate before allowing task execution"
  - "Blocking issues prevent task from leaving 'draft' status"

validation:
  command: "npx tsc --noEmit server/services/task-agent/validation-gate.ts"
  expected: "exit code 0"

depends_on: ["TAK-006", "TAK-007"]

acceptance_criteria:
  - "Validates all required fields"
  - "Blocks tasks without API tests if category requires them"
  - "Blocks tasks without UI tests if category requires them"
  - "Detects vague/ambiguous language"
  - "Creates block records in database"
```

### TAK-009

```yaml
id: TAK-009
phase: api
action: CREATE
file: "server/services/task-agent/deduplication-engine.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement DeduplicationEngine class"
  - "Generate embeddings for task title+description"
  - "Query similar tasks using vector similarity"
  - "Classify as duplicate/overlapping/related/distinct"
  - "Suggest merge or link actions"
  - "Store embeddings in task record"

gotchas:
  - "Use cosine similarity for embeddings"
  - "Cache embeddings to avoid regeneration"

validation:
  command: "npx tsc --noEmit server/services/task-agent/deduplication-engine.ts"
  expected: "exit code 0"

depends_on: ["TAK-007"]

acceptance_criteria:
  - "Generates embeddings for new tasks"
  - "Finds similar tasks above threshold"
  - "Correctly classifies relationship type"
```

### TAK-010

```yaml
id: TAK-010
phase: api
action: CREATE
file: "server/services/task-agent/classification-engine.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement ClassificationEngine class"
  - "Auto-detect task category from description"
  - "Suggest labels/tags"
  - "Predict affected files"
  - "Estimate effort bucket"
  - "Assess risk level"

validation:
  command: "npx tsc --noEmit server/services/task-agent/classification-engine.ts"
  expected: "exit code 0"

depends_on: ["TAK-007"]

acceptance_criteria:
  - "Accurately classifies task category"
  - "Provides effort estimate"
  - "Identifies affected system areas"
```

### TAK-011

```yaml
id: TAK-011
phase: api
action: CREATE
file: "server/services/task-agent/test-generator.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement TestGenerator class"
  - "Generate API test scaffolds from task description"
  - "Generate UI test scaffolds with Puppeteer steps"
  - "Infer endpoints and selectors from context"
  - "Include setup/teardown templates"

gotchas:
  - "UI tests use MCP Puppeteer format"
  - "API tests should be self-contained"

validation:
  command: "npx tsc --noEmit server/services/task-agent/test-generator.ts"
  expected: "exit code 0"

depends_on: ["TAK-007"]

acceptance_criteria:
  - "Generates valid API test structure"
  - "Generates valid UI test structure"
  - "Tests are relevant to task description"
```

### TAK-012

```yaml
id: TAK-012
phase: api
action: CREATE
file: "server/services/task-agent/lifecycle-manager.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement TaskLifecycleManager class"
  - "Manage state transitions with validation"
  - "Enforce valid state transitions only"
  - "Record state history"
  - "Check dependencies before allowing start"
  - "Publish events on state changes"

validation:
  command: "npx tsc --noEmit server/services/task-agent/lifecycle-manager.ts"
  expected: "exit code 0"

depends_on: ["TAK-007", "TAK-003"]

acceptance_criteria:
  - "Only allows valid state transitions"
  - "Records all transitions in history"
  - "Emits WebSocket events"
```

### TAK-013

```yaml
id: TAK-013
phase: api
action: CREATE
file: "server/services/task-agent/dependency-manager.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement DependencyManager class"
  - "Add/remove task dependencies"
  - "Detect circular dependencies"
  - "Calculate critical path"
  - "Auto-resolve when blockers complete"
  - "Generate dependency graph"

gotchas:
  - "Check for cycles before adding dependency"
  - "Subscribe to task.completed events for auto-resolution"

validation:
  command: "npx tsc --noEmit server/services/task-agent/dependency-manager.ts"
  expected: "exit code 0"

depends_on: ["TAK-002", "TAK-007"]

acceptance_criteria:
  - "Prevents circular dependencies"
  - "Auto-unblocks when dependency completes"
  - "Correctly calculates critical path"
```

### TAK-014

```yaml
id: TAK-014
phase: api
action: CREATE
file: "server/services/task-agent/completion-detector.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement CompletionDetector class"
  - "Monitor git commits for task ID mentions"
  - "Watch test results for task tests passing"
  - "Track file changes matching predicted files"
  - "Calculate completion confidence"
  - "Suggest marking task complete"

gotchas:
  - "Don't auto-complete, only suggest"
  - "Multiple signals increase confidence"

validation:
  command: "npx tsc --noEmit server/services/task-agent/completion-detector.ts"
  expected: "exit code 0"

depends_on: ["TAK-007"]

acceptance_criteria:
  - "Detects task ID in git commits"
  - "Tracks test pass status"
  - "Calculates confidence score"
```

### TAK-015

```yaml
id: TAK-015
phase: api
action: CREATE
file: "server/services/task-agent/test-executor.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement TestExecutor class"
  - "Execute API tests via HTTP requests"
  - "Execute UI tests via MCP Puppeteer"
  - "Record results in task_test_results table"
  - "Capture screenshots for UI test failures"
  - "Report aggregate pass/fail status"

gotchas:
  - "Use mcp__puppeteer__* tools for UI tests"
  - "Timeout handling for long-running tests"

validation:
  command: "npx tsc --noEmit server/services/task-agent/test-executor.ts"
  expected: "exit code 0"

depends_on: ["TAK-004", "TAK-007"]

acceptance_criteria:
  - "Executes API tests and validates responses"
  - "Executes UI tests via Puppeteer"
  - "Records all results in database"
  - "Captures failure screenshots"
```

### TAK-015a

```yaml
id: TAK-015a
phase: api
action: CREATE
file: "server/services/task-agent/priority-calculator.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement PriorityCalculator class"
  - "Calculate priority using formula: BlockedCount × 20 + QuickWinBonus + DeadlineBonus + TaskAgentAdvice"
  - "Quick win bonus for small tasks (+10)"
  - "Deadline bonus based on proximity (+5 to +15)"
  - "Task Agent advice for strategic recommendations"
  - "Recalculate on dependency changes"

gotchas:
  - "BlockedCount is the number of tasks that depend on this one"
  - "QuickWin applies to tasks with effort < 30 minutes"

validation:
  command: "npx tsc --noEmit server/services/task-agent/priority-calculator.ts"
  expected: "exit code 0"

depends_on: ["TAK-007", "TAK-013"]

acceptance_criteria:
  - "Correctly counts blocked tasks"
  - "Applies quick win bonus"
  - "Factors in deadlines"
  - "Recalculates on dependency changes"
```

### TAK-015b

```yaml
id: TAK-015b
phase: api
action: CREATE
file: "server/services/task-agent/suggestion-engine.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement SuggestionEngine class"
  - "Implement continuous suggestion loop"
  - "Select highest priority ready tasks"
  - "Detect parallelization opportunities"
  - "Generate context-aware suggestions"
  - "Respect user preferences and working hours"

gotchas:
  - "Only suggest tasks that pass validation"
  - "Consider user's current focus area"

validation:
  command: "npx tsc --noEmit server/services/task-agent/suggestion-engine.ts"
  expected: "exit code 0"

depends_on: ["TAK-015a", "TAK-008"]

acceptance_criteria:
  - "Suggests highest priority ready tasks"
  - "Detects parallel opportunities"
  - "Respects working hours config"
```

### TAK-015c

```yaml
id: TAK-015c
phase: api
action: CREATE
file: "server/services/task-agent/task-list-manager.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement TaskListManager class"
  - "Create and manage task lists"
  - "Link task lists to Telegram chats (one chat per list)"
  - "Track list execution progress"
  - "Support sequential, parallel, and priority execution modes"
  - "Handle list completion and archiving"

gotchas:
  - "Enforce one-to-one Telegram chat mapping"
  - "Update progress on task completion events"

validation:
  command: "npx tsc --noEmit server/services/task-agent/task-list-manager.ts"
  expected: "exit code 0"

depends_on: ["TAK-006a", "TAK-006b", "TAK-007"]

acceptance_criteria:
  - "Creates task lists with Telegram linking"
  - "Tracks execution progress"
  - "Supports all execution modes"
```

### TAK-016

```yaml
id: TAK-016
phase: api
action: CREATE
file: "server/services/task-agent/task-agent.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Implement TaskAgent main class"
  - "Coordinate all sub-services"
  - "Register with CommunicationHub"
  - "Subscribe to relevant events"
  - "Implement always-on loop with continuous suggestions"
  - "Handle incoming Telegram commands"
  - "Proactively check for stale tasks"
  - "Run stale check every 6 hours"

gotchas:
  - "Must register with hub on startup"
  - "Use long-polling for Telegram"
  - "Implement graceful shutdown"

validation:
  command: "npx tsc --noEmit server/services/task-agent/task-agent.ts"
  expected: "exit code 0"

depends_on:
  [
    "TAK-008",
    "TAK-009",
    "TAK-010",
    "TAK-011",
    "TAK-012",
    "TAK-013",
    "TAK-014",
    "TAK-015",
    "TAK-015a",
    "TAK-015b",
    "TAK-015c",
  ]

acceptance_criteria:
  - "Starts and registers with CommunicationHub"
  - "Responds to Telegram commands"
  - "Runs continuous suggestion loop"
  - "Proactively detects stale tasks"
  - "Validates tasks before execution"
```

---

## Phase 4: API Routes

### TAK-017

```yaml
id: TAK-017
phase: api
action: CREATE
file: "server/routes/task-agent.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Create REST API for task CRUD"
  - "Implement validation endpoint"
  - "Implement test execution endpoint"
  - "Add dependency management endpoints"
  - "Add similarity search endpoint"
  - "Emit WebSocket events for all changes"

validation:
  command: "npx tsc --noEmit server/routes/task-agent.ts"
  expected: "exit code 0"

depends_on: ["TAK-016"]

acceptance_criteria:
  - "All CRUD operations work"
  - "Validation returns blocking/non-blocking issues"
  - "WebSocket events emitted"
```

### TAK-018

```yaml
id: TAK-018
phase: api
action: UPDATE
file: "server/api.ts"
status: pending
priority: P1
category: integration

requirements:
  - "Import task-agent routes"
  - "Mount at /api/task-agent"
  - "Add to route documentation"

validation:
  command: "npx tsc --noEmit server/api.ts"
  expected: "exit code 0"

depends_on: ["TAK-017"]
```

---

## Phase 5: Telegram Bot Integration

### TAK-019

```yaml
id: TAK-019
phase: api
action: UPDATE
file: "server/communication/bot-registry.ts"
status: pending
priority: P1
category: integration

requirements:
  - "Add 'task' agent type to registry"
  - "Load TELEGRAM_BOT_TASK_TOKEN from env"
  - "Register task bot with health checks"

depends_on: ["TAK-016"]
```

### TAK-020

```yaml
id: TAK-020
phase: api
action: CREATE
file: "server/services/task-agent/telegram-handler.ts"
status: pending
priority: P1
category: feature

requirements:
  - "Handle all /task commands from Telegram"
  - "Parse command arguments"
  - "Format responses with inline buttons"
  - "Support interactive task creation flow"
  - "Send proactive notifications"

gotchas:
  - "Use inline keyboards for actions"
  - "Keep messages concise for mobile"

validation:
  command: "npx tsc --noEmit server/services/task-agent/telegram-handler.ts"
  expected: "exit code 0"

depends_on: ["TAK-016", "TAK-019"]

acceptance_criteria:
  - "All commands documented work"
  - "Interactive task creation flow works"
  - "Notifications sent proactively"
```

---

## Phase 6: WebSocket Events

### TAK-021

```yaml
id: TAK-021
phase: api
action: UPDATE
file: "server/websocket.ts"
status: pending
priority: P1
category: integration

requirements:
  - "Add task-agent event handlers"
  - "Add taskAgentClients set for subscriptions"
  - "Implement task:* event broadcasting"
  - "Add URL parameter support (?monitor=tasks)"

depends_on: ["TAK-016"]

events_to_add:
  - "task:created"
  - "task:updated"
  - "task:deleted"
  - "task:status_changed"
  - "task:blocked"
  - "task:unblocked"
  - "task:validation_passed"
  - "task:validation_failed"
  - "task:test_started"
  - "task:test_passed"
  - "task:test_failed"
  - "task:duplicate_detected"
  - "task:completion_detected"
```

---

## Phase 7: Frontend Components

### TAK-022

```yaml
id: TAK-022
phase: ui
action: CREATE
file: "frontend/src/pages/TaskAgentDashboard.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Create main Task Agent dashboard page"
  - "Show task stats (total, by status, by category)"
  - "List recent tasks with quick actions"
  - "Show blocked tasks prominently"
  - "WebSocket connection for real-time updates"

depends_on: ["TAK-017", "TAK-021"]
```

### TAK-023

```yaml
id: TAK-023
phase: ui
action: CREATE
file: "frontend/src/components/TaskCard.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Display task summary card"
  - "Show status badge with color"
  - "Show validation status indicator"
  - "Quick action buttons"
  - "Expand for details"

depends_on: ["TAK-022"]
```

### TAK-024

```yaml
id: TAK-024
phase: ui
action: CREATE
file: "frontend/src/components/TaskCreateForm.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Multi-step task creation form"
  - "Real-time validation feedback"
  - "Test case builder"
  - "Acceptance criteria builder"
  - "Category and priority selection"

depends_on: ["TAK-022"]
```

### TAK-025

```yaml
id: TAK-025
phase: ui
action: CREATE
file: "frontend/src/components/ValidationResult.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Display validation results"
  - "Show blocking vs warning issues"
  - "Provide fix suggestions"
  - "Action buttons for auto-fixes"

depends_on: ["TAK-022"]
```

### TAK-026

```yaml
id: TAK-026
phase: ui
action: CREATE
file: "frontend/src/components/DependencyGraph.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Visualize task dependencies"
  - "Show blocked/unblocked status"
  - "Interactive node selection"
  - "Critical path highlighting"

depends_on: ["TAK-022"]
```

### TAK-027

```yaml
id: TAK-027
phase: ui
action: CREATE
file: "frontend/src/components/TaskTestResults.tsx"
status: pending
priority: P2
category: feature

requirements:
  - "Display test execution results"
  - "Show pass/fail for each test case"
  - "Display failure details and screenshots"
  - "Re-run test buttons"

depends_on: ["TAK-022"]
```

---

## Phase 8: Tests

### TAK-028

```yaml
id: TAK-028
phase: tests
action: CREATE
file: "tests/unit/task-agent/validation-gate.test.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test required field validation"
  - "Test test requirement validation"
  - "Test ambiguity detection"
  - "Test blocking vs non-blocking classification"

depends_on: ["TAK-008"]
```

### TAK-029

```yaml
id: TAK-029
phase: tests
action: CREATE
file: "tests/unit/task-agent/deduplication-engine.test.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test embedding generation"
  - "Test similarity calculation"
  - "Test duplicate classification"
  - "Test merge suggestions"

depends_on: ["TAK-009"]
```

### TAK-030

```yaml
id: TAK-030
phase: tests
action: CREATE
file: "tests/unit/task-agent/lifecycle-manager.test.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test valid state transitions"
  - "Test invalid transition rejection"
  - "Test history recording"
  - "Test event emission"

depends_on: ["TAK-012"]
```

### TAK-031

```yaml
id: TAK-031
phase: tests
action: CREATE
file: "tests/unit/task-agent/dependency-manager.test.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test dependency addition"
  - "Test circular dependency detection"
  - "Test auto-resolution"
  - "Test critical path calculation"

depends_on: ["TAK-013"]
```

### TAK-032

```yaml
id: TAK-032
phase: tests
action: CREATE
file: "tests/api/task-agent.test.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test all CRUD endpoints"
  - "Test validation endpoint"
  - "Test dependency endpoints"
  - "Test test execution endpoints"
  - "Test error handling"

depends_on: ["TAK-017"]
```

---

## Phase 9: API Test Cases (For Task Agent Self-Testing)

### TAK-033

```yaml
id: TAK-033
phase: tests
action: CREATE
file: "tests/api-test-cases/task-create.json"
status: pending
priority: P1
category: testing

requirements:
  - "Define API test case for task creation"
  - "Test happy path"
  - "Test validation failures"
  - "Test duplicate detection"

code_template: |
  {
    "id": "api-task-create-001",
    "name": "Create Task - Happy Path",
    "description": "Successfully create a valid task",
    "method": "POST",
    "endpoint": "/api/task-agent/tasks",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "title": "Add user authentication feature",
      "description": "Implement JWT-based authentication with login, logout, and session management. Users should be able to log in with email and password.",
      "category": "feature",
      "projectId": "proj-001",
      "acceptanceCriteria": [
        "User can log in with valid email/password",
        "Invalid credentials return 401 error",
        "JWT token is returned on successful login",
        "Token expires after configured duration"
      ],
      "apiTestCases": [
        {
          "name": "Login Success",
          "method": "POST",
          "endpoint": "/api/auth/login",
          "body": { "email": "test@test.com", "password": "password123" },
          "expectedStatus": 200
        }
      ]
    },
    "expectedStatus": 201,
    "responseValidation": {
      "contains": ["id", "title", "status"]
    }
  }

depends_on: ["TAK-017"]
```

### TAK-034

```yaml
id: TAK-034
phase: tests
action: CREATE
file: "tests/api-test-cases/task-validation-block.json"
status: pending
priority: P1
category: testing

requirements:
  - "Test that tasks without required tests are blocked"
  - "Test that ambiguous descriptions trigger warnings"
  - "Test validation endpoint returns issues"

code_template: |
  {
    "id": "api-task-validation-001",
    "name": "Task Validation - Missing Tests Blocks Execution",
    "description": "Task without API tests for feature category should be blocked",
    "method": "POST",
    "endpoint": "/api/task-agent/tasks",
    "body": {
      "title": "Add payment processing",
      "description": "Implement payment gateway integration with Stripe for processing credit card payments",
      "category": "feature",
      "projectId": "proj-001",
      "acceptanceCriteria": ["Payments are processed successfully"],
      "apiTestCases": []
    },
    "expectedStatus": 201,
    "responseValidation": {
      "contains": ["blocked"],
      "matches": "validationStatus.*blocked"
    }
  }

depends_on: ["TAK-017"]
```

---

## Phase 10: UI Test Cases (MCP Puppeteer)

### TAK-035

```yaml
id: TAK-035
phase: tests
action: CREATE
file: "tests/ui-test-cases/task-dashboard.json"
status: pending
priority: P1
category: testing

requirements:
  - "Define UI test for Task Agent dashboard"
  - "Test page loads with task stats"
  - "Test real-time updates via WebSocket"

code_template: |
  {
    "id": "ui-task-dashboard-001",
    "name": "Task Dashboard - Page Load",
    "description": "Verify Task Agent dashboard loads with all components",
    "startUrl": "http://localhost:5173/task-agent",
    "viewport": { "width": 1280, "height": 720 },
    "steps": [
      {
        "action": "wait",
        "timeout": 2000,
        "description": "Wait for page to load"
      },
      {
        "action": "screenshot",
        "description": "Capture initial dashboard state"
      }
    ],
    "assertions": [
      {
        "type": "element_exists",
        "selector": "[data-testid='task-stats']",
        "expected": true,
        "description": "Task stats component should exist"
      },
      {
        "type": "element_exists",
        "selector": "[data-testid='blocked-tasks']",
        "expected": true,
        "description": "Blocked tasks section should exist"
      },
      {
        "type": "text_contains",
        "selector": "h1",
        "expected": "Task Agent",
        "description": "Page title should be Task Agent"
      }
    ],
    "captureScreenshots": true,
    "screenshotOnFailure": true
  }

depends_on: ["TAK-022"]
```

### TAK-036

```yaml
id: TAK-036
phase: tests
action: CREATE
file: "tests/ui-test-cases/task-create-flow.json"
status: pending
priority: P1
category: testing

requirements:
  - "Test interactive task creation"
  - "Test form validation feedback"
  - "Test successful task creation"

code_template: |
  {
    "id": "ui-task-create-001",
    "name": "Task Create - Full Flow",
    "description": "Test complete task creation through UI",
    "startUrl": "http://localhost:5173/task-agent",
    "viewport": { "width": 1280, "height": 720 },
    "steps": [
      {
        "action": "click",
        "selector": "[data-testid='create-task-btn']",
        "description": "Click Create Task button"
      },
      {
        "action": "wait",
        "timeout": 500,
        "description": "Wait for modal"
      },
      {
        "action": "type",
        "selector": "[data-testid='task-title']",
        "value": "Implement user profile page",
        "description": "Enter task title"
      },
      {
        "action": "type",
        "selector": "[data-testid='task-description']",
        "value": "Create a user profile page that displays user information including name, email, and profile picture. Users should be able to edit their profile.",
        "description": "Enter task description"
      },
      {
        "action": "select",
        "selector": "[data-testid='task-category']",
        "value": "feature",
        "description": "Select category"
      },
      {
        "action": "click",
        "selector": "[data-testid='add-criteria-btn']",
        "description": "Add acceptance criteria"
      },
      {
        "action": "type",
        "selector": "[data-testid='criteria-input']",
        "value": "Profile page displays user name and email",
        "description": "Enter acceptance criteria"
      },
      {
        "action": "click",
        "selector": "[data-testid='submit-task-btn']",
        "description": "Submit task"
      },
      {
        "action": "wait",
        "timeout": 1000,
        "description": "Wait for response"
      },
      {
        "action": "screenshot",
        "description": "Capture result"
      }
    ],
    "assertions": [
      {
        "type": "element_visible",
        "selector": "[data-testid='task-card']",
        "expected": true,
        "description": "New task should appear in list"
      }
    ],
    "captureScreenshots": true,
    "screenshotOnFailure": true
  }

depends_on: ["TAK-022", "TAK-024"]
```

### TAK-037

```yaml
id: TAK-037
phase: tests
action: CREATE
file: "tests/ui-test-cases/task-validation-feedback.json"
status: pending
priority: P1
category: testing

requirements:
  - "Test validation error display"
  - "Test blocking indicator"
  - "Test suggested fixes"

code_template: |
  {
    "id": "ui-task-validation-001",
    "name": "Task Validation - Error Display",
    "description": "Test that validation errors are displayed correctly",
    "startUrl": "http://localhost:5173/task-agent",
    "viewport": { "width": 1280, "height": 720 },
    "steps": [
      {
        "action": "click",
        "selector": "[data-testid='create-task-btn']",
        "description": "Open create task modal"
      },
      {
        "action": "type",
        "selector": "[data-testid='task-title']",
        "value": "Fix bug",
        "description": "Enter short title (too short)"
      },
      {
        "action": "type",
        "selector": "[data-testid='task-description']",
        "value": "Fix it",
        "description": "Enter vague description"
      },
      {
        "action": "click",
        "selector": "[data-testid='validate-btn']",
        "description": "Trigger validation"
      },
      {
        "action": "wait",
        "timeout": 1000,
        "description": "Wait for validation"
      },
      {
        "action": "screenshot",
        "description": "Capture validation errors"
      }
    ],
    "assertions": [
      {
        "type": "element_visible",
        "selector": "[data-testid='validation-error']",
        "expected": true,
        "description": "Validation errors should be visible"
      },
      {
        "type": "text_contains",
        "selector": "[data-testid='validation-error']",
        "expected": "title",
        "description": "Should mention title issue"
      },
      {
        "type": "element_exists",
        "selector": "[data-testid='blocking-indicator']",
        "expected": true,
        "description": "Blocking indicator should show"
      }
    ],
    "captureScreenshots": true,
    "screenshotOnFailure": true
  }

depends_on: ["TAK-022", "TAK-025"]
```

---

## Phase 11: E2E Integration Tests

### TAK-038

```yaml
id: TAK-038
phase: tests
action: CREATE
file: "tests/e2e/task-agent-full-flow.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test complete task lifecycle via API"
  - "Test validation gate blocks execution"
  - "Test dependency resolution"
  - "Test completion detection"

depends_on: ["TAK-016", "TAK-017"]
```

### TAK-039

```yaml
id: TAK-039
phase: tests
action: CREATE
file: "tests/e2e/task-agent-telegram.ts"
status: pending
priority: P1
category: testing

requirements:
  - "Test Telegram bot commands"
  - "Test interactive flows"
  - "Test notification delivery"
  - "Mock Telegram API for testing"

depends_on: ["TAK-020"]
```

---

## Phase 12: Documentation

### TAK-040

```yaml
id: TAK-040
phase: documentation
action: UPDATE
file: "CLAUDE.md"
status: pending
priority: P2
category: documentation

requirements:
  - "Add Task Agent to agent types"
  - "Document task categories"
  - "Add TAK prefix to task-executor mapping"
  - "Document Telegram commands"

depends_on: ["TAK-016"]
```

### TAK-041

```yaml
id: TAK-041
phase: documentation
action: CREATE
file: "docs/agents/TASK-AGENT.md"
status: pending
priority: P2
category: documentation

requirements:
  - "Document Task Agent capabilities"
  - "API reference"
  - "Telegram command reference"
  - "Configuration options"
  - "Example workflows"

depends_on: ["TAK-016"]
```

---

## Additional Capabilities (Gap Analysis)

### TAK-042

```yaml
id: TAK-042
phase: api
action: CREATE
file: "server/services/task-agent/predictive-blocker.ts"
status: pending
priority: P3
category: feature

description: "Predict when tasks will become blocked before it happens"

requirements:
  - "Analyze task patterns that lead to blocks"
  - "Monitor resource availability"
  - "Alert before predicted block"
  - "Learn from historical data"

depends_on: ["TAK-016"]
```

### TAK-043

```yaml
id: TAK-043
phase: api
action: CREATE
file: "server/services/task-agent/workload-balancer.ts"
status: pending
priority: P3
category: feature

description: "Balance task load across agents"

requirements:
  - "Track agent capacity"
  - "Consider task complexity"
  - "Optimize assignment for throughput"
  - "Prevent agent overload"

depends_on: ["TAK-016"]
```

### TAK-044

```yaml
id: TAK-044
phase: api
action: CREATE
file: "server/services/task-agent/task-decomposer.ts"
status: pending
priority: P3
category: feature

description: "Suggest task breakdown when tasks are too large"

requirements:
  - "Detect oversized tasks"
  - "Generate subtask suggestions"
  - "Maintain parent-child relationships"
  - "Estimate combined effort"

depends_on: ["TAK-016"]
```

### TAK-045

```yaml
id: TAK-045
phase: api
action: CREATE
file: "server/services/task-agent/retrospective-learner.ts"
status: pending
priority: P3
category: feature

description: "Learn from completed tasks to improve estimates and predictions"

requirements:
  - "Compare estimated vs actual effort"
  - "Track common blockers by category"
  - "Improve classification accuracy"
  - "Generate insights for SIA"

depends_on: ["TAK-016"]
```

### TAK-046

```yaml
id: TAK-046
phase: api
action: CREATE
file: "server/services/task-agent/cross-project-deps.ts"
status: pending
priority: P3
category: feature

description: "Track dependencies across different projects/ideas"

requirements:
  - "Link tasks across projects"
  - "Detect cross-project blockers"
  - "Visualize cross-project graph"
  - "Coordinate multi-project work"

depends_on: ["TAK-013"]
```

### TAK-047

```yaml
id: TAK-047
phase: api
action: CREATE
file: "server/services/task-agent/acceptance-generator.ts"
status: pending
priority: P3
category: feature

description: "Auto-generate testable acceptance criteria"

requirements:
  - "Analyze task description"
  - "Generate specific, measurable criteria"
  - "Suggest verification methods"
  - "Link to test generation"

depends_on: ["TAK-011"]
```

---

## Quick Reference

**Location:** `server/services/task-agent/`

**Events (Subscribes):**

- `ideation.completed` - Trigger spec generation
- `task.completed` - Auto-unblock dependents
- `task.failed` - Handle failure flows
- `build.completed` - Update task status

**Events (Publishes):**

- `tasklist.generated` - New task list created
- `tasklist.ready` - Approved for execution
- `task.started` - Task execution began
- `task:created`, `task:updated`, `task:deleted`
- `task:status_changed`, `task:blocked`, `task:unblocked`
- `task:validation_passed`, `task:validation_failed`
- `task:test_started`, `task:test_passed`, `task:test_failed`
- `task:duplicate_detected`, `task:completion_detected`

**APIs:**

- `POST /api/task-agent/tasks` - Create task
- `GET /api/task-agent/tasks` - List tasks
- `GET /api/task-agent/tasks/:id` - Get task details
- `PUT /api/task-agent/tasks/:id` - Update task
- `DELETE /api/task-agent/tasks/:id` - Delete task
- `POST /api/task-agent/tasks/:id/validate` - Validate task
- `POST /api/task-agent/tasks/:id/execute-tests` - Run tests
- `POST /api/task-agent/task-lists` - Create task list
- `GET /api/task-agent/task-lists` - List task lists
- `POST /api/task-agent/task-lists/:id/approve` - Approve for execution

**Telegram Commands:**

```
/start      - Link chat to task list
/status     - Show current execution status
/lists      - Show active task lists
/suggest    - Get next suggested action
/execute    - Start execution of suggested list
/pause      - Pause current execution
/resume     - Resume paused execution
/questions  - Show pending questions
/help       - Show available commands
```

---

## Dependency Graph

```
Phase 1 (Database) ─────────────────────────────────────────────────┐
    │                                                                │
    ▼                                                                │
Phase 2 (Types) ───────────────────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 3 (Core Services) ◄──────────────────────────────────────────┤
    │                                                                │
    ├───► Validation Gate (TAK-008)                                 │
    ├───► Deduplication Engine (TAK-009)                            │
    ├───► Classification Engine (TAK-010)                           │
    ├───► Test Generator (TAK-011)                                  │
    ├───► Lifecycle Manager (TAK-012)                               │
    ├───► Dependency Manager (TAK-013)                              │
    ├───► Completion Detector (TAK-014)                             │
    ├───► Test Executor (TAK-015)                                   │
    ├───► Priority Calculator (TAK-015a)                            │
    ├───► Suggestion Engine (TAK-015b)                              │
    ├───► Task List Manager (TAK-015c)                              │
    └───► Task Agent Main (TAK-016) ◄── All services                │
                │                                                    │
                ▼                                                    │
Phase 4 (API Routes) ◄─────────────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 5 (Telegram Integration) ◄───────────────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 6 (WebSocket Events) ◄───────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 7 (Frontend Components) ◄────────────────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 8-11 (Tests: Unit → API → UI → E2E) ◄────────────────────────┤
    │                                                                │
    ▼                                                                │
Phase 12 (Documentation) ◄─────────────────────────────────────────┘
```

---

## Exit Criteria by Phase

### Phase 1: Database

- [ ] All 9 tables created in SQLite (migrations 050-058)
- [ ] Foreign key relationships work correctly
- [ ] Indexes created for performance

### Phase 2: Types

- [ ] TypeScript types compile without errors
- [ ] All interfaces match database schema
- [ ] Types exported for use by other modules

### Phase 3: Core Services

- [ ] ValidationGate blocks tasks without required fields/tests
- [ ] DeduplicationEngine finds similar tasks (>0.8 threshold)
- [ ] DependencyManager prevents circular dependencies
- [ ] CompletionDetector identifies task completion signals
- [ ] PriorityCalculator implements formula correctly
- [ ] SuggestionEngine returns prioritized next actions
- [ ] TaskAgent starts and registers with CommunicationHub

### Phase 4: API Routes

- [ ] All CRUD operations work
- [ ] Validation endpoint returns blocking/non-blocking issues
- [ ] Test execution endpoint runs tests correctly

### Phase 5: Telegram

- [ ] All commands documented work
- [ ] Proactive notifications sent (5 min minimum interval)
- [ ] Questions block execution until answered
- [ ] Inline buttons work (Execute Now / Later / Details)

### Phase 6: WebSocket

- [ ] All task:\* events broadcast to subscribers
- [ ] Real-time updates work in dashboard

### Phase 7: Frontend

- [ ] Dashboard shows task stats
- [ ] Task creation form validates input
- [ ] Dependency graph renders correctly

### Phase 8-11: Tests

- [ ] Unit tests pass for all core services
- [ ] API tests cover all endpoints
- [ ] UI tests pass for dashboard and forms
- [ ] E2E tests validate complete workflows

---

## Summary

| Phase                   | Task Count | Priority |
| ----------------------- | ---------- | -------- |
| Database                | 9          | P1       |
| Types                   | 1          | P1       |
| Core Services           | 12         | P1       |
| API Routes              | 2          | P1       |
| Telegram                | 2          | P1       |
| WebSocket               | 1          | P1       |
| Frontend                | 6          | P2       |
| Unit Tests              | 5          | P1       |
| API Tests               | 2          | P1       |
| UI Tests                | 3          | P1       |
| E2E Tests               | 2          | P1       |
| Documentation           | 2          | P2       |
| Additional Capabilities | 6          | P3       |

**Total: 53 tasks**

### New Tasks Added (per Q&A Decisions)

- TAK-006a: Task lists table
- TAK-006b: Task list items junction table
- TAK-006c: Questions table
- TAK-015a: Priority calculator service
- TAK-015b: Suggestion engine service
- TAK-015c: Task list manager service

---

## Execution Order

1. **Week 1**: Database schema (TAK-001 to TAK-006) + Types (TAK-007)
2. **Week 2**: Core services (TAK-008 to TAK-016)
3. **Week 3**: API routes (TAK-017, TAK-018) + Telegram (TAK-019, TAK-020) + WebSocket (TAK-021)
4. **Week 4**: Frontend components (TAK-022 to TAK-027)
5. **Week 5**: Tests (TAK-028 to TAK-039)
6. **Week 6**: Documentation + Additional capabilities

---

## Validation Commands

```bash
# Run all migrations
npm run migrate

# Type check
npx tsc --noEmit

# Run unit tests
npm test -- --grep "task-agent"

# Run API tests
npm run test:api -- --filter "task-agent"

# Run UI tests (requires server running)
npm run test:ui -- --filter "task"

# Run E2E tests
npm run test:e2e -- --filter "task-agent"
```
