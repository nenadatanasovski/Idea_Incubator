-- Migration 029: Validation Agent Tables
-- Created: 2026-01-11

CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    level TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,
    summary_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_validation_runs_status ON validation_runs(status);
CREATE INDEX IF NOT EXISTS idx_validation_runs_build ON validation_runs(build_id);

CREATE TABLE IF NOT EXISTS validator_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    validator_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    passed INTEGER,
    output TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES validation_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_validator_results_run ON validator_results(run_id);
