# Build Agent Appendix B: Database Schema

> **Parent Document:** [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md)

---

## B.1 Build Agent Instances Table

```sql
-- Migration: 074_build_agent_instances.sql

CREATE TABLE IF NOT EXISTS build_agent_instances (
  instance_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES task_list_execution_runs(execution_id),
  agent_type TEXT NOT NULL DEFAULT 'build-agent',
  current_task_id TEXT REFERENCES tasks(id),
  wave_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'initializing',
  spawned_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  last_heartbeat TEXT,
  config TEXT,  -- JSON: { maxRetries, heartbeatIntervalMs, taskTimeoutMs, validationTimeoutMs }
  error_context TEXT,  -- JSON: { code, message, taskId, stackTrace, timestamp }

  CONSTRAINT valid_status CHECK (status IN (
    'initializing', 'running', 'idle', 'completed', 'failed', 'stuck'
  ))
);

-- Index for finding agents by execution
CREATE INDEX IF NOT EXISTS idx_build_agents_execution
  ON build_agent_instances(execution_id);

-- Index for finding agents by status
CREATE INDEX IF NOT EXISTS idx_build_agents_status
  ON build_agent_instances(status);

-- Index for finding agents with stale heartbeats
CREATE INDEX IF NOT EXISTS idx_build_agents_heartbeat
  ON build_agent_instances(last_heartbeat)
  WHERE status = 'running';
```

---

## B.2 Agent Heartbeats Table

```sql
-- Migration: 074_build_agent_instances.sql (continued)

CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL REFERENCES build_agent_instances(instance_id),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL,
  current_task_id TEXT,
  progress_percent INTEGER,
  memory_usage_mb INTEGER,
  cpu_percent REAL
);

-- Index for recent heartbeats per agent
CREATE INDEX IF NOT EXISTS idx_heartbeats_instance
  ON agent_heartbeats(instance_id, timestamp DESC);

-- Index for time-based cleanup
CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp
  ON agent_heartbeats(timestamp);

-- Cleanup old heartbeats (keep last 24 hours)
-- Run periodically via cron
DELETE FROM agent_heartbeats
WHERE timestamp < datetime('now', '-24 hours');
```

---

## B.3 Task Execution Log Table

```sql
-- Migration: 075_task_execution_log.sql

CREATE TABLE IF NOT EXISTS task_execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  task_id TEXT,
  instance_id TEXT REFERENCES build_agent_instances(instance_id),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,  -- JSON: additional context

  CONSTRAINT valid_event_type CHECK (event_type IN (
    'task_started', 'task_completed', 'task_failed', 'task_skipped',
    'checkpoint_created', 'checkpoint_restored',
    'discovery_recorded', 'validation_run',
    'error', 'warning', 'info'
  ))
);

-- Index for querying logs by execution (lane isolation)
CREATE INDEX IF NOT EXISTS idx_exec_log_execution
  ON task_execution_log(execution_id, timestamp DESC);

-- Index for querying logs by task
CREATE INDEX IF NOT EXISTS idx_exec_log_task
  ON task_execution_log(task_id, timestamp DESC);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_exec_log_timestamp
  ON task_execution_log(timestamp);

-- Index for finding errors
CREATE INDEX IF NOT EXISTS idx_exec_log_errors
  ON task_execution_log(event_type, execution_id)
  WHERE event_type IN ('task_failed', 'error');
```

---

## B.4 Parallel Execution Waves Table

```sql
-- Migration: 073_parallel_execution.sql

CREATE TABLE IF NOT EXISTS parallel_execution_waves (
  wave_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES task_list_execution_runs(execution_id),
  wave_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  task_count INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  CONSTRAINT valid_wave_status CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  UNIQUE(execution_id, wave_number)
);

-- Index for finding active waves
CREATE INDEX IF NOT EXISTS idx_waves_active
  ON parallel_execution_waves(execution_id, status)
  WHERE status IN ('pending', 'running');
```

---

## B.5 Wave Task Assignments Table

```sql
-- Migration: 073_parallel_execution.sql (continued)

CREATE TABLE IF NOT EXISTS wave_task_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wave_id TEXT NOT NULL REFERENCES parallel_execution_waves(wave_id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  instance_id TEXT REFERENCES build_agent_instances(instance_id),
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TEXT,
  completed_at TEXT,

  CONSTRAINT valid_assignment_status CHECK (status IN (
    'pending', 'assigned', 'running', 'completed', 'failed', 'skipped'
  )),
  UNIQUE(wave_id, task_id)
);

-- Index for finding tasks in a wave
CREATE INDEX IF NOT EXISTS idx_wave_tasks
  ON wave_task_assignments(wave_id, status);

-- Index for finding tasks by instance
CREATE INDEX IF NOT EXISTS idx_wave_tasks_instance
  ON wave_task_assignments(instance_id)
  WHERE instance_id IS NOT NULL;
```

---

## B.6 Task Execution Runs Table

```sql
-- Migration: 075_execution_runs.sql

CREATE TABLE IF NOT EXISTS task_list_execution_runs (
  execution_id TEXT PRIMARY KEY,
  task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id),
  run_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  triggered_by TEXT,  -- 'user', 'auto', 'retry'
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  skipped_tasks INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT valid_run_status CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled', 'paused'
  )),
  UNIQUE(task_list_id, run_number)
);

-- Index for finding runs by task list
CREATE INDEX IF NOT EXISTS idx_exec_runs_list
  ON task_list_execution_runs(task_list_id, run_number DESC);

-- Index for active runs
CREATE INDEX IF NOT EXISTS idx_exec_runs_active
  ON task_list_execution_runs(status)
  WHERE status IN ('pending', 'running', 'paused');
```

