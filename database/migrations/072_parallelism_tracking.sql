-- Migration 072: Parallelism Tracking
-- Purpose: Track parallelism analysis results and execution waves
-- Part of: Parallel Task Execution Implementation Plan (PTE-012 to PTE-015)

-- Store pre-computed parallelism analysis between task pairs
CREATE TABLE IF NOT EXISTS parallelism_analysis (
    id TEXT PRIMARY KEY,

    -- Task pair (always task_a_id < task_b_id to avoid duplicates)
    task_a_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    task_b_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Analysis result
    can_parallel INTEGER NOT NULL DEFAULT 0,  -- Boolean: 1 = can run in parallel

    -- Conflict details (if cannot run in parallel)
    conflict_type TEXT CHECK(conflict_type IN (
        'dependency',       -- One depends on the other
        'file_conflict',    -- Both modify same file
        'resource_conflict' -- Other resource conflict
    )),
    conflict_details TEXT,  -- JSON with specific conflict info

    -- Analysis metadata
    analyzed_at TEXT DEFAULT (datetime('now')),
    invalidated_at TEXT,    -- Set when re-analysis needed

    -- Ensure consistent ordering and uniqueness
    UNIQUE(task_a_id, task_b_id),
    CHECK(task_a_id < task_b_id)
);

-- Store execution waves for task lists
CREATE TABLE IF NOT EXISTS parallel_execution_waves (
    id TEXT PRIMARY KEY,
    task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id) ON DELETE CASCADE,

    -- Wave number (1, 2, 3, ...)
    wave_number INTEGER NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending', 'in_progress', 'completed', 'failed'
    )),

    -- Task count in this wave
    task_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,

    -- Timing
    started_at TEXT,
    completed_at TEXT,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(task_list_id, wave_number)
);

-- Link tasks to their assigned wave
CREATE TABLE IF NOT EXISTS wave_task_assignments (
    id TEXT PRIMARY KEY,
    wave_id TEXT NOT NULL REFERENCES parallel_execution_waves(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Position within wave (for ordering if needed)
    position INTEGER DEFAULT 0,

    -- Timestamps
    assigned_at TEXT DEFAULT (datetime('now')),

    UNIQUE(wave_id, task_id)
);

-- Track active Build Agent instances
CREATE TABLE IF NOT EXISTS build_agent_instances (
    id TEXT PRIMARY KEY,

    -- Assignment
    task_id TEXT UNIQUE REFERENCES tasks(id) ON DELETE SET NULL,
    task_list_id TEXT REFERENCES task_lists_v2(id) ON DELETE CASCADE,

    -- Agent process info
    process_id TEXT,
    hostname TEXT,

    -- Status
    status TEXT DEFAULT 'spawning' CHECK(status IN (
        'spawning',     -- Agent being created
        'idle',         -- Ready but no task
        'running',      -- Executing task
        'completing',   -- Finishing up
        'terminated'    -- Shut down
    )),

    -- Health tracking
    last_heartbeat_at TEXT,
    heartbeat_count INTEGER DEFAULT 0,
    consecutive_missed_heartbeats INTEGER DEFAULT 0,

    -- Performance metrics
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,

    -- Timestamps
    spawned_at TEXT DEFAULT (datetime('now')),
    terminated_at TEXT,

    -- Error info if terminated due to error
    termination_reason TEXT,
    error_message TEXT
);

-- Track heartbeats for lock management
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES build_agent_instances(id) ON DELETE CASCADE,

    -- Current state
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    progress_percent INTEGER CHECK(progress_percent >= 0 AND progress_percent <= 100),
    current_step TEXT,

    -- Resource usage (if available)
    memory_mb INTEGER,
    cpu_percent REAL,

    -- Timestamp
    recorded_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for parallelism analysis
CREATE INDEX IF NOT EXISTS idx_para_analysis_task_a ON parallelism_analysis(task_a_id);
CREATE INDEX IF NOT EXISTS idx_para_analysis_task_b ON parallelism_analysis(task_b_id);
CREATE INDEX IF NOT EXISTS idx_para_analysis_invalidated ON parallelism_analysis(invalidated_at);

-- Indexes for waves
CREATE INDEX IF NOT EXISTS idx_waves_task_list ON parallel_execution_waves(task_list_id);
CREATE INDEX IF NOT EXISTS idx_waves_status ON parallel_execution_waves(status);
CREATE INDEX IF NOT EXISTS idx_wave_assignments_wave ON wave_task_assignments(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_assignments_task ON wave_task_assignments(task_id);

-- Indexes for Build Agents
CREATE INDEX IF NOT EXISTS idx_agents_task_list ON build_agent_instances(task_list_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON build_agent_instances(status);
CREATE INDEX IF NOT EXISTS idx_agents_heartbeat ON build_agent_instances(last_heartbeat_at);

-- Index for heartbeats
CREATE INDEX IF NOT EXISTS idx_heartbeats_agent ON agent_heartbeats(agent_id);

-- View for active agents summary
CREATE VIEW IF NOT EXISTS active_agents_view AS
SELECT
    ba.id,
    ba.task_id,
    ba.task_list_id,
    t.display_id AS task_display_id,
    t.title AS task_title,
    tl.name AS task_list_name,
    ba.status,
    ba.last_heartbeat_at,
    ba.consecutive_missed_heartbeats,
    (julianday('now') - julianday(ba.last_heartbeat_at)) * 86400 AS seconds_since_heartbeat,
    ba.tasks_completed,
    ba.spawned_at
FROM build_agent_instances ba
LEFT JOIN tasks t ON ba.task_id = t.id
LEFT JOIN task_lists_v2 tl ON ba.task_list_id = tl.id
WHERE ba.status NOT IN ('terminated');

-- View for task list parallelism summary
CREATE VIEW IF NOT EXISTS task_list_parallelism_view AS
SELECT
    tl.id AS task_list_id,
    tl.name,
    COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT pew.id) AS total_waves,
    MAX(pew.wave_number) AS max_wave,
    (
        SELECT COUNT(*) FROM parallelism_analysis pa
        WHERE pa.can_parallel = 1
        AND pa.invalidated_at IS NULL
        AND EXISTS (SELECT 1 FROM tasks t1 WHERE t1.id = pa.task_a_id AND t1.task_list_id = tl.id)
        AND EXISTS (SELECT 1 FROM tasks t2 WHERE t2.id = pa.task_b_id AND t2.task_list_id = tl.id)
    ) AS parallel_opportunities
FROM task_lists_v2 tl
LEFT JOIN tasks t ON t.task_list_id = tl.id
LEFT JOIN parallel_execution_waves pew ON pew.task_list_id = tl.id
GROUP BY tl.id;
