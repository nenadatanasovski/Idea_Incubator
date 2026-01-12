-- database/migrations/032_ux_agent.sql
-- UX Agent tables for journey testing and accessibility validation

-- UX validation run tracking
CREATE TABLE IF NOT EXISTS ux_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    journey_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,
    summary_json TEXT
);

-- Individual step results
CREATE TABLE IF NOT EXISTS ux_step_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    status TEXT DEFAULT 'pending',
    passed INTEGER,
    error TEXT,
    screenshot_path TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES ux_runs(id)
);

-- Accessibility issues
CREATE TABLE IF NOT EXISTS ux_accessibility_issues (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    impact TEXT,
    description TEXT,
    selector TEXT,
    help_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES ux_runs(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ux_runs_journey_id ON ux_runs(journey_id);
CREATE INDEX IF NOT EXISTS idx_ux_runs_status ON ux_runs(status);
CREATE INDEX IF NOT EXISTS idx_ux_step_results_run_id ON ux_step_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ux_accessibility_issues_run_id ON ux_accessibility_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_ux_accessibility_issues_impact ON ux_accessibility_issues(impact);
