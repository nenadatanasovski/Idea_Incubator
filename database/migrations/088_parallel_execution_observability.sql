-- =============================================================================
-- Migration: 088_parallel_execution_observability.sql
-- Purpose: Add parallel execution tracking to observability tables
-- Created: 2026-01-16
-- Reference: docs/specs/observability/data-model/PARALLEL-EXECUTION-EXTENSIONS.md
-- Fixes: P1 wave_id FK, P2 max_parallel_agents in wave_statistics
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: wave_statistics
-- Pre-computed statistics per wave for efficient dashboard rendering
-- INCLUDES: max_parallel_agents column (P2 fix from data model alignment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wave_statistics (
    id TEXT PRIMARY KEY,

    -- Foreign keys
    wave_id TEXT NOT NULL UNIQUE,         -- FK to parallel_execution_waves
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs (denormalized for perf)

    -- Task counts
    task_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,

    -- Pass rate
    pass_rate REAL,                       -- 0.0 to 1.0

    -- Observability counts
    transcript_entry_count INTEGER NOT NULL DEFAULT 0,
    tool_use_count INTEGER NOT NULL DEFAULT 0,
    tool_error_count INTEGER NOT NULL DEFAULT 0,
    tool_blocked_count INTEGER NOT NULL DEFAULT 0,
    assertion_count INTEGER NOT NULL DEFAULT 0,
    assertion_pass_count INTEGER NOT NULL DEFAULT 0,
    assertion_fail_count INTEGER NOT NULL DEFAULT 0,
    skill_trace_count INTEGER NOT NULL DEFAULT 0,

    -- Parallelism tracking (P2 fix)
    max_parallel_agents INTEGER,          -- Peak concurrent agents in this wave

    -- Timing
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,

    -- Derived metrics
    avg_task_duration_ms INTEGER,         -- Average task duration in wave

    -- Update tracking
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (wave_id) REFERENCES parallel_execution_waves(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_wave_stats_execution ON wave_statistics(execution_id);
CREATE INDEX IF NOT EXISTS idx_wave_stats_wave ON wave_statistics(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_stats_timing ON wave_statistics(started_at, completed_at);


-- -----------------------------------------------------------------------------
-- Table: concurrent_execution_sessions
-- Tracks periods when multiple task lists execute concurrently
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concurrent_execution_sessions (
    id TEXT PRIMARY KEY,

    -- Session timing
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed')),

    -- Aggregated stats
    execution_count INTEGER NOT NULL DEFAULT 0,
    total_wave_count INTEGER NOT NULL DEFAULT 0,
    total_task_count INTEGER NOT NULL DEFAULT 0,
    total_agent_count INTEGER NOT NULL DEFAULT 0,

    -- Peak parallelism
    peak_concurrent_agents INTEGER DEFAULT 0,
    peak_concurrent_tasks INTEGER DEFAULT 0,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ces_status ON concurrent_execution_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ces_started ON concurrent_execution_sessions(started_at);


-- -----------------------------------------------------------------------------
-- Schema modifications: Add wave_id FKs to observability tables
-- These enable direct joins from observability data to wave metadata
-- -----------------------------------------------------------------------------

-- transcript_entries: Add wave_id column
ALTER TABLE transcript_entries ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
CREATE INDEX IF NOT EXISTS idx_transcript_wave_id ON transcript_entries(wave_id);

-- tool_uses: Add wave_id column
ALTER TABLE tool_uses ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
CREATE INDEX IF NOT EXISTS idx_tool_use_wave_id ON tool_uses(wave_id);

-- assertion_results: Add wave_id column
ALTER TABLE assertion_results ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
CREATE INDEX IF NOT EXISTS idx_assertion_wave_id ON assertion_results(wave_id);


-- -----------------------------------------------------------------------------
-- Schema modification: Add wave_id FK to build_agent_instances
-- Links each Build Agent instance to its execution wave
-- -----------------------------------------------------------------------------
ALTER TABLE build_agent_instances ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
CREATE INDEX IF NOT EXISTS idx_agents_wave ON build_agent_instances(wave_id);


-- -----------------------------------------------------------------------------
-- Schema modification: Add session_id to task_list_execution_runs
-- Links executions to concurrent execution sessions
-- -----------------------------------------------------------------------------
ALTER TABLE task_list_execution_runs ADD COLUMN session_id TEXT REFERENCES concurrent_execution_sessions(id);
CREATE INDEX IF NOT EXISTS idx_execution_session ON task_list_execution_runs(session_id);


-- -----------------------------------------------------------------------------
-- View: v_wave_progress
-- Dashboard-ready wave progress summary
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_wave_progress AS
SELECT
    pew.id as wave_id,
    pew.execution_run_id as execution_id,
    pew.wave_number,
    pew.status,
    pew.started_at,
    pew.completed_at,
    COALESCE(ws.task_count, pew.task_count, 0) as task_count,
    COALESCE(ws.completed_count, pew.completed_count, 0) as completed_count,
    COALESCE(ws.failed_count, pew.failed_count, 0) as failed_count,
    ws.pass_rate,
    COALESCE(ws.tool_use_count, 0) as tool_use_count,
    COALESCE(ws.assertion_count, 0) as assertion_count,
    COALESCE(ws.assertion_pass_count, 0) as assertion_pass_count,
    ws.duration_ms,
    ws.max_parallel_agents,
    tler.task_list_id,
    tl.name as task_list_name,
    tler.status as execution_status
FROM parallel_execution_waves pew
LEFT JOIN wave_statistics ws ON ws.wave_id = pew.id
LEFT JOIN task_list_execution_runs tler ON tler.id = pew.execution_run_id
LEFT JOIN task_lists_v2 tl ON tl.id = tler.task_list_id
ORDER BY pew.started_at DESC;


-- -----------------------------------------------------------------------------
-- View: v_active_agents
-- Dashboard-ready active agents view with wave context
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_active_agents AS
SELECT
    bai.id as agent_id,
    bai.process_id as instance_id,
    bai.status,
    bai.spawned_at as started_at,
    bai.last_heartbeat_at as last_heartbeat,
    t.id as task_id,
    t.display_id,
    t.title as task_title,
    pew.wave_number,
    pew.id as wave_id,
    pew.execution_run_id as execution_id,
    tl.name as task_list_name,
    ROUND((julianday('now') - julianday(bai.spawned_at)) * 86400) as running_seconds
FROM build_agent_instances bai
LEFT JOIN tasks t ON t.id = bai.task_id
LEFT JOIN parallel_execution_waves pew ON pew.id = bai.wave_id
LEFT JOIN task_list_execution_runs tler ON tler.id = pew.execution_run_id
LEFT JOIN task_lists_v2 tl ON tl.id = tler.task_list_id
WHERE bai.status IN ('running', 'spawning')
ORDER BY bai.spawned_at ASC;


-- -----------------------------------------------------------------------------
-- View: v_wave_tasks
-- Wave tasks with their observability metrics
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_wave_tasks AS
SELECT
    wta.id,
    wta.wave_id,
    wta.task_id,
    wta.position,
    t.display_id,
    t.title,
    t.status as task_status,
    pew.wave_number,
    pew.execution_run_id as execution_id,
    (SELECT COUNT(*) FROM tool_uses tu WHERE tu.task_id = t.id) as tool_use_count,
    (SELECT COUNT(*) FROM assertion_results ar WHERE ar.task_id = t.id) as assertion_count,
    (SELECT COUNT(*) FROM assertion_results ar WHERE ar.task_id = t.id AND ar.result = 'fail') as assertion_fail_count
FROM wave_task_assignments wta
JOIN tasks t ON t.id = wta.task_id
JOIN parallel_execution_waves pew ON pew.id = wta.wave_id;


-- -----------------------------------------------------------------------------
-- View: v_execution_summary
-- Execution-level summary with wave counts
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_execution_summary AS
SELECT
    tler.id as execution_id,
    tler.task_list_id,
    tl.name as task_list_name,
    tler.status,
    tler.started_at,
    tler.completed_at,
    tler.session_id,
    COUNT(DISTINCT pew.id) as wave_count,
    COUNT(DISTINCT wta.task_id) as task_count,
    SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    MAX(pew.wave_number) as max_wave_number,
    (SELECT COUNT(*) FROM build_agent_instances bai WHERE bai.wave_id IN (SELECT id FROM parallel_execution_waves WHERE execution_run_id = tler.id)) as total_agents_used
FROM task_list_execution_runs tler
LEFT JOIN task_lists_v2 tl ON tl.id = tler.task_list_id
LEFT JOIN parallel_execution_waves pew ON pew.execution_run_id = tler.id
LEFT JOIN wave_task_assignments wta ON wta.wave_id = pew.id
LEFT JOIN tasks t ON t.id = wta.task_id
GROUP BY tler.id;


-- -----------------------------------------------------------------------------
-- View: v_concurrent_session_summary
-- Summary of concurrent execution sessions
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_concurrent_session_summary AS
SELECT
    ces.id as session_id,
    ces.started_at,
    ces.completed_at,
    ces.status,
    ces.peak_concurrent_agents,
    ces.peak_concurrent_tasks,
    COUNT(DISTINCT tler.id) as execution_count,
    GROUP_CONCAT(DISTINCT tl.name, ', ') as task_lists,
    SUM(COALESCE(ws.task_count, 0)) as total_tasks,
    SUM(COALESCE(ws.completed_count, 0)) as total_completed,
    SUM(COALESCE(ws.failed_count, 0)) as total_failed
FROM concurrent_execution_sessions ces
LEFT JOIN task_list_execution_runs tler ON tler.session_id = ces.id
LEFT JOIN task_lists_v2 tl ON tl.id = tler.task_list_id
LEFT JOIN parallel_execution_waves pew ON pew.execution_run_id = tler.id
LEFT JOIN wave_statistics ws ON ws.wave_id = pew.id
GROUP BY ces.id;


-- -----------------------------------------------------------------------------
-- Trigger: Update wave_statistics on wave completion
-- Automatically computes aggregates when a wave completes
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS tr_wave_stats_on_complete
AFTER UPDATE OF status ON parallel_execution_waves
WHEN NEW.status IN ('completed', 'failed') AND OLD.status = 'in_progress'
BEGIN
    INSERT OR REPLACE INTO wave_statistics (
        id,
        wave_id,
        execution_id,
        task_count,
        completed_count,
        failed_count,
        skipped_count,
        pass_rate,
        transcript_entry_count,
        tool_use_count,
        tool_error_count,
        tool_blocked_count,
        assertion_count,
        assertion_pass_count,
        assertion_fail_count,
        skill_trace_count,
        max_parallel_agents,
        started_at,
        completed_at,
        duration_ms,
        avg_task_duration_ms,
        updated_at
    )
    SELECT
        COALESCE((SELECT id FROM wave_statistics WHERE wave_id = NEW.id), 'ws-' || lower(hex(randomblob(8)))),
        NEW.id,
        NEW.execution_run_id,
        -- Task counts from wave_task_assignments
        (SELECT COUNT(*) FROM wave_task_assignments wta WHERE wta.wave_id = NEW.id),
        (SELECT COUNT(*) FROM wave_task_assignments wta JOIN tasks t ON t.id = wta.task_id WHERE wta.wave_id = NEW.id AND t.status = 'complete'),
        (SELECT COUNT(*) FROM wave_task_assignments wta JOIN tasks t ON t.id = wta.task_id WHERE wta.wave_id = NEW.id AND t.status = 'failed'),
        (SELECT COUNT(*) FROM wave_task_assignments wta JOIN tasks t ON t.id = wta.task_id WHERE wta.wave_id = NEW.id AND t.status = 'skipped'),
        -- Pass rate
        CASE
            WHEN (SELECT COUNT(*) FROM wave_task_assignments wta WHERE wta.wave_id = NEW.id) > 0
            THEN ROUND(
                1.0 * (SELECT COUNT(*) FROM wave_task_assignments wta JOIN tasks t ON t.id = wta.task_id WHERE wta.wave_id = NEW.id AND t.status = 'complete') /
                (SELECT COUNT(*) FROM wave_task_assignments wta WHERE wta.wave_id = NEW.id),
                4
            )
            ELSE NULL
        END,
        -- Observability counts
        (SELECT COUNT(*) FROM transcript_entries te WHERE te.wave_id = NEW.id),
        (SELECT COUNT(*) FROM tool_uses tu WHERE tu.wave_id = NEW.id),
        (SELECT COUNT(*) FROM tool_uses tu WHERE tu.wave_id = NEW.id AND tu.is_error = 1),
        (SELECT COUNT(*) FROM tool_uses tu WHERE tu.wave_id = NEW.id AND tu.is_blocked = 1),
        (SELECT COUNT(*) FROM assertion_results ar WHERE ar.wave_id = NEW.id),
        (SELECT COUNT(*) FROM assertion_results ar WHERE ar.wave_id = NEW.id AND ar.result = 'pass'),
        (SELECT COUNT(*) FROM assertion_results ar WHERE ar.wave_id = NEW.id AND ar.result = 'fail'),
        (SELECT COUNT(*) FROM skill_traces st WHERE st.execution_id = NEW.execution_run_id),
        -- Max parallel agents (count agents that ran in this wave)
        (SELECT COUNT(*) FROM build_agent_instances bai WHERE bai.wave_id = NEW.id),
        -- Timing
        NEW.started_at,
        NEW.completed_at,
        CASE
            WHEN NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL
            THEN ROUND((julianday(NEW.completed_at) - julianday(NEW.started_at)) * 86400000)
            ELSE NULL
        END,
        -- Avg task duration (if we have completed tasks)
        CASE
            WHEN (SELECT COUNT(*) FROM build_agent_instances bai WHERE bai.wave_id = NEW.id AND bai.terminated_at IS NOT NULL) > 0
            THEN (
                SELECT AVG(ROUND((julianday(bai.terminated_at) - julianday(bai.spawned_at)) * 86400000))
                FROM build_agent_instances bai
                WHERE bai.wave_id = NEW.id AND bai.terminated_at IS NOT NULL
            )
            ELSE NULL
        END,
        datetime('now');
END;
