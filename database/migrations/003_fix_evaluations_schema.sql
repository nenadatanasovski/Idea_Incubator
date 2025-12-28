-- Migration: Fix evaluations table schema to match code expectations

-- Add missing columns to evaluations table
ALTER TABLE evaluations ADD COLUMN session_id TEXT REFERENCES evaluation_sessions(id);
ALTER TABLE evaluations ADD COLUMN criterion_id TEXT;
ALTER TABLE evaluations ADD COLUMN criterion_name TEXT;
ALTER TABLE evaluations ADD COLUMN initial_score REAL;
ALTER TABLE evaluations ADD COLUMN created_at TEXT;

-- Copy existing data to new columns where applicable
UPDATE evaluations SET session_id = evaluation_run_id WHERE session_id IS NULL;
UPDATE evaluations SET criterion_name = criterion WHERE criterion_name IS NULL;
UPDATE evaluations SET initial_score = COALESCE(agent_score, final_score) WHERE initial_score IS NULL;
UPDATE evaluations SET created_at = evaluated_at WHERE created_at IS NULL;

-- Create index for session_id
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON evaluations(session_id);
