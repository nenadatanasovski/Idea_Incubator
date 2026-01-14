-- Migration 082: Create prd_tasks junction table
-- Purpose: Link PRDs to individual tasks with traceability
-- Part of: Task System V2 Implementation Plan (IMPL-1.5)

CREATE TABLE IF NOT EXISTS prd_tasks (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Traceability
  requirement_ref TEXT,                -- e.g., "success_criteria[0]"
  link_type TEXT NOT NULL DEFAULT 'implements' CHECK (link_type IN ('implements', 'tests', 'related')),

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(prd_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_prd_tasks_prd ON prd_tasks(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_tasks_task ON prd_tasks(task_id);
