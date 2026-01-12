# Task Agent Data Model

**Created:** 2026-01-12
**Status:** Final Design
**Purpose:** Define database schema for Task Agent system with DB as single source of truth

---

## Design Principles

Based on questionnaire decisions:

1. **DB is the single source of truth** - No MD files for tasks (Q29)
2. **Tasks live in database only** - MD files migrated to DB (Q21, Q22)
3. **Task templates for reusable tasks** - Stored outside user/project scope (Q21)
4. **Hybrid task/list model** - Many-to-many with ordering via junction table (Q1)
5. **Hierarchical scope** - Projects > Ideas > Task Lists (Q2)
6. **All 11 relationship types** - Full expressiveness (Q3)
7. **Three-level test framework** - Codebase, API, UI (Q5, Q26)

---

## Task Naming Convention

**Format:** `{USER_ID}-{SCOPE_ID}-{TYPE}-{NUMBER}[-{SUBTASK}-{VERSION}]`

| Component | Description | Example |
|-----------|-------------|---------|
| USER_ID | Short user identifier | `NA` (Nenad A.) |
| SCOPE_ID | Project or Idea slug | `VIBE`, `TASK-AGENT` |
| TYPE | Task category prefix | `FEA`, `BUG`, `INF` |
| NUMBER | Auto-increment within scope | `001`, `042` |
| SUBTASK | Optional subtask letter | `A`, `B`, `C` |
| VERSION | Optional version number | `001`, `002` |

**Examples:**
- `NA-VIBE-FEA-001` - Feature task #1 for Vibe project
- `NA-TASK-AGENT-BUG-042-A-001` - Subtask A, version 1 of bug #42

**Type Prefixes:**

| Prefix | Category |
|--------|----------|
| `FEA` | feature |
| `IMP` | improvement |
| `BUG` | bug |
| `INV` | investigation |
| `TED` | technical_debt |
| `INF` | infrastructure |
| `DOC` | documentation |
| `REF` | refactoring |
| `SEC` | security |
| `PER` | performance |
| `TST` | testing |
| `MIG` | migration |
| `INT` | integration |
| `UXD` | ux_design |
| `MNT` | maintenance |
| `DEC` | decommissioned |

---

## Core Tables

### 1. Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,           -- Short identifier for task naming
  name TEXT NOT NULL,
  email TEXT,
  telegram_chat_id TEXT,               -- Linked Telegram chat
  settings TEXT,                       -- JSON: notification preferences
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_slug ON users(slug);
CREATE INDEX idx_users_telegram ON users(telegram_chat_id);
```

### 2. Projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',  -- active, paused, archived
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
```

### 3. Ideas (within Projects)

```sql
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  lifecycle_stage TEXT NOT NULL DEFAULT 'spark',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, slug)
);

CREATE INDEX idx_ideas_project ON ideas(project_id);
CREATE INDEX idx_ideas_stage ON ideas(lifecycle_stage);
```

### 4. Tasks (Core Entity)

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,                 -- e.g., "NA-VIBE-FEA-001"

  -- Identifiers
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  idea_id TEXT REFERENCES ideas(id),
  parent_task_id TEXT REFERENCES tasks(id),  -- For subtasks

  -- Core content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,              -- feature, bug, etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  risk_level TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high

  -- Priority (computed, not user-set per Q15)
  priority_score INTEGER DEFAULT 0,     -- Computed from factors
  blocks_count INTEGER DEFAULT 0,       -- How many tasks this blocks
  is_quick_win INTEGER DEFAULT 0,       -- 1 if < 1 hour effort
  deadline TEXT,                        -- Optional deadline

  -- Acceptance Criteria (JSON array)
  acceptance_criteria TEXT NOT NULL DEFAULT '[]',

  -- Three-Level Test Cases (JSON arrays)
  codebase_tests TEXT NOT NULL DEFAULT '[]',  -- tsc, lint, unit tests
  api_tests TEXT NOT NULL DEFAULT '[]',       -- HTTP endpoint tests
  ui_tests TEXT NOT NULL DEFAULT '[]',        -- Puppeteer tests

  -- Execution metadata
  assigned_agent TEXT,
  estimated_effort TEXT,               -- trivial, small, medium, large, epic
  actual_effort_minutes INTEGER,

  -- Affected files (JSON array)
  affected_files TEXT DEFAULT '[]',

  -- Execution log (JSON array of attempts)
  execution_log TEXT DEFAULT '[]',

  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_task_id TEXT REFERENCES tasks(id),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,

  -- Embeddings for similarity search
  embedding BLOB,
  embedding_model TEXT
);

