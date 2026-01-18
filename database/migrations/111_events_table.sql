-- Migration: 111_events_table.sql
-- Purpose: Create the platform-wide events table that the existing trigger (tr_event_to_log) references
-- This enables automatic population of message_bus_log for specific event types

-- Create the events table (referenced by existing trigger in migration 087)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,              -- Source system: 'task-agent', 'pipeline', 'ideation', 'api', 'system', 'build-agent'
    event_type TEXT NOT NULL,          -- Event type (some trigger message_bus_log auto-population)
    correlation_id TEXT,               -- Link related events together
    payload TEXT,                      -- JSON payload with event-specific data

    -- Context references for filtering and linking
    task_id TEXT,                      -- Related task
    execution_id TEXT,                 -- Related execution run
    project_id TEXT,                   -- Related project
    idea_id TEXT,                      -- Related idea
    session_id TEXT,                   -- Related session
    user_id TEXT,                      -- User who triggered the event

    -- Metadata
    severity TEXT DEFAULT 'info',      -- 'info', 'warning', 'error', 'critical'
    created_at TEXT DEFAULT (datetime('now'))
);

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- Context reference indexes
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
CREATE INDEX IF NOT EXISTS idx_events_execution ON events(execution_id);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_idea ON events(idea_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_source_type ON events(source, event_type);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project_timestamp ON events(project_id, timestamp);

-- View for recent events with human-readable info
CREATE VIEW IF NOT EXISTS recent_events AS
SELECT
    e.id,
    e.timestamp,
    e.source,
    e.event_type,
    e.severity,
    e.correlation_id,
    e.task_id,
    e.execution_id,
    e.project_id,
    e.payload,
    e.created_at,
    t.title as task_title,
    p.name as project_name
FROM events e
LEFT JOIN tasks t ON e.task_id = t.id
LEFT JOIN projects p ON e.project_id = p.id
ORDER BY e.timestamp DESC
LIMIT 1000;

-- View for event statistics by source
CREATE VIEW IF NOT EXISTS event_stats_by_source AS
SELECT
    source,
    event_type,
    COUNT(*) as event_count,
    COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
    MIN(timestamp) as first_event,
    MAX(timestamp) as last_event
FROM events
GROUP BY source, event_type
ORDER BY event_count DESC;

-- View for hourly event breakdown
CREATE VIEW IF NOT EXISTS event_hourly_stats AS
SELECT
    strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
    source,
    COUNT(*) as event_count,
    COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_count
FROM events
WHERE timestamp >= datetime('now', '-24 hours')
GROUP BY hour, source
ORDER BY hour DESC;
