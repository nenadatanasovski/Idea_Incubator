-- Migration 010: Differentiation Results Storage
-- Stores differentiation analysis results for persistence across sessions

-- ============================================================================
-- 1. Create differentiation_results table
-- ============================================================================

CREATE TABLE IF NOT EXISTS differentiation_results (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,  -- Unique identifier for each analysis run

    -- Market Opportunities (JSON array)
    opportunities TEXT NOT NULL,

    -- Differentiation Strategies (JSON array with 5W+H framework)
    strategies TEXT NOT NULL,

    -- Competitive Risks (JSON array)
    competitive_risks TEXT NOT NULL,

    -- Summary and confidence
    summary TEXT NOT NULL,
    overall_confidence REAL NOT NULL DEFAULT 0.5,

    -- Extended analysis fields (5W+H framework)
    market_timing_analysis TEXT,  -- JSON: when to enter, market windows
    resource_requirements TEXT,   -- JSON: what's needed per strategy
    execution_roadmap TEXT,       -- JSON: how to implement, phases
    geographic_focus TEXT,        -- JSON: where to target

    -- Metadata
    cost_dollars REAL,
    api_calls INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Each idea can have multiple runs, but we track them
    UNIQUE(idea_id, run_id)
);

-- ============================================================================
-- 2. Create update_suggestions table (for auto-generated updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS update_suggestions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    differentiation_run_id TEXT REFERENCES differentiation_results(id),

    -- Suggested updates
    suggested_title TEXT,
    suggested_summary TEXT,
    suggested_content TEXT,

    -- What changed and why
    change_rationale TEXT,  -- JSON: explains each suggested change

    -- User action
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'modified', 'rejected')),
    user_modified_content TEXT,  -- If user modified the suggestion

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- ============================================================================
-- 3. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_diff_results_idea ON differentiation_results(idea_id);
CREATE INDEX IF NOT EXISTS idx_diff_results_latest ON differentiation_results(idea_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_update_suggestions_idea ON update_suggestions(idea_id);
CREATE INDEX IF NOT EXISTS idx_update_suggestions_status ON update_suggestions(status);
