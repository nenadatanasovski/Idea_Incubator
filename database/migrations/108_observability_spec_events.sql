-- Migration 108: Observability for Spec Events
-- Part of: Ideation Agent Spec Generation Implementation (SPEC-010-A)

-- Event log for spec generation and workflow transitions
CREATE TABLE IF NOT EXISTS observability_event_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,  -- spec:generate:start, spec:generate:complete, spec:workflow:transition, etc.
    session_id TEXT,           -- FK to ideation_sessions
    spec_id TEXT,              -- FK to prds
    user_id TEXT,
    duration_ms INTEGER,
    metadata TEXT,             -- JSON for additional context
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_obs_event_type ON observability_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_obs_event_session ON observability_event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_obs_event_spec ON observability_event_log(spec_id);
CREATE INDEX IF NOT EXISTS idx_obs_event_timestamp ON observability_event_log(timestamp);

-- View for spec generation metrics
CREATE VIEW IF NOT EXISTS spec_generation_metrics AS
SELECT
    DATE(timestamp) as date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_type = 'spec:generate:complete' THEN 1 END) as specs_generated,
    COUNT(CASE WHEN event_type = 'spec:workflow:transition' THEN 1 END) as workflow_transitions,
    AVG(CASE WHEN event_type = 'spec:generate:complete' THEN duration_ms END) as avg_generation_time_ms
FROM observability_event_log
WHERE event_type LIKE 'spec:%'
GROUP BY DATE(timestamp);