-- Essential indexes
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_idea ON tasks(idea_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_risk ON tasks(risk_level);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_agent);
CREATE INDEX idx_tasks_priority ON tasks(priority_score DESC);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
```

### 5. Task Lists (First-Class Entity per Q31)

```sql
CREATE TABLE task_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Scope (hierarchical per Q2)
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),    -- Optional: project-level list
  idea_id TEXT REFERENCES ideas(id),          -- Optional: idea-level list

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, active, paused, completed, failed

  -- Settings (toggles per Q5, Q8)
  user_approval_required INTEGER NOT NULL DEFAULT 1,   -- Toggle per Q5
  auto_execute_low_risk INTEGER NOT NULL DEFAULT 0,    -- Allow auto-run for low risk
  auto_answer_medium_low INTEGER NOT NULL DEFAULT 0,   -- Toggle per Q8 (default off)

  -- Telegram integration (per Q25 - each task list = one chat)
  telegram_chat_id TEXT,               -- Dedicated chat for this list

  -- Progress tracking
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  current_task_id TEXT REFERENCES tasks(id),

  -- Timestamps
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,

  -- Priority for ordering multiple lists
  priority INTEGER DEFAULT 0
);

CREATE INDEX idx_task_lists_user ON task_lists(user_id);
CREATE INDEX idx_task_lists_project ON task_lists(project_id);
CREATE INDEX idx_task_lists_idea ON task_lists(idea_id);
CREATE INDEX idx_task_lists_status ON task_lists(status);
CREATE INDEX idx_task_lists_telegram ON task_lists(telegram_chat_id);
```

### 6. Task List Items (Junction Table per Q1)

```sql
CREATE TABLE task_list_items (
  id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id),

  -- Ordering within list
  position INTEGER NOT NULL,

  -- Item-level status (can differ from task status)
  item_status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed, skipped

  -- Execution metadata
  started_at TEXT,
  completed_at TEXT,
  execution_notes TEXT,

  added_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(task_list_id, task_id),
  UNIQUE(task_list_id, position)
);

CREATE INDEX idx_task_list_items_list ON task_list_items(task_list_id);
CREATE INDEX idx_task_list_items_task ON task_list_items(task_id);
CREATE INDEX idx_task_list_items_position ON task_list_items(task_list_id, position);
```

### 7. Task Relationships (All 11 Types per Q3)

```sql
CREATE TABLE task_relationships (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Relationship type (11 types per Q3)
  relationship_type TEXT NOT NULL,
  -- Types: depends_on, blocks, related_to, duplicate_of,
  --        subtask_of, supersedes, implements, conflicts_with,
  --        enables, inspired_by, tests

  -- Metadata
  strength REAL,                       -- 0-1 for similarity scores
  notes TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),

  UNIQUE(source_task_id, target_task_id, relationship_type),
  CHECK(source_task_id != target_task_id)
);

