-- Migration: 106_acceptance_criteria_results.sql
-- Purpose: Store acceptance criteria verification status persistently
-- Part of: Test Scope Categorization (AC Persistence)

-- Create table to store acceptance criteria verification results
CREATE TABLE IF NOT EXISTS acceptance_criteria_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    appendix_id TEXT NOT NULL,
    criterion_index INTEGER NOT NULL,  -- Position within the appendix content (0-based)
    criterion_text TEXT NOT NULL,
    met INTEGER NOT NULL DEFAULT 0,
    scope TEXT CHECK (scope IS NULL OR scope IN (
        'codebase', 'api', 'ui', 'database', 'integration'
    )),
    verified_at TEXT,
    verified_by TEXT,  -- 'user' | 'agent' | 'system'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (appendix_id) REFERENCES task_appendices(id) ON DELETE CASCADE,

    -- Unique constraint: one result per criterion per appendix
    UNIQUE(appendix_id, criterion_index)
);

-- Index for efficient task lookups
CREATE INDEX IF NOT EXISTS idx_ac_results_task ON acceptance_criteria_results(task_id);

-- Index for efficient appendix lookups
CREATE INDEX IF NOT EXISTS idx_ac_results_appendix ON acceptance_criteria_results(appendix_id);

-- Index for scope filtering
CREATE INDEX IF NOT EXISTS idx_ac_results_scope ON acceptance_criteria_results(scope);

-- Index for finding unverified criteria
CREATE INDEX IF NOT EXISTS idx_ac_results_unmet ON acceptance_criteria_results(task_id, met) WHERE met = 0;

-- Trigger to update updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_ac_results_timestamp
AFTER UPDATE ON acceptance_criteria_results
BEGIN
    UPDATE acceptance_criteria_results
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;
