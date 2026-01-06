-- ============================================================================
-- MAKE ARTIFACT CONTENT NULLABLE FOR FILE-BACKED STORAGE
-- ============================================================================
-- This migration allows content to be NULL when artifacts are backed by files.
-- When file_path is set and content is NULL, the artifact is file-backed.
-- When content is set, the artifact is stored in the database (legacy mode).

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- Step 1: Create temporary table with new schema
CREATE TABLE IF NOT EXISTS ideation_artifacts_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'research',
    'mermaid',
    'markdown',
    'code',
    'analysis',
    'comparison',
    'idea-summary',
    'template'
  )),
  title TEXT NOT NULL,
  content TEXT,                                           -- Now nullable for file-backed artifacts
  language TEXT,
  queries TEXT,
  identifier TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('pending', 'loading', 'ready', 'error')),
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  user_slug TEXT,
  idea_slug TEXT,
  file_path TEXT                                          -- Path to file when content is NULL
);

-- Step 2: Copy data from old table
INSERT INTO ideation_artifacts_new
  SELECT id, session_id, type, title, content, language, queries, identifier,
         status, error, created_at, updated_at, user_slug, idea_slug, file_path
  FROM ideation_artifacts;

-- Step 3: Drop old table
DROP TABLE ideation_artifacts;

-- Step 4: Rename new table
ALTER TABLE ideation_artifacts_new RENAME TO ideation_artifacts;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_session ON ideation_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_user_slug ON ideation_artifacts(user_slug);
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_idea_slug ON ideation_artifacts(idea_slug);
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_user_idea ON ideation_artifacts(user_slug, idea_slug);
