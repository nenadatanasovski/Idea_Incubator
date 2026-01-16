# Build Agent E2E Test Plan

> **Parent Document:** [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md)
> **Created:** 2026-01-13
> **Purpose:** End-to-end test scenarios for Build Agent validation
> **Status:** Ready for Execution

---

## Overview

This test plan covers comprehensive E2E scenarios that exercise the full Build Agent pipeline: Task Agent orchestration, Telegram integration, parallel execution, and task list completion by Build Agent loops.

**Total Test Flows:** 13

- **P0 (Critical Blockers):** Tests 11-13 - Must pass before other tests can succeed
- **P1 (Must Have):** Tests 1-7 - Core functionality
- **P2 (Should Have):** Tests 8-10 - Advanced features

---

## Prerequisites

### System Setup

- [ ] SQLite database created with all migrations (070-076)
- [ ] Task Agent service running (`npm run dev`)
- [ ] Build Agent Python environment ready
- [ ] Telegram bot connected and verified
- [ ] WebSocket server running on port 3001
- [ ] Test data seeded (projects, ideas, task lists)

### Test Environment

```bash
# Verify services
curl http://localhost:3001/api/health  # Should return { status: 'ok' }
curl http://localhost:3001/api/task-agent/agents  # Should return []

# Verify database
sqlite3 database/ideas.db "SELECT COUNT(*) FROM tasks"
sqlite3 database/ideas.db "SELECT COUNT(*) FROM build_agent_instances"
```

### Test Data Seed

```sql
-- Seed test user
INSERT INTO users (id, slug, name, telegram_chat_id)
VALUES ('test-user-ba', 'BA-TEST', 'Build Agent Tester', 'YOUR_TELEGRAM_CHAT_ID');

-- Seed test project
INSERT INTO projects (id, slug, name, owner_id)
VALUES ('test-proj-ba', 'BATEST', 'Build Agent Test Project', 'test-user-ba');

-- Seed test idea
INSERT INTO ideas (id, slug, project_id, name)
VALUES ('test-idea-ba', 'build-agent-test', 'test-proj-ba', 'Build Agent Test Idea');
```

---

## Test Flow 1: Single Task Execution (Happy Path)

**Priority:** P1 (Must Have)
**Duration:** ~10 minutes
**Validates:** Basic PIV loop, single Build Agent spawn, task completion

### Scenario

Create a single-task list, trigger execution via Telegram, verify Build Agent completes the task.

### Steps

| Step | Action                               | Expected Result                    | Pass Definition                                                                                        |
| ---- | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1.1  | Create task via API                  | Task created with `pending` status | `SELECT * FROM tasks WHERE id = ?` returns 1 row with `status = 'pending'`                             |
| 1.2  | Create task list with single task    | Task list created, task linked     | `SELECT COUNT(*) FROM task_list_items WHERE task_list_id = ?` returns 1                                |
| 1.3  | Set task list status to `active`     | Ready for execution                | `SELECT status FROM task_lists_v2 WHERE id = ?` returns `'active'`                                     |
| 1.4  | Telegram: Send `/suggest`            | Receive task list suggestion       | Message contains task list name and [Execute Now] button                                               |
| 1.5  | Telegram: Click [Execute Now]        | Execution starts                   | `SELECT COUNT(*) FROM build_agent_instances WHERE status = 'running'` returns 1                        |
| 1.6  | Wait for completion (~30s)           | Build Agent completes              | `SELECT status FROM build_agent_instances WHERE execution_id = ?` returns `'completed'`                |
| 1.7  | Verify task status                   | Task marked complete               | `SELECT status FROM tasks WHERE id = ?` returns `'completed'`                                          |
| 1.8  | Verify execution log                 | Log entries created                | `SELECT COUNT(*) FROM task_execution_log WHERE execution_id = ?` >= 3 (started, completed, validation) |
| 1.9  | Telegram: Receive completion message | Summary with results               | Message contains "completed" and task title                                                            |

### Test Task

