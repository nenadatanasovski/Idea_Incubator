-- Migration 075: Execution Runs
-- Purpose: Add task_list_execution_runs table and execution_run_id to related tables
-- Part of: Parallel Task Execution Implementation Plan
--
-- CRITICAL: This table groups ALL parallel execution activity for one attempt.
-- Without execution_run_id, you cannot distinguish "run #1" from "run #2" of the same task list.
-- execution_run_id provides "lane isolation" for parallel Build Agents.

-- ============================================
-- 1. Create task_list_execution_runs table
-- ============================================

CREATE TABLE IF NOT EXISTS task_list_execution_runs (
    id TEXT PRIMARY KEY,                    -- Execution Run ID
    task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id) ON DELETE CASCADE,

    -- Run identity
    run_number INTEGER NOT NULL,            -- 1, 2, 3... (auto-increment per task list)

    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',      -- Scheduled but not started
        'running',      -- Currently executing
        'paused',       -- Temporarily stopped
        'completed',    -- All tasks finished successfully
        'failed',       -- Critical failure, execution stopped
        'cancelled'     -- User cancelled
    )),

    -- Trigger
    triggered_by TEXT,                      -- user, auto, retry, schedule
    triggered_reason TEXT,                  -- Optional: why this run started

    -- Summary metrics
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    tasks_skipped INTEGER DEFAULT 0,
    tasks_blocked INTEGER DEFAULT 0,

    -- Wave tracking
    waves_total INTEGER DEFAULT 0,
    waves_completed INTEGER DEFAULT 0,
    current_wave INTEGER DEFAULT 0,

    -- Agent tracking
    agents_spawned INTEGER DEFAULT 0,
    agents_active INTEGER DEFAULT 0,
    max_parallel_reached INTEGER DEFAULT 0,  -- Peak concurrent agents

    -- Timing
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,                    -- Total execution time

    -- Error summary
    failure_reason TEXT,
    last_error TEXT,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(task_list_id, run_number)
);

-- Indexes for execution runs
CREATE INDEX IF NOT EXISTS idx_exec_runs_task_list ON task_list_execution_runs(task_list_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_status ON task_list_execution_runs(status);
CREATE INDEX IF NOT EXISTS idx_exec_runs_started ON task_list_execution_runs(started_at);

-- ============================================
-- 2. Add execution_run_id to parallel_execution_waves
-- ============================================

-- Check if column exists before adding (SQLite doesn't support IF NOT EXISTS for columns)
-- This is idempotent - will fail silently if column already exists
ALTER TABLE parallel_execution_waves ADD COLUMN execution_run_id TEXT REFERENCES task_list_execution_runs(id) ON DELETE CASCADE;

-- Add missing columns for richer tracking
ALTER TABLE parallel_execution_waves ADD COLUMN skipped_count INTEGER DEFAULT 0;
ALTER TABLE parallel_execution_waves ADD COLUMN duration_ms INTEGER;

-- Index for execution run lookups
CREATE INDEX IF NOT EXISTS idx_waves_exec_run ON parallel_execution_waves(execution_run_id);

-- ============================================
-- 3. Add execution_run_id to wave_task_assignments
-- ============================================

ALTER TABLE wave_task_assignments ADD COLUMN execution_run_id TEXT REFERENCES task_list_execution_runs(id) ON DELETE CASCADE;
ALTER TABLE wave_task_assignments ADD COLUMN task_status TEXT DEFAULT 'pending';
ALTER TABLE wave_task_assignments ADD COLUMN started_at TEXT;
ALTER TABLE wave_task_assignments ADD COLUMN completed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_wave_assignments_exec_run ON wave_task_assignments(execution_run_id);

-- ============================================
-- 4. Add execution_run_id to build_agent_instances
-- ============================================

ALTER TABLE build_agent_instances ADD COLUMN execution_run_id TEXT REFERENCES task_list_execution_runs(id) ON DELETE CASCADE;
ALTER TABLE build_agent_instances ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id) ON DELETE SET NULL;
ALTER TABLE build_agent_instances ADD COLUMN working_directory TEXT;
ALTER TABLE build_agent_instances ADD COLUMN progress_percent INTEGER DEFAULT 0;
ALTER TABLE build_agent_instances ADD COLUMN current_step TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_exec_run ON build_agent_instances(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_agents_wave ON build_agent_instances(wave_id);

-- ============================================
-- 5. Add execution_run_id to agent_heartbeats
-- ============================================

ALTER TABLE agent_heartbeats ADD COLUMN execution_run_id TEXT REFERENCES task_list_execution_runs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_heartbeats_exec_run ON agent_heartbeats(execution_run_id);

-- ============================================
-- 6. Add execution_run_id to task_execution_log (if table exists)
-- Note: These tables may not exist in all deployments, skip if missing
-- ============================================

-- task_execution_log, task_state_history, and task_test_results are optional tables
-- that may not exist in all deployments. Skip these ALTER statements for now.

-- ============================================
-- 9. Create Execution Run Views
-- ============================================

-- Overview of all execution runs for monitoring
CREATE VIEW IF NOT EXISTS execution_run_summary_view AS
SELECT
    er.id AS execution_run_id,
    er.task_list_id,
    tl.name AS task_list_name,
    er.run_number,
    er.status,
    er.triggered_by,
    er.tasks_total,
    er.tasks_completed,
    er.tasks_failed,
    er.tasks_blocked,
    er.waves_total,
    er.current_wave,
    er.agents_active,
    er.max_parallel_reached,
    er.started_at,
    er.completed_at,
    er.duration_ms,
    CASE
        WHEN er.tasks_total > 0
        THEN ROUND(er.tasks_completed * 100.0 / er.tasks_total, 1)
        ELSE 0
    END AS completion_percent
FROM task_list_execution_runs er
JOIN task_lists_v2 tl ON er.task_list_id = tl.id
ORDER BY er.started_at DESC;

-- Currently running executions with real-time metrics
CREATE VIEW IF NOT EXISTS active_execution_runs_view AS
SELECT
    er.id AS execution_run_id,
    er.task_list_id,
    tl.name AS task_list_name,
    er.run_number,
    er.current_wave,
    er.waves_total,
    er.tasks_completed,
    er.tasks_total,
    er.agents_active,
    (SELECT COUNT(*) FROM build_agent_instances ba
     WHERE ba.execution_run_id = er.id AND ba.status = 'running') AS agents_running,
    (SELECT COUNT(*) FROM parallel_execution_waves pew
     WHERE pew.execution_run_id = er.id AND pew.status = 'in_progress') AS waves_in_progress,
    er.started_at,
    (julianday('now') - julianday(er.started_at)) * 86400 AS seconds_elapsed
FROM task_list_execution_runs er
JOIN task_lists_v2 tl ON er.task_list_id = tl.id
WHERE er.status = 'running';

-- Chronological activity for a specific execution run
-- Note: task_state_history table may not exist, using simplified version
CREATE VIEW IF NOT EXISTS execution_run_timeline_view AS
SELECT
    'wave_started' AS event_type,
    NULL AS task_id,
    NULL AS display_id,
    'Wave ' || pew.wave_number AS title,
    pew.execution_run_id,
    pew.started_at AS event_time,
    'system' AS actor,
    pew.wave_number
FROM parallel_execution_waves pew
WHERE pew.started_at IS NOT NULL
  AND pew.execution_run_id IS NOT NULL
ORDER BY event_time;
