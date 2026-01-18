-- Migration: Add name column to build_agent_instances
-- Required by pipeline status API

-- Add name column for human-readable agent identification
ALTER TABLE build_agent_instances ADD COLUMN name TEXT;

-- Update existing agents with generated names based on id
UPDATE build_agent_instances
SET name = 'Agent-' || substr(id, 1, 8)
WHERE name IS NULL;