```json
{
  "id": "TU-BATEST-FEA-001",
  "title": "Create test utility function",
  "description": "Create a simple utility function in utils/test-helper.ts",
  "category": "feature",
  "action": "CREATE",
  "file": "utils/test-helper.ts",
  "requirements": ["Export function testHelper() that returns 'test'"],
  "validation": {
    "command": "npx tsc --noEmit",
    "expected": "exit code 0"
  },
  "code_template": "export function testHelper(): string {\n  return 'test';\n}"
}
```

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Build Agent instance created (build_agent_instances row)
  - [ ] Task status changed: pending → in_progress → completed
  - [ ] Execution log has entries for: task_started, task_completed
  - [ ] Validation command returned exit code 0
  - [ ] File created: utils/test-helper.ts
  - [ ] Telegram completion message received
  - [ ] Build Agent status is 'completed'
  - [ ] Total execution time < 60 seconds
```

---

## Test Flow 2: Multi-Task Sequential Execution

**Priority:** P1 (Must Have)
**Duration:** ~15 minutes
**Validates:** Task ordering, dependency resolution, sequential execution

### Scenario

Create a task list with 3 dependent tasks (A → B → C), verify correct execution order.

### Steps

| Step | Action                                  | Expected Result         | Pass Definition                                                                                                              |
| ---- | --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | Create Task A (database migration)      | Task created            | Row in `tasks` table                                                                                                         |
| 2.2  | Create Task B (types, depends on A)     | Task blocked by A       | `status = 'blocked'`, dependency in `task_relationships`                                                                     |
| 2.3  | Create Task C (API route, depends on B) | Task blocked by B       | `status = 'blocked'`, dependency in `task_relationships`                                                                     |
| 2.4  | Create task list with all 3 tasks       | List created            | 3 rows in `task_list_items`                                                                                                  |
| 2.5  | Start execution                         | Build Agent spawns      | Instance in `build_agent_instances`                                                                                          |
| 2.6  | Observe Task A execution                | A completes, B unblocks | `SELECT status FROM tasks WHERE id = 'A'` = 'completed' AND B status changes to 'pending'                                    |
| 2.7  | Observe Task B execution                | B completes, C unblocks | B completed, C becomes pending                                                                                               |
| 2.8  | Observe Task C execution                | C completes             | All 3 tasks completed                                                                                                        |
| 2.9  | Verify execution order in log           | A before B before C     | `SELECT task_id, timestamp FROM task_execution_log WHERE event_type = 'task_started' ORDER BY timestamp` shows A, B, C order |

### Test Tasks

```json
{
  "taskA": {
    "id": "TU-BATEST-INF-001",
    "title": "Create users migration",
    "action": "CREATE",
    "file": "database/migrations/test_001_users.sql",
    "phase": "database",
    "dependencies": []
  },
  "taskB": {
    "id": "TU-BATEST-INF-002",
    "title": "Create User type",
    "action": "CREATE",
    "file": "types/test-user.ts",
    "phase": "types",
    "dependencies": ["TU-BATEST-INF-001"]
  },
  "taskC": {
    "id": "TU-BATEST-INF-003",
    "title": "Create users API route",
    "action": "CREATE",
    "file": "server/routes/test-users.ts",
    "phase": "api",
    "dependencies": ["TU-BATEST-INF-002"]
  }
}
```

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] All 3 tasks created with correct dependencies
  - [ ] Dependency chain correctly blocks B and C initially
  - [ ] Task A executes first
  - [ ] Task B unblocks after A completes
  - [ ] Task C unblocks after B completes
  - [ ] Execution log timestamps show correct order
  - [ ] All 3 files created
  - [ ] All validation commands pass
  - [ ] Total execution time < 120 seconds
```

---

## Test Flow 3: Parallel Execution (Wave-Based)

**Priority:** P1 (Must Have)
**Duration:** ~20 minutes
**Validates:** Parallel Build Agent spawning, wave calculation, concurrent execution

### Scenario

Create a task list with 4 tasks where 2 can run in parallel (no file conflicts), verify 2 Build Agents spawn for Wave 0.

### Steps

| Step | Action                                                              | Expected Result              | Pass Definition                                                                                                   |
| ---- | ------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 3.1  | Create 4 tasks: A, B (parallel), C (depends on A), D (depends on B) | Tasks created                | 4 rows in `tasks`                                                                                                 |
| 3.2  | Set file impacts: A=file1.ts, B=file2.ts, C=file1.ts, D=file2.ts    | No conflict between A and B  | `SELECT * FROM task_file_impacts` shows distinct files for A, B                                                   |
| 3.3  | Trigger parallelism analysis                                        | Wave calculation             | `SELECT * FROM parallelism_analysis WHERE can_parallel = 1 AND task_a_id = 'A' AND task_b_id = 'B'` returns 1 row |
| 3.4  | Create task list, start execution                                   | Multiple Build Agents spawn  | `SELECT COUNT(*) FROM build_agent_instances WHERE wave_number = 0` returns 2                                      |
| 3.5  | Observe Wave 0                                                      | A and B execute concurrently | Both tasks complete with overlapping timestamps                                                                   |
| 3.6  | Observe Wave 1                                                      | C and D execute after Wave 0 | Wave 1 starts only after Wave 0 completes                                                                         |
| 3.7  | Verify wave completion                                              | All waves done               | `SELECT status FROM parallel_execution_waves WHERE execution_id = ?` all 'completed'                              |

