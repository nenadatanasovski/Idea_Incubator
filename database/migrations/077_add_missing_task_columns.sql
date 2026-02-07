-- Migration 077: Add Missing Task Columns
-- Purpose: Add columns that were defined in migration 070 but missing from actual table
-- Part of: Build Agent E2E Test Fixes
-- Note: These columns now exist in migration 070, so the ALTER TABLE statements
-- are skipped. Only the indexes are created.

-- project_id, phase, owner, assigned_agent_id already exist from migration 070

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
