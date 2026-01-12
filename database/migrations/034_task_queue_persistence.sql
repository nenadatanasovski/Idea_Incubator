-- Migration 034: Task Queue Persistence
-- Created: 2025-01-11
-- Purpose: Add task queue persistence to survive server restarts (EXE-004)

-- Task Queue - persistent queue for autonomous execution
CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    task_list_path TEXT NOT NULL,
    task_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    section TEXT,
    description TEXT NOT NULL,
    dependencies TEXT, -- JSON array of task IDs
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    assigned_agent TEXT,
    position INTEGER NOT NULL, -- For maintaining queue order
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    queued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_queue_task_list ON task_queue(task_list_path);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority);
CREATE INDEX IF NOT EXISTS idx_task_queue_position ON task_queue(position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_queue_task_list_task ON task_queue(task_list_path, task_id);

-- Executor State - tracks executor configuration and state
CREATE TABLE IF NOT EXISTS executor_state (
    id TEXT PRIMARY KEY,
    task_list_path TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
    config_json TEXT, -- Serialized ExecutionConfig
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    skipped_tasks INTEGER DEFAULT 0,
    current_task_id TEXT,
    started_at TEXT,
    paused_at TEXT,
    stopped_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_executor_state_status ON executor_state(status);
CREATE INDEX IF NOT EXISTS idx_executor_state_task_list ON executor_state(task_list_path);

-- View for active queue items ordered by priority and position
CREATE VIEW IF NOT EXISTS v_active_queue AS
SELECT
    tq.id,
    tq.task_list_path,
    tq.task_id,
    tq.priority,
    tq.section,
    tq.description,
    tq.status,
    tq.assigned_agent,
    tq.position,
    tq.attempts,
    tq.queued_at,
    es.status as executor_status,
    CASE tq.priority
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
    END as priority_order
FROM task_queue tq
LEFT JOIN executor_state es ON tq.task_list_path = es.task_list_path
WHERE tq.status = 'queued'
ORDER BY priority_order ASC, tq.position ASC;
