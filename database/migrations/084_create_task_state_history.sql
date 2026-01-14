-- Migration 084: Create task_state_history table
-- Purpose: Full audit trail of task state transitions
-- Part of: Task System V2 Implementation Plan (IMPL-1.7)

CREATE TABLE IF NOT EXISTS task_state_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- State transition
  from_status TEXT,                    -- NULL for creation
  to_status TEXT NOT NULL,

  -- Actor
  changed_by TEXT NOT NULL,            -- user_id, agent_id, or 'system'
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),

  -- Context
  reason TEXT,
  metadata TEXT,                       -- JSON for additional context

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_state_history_task ON task_state_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_state_history_time ON task_state_history(created_at);
CREATE INDEX IF NOT EXISTS idx_task_state_history_status ON task_state_history(to_status);
