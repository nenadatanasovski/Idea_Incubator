# Task Queue Persistence

## Overview

The Task Execution Engine now persists the task queue to the database, ensuring that the queue survives server restarts. This is critical for autonomous task execution that may run over extended periods.

## Implementation (EXE-004)

### Database Schema

Two new tables were added in migration `034_task_queue_persistence.sql`:

#### `task_queue`
Stores individual tasks in the execution queue with their state and position.

```sql
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    task_list_path TEXT NOT NULL,
    task_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    section TEXT,
    description TEXT NOT NULL,
    dependencies TEXT,          -- JSON array of task IDs
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    assigned_agent TEXT,
    position INTEGER NOT NULL,  -- Maintains queue order
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    queued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `task_list_path` - Fast lookup by task list
- `status` - Filter by status
- `priority` - Sort by priority
- `position` - Maintain queue order
- `(task_list_path, task_id)` - Unique constraint

#### `executor_state`
Stores the executor's configuration and runtime state.

```sql
CREATE TABLE executor_state (
    id TEXT PRIMARY KEY,
    task_list_path TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
    config_json TEXT,           -- Serialized ExecutionConfig
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    skipped_tasks INTEGER DEFAULT 0,
    current_task_id TEXT,
    started_at TEXT,
    paused_at TEXT,
    stopped_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### Code Changes

#### TaskExecutor Service (`server/services/task-executor.ts`)

**New Methods:**

1. **`persistQueueToDatabase()`**
   - Clears existing queue for the task list
   - Inserts current queue items with position order
   - Persists executor state

2. **`restoreQueueFromDatabase(filePath)`**
   - Queries database for existing queue items
   - Restores executor state (completed/failed/skipped counts)
   - Rebuilds in-memory queue from database

3. **`persistExecutorState()`**
   - Saves current executor status (running/paused/stopped)
   - Stores configuration as JSON
   - Updates task counts

4. **`updateTaskQueueStatus(taskId, status)`**
   - Updates task status in database
   - Sets timestamps (started_at, completed_at) based on status

**Modified Methods:**

All state-changing methods now persist to database:
- `loadTaskList()` - Tries to restore from DB, falls back to file
- `start()` - Persists state change
- `pause()` - Persists state change
- `stop()` - Persists state change
- `executeTask()` - Updates queue status before/after execution
- `skipTask()` - Persists skip status
- `requeueTask()` - Resets status to 'queued'

#### API Routes (`server/routes/executor.ts`)

All route handlers updated to `async` to support database operations:
- `POST /api/executor/start`
- `POST /api/executor/pause`
- `POST /api/executor/resume`
- `POST /api/executor/stop`
- `POST /api/executor/skip`
- `POST /api/executor/requeue`

#### ParsedTask Interface (`server/services/task-loader.ts`)

Added optional `dependencies` field:
```typescript
export interface ParsedTask {
  // ... existing fields
  dependencies?: string[]; // Task IDs that must complete before this task
}
```

## Benefits

### 1. **Crash Recovery**
If the server crashes or is restarted, the executor can resume from where it left off:
- Queue position is maintained
- Completed/failed/skipped counts are preserved
- Tasks in progress are reset to 'queued'

### 2. **Long-Running Builds**
For builds that take hours or days:
- Queue state persists across server restarts
- Progress is never lost
- Can safely deploy updates during execution

### 3. **Monitoring & Debugging**
Database provides a persistent record:
- See historical queue state
- Track task progression over time
- Debug issues with specific tasks

### 4. **Multiple Executors**
Database ensures consistency:
- Each task list has its own executor state
- No conflicts between concurrent executors
- Clean separation of concerns

## Usage

### Starting Execution

```typescript
const executor = getTaskExecutor();
await executor.loadTaskList('/path/to/tasks.md');
await executor.start();
```

On first load, the queue is built from the markdown file and persisted to the database.

### Restarting After Server Crash

```typescript
const executor = getTaskExecutor();
await executor.loadTaskList('/path/to/tasks.md');
// Queue is automatically restored from database
await executor.start();
```

The executor will:
1. Check database for existing queue
2. Restore queue items in the same order
3. Restore progress counters
4. Continue execution

### Checking Queue State

```sql
-- View active queue
SELECT * FROM v_active_queue;

-- Check specific task list
SELECT * FROM task_queue
WHERE task_list_path = '/path/to/tasks.md'
ORDER BY position;

-- View executor state
SELECT * FROM executor_state
WHERE task_list_path = '/path/to/tasks.md';
```

## View: v_active_queue

Convenience view for monitoring active queues:

```sql
CREATE VIEW v_active_queue AS
SELECT
    tq.id,
    tq.task_list_path,
    tq.task_id,
    tq.priority,
    tq.section,
    tq.description,
    tq.status,
    tq.assigned_agent,
    tq.position,
    tq.attempts,
    tq.queued_at,
    es.status as executor_status,
    CASE tq.priority
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
    END as priority_order
FROM task_queue tq
LEFT JOIN executor_state es ON tq.task_list_path = es.task_list_path
WHERE tq.status = 'queued'
ORDER BY priority_order ASC, tq.position ASC;
```

## Edge Cases

### 1. **Task List Modified While Running**
If the markdown file is updated while the executor is running:
- Database queue remains unchanged
- Next restart will sync with updated file
- Completed tasks won't be re-added to queue

### 2. **Database Corruption**
If database tables are missing or corrupted:
- Executor falls back to parsing markdown file
- Queue is rebuilt from scratch
- Warning is logged but execution continues

### 3. **Concurrent Executors**
Multiple executors can run different task lists:
- Each has its own executor_state row (unique task_list_path)
- Queue items are isolated by task_list_path
- No conflicts between executors

### 4. **Task Dependencies**
Dependencies are stored as JSON arrays:
- Currently informational only
- Future enhancement: check dependencies before execution
- Can be queried for dependency graphs

## Testing

Tests are located in `tests/task-queue-persistence.test.ts`:

```bash
npm test task-queue-persistence
```

Test coverage:
- ✓ Queue persists to database on load
- ✓ Queue restores from database on restart
- ✓ Executor state persists
- ✓ Task status updates on execution
- ✓ Priority order maintained
- ✓ Pause/resume state persists
- ✓ Skip/requeue operations persist

## Migration

Migration `034_task_queue_persistence.sql` is backward compatible:
- Tables created with `IF NOT EXISTS`
- No changes to existing schema
- Safe to run on existing databases

To apply:
```bash
npm run migrate
```

## Future Enhancements

1. **Dependency Resolution**
   - Check dependencies before executing tasks
   - Auto-skip tasks with failed dependencies
   - Visualize dependency graphs

2. **Queue Snapshots**
   - Take snapshots at key points
   - Rollback queue to previous state
   - Compare queue states over time

3. **Priority Adjustment**
   - Dynamically adjust task priorities
   - Boost blocked tasks
   - Defer low-priority tasks

4. **Queue Analytics**
   - Track average completion times
   - Identify bottlenecks
   - Predict completion time

## Related Documentation

- [Task Execution Architecture](./task-execution.md)
- [Result Collection](./result-collection.md)
- [Database Schema](../../database/schema.sql)
- [Migration 034](../../database/migrations/034_task_queue_persistence.sql)
