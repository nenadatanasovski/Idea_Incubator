-- Migration 099: Add Missing Relationship Types
-- Purpose: Add the 5 missing relationship types to task_relationships table
-- Missing types: supersedes, implements, conflicts_with, enables, inspired_by, tests
-- Reference: task-data-model-diagram.md defines 11 relationship types

-- SQLite doesn't support ALTER CHECK constraints, so we need to recreate the table

-- Step 1: Create new table with all 11 relationship types
CREATE TABLE IF NOT EXISTS task_relationships_new (
    id TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        -- Original 6 types
        'depends_on',     -- Source depends on target (target must complete first)
        'blocks',         -- Source blocks target
        'related_to',     -- Thematic connection
        'duplicate_of',   -- Source is duplicate of target
        'parent_of',      -- Hierarchical parent
        'child_of',       -- Hierarchical child
        -- New 6 types (from spec)
        'supersedes',     -- Source supersedes/replaces target
        'implements',     -- Source implements target (task-to-task level)
        'conflicts_with', -- Source conflicts with target (cannot run together)
        'enables',        -- Source enables target to proceed
        'inspired_by',    -- Source was inspired by target
        'tests'           -- Source tests/validates target
    )),
    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(source_task_id, target_task_id, relationship_type)
);

-- Step 2: Copy existing data
INSERT OR IGNORE INTO task_relationships_new (id, source_task_id, target_task_id, relationship_type, created_at)
SELECT id, source_task_id, target_task_id, relationship_type, created_at
FROM task_relationships;

-- Step 3: Drop old table
DROP TABLE IF EXISTS task_relationships;

-- Step 3.5: Drop dependent views before rename
DROP VIEW IF EXISTS task_component_analysis;

-- Step 4: Rename new table
ALTER TABLE task_relationships_new RENAME TO task_relationships;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_task_rel_source ON task_relationships(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_target ON task_relationships(target_task_id);
CREATE INDEX IF NOT EXISTS idx_task_rel_type ON task_relationships(relationship_type);

-- Step 6: Recreate the view that was dropped
CREATE VIEW IF NOT EXISTS task_component_analysis AS
SELECT
    t.id AS task_id,
    t.display_id,
    t.title,
    t.category,
    NULL AS primary_component,
    GROUP_CONCAT(tc.component_type, ', ') AS all_components,
    COUNT(tc.component_type) AS component_count,
    AVG(tc.confidence) AS avg_confidence
FROM tasks t
LEFT JOIN task_components tc ON t.id = tc.task_id
GROUP BY t.id;
