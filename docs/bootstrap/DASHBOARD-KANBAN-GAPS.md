# Dashboard, Kanban, and Task List Data Inconsistencies

## Overview
This task list addresses critical data inconsistencies between the Agent Dashboard, Task Kanban Board, and Task Lists.

## Tasks

### Agent Status Tracking

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-001 | Unify agent status enums across frontend types (idle/running/error/waiting), backend API (adds halted), and database schema (working/idle/blocked/error) to use consistent values | P1 | [~] |
| DKG-002 | Add status mapping layer in server/routes/agents.ts to convert database states (working/blocked) to frontend-compatible states (running/waiting) | P1 | [~] |
| DKG-003 | Add 'blocked' status badge styling in AgentStatusCard.tsx for agents blocked by questions | P2 | [ ] |

### Agent Metrics Calculation

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-004 | Fix hard-coded 'build-agent' in metrics query (server/routes/agents.ts:93) to query metrics per agent type using task_agent_bindings table | P1 | [~] |
| DKG-005 | Create agent_id column in task_executions table to track which agent executed each task | P1 | [x] |
| DKG-006 | Update metrics query to group by agent_id so each agent shows its own completion counts | P1 | [~] |

### Activity Tracking

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-007 | Replace mock activities in AgentDashboard.tsx (lines 66-77) with real data from activity_log table | P1 | [ ] |
| DKG-008 | Create API endpoint GET /api/agents/activities to fetch recent activity events from database | P1 | [ ] |
| DKG-009 | Add activity logging when tasks complete/fail in task-executor.ts to populate activity_log table | P2 | [ ] |

### Task Completion Count Synchronization

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-010 | Add database transaction wrapper around task completion to ensure memory counter and database update are atomic | P1 | [ ] |
| DKG-011 | Create reconciliation function to sync executor_state counts with actual task_queue status counts on startup | P1 | [ ] |
| DKG-012 | Add periodic sync check (every 30s) to detect and fix count drift between memory and database | P2 | [ ] |

### Task Status Enum Unification

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-013 | Fix task-executor.ts line 506 to use 'failed' status instead of reverting failed tasks to 'pending' | P1 | [ ] |
| DKG-014 | Add 'failed' status support to task-loader.ts parseStatus function (use '!' character for failed) | P1 | [ ] |
| DKG-015 | Unify status enum: use 'pending/in_progress/complete/failed/skipped' consistently across all layers | P1 | [ ] |
| DKG-016 | Update updateMarkdownStatus in task-loader.ts to support writing 'failed' status back to markdown | P2 | [ ] |

### Question-Agent Status Correlation

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-017 | Update agent_states.status to 'blocked' when agent has pending blocking question | P2 | [ ] |
| DKG-018 | Add trigger or update logic in question creation to set agent status to waiting/blocked | P2 | [ ] |
| DKG-019 | Clear blocked status when question is answered via question_answers table update | P2 | [ ] |

### Kanban Data Source Consistency

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-020 | Fix field mapping in KanbanBoard.tsx: action should not be priority, file should not be description | P1 | [ ] |
| DKG-021 | Add database sync when markdown task list is updated to keep task_queue table in sync | P2 | [ ] |
| DKG-022 | Create single source of truth: prefer database task_queue over markdown parsing for runtime status | P2 | [ ] |

### Executor State Persistence

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-023 | Fix restoreQueueFromDatabase to always restore executor_state even when task queue is empty | P1 | [ ] |
| DKG-024 | Add completed/failed counts to executor_state restore logic (lines 236-239 in task-executor.ts) | P1 | [ ] |
| DKG-025 | Persist executor history separately so it survives task queue clearing | P2 | [ ] |

### Heartbeat-Activity Correlation

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-026 | Update agent heartbeat when task completes, not just on explicit heartbeat calls | P2 | [ ] |
| DKG-027 | Add last_task_completed timestamp to agent_states table | P3 | [ ] |
| DKG-028 | Display actual last activity (task completion) vs last heartbeat in AgentStatusCard | P3 | [ ] |

### Agent Context Persistence

| ID | Task | Pri | Status |
|----|------|-----|--------|
| DKG-029 | Persist taskListContext to database when agent runner starts execution | P2 | [ ] |
| DKG-030 | Load taskListContext from database on agent runner initialization | P2 | [ ] |

## Priority Summary

- **P1 (Critical)**: 14 tasks - Core data consistency issues
- **P2 (High)**: 12 tasks - Important synchronization improvements
- **P3 (Medium)**: 4 tasks - Nice-to-have enhancements

## Validation Commands

After completing tasks, validate with:
```bash
# Check agent status consistency
npm test -- --run tests/agents/

# Check task status tracking
npm test -- --run tests/task-queue-persistence.test.ts

# Verify API responses match frontend types
npm run typecheck
```
