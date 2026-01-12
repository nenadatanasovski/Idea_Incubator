-- Migration 025: Build Agent Tables
-- Created: 2025-01-11
-- Purpose: Tables for Build Agent execution tracking

-- Build Executions - tracks overall build runs
CREATE TABLE IF NOT EXISTS build_executions (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    spec_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    current_task_id TEXT,
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    options_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_build_executions_status ON build_executions(status);
CREATE INDEX IF NOT EXISTS idx_build_executions_spec_id ON build_executions(spec_id);
CREATE INDEX IF NOT EXISTS idx_build_executions_created ON build_executions(created_at);

-- Task Executions - tracks individual task runs within a build
CREATE TABLE IF NOT EXISTS task_executions (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    file_path TEXT NOT NULL,
    attempt INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'validating', 'completed', 'failed', 'skipped')),
    started_at TEXT,
    completed_at TEXT,
    generated_code TEXT,
    validation_command TEXT,
    validation_output TEXT,
    validation_success INTEGER,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES build_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_executions_build ON task_executions(build_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON task_executions(task_id);

-- Build Checkpoints - for resuming builds
CREATE TABLE IF NOT EXISTS build_checkpoints (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    checkpoint_type TEXT DEFAULT 'task_complete' CHECK (checkpoint_type IN ('task_complete', 'task_failed', 'manual', 'auto')),
    state_json TEXT NOT NULL,
    completed_tasks TEXT,
    pending_tasks TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES build_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_build ON build_checkpoints(build_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON build_checkpoints(created_at);

-- Build Discoveries - gotchas and patterns learned during builds
CREATE TABLE IF NOT EXISTS build_discoveries (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL,
    task_id TEXT,
    discovery_type TEXT NOT NULL CHECK (discovery_type IN ('gotcha', 'pattern', 'decision')),
    content TEXT NOT NULL,
    file_pattern TEXT,
    action_type TEXT,
    confidence REAL DEFAULT 0.5,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (build_id) REFERENCES build_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discoveries_build ON build_discoveries(build_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_type ON build_discoveries(discovery_type);

-- View for latest build status
CREATE VIEW IF NOT EXISTS v_build_status AS
SELECT
    be.id,
    be.spec_id,
    be.status,
    be.tasks_total,
    be.tasks_completed,
    be.tasks_failed,
    be.started_at,
    be.completed_at,
    CASE
        WHEN be.tasks_total > 0 THEN ROUND((be.tasks_completed * 100.0) / be.tasks_total, 1)
        ELSE 0
    END as progress_pct,
    be.error_message,
    be.created_at
FROM build_executions be
ORDER BY be.created_at DESC;

-- View for task execution summary
CREATE VIEW IF NOT EXISTS v_task_summary AS
SELECT
    te.build_id,
    te.task_id,
    te.phase,
    te.action,
    te.file_path,
    te.status,
    te.attempt,
    te.validation_success,
    te.duration_ms,
    te.error_message
FROM task_executions te
ORDER BY te.created_at ASC;
