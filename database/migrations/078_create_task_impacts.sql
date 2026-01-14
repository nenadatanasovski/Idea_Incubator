-- Migration 078: Create task_impacts table
-- Purpose: Track what a task impacts (file, api, function, database, type) with CRUD operations
-- Part of: Task System V2 Implementation Plan (IMPL-1.1)

CREATE TABLE IF NOT EXISTS task_impacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Impact classification
  impact_type TEXT NOT NULL CHECK (impact_type IN ('file', 'api', 'function', 'database', 'type')),
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),

  -- Target identification
  target_path TEXT NOT NULL,           -- e.g., "server/routes/auth.ts"
  target_name TEXT,                    -- e.g., "loginHandler" for functions
  target_signature TEXT,               -- e.g., "(req: Request, res: Response) => void"

  -- Confidence tracking
  confidence REAL NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'pattern', 'user', 'validated')),

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_impacts_task_id ON task_impacts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_impacts_type_op ON task_impacts(impact_type, operation);
CREATE INDEX IF NOT EXISTS idx_task_impacts_target ON task_impacts(target_path);
