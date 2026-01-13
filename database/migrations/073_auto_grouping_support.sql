-- Migration 073: Auto-Grouping Support
-- Purpose: Support automatic task grouping suggestions
-- Part of: Parallel Task Execution Implementation Plan (PTE-016 to PTE-018)

-- Store grouping suggestions
CREATE TABLE IF NOT EXISTS grouping_suggestions (
    id TEXT PRIMARY KEY,

    -- Suggestion status
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',      -- Awaiting user action
        'accepted',     -- User accepted the suggestion
        'rejected',     -- User rejected the suggestion
        'expired',      -- Auto-expired after timeout
        'modified'      -- User accepted with modifications
    )),

    -- Suggested grouping
    suggested_name TEXT NOT NULL,           -- Proposed task list name
    suggested_tasks TEXT NOT NULL,          -- JSON array of task IDs

    -- Grouping rationale
    grouping_reason TEXT NOT NULL,          -- Why these tasks should be grouped
    similarity_score REAL,                   -- Overall similarity score (0.0 to 1.0)

    -- Context
    project_id TEXT,
    triggered_by TEXT,                      -- 'task_created', 'dependency_changed', 'manual'
    trigger_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,

    -- Resolution
    created_task_list_id TEXT REFERENCES task_lists_v2(id) ON DELETE SET NULL,
    resolved_by TEXT,                       -- 'user', 'system'
    resolved_at TEXT,

    -- Expiration
    expires_at TEXT DEFAULT (datetime('now', '+7 days')),

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now'))
);

-- Store grouping criteria weights per project (user configurable)
CREATE TABLE IF NOT EXISTS grouping_criteria_weights (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,

    -- Weights for different grouping criteria (must sum to 1.0)
    file_overlap_weight REAL DEFAULT 0.25,      -- Tasks touching same files
    dependency_weight REAL DEFAULT 0.30,        -- Tasks with dependencies
    semantic_weight REAL DEFAULT 0.20,          -- Title/description similarity
    category_weight REAL DEFAULT 0.10,          -- Same category
    component_weight REAL DEFAULT 0.15,         -- Same component type

    -- Thresholds
    min_group_size INTEGER DEFAULT 2,           -- Minimum tasks to suggest grouping
    max_group_size INTEGER DEFAULT 20,          -- Maximum tasks per suggestion
    similarity_threshold REAL DEFAULT 0.6,      -- Minimum score to suggest

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(project_id)
);

-- Track tasks included in suggestions
CREATE TABLE IF NOT EXISTS suggestion_tasks (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES grouping_suggestions(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Why this task was included
    inclusion_reason TEXT,                  -- Why this specific task matches
    contribution_score REAL,                -- How much this task contributed to similarity

    -- Whether the task was actually included when accepted
    was_included INTEGER DEFAULT 1,         -- 0 if user removed during modification

    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(suggestion_id, task_id)
);

-- Store task embeddings for semantic similarity
CREATE TABLE IF NOT EXISTS task_embeddings (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,

    -- Embedding vector (stored as JSON array of floats)
    embedding TEXT NOT NULL,

    -- Model info
    model_name TEXT DEFAULT 'text-embedding-3-small',
    embedding_dim INTEGER DEFAULT 1536,

    -- What was embedded
    embedded_text TEXT,                     -- The text that was embedded

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Store component types for tasks
CREATE TABLE IF NOT EXISTS task_components (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Component type
    component_type TEXT NOT NULL CHECK(component_type IN (
        'database',         -- Database schemas, migrations
        'types',            -- TypeScript types, interfaces
        'api',              -- API routes, endpoints
        'service',          -- Business logic services
        'ui',               -- Frontend components
        'test',             -- Test files
        'config',           -- Configuration files
        'documentation',    -- Docs, READMEs
        'infrastructure',   -- DevOps, deployment
        'other'
    )),

    -- Confidence of assignment
    confidence REAL DEFAULT 0.8,
    source TEXT DEFAULT 'inferred',         -- 'inferred', 'user', 'validated'

    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(task_id, component_type)
);

-- Indexes for grouping suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON grouping_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_project ON grouping_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_expires ON grouping_suggestions(expires_at);

-- Indexes for suggestion tasks
CREATE INDEX IF NOT EXISTS idx_suggestion_tasks_suggestion ON suggestion_tasks(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_tasks_task ON suggestion_tasks(task_id);

-- Indexes for embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_task ON task_embeddings(task_id);

-- Indexes for components
CREATE INDEX IF NOT EXISTS idx_components_task ON task_components(task_id);
CREATE INDEX IF NOT EXISTS idx_components_type ON task_components(component_type);

-- View for pending suggestions
CREATE VIEW IF NOT EXISTS pending_suggestions_view AS
SELECT
    gs.*,
    COUNT(st.id) AS task_count,
    GROUP_CONCAT(t.display_id, ', ') AS task_display_ids
FROM grouping_suggestions gs
JOIN suggestion_tasks st ON st.suggestion_id = gs.id
JOIN tasks t ON st.task_id = t.id
WHERE gs.status = 'pending'
  AND (gs.expires_at IS NULL OR gs.expires_at > datetime('now'))
GROUP BY gs.id
ORDER BY gs.created_at DESC;

-- Trigger to clean up expired suggestions
CREATE TRIGGER IF NOT EXISTS expire_old_suggestions
AFTER INSERT ON grouping_suggestions
BEGIN
    UPDATE grouping_suggestions
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < datetime('now');
END;
