-- Migration: 096_create_projects_table.sql
-- Purpose: Create formal projects table to bridge ideas and tasks
-- Part of: Project Entity Formalization

-- Projects table: bridges Ideas (ideation) and Tasks (execution)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,

  -- Human-readable identifiers
  slug TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,  -- 2-4 char code for display IDs (e.g., "IDEA", "VIBE")

  -- Core metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Link to originating idea (1:1 relationship)
  -- One idea can have at most one project, one project belongs to at most one idea
  idea_id TEXT UNIQUE REFERENCES ideas(id) ON DELETE SET NULL,

  -- Ownership
  owner_id TEXT,  -- User ID (nullable for now)

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
    'active',     -- Actively being worked on
    'paused',     -- Temporarily paused
    'completed',  -- All tasks done
    'archived'    -- No longer active
  )),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,      -- When first task started
  completed_at TEXT     -- When all tasks completed
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_idea_id ON projects(idea_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- Update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updated_at = datetime('now') WHERE id = OLD.id;
END;
