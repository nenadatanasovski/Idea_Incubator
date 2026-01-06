-- Migration: 022_session_user_idea_columns
-- Description: Add user_slug and idea_slug columns to ideation_sessions table
-- This supports the unified file system by linking sessions to specific users and ideas

-- Add user_slug column to track which user owns this session
ALTER TABLE ideation_sessions ADD COLUMN user_slug TEXT;

-- Add idea_slug column to track which idea this session is working on
ALTER TABLE ideation_sessions ADD COLUMN idea_slug TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_user_slug ON ideation_sessions(user_slug);
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_idea_slug ON ideation_sessions(idea_slug);