### Test Tasks

```json
{
  "taskA": {
    "id": "TU-BATEST-PAR-001",
    "file": "features/feature-a.ts",
    "dependencies": []
  },
  "taskB": {
    "id": "TU-BATEST-PAR-002",
    "file": "features/feature-b.ts",
    "dependencies": []
  },
  "taskC": {
    "id": "TU-BATEST-PAR-003",
    "file": "features/feature-a.ts",
    "dependencies": ["TU-BATEST-PAR-001"]
  },
  "taskD": {
    "id": "TU-BATEST-PAR-004",
    "file": "features/feature-b.ts",
    "dependencies": ["TU-BATEST-PAR-002"]
  }
}
```

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Wave 0 contains tasks A and B
  - [ ] Wave 1 contains tasks C and D
  - [ ] 2 Build Agent instances spawn for Wave 0
  - [ ] A and B have overlapping execution times (started_at to completed_at)
  - [ ] Wave 1 starts only after Wave 0 status = 'completed'
  - [ ] All 4 tasks complete successfully
  - [ ] No file lock conflicts (no 'FILE_LOCK_CONFLICT' errors in log)
  - [ ] Total execution time < parallel threshold (< sequential time)
```

---

## Test Flow 4: Failure and Retry

**Priority:** P1 (Must Have)
**Duration:** ~15 minutes
**Validates:** Task failure detection, retry logic, checkpoint rollback

### Scenario

Create a task that fails validation, verify retry attempts and proper rollback.

### Steps

| Step | Action                              | Expected Result         | Pass Definition                                                                                                       |
| ---- | ----------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Create task with failing validation | Task created            | Row in `tasks` table                                                                                                  |
| 4.2  | Start execution                     | Build Agent starts      | Instance created                                                                                                      |
| 4.3  | Task fails validation               | Retry triggered         | `SELECT COUNT(*) FROM task_execution_log WHERE task_id = ? AND event_type = 'task_failed'` = 1                        |
| 4.4  | Checkpoint restored                 | Git reset to checkpoint | `SELECT event_type FROM task_execution_log WHERE task_id = ? ORDER BY timestamp DESC LIMIT 1` = 'checkpoint_restored' |
| 4.5  | Retry attempt 2                     | Second failure          | 2 failure entries in log                                                                                              |
| 4.6  | Retry attempt 3                     | Third failure           | 3 failure entries in log                                                                                              |
| 4.7  | Max retries exceeded                | Task marked failed      | `SELECT status FROM tasks WHERE id = ?` = 'failed'                                                                    |
| 4.8  | Telegram notification               | Failure alert received  | Message contains "failed" and error details                                                                           |

### Test Task

```json
{
  "id": "TU-BATEST-FAIL-001",
  "title": "Task designed to fail",
  "action": "CREATE",
  "file": "test/intentional-fail.ts",
  "validation": {
    "command": "exit 1",
    "expected": "exit code 0"
  }
}
```

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] 3 retry attempts logged (task_failed events)
  - [ ] Checkpoint created before task execution
  - [ ] Checkpoint restored after each failure
  - [ ] Task status changed to 'failed' after max retries
  - [ ] consecutive_failures counter reached 3
  - [ ] Telegram failure notification received
  - [ ] No partial/corrupted file left after rollback
  - [ ] Build Agent status is 'failed' (not 'stuck' for this test)
```

---

## Test Flow 5: SIA Escalation (Stuck Detection)

**Priority:** P1 (Must Have)
**Duration:** ~20 minutes
**Validates:** Stuck detection, SIA escalation, "no progress" detection

### Scenario

Create a task that fails repeatedly with the same error (no progress), verify SIA escalation.

### Steps

