-- Migration 076: Error Handling Infrastructure
-- Purpose: Add columns and tables for task failure tracking and retry logic
-- Part of: BA-041 to BA-052 (Error Handling Phase)

-- Add error tracking columns to tasks table
ALTER TABLE tasks ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE tasks ADD COLUMN last_error_type TEXT CHECK(last_error_type IN (
    'transient',      -- Temporary issues (network, timeout, rate limit)
    'permanent',      -- Non-recoverable errors (syntax error, missing file)
    'unknown'         -- Unclassified errors
));
ALTER TABLE tasks ADD COLUMN last_error_message TEXT;
ALTER TABLE tasks ADD COLUMN escalated_to_sia INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN escalated_at TEXT;

-- Task failure history table for tracking all failures
CREATE TABLE IF NOT EXISTS task_failure_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES build_agent_instances(id) ON DELETE SET NULL,

    -- Error classification
    error_type TEXT NOT NULL CHECK(error_type IN ('transient', 'permanent', 'unknown')),
    error_message TEXT NOT NULL,
    error_category TEXT,  -- e.g., 'validation_failed', 'compile_error', 'timeout'

    -- Context
    attempt_number INTEGER NOT NULL,
    current_step TEXT,
    file_path TEXT,

    -- Stack trace and output
    stack_trace TEXT,
    stdout_tail TEXT,
    stderr_tail TEXT,

    -- Decision
    decision TEXT CHECK(decision IN ('retry', 'skip', 'escalate', 'abort')),
    decision_reason TEXT,

    -- Timestamps
    failed_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by TEXT CHECK(resolved_by IN ('retry', 'skip', 'sia', 'human'))
);

CREATE INDEX IF NOT EXISTS idx_failure_history_task ON task_failure_history(task_id);
CREATE INDEX IF NOT EXISTS idx_failure_history_type ON task_failure_history(error_type);
CREATE INDEX IF NOT EXISTS idx_failure_history_time ON task_failure_history(failed_at);

-- SIA escalations table for tracking when tasks are escalated to Self-Improvement Agent
CREATE TABLE IF NOT EXISTS sia_escalations (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    task_list_id TEXT REFERENCES task_lists_v2(id) ON DELETE SET NULL,

    -- Escalation reason
    escalation_reason TEXT NOT NULL CHECK(escalation_reason IN (
        'max_retries_exceeded',   -- Hit retry limit
        'no_progress',            -- Same error repeated
        'repeated_failure',       -- Different errors, no success
        'manual_request'          -- User requested
    )),

    -- Failure context (JSON)
    failure_context TEXT NOT NULL,  -- JSON with recent errors, attempts, file states

    -- SIA response
    sia_status TEXT DEFAULT 'pending' CHECK(sia_status IN (
        'pending',     -- Waiting for SIA
        'analyzing',   -- SIA is analyzing
        'proposed',    -- SIA proposed a fix
        'applied',     -- Fix was applied
        'rejected',    -- Fix was rejected
        'failed'       -- SIA couldn't help
    )),
    sia_analysis TEXT,      -- SIA's analysis of the problem
    sia_proposed_fix TEXT,  -- What SIA proposes to do

    -- Resolution
    resolved INTEGER DEFAULT 0,
    resolution_notes TEXT,

    -- Timestamps
    escalated_at TEXT DEFAULT (datetime('now')),
    analyzed_at TEXT,
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sia_escalations_task ON sia_escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_sia_escalations_status ON sia_escalations(sia_status);
CREATE INDEX IF NOT EXISTS idx_sia_escalations_time ON sia_escalations(escalated_at);

-- View for tasks needing attention
CREATE VIEW IF NOT EXISTS tasks_needing_attention AS
SELECT
    t.id,
    t.display_id,
    t.title,
    t.status,
    t.consecutive_failures,
    t.retry_count,
    t.max_retries,
    t.last_error_type,
    t.last_error_message,
    t.escalated_to_sia,
    CASE
        WHEN t.escalated_to_sia = 1 THEN 'escalated'
        WHEN t.consecutive_failures >= 3 THEN 'stuck'
        WHEN t.consecutive_failures >= 1 THEN 'failing'
        ELSE 'ok'
    END AS attention_level,
    (SELECT COUNT(*) FROM task_failure_history tfh WHERE tfh.task_id = t.id) AS total_failures,
    (SELECT MAX(failed_at) FROM task_failure_history tfh WHERE tfh.task_id = t.id) AS last_failure_at
FROM tasks t
WHERE t.status = 'failed'
   OR t.consecutive_failures > 0
   OR t.escalated_to_sia = 1;

-- View for error patterns (useful for SIA learning)
CREATE VIEW IF NOT EXISTS error_pattern_analysis AS
SELECT
    error_category,
    error_type,
    COUNT(*) AS occurrence_count,
    COUNT(DISTINCT task_id) AS affected_tasks,
    AVG(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolution_rate,
    GROUP_CONCAT(DISTINCT resolved_by) AS resolution_methods
FROM task_failure_history
GROUP BY error_category, error_type
ORDER BY occurrence_count DESC;
