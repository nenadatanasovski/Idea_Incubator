# Task Assignment API

REST API for agents to claim and work on tasks autonomously. Enables multi-agent coordination through a work queue system.

## Base URL

`/api/task-assignment`

## Endpoints

### POST /claim

Claim the next available task for an agent to work on.

**Request Body:**
```json
{
  "agentId": "build-agent-1",
  "capabilities": ["typescript", "nodejs"],
  "minPriority": "P2",
  "buildId": "optional-build-id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "claim": {
    "taskId": "BLD-001",
    "taskExecutionId": "te-1234567890-abc123",
    "agentId": "build-agent-1",
    "claimedAt": "2025-01-11T10:00:00.000Z",
    "buildId": "build-123"
  },
  "task": {
    "id": "BLD-001",
    "description": "Create database schema for tasks",
    "priority": "P1",
    "section": "Database",
    "subsection": "Migrations"
  }
}
```

**Response (No Tasks Available):**
```json
{
  "error": "No available tasks",
  "message": "All tasks are either claimed, in progress, or completed"
}
```

---

### POST /release

Release a claimed task back to the queue (if agent cannot complete it).

**Request Body:**
```json
{
  "taskExecutionId": "te-1234567890-abc123",
  "agentId": "build-agent-1",
  "reason": "Missing dependencies"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task released back to queue",
  "taskId": "BLD-001"
}
```

---

### POST /complete

Mark a task as complete or failed.

**Request Body:**
```json
{
  "taskExecutionId": "te-1234567890-abc123",
  "agentId": "build-agent-1",
  "success": true,
  "output": "Task completed successfully",
  "generatedCode": "const example = 'code';",
  "validationCommand": "npx tsc --noEmit",
  "validationOutput": "No errors found",
  "validationSuccess": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task completed successfully",
  "taskId": "BLD-001",
  "durationMs": 45320,
  "status": "completed"
}
```

---

### GET /available

Get list of available tasks without claiming them.

**Query Parameters:**
- `buildId` (optional): Build ID to filter tasks
- `minPriority` (optional): Minimum priority level (P1-P4, default: P4)
- `limit` (optional): Maximum number of tasks to return (default: 10)

**Response:**
```json
{
  "available": [
    {
      "id": "BLD-001",
      "description": "Create database schema",
      "priority": "P1",
      "section": "Database",
      "subsection": "Migrations"
    }
  ],
  "total": 1,
  "buildId": "build-123"
}
```

---

### GET /claimed/:agentId

Get tasks currently claimed by a specific agent.

**Response:**
```json
{
  "agentId": "build-agent-1",
  "claimed": [],
  "total": 0,
  "message": "Agent tracking not yet implemented"
}
```

*Note: This endpoint is a placeholder for future enhancement when agent assignment tracking is added to the database.*

---

## WebSocket Events

The task assignment API emits WebSocket events for real-time updates:

### task:claimed

Emitted when an agent claims a task.

```json
{
  "type": "task:claimed",
  "timestamp": "2025-01-11T10:00:00.000Z",
  "data": {
    "taskId": "BLD-001",
    "taskExecutionId": "te-1234567890-abc123",
    "agentId": "build-agent-1",
    "buildId": "build-123",
    "priority": "P1",
    "description": "Create database schema"
  }
}
```

### task:released

Emitted when an agent releases a task back to the queue.

```json
{
  "type": "task:released",
  "timestamp": "2025-01-11T10:05:00.000Z",
  "data": {
    "taskId": "BLD-001",
    "taskExecutionId": "te-1234567890-abc123",
    "agentId": "build-agent-1",
    "reason": "Missing dependencies"
  }
}
```

### task:completed

Emitted when an agent completes a task.

```json
{
  "type": "task:completed",
  "timestamp": "2025-01-11T10:15:00.000Z",
  "data": {
    "taskId": "BLD-001",
    "taskExecutionId": "te-1234567890-abc123",
    "agentId": "build-agent-1",
    "success": true,
    "durationMs": 45320,
    "buildId": "build-123"
  }
}
```

---

## Usage Example

### Agent Claiming and Completing a Task

```typescript
// 1. Claim a task
const claimResponse = await fetch('/api/task-assignment/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentId: 'build-agent-1',
    minPriority: 'P2',
  }),
});

const { claim, task } = await claimResponse.json();

try {
  // 2. Execute the task
  const result = await executeTask(task);

  // 3. Mark as complete
  await fetch('/api/task-assignment/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskExecutionId: claim.taskExecutionId,
      agentId: 'build-agent-1',
      success: true,
      output: result.output,
      generatedCode: result.code,
      validationCommand: 'npx tsc --noEmit',
      validationOutput: result.validationOutput,
      validationSuccess: true,
    }),
  });
} catch (error) {
  // 3b. Mark as failed or release
  await fetch('/api/task-assignment/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskExecutionId: claim.taskExecutionId,
      agentId: 'build-agent-1',
      success: false,
      error: error.message,
    }),
  });
}
```

---

## Database Schema

The task assignment API uses the following tables from migration `025_build_agent.sql`:

- **build_executions**: Tracks overall build runs
- **task_executions**: Tracks individual task executions within a build

Tasks are claimed by creating a record in `task_executions` with status `running`.

---

## Future Enhancements

1. **Agent Assignment Tracking**: Add a dedicated table to track which agents are assigned to which tasks
2. **Capability Matching**: Implement task-to-agent capability matching based on task requirements
3. **Priority Queuing**: Add support for dynamic priority adjustment based on dependencies
4. **Heartbeat Mechanism**: Add agent heartbeat tracking to detect stalled tasks
5. **Task Timeouts**: Automatically release tasks if agent doesn't complete within a timeout period