CREATE INDEX idx_relationships_source ON task_relationships(source_task_id);
CREATE INDEX idx_relationships_target ON task_relationships(target_task_id);
CREATE INDEX idx_relationships_type ON task_relationships(relationship_type);
```

### 8. Task Templates (Reusable Tasks per Q21)

```sql
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,

  -- Template content
  default_acceptance_criteria TEXT DEFAULT '[]',
  default_codebase_tests TEXT DEFAULT '[]',
  default_api_tests TEXT DEFAULT '[]',
  default_ui_tests TEXT DEFAULT '[]',
  default_affected_files TEXT DEFAULT '[]',

  -- Scope (templates can be global, project, or user level)
  scope TEXT NOT NULL DEFAULT 'global',  -- global, project, user
  scope_id TEXT,                         -- project_id or user_id if scoped

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_templates_scope ON task_templates(scope, scope_id);
CREATE INDEX idx_templates_category ON task_templates(category);
```

---

## Supporting Tables

### 9. Task State History

```sql
CREATE TABLE task_state_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,

  changed_by TEXT NOT NULL,  -- user_id or agent_id
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_history_task ON task_state_history(task_id);
CREATE INDEX idx_history_time ON task_state_history(changed_at);
```

### 10. Task Test Results

```sql
CREATE TABLE task_test_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_list_id TEXT REFERENCES task_lists(id),  -- Which list execution

  -- Test identification
  test_level TEXT NOT NULL,            -- codebase, api, ui
  test_index INTEGER NOT NULL,         -- Index in the test array
  test_description TEXT,

  -- Result
  status TEXT NOT NULL,                -- passed, failed, skipped, error
  output TEXT,
  error TEXT,
  duration_ms INTEGER,

  -- Execution metadata
  executed_by TEXT NOT NULL,           -- build-agent or specific agent
  executed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_results_task ON task_test_results(task_id);
CREATE INDEX idx_results_list ON task_test_results(task_list_id);
CREATE INDEX idx_results_status ON task_test_results(status);
```

### 11. Task Blocks

```sql
CREATE TABLE task_blocks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Block type
  block_type TEXT NOT NULL,  -- validation, dependency, manual, conflict
  reason TEXT NOT NULL,
  blocking_entity_id TEXT,   -- task_id if dependency

  -- Resolution
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_notes TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_blocks_task ON task_blocks(task_id);
CREATE INDEX idx_blocks_unresolved ON task_blocks(task_id) WHERE resolved_at IS NULL;
```

### 12. Questions Queue (for Telegram Q&A per Q25)

```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,

  -- Context
  task_list_id TEXT NOT NULL REFERENCES task_lists(id),
  task_id TEXT REFERENCES tasks(id),   -- Optional: specific task

  -- Question content
  question_type TEXT NOT NULL,         -- validation, approval, duplicate_merge, decision
  priority TEXT NOT NULL DEFAULT 'medium',  -- critical, high, medium, low
  question_text TEXT NOT NULL,
  options TEXT,                        -- JSON array of options

  -- Telegram tracking (per Q25 - unique callback per question)
  telegram_message_id TEXT,
  callback_data TEXT UNIQUE,           -- Unique ID for button callbacks

  -- Response
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, answered, expired, skipped
  answer TEXT,
  answered_at TEXT,
  answered_by TEXT,

  -- Timeout handling (per Q8)
  timeout_action TEXT,                 -- None for critical/high, configurable for medium/low
  expires_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_questions_list ON questions(task_list_id);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_priority ON questions(priority);
CREATE INDEX idx_questions_callback ON questions(callback_data);
```

### 13. Validation Rules

```sql
CREATE TABLE validation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Rule configuration
  rule_type TEXT NOT NULL,   -- required_field, test_required, pattern_match, custom
  category_filter TEXT,      -- Comma-separated categories (null = all)
  config TEXT NOT NULL,      -- JSON configuration

  -- Severity
  severity TEXT NOT NULL DEFAULT 'error',  -- error (blocking), warning
  enabled INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 14. Task Execution Log (Build Agent Session Handoff + SIA Analysis)

The execution log serves two critical purposes:
1. **Build Agent Handoff**: When Build Agent 2 starts, it reads the **last 500 lines** of the execution log to understand what Build Agent 1 accomplished and what remains
2. **SIA Analysis**: When SIA is spawned (after 3+ failures with no progress), it analyzes the execution log to identify patterns and propose fixes