| Step | Action                              | Expected Result      | Pass Definition                                                                       |
| ---- | ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| 5.1  | Create task with consistent failure | Task created         | Row in `tasks` table                                                                  |
| 5.2  | Start execution                     | Build Agent starts   | Instance created                                                                      |
| 5.3  | Task fails 3 times with same error  | No progress detected | All 3 `task_failed` entries have identical error messages                             |
| 5.4  | Build Agent marks itself stuck      | Status change        | `SELECT status FROM build_agent_instances WHERE id = ?` = 'stuck'                     |
| 5.5  | `build.stuck` event published       | Event in message bus | Event payload contains `consecutive_failures: 3`                                      |
| 5.6  | Task Agent receives event           | SIA spawn decision   | `SELECT * FROM task_execution_log WHERE event_type = 'info' AND message LIKE '%SIA%'` |
| 5.7  | Telegram escalation message         | Human notified       | Message contains "stuck", "SIA", error context                                        |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] 3+ consecutive failures logged
  - [ ] Same error message in all failures (no progress)
  - [ ] Build Agent status = 'stuck' (not just 'failed')
  - [ ] `build.stuck` event published
  - [ ] Failure context includes last 500 log lines
  - [ ] SIA escalation triggered (or human notification if SIA not implemented)
  - [ ] Telegram message received with escalation details
```

---

## Test Flow 6: Heartbeat and Health Monitoring

**Priority:** P1 (Must Have)
**Duration:** ~5 minutes
**Validates:** Heartbeat publishing, stale agent detection

### Scenario

Start a Build Agent, verify heartbeats are published, simulate stale agent.

### Steps

| Step | Action                                       | Expected Result            | Pass Definition                                                                                            |
| ---- | -------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 6.1  | Start Build Agent with long task             | Agent running              | Instance with status = 'running'                                                                           |
| 6.2  | Wait 30 seconds                              | Heartbeat published        | `SELECT COUNT(*) FROM agent_heartbeats WHERE instance_id = ?` >= 1                                         |
| 6.3  | Wait another 30 seconds                      | Second heartbeat           | Count >= 2                                                                                                 |
| 6.4  | Verify heartbeat content                     | Status and task_id present | `SELECT status, current_task_id FROM agent_heartbeats ORDER BY timestamp DESC LIMIT 1` has non-null values |
| 6.5  | Manually set last_heartbeat to 2 minutes ago | Simulate stale             | Manual DB update                                                                                           |
| 6.6  | Trigger health check                         | Stale agent detected       | API or cron returns agent as stale                                                                         |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Heartbeats recorded every 30 seconds (±5s)
  - [ ] Heartbeat contains: instance_id, status, current_task_id, timestamp
  - [ ] Stale query correctly identifies agents with heartbeat > 60s old
  - [ ] Health monitoring can detect unresponsive agents
```

---

## Test Flow 7: Full Pipeline (Task Agent → Telegram → Build Agent → Completion)

**Priority:** P1 (Must Have)
**Duration:** ~30 minutes
**Validates:** Complete integration, Telegram flow, end-to-end execution

### Scenario

Create tasks via Telegram `/newtask`, let Task Agent group them, approve via Telegram, execute via Build Agents, receive completion summary.

### Steps

| Step | Action                                 | Expected Result              | Pass Definition                                                           |
| ---- | -------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| 7.1  | Telegram: `/newtask Create user model` | Task in Evaluation Queue     | `SELECT queue FROM tasks WHERE title LIKE '%user model%'` = 'evaluation'  |
| 7.2  | Telegram: `/newtask Create user API`   | Second task in queue         | Queue count = 2                                                           |
| 7.3  | Telegram: `/newtask Add user tests`    | Third task                   | Queue count = 3                                                           |
| 7.4  | Wait for grouping suggestion           | Suggestion generated         | `SELECT COUNT(*) FROM grouping_suggestions WHERE status = 'pending'` >= 1 |
| 7.5  | Telegram: Accept grouping              | Task list created            | `SELECT COUNT(*) FROM task_lists_v2` increased by 1                       |
| 7.6  | Telegram: `/suggest`                   | Receive task list suggestion | Message shows grouped tasks                                               |
| 7.7  | Telegram: Click [Execute Now]          | Execution starts             | Build Agents spawn                                                        |
| 7.8  | Monitor progress                       | Progress updates in Telegram | Receive "Task X started", "Task X completed" messages                     |
| 7.9  | All tasks complete                     | Summary received             | Message contains all 3 task completions                                   |
| 7.10 | Verify database state                  | All complete                 | All tasks status = 'completed', task list status = 'completed'            |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] `/newtask` creates tasks in Evaluation Queue
  - [ ] Task Agent generates grouping suggestion
  - [ ] Grouping creates task list with correct tasks
  - [ ] Telegram suggestion shows task list details
  - [ ] Build Agents spawn on [Execute Now]
  - [ ] Progress messages received for each task
  - [ ] All 3 tasks complete successfully
  - [ ] Completion summary accurate
  - [ ] Database state consistent (all statuses correct)
  - [ ] Execution run recorded in task_list_execution_runs
