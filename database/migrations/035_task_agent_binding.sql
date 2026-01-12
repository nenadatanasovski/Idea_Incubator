-- Migration 035: Task-Agent Binding Table
-- Created: 2025-01-11
-- Purpose: Track which agent executed which task with detailed metadata (EXE-006)

-- Task-Agent Bindings - historical record of task assignments and executions
CREATE TABLE IF NOT EXISTS task_agent_bindings (
    id TEXT PRIMARY KEY,
    task_execution_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_type TEXT NOT NULL, -- e.g., 'build', 'spec', 'validation', 'ux', 'sia'
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('auto', 'manual', 'fallback', 'retry')),
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'active', 'completed', 'failed', 'abandoned')),
    exit_reason TEXT, -- 'success', 'error', 'timeout', 'cancelled', 'reassigned'

    -- Performance metrics
    duration_ms INTEGER,
    api_calls INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,

    -- Execution details
    error_message TEXT,
    files_touched TEXT, -- JSON array of file paths modified by this agent
    checkpoints_created INTEGER DEFAULT 0,
    rollbacks_performed INTEGER DEFAULT 0,

    -- Metadata
    context_snapshot TEXT, -- JSON snapshot of task context at assignment time
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (task_execution_id) REFERENCES task_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES active_agents(agent_id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bindings_task_execution ON task_agent_bindings(task_execution_id);
CREATE INDEX IF NOT EXISTS idx_bindings_agent ON task_agent_bindings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bindings_agent_type ON task_agent_bindings(agent_type);
CREATE INDEX IF NOT EXISTS idx_bindings_status ON task_agent_bindings(status);
CREATE INDEX IF NOT EXISTS idx_bindings_assigned_at ON task_agent_bindings(assigned_at);

-- Composite index for finding active bindings by agent
CREATE INDEX IF NOT EXISTS idx_bindings_agent_status ON task_agent_bindings(agent_id, status);

-- View for current task assignments (latest binding per task execution)
CREATE VIEW IF NOT EXISTS v_current_task_assignments AS
SELECT
    tab.id,
    tab.task_execution_id,
    te.task_id,
    te.phase,
    te.file_path,
    tab.agent_id,
    tab.agent_type,
    tab.assignment_type,
    tab.assigned_at,
    tab.started_at,
    tab.status,
    te.status as task_status,
    aa.agent_type as agent_registration_type,
    aa.state as agent_state
FROM task_agent_bindings tab
INNER JOIN task_executions te ON tab.task_execution_id = te.id
LEFT JOIN active_agents aa ON tab.agent_id = aa.agent_id
WHERE tab.id IN (
    -- Get most recent binding for each task execution
    SELECT id FROM (
        SELECT id, task_execution_id,
               ROW_NUMBER() OVER (PARTITION BY task_execution_id ORDER BY assigned_at DESC) as rn
        FROM task_agent_bindings
    ) WHERE rn = 1
);

-- View for agent performance metrics
CREATE VIEW IF NOT EXISTS v_agent_performance AS
SELECT
    agent_id,
    agent_type,
    COUNT(*) as total_assignments,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
    SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) as abandoned_count,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    SUM(api_calls) as total_api_calls,
    SUM(tokens_used) as total_tokens,
    ROUND(SUM(cost_usd), 4) as total_cost_usd,
    ROUND(
        CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as success_rate_pct,
    MIN(assigned_at) as first_assignment,
    MAX(assigned_at) as last_assignment
FROM task_agent_bindings
GROUP BY agent_id, agent_type;

-- View for task execution history with all agent attempts
CREATE VIEW IF NOT EXISTS v_task_execution_history AS
SELECT
    te.id as execution_id,
    te.task_id,
    te.phase,
    te.action,
    te.file_path,
    te.status as current_status,
    COUNT(tab.id) as agent_attempts,
    GROUP_CONCAT(
        tab.agent_type || '(' || tab.status || ')',
        ', '
    ) as agent_history,
    MAX(tab.completed_at) as last_completed_at,
    SUM(tab.duration_ms) as total_duration_ms,
    SUM(tab.tokens_used) as total_tokens_used,
    ROUND(SUM(tab.cost_usd), 4) as total_cost_usd
FROM task_executions te
LEFT JOIN task_agent_bindings tab ON te.id = tab.task_execution_id
GROUP BY te.id, te.task_id, te.phase, te.action, te.file_path, te.status;

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trg_bindings_updated_at
AFTER UPDATE ON task_agent_bindings
FOR EACH ROW
BEGIN
    UPDATE task_agent_bindings
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- Trigger to automatically calculate duration when status changes to completed or failed
CREATE TRIGGER IF NOT EXISTS trg_bindings_calculate_duration
AFTER UPDATE OF status ON task_agent_bindings
FOR EACH ROW
WHEN NEW.status IN ('completed', 'failed', 'abandoned')
     AND OLD.status NOT IN ('completed', 'failed', 'abandoned')
     AND NEW.started_at IS NOT NULL
BEGIN
    UPDATE task_agent_bindings
    SET duration_ms = (
        (julianday(COALESCE(NEW.completed_at, datetime('now'))) - julianday(NEW.started_at)) * 24 * 60 * 60 * 1000
    ),
    completed_at = COALESCE(NEW.completed_at, datetime('now'))
    WHERE id = NEW.id;
END;
