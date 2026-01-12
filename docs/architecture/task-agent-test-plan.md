# Task Agent Test Plan

**Created:** 2026-01-12
**Purpose:** Human-in-the-loop test scenarios for Task Agent validation
**Status:** Ready for Execution

---

## Overview

This test plan covers all 10 test flows identified in Q13, with detailed scenarios for human validation. Each test requires the user to interact via Telegram and verify the Task Agent's behavior.

---

## Prerequisites

### System Setup
- [ ] SQLite database created with task-data-model.md schema
- [ ] Task Agent service running
- [ ] Telegram bot connected and verified
- [ ] Build Agent integration complete
- [ ] Test data seeded (projects, ideas, sample tasks)

### Test Environment
- [ ] Test project created: `test-project`
- [ ] Test idea created: `task-agent-test`
- [ ] Telegram chat linked to test user
- [ ] WebSocket connection verified
- [ ] API endpoints accessible

### Test Data

```sql
-- Seed test user
INSERT INTO users (id, slug, name, telegram_chat_id)
VALUES ('test-user-1', 'TU', 'Test User', 'TELEGRAM_CHAT_ID');

-- Seed test project
INSERT INTO projects (id, slug, name, owner_id)
VALUES ('test-proj-1', 'TEST', 'Test Project', 'test-user-1');

-- Seed test idea
INSERT INTO ideas (id, slug, project_id, name)
VALUES ('test-idea-1', 'task-agent-test', 'test-proj-1', 'Task Agent Test');
```

---

## Test Flow 1: Task Creation → Validation → Approval → Execution → Completion

**Priority:** P1 (Must Have)
**Duration:** ~15 minutes

### Scenario

Create a new task, validate it, get approval, execute via Build Agent, and mark complete.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 1.1 | Create task via API | Task created in DB with `draft` status | [ ] Task appears in DB |
| 1.2 | Add acceptance criteria | Criteria stored | [ ] Criteria visible in task details |
| 1.3 | Add codebase tests | Tests stored | [ ] Tests visible |
| 1.4 | Call `/api/tasks/:id/validate` | Validation runs, status → `pending` | [ ] No blocking issues |
| 1.5 | Telegram: Receive suggestion | Task Agent suggests this task list | [ ] Message received with buttons |
| 1.6 | Telegram: Click [Execute Now] | Task list execution starts | [ ] Build Agent spawned |
| 1.7 | Observe Build Agent execution | Tasks executed, tests run | [ ] Progress updates in Telegram |
| 1.8 | Build Agent completes | Status → `completed` | [ ] Completion message in Telegram |

### Test Task

```json
{
  "id": "TU-TEST-FEA-001",
  "title": "Create test endpoint",
  "description": "Create a simple GET /api/test endpoint that returns { status: 'ok' }",
  "category": "feature",
  "acceptanceCriteria": ["Endpoint returns 200", "Response is JSON"],
  "codebaseTests": ["npx tsc --noEmit passes"],
  "apiTests": ["GET /api/test returns 200 with { status: 'ok' }"]
}
```

### Expected Telegram Interaction

```
📋 SUGGESTED NEXT ACTION

I recommend executing task list: **Test Feature**
"Create test endpoint"

📊 Why: Only ready task, no blockers
⚠️ Risk: Low (creates new files only)

[✅ Execute Now] [⏸️ Later] [📄 Details]
```

### Verification Checkpoints

- [ ] Task created successfully
- [ ] Validation passed
- [ ] Telegram message received
- [ ] Execution started after approval
- [ ] Build Agent executed task
- [ ] Tests passed
- [ ] Task marked completed
- [ ] Summary message received

---

## Test Flow 2: Duplicate Detection → Merge Decision

**Priority:** P1 (Must Have)
**Duration:** ~10 minutes

### Scenario

Create a task similar to an existing one, verify duplicate detection, and test merge workflow.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 2.1 | Ensure existing task exists | Task in DB | [ ] Task visible |
| 2.2 | Create similar task | New task created | [ ] Task created |
| 2.3 | Trigger validation | Duplicate detected | [ ] Warning shows potential duplicate |
| 2.4 | Telegram: Receive duplicate alert | Message with merge options | [ ] Message received |
| 2.5 | Click [Merge] | Tasks merged | [ ] One task remains, other archived |