```

---

## Test Flow 8: Cross-List File Conflict Prevention

**Priority:** P2 (Should Have)
**Duration:** ~15 minutes
**Validates:** File conflict detection across task lists

### Scenario

Create two task lists with tasks that modify the same file, verify conflict detection prevents parallel execution.

### Steps

| Step | Action                                        | Expected Result    | Pass Definition                                                     |
| ---- | --------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| 8.1  | Create List A with task modifying `shared.ts` | List A active      | Row in `task_lists_v2`                                              |
| 8.2  | Create List B with task modifying `shared.ts` | List B active      | Row in `task_lists_v2`                                              |
| 8.3  | Start List A execution                        | Build Agent spawns | Instance running                                                    |
| 8.4  | Attempt to start List B                       | Blocked or queued  | Either warning message OR List B waits for A                        |
| 8.5  | List A completes                              | File lock released | `SELECT COUNT(*) FROM file_locks WHERE file_path = 'shared.ts'` = 0 |
| 8.6  | List B can now execute                        | Proceeds           | Build Agent spawns for List B                                       |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] File conflict detected between List A and List B
  - [ ] Lists do NOT execute simultaneously on same file
  - [ ] Either: warning message OR automatic queuing
  - [ ] After List A completes, List B can proceed
  - [ ] No file corruption from concurrent modification
```

---

## Test Flow 9: Discovery Recording and Knowledge Base

**Priority:** P2 (Should Have)
**Duration:** ~15 minutes
**Validates:** Gotcha extraction, Knowledge Base recording

### Scenario

Execute tasks, verify discoveries are recorded in Knowledge Base.

### Steps

| Step | Action                                  | Expected Result    | Pass Definition                                                                                |
| ---- | --------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| 9.1  | Execute task that follows a pattern     | Task completes     | Status = 'completed'                                                                           |
| 9.2  | Check for discovery                     | Discovery recorded | `SELECT COUNT(*) FROM knowledge WHERE source_task_id = ?` >= 1 OR discoveries in execution log |
| 9.3  | Query Knowledge Base for file pattern   | Gotcha returned    | Query returns relevant gotchas                                                                 |
| 9.4  | Execute new task with same file pattern | Gotchas injected   | Task execution includes gotchas from step 9.3                                                  |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Discovery extracted from successful task
  - [ ] Discovery recorded in Knowledge Base
  - [ ] Discovery has: type, content, file_pattern, confidence
  - [ ] Subsequent tasks receive relevant gotchas
```

---

## Test Flow 10: Checkpoint Rollback Verification

**Priority:** P2 (Should Have)
**Duration:** ~10 minutes
**Validates:** Checkpoint creation, git rollback correctness

### Scenario

Execute a task, fail it, verify exact file state restoration.

### Steps

| Step | Action                             | Expected Result        | Pass Definition                     |
| ---- | ---------------------------------- | ---------------------- | ----------------------------------- |
| 10.1 | Create known file state (or empty) | Initial state recorded | Git SHA or file hash                |
| 10.2 | Start task execution               | Checkpoint created     | Row in `checkpoints` table          |
| 10.3 | Task modifies file                 | File changed           | File content different              |
| 10.4 | Force task failure                 | Rollback triggered     | `checkpoint_restored` event         |
| 10.5 | Verify file state                  | Matches initial        | File content identical to step 10.1 |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Checkpoint created with git_ref
  - [ ] File modified during task execution
  - [ ] Rollback restores exact previous state
  - [ ] No orphan files left from failed task
  - [ ] Git working tree clean after rollback
```

---

## Test Flow 11: Telegram /execute Command Flow (Critical)

**Priority:** P0 (Critical Blocker)
**Duration:** ~20 minutes
**Validates:** Telegram → Task Agent → Build Agent trigger flow

