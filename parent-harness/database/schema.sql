-- Parent Harness Database Schema
-- Based on Vibe platform task structure with observability additions
-- Created: 2026-02-06

-- ============================================
-- TASK MANAGEMENT (copied from Vibe)
-- ============================================

-- Display ID sequences (per-project)
CREATE TABLE IF NOT EXISTS display_id_sequences (
    project_id TEXT PRIMARY KEY,
    last_sequence INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Task Lists
CREATE TABLE IF NOT EXISTS task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN (
        'draft', 'ready', 'in_progress', 'paused', 'completed', 'archived'
    )),
    max_parallel_agents INTEGER DEFAULT 3,
    auto_execute INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Tasks (core table)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    display_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN (
        'feature', 'bug', 'task', 'story', 'epic', 'spike',
        'improvement', 'documentation', 'test', 'devops',
        'design', 'research', 'infrastructure', 'security',
        'performance', 'other'
    )) DEFAULT 'task',
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'draft', 'evaluating', 'pending', 'in_progress',
        'completed', 'failed', 'blocked', 'skipped'
    )),
    queue TEXT CHECK(queue IS NULL OR queue = 'evaluation'),
    task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
    project_id TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    effort TEXT CHECK(effort IN ('trivial', 'small', 'medium', 'large', 'epic')) DEFAULT 'medium',
    phase INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    owner TEXT CHECK(owner IN ('build_agent', 'human', 'task_agent', 'spec_agent', 'qa_agent')) DEFAULT 'build_agent',
    assigned_agent_id TEXT,
    -- Decomposition tracking
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    is_decomposed INTEGER DEFAULT 0,
    decomposition_id TEXT,
    -- Pass criteria (JSON array)
    pass_criteria TEXT,
    verification_status TEXT CHECK(verification_status IN (
        'pending', 'passed', 'failed', 'needs_revision'
    )),
    -- Links
    spec_link TEXT,
    pr_link TEXT,
    -- Created by
    created_by TEXT,  -- 'user', 'task_agent', 'qa_agent', etc.
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Task relationships (dependencies)
CREATE TABLE IF NOT EXISTS task_relationships (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        'depends_on', 'blocks', 'related_to', 'duplicate_of', 'parent_of', 'child_of'
    )),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_task_id, target_task_id, relationship_type)
);

-- ============================================
-- AGENT MANAGEMENT
-- ============================================

-- Agent definitions
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'orchestrator', 'build', 'spec', 'qa', 'task', 'sia', 'research', etc.
    model TEXT NOT NULL,  -- 'haiku', 'sonnet', 'opus'
    telegram_channel TEXT,
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'working', 'error', 'stuck', 'stopped')),
    current_task_id TEXT,
    current_session_id TEXT,
    last_heartbeat TEXT,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Agent sessions (each run of an agent)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    task_id TEXT REFERENCES tasks(id),
    status TEXT CHECK(status IN ('running', 'completed', 'failed', 'paused', 'terminated')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    current_iteration INTEGER DEFAULT 1,
    total_iterations INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    parent_session_id TEXT REFERENCES agent_sessions(id),
    metadata TEXT  -- JSON
);

-- Iteration logs
CREATE TABLE IF NOT EXISTS iteration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES agent_sessions(id),
    iteration_number INTEGER NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT CHECK(status IN ('running', 'completed', 'failed')),
    log_content TEXT,
    log_preview TEXT,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    errors TEXT,  -- JSON array
    checkpoints TEXT,  -- JSON array
    UNIQUE(session_id, iteration_number)
);

-- ============================================
-- MESSAGE BUS (inter-agent communication)
-- ============================================

CREATE TABLE IF NOT EXISTS message_bus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    source_agent TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,  -- JSON
    target_agent TEXT,  -- NULL = broadcast
    consumed_by TEXT DEFAULT '[]',  -- JSON array
    expires_at TEXT
);

-- ============================================
-- OBSERVABILITY
-- ============================================

-- Events (append-only, high-write)
CREATE TABLE IF NOT EXISTS observability_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    session_id TEXT,
    iteration_number INTEGER,
    severity TEXT CHECK(severity IN ('debug', 'info', 'warning', 'error')),
    message TEXT NOT NULL,
    payload TEXT,  -- JSON
    telegram_message_id TEXT
);

-- Cron tick tracking
CREATE TABLE IF NOT EXISTS cron_ticks (
    tick_number INTEGER PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')),
    actions_taken TEXT,  -- JSON
    agents_working INTEGER DEFAULT 0,
    agents_idle INTEGER DEFAULT 0,
    tasks_assigned INTEGER DEFAULT 0,
    qa_cycle INTEGER DEFAULT 0,  -- 1 if this was a QA cycle
    duration_ms INTEGER
);

-- QA audit results (every 15 minutes)
CREATE TABLE IF NOT EXISTS qa_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    tick_number INTEGER REFERENCES cron_ticks(tick_number),
    agents_checked TEXT,  -- JSON array of agent IDs
    stuck_agents TEXT,  -- JSON array of stuck agent IDs
    sessions_terminated TEXT,  -- JSON array of terminated session IDs
    findings TEXT,  -- JSON
    recommendations TEXT  -- JSON
);

-- ============================================
-- INDEXES
-- ============================================

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_display_id ON tasks(display_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_queue ON tasks(queue);
CREATE INDEX IF NOT EXISTS idx_tasks_task_list_id ON tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);

-- Task relationships
CREATE INDEX IF NOT EXISTS idx_task_rel_source ON task_relationships(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_target ON task_relationships(target_task_id);

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_task ON agent_sessions(task_id);

-- Iteration logs
CREATE INDEX IF NOT EXISTS idx_logs_session ON iteration_logs(session_id);

-- Message bus
CREATE INDEX IF NOT EXISTS idx_msgbus_timestamp ON message_bus(timestamp);
CREATE INDEX IF NOT EXISTS idx_msgbus_source ON message_bus(source_agent);
CREATE INDEX IF NOT EXISTS idx_msgbus_type ON message_bus(event_type);

-- Observability events
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON observability_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON observability_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_agent ON observability_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON observability_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_severity ON observability_events(severity);

-- ============================================
-- INITIAL DATA: Agent definitions
-- ============================================

INSERT OR IGNORE INTO agents (id, name, type, model, telegram_channel) VALUES
('orchestrator', 'Orchestrator', 'orchestrator', 'haiku', '@vibe-orchestrator'),
('build_agent', 'Build Agent', 'build', 'opus', '@vibe-build'),
('spec_agent', 'Spec Agent', 'spec', 'opus', '@vibe-spec'),
('qa_agent', 'QA Agent', 'qa', 'opus', '@vibe-qa'),
('task_agent', 'Task Agent', 'task', 'sonnet', '@vibe-task'),
('sia_agent', 'SIA (Ideation)', 'sia', 'opus', '@vibe-sia'),
('research_agent', 'Research Agent', 'research', 'sonnet', '@vibe-research'),
('evaluator_agent', 'Evaluator Agent', 'evaluator', 'opus', '@vibe-evaluator'),
('decomposition_agent', 'Decomposition Agent', 'decomposition', 'sonnet', '@vibe-decomposition'),
('validation_agent', 'Validation Agent', 'validation', 'sonnet', '@vibe-validation');
