# Task: TEST-TASK-SESSION - Test Task for Session

**Created:** 2026-02-07
**Purpose:** Validate end-to-end task-session lifecycle in the parent-harness orchestrator
**Status:** Specification

---

## Overview

This specification defines the behavior and validation criteria for the **test task session** pattern used throughout the orchestrator's e2e test suite. A "test task for session" validates that:

1. Tasks can be created with the `test_task_session_*` display ID convention
2. Agent sessions can be linked to tasks via foreign key relationships
3. Session state transitions work correctly through the full lifecycle
4. Iteration logs are properly tracked under sessions

This is a foundational integration test pattern that exercises the core task → session → iteration data pipeline.

---

## Metadata

| Field          | Value                          |
| -------------- | ------------------------------ |
| **Display ID** | `test_task_session_[TIMESTAMP]`|
| **Phase**      | 1-Database / 5-Tests           |
| **Category**   | `test`                         |
| **Status**     | `pending`                      |
| **Priority**   | P2-Important                   |
| **Effort**     | small                          |
| **Owner**      | Build Agent                    |

---

## Requirements

### 1. Task Creation

- Task is created via `createTask()` in `parent-harness/orchestrator/src/db/tasks.ts`
- `display_id` follows the pattern `test_task_session_[TIMESTAMP]` (e.g. `test_task_session_1770382500572`)
- `title` is exactly `"Test Task for Session"`
- `category` is `"test"`
- `priority` defaults to `P2`
- `status` defaults to `"pending"`
- `task_list_id` may be `null` (no FK requirement for test tasks)

### 2. Session Linking

- A session is created via `createSession(agentId, taskId)` in `parent-harness/orchestrator/src/db/sessions.ts`
- The session's `task_id` foreign key references the created task's `id`
- The session's `agent_id` foreign key references a valid agent record
- Initial session status is `"running"`
- `started_at` is auto-populated to current datetime

### 3. Session State Transitions

The session must support transitions through these states (defined in `parent-harness/database/schema.sql:243`):

| From State   | To State     | Trigger                    |
|-------------|-------------|----------------------------|
| `running`   | `completed` | All work finished          |
| `running`   | `failed`    | Unrecoverable error        |
| `running`   | `paused`    | Human intervention needed  |
| `running`   | `terminated`| Manual or timeout kill     |
| `paused`    | `running`   | Resumed                    |

Terminal states (`completed`, `failed`, `terminated`) set `completed_at` timestamp.

### 4. Iteration Tracking

- Iterations are logged via `logIteration()` in `parent-harness/orchestrator/src/db/sessions.ts`
- Each iteration links to the parent session via `session_id` FK
- `iteration_number` is sequential (1, 2, 3...)
- Session `total_iterations` and `current_iteration` are updated after each log
- Iteration statuses: `running`, `completed`, `failed`, `qa_pending`, `qa_passed`, `qa_failed`

### 5. Query and Retrieval

- Task is retrievable by both `id` and `display_id` via `getTask()` / `getTaskByDisplayId()`
- Sessions for a task are retrievable via `getSessionsByTask(taskId)`
- Session with all iterations is retrievable via `getSessionWithIterations(sessionId)`

---

## Technical Design

### Database Tables Involved

```
tasks (primary)
  └─ agent_sessions (FK: task_id → tasks.id)
       └─ iteration_logs (FK: session_id → agent_sessions.id, CASCADE DELETE)
```

### Data Flow

```
1. createTask({ display_id, title, category, priority })
   → INSERT INTO tasks → returns Task record

2. createSession(agentId, taskId)
   → INSERT INTO agent_sessions (status='running')
   → returns AgentSession record

3. logIteration(sessionId, iterationNumber, data)
   → INSERT INTO iteration_logs
   → UPDATE agent_sessions (total_iterations++, current_iteration=N)
   → returns IterationLog record

4. updateSessionStatus(sessionId, 'completed')
   → UPDATE agent_sessions (status, completed_at)
```

### Key Interfaces

**Task** (`parent-harness/orchestrator/src/db/tasks.ts:4-27`):
- `id: string` (UUID)
- `display_id: string`
- `title: string`
- `category: string | null`
- `status: 'pending' | 'in_progress' | 'pending_verification' | 'completed' | 'failed' | 'blocked'`
- `priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'`

