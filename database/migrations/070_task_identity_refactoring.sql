-- Migration 070: Task Identity Refactoring
-- Purpose: Add display_id column, queue column, and make task_list_id nullable for listless tasks
-- Part of: Parallel Task Execution Implementation Plan (PTE-001 to PTE-006)

-- Create display_id sequences table to track per-project sequences
CREATE TABLE IF NOT EXISTS display_id_sequences (
    project_id TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create tasks table if not exists (core task table for Task Agent)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,

    -- Display ID: Human-readable ID like TU-PROJ-FEA-042
    display_id TEXT UNIQUE,

    -- Core fields
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN (
        'feature', 'bug', 'task', 'story', 'epic', 'spike',
        'improvement', 'documentation', 'test', 'devops',
        'design', 'research', 'infrastructure', 'security',
        'performance', 'other'
    )) DEFAULT 'task',

    -- Status management
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'draft', 'evaluating', 'pending', 'in_progress',
        'completed', 'failed', 'blocked', 'skipped'
    )),

    -- Queue: null (in task list) or 'evaluation' (in Evaluation Queue)
    queue TEXT CHECK(queue IS NULL OR queue = 'evaluation'),

    -- Task List reference (nullable for listless tasks in Evaluation Queue)
    task_list_id TEXT,

    -- Project reference
    project_id TEXT,

    -- Priority and effort
    priority TEXT CHECK(priority IN ('P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    effort TEXT CHECK(effort IN ('trivial', 'small', 'medium', 'large', 'epic')) DEFAULT 'medium',

    -- Phase for ordering within task list
    phase INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,

    -- Ownership
    owner TEXT CHECK(owner IN ('build_agent', 'human', 'task_agent')) DEFAULT 'build_agent',
    assigned_agent_id TEXT,

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Create task_lists_v2 table for new task list model
CREATE TABLE IF NOT EXISTS task_lists_v2 (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,

    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN (
        'draft', 'ready', 'in_progress', 'paused', 'completed', 'archived'
    )),

    -- Execution config
    max_parallel_agents INTEGER DEFAULT 3,
    auto_execute INTEGER DEFAULT 0,

    -- Statistics
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Create task_relationships table for dependencies and relations
CREATE TABLE IF NOT EXISTS task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        'depends_on',   -- Source depends on target (target must complete first)
        'blocks',       -- Source blocks target
        'related_to',   -- Thematic connection
        'duplicate_of', -- Source is duplicate of target
        'parent_of',    -- Hierarchical parent
        'child_of'      -- Hierarchical child
    )),
    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(source_task_id, target_task_id, relationship_type)
);

-- Create indexes for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_display_id ON tasks(display_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(queue);
CREATE INDEX IF NOT EXISTS idx_tasks_task_list_id ON tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Create indexes for task_relationships
CREATE INDEX IF NOT EXISTS idx_task_rel_source ON task_relationships(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_target ON task_relationships(target_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_type ON task_relationships(relationship_type);

-- Create indexes for task_lists_v2
CREATE INDEX IF NOT EXISTS idx_task_lists_v2_project ON task_lists_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_v2_status ON task_lists_v2(status);

-- View for tasks in Evaluation Queue
CREATE VIEW IF NOT EXISTS evaluation_queue_view AS
SELECT
    t.*,
    (julianday('now') - julianday(t.created_at)) AS days_in_queue,
    CASE WHEN julianday('now') - julianday(t.created_at) > 3 THEN 1 ELSE 0 END AS is_stale
FROM tasks t
WHERE t.queue = 'evaluation'
ORDER BY t.created_at ASC;

-- View for task list summaries
CREATE VIEW IF NOT EXISTS task_list_summary_view AS
SELECT
    tl.id,
    tl.name,
    tl.status,
    tl.project_id,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
    tl.created_at,
    tl.updated_at
FROM task_lists_v2 tl
LEFT JOIN tasks t ON t.task_list_id = tl.id
GROUP BY tl.id;