### Test Data

**Existing Task:**
```json
{
  "id": "TU-TEST-FEA-002",
  "title": "Add user authentication endpoint",
  "description": "Create POST /api/auth/login endpoint for user authentication"
}
```

**Duplicate Task:**
```json
{
  "id": "TU-TEST-FEA-003",
  "title": "Implement login API",
  "description": "Create endpoint for user login at POST /api/auth/login"
}
```

### Expected Telegram Interaction

```
🔍 POTENTIAL DUPLICATE DETECTED

New task: **Implement login API**
looks similar to: **Add user authentication endpoint**

Similarity: 87%

[🔗 Merge Them] [✂️ Keep Both] [📄 Compare]
```

### Verification Checkpoints

- [ ] Similarity score calculated
- [ ] Telegram alert received
- [ ] Merge option works
- [ ] Original task preserved
- [ ] Duplicate properly archived
- [ ] Relationships updated

---

## Test Flow 3: Task List Approval → Execution → Results Review

**Priority:** P1 (Must Have)
**Duration:** ~20 minutes

### Scenario

Create a task list with multiple tasks, get approval, execute, and review results.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 3.1 | Create task list | List created with `draft` status | [ ] List in DB |
| 3.2 | Add 3 tasks to list | Tasks linked with positions | [ ] Junction table populated |
| 3.3 | Validate all tasks | All pass validation | [ ] No blockers |
| 3.4 | Change list status to `active` | Ready for suggestion | [ ] Status updated |
| 3.5 | Telegram: Receive list suggestion | Full list summary | [ ] All tasks shown |
| 3.6 | Click [Execute Now] | Build Agent spawns | [ ] Execution starts |
| 3.7 | Monitor progress | Each task updates | [ ] Progress in Telegram |
| 3.8 | All tasks complete | List marked `completed` | [ ] Summary with results |
| 3.9 | Review detailed results | Test results accessible | [ ] Results in UI/API |

### Test Data

**Task List:**
```json
{
  "id": "list-001",
  "name": "Setup API Infrastructure",
  "description": "Create basic API structure",
  "tasks": [
    "TU-TEST-INF-001: Create routes folder",
    "TU-TEST-INF-002: Add express router",
    "TU-TEST-INF-003: Create health endpoint"
  ]
}
```

### Expected Telegram Interaction

```
📋 TASK LIST READY

**Setup API Infrastructure**
3 tasks ready for execution

1. [INF-001] Create routes folder
2. [INF-002] Add express router
3. [INF-003] Create health endpoint

⚠️ Risk: Low
⏱️ Estimated: ~15 min

[✅ Execute All] [▶️ Execute One-by-One] [📄 Details]
```

### Verification Checkpoints

- [ ] Task list created
- [ ] All tasks validated
- [ ] Suggestion received
- [ ] Execution started
- [ ] Progress updates received
- [ ] All tasks completed
- [ ] Results accessible

---

## Test Flow 4: Dependency Chain Resolution

**Priority:** P1 (Must Have)
**Duration:** ~15 minutes

### Scenario

Create tasks with dependencies, verify blocking behavior, and test automatic unblocking.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 4.1 | Create Task A (no deps) | Task A ready | [ ] Status: pending |
| 4.2 | Create Task B (depends on A) | Task B blocked | [ ] Status: blocked |
| 4.3 | Create Task C (depends on B) | Task C blocked | [ ] Status: blocked |
| 4.4 | Telegram: Check suggestions | Only Task A suggested | [ ] B and C not shown |
| 4.5 | Execute Task A | A completes | [ ] Status: completed |
| 4.6 | Telegram: Check unblock message | Task B now unblocked | [ ] Notification received |
| 4.7 | Verify Task B status | B now pending | [ ] Status changed |
| 4.8 | Execute Task B | B completes | [ ] C unblocked automatically |

### Test Data

```json
{
  "taskA": {
    "id": "TU-TEST-FEA-010",
    "title": "Create database schema",
    "dependencies": []
  },
  "taskB": {
    "id": "TU-TEST-FEA-011",
    "title": "Create data models",
    "dependencies": ["TU-TEST-FEA-010"]
  },
  "taskC": {
    "id": "TU-TEST-FEA-012",
    "title": "Create API routes using models",
    "dependencies": ["TU-TEST-FEA-011"]
  }
}
```

