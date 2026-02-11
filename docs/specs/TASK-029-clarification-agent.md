# TASK-029: Clarification Agent Implementation

## Overview

Implement the Clarification Agent as defined in `parent-harness/docs/CRITICAL_GAPS.md` Gap #1. This agent intercepts vague or ambiguous user-created tasks and asks clarifying questions before execution begins, preventing wasted implementation effort from unclear requirements.

**Status**: Specification
**Priority**: P1 (Critical for Operation)
**Effort**: Medium
**Model**: Sonnet
**Agent Type**: clarification_agent

## Problem Statement

Currently, when users create tasks like "make it faster" or "add authentication", the system immediately queues them for execution. This leads to:

1. **Wrong implementations** - Build agent makes incorrect assumptions about vague requirements
2. **Wasted iterations** - Multiple back-and-forth cycles to clarify after implementation
3. **Resource waste** - Token budget spent on incorrect approaches
4. **User frustration** - Deliverables don't match expectations

The Clarification Agent solves this by:

- **Detecting vague tasks** using pattern matching and scoring
- **Generating targeted questions** using the QuestionEngine
- **Blocking execution** until clarification is received
- **Updating task specifications** with complete requirements

## Requirements

### Functional Requirements

1. **Vagueness Detection**
   - Analyze task description on creation
   - Use existing `vagueness-detector.ts` pattern matching
   - Calculate vagueness score (0-1 scale)
   - Trigger clarification workflow when score ≥ 0.3

2. **Question Generation**
   - Integrate with existing `QuestionEngine` (question-engine.ts)
   - Generate 3-8 clarifying questions per vague task
   - Prioritize questions by importance (required/important/optional)
   - Target specific gaps: outcome, scope, implementation, acceptance

3. **User Interaction**
   - Block task execution (set status to 'blocked')
   - Send questions via Telegram clarification bot
   - Wait for user responses (with timeout)
   - Support skip/timeout fallback to default assumptions

4. **Task Refinement**
   - Update task description with clarified details
   - Extract file paths, dependencies, acceptance criteria from answers
   - Unblock task (set status to 'pending') when complete
   - Trigger normal task flow (evaluation → build)

5. **Source Filtering**
   - **Only trigger for user-created tasks**
   - **Bypass for agent-created tasks** (avoid infinite loops)
   - Track task provenance via `source` field

### Non-Functional Requirements

1. **Performance**
   - Vagueness detection: < 500ms
   - Question generation: < 2s
   - No blocking on agent-created tasks

2. **Reliability**
   - Handle Telegram API failures gracefully
   - Timeout after 24 hours if no response
   - Persist clarification state across restarts

3. **Integration**
   - Hook into task creation flow (API + orchestrator)
   - Reuse existing clarification infrastructure
   - Maintain backward compatibility

## Technical Design

### Architecture

```
User creates task (POST /api/tasks)
    ↓
Task API creates record with source='user'
    ↓
POST /api/tasks calls checkVagueness(task)
    ↓
If vague (score ≥ 0.3):
    ↓
    1. Block task (status='blocked')
    2. Generate questions (QuestionEngine)
    3. Request clarification (send to Telegram)
    4. Wait for response (async)
    ↓
User answers via Telegram bot
    ↓
Clarification answered → unblock task
    ↓
Task enters normal queue (pending)
```

### Components

#### 1. Vagueness Checker Module (NEW)

**File**: `parent-harness/orchestrator/src/clarification/vagueness-checker.ts`

```typescript
import { detectVagueness } from "../../../agents/ideation/vagueness-detector.js";
import { Task } from "../db/tasks.js";

export interface VaguenessCheck {
  taskId: string;
  isVague: boolean;
  score: number;
  reasons: string[];
  shouldClarify: boolean;
}

/**
 * Check if a task needs clarification
 */
export function checkTaskVagueness(task: Task): VaguenessCheck {
  // Only check user-created tasks
  if (task.source !== "user") {
    return {
      taskId: task.id,
      isVague: false,
      score: 0,
      reasons: ["Agent-created task, bypass clarification"],
      shouldClarify: false,
    };
  }

  // Check description vagueness
  const description = task.description || task.title;
  const analysis = detectVagueness(description);

  return {
    taskId: task.id,
    isVague: analysis.isVague,
    score: analysis.score,
    reasons: analysis.reasons,
    shouldClarify: analysis.score >= 0.3,
  };
}
```

#### 2. Clarification Workflow (ENHANCE EXISTING)

**File**: `parent-harness/orchestrator/src/clarification/index.ts` (already exists)

