# API & WebSocket Reference

**Part of:** [Parallel Task Execution Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md)

---

## Tasks API

| Method   | Endpoint                      | Description                             |
| -------- | ----------------------------- | --------------------------------------- |
| `POST`   | `/api/tasks`                  | Create listless task (Evaluation Queue) |
| `GET`    | `/api/tasks`                  | List tasks with filters                 |
| `GET`    | `/api/tasks/:id`              | Get task details                        |
| `PUT`    | `/api/tasks/:id`              | Update task                             |
| `DELETE` | `/api/tasks/:id`              | Delete task                             |
| `POST`   | `/api/tasks/:id/file-impacts` | Override file impacts (user declared)   |
| `GET`    | `/api/tasks/:id/file-impacts` | Get file impacts                        |
| `GET`    | `/api/tasks/:id/parallelism`  | Get parallelism analysis for task       |

---

## Evaluation Queue API

| Method | Endpoint                             | Description                       |
| ------ | ------------------------------------ | --------------------------------- |
| `GET`  | `/api/evaluation-queue`              | Get all tasks in Evaluation Queue |
| `GET`  | `/api/evaluation-queue/stats`        | Get queue statistics              |
| `POST` | `/api/evaluation-queue/:taskId/move` | Move task to task list            |
| `GET`  | `/api/evaluation-queue/stale`        | Get stale tasks (>3 days)         |

---

## Task Lists API

| Method | Endpoint                          | Description                     |
| ------ | --------------------------------- | ------------------------------- |
| `POST` | `/api/task-lists`                 | Create task list (manual)       |
| `POST` | `/api/task-lists/from-suggestion` | Create from grouping suggestion |
| `GET`  | `/api/task-lists`                 | List task lists                 |
| `GET`  | `/api/task-lists/:id`             | Get task list details           |
| `GET`  | `/api/task-lists/:id/waves`       | Get execution waves             |
| `GET`  | `/api/task-lists/:id/parallelism` | Get parallelism analysis        |
| `POST` | `/api/task-lists/:id/execute`     | Start parallel execution        |
| `POST` | `/api/task-lists/:id/pause`       | Pause execution                 |
| `POST` | `/api/task-lists/:id/resume`      | Resume execution                |

---

## Grouping API

| Method | Endpoint                               | Description             |
| ------ | -------------------------------------- | ----------------------- |
| `GET`  | `/api/grouping-suggestions`            | Get pending suggestions |
| `POST` | `/api/grouping-suggestions/:id/accept` | Accept suggestion       |
| `POST` | `/api/grouping-suggestions/:id/reject` | Reject suggestion       |
| `POST` | `/api/grouping-suggestions/:id/modify` | Modify and accept       |
| `POST` | `/api/grouping/analyze`                | Trigger manual analysis |
| `GET`  | `/api/grouping/weights/:projectId`     | Get project weights     |
| `PUT`  | `/api/grouping/weights/:projectId`     | Update project weights  |

---

## Build Agents API

| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| `GET`  | `/api/build-agents`               | List active Build Agents |
| `GET`  | `/api/build-agents/:id`           | Get agent details        |
| `POST` | `/api/build-agents/:id/terminate` | Terminate agent          |
| `GET`  | `/api/build-agents/:id/logs`      | Get agent logs           |

---

## WebSocket Events

### Task Events

| Event            | Direction     | Payload                             | When                     |
| ---------------- | ------------- | ----------------------------------- | ------------------------ |
| `task.created`   | Server→Client | `{ taskId, displayId, queue }`      | Task created             |
| `task.updated`   | Server→Client | `{ taskId, changes }`               | Task modified            |
| `task.moved`     | Server→Client | `{ taskId, from, to }`              | Task moved to list       |
| `task.ready`     | Server→Client | `{ taskId, agentId }`               | Task ready for execution |
| `task.started`   | Server→Client | `{ taskId, agentId }`               | Build Agent started task |
| `task.progress`  | Server→Client | `{ taskId, progress, message }`     | Execution progress       |
| `task.completed` | Server→Client | `{ taskId, result }`                | Task completed           |
| `task.failed`    | Server→Client | `{ taskId, error, recommendation }` | Task failed              |

### Build Agent Events

| Event              | Direction     | Payload                           | When               |
| ------------------ | ------------- | --------------------------------- | ------------------ |
| `agent.spawned`    | Server→Client | `{ agentId, taskId, taskListId }` | Agent spawned      |
| `agent.heartbeat`  | Server→Client | `{ agentId, status }`             | Periodic heartbeat |
| `agent.completed`  | Server→Client | `{ agentId, result }`             | Agent finished     |
| `agent.failed`     | Server→Client | `{ agentId, error }`              | Agent failed       |
| `agent.terminated` | Server→Client | `{ agentId, reason }`             | Agent terminated   |

### Execution Events

| Event                      | Direction     | Payload                               | When              |
| -------------------------- | ------------- | ------------------------------------- | ----------------- |
| `execution.started`        | Server→Client | `{ taskListId, waves, agentCount }`   | Execution started |
| `execution.wave_started`   | Server→Client | `{ taskListId, waveNumber, taskIds }` | Wave started      |
| `execution.wave_completed` | Server→Client | `{ taskListId, waveNumber }`          | Wave completed    |
| `execution.completed`      | Server→Client | `{ taskListId, summary }`             | All tasks done    |
| `execution.paused`         | Server→Client | `{ taskListId }`                      | Execution paused  |
| `execution.resumed`        | Server→Client | `{ taskListId }`                      | Execution resumed |

### Grouping Events

| Event                | Direction     | Payload                        | When               |
| -------------------- | ------------- | ------------------------------ | ------------------ |
| `grouping.suggested` | Server→Client | `{ suggestion }`               | New suggestion     |
| `grouping.accepted`  | Server→Client | `{ suggestionId, taskListId }` | User accepted      |
| `grouping.rejected`  | Server→Client | `{ suggestionId }`             | User rejected      |
| `grouping.expired`   | Server→Client | `{ suggestionId }`             | Suggestion expired |
