-- =============================================================================
-- Migration: 089_execution_lanes.sql
-- Purpose: Create execution lanes and lane-task mapping for pipeline visualization
-- Created: 2026-01-17
-- Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: execution_lanes
-- Represents parallel execution lanes (swimlanes) in the pipeline
-- Lanes group tasks by file pattern/category that can execute independently
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_lanes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,              -- FK to task_list_execution_runs
    name TEXT NOT NULL,                    -- Human-readable lane name
    category TEXT NOT NULL,                -- database | types | api | ui | tests | infrastructure
    file_patterns TEXT,                    -- JSON array of glob patterns this lane touches
    status TEXT DEFAULT 'idle',            -- idle | active | blocked | complete
    block_reason TEXT,                     -- Why lane is blocked (if applicable)
    current_agent_id TEXT,                 -- FK to build_agent_instances (currently assigned)
    tasks_total INTEGER DEFAULT 0,         -- Total tasks in this lane
    tasks_completed INTEGER DEFAULT 0,     -- Completed tasks count
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES task_list_execution_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_lanes_session ON execution_lanes(session_id);
CREATE INDEX IF NOT EXISTS idx_lanes_status ON execution_lanes(status);
CREATE INDEX IF NOT EXISTS idx_lanes_category ON execution_lanes(category);

-- -----------------------------------------------------------------------------
-- Table: lane_tasks
-- Maps tasks to lanes and their wave positions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lane_tasks (
    id TEXT PRIMARY KEY,
    lane_id TEXT NOT NULL,                 -- FK to execution_lanes
    task_id TEXT NOT NULL,                 -- FK to tasks
    wave_number INTEGER NOT NULL,          -- Which wave this task belongs to
    position_in_wave INTEGER DEFAULT 0,    -- Order within the wave
    status TEXT DEFAULT 'pending',         -- pending | running | complete | failed | blocked | skipped
    started_at TEXT,                       -- When task started
    completed_at TEXT,                     -- When task finished
    duration_ms INTEGER,                   -- Execution duration
    block_reason TEXT,                     -- Why blocked (dependency, file conflict, etc.)
    blocking_task_id TEXT,                 -- FK to tasks - what's blocking this
    agent_id TEXT,                         -- FK to build_agent_instances - assigned agent
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lane_id) REFERENCES execution_lanes(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (blocking_task_id) REFERENCES tasks(id),
    UNIQUE(lane_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_lane_tasks_lane ON lane_tasks(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_tasks_task ON lane_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_lane_tasks_wave ON lane_tasks(wave_number);
CREATE INDEX IF NOT EXISTS idx_lane_tasks_status ON lane_tasks(status);

-- -----------------------------------------------------------------------------
-- Table: execution_waves
-- Tracks wave-level execution state and metrics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_waves (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,              -- FK to task_list_execution_runs
    wave_number INTEGER NOT NULL,          -- Wave sequence number (1-indexed)
    status TEXT DEFAULT 'pending',         -- pending | active | complete
    tasks_total INTEGER DEFAULT 0,         -- Total tasks in this wave
    tasks_completed INTEGER DEFAULT 0,     -- Completed tasks
    tasks_running INTEGER DEFAULT 0,       -- Currently running
    tasks_failed INTEGER DEFAULT 0,        -- Failed tasks
    tasks_blocked INTEGER DEFAULT 0,       -- Blocked tasks
    max_parallelism INTEGER DEFAULT 0,     -- Maximum concurrent tasks possible
    actual_parallelism INTEGER DEFAULT 0,  -- Actual concurrent tasks achieved
    started_at TEXT,                       -- When wave started
    completed_at TEXT,                     -- When wave finished
    duration_ms INTEGER,                   -- Total wave duration
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES task_list_execution_runs(id),
    UNIQUE(session_id, wave_number)
);

CREATE INDEX IF NOT EXISTS idx_waves_session ON execution_waves(session_id);
CREATE INDEX IF NOT EXISTS idx_waves_status ON execution_waves(status);

-- -----------------------------------------------------------------------------
-- Table: task_conflicts
-- Records conflict relationships between tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_conflicts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,              -- FK to task_list_execution_runs
    task_a_id TEXT NOT NULL,               -- FK to tasks
    task_b_id TEXT NOT NULL,               -- FK to tasks
    conflict_type TEXT NOT NULL,           -- file_conflict | dependency | resource_lock
    details TEXT NOT NULL,                 -- Human-readable explanation
    file_path TEXT,                        -- Conflicting file (if file_conflict)
    operation_a TEXT,                      -- Task A operation (CREATE | UPDATE | DELETE | READ)
    operation_b TEXT,                      -- Task B operation
    resolved_at TEXT,                      -- When conflict was resolved (task completed)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_a_id) REFERENCES tasks(id),
    FOREIGN KEY (task_b_id) REFERENCES tasks(id),
    UNIQUE(session_id, task_a_id, task_b_id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_session ON task_conflicts(session_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_task_a ON task_conflicts(task_a_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_task_b ON task_conflicts(task_b_id);

-- -----------------------------------------------------------------------------
-- Table: pipeline_events
-- Stores real-time pipeline events for streaming to frontend
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,              -- FK to task_list_execution_runs
    timestamp TEXT NOT NULL,               -- ISO8601 with milliseconds
    event_type TEXT NOT NULL,              -- wave:started | task:completed | agent:assigned | etc.
    payload TEXT NOT NULL,                 -- JSON payload
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES task_list_execution_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_events_session ON pipeline_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON pipeline_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON pipeline_events(event_type);

-- -----------------------------------------------------------------------------
-- Add lane_id column to tasks table if it doesn't exist
-- -----------------------------------------------------------------------------
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- This is handled programmatically in the migration runner

-- -----------------------------------------------------------------------------
-- View: v_pipeline_status
-- Aggregated view for quick pipeline status retrieval
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_pipeline_status AS
SELECT
    el.session_id,
    COUNT(DISTINCT el.id) as total_lanes,
    COUNT(DISTINCT ew.id) as total_waves,
    SUM(CASE WHEN el.status = 'active' THEN 1 ELSE 0 END) as active_lanes,
    SUM(CASE WHEN el.status = 'blocked' THEN 1 ELSE 0 END) as blocked_lanes,
    SUM(CASE WHEN el.status = 'complete' THEN 1 ELSE 0 END) as complete_lanes,
    (SELECT wave_number FROM execution_waves WHERE session_id = el.session_id AND status = 'active' LIMIT 1) as active_wave,
    (SELECT COUNT(*) FROM lane_tasks lt JOIN execution_lanes el2 ON lt.lane_id = el2.id WHERE el2.session_id = el.session_id) as total_tasks,
    (SELECT COUNT(*) FROM lane_tasks lt JOIN execution_lanes el2 ON lt.lane_id = el2.id WHERE el2.session_id = el.session_id AND lt.status = 'complete') as completed_tasks
FROM execution_lanes el
LEFT JOIN execution_waves ew ON ew.session_id = el.session_id
GROUP BY el.session_id;
