-- Migration 009: Incubation System
-- Adds versioning, status lifecycle, lineage, and incubation tracking

-- ============================================================================
-- 1. Add columns to ideas table
-- ============================================================================

-- Status column: active, paused, abandoned, completed, archived
ALTER TABLE ideas ADD COLUMN status TEXT DEFAULT 'active'
    CHECK(status IN ('active', 'paused', 'abandoned', 'completed', 'archived'));

-- Reason for status change (e.g., "No time", "Pivoted to branch X")
ALTER TABLE ideas ADD COLUMN status_reason TEXT;

-- When status was last changed
ALTER TABLE ideas ADD COLUMN status_changed_at DATETIME;

-- Current version number (increments on snapshots)
ALTER TABLE ideas ADD COLUMN current_version INTEGER DEFAULT 1;

-- Current iteration number (increments when iterating after evaluation)
ALTER TABLE ideas ADD COLUMN iteration_number INTEGER DEFAULT 1;

-- Parent idea ID for branching/lineage
ALTER TABLE ideas ADD COLUMN parent_idea_id TEXT REFERENCES ideas(id);

-- Why this idea was branched from parent
ALTER TABLE ideas ADD COLUMN branch_reason TEXT;

-- Current phase in incubation flow
ALTER TABLE ideas ADD COLUMN incubation_phase TEXT DEFAULT 'capture'
    CHECK(incubation_phase IN ('capture', 'clarify', 'differentiation', 'update', 'evaluate', 'iterate'));

-- ============================================================================
-- 2. Create idea_versions table (stores snapshots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS idea_versions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    iteration_number INTEGER,
    content_snapshot TEXT NOT NULL,
    evaluation_snapshot TEXT,
    phase TEXT NOT NULL CHECK(phase IN ('capture', 'clarify', 'differentiation', 'update', 'evaluate', 'iterate')),
    change_type TEXT CHECK(change_type IN ('initial', 'post-clarify', 'post-differentiation', 'post-evaluation', 'iteration', 'manual')),
    change_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, version_number)
);

-- ============================================================================
-- 3. Create idea_assumptions table (tracks gaps)
-- ============================================================================

CREATE TABLE IF NOT EXISTS idea_assumptions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    assumption_text TEXT NOT NULL,
    category TEXT CHECK(category IN ('problem', 'solution', 'market', 'user', 'technical', 'execution')),
    impact TEXT CHECK(impact IN ('critical', 'significant', 'minor')),
    confidence TEXT CHECK(confidence IN ('low', 'medium', 'high')),
    evidence TEXT,
    addressed INTEGER DEFAULT 0,
    addressed_at DATETIME
);

-- ============================================================================
-- 4. Create iteration_logs table (tracks iteration triggers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS iteration_logs (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    from_iteration INTEGER,
    to_iteration INTEGER,
    trigger_criteria TEXT,  -- JSON array of weak criteria codes
    user_direction TEXT,
    previous_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. Create gate_decisions table (audit trail for soft gates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gate_decisions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    gate_type TEXT NOT NULL CHECK(gate_type IN ('viability', 'evaluation')),
    recommendation TEXT NOT NULL,
    user_choice TEXT NOT NULL,
    context TEXT,  -- JSON with relevant data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. Create idea_status_history table (status change log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS idea_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL CHECK(to_status IN ('active', 'paused', 'abandoned', 'completed', 'archived')),
    reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_phase ON ideas(incubation_phase);
CREATE INDEX IF NOT EXISTS idx_ideas_parent ON ideas(parent_idea_id);
CREATE INDEX IF NOT EXISTS idx_versions_idea ON idea_versions(idea_id);
CREATE INDEX IF NOT EXISTS idx_versions_idea_number ON idea_versions(idea_id, version_number);
CREATE INDEX IF NOT EXISTS idx_assumptions_idea ON idea_assumptions(idea_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_version ON idea_assumptions(idea_id, version_number);
CREATE INDEX IF NOT EXISTS idx_iterations_idea ON iteration_logs(idea_id);
CREATE INDEX IF NOT EXISTS idx_gates_idea ON gate_decisions(idea_id);
CREATE INDEX IF NOT EXISTS idx_status_history_idea ON idea_status_history(idea_id);

-- ============================================================================
-- 8. Update existing ideas with default values
-- (SQLite sets defaults on ALTER TABLE ADD COLUMN, so existing rows are handled)
-- ============================================================================

-- Log initial status for all existing ideas
INSERT INTO idea_status_history (idea_id, from_status, to_status, reason, changed_at)
SELECT id, NULL, 'active', 'Initial status set during migration', CURRENT_TIMESTAMP
FROM ideas
WHERE id NOT IN (SELECT DISTINCT idea_id FROM idea_status_history);