### Expected Telegram Interaction

```
🔓 DEPENDENCY RESOLVED

Task A completed, unblocking:
→ **Create data models** (Task B)

Task B is now ready for execution.

[▶️ Execute B Now] [📄 Show Chain]
```

### Verification Checkpoints

- [ ] Dependency chain created
- [ ] Blocked tasks not suggested
- [ ] Completion triggers unblock
- [ ] Notification sent
- [ ] Chain resolves correctly
- [ ] All tasks eventually complete

---

## Test Flow 5: Failure → Retry → Escalation

**Priority:** P1 (Must Have)
**Duration:** ~15 minutes

### Scenario

Create a task that fails, verify Build Agent retry, and test escalation.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 5.1 | Create task with failing test | Task created | [ ] Has impossible test |
| 5.2 | Execute task | Build Agent runs | [ ] Execution starts |
| 5.3 | Test fails | Build Agent retry #1 | [ ] Retry message |
| 5.4 | Test fails again | Build Agent retry #2 | [ ] Second retry |
| 5.5 | Max retries exceeded | Escalation to user | [ ] Telegram alert |
| 5.6 | Telegram: See failure details | Error info shown | [ ] Clear error message |
| 5.7 | Click [Create Fix Task] | New task created | [ ] Follow-up task |
| 5.8 | Original task marked failed | Status updated | [ ] Task failed |

### Test Data

```json
{
  "id": "TU-TEST-BUG-001",
  "title": "Task that will fail",
  "apiTests": ["GET /nonexistent returns 200"]
}
```

### Expected Telegram Interaction

```
❌ TASK FAILED AFTER RETRIES

**Task that will fail** failed validation.

Error: Test "GET /nonexistent returns 200" failed
Expected: 200
Actual: 404

Attempts: 3/3

[🔧 Create Fix Task] [🔄 Retry Manually] [❌ Mark Failed]
```

### Verification Checkpoints

- [ ] Failure detected
- [ ] Retries attempted
- [ ] Escalation triggered
- [ ] Clear error message
- [ ] Fix task option works
- [ ] Task marked failed

---

## Test Flow 6: Stale Task Notification → Action

**Priority:** P1 (Must Have)
**Duration:** ~5 minutes (after wait)

### Scenario

Create a task and let it become stale, verify notification.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 6.1 | Create task | Task in pending | [ ] Created |
| 6.2 | Set `updated_at` to 8 days ago | Artificially stale | [ ] Manual DB update |
| 6.3 | Trigger stale check | Stale detection runs | [ ] Via cron or manual |
| 6.4 | Telegram: Receive stale alert | Notification sent | [ ] Message received |
| 6.5 | Click [Take Action] | Options shown | [ ] Can execute or archive |

### Expected Telegram Interaction

```
⏰ STALE TASK DETECTED

**Create user profile page** has been inactive for 8 days.

Last activity: 2026-01-04

[▶️ Execute Now] [📅 Reschedule] [🗄️ Archive]
```

### Verification Checkpoints

- [ ] Stale detection works
- [ ] Threshold correct (7 days)
- [ ] Notification sent
- [ ] Action options work

---

## Test Flow 7: Cross-Project Dependency

**Priority:** P2 (Should Have)
**Duration:** ~15 minutes

### Scenario

Create tasks across two projects with dependencies.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 7.1 | Create Project A task | Task A in Project A | [ ] Created |
| 7.2 | Create Project B task depending on A | Task B blocked | [ ] Cross-project dep |
| 7.3 | Verify visualization | Graph shows cross-project | [ ] UI correct |
| 7.4 | Complete Task A | B unblocks | [ ] Cross-project unblock |

### Verification Checkpoints

- [ ] Cross-project dependencies work
- [ ] Graph shows both projects
- [ ] Unblocking works across projects

---

## Test Flow 8: Task Decomposition Suggestion

**Priority:** P2 (Should Have)
**Duration:** ~10 minutes

### Scenario

Create a large task, verify decomposition suggestion.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 8.1 | Create large/complex task | Task created | [ ] Effort: epic |
| 8.2 | Trigger analysis | Decomposition suggested | [ ] Suggestion message |
| 8.3 | Accept decomposition | Subtasks created | [ ] Parent-child links |