**execution_id = Lane Isolation:**

The `id` (execution_id) is the "lane" that keeps parallel Build Agents isolated:
- Each task list execution gets a unique execution_id
- Multiple Build Agents can run in parallel, each in their own lane
- When Build Agent 2 takes over from Build Agent 1, they use the SAME execution_id
- No cross-lane interference when running in parallel

```
Build Agent A (exec-abc123) → Task List A execution log
Build Agent B (exec-def456) → Task List B execution log
Build Agent C (exec-ghi789) → Task List C execution log
```

**Design:** The execution log is stored as a **line-based text log** in addition to structured metadata. This allows:
- Easy "last N lines" retrieval for Build Agent context
- Pattern matching and analysis by SIA
- Human readability for debugging
- Lane isolation via execution_id

```sql
CREATE TABLE task_execution_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_list_id TEXT NOT NULL REFERENCES task_lists(id),
  agent_session_id TEXT NOT NULL,       -- Which Build Agent instance

  -- Timing
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,

  -- Status
  status TEXT NOT NULL,                  -- 'running', 'completed', 'failed', 'interrupted'

  -- Structured metadata
  attempts INTEGER DEFAULT 1,
  last_error TEXT,                       -- Error message if failed
  files_modified TEXT DEFAULT '[]',      -- JSON array of files touched
  git_commits TEXT DEFAULT '[]',         -- JSON array of commit SHAs

  -- LINE-BASED LOG (KEY for handoff)
  -- Each line is timestamped and describes an action taken
  -- Build Agent 2 reads last 500 lines to get bearings
  -- SIA reads full log for pattern analysis
  log_content TEXT NOT NULL DEFAULT '',  -- Line-based execution log

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_execution_log_task ON task_execution_log(task_id);
CREATE INDEX idx_execution_log_list ON task_execution_log(task_list_id);
CREATE INDEX idx_execution_log_session ON task_execution_log(agent_session_id);
CREATE INDEX idx_execution_log_status ON task_execution_log(status);
```

**Log Content Format (line-based):**

```
[2026-01-12T10:00:00Z] SESSION START: agent-session-abc
[2026-01-12T10:00:01Z] TASK: TU-PROJ-FEA-003 - Create user service
[2026-01-12T10:00:05Z] ACTION: Creating file server/services/user.ts
[2026-01-12T10:00:10Z] ACTION: Added UserService class skeleton
[2026-01-12T10:00:15Z] ACTION: Implemented login() method
[2026-01-12T10:00:20Z] TEST: Running codebase tests...
[2026-01-12T10:00:25Z] TEST PASS: tsc --noEmit (0 errors)
[2026-01-12T10:00:30Z] TEST PASS: eslint (0 warnings)
[2026-01-12T10:00:35Z] PROGRESS: login() complete, logout() remaining
[2026-01-12T10:00:40Z] GIT: Committed "feat: add UserService with login method" (abc123)
[2026-01-12T10:00:45Z] SESSION END: interrupted (timeout)
[2026-01-12T10:00:45Z] REMAINING: logout() method, session validation
```

**Build Agent 2 Startup (reads last 500 lines):**

```python
# Build Agent context loading
def get_bearings(task_id: str) -> str:
    """Read last 500 lines of execution log to understand current state."""
    log = db.query("""
        SELECT log_content FROM task_execution_log
        WHERE task_id = ?
        ORDER BY started_at DESC
        LIMIT 1
    """, [task_id])

    if not log:
        return "No previous execution history"

    lines = log.log_content.split('\n')
    last_500 = lines[-500:]  # Last 500 lines
    return '\n'.join(last_500)
```

**SIA Analysis (reads full log):**

