# SIA Resolution: TASK-029 Clarification Agent Implementation

**Date**: 2026-02-08
**SIA Agent**: autonomous-debugging-agent
**Task ID**: TASK-029
**Status**: ✅ UNBLOCKED

---

## Problem Analysis

### Root Cause: Circular Dependency + Database Inconsistency

**TASK-029** was stuck in an ironic circular dependency:

1. **Task Purpose**: Implement the Clarification Agent that asks users for more details on vague tasks
2. **Task State**: Stuck in `status='blocked'` for 9 retry attempts
3. **Circular Problem**: The task to BUILD the clarification system was itself BLOCKED waiting for clarification
4. **Missing Data**: No `clarification_requests` record existed for TASK-029 (verified via DB query)
5. **QA Loop**: QA Agent kept validating and finding the clarification agent NOT implemented (which is correct - it's what the task is supposed to build!)

### Database Evidence

```sql
-- Task status before fix
SELECT display_id, status, retry_count FROM tasks WHERE display_id = 'TASK-029';
-- Result: TASK-029|blocked|9

-- Clarification requests for this task
SELECT * FROM clarification_requests WHERE task_id = (SELECT id FROM tasks WHERE display_id = 'TASK-029');
-- Result: (empty) - NO clarification request exists!
```

**Conclusion**: Task was in "blocked" status without a corresponding clarification request. This is a database consistency violation that prevented the task from ever being executed.

---

## How This Happened

### Most Likely Scenario

1. **Initial Attempt**: Build Agent or orchestrator tried to execute TASK-029
2. **Manual Intervention**: Someone or something manually set the task to "blocked" status (possibly testing the clarification system or debugging)
3. **Cleanup Missed**: The corresponding clarification request was never created OR was deleted without unblocking the task
4. **Stuck State**: Task remained in "blocked" status indefinitely
5. **Retry Loop**: Each retry attempt hit the same issue - QA validated that the clarification agent wasn't implemented (which is correct since it's the task's job to implement it!)

### Why 9 Retries Didn't Help

- **Pass Criteria**: Task has 5 pass criteria for implementing the clarification agent
- **QA Validation**: QA Agent correctly identified that the clarification agent is NOT fully implemented
- **Catch-22**: The task can't be worked on because it's blocked, but it's the task that would implement the unblocking mechanism!
- **No Recovery**: Retry logic doesn't handle "blocked" status - it assumes blocked tasks will be unblocked by answering clarifications

---

## Fix Applied

### Database Update

```sql
UPDATE tasks
SET status = 'pending', retry_count = 0
WHERE display_id = 'TASK-029';
```

### Verification

```sql
SELECT display_id, status, retry_count FROM tasks WHERE display_id = 'TASK-029';
-- Result: TASK-029|pending|0 ✅
```

---

## What TASK-029 Actually Needs to Implement

Based on the specification files (`TASK-029-clarification-agent.md` and `TASK-029-clarification-agent-implementation.md`), the task needs to build:

### 1. Missing Components

#### Files that DON'T exist but should:

- `parent-harness/orchestrator/src/clarification/vagueness-checker.ts` ❌
- `parent-harness/orchestrator/src/clarification/vagueness-analyzer.ts` ❌
- `parent-harness/orchestrator/src/hooks/clarification-hook.ts` ❌
- `parent-harness/orchestrator/src/services/vagueness-analyzer.ts` ❌

#### Files that exist but need enhancement:

- `parent-harness/orchestrator/src/api/tasks.ts` ✅ (needs vagueness check hook)
- `parent-harness/orchestrator/src/db/tasks.ts` ✅ (needs `source` parameter support)
- `parent-harness/orchestrator/src/clarification/index.ts` ✅ (needs answer processing with QuestionEngine)

### 2. Integration Points

**Already Working**:

- ✅ Clarification request/answer system (`clarification/index.ts`)
- ✅ Telegram bot integration (`@vibe-clarification`)
- ✅ Agent metadata (`clarification_agent` defined)
- ✅ Database schema (`clarification_requests` table exists)

**Needs Implementation**:

1. **Automatic Vagueness Detection** - Trigger on task creation
2. **QuestionEngine Integration** - Generate targeted questions for vague tasks
3. **Source Filtering** - Only check user-created tasks, bypass agent-created tasks
4. **Task Enrichment** - Update task description with clarification answers

### 3. Pass Criteria (from spec)

1. ✅ New clarification_agent implemented using Sonnet model
   → **Already exists** in `agents/metadata.ts` (lines 283-306)

2. ❌ Agent triggers on new user-created tasks (bypass for agent-created)
   → **Missing**: No automatic triggering logic in task creation flow

3. ❌ Integrates with QuestionEngine to generate questions
   → **Missing**: No vagueness-analyzer or hook to call QuestionEngine

4. ❌ User responses stored and used to refine task definition
   → **Partial**: Storage works, but answer processing with QuestionEngine missing

5. ❌ Well-defined tasks enter queue after clarification complete
   → **Partial**: Unblocking works, but no enrichment of task description

---

## Recommended Next Steps

### For Build Agent (next execution of TASK-029)

1. **Create Vagueness Analyzer**
   - Implement `parent-harness/orchestrator/src/services/vagueness-analyzer.ts`
   - Combine pattern detection from `agents/ideation/vagueness-detector.ts`
   - Add QuestionEngine gap analysis
   - Set threshold: score ≥ 0.4 = vague

2. **Create Clarification Hook**
   - Implement `parent-harness/orchestrator/src/hooks/clarification-hook.ts`
   - Export `onTaskCreated(task)` function
   - Check if task is user-created (skip agents)
   - If vague, generate questions and request clarification

3. **Integrate with Task Creation**
   - Modify `parent-harness/orchestrator/src/api/tasks.ts`
   - Add async hook trigger after task creation
   - Non-blocking (use `setImmediate` or similar)

4. **Enhance Answer Processing**
   - Modify `parent-harness/orchestrator/src/clarification/index.ts`
   - In `answerClarification()`, call QuestionEngine to process answer
   - Extract structured info (acceptance criteria, file paths, dependencies)
   - Update task description with clarified details

5. **Add Source Tracking**
   - Ensure `tasks.created_by` field is populated correctly
   - API-created tasks: default to `'user'`
   - Agent-created tasks: set to agent ID

### Testing Plan

1. **Unit Tests**:
   - `vagueness-analyzer.test.ts` - Test scoring logic
   - `clarification-hook.test.ts` - Test triggering logic

2. **Integration Tests**:
   - Create vague user task → verify it gets blocked
   - Create clear user task → verify no clarification
   - Create vague agent task → verify bypass
   - Answer clarification → verify task unblocked + enriched

3. **Manual E2E Test**:

   ```bash
   # 1. Create vague task
   curl -X POST http://localhost:3333/api/tasks \
     -H "Content-Type: application/json" \
     -d '{
       "display_id": "TEST-VAGUE-001",
       "title": "make it faster",
       "description": "the app is slow",
       "task_list_id": "<task-list-id>"
     }'

   # 2. Check Telegram for clarification questions
   # 3. Answer via /answer command
   # 4. Verify task unblocked and enriched
   ```

---

## Preventing Future Similar Issues

### 1. Database Consistency Checks

Add a cron job or startup check:

```typescript
// Check for blocked tasks without clarification requests
const orphanedBlocked = query(`
  SELECT t.id, t.display_id
  FROM tasks t
  LEFT JOIN clarification_requests cr ON t.id = cr.task_id AND cr.status = 'pending'
  WHERE t.status = 'blocked' AND cr.id IS NULL
`);

if (orphanedBlocked.length > 0) {
  console.warn(
    `⚠️ Found ${orphanedBlocked.length} blocked tasks without clarification requests`,
  );
  // Auto-unblock or alert
}
```

### 2. Retry Logic Enhancement

Modify retry logic to detect this specific case:

```typescript
if (task.status === "blocked" && !hasPendingClarification(task.id)) {
  console.warn(
    `⚠️ Task ${task.display_id} is blocked but has no pending clarification - auto-unblocking`,
  );
  updateTask(task.id, { status: "pending" });
}
```

### 3. Task State Validation

Add validation in `updateTask()`:

```typescript
if (newStatus === "blocked") {
  // Ensure there's a corresponding clarification request
  if (!hasPendingClarification(taskId)) {
    throw new Error(`Cannot block task without creating clarification request`);
  }
}
```

---

## Summary

**Fixed**: Unblocked TASK-029 by resetting status from "blocked" to "pending" and clearing retry count.

**Root Cause**: Database inconsistency - task was blocked without a corresponding clarification request, creating an impossible state.

**Impact**: Task can now be executed by Build Agent to actually implement the clarification agent infrastructure.

**Next**: Build Agent should implement the missing components (vagueness-analyzer, clarification-hook, QuestionEngine integration) per the specification.

**Prevention**: Add database consistency checks and retry logic improvements to detect orphaned blocked tasks.

---

**TASK_COMPLETE**: Fixed database inconsistency where TASK-029 was stuck in "blocked" status (retry_count=9) without any clarification request. Unblocked task by resetting status to "pending" and retry_count to 0. Root cause was circular dependency: task to BUILD clarification system was itself blocked waiting for clarification that didn't exist. Task can now proceed to actual implementation of vagueness detection and automatic clarification workflow.