### Expected Telegram Interaction

```
📦 TASK DECOMPOSITION SUGGESTED

**Build complete authentication system** seems complex.

I suggest breaking it into:
1. Create user table migration
2. Add password hashing
3. Create login endpoint
4. Create register endpoint
5. Add JWT middleware

[✅ Create Subtasks] [❌ Keep As Is] [✏️ Modify]
```

### Verification Checkpoints

- [ ] Large task detected
- [ ] Decomposition suggested
- [ ] Subtasks created correctly
- [ ] Parent-child relationships set

---

## Test Flow 9: Telegram Command Flow

**Priority:** P2 (Should Have)
**Duration:** ~20 minutes

### Scenario

Test all Telegram commands.

### Commands to Test

| Command | Expected Result | Verified |
|---------|-----------------|----------|
| `/start` | Welcome message, verify connection | [ ] |
| `/status` | System status summary | [ ] |
| `/lists` | Show active task lists | [ ] |
| `/list <id>` | Show specific list details | [ ] |
| `/suggest` | Get next suggestion | [ ] |
| `/execute <id>` | Start execution | [ ] |
| `/pause <id>` | Pause execution | [ ] |
| `/resume <id>` | Resume execution | [ ] |
| `/questions` | Show pending questions | [ ] |
| `/answer <id> <ans>` | Submit answer | [ ] |
| `/parallel` | Show parallel opportunities | [ ] |
| `/duplicates` | Show potential duplicates | [ ] |
| `/help` | Show all commands | [ ] |

### Verification Checkpoints

- [ ] All commands respond
- [ ] Output is correct
- [ ] Error handling works
- [ ] Invalid input handled

---

## Test Flow 10: Daily Summary Review

**Priority:** P2 (Should Have)
**Duration:** ~10 minutes

### Scenario

Trigger and review daily summary.

### Steps

| Step | Action | Expected Result | Human Verification |
|------|--------|-----------------|-------------------|
| 10.1 | Ensure varied task states | Mix of pending, completed, failed | [ ] Test data ready |
| 10.2 | Trigger daily summary | Summary generated | [ ] Via API or cron |
| 10.3 | Telegram: Receive summary | Full summary message | [ ] All sections present |
| 10.4 | Verify accuracy | Counts match DB | [ ] Numbers correct |

### Expected Telegram Interaction

```
📊 DAILY SUMMARY - Jan 12, 2026

Good morning! Here's what's happening:

✅ Completed: 5 tasks
⏳ In Progress: 2 tasks
🔒 Blocked: 1 task
📋 Pending: 8 tasks

Top Priority:
1. Create auth middleware (blocks 3 others)
2. Fix login bug (deadline tomorrow)

Stale (no activity 7+ days):
- Update README (12 days)

[📋 Show Details] [▶️ Start Working]
```

### Verification Checkpoints

- [ ] Summary triggered
- [ ] All sections present
- [ ] Counts accurate
- [ ] Priority order correct
- [ ] Stale tasks listed

---

## Test Execution Checklist

### Pre-Test
- [ ] All prerequisites met
- [ ] Test data seeded
- [ ] Telegram bot verified
- [ ] Database backed up

### During Test
- [ ] Document all Telegram messages received
- [ ] Screenshot key interactions
- [ ] Note any unexpected behavior
- [ ] Record timing for each flow

### Post-Test
- [ ] All 10 flows completed
- [ ] All checkpoints verified
- [ ] Issues documented
- [ ] Results summarized

---

## Results Template

```
Test Flow: ___
Date: ___
Tester: ___

Started: ___
Completed: ___
Duration: ___

Checkpoints Passed: ___ / ___
Checkpoints Failed: ___ / ___

Issues Found:
1. ___
2. ___

Notes:
___

Overall Result: [ ] PASS [ ] FAIL [ ] PARTIAL
```

---

## Success Criteria

**Litmus Test Passes If:**
- All P1 flows (1-6) complete successfully
- At least 3 of 4 P2 flows (7-10) complete successfully
- No critical bugs blocking core functionality
- Telegram interactions feel natural and responsive
- Error handling provides clear guidance

---

## Related Documents

- `task-agent-arch.md` - Architecture details
- `task-data-model.md` - Database schema
- `tests/e2e/task-agent-litmus.ts` - Automated setup script
