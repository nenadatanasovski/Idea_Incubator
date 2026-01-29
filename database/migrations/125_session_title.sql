-- Migration 125: Add title column to ideation_sessions
-- This makes session titles independent of candidates and always editable

-- Add title column to ideation_sessions
ALTER TABLE ideation_sessions ADD COLUMN title TEXT;

-- Create index for title searches
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_title ON ideation_sessions(title);

-- Migrate existing titles from candidates to sessions
-- For each session, copy the title from its most recently updated active/forming candidate
UPDATE ideation_sessions
SET title = (
  SELECT title
  FROM ideation_candidates
  WHERE ideation_candidates.session_id = ideation_sessions.id
    AND ideation_candidates.status IN ('forming', 'active')
  ORDER BY updated_at DESC
  LIMIT 1
)
WHERE title IS NULL
  AND EXISTS (
    SELECT 1
    FROM ideation_candidates
    WHERE ideation_candidates.session_id = ideation_sessions.id
      AND ideation_candidates.status IN ('forming', 'active')
  );