```python
# SIA failure pattern analysis
def analyze_failures(task_id: str) -> FailureAnalysis:
    """SIA reads full execution log to identify failure patterns."""
    logs = db.query("""
        SELECT log_content, last_error, attempts
        FROM task_execution_log
        WHERE task_id = ?
        ORDER BY started_at ASC
    """, [task_id])

    # Concatenate all logs for pattern analysis
    full_history = '\n---SESSION BOUNDARY---\n'.join(
        [log.log_content for log in logs]
    )

    # Analyze for patterns
    return {
        'total_attempts': sum(log.attempts for log in logs),
        'repeated_errors': find_repeated_errors(logs),
        'stuck_points': identify_stuck_points(full_history),
        'suggested_fix': propose_fix(full_history)
    }
```

**Appending to Log (Build Agent writes continuously):**

```python
def append_to_log(execution_id: str, line: str):
    """Append a timestamped line to the execution log."""
    timestamp = datetime.utcnow().isoformat() + 'Z'
    formatted_line = f"[{timestamp}] {line}\n"

    db.execute("""
        UPDATE task_execution_log
        SET log_content = log_content || ?
        WHERE id = ?
    """, [formatted_line, execution_id])
```

---

## Views

### Ready Tasks View

```sql
CREATE VIEW ready_tasks AS
SELECT t.*
FROM tasks t
WHERE t.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM task_blocks b
    WHERE b.task_id = t.id AND b.resolved_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM task_relationships r
    JOIN tasks dep ON r.target_task_id = dep.id
    WHERE r.source_task_id = t.id
      AND r.relationship_type = 'depends_on'
      AND dep.status != 'completed'
  )
  AND json_array_length(t.codebase_tests) > 0;  -- Must have tests (per Q5)
```

### Task Priority View (per Q15)

```sql
CREATE VIEW task_priority AS
SELECT
  t.id,
  t.title,
  t.status,
  t.risk_level,
  t.deadline,
  t.blocks_count,
  t.is_quick_win,
  -- Priority formula: blocking others + quick win + deadline
  (
    (t.blocks_count * 20) +                           -- +20 per blocked task
    (CASE WHEN t.is_quick_win = 1 THEN 15 ELSE 0 END) +  -- +15 for quick wins
    (CASE
      WHEN t.deadline IS NOT NULL AND
           julianday(t.deadline) - julianday('now') <= 3
      THEN 30
      ELSE 0
    END)                                              -- +30 if deadline within 3 days
  ) AS computed_priority
FROM tasks t
WHERE t.status IN ('pending', 'draft')
ORDER BY computed_priority DESC;
```

### Active Task Lists View

```sql
CREATE VIEW active_task_lists AS
SELECT
  tl.*,
  p.name AS project_name,
  i.name AS idea_name,
  COUNT(tli.id) AS item_count,
  SUM(CASE WHEN tli.item_status = 'completed' THEN 1 ELSE 0 END) AS items_completed
FROM task_lists tl
LEFT JOIN projects p ON tl.project_id = p.id
LEFT JOIN ideas i ON tl.idea_id = i.id
LEFT JOIN task_list_items tli ON tl.id = tli.task_list_id
WHERE tl.status IN ('draft', 'active', 'paused')
GROUP BY tl.id;
```

---

## Key Enums

### Task Status

```typescript
type TaskStatus =
  | 'draft'        // Created but not validated
  | 'pending'      // Validated, ready for execution
  | 'blocked'      // Cannot proceed
  | 'in_progress'  // Currently being worked on
  | 'validating'   // Running tests
  | 'failed'       // Execution/tests failed
  | 'stale'        // No activity for threshold
  | 'completed'    // All tests passed
  | 'cancelled';   // Explicitly cancelled
```

### Task List Status

```typescript
type TaskListStatus =
  | 'draft'        // Being assembled
  | 'active'       // Currently executing
  | 'paused'       // Temporarily stopped
  | 'completed'    // All tasks done
  | 'failed';      // Critical failure, stopped
```

### Relationship Types (11 per Q3)

