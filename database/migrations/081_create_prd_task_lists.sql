-- Migration 081: Create prd_task_lists junction table
-- Purpose: Link PRDs to task lists with ordering
-- Part of: Task System V2 Implementation Plan (IMPL-1.4)

CREATE TABLE IF NOT EXISTS prd_task_lists (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id) ON DELETE CASCADE,

  -- Ordering within PRD
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(prd_id, task_list_id)
);

CREATE INDEX IF NOT EXISTS idx_prd_task_lists_prd ON prd_task_lists(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_task_lists_list ON prd_task_lists(task_list_id);
