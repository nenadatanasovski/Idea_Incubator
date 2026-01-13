-- Migration 074: Task Agent Instance Tracking
-- Purpose: Track Task Agent instances per Task List and Telegram Channel
-- Part of: Parallel Task Execution Implementation Plan (PTE-140 to PTE-143)

-- Create Task Agent instances table
-- CRITICAL: One Task Agent per Task List, One Task Agent per Telegram Channel
CREATE TABLE IF NOT EXISTS task_agent_instances (
    id TEXT PRIMARY KEY,

    -- Assignment (mutually exclusive: either task_list or evaluation_queue)
    task_list_id TEXT UNIQUE REFERENCES task_lists_v2(id) ON DELETE CASCADE,
    is_evaluation_queue INTEGER DEFAULT 0,  -- Boolean: only one per project can be true

    -- Telegram binding
    telegram_channel_id TEXT UNIQUE,
    telegram_bot_token TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
        'active',       -- Running and processing
        'paused',       -- Temporarily paused
        'terminated'    -- Shut down
    )),

    -- Project reference
    project_id TEXT NOT NULL,

    -- Agent health
    last_heartbeat_at TEXT,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,

    -- Statistics
    tasks_processed INTEGER DEFAULT 0,
    suggestions_made INTEGER DEFAULT 0,
    questions_asked INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    terminated_at TEXT,

    -- Constraints
    -- Ensure only one evaluation queue Task Agent per project
    UNIQUE(project_id, is_evaluation_queue)
);

-- Track Task Agent activities for audit/debugging
CREATE TABLE IF NOT EXISTS task_agent_activities (
    id TEXT PRIMARY KEY,
    task_agent_id TEXT NOT NULL REFERENCES task_agent_instances(id) ON DELETE CASCADE,

    -- Activity type
    activity_type TEXT NOT NULL CHECK(activity_type IN (
        'task_created',
        'task_analyzed',
        'suggestion_created',
        'suggestion_accepted',
        'suggestion_rejected',
        'wave_calculated',
        'agent_spawned',
        'agent_completed',
        'agent_failed',
        'question_sent',
        'question_answered',
        'error_occurred'
    )),

    -- Activity details
    details TEXT,  -- JSON with specific activity data

    -- Related entities
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    suggestion_id TEXT REFERENCES grouping_suggestions(id) ON DELETE SET NULL,
    build_agent_id TEXT REFERENCES build_agent_instances(id) ON DELETE SET NULL,

    -- Timestamp
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_agent_project ON task_agent_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_task_agent_status ON task_agent_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_agent_telegram ON task_agent_instances(telegram_channel_id);

CREATE INDEX IF NOT EXISTS idx_agent_activities_agent ON task_agent_activities(task_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_type ON task_agent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activities_time ON task_agent_activities(created_at);

-- View for active Task Agents
CREATE VIEW IF NOT EXISTS active_task_agents_view AS
SELECT
    tai.id,
    tai.project_id,
    CASE WHEN tai.is_evaluation_queue = 1 THEN 'Evaluation Queue' ELSE tl.name END AS scope_name,
    tai.task_list_id,
    tai.is_evaluation_queue,
    tai.status,
    tai.telegram_channel_id,
    tai.last_heartbeat_at,
    tai.tasks_processed,
    tai.suggestions_made,
    (julianday('now') - julianday(tai.last_heartbeat_at)) * 86400 AS seconds_since_heartbeat
FROM task_agent_instances tai
LEFT JOIN task_lists_v2 tl ON tai.task_list_id = tl.id
WHERE tai.status IN ('active', 'paused');

-- View for Task Agent activity summary
CREATE VIEW IF NOT EXISTS task_agent_activity_summary AS
SELECT
    tai.id AS agent_id,
    CASE WHEN tai.is_evaluation_queue = 1 THEN 'Evaluation Queue' ELSE tl.name END AS scope_name,
    COUNT(CASE WHEN taa.activity_type = 'task_created' THEN 1 END) AS tasks_created,
    COUNT(CASE WHEN taa.activity_type = 'suggestion_created' THEN 1 END) AS suggestions_created,
    COUNT(CASE WHEN taa.activity_type = 'suggestion_accepted' THEN 1 END) AS suggestions_accepted,
    COUNT(CASE WHEN taa.activity_type = 'agent_spawned' THEN 1 END) AS agents_spawned,
    COUNT(CASE WHEN taa.activity_type = 'error_occurred' THEN 1 END) AS errors,
    MAX(taa.created_at) AS last_activity
FROM task_agent_instances tai
LEFT JOIN task_lists_v2 tl ON tai.task_list_id = tl.id
LEFT JOIN task_agent_activities taa ON taa.task_agent_id = tai.id
WHERE tai.status IN ('active', 'paused')
GROUP BY tai.id;
