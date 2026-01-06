-- Migration 023: Add user_slug, idea_slug, and file_path columns to ideation_artifacts
-- Part of Unified File System Phase 1 (TEST-FS-003)

-- Add user_slug column (nullable for backward compatibility)
ALTER TABLE ideation_artifacts ADD COLUMN user_slug TEXT;

-- Add idea_slug column (nullable for backward compatibility)
ALTER TABLE ideation_artifacts ADD COLUMN idea_slug TEXT;

-- Add file_path column (nullable for backward compatibility)
ALTER TABLE ideation_artifacts ADD COLUMN file_path TEXT;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_user_slug ON ideation_artifacts(user_slug);
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_idea_slug ON ideation_artifacts(idea_slug);
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_user_idea ON ideation_artifacts(user_slug, idea_slug);
