-- Migration: Add missing columns to questions table for API compatibility
-- These columns are expected by /api/questions endpoints

-- Add priority column (1-10 scale, higher = more important)
ALTER TABLE questions ADD COLUMN priority INTEGER DEFAULT 5;

-- Add agent_type column (derived from agent_id in current schema)
ALTER TABLE questions ADD COLUMN agent_type TEXT DEFAULT 'unknown';

-- Add answer column (stores the response once answered)
ALTER TABLE questions ADD COLUMN answer TEXT;

-- Add answered_at timestamp
ALTER TABLE questions ADD COLUMN answered_at TEXT;

-- Add message tracking columns
ALTER TABLE questions ADD COLUMN message_id INTEGER;
ALTER TABLE questions ADD COLUMN chat_id TEXT;

-- Add default_option (for skip with default behavior)
ALTER TABLE questions ADD COLUMN default_option TEXT;

-- Add expiration support
ALTER TABLE questions ADD COLUMN expires_at TEXT;

-- Add project context columns
ALTER TABLE questions ADD COLUMN project_name TEXT;
ALTER TABLE questions ADD COLUMN task_id TEXT;
ALTER TABLE questions ADD COLUMN task_list_name TEXT;

-- Create index for priority-based ordering
CREATE INDEX IF NOT EXISTS idx_questions_priority ON questions(priority, status);

-- Update existing questions to derive agent_type from agent_id
UPDATE questions SET agent_type =
  CASE
    WHEN agent_id LIKE 'spec%' THEN 'specification'
    WHEN agent_id LIKE 'build%' THEN 'build'
    WHEN agent_id LIKE 'valid%' THEN 'validation'
    WHEN agent_id LIKE 'sia%' THEN 'sia'
    WHEN agent_id LIKE 'ux%' THEN 'ux'
    WHEN agent_id LIKE 'monitor%' THEN 'monitoring'
    ELSE 'unknown'
  END
WHERE agent_type = 'unknown' OR agent_type IS NULL;
