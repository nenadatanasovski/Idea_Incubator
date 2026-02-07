-- Vibe Task Patterns Migration
-- Created: 2026-02-07
-- Adds task state history, executions, activities, decompositions

-- ============================================
-- 1. Task State History (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS task_state_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,  -- agent_id or 'system'
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  reason TEXT,
  metadata TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_state_history_task ON task_state_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_state_history_time ON task_state_history(created_at);

-- ============================================
-- 2. Task Executions (detailed tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  session_id TEXT REFERENCES agent_sessions(id),
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  output TEXT,
  error TEXT,
  files_modified TEXT,  -- JSON array
  tokens_used INTEGER DEFAULT 0,
  validation_command TEXT,
  validation_output TEXT,
  validation_success INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_agent ON task_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_session ON task_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);

-- ============================================
-- 3. Agent Activities (activity log)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activities (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'task_assigned', 'task_started', 'task_completed', 'task_failed',
    'file_read', 'file_write', 'command_executed',
    'error_occurred', 'heartbeat', 'idle', 'spawned', 'terminated'
  )),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
  details TEXT,  -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_activities_agent ON agent_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_type ON agent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activities_time ON agent_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_activities_task ON agent_activities(task_id);

-- ============================================
-- 4. Task Decompositions
-- ============================================
CREATE TABLE IF NOT EXISTS task_decompositions (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  decomposition_type TEXT CHECK (decomposition_type IN ('manual', 'auto', 'planning_agent')),
  total_subtasks INTEGER DEFAULT 0,
  completed_subtasks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_task_decompositions_parent ON task_decompositions(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_decompositions_status ON task_decompositions(status);

-- ============================================
-- 5. Enhanced Waves Metrics (add columns if not exist)
-- ============================================
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check manually

-- Add task_count column
SELECT CASE 
  WHEN (SELECT COUNT(*) FROM pragma_table_info('execution_waves') WHERE name = 'task_count') = 0 
  THEN 'ALTER TABLE execution_waves ADD COLUMN task_count INTEGER DEFAULT 0'
  ELSE 'SELECT 1'
END;

-- Add completed_count column (manual execution needed - SQLite limitation)
-- These are handled by the migration runner with error handling
