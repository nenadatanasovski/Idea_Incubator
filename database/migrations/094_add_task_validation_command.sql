-- Migration 091: Add validation_command column to tasks table
-- Part of GAP-001: Per-Task Validation Commands
-- This allows each task to specify its own validation command instead of hardcoded tsc

-- Add validation_command column to tasks table
ALTER TABLE tasks ADD COLUMN validation_command TEXT;

-- Add index for faster lookups when validation_command is not null
CREATE INDEX IF NOT EXISTS idx_tasks_validation_command ON tasks(validation_command) WHERE validation_command IS NOT NULL;