### Scenario

User sends `/execute <task_list_id>` via Telegram, receives approval message, confirms, and execution starts.

### Steps

| Step | Action                                               | Expected Result     | Pass Definition                                                          |
| ---- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| 11.1 | Telegram: Send `/execute` (no args)                  | Usage help shown    | Message contains "Usage:" and example                                    |
| 11.2 | Telegram: Send `/execute invalid-id`                 | Error: not found    | Message contains "not found"                                             |
| 11.3 | Telegram: Send `/execute <valid_task_list_id>`       | Approval message    | Message shows task count, [Start] [Cancel] buttons                       |
| 11.4 | Telegram: Click [Cancel]                             | Execution cancelled | Message: "Execution cancelled"                                           |
| 11.5 | Telegram: Send `/execute <valid_task_list_id>` again | Approval message    | Same as 11.3                                                             |
| 11.6 | Telegram: Click [Start]                              | Execution begins    | Build Agents spawn, task list status = 'in_progress'                     |
| 11.7 | Verify agents spawned                                | Agents in database  | `SELECT COUNT(*) FROM build_agent_instances WHERE task_list_id = ?` >= 1 |
| 11.8 | Wait for task completion                             | Progress messages   | At least 1 "Task X completed" message received                           |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] `/execute` without args shows usage
  - [ ] Invalid task list ID returns error
  - [ ] Valid task list shows approval message with buttons
  - [ ] [Cancel] stops execution from starting
  - [ ] [Start] spawns Build Agents
  - [ ] Task list status changes to 'in_progress'
  - [ ] Build Agent instances created in database
```

---

## Test Flow 12: Python Worker Execution (Critical)

**Priority:** P0 (Critical Blocker)
**Duration:** ~15 minutes
**Validates:** Python Build Agent worker exists and executes tasks

### Scenario

Directly run the Python worker with task parameters, verify it loads task, executes, and exits correctly.

### Prerequisites

```bash
# Verify Python worker file exists
ls -la coding-loops/agents/build_agent_worker.py

# Verify required Python dependencies
python3 -c "import sqlite3, anthropic, argparse; print('OK')"
```

### Steps

| Step | Action                       | Expected Result    | Pass Definition                                                 |
| ---- | ---------------------------- | ------------------ | --------------------------------------------------------------- |
| 12.1 | Create test task in database | Task row exists    | `SELECT * FROM tasks WHERE id = ?` returns 1 row                |
| 12.2 | Run worker with `--help`     | Help text shown    | Output contains `--agent-id`, `--task-id`, `--task-list-id`     |
| 12.3 | Run worker with valid args   | Worker starts      | No immediate crash, stdout shows "Starting Build Agent"         |
| 12.4 | Observe heartbeat            | Heartbeat recorded | `SELECT COUNT(*) FROM agent_heartbeats WHERE agent_id = ?` >= 1 |
| 12.5 | Worker completes task        | File created       | Target file exists at `task.file` path                          |
| 12.6 | Worker exits                 | Exit code 0        | `echo $?` returns 0                                             |
| 12.7 | Verify task status           | Status updated     | `SELECT status FROM tasks WHERE id = ?` = 'completed'           |

### Test Command

```bash
# Create test task first, then:
python3 coding-loops/agents/build_agent_worker.py \
  --agent-id test-agent-001 \
  --task-id <test_task_id> \
  --task-list-id <test_task_list_id>
```

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] Worker file exists at correct path
  - [ ] Worker accepts CLI arguments
  - [ ] Worker connects to database
  - [ ] Worker sends heartbeats every 30s
  - [ ] Worker loads task from database
  - [ ] Worker executes task (creates/modifies file)
  - [ ] Worker runs validation command
  - [ ] Worker exits with code 0 on success
  - [ ] Task status updated to 'completed'
```

### Negative Test: Worker Failure

| Step  | Action                              | Expected Result   | Pass Definition                                    |
| ----- | ----------------------------------- | ----------------- | -------------------------------------------------- |
| 12.N1 | Create task with failing validation | Task exists       | Validation command = `exit 1`                      |
| 12.N2 | Run worker                          | Worker starts     | No crash                                           |
| 12.N3 | Worker fails                        | Exit non-zero     | `echo $?` != 0                                     |
| 12.N4 | Error in stderr                     | Error logged      | stderr contains error message                      |
| 12.N5 | Task status                         | Status = 'failed' | `SELECT status FROM tasks WHERE id = ?` = 'failed' |

