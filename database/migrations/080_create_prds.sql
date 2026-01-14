-- Migration 080: Create prds table
-- Purpose: Product Requirements Documents with hierarchical linking
-- Part of: Task System V2 Implementation Plan (IMPL-1.3)

CREATE TABLE IF NOT EXISTS prds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,

  -- Ownership
  user_id TEXT NOT NULL,
  project_id TEXT,

  -- Hierarchy (self-referential for summary PRDs)
  parent_prd_id TEXT REFERENCES prds(id),

  -- Core content
  problem_statement TEXT,
  target_users TEXT,
  functional_description TEXT,

  -- Structured data (JSON arrays)
  success_criteria TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  constraints TEXT NOT NULL DEFAULT '[]',         -- JSON array of strings
  out_of_scope TEXT NOT NULL DEFAULT '[]',        -- JSON array of strings

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),

  -- Approval workflow
  approved_at TEXT,
  approved_by TEXT,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prds_user_id ON prds(user_id);
CREATE INDEX IF NOT EXISTS idx_prds_project_id ON prds(project_id);
CREATE INDEX IF NOT EXISTS idx_prds_parent ON prds(parent_prd_id);
CREATE INDEX IF NOT EXISTS idx_prds_status ON prds(status);