```typescript
type RelationshipType =
  | 'depends_on'     // Must complete first
  | 'blocks'         // Prevents this from starting
  | 'related_to'     // Semantic relationship
  | 'duplicate_of'   // Same task
  | 'subtask_of'     // Parent-child hierarchy
  | 'supersedes'     // Replaces older task
  | 'implements'     // Implements spec/requirement
  | 'conflicts_with' // Cannot run together
  | 'enables'        // Soft dependency
  | 'inspired_by'    // Conceptual link
  | 'tests';         // Tests another task
```

### Question Priority

```typescript
type QuestionPriority =
  | 'critical'   // Always asked immediately
  | 'high'       // Always asked
  | 'medium'     // Toggle-controlled (default: ask)
  | 'low';       // Toggle-controlled (default: skip)
```

---

## Migration Strategy

Since tasks currently exist in MD files, migration involves:

### Phase 1: Schema Creation
1. Create all tables above
2. Create indexes and views
3. Create validation rules

### Phase 2: Data Migration
1. Parse existing task MD files
2. Extract frontmatter and content
3. Map to new schema
4. Preserve IDs and relationships

### Phase 3: Frontend Updates
1. Update task CRUD to use DB
2. Remove MD file dependencies
3. Update visualization components

### Phase 4: Cleanup
1. Archive old MD files
2. Update CLAUDE.md references
3. Update agent specs

---

## TypeScript Types

```typescript
interface Task {
  id: string;
  userId: string;
  projectId?: string;
  ideaId?: string;
  parentTaskId?: string;

  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  riskLevel: 'low' | 'medium' | 'high';

  priorityScore: number;
  blocksCount: number;
  isQuickWin: boolean;
  deadline?: string;

  acceptanceCriteria: AcceptanceCriterion[];
  codebaseTests: CodebaseTest[];
  apiTests: ApiTest[];
  uiTests: UiTest[];

  assignedAgent?: string;
  estimatedEffort?: EffortBucket;
  actualEffortMinutes?: number;

  affectedFiles: AffectedFile[];
  executionLog: ExecutionAttempt[];

  version: number;
  supersedesTaskId?: string;

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface TaskList {
  id: string;
  name: string;
  description?: string;

  userId: string;
  projectId?: string;
  ideaId?: string;

  status: TaskListStatus;

  // Settings (toggles)
  userApprovalRequired: boolean;
  autoExecuteLowRisk: boolean;
  autoAnswerMediumLow: boolean;

  telegramChatId?: string;

  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskId?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  priority: number;
}

interface Question {
  id: string;
  taskListId: string;
  taskId?: string;

  questionType: QuestionType;
  priority: QuestionPriority;
  questionText: string;
  options?: QuestionOption[];

  telegramMessageId?: string;
  callbackData?: string;

  status: 'pending' | 'answered' | 'expired' | 'skipped';
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;

  timeoutAction?: string;
  expiresAt?: string;

  createdAt: string;
}

// Build Agent Session Handoff + SIA Analysis
interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskListId: string;
  agentSessionId: string;

  startedAt: string;
  endedAt?: string;

  status: 'running' | 'completed' | 'failed' | 'interrupted';

  // Structured metadata
  attempts: number;
  lastError?: string;
  filesModified: string[];     // Files touched
  gitCommits: string[];        // Commit SHAs

  // LINE-BASED LOG (KEY for handoff and SIA)
  // Build Agent 2 reads last 500 lines to get bearings
  // SIA reads full log for pattern analysis
  logContent: string;          // Line-based execution log

  createdAt: string;
}
```

---

## Graph Visualization Data (per Q4)

For the relational graph with filtering:

```typescript
interface GraphNode {
  id: string;
  type: 'task' | 'task_list' | 'idea' | 'project';
  label: string;
  status?: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: RelationshipType;
  strength?: number;
}

interface GraphFilter {
  projectId?: string;
  ideaId?: string;
  taskListId?: string;
  statusFilter?: TaskStatus[];
  relationshipFilter?: RelationshipType[];
  depthLimit?: number;  // How many hops from selected node
}
```

---

## Next Steps

1. Create migration scripts
2. Update frontend components
3. Update API routes
4. Create graph visualization component
5. Integrate with Telegram bot