---

## Test Flow 13: Completion Feedback Loop (Critical)

**Priority:** P0 (Critical Blocker)
**Duration:** ~10 minutes
**Validates:** Task completion triggers Telegram notification

### Scenario

Execute a task, verify completion triggers Telegram notification back to user.

### Steps

| Step | Action                         | Expected Result               | Pass Definition                                               |
| ---- | ------------------------------ | ----------------------------- | ------------------------------------------------------------- |
| 13.1 | Start execution via `/execute` | Execution starts              | Build Agents spawn                                            |
| 13.2 | Task starts                    | "Task started" notification   | Telegram receives message with task title                     |
| 13.3 | Task completes                 | "Task completed" notification | Telegram receives message with task title and "completed"     |
| 13.4 | Create failing task            | Task added                    | Task with `exit 1` validation                                 |
| 13.5 | Task fails                     | "Task failed" notification    | Telegram receives message with error details                  |
| 13.6 | All tasks done                 | Summary notification          | Telegram receives "Execution complete: N completed, M failed" |
| 13.7 | Verify summary accuracy        | Counts match                  | Summary counts match actual task statuses                     |

### Pass Criteria

```
✅ PASS if ALL conditions met:
  - [ ] "Task started" notifications sent
  - [ ] "Task completed" notifications sent
  - [ ] "Task failed" notifications include error message
  - [ ] Summary notification sent when all tasks done
  - [ ] Summary counts are accurate
  - [ ] Notifications reach correct Telegram chat
```

---

## Test Execution Summary

### Automated Test Script Location

```
tests/e2e/build-agent-e2e.test.ts
```

### Run All Tests

```bash
# Run full E2E suite
npm run test:e2e -- --grep "Build Agent"

# Run specific test flow
npm run test:e2e -- --grep "Test Flow 7"

# Run with verbose output
DEBUG=build-agent:* npm run test:e2e -- --grep "Build Agent"
```

### Test Data Cleanup

```sql
-- After testing, clean up test data
DELETE FROM tasks WHERE id LIKE 'TU-BATEST-%';
DELETE FROM task_lists_v2 WHERE name LIKE '%Build Agent Test%';
DELETE FROM build_agent_instances WHERE execution_id LIKE '%test%';
DELETE FROM task_execution_log WHERE execution_id LIKE '%test%';
DELETE FROM knowledge WHERE source_task_id LIKE 'TU-BATEST-%';
```

---

## Success Criteria

### Litmus Test Definition

```
✅ BUILD AGENT LITMUS TEST PASSES IF:

P0 Tests (CRITICAL BLOCKERS - must pass FIRST):
  - [ ] Test Flow 11: Telegram /execute Command Flow
  - [ ] Test Flow 12: Python Worker Execution
  - [ ] Test Flow 13: Completion Feedback Loop

P1 Tests (ALL must pass):
  - [ ] Test Flow 1: Single Task Execution
  - [ ] Test Flow 2: Multi-Task Sequential Execution
  - [ ] Test Flow 3: Parallel Execution (Wave-Based)
  - [ ] Test Flow 4: Failure and Retry
  - [ ] Test Flow 5: SIA Escalation
  - [ ] Test Flow 6: Heartbeat and Health Monitoring
  - [ ] Test Flow 7: Full Pipeline (Task Agent → Telegram → Build Agent)

P2 Tests (at least 2 of 3 must pass):
  - [ ] Test Flow 8: Cross-List File Conflict Prevention
  - [ ] Test Flow 9: Discovery Recording
  - [ ] Test Flow 10: Checkpoint Rollback Verification

Overall Requirements:
  - [ ] No critical errors in server logs
  - [ ] All Telegram messages received correctly
  - [ ] Database consistency verified (no orphan records)
  - [ ] Total test duration < 2 hours

⚠️ EXECUTION ORDER:
  Run P0 tests FIRST - if any fail, the rest cannot pass.
  P0 tests verify the critical E2E flow components exist.
```

---

## Related Documents

- [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md) - Implementation details
- [BUILD-AGENT-APPENDIX-C-PYTHON.md](./BUILD-AGENT-APPENDIX-C-PYTHON.md) - Python implementation
- [task-agent-test-plan.md](../architecture/task-agent-test-plan.md) - Task Agent tests
- [PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) - Parallel execution