**Add new function**:

```typescript
/**
 * Trigger clarification workflow for a vague task
 */
export async function triggerClarificationWorkflow(
  taskId: string,
): Promise<void> {
  const task = tasks.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Generate questions using QuestionEngine
  const engine = new QuestionEngine();
  const questions = await engine.generateQuestions(task, 8);

  // Filter to required + important only (exclude optional)
  const priorityQuestions = questions.filter(
    (q) => q.importance === "required" || q.importance === "important",
  );

  // Format questions for Telegram
  const questionText = priorityQuestions
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join("\n");

  // Request clarification (blocks task)
  await requestClarification(
    taskId,
    `This task needs more detail:\n\n${questionText}`,
    {
      context: `Task: ${task.title}\nDescription: ${task.description}`,
      expiresInHours: 24,
    },
  );

  console.log(`❓ Clarification workflow triggered for ${task.display_id}`);
}
```

#### 3. Task API Integration (MODIFY EXISTING)

**File**: `parent-harness/orchestrator/src/api/tasks.ts`

**Modify POST /api/tasks endpoint**:

```typescript
import { checkTaskVagueness } from "../clarification/vagueness-checker.js";
import { triggerClarificationWorkflow } from "../clarification/index.js";

tasksRouter.post("/", async (req, res) => {
  const {
    display_id,
    title,
    description,
    category,
    priority,
    task_list_id,
    parent_task_id,
    pass_criteria,
    source,
  } = req.body;

  if (!display_id || !title || !task_list_id) {
    return res.status(400).json({
      error: "Missing required fields: display_id, title, task_list_id",
      status: 400,
    });
  }

  // Create task with source tracking
  const task = tasks.createTask({
    display_id,
    title,
    description,
    category,
    priority,
    task_list_id,
    parent_task_id,
    pass_criteria,
    source: source || "user", // Default to 'user' for API-created tasks
  });

  // Check vagueness (async, don't block response)
  setImmediate(async () => {
    const vagueness = checkTaskVagueness(task);
    if (vagueness.shouldClarify) {
      console.log(
        `🔍 Vague task detected: ${task.display_id} (score: ${vagueness.score})`,
      );
      await triggerClarificationWorkflow(task.id).catch((err) => {
        console.error(`❌ Clarification workflow failed for ${task.id}:`, err);
      });
    }
  });

  res.status(201).json(task);
});
```

#### 4. Task Creation Function Enhancement (MODIFY EXISTING)

**File**: `parent-harness/orchestrator/src/db/tasks.ts`

**Modify createTask signature**:

