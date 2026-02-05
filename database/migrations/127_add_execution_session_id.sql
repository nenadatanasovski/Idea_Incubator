-- Migration 127: Add session_id to task_list_execution_runs
-- Purpose: The execution-manager.ts expects a session_id column for concurrent execution tracking
-- that was never created in the original migration

ALTER TABLE task_list_execution_runs ADD COLUMN session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_exec_runs_session ON task_list_execution_runs(session_id);
