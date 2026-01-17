-- Migration 101: Add execution log cleanup mechanism
-- Purpose: Prevent unbounded growth of task_execution_log table
-- Part of: GAP-008 - Build Agent Gap Remediation

-- Add retention policy metadata
CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_rows_per_task INTEGER,  -- NULL means unlimited
  last_cleanup_at TEXT,
  next_cleanup_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default policy for task_execution_log
INSERT OR IGNORE INTO retention_policies (id, table_name, retention_days, max_rows_per_task, enabled)
VALUES ('policy-task-exec-log', 'task_execution_log', 30, 1000, 1);

-- Insert policy for agent_heartbeats (also can grow unbounded)
INSERT OR IGNORE INTO retention_policies (id, table_name, retention_days, max_rows_per_task, enabled)
VALUES ('policy-agent-heartbeats', 'agent_heartbeats', 7, 500, 1);

-- Insert policy for task_failure_history
INSERT OR IGNORE INTO retention_policies (id, table_name, retention_days, max_rows_per_task, enabled)
VALUES ('policy-task-failure-history', 'task_failure_history', 90, NULL, 1);

-- Add index for cleanup queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_task_execution_log_created ON task_execution_log(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_created ON agent_heartbeats(created_at);

-- Create cleanup_log table to track cleanup operations
CREATE TABLE IF NOT EXISTS cleanup_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  rows_deleted INTEGER NOT NULL,
  cleanup_reason TEXT,  -- 'retention' or 'max_rows'
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cleanup_log_table ON cleanup_log(table_name);
CREATE INDEX IF NOT EXISTS idx_cleanup_log_started ON cleanup_log(started_at);
