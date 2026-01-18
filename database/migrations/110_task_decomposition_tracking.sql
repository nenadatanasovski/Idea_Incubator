-- Migration 110: Task Decomposition Tracking
-- Adds direct parent-child fields for efficient decomposition lineage queries

-- Add parent_task_id for direct parent reference
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

-- Add is_decomposed flag to mark tasks that have been split
ALTER TABLE tasks ADD COLUMN is_decomposed INTEGER DEFAULT 0;

-- Add decomposition_id to group sibling subtasks from same decomposition event
ALTER TABLE tasks ADD COLUMN decomposition_id TEXT;

-- Index for parent task lookups (find all children of a parent)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- Index for decomposition grouping (find all siblings)
CREATE INDEX IF NOT EXISTS idx_tasks_decomposition_id ON tasks(decomposition_id);

-- Partial index for decomposed tasks (efficient filtering)
CREATE INDEX IF NOT EXISTS idx_tasks_is_decomposed ON tasks(is_decomposed) WHERE is_decomposed = 1;
