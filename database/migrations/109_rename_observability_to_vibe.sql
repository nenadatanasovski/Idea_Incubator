-- Migration: 109_rename_observability_to_vibe.sql
-- Purpose: Rename "Observability System" project to "Vibe"
-- This consolidates the observability system under the main Vibe/Idea Incubator project

-- Rename the project
UPDATE projects
SET
  name = 'Vibe',
  slug = 'vibe',
  code = 'VIBE',
  description = 'Vibe Check App - ambient emotional feedback for your day. A complete AI-powered idea incubation and build system.',
  updated_at = datetime('now')
WHERE slug = 'observability-system';

-- Also update any tasks that reference the old project code
-- (display_id format: TU-{PROJECT_CODE}-{CATEGORY}-{SEQ})
UPDATE tasks
SET
  display_id = REPLACE(display_id, 'TU-OBSE-', 'TU-VIBE-'),
  updated_at = datetime('now')
WHERE display_id LIKE 'TU-OBSE-%';
