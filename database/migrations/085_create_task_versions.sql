-- Migration 085: Create task_versions table
-- Purpose: Full version history with checkpoint and rollback support
-- Part of: Task System V2 Implementation Plan (IMPL-1.8)

CREATE TABLE IF NOT EXISTS task_versions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Snapshot of task state
  snapshot TEXT NOT NULL,              -- JSON of entire task at this version

  -- Change tracking
  changed_fields TEXT NOT NULL,        -- JSON array of field names
  change_reason TEXT,

  -- Checkpoint support
  is_checkpoint INTEGER NOT NULL DEFAULT 0,
  checkpoint_name TEXT,

  -- Actor
  created_by TEXT NOT NULL,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(task_id, version)
);

CREATE INDEX IF NOT EXISTS idx_task_versions_task ON task_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_versions_checkpoint ON task_versions(is_checkpoint) WHERE is_checkpoint = 1;
