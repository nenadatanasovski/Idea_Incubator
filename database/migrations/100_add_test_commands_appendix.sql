-- Migration 100: Add test_commands to appendix_type
-- Purpose: Allow tasks to have test command appendices for multi-level testing
-- Part of: GAP-005 - Build Agent Gap Remediation

-- SQLite doesn't support altering CHECK constraints, so we need to recreate the table.
-- We'll use a safe migration pattern that preserves data.

-- Step 1: Rename the existing table
ALTER TABLE task_appendices RENAME TO task_appendices_old;

-- Step 2: Drop the old indexes
DROP INDEX IF EXISTS idx_task_appendices_task_id;
DROP INDEX IF EXISTS idx_task_appendices_type;

-- Step 3: Create the new table with updated CHECK constraint
CREATE TABLE task_appendices (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Appendix classification (now includes test_commands)
  appendix_type TEXT NOT NULL CHECK (appendix_type IN (
    'prd_reference',
    'code_context',
    'gotcha_list',
    'rollback_plan',
    'test_context',
    'dependency_notes',
    'architecture_decision',
    'user_story',
    'acceptance_criteria',
    'research_notes',
    'api_contract',
    'test_commands'
  )),

  -- Content storage (hybrid: inline or reference)
  content_type TEXT NOT NULL CHECK (content_type IN ('inline', 'reference')),
  content TEXT,                        -- For inline storage
  reference_id TEXT,                   -- For reference storage
  reference_table TEXT,                -- e.g., "knowledge_base", "prds"

  -- Optional title for display
  title TEXT,

  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 4: Copy data from old table (title is new column, default to NULL)
INSERT INTO task_appendices (
  id, task_id, appendix_type, content_type, content,
  reference_id, reference_table, position, created_at, updated_at
)
SELECT
  id, task_id, appendix_type, content_type, content,
  reference_id, reference_table, position, created_at, updated_at
FROM task_appendices_old;

-- Step 5: Drop the old table
DROP TABLE task_appendices_old;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_task_appendices_task_id ON task_appendices(task_id);
CREATE INDEX IF NOT EXISTS idx_task_appendices_type ON task_appendices(appendix_type);
