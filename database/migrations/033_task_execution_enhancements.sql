-- Migration 033: Task Execution Enhancements
-- Created: 2025-01-11
-- Purpose: Add columns for enhanced task execution tracking (EXE-003)

-- Add new columns to task_executions table for result collection
ALTER TABLE task_executions ADD COLUMN task_list_path TEXT;
ALTER TABLE task_executions ADD COLUMN assigned_agent TEXT;
ALTER TABLE task_executions ADD COLUMN attempts INTEGER DEFAULT 1;
ALTER TABLE task_executions ADD COLUMN output TEXT;
ALTER TABLE task_executions ADD COLUMN error TEXT;
ALTER TABLE task_executions ADD COLUMN files_modified TEXT; -- JSON array of file paths
ALTER TABLE task_executions ADD COLUMN questions_asked INTEGER DEFAULT 0;
ALTER TABLE task_executions ADD COLUMN tokens_used INTEGER DEFAULT 0;

-- Add index for task_list_path for querying by project/task list
CREATE INDEX IF NOT EXISTS idx_task_executions_task_list ON task_executions(task_list_path);

-- Add index for assigned_agent for querying by agent
CREATE INDEX IF NOT EXISTS idx_task_executions_agent ON task_executions(assigned_agent);

-- Update status column to support new statuses
-- Note: SQLite doesn't allow modifying CHECK constraints directly, so this is for documentation
-- The actual constraint allows: pending, running, validating, completed, failed, skipped
-- Our code will also use: in_progress (maps to running), complete (maps to completed), timeout, cancelled
