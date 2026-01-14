-- Migration 083: Create task_test_results table
-- Purpose: Store three-level test results (syntax, unit, e2e)
-- Part of: Task System V2 Implementation Plan (IMPL-1.6)

CREATE TABLE IF NOT EXISTS task_test_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Test identification
  test_level INTEGER NOT NULL CHECK (test_level IN (1, 2, 3)),  -- 1=syntax, 2=unit, 3=e2e
  test_name TEXT,

  -- Execution details
  command TEXT NOT NULL,
  exit_code INTEGER NOT NULL,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER NOT NULL,

  -- Result
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),

  -- Context
  execution_id TEXT,                   -- Links to parallel execution
  agent_id TEXT,                       -- Which Build Agent ran this

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_test_results_task ON task_test_results(task_id);
CREATE INDEX IF NOT EXISTS idx_task_test_results_level ON task_test_results(test_level);
CREATE INDEX IF NOT EXISTS idx_task_test_results_execution ON task_test_results(execution_id);
