-- Migration 036: Add agent_id to task_executions
-- Created: 2025-01-11
-- Purpose: Add agent_id column to task_executions for direct agent tracking (DKG-005)

-- Add agent_id column to task_executions table
-- This provides a direct foreign key relationship to active_agents
-- Complements the existing assigned_agent TEXT field with proper relational integrity
ALTER TABLE task_executions ADD COLUMN agent_id TEXT;

-- Add foreign key constraint via index
-- Note: SQLite doesn't enforce FK constraints on ALTER TABLE ADD COLUMN
-- But the relationship is defined for tools that read schema metadata
-- FOREIGN KEY (agent_id) REFERENCES active_agents(agent_id) ON DELETE SET NULL

-- Create index for efficient querying by agent_id
CREATE INDEX IF NOT EXISTS idx_task_executions_agent_id ON task_executions(agent_id);

-- Update view to include agent_id in task summary
DROP VIEW IF EXISTS v_task_summary;
CREATE VIEW v_task_summary AS
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
    te.error_message,
    te.assigned_agent,
    te.agent_id,
    aa.agent_type,
    aa.state as agent_state
FROM task_executions te
LEFT JOIN active_agents aa ON te.agent_id = aa.agent_id
ORDER BY te.created_at ASC;

-- Create view for agent metrics calculation
-- This supports DKG-005's goal of tracking which agent executed which task
CREATE VIEW IF NOT EXISTS v_agent_task_metrics AS
SELECT
    te.agent_id,
    aa.agent_type,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN te.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    SUM(CASE WHEN te.status = 'skipped' THEN 1 ELSE 0 END) as skipped_tasks,
    ROUND(AVG(te.duration_ms), 2) as avg_duration_ms,
    MIN(te.started_at) as first_task_at,
    MAX(te.completed_at) as last_task_at,
    ROUND(
        CAST(SUM(CASE WHEN te.status = 'completed' THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as success_rate_pct
FROM task_executions te
LEFT JOIN active_agents aa ON te.agent_id = aa.agent_id
WHERE te.agent_id IS NOT NULL
GROUP BY te.agent_id, aa.agent_type;
