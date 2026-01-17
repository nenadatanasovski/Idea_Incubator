-- Migration 102: Add spec workflow columns to prds table
-- Purpose: Enable spec workflow state tracking and ideation session linking
-- Part of: Ideation Agent Spec Generation Implementation (SPEC-001-A)

-- Add workflow_state column (separate from existing status for clarity)
ALTER TABLE prds ADD COLUMN workflow_state TEXT DEFAULT 'draft'
  CHECK (workflow_state IN ('draft', 'review', 'approved', 'archived'));

-- Add link to source ideation session
ALTER TABLE prds ADD COLUMN source_session_id TEXT REFERENCES ideation_sessions(id);

-- Add readiness score (0-100)
ALTER TABLE prds ADD COLUMN readiness_score INTEGER DEFAULT 0;

-- Add version tracking
ALTER TABLE prds ADD COLUMN version INTEGER DEFAULT 1;

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_prds_source_session ON prds(source_session_id);

-- Create index for workflow state filtering
CREATE INDEX IF NOT EXISTS idx_prds_workflow_state ON prds(workflow_state);
