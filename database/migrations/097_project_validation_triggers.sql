-- Migration: 097_project_validation_triggers.sql
-- Purpose: Add validation triggers for project_id references
-- Part of: Project Entity Formalization
--
-- BACKWARD COMPATIBILITY:
-- These triggers allow project_id to be either:
-- 1. A formal project ID (UUID)
-- 2. A project code (2-4 chars)
-- 3. Any string if no projects exist yet (legacy behavior)
-- This ensures existing data and workflows continue to work.

-- Validate project_id on tasks INSERT
CREATE TRIGGER IF NOT EXISTS validate_task_project_id
BEFORE INSERT ON tasks
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;  -- Only enforce if projects exist
END;

-- Validate project_id on tasks UPDATE
CREATE TRIGGER IF NOT EXISTS validate_task_project_id_update
BEFORE UPDATE OF project_id ON tasks
WHEN NEW.project_id IS NOT NULL AND NEW.project_id != OLD.project_id
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on task_lists_v2 INSERT
CREATE TRIGGER IF NOT EXISTS validate_task_list_project_id
BEFORE INSERT ON task_lists_v2
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on task_lists_v2 UPDATE
CREATE TRIGGER IF NOT EXISTS validate_task_list_project_id_update
BEFORE UPDATE OF project_id ON task_lists_v2
WHEN NEW.project_id IS NOT NULL AND NEW.project_id != OLD.project_id
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on prds INSERT
CREATE TRIGGER IF NOT EXISTS validate_prd_project_id
BEFORE INSERT ON prds
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on prds UPDATE
CREATE TRIGGER IF NOT EXISTS validate_prd_project_id_update
BEFORE UPDATE OF project_id ON prds
WHEN NEW.project_id IS NOT NULL AND NEW.project_id != OLD.project_id
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on task_agent_instances INSERT
CREATE TRIGGER IF NOT EXISTS validate_task_agent_project_id
BEFORE INSERT ON task_agent_instances
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on task_agent_instances UPDATE
CREATE TRIGGER IF NOT EXISTS validate_task_agent_project_id_update
BEFORE UPDATE OF project_id ON task_agent_instances
WHEN NEW.project_id IS NOT NULL AND NEW.project_id != OLD.project_id
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on grouping_suggestions INSERT
CREATE TRIGGER IF NOT EXISTS validate_grouping_suggestion_project_id
BEFORE INSERT ON grouping_suggestions
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;

-- Validate project_id on grouping_criteria_weights INSERT
CREATE TRIGGER IF NOT EXISTS validate_grouping_weights_project_id
BEFORE INSERT ON grouping_criteria_weights
WHEN NEW.project_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Invalid project_id: must be a valid project ID or code')
  WHERE NEW.project_id NOT IN (SELECT id FROM projects)
    AND NEW.project_id NOT IN (SELECT code FROM projects)
    AND (SELECT COUNT(*) FROM projects) > 0;
END;
