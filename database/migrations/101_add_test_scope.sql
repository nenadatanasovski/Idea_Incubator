-- Migration 101: Add test_scope to task_test_results
-- Purpose: Categorize tests by system component (codebase, api, ui, database, integration)
-- Part of: Test Scope Categorization Feature
-- Backward compatible: test_scope defaults to NULL for existing tests

-- Add test_scope column
ALTER TABLE task_test_results ADD COLUMN test_scope TEXT
  CHECK (test_scope IS NULL OR test_scope IN (
    'codebase',
    'api',
    'ui',
    'database',
    'integration'
  ));

-- Create index for efficient filtering by scope
CREATE INDEX IF NOT EXISTS idx_task_test_results_scope
  ON task_test_results(test_scope);

-- Create composite index for scope + level queries
CREATE INDEX IF NOT EXISTS idx_task_test_results_scope_level
  ON task_test_results(task_id, test_scope, test_level);
