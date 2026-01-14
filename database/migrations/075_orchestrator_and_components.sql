-- Migration 075: Orchestrator Configuration and Component Types
-- Purpose: Add orchestrator config table and component_type field to tasks
-- Part of: PTE-125 to PTE-132

-- Orchestrator configuration table (PTE-128)
-- Note: Table already exists with INTEGER id column, skip recreation
-- CREATE TABLE IF NOT EXISTS orchestrator_config (...);
-- INSERT OR IGNORE INTO orchestrator_config (id) VALUES ('default');
-- Skipped: table already exists from previous migration

-- Add component_type field to tasks (PTE-129)
-- Note: Column may already exist, SQLite will fail silently on duplicate
-- ALTER TABLE tasks ADD COLUMN component_type TEXT CHECK(component_type IN (...));
-- Skipped: column already exists from previous partial run

-- Task components table for storing multiple component types per task
CREATE TABLE IF NOT EXISTS task_components (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    component_type TEXT NOT NULL CHECK(component_type IN (
        'database',
        'types',
        'api',
        'service',
        'ui',
        'test',
        'config',
        'documentation',
        'infrastructure',
        'other'
    )),
    confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
    source TEXT NOT NULL DEFAULT 'inferred' CHECK(source IN (
        'inferred',    -- Auto-detected from file patterns
        'user',        -- User specified
        'validated'    -- Confirmed by execution
    )),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    -- Unique constraint: one component type per task
    UNIQUE(task_id, component_type)
);

-- Index for component queries
CREATE INDEX IF NOT EXISTS idx_task_components_task ON task_components(task_id);
CREATE INDEX IF NOT EXISTS idx_task_components_type ON task_components(component_type);

-- Add component_weight to grouping criteria weights (PTE-131)
-- Note: The column may already exist from earlier migration, so we use a transaction approach

-- Wave task assignments table (for parallelism calculator)
CREATE TABLE IF NOT EXISTS wave_task_assignments (
    id TEXT PRIMARY KEY,
    wave_id TEXT NOT NULL REFERENCES parallel_execution_waves(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(wave_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_wave_assignments_wave ON wave_task_assignments(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_assignments_task ON wave_task_assignments(task_id);

-- File impact patterns table for historical pattern matching
CREATE TABLE IF NOT EXISTS file_impact_patterns (
    id TEXT PRIMARY KEY,
    task_category TEXT NOT NULL,
    file_pattern TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
    match_count INTEGER NOT NULL DEFAULT 0,
    accuracy_rate REAL NOT NULL DEFAULT 0.5 CHECK(accuracy_rate >= 0 AND accuracy_rate <= 1),
    title_keywords TEXT,
    last_matched_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(task_category, file_pattern, operation)
);

CREATE INDEX IF NOT EXISTS idx_file_patterns_category ON file_impact_patterns(task_category);
CREATE INDEX IF NOT EXISTS idx_file_patterns_accuracy ON file_impact_patterns(accuracy_rate);

-- Task file changes table for recording actual changes (for validation)
CREATE TABLE IF NOT EXISTS task_file_changes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
    lines_added INTEGER,
    lines_removed INTEGER,
    recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_file_changes_task ON task_file_changes(task_id);

-- Suggestion tasks table for tracking which tasks are in a suggestion
CREATE TABLE IF NOT EXISTS suggestion_tasks (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES grouping_suggestions(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    inclusion_reason TEXT,
    contribution_score REAL,
    was_included INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(suggestion_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_suggestion_tasks_suggestion ON suggestion_tasks(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_tasks_task ON suggestion_tasks(task_id);

-- Agent heartbeats table for detailed heartbeat tracking
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES build_agent_instances(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    progress_percent REAL,
    current_step TEXT,
    memory_mb REAL,
    cpu_percent REAL,
    recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON agent_heartbeats(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_time ON agent_heartbeats(recorded_at);

-- View for task component analysis
CREATE VIEW IF NOT EXISTS task_component_analysis AS
SELECT
    t.id AS task_id,
    t.display_id,
    t.title,
    t.category,
    t.component_type AS primary_component,
    GROUP_CONCAT(tc.component_type, ', ') AS all_components,
    COUNT(tc.component_type) AS component_count,
    AVG(tc.confidence) AS avg_confidence
FROM tasks t
LEFT JOIN task_components tc ON t.id = tc.task_id
GROUP BY t.id;
