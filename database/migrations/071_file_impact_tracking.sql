-- Migration 071: File Impact Tracking
-- Purpose: Track which files each task will impact for conflict detection
-- Part of: Parallel Task Execution Implementation Plan (PTE-007 to PTE-011)

-- Table to track expected file impacts per task
CREATE TABLE IF NOT EXISTS task_file_impacts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- File identification
    file_path TEXT NOT NULL,

    -- Operation type
    operation TEXT NOT NULL CHECK(operation IN (
        'CREATE',   -- Task will create this file
        'UPDATE',   -- Task will modify this file
        'DELETE',   -- Task will delete this file
        'READ'      -- Task will read this file (no conflict potential)
    )),

    -- Confidence level (0.0 to 1.0)
    -- Lower confidence means more likely to be inaccurate
    confidence REAL DEFAULT 0.5 CHECK(confidence >= 0.0 AND confidence <= 1.0),

    -- Source of the estimation
    source TEXT NOT NULL CHECK(source IN (
        'ai_estimate',      -- AI estimated based on task description
        'pattern_match',    -- Matched from historical patterns
        'user_declared',    -- User explicitly specified
        'validated'         -- Confirmed after execution
    )),

    -- Whether this was the actual outcome (set after execution)
    was_accurate INTEGER,  -- NULL = not yet validated, 0 = wrong, 1 = correct

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    validated_at TEXT,

    -- Unique constraint: one operation type per file per task
    UNIQUE(task_id, file_path, operation)
);

-- Historical file patterns for better estimation
CREATE TABLE IF NOT EXISTS file_impact_patterns (
    id TEXT PRIMARY KEY,

    -- Pattern matching criteria
    task_category TEXT,          -- Task category that commonly causes this pattern
    title_keywords TEXT,         -- Keywords in title that suggest this pattern (JSON array)
    description_keywords TEXT,   -- Keywords in description (JSON array)

    -- Expected file impact
    file_pattern TEXT NOT NULL,  -- Glob pattern (e.g., "src/components/*.tsx")
    operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),

    -- Pattern quality
    match_count INTEGER DEFAULT 0,      -- How many times this pattern matched
    accuracy_rate REAL DEFAULT 0.5,     -- Historical accuracy of predictions
    last_matched_at TEXT,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Track actual file changes after task execution for learning
CREATE TABLE IF NOT EXISTS task_file_changes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- File details
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),

    -- Change details (for UPDATE operations)
    lines_added INTEGER,
    lines_removed INTEGER,

    -- Metadata
    recorded_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast conflict detection queries
CREATE INDEX IF NOT EXISTS idx_file_impacts_task ON task_file_impacts(task_id);
CREATE INDEX IF NOT EXISTS idx_file_impacts_path ON task_file_impacts(file_path);
CREATE INDEX IF NOT EXISTS idx_file_impacts_operation ON task_file_impacts(operation);
CREATE INDEX IF NOT EXISTS idx_file_impacts_task_path ON task_file_impacts(task_id, file_path);

-- Indexes for pattern matching
CREATE INDEX IF NOT EXISTS idx_file_patterns_category ON file_impact_patterns(task_category);

-- Indexes for file changes
CREATE INDEX IF NOT EXISTS idx_file_changes_task ON task_file_changes(task_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_path ON task_file_changes(file_path);

-- View to identify potential conflicts between tasks
CREATE VIEW IF NOT EXISTS potential_file_conflicts AS
SELECT
    fi1.task_id AS task_a_id,
    fi2.task_id AS task_b_id,
    fi1.file_path,
    fi1.operation AS operation_a,
    fi2.operation AS operation_b,
    fi1.confidence AS confidence_a,
    fi2.confidence AS confidence_b,
    CASE
        -- Both creating same file
        WHEN fi1.operation = 'CREATE' AND fi2.operation = 'CREATE' THEN 'create_create'
        -- Both writing (update or delete) to same file
        WHEN fi1.operation IN ('UPDATE', 'DELETE') AND fi2.operation IN ('UPDATE', 'DELETE') THEN 'write_write'
        -- One creates, other deletes
        WHEN (fi1.operation = 'CREATE' AND fi2.operation = 'DELETE')
          OR (fi1.operation = 'DELETE' AND fi2.operation = 'CREATE') THEN 'create_delete'
        -- One reads, other deletes
        WHEN (fi1.operation = 'READ' AND fi2.operation = 'DELETE')
          OR (fi1.operation = 'DELETE' AND fi2.operation = 'READ') THEN 'read_delete'
        ELSE 'no_conflict'
    END AS conflict_type
FROM task_file_impacts fi1
JOIN task_file_impacts fi2 ON fi1.file_path = fi2.file_path
WHERE fi1.task_id < fi2.task_id  -- Avoid duplicates
  AND NOT (
    -- No conflict: both just reading
    (fi1.operation = 'READ' AND fi2.operation = 'READ')
    -- No conflict: one reads while other creates or updates
    OR (fi1.operation = 'READ' AND fi2.operation IN ('CREATE', 'UPDATE'))
    OR (fi2.operation = 'READ' AND fi1.operation IN ('CREATE', 'UPDATE'))
  );
