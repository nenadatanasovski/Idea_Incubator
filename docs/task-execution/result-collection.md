# Task Result Collection Mechanism (EXE-003)

## Overview

The Task Result Collector is a persistent result collection mechanism that tracks task executions from start to completion, providing real-time status updates, execution metrics, and the ability to wait for task completion.

## Architecture

```
┌─────────────────┐
│  Task Executor  │
└────────┬────────┘
         │ starts execution
         ▼
┌─────────────────────┐
│ Result Collector    │
│                     │
│ • Track execution   │
│ • Wait for result   │
│ • Record metrics    │
└─────────┬───────────┘
          │
          ├─► Database (task_executions)
          │
          └─► In-memory Promise Registry
```

## Key Components

### 1. TaskResultCollector Class

Located in: `server/services/task-result-collector.ts`

**Purpose**: Central hub for tracking all task executions with both database persistence and in-memory promise tracking.

**Key Features**:

- Promise-based waiting for task completion
- Automatic timeout handling
- Execution metrics calculation
- Cleanup of old executions

### 2. Integration with TaskExecutor

The Task Executor now uses the Result Collector to:

```typescript
// Start tracking
await this.resultCollector.startExecution(
  task,
  taskListPath,
  buildId,
  agentType,
);

// Execute task (this blocks until complete)
const result = await runner.executeTask(task);

// Record completion
await this.resultCollector.recordCompletion(executionId, result);
```

### 3. Database Schema

Enhanced `task_executions` table with new columns:

```sql
ALTER TABLE task_executions ADD COLUMN task_list_path TEXT;
ALTER TABLE task_executions ADD COLUMN assigned_agent TEXT;
ALTER TABLE task_executions ADD COLUMN output TEXT;
ALTER TABLE task_executions ADD COLUMN error TEXT;
ALTER TABLE task_executions ADD COLUMN files_modified TEXT; -- JSON array
ALTER TABLE task_executions ADD COLUMN questions_asked INTEGER DEFAULT 0;
ALTER TABLE task_executions ADD COLUMN tokens_used INTEGER DEFAULT 0;
```

## Usage Examples

### Basic Execution Tracking

```typescript
import { getTaskResultCollector } from "./server/services/task-result-collector.js";

const collector = getTaskResultCollector();

// Start tracking a task
const executionId = await collector.startExecution(
  task,
  "/path/to/tasks.md",
  "build-123",
  "build-agent",
);

// Wait for completion (blocks until done or timeout)
try {
  const result = await collector.waitForCompletion(executionId, 5 * 60 * 1000);
  console.log("Task completed:", result.output);
  console.log("Files modified:", result.filesModified);
} catch (error) {
  console.error("Task failed or timed out:", error);
}
```

### Query Execution Status

```typescript
// Get execution record by ID
const execution = await collector.getExecutionById(executionId);
console.log("Status:", execution.status);
console.log("Started:", execution.startedAt);
console.log("Agent:", execution.assignedAgent);

// Get all executions for a task
const history = await collector.getExecutionsByTaskId("EXE-003");
console.log(`Task has ${history.length} execution attempts`);

// Get all executions for a build
const buildExecutions = await collector.getExecutionsByBuildId("build-123");
console.log(`Build has ${buildExecutions.length} task executions`);
```

### Execution Metrics

```typescript
// Get metrics for all executions
const metrics = await collector.getMetrics();
console.log(`Total: ${metrics.totalExecutions}`);
console.log(`Completed: ${metrics.completed}`);
console.log(`Failed: ${metrics.failed}`);
console.log(`In Progress: ${metrics.inProgress}`);
console.log(`Avg Duration: ${metrics.avgDurationMs}ms`);
console.log(`Total Tokens: ${metrics.totalTokensUsed}`);
console.log(`Total Questions: ${metrics.totalQuestionsAsked}`);

// Get metrics for a specific build
const buildMetrics = await collector.getMetrics("build-123");
```

### Task Executor Integration

```typescript
import { getTaskExecutor } from "./server/services/task-executor.js";

const executor = getTaskExecutor();

// Wait for a specific task to complete
const executionId = "exec-1234567890-EXE-003";
const result = await executor.waitForTaskCompletion(executionId);

// Get execution metrics for current build
const metrics = await executor.getExecutionMetrics();

// Get execution history for a task
const history = await executor.getTaskExecutionHistory("EXE-003");
```

## Event System

The Result Collector emits events for monitoring:

```typescript
collector.on("execution:started", ({ executionId, taskId, assignedAgent }) => {
  console.log(`Task ${taskId} started with ${assignedAgent}`);
});

collector.on("execution:completed", ({ executionId, success, output }) => {
  console.log(`Execution ${executionId} completed: ${success}`);
});

collector.on("execution:failed", ({ executionId, error, willRetry }) => {
  console.log(`Execution ${executionId} failed: ${error}`);
  if (willRetry) console.log("Will retry...");
});

collector.on("execution:cancelled", ({ executionId }) => {
  console.log(`Execution ${executionId} was cancelled`);
});
```

