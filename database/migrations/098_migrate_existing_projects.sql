-- Migration: 098_migrate_existing_projects.sql
-- Purpose: Create projects from existing project_id values
-- Part of: Project Entity Formalization
--
-- This migration:
-- 1. Collects all unique project_id values from existing tables
-- 2. Creates formal project records for each
-- 3. Creates a default "General" project for tasks without project_id

-- Create a temporary table to collect unique project_ids
CREATE TEMPORARY TABLE IF NOT EXISTS temp_project_ids AS
SELECT DISTINCT project_id
FROM (
  SELECT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != ''
  UNION
  SELECT project_id FROM task_lists_v2 WHERE project_id IS NOT NULL AND project_id != ''
  UNION
  SELECT project_id FROM prds WHERE project_id IS NOT NULL AND project_id != ''
  UNION
  SELECT project_id FROM task_agent_instances WHERE project_id IS NOT NULL AND project_id != ''
  UNION
  SELECT project_id FROM display_id_sequences WHERE project_id IS NOT NULL AND project_id != '' AND project_id != 'default'
  UNION
  SELECT project_id FROM grouping_suggestions WHERE project_id IS NOT NULL AND project_id != ''
  UNION
  SELECT project_id FROM grouping_criteria_weights WHERE project_id IS NOT NULL AND project_id != ''
);

-- Insert projects for each unique project_id
-- Generate a deterministic UUID from the project_id to ensure consistency
INSERT OR IGNORE INTO projects (id, slug, code, name, status)
SELECT
  -- Generate a pseudo-UUID based on project_id hash (deterministic)
  lower(hex(substr(project_id || '0000000000000000', 1, 4))) || '-' ||
  lower(hex(substr(project_id || '0000000000000001', 1, 2))) || '-' ||
  lower(hex(substr(project_id || '0000000000000002', 1, 2))) || '-' ||
  lower(hex(substr(project_id || '0000000000000003', 1, 2))) || '-' ||
  lower(hex(substr(project_id || '0000000000000004', 1, 6))) AS id,

  -- Generate slug: lowercase, replace spaces/underscores with hyphens
  lower(replace(replace(replace(project_id, ' ', '-'), '_', '-'), '.', '-')) AS slug,

  -- Generate code: first 2-4 uppercase alphanumeric chars
  upper(substr(replace(replace(replace(replace(project_id, '-', ''), '_', ''), ' ', ''), '.', ''), 1, 4)) AS code,

  -- Use original project_id as name
  project_id AS name,

  -- Default to active status
  'active' AS status
FROM temp_project_ids
WHERE project_id IS NOT NULL AND project_id != '';

-- Drop temporary table
DROP TABLE IF EXISTS temp_project_ids;

-- Create default "General" project for tasks without project_id
INSERT OR IGNORE INTO projects (id, slug, code, name, status, description)
VALUES (
  'default-project-00000000-0000-0000-0000-000000000000',
  'default',
  'GEN',
  'General',
  'active',
  'Default project for tasks without a specific project assignment'
);

-- Ensure display_id_sequences has entries for migrated projects
INSERT OR IGNORE INTO display_id_sequences (project_id, last_sequence)
SELECT code, 0 FROM projects WHERE code NOT IN (SELECT project_id FROM display_id_sequences);
