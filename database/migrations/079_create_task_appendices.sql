-- Migration 079: Create task_appendices table
-- Purpose: Attachable context for Build Agents (11 appendix types)
-- Part of: Task System V2 Implementation Plan (IMPL-1.2)

CREATE TABLE IF NOT EXISTS task_appendices (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Appendix classification
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
    'api_contract'
  )),

  -- Content storage (hybrid: inline or reference)
  content_type TEXT NOT NULL CHECK (content_type IN ('inline', 'reference')),
  content TEXT,                        -- For inline storage
  reference_id TEXT,                   -- For reference storage
  reference_table TEXT,                -- e.g., "knowledge_base", "prds"

  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_appendices_task_id ON task_appendices(task_id);
CREATE INDEX IF NOT EXISTS idx_task_appendices_type ON task_appendices(appendix_type);