## How It Works

### 1. Start Execution

When a task starts:

1. Generate unique execution ID: `exec-{timestamp}-{taskId}`
2. Insert record into `task_executions` table with status `running`
3. Create in-memory Promise that will resolve when task completes
4. Emit `execution:started` event

### 2. Wait for Completion

The `waitForCompletion()` method:

1. Checks if execution is in pending registry
2. If not, queries database to see if already complete
3. Sets up timeout timer
4. Returns Promise that races between completion and timeout
5. Automatically cleans up on completion or timeout

### 3. Record Completion

When agent finishes:

1. Update database with final status, output, metrics
2. Resolve the pending Promise
3. Clear timeout timer
4. Remove from pending registry
5. Emit `execution:completed` event

### 4. Handle Failure

When task fails:

1. Update database with error message
2. Optionally mark for retry (status remains `pending`)
3. Reject the pending Promise if not retrying
4. Emit `execution:failed` event

## Database Schema

### Status Flow

```
pending → running → completed
                 ↓
                failed
                 ↓
              skipped (cancelled)
```

### Key Fields

| Field             | Type    | Description                       |
| ----------------- | ------- | --------------------------------- |
| `id`              | TEXT    | Unique execution ID               |
| `task_id`         | TEXT    | Reference to task definition      |
| `build_id`        | TEXT    | Reference to build run            |
| `task_list_path`  | TEXT    | Path to task list file            |
| `assigned_agent`  | TEXT    | Agent type that executed task     |
| `status`          | TEXT    | Current status (see flow above)   |
| `started_at`      | TEXT    | ISO timestamp of start            |
| `completed_at`    | TEXT    | ISO timestamp of completion       |
| `output`          | TEXT    | Success message or result         |
| `error`           | TEXT    | Error message if failed           |
| `files_modified`  | TEXT    | JSON array of modified file paths |
| `questions_asked` | INTEGER | Number of questions asked         |
| `tokens_used`     | INTEGER | Claude API tokens consumed        |
| `attempts`        | INTEGER | Execution attempt count           |

## Performance Considerations

### Memory Management

- In-memory pending registry is bounded by `maxConcurrent` limit
- Completed executions are immediately removed from memory
- Only active executions are held in memory

### Database Cleanup

```typescript
// Clean up executions older than 30 days
const cleaned = await collector.cleanupOldExecutions(30);
console.log(`Cleaned up ${cleaned} old executions`);
```

### Query Optimization

Indexed columns:

- `task_id` - for getting task history
- `build_id` - for getting build executions
- `status` - for counting in-progress tasks
- `task_list_path` - for project-level queries
- `assigned_agent` - for agent-level metrics

## Testing

Run tests:

```bash
npm test server/services/__tests__/task-result-collector.test.ts
```

Tests cover:

- Execution tracking
- Completion recording
- Failure handling
- Timeout behavior
- Metrics calculation
- Cancellation
- Event emission

## Migration

Apply the schema enhancement:

```bash
npm run migrate
```

This runs `database/migrations/033_task_execution_enhancements.sql`

## Integration Checklist

- [x] Result collector implementation
- [x] Database migration
- [x] TaskExecutor integration
- [x] Unit tests
- [x] Documentation
- [ ] API endpoints (future: GET /api/executions/:id)
- [ ] WebSocket events (future: broadcast execution updates)
- [ ] UI display (future: show execution status)

## Future Enhancements

### Planned (EXE-004 onwards)

1. **Task Queue Persistence** - Survive server restarts
2. **Dependency Resolution** - Wait for dependent tasks
3. **Agent Binding Table** - Track which agent executed which task
4. **Blocking Question Detection** - Pause until answered
5. **Feedback Loop** - Agent completion callbacks

### API Endpoints (Future)

```typescript
// Query execution status
GET /api/executions/:executionId
GET /api/executions?buildId=build-123
GET /api/executions?taskId=EXE-003

// Execution metrics
GET /api/executions/metrics
GET /api/executions/metrics?buildId=build-123

// Cancel execution
POST /api/executions/:executionId/cancel
```

## Related Documentation

- [Task Executor](./task-executor.md)
- [Agent Runner](./agent-runner.md)
- [Database Schema](../database/schema.md)
- [SPEC-IMPLEMENTATION-GAPS](../bootstrap/SPEC-IMPLEMENTATION-GAPS.md)

## Status

**EXE-003: ✅ COMPLETE**

The result collection mechanism is now fully implemented with:

- Persistent tracking in database
- In-memory promise registry for waiting
- Metrics calculation
- Integration with Task Executor
- Comprehensive unit tests
- Full documentation
