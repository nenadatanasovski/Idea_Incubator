-- Migration: Add evaluation_sessions table
-- This table tracks evaluation runs for ideas

CREATE TABLE IF NOT EXISTS evaluation_sessions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    content_hash TEXT,
    overall_score REAL,
    overall_confidence REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

-- Add session_id column to evaluations table if not exists
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround
-- The column may already exist from the initial schema

CREATE INDEX IF NOT EXISTS idx_evaluation_sessions_idea_id ON evaluation_sessions(idea_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_sessions_created_at ON evaluation_sessions(created_at);