```typescript
export interface CreateTaskInput {
  display_id: string;
  title: string;
  description?: string;
  category?: string;
  priority?: Task["priority"];
  status?: Task["status"];
  task_list_id?: string;
  parent_task_id?: string;
  pass_criteria?: string[];
  source?: string; // NEW: Track task origin
}

export function createTask(
  input: CreateTaskInput & { wave_number?: number },
): Task {
  const id = uuidv4();
  const passCriteria = input.pass_criteria
    ? JSON.stringify(input.pass_criteria)
    : null;
  const taskListId = input.task_list_id ?? null;
  const status = input.status ?? "pending";
  const source = input.source ?? null; // NEW: Default to null if not provided

  run(
    `
    INSERT INTO tasks (
      id, display_id, title, description, category,
      priority, task_list_id, parent_task_id, pass_criteria, status, retry_count, wave_number, source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `,
    [
      id,
      input.display_id,
      input.title,
      input.description ?? null,
      input.category ?? null,
      input.priority ?? "P2",
      taskListId,
      input.parent_task_id ?? null,
      passCriteria,
      status,
      input.wave_number ?? null,
      source, // NEW: Insert source field
    ],
  );

  return getTask(id)!;
}
```

#### 5. Answer Processing (ENHANCE EXISTING)

**File**: `parent-harness/orchestrator/src/clarification/index.ts`

**Enhance answerClarification function**:

```typescript
export async function answerClarification(
  requestId: string,
  answer: string,
  answeredBy?: string,
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== "pending") {
    return undefined;
  }

  run(
    `
    UPDATE clarification_requests
    SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
    WHERE id = ?
  `,
    [answer, answeredBy ?? "human", requestId],
  );

  // NEW: Process answer with QuestionEngine
  const engine = new QuestionEngine();
  const processed = await engine.processAnswer(
    request.task_id,
    requestId,
    answer,
  );

  // Apply extracted information to task
  await engine.applyAnswers(request.task_id, [
    { questionId: requestId, answer, answeredAt: new Date().toISOString() },
  ]);

  // Update task description with clarified details
  const task = tasks.getTask(request.task_id);
  if (task && processed.extractedInfo) {
    let enhancedDescription = task.description || "";

    if (processed.extractedInfo.acceptanceCriteria) {
      enhancedDescription += `\n\nAcceptance Criteria:\n${(processed.extractedInfo.acceptanceCriteria as string[]).map((c) => `- ${c}`).join("\n")}`;
    }

    tasks.updateTask(task.id, { description: enhancedDescription });
  }

  // Unblock the task
  tasks.updateTask(request.task_id, { status: "pending" });

  console.log(`✅ Clarification answered for request ${requestId}: ${answer}`);

  return getClarificationRequest(requestId);
}
```

### Database Schema

**Already exists** - No schema changes required:

- `tasks.source` field already exists in schema (line 78 of schema.sql: `created_by TEXT`)
- `clarification_requests` table already exists (created by clarification/index.ts)
- `task_questions` table already exists (created by QuestionEngine)

**Note**: The schema field is `created_by` but code uses `source`. Need to align naming.

**DECISION**: Use `source` field name in code and update schema column name from `created_by` to `source` for consistency.

**Migration needed**:

```sql
ALTER TABLE tasks RENAME COLUMN created_by TO source;
```

### Integration Points

#### 1. Task Creation Hooks

- **POST /api/tasks** - Primary entry point for user tasks
- **Planning agent** - Creates tasks with source='planning_agent'
- **Decomposition agent** - Creates subtasks with source='decomposition_agent'
- **Build agent** - May create follow-up tasks with source='build_agent'

#### 2. Orchestrator Integration

**File**: `parent-harness/orchestrator/src/orchestrator/index.ts`

No changes needed - clarification workflow is self-contained and triggered by API.

#### 3. Telegram Integration

Already implemented in `clarification/index.ts`:

- Uses `@vibe-clarification` bot
- Sends questions with `/answer` command instructions
- Handles responses via webhook

### Error Handling

1. **Telegram API failures**
   - Log error
   - Fall back to email notification
   - Store questions in database for manual retrieval

2. **Timeout (24 hours)**
   - Expire clarification request (status='expired')
   - Unblock task with warning note
   - Allow build agent to proceed with best guess

3. **QuestionEngine failures**
   - Log error
   - Bypass clarification workflow
   - Proceed to normal task queue

4. **Vagueness detector crashes**
   - Catch exception
   - Default to NOT vague (false negative better than blocking all tasks)
   - Log for investigation

## Pass Criteria

### 1. New clarification_agent implemented using Sonnet model

**Verification**:

- ✅ Agent metadata exists in `agents/metadata.ts` (already implemented)
- ✅ Agent uses Sonnet as defaultModel
- ✅ Agent has Read-only tools (no Write/Edit to prevent code modification)

**Test**:

```bash
grep -A 20 "clarification_agent:" parent-harness/orchestrator/src/agents/metadata.ts
# Should show: defaultModel: 'sonnet', tools: ['Read']
```

### 2. Agent triggers on new user-created tasks (bypass for agent-created)

**Verification**:

- ✅ `checkTaskVagueness()` returns `shouldClarify: false` if `task.source !== 'user'`
- ✅ POST /api/tasks creates tasks with `source='user'` by default
- ✅ Agent-created tasks set `source` to agent name (e.g., 'planning_agent')

**Test**:

```bash
# Test 1: User task should trigger clarification
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "TEST-001",
    "title": "make it faster",
    "description": "the app is slow",
    "task_list_id": "default-task-list"
  }'
# Expected: Task created, then status changes to 'blocked' within 1 second

# Test 2: Agent task should bypass clarification
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "TEST-002",
    "title": "make it faster",
    "description": "the app is slow",
    "task_list_id": "default-task-list",
    "source": "planning_agent"
  }'
# Expected: Task created, status remains 'pending' (no clarification)
```

### 3. Integrates with QuestionEngine to generate questions

**Verification**:

- ✅ `triggerClarificationWorkflow()` calls `QuestionEngine.generateQuestions()`
- ✅ Questions are filtered by importance (required + important only)
- ✅ Questions are persisted to `task_questions` table
- ✅ Questions are sent via Telegram with context

**Test**:

```bash
# After creating vague task, check database
sqlite3 parent-harness/data/harness.db "SELECT * FROM task_questions WHERE task_id = (SELECT id FROM tasks WHERE display_id = 'TEST-001');"
# Expected: 3-8 questions with priority, importance, category
```

### 4. User responses stored and used to refine task definition

**Verification**:

- ✅ Answers are stored in `clarification_requests.answer` field
- ✅ `processAnswer()` extracts file paths, acceptance criteria, dependencies
- ✅ `applyAnswers()` updates task description with clarified details
- ✅ Extracted file impacts are saved to `task_impacts` table

**Test**:

```bash
# Simulate Telegram answer via API
curl -X POST http://localhost:3333/api/clarification/answer \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "<clarification_request_id>",
    "answer": "Optimize the database queries in server/routes/api.ts. The API response time should be under 200ms. Tests: verify /api/ideas endpoint responds in <200ms."
  }'

# Check task was updated
sqlite3 parent-harness/data/harness.db "SELECT description FROM tasks WHERE display_id = 'TEST-001';"
# Expected: Description now includes acceptance criteria
```

### 5. Well-defined tasks enter queue after clarification complete

**Verification**:

- ✅ Task status changes from 'blocked' to 'pending' after clarification answered
- ✅ Task is visible in `getPendingTasks()` query
- ✅ Orchestrator can assign task to build agent
- ✅ Expired clarifications (24h timeout) also unblock task with warning

**Test**:

```bash
# After answering clarification
curl http://localhost:3333/api/tasks/pending
# Expected: TEST-001 appears in pending tasks

# Check task status
sqlite3 parent-harness/data/harness.db "SELECT status, assigned_agent_id FROM tasks WHERE display_id = 'TEST-001';"
# Expected: status='pending', assigned_agent_id=NULL
```

## Dependencies

### Code Dependencies

1. **Existing Components (Reuse)**
   - `agents/ideation/vagueness-detector.ts` - Pattern matching for vague language
   - `server/services/task-agent/question-engine.ts` - Question generation
   - `parent-harness/orchestrator/src/clarification/index.ts` - Clarification workflow
   - `parent-harness/orchestrator/src/agents/metadata.ts` - Agent configuration

2. **New Components (Create)**
   - `parent-harness/orchestrator/src/clarification/vagueness-checker.ts` - Vagueness check logic

3. **Modified Components (Enhance)**
   - `parent-harness/orchestrator/src/api/tasks.ts` - Add vagueness check hook
   - `parent-harness/orchestrator/src/db/tasks.ts` - Add source parameter
   - `parent-harness/orchestrator/src/clarification/index.ts` - Add answer processing

### External Dependencies

- Telegram Bot API (already integrated)
- SQLite database (already in use)
- QuestionEngine (already implemented)

### System Dependencies

- Claude API (Sonnet model access)
- Telegram clarification bot configured
- Environment variable: `TELEGRAM_BOT_CLARIFICATION`

## Implementation Plan

### Phase 1: Database Migration (5 min)

1. Rename `created_by` to `source` in tasks table
2. Test migration with existing data

### Phase 2: Vagueness Checker (15 min)

1. Create `clarification/vagueness-checker.ts`
2. Implement `checkTaskVagueness()` function
3. Write unit tests

### Phase 3: Task Creation Integration (20 min)

1. Update `db/tasks.ts` createTask to accept `source`
2. Update `api/tasks.ts` POST endpoint to check vagueness
3. Add async workflow trigger

### Phase 4: Clarification Workflow (30 min)

1. Implement `triggerClarificationWorkflow()` in clarification/index.ts
2. Enhance `answerClarification()` with QuestionEngine integration
3. Add answer processing and task refinement

### Phase 5: Testing (30 min)

1. Test vague task detection (score calculation)
2. Test user vs agent task filtering
3. Test question generation
4. Test answer processing
5. Test task unblocking
6. Test timeout expiration

### Phase 6: Documentation (10 min)

1. Update CRITICAL_GAPS.md to mark Gap #1 as implemented
2. Add clarification workflow diagram to docs
3. Update API documentation

**Total Estimated Time**: ~2 hours

## Testing Strategy

### Unit Tests

**File**: `parent-harness/orchestrator/src/clarification/__tests__/vagueness-checker.test.ts`

```typescript
import { checkTaskVagueness } from "../vagueness-checker.js";
import { Task } from "../../db/tasks.js";

describe("checkTaskVagueness", () => {
  it("should flag vague user tasks", () => {
    const task: Task = {
      id: "1",
      display_id: "TEST-001",
      title: "make it faster",
      description: "the app is slow",
      source: "user",
      // ... other fields
    };

    const result = checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it("should bypass agent-created tasks", () => {
    const task: Task = {
      id: "2",
      display_id: "TEST-002",
      title: "make it faster",
      description: "the app is slow",
      source: "planning_agent",
      // ... other fields
    };

    const result = checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(false);
    expect(result.reasons).toContain(
      "Agent-created task, bypass clarification",
    );
  });

  it("should not flag specific tasks", () => {
    const task: Task = {
      id: "3",
      display_id: "TEST-003",
      title: "Optimize database query in server/routes/api.ts",
      description:
        "The /api/ideas endpoint currently takes 850ms. Optimize the SQL query to return in under 200ms. Add index on ideas.created_at if needed.",
      source: "user",
      // ... other fields
    };

    const result = checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(false);
    expect(result.score).toBeLessThan(0.3);
  });
});
```

### Integration Tests

**File**: `parent-harness/orchestrator/src/clarification/__tests__/workflow.test.ts`

```typescript
describe("Clarification Workflow Integration", () => {
  it("should trigger clarification for vague user task", async () => {
    // Create vague task
    const task = createTask({
      display_id: "TEST-VAGUE-001",
      title: "improve the UI",
      description: "make it better",
      task_list_id: "test-list",
      source: "user",
    });

    // Wait for async vagueness check
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check task is blocked
    const updated = getTask(task.id);
    expect(updated.status).toBe("blocked");

    // Check clarification request exists
    const requests = getTaskClarifications(task.id);
    expect(requests.length).toBe(1);
    expect(requests[0].status).toBe("pending");
  });

  it("should unblock task after clarification", async () => {
    // ... create and block task ...

    // Answer clarification
    const request = getTaskClarifications(task.id)[0];
    await answerClarification(
      request.id,
      "Improve the task creation form in frontend/src/components/TaskForm.tsx. Add validation for required fields. Acceptance: Form shows error messages for missing fields.",
      "test-user",
    );

    // Check task is unblocked
    const updated = getTask(task.id);
    expect(updated.status).toBe("pending");
    expect(updated.description).toContain("Acceptance Criteria");
  });
});
```

### Manual Testing Checklist

- [ ] Create vague user task via API → verify status changes to 'blocked'
- [ ] Check Telegram bot receives clarification questions
- [ ] Answer via Telegram → verify task unblocks
- [ ] Create vague agent task → verify no clarification triggered
- [ ] Create specific user task → verify no clarification triggered
- [ ] Let clarification timeout (24h) → verify task unblocks with warning
- [ ] Check task_questions table populated
- [ ] Check task description updated with answers
- [ ] Verify task appears in pending queue after clarification

## Open Questions

1. **Question Limit**: Should we limit to N questions per task? (Currently: 8)
   - **Recommendation**: Yes, 5-8 questions max to avoid overwhelming users

2. **Timeout Behavior**: After 24h timeout, proceed with best guess or require manual approval?
   - **Recommendation**: Proceed with warning note in task description

3. **Multiple Clarification Rounds**: If build agent gets stuck, can it request more clarification?
   - **Recommendation**: Yes, via same workflow, but track round count to prevent infinite loops

4. **Vagueness Threshold**: Is 0.3 the right threshold for triggering clarification?
   - **Recommendation**: Start with 0.3, tune based on false positive/negative rates

5. **Agent-Created Task Edge Cases**: What if planning agent creates intentionally vague task for spec agent?
   - **Recommendation**: Spec agent can manually trigger clarification via API if needed

## References

- **CRITICAL_GAPS.md**: `parent-harness/docs/CRITICAL_GAPS.md` (Gap #1, lines 7-31)
- **Vagueness Detector**: `agents/ideation/vagueness-detector.ts` (pattern matching, scoring)
- **Question Engine**: `server/services/task-agent/question-engine.ts` (question generation)
- **Existing Clarification**: `parent-harness/orchestrator/src/clarification/index.ts` (plan approval workflow)
- **Agent Metadata**: `parent-harness/orchestrator/src/agents/metadata.ts` (clarification_agent config, lines 283-306)
- **Task Schema**: `parent-harness/database/schema.sql` (tasks table, line 36-83)

## Success Metrics

1. **Reduction in Build Failures**: 30% fewer failed tasks due to unclear requirements (measured over 2 weeks)
2. **Clarification Rate**: 15-25% of user tasks trigger clarification (too low = threshold too high, too high = threshold too low)
3. **Response Time**: 90% of clarifications answered within 4 hours
4. **False Positive Rate**: < 5% of specific tasks incorrectly flagged as vague
5. **User Satisfaction**: Positive feedback on Telegram clarification UX

---

**Next Steps**: After spec approval → Create TASK-029-build to implement this specification