---

## B.7 Checkpoints Table

```sql
-- Migration: 076_checkpoints.sql

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES task_list_execution_runs(execution_id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  instance_id TEXT REFERENCES build_agent_instances(instance_id),
  git_ref TEXT NOT NULL,  -- Git commit SHA or ref
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  files_snapshot TEXT,  -- JSON: list of files and their hashes
  metadata TEXT  -- JSON: additional checkpoint metadata
);

-- Index for finding checkpoints by execution
CREATE INDEX IF NOT EXISTS idx_checkpoints_execution
  ON checkpoints(execution_id, created_at DESC);

-- Index for finding checkpoints by task
CREATE INDEX IF NOT EXISTS idx_checkpoints_task
  ON checkpoints(task_id);
```

---

## B.8 Common Queries

### Find Agents with Stale Heartbeats

```sql
-- Find agents that haven't sent heartbeat in > 60 seconds
SELECT bai.*,
       CAST((julianday('now') - julianday(bai.last_heartbeat)) * 24 * 60 * 60 AS INTEGER) as seconds_since_heartbeat
FROM build_agent_instances bai
WHERE bai.status = 'running'
  AND bai.last_heartbeat < datetime('now', '-60 seconds');
```

### Get Execution Log for SIA (Last 500 Lines)

```sql
-- Lane-isolated execution log for SIA analysis
SELECT tel.*, t.title, t.file as file_path
FROM task_execution_log tel
LEFT JOIN tasks t ON tel.task_id = t.id
WHERE tel.execution_id = ?
ORDER BY tel.timestamp DESC
LIMIT 500;
```

### Get Wave Status Summary

```sql
-- Get status of all waves for an execution
SELECT
  pew.wave_number,
  pew.status,
  pew.task_count,
  pew.completed_count,
  pew.failed_count,
  COUNT(DISTINCT bai.instance_id) as active_agents
FROM parallel_execution_waves pew
LEFT JOIN wave_task_assignments wta ON pew.wave_id = wta.wave_id
LEFT JOIN build_agent_instances bai ON wta.instance_id = bai.instance_id
  AND bai.status = 'running'
WHERE pew.execution_id = ?
GROUP BY pew.wave_id
ORDER BY pew.wave_number;
```

### Find Consecutive Failures (for SIA Trigger)

```sql
-- Count consecutive failures for a task
SELECT
  t.id,
  t.title,
  COUNT(*) as failure_count,
  GROUP_CONCAT(tel.message, ' | ') as error_messages
FROM task_execution_log tel
JOIN tasks t ON tel.task_id = t.id
WHERE tel.execution_id = ?
  AND tel.event_type = 'task_failed'
  AND tel.task_id = ?
GROUP BY t.id
HAVING COUNT(*) >= 3;
```

### Check for Progress Between Attempts

```sql
-- Detect if any progress made between task attempts
SELECT
  tel1.timestamp as attempt_1_time,
  tel2.timestamp as attempt_2_time,
  tel1.context as attempt_1_context,
  tel2.context as attempt_2_context,
  -- Compare error messages
  CASE
    WHEN json_extract(tel1.context, '$.error') = json_extract(tel2.context, '$.error')
    THEN 0 ELSE 1
  END as error_changed
FROM task_execution_log tel1
JOIN task_execution_log tel2 ON tel1.task_id = tel2.task_id
  AND tel1.execution_id = tel2.execution_id
WHERE tel1.task_id = ?
  AND tel1.event_type = 'task_failed'
  AND tel2.event_type = 'task_failed'
  AND tel2.timestamp > tel1.timestamp
ORDER BY tel1.timestamp;
```

---

## B.9 Database Migrations Sequence

| Migration                       | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `070_task_file_impacts.sql`     | File impact tracking for conflict detection |
| `071_parallelism_analysis.sql`  | Task pair parallelism analysis cache        |
| `072_grouping_suggestions.sql`  | Auto-grouping suggestions                   |
| `073_parallel_execution.sql`    | Waves and wave task assignments             |
| `074_build_agent_instances.sql` | Build Agent instances and heartbeats        |
| `075_execution_runs.sql`        | Execution run tracking                      |
| `076_checkpoints.sql`           | Checkpoint management                       |

---

## B.10 Index Strategy Summary

| Table                      | Index                        | Purpose                      |
| -------------------------- | ---------------------------- | ---------------------------- |
| `build_agent_instances`    | `idx_build_agents_execution` | Find agents for an execution |
| `build_agent_instances`    | `idx_build_agents_status`    | Find agents by status        |
| `build_agent_instances`    | `idx_build_agents_heartbeat` | Find stale agents            |
| `agent_heartbeats`         | `idx_heartbeats_instance`    | Recent heartbeats per agent  |
| `task_execution_log`       | `idx_exec_log_execution`     | Lane-isolated log queries    |
| `task_execution_log`       | `idx_exec_log_errors`        | Find failures quickly        |
| `parallel_execution_waves` | `idx_waves_active`           | Find active waves            |
| `wave_task_assignments`    | `idx_wave_tasks`             | Tasks in a wave              |
| `checkpoints`              | `idx_checkpoints_execution`  | Checkpoints for rollback     |
