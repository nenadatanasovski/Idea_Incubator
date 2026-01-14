-- Migration 077: Add Missing Task Columns
-- Purpose: Add columns that were defined in migration 070 but missing from actual table
-- Part of: Build Agent E2E Test Fixes

-- Add project_id column
ALTER TABLE tasks ADD COLUMN project_id TEXT;

-- Add phase column (for ordering within task list)
ALTER TABLE tasks ADD COLUMN phase INTEGER DEFAULT 1;

-- Add owner column (build_agent, human, task_agent)
ALTER TABLE tasks ADD COLUMN owner TEXT CHECK(owner IN ('build_agent', 'human', 'task_agent')) DEFAULT 'build_agent';

-- Add assigned_agent_id column
ALTER TABLE tasks ADD COLUMN assigned_agent_id TEXT;

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