**AgentSession** (`parent-harness/orchestrator/src/db/sessions.ts:4-16`):
- `id: string` (UUID)
- `agent_id: string` (FK → agents)
- `task_id: string | null` (FK → tasks)
- `status: 'running' | 'completed' | 'failed' | 'paused' | 'terminated'`
- `current_iteration: number`
- `total_iterations: number`

**IterationLog** (`parent-harness/orchestrator/src/db/sessions.ts:18-28`):
- `id: string` (UUID)
- `session_id: string` (FK → agent_sessions)
- `iteration_number: number`
- `status: 'running' | 'completed' | 'failed' | 'qa_pending' | 'qa_passed' | 'qa_failed'`

---

## Pass Criteria

**PASS** when ALL of the following are true:

| #   | Criterion                                                  | How to Verify                                                                                   |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Task created with `test_task_session_*` display_id         | `getTaskByDisplayId('test_task_session_...')` returns a valid Task                               |
| 2   | Task title is `"Test Task for Session"`                    | `task.title === 'Test Task for Session'`                                                        |
| 3   | Task category is `"test"`                                  | `task.category === 'test'`                                                                      |
| 4   | Session created and linked to task                         | `createSession(agentId, task.id)` returns AgentSession with matching `task_id`                  |
| 5   | Session initial status is `"running"`                      | `session.status === 'running'`                                                                  |
| 6   | Session retrieval by task works                            | `getSessionsByTask(task.id)` returns array containing the session                               |
| 7   | Iteration logged under session                             | `logIteration(session.id, 1, {...})` returns IterationLog with `session_id === session.id`       |
| 8   | Session iteration count updates                            | After logIteration, `getSession(session.id).total_iterations >= 1`                              |
| 9   | Session completes with timestamp                           | `updateSessionStatus(id, 'completed')` → `session.completed_at` is non-null                    |
| 10  | FK constraints enforced                                    | Creating session with invalid `agent_id` or `task_id` throws constraint error                   |

**FAIL** if any criterion is not met.

---

## Dependencies

### Depends On
- `agents` table must have at least one valid agent record (for session FK)
- `tasks` table schema must be migrated
- `agent_sessions` table schema must be migrated
- `iteration_logs` table schema must be migrated

### Affects
- E2E validation suite (`parent-harness/orchestrator/tests/e2e/honest-validation.test.ts`)
- Recovery SQL fixtures (`parent-harness/data/recovery.sql`)
- Dashboard Sessions page (`parent-harness/dashboard/src/pages/Sessions.tsx`)

---

## File Impacts

| File Path                                          | Operation | Confidence | Source        |
| -------------------------------------------------- | --------- | ---------- | ------------- |
| `parent-harness/orchestrator/src/db/tasks.ts`      | READ      | 1.0        | validated     |
| `parent-harness/orchestrator/src/db/sessions.ts`   | READ      | 1.0        | validated     |
| `parent-harness/database/schema.sql`               | READ      | 1.0        | validated     |
| `parent-harness/orchestrator/tests/e2e/honest-validation.test.ts` | READ | 0.95 | pattern_match |

---

## Validation

```bash
# Run the e2e validation test that exercises the full task-session lifecycle
cd parent-harness && npx vitest run tests/e2e/honest-validation.test.ts

# Verify task CRUD functions compile
cd parent-harness && npx tsc --noEmit orchestrator/src/db/tasks.ts

# Verify session CRUD functions compile
cd parent-harness && npx tsc --noEmit orchestrator/src/db/sessions.ts
```

---

## Gotchas

- `task_list_id` can be `null` for test tasks — the FK constraint allows it
- Session `completed_at` is only set for terminal states (`completed`, `failed`, `terminated`) — not for `paused`
- `iteration_logs` has `ON DELETE CASCADE` from `agent_sessions` — deleting a session removes all its iterations
- The `display_id` timestamp suffix makes each test task unique — do not reuse display IDs across test runs
- `logIteration()` accepts detailed parameters (tokensInput, cost, etc.) but only persists `id`, `session_id`, `iteration_number`, and `status` to the database — other fields are for future use

---

## Open Questions

1. **Test isolation**: Should test tasks be cleaned up after test runs, or kept for debugging? Currently they persist in `recovery.sql`.
2. **Wave/lane support**: The `agent_sessions` schema supports `run_id`, `wave_number`, and `lane_id` fields — should test tasks exercise parallel execution paths?
3. **Parent sessions**: The `parent_session_id` field supports nested sessions — should test tasks validate recursive session creation?
