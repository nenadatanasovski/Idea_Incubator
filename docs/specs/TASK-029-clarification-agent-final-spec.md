# TASK-029: Clarification Agent Implementation - Final Specification

**Status:** Ready for Implementation
**Priority:** P1 (Critical Gap #1)
**Effort:** Medium (~6-8 hours)
**Created:** 2026-02-09
**Based On:** CRITICAL_GAPS.md Gap #1, existing specifications

---

## Executive Summary

Implement automatic vagueness detection that triggers the Clarification Agent when users create vague tasks. This prevents wasted implementation effort by asking clarifying questions before execution begins.

**Key Insight:** Most infrastructure already exists - we just need to connect the pieces with automatic triggering logic.

---

## Problem Statement

Current behavior:
```
User: "make it faster" → Build Agent → Wrong implementation → Retry loop → Wasted tokens
```

Desired behavior:
```
User: "make it faster" → Vagueness detected → Questions asked → Clarified → Build Agent → Correct implementation
```

---

## Existing Infrastructure ✅

### 1. Clarification System (Complete)
**File:** `parent-harness/orchestrator/src/clarification/index.ts`
- ✅ `requestClarification()` - Blocks task, sends to Telegram
- ✅ `answerClarification()` - Unblocks task with answer
- ✅ `skipClarification()` - Unblocks without answer
- ✅ Database table: `clarification_requests`
- ✅ Telegram integration: `@vibe-clarification` bot

### 2. Vagueness Detector (Complete)
**File:** `agents/ideation/vagueness-detector.ts`
- ✅ Pattern matching: hedging, non-committal, deflecting, unclear
- ✅ Scoring: 0-1 scale
- ✅ Length check: < 5 words = vague

### 3. Question Engine (Complete)
**File:** `server/services/task-agent/question-engine.ts`
- ✅ 8 question categories
- ✅ Gap analysis: `analyzeGaps()`
- ✅ Question generation: `generateQuestions()`
- ✅ Answer processing: `processAnswer()`
- ✅ Database table: `task_questions`

### 4. Agent Metadata (Complete)
**File:** `parent-harness/orchestrator/src/agents/metadata.ts`
- ✅ `clarification_agent` configured
- ✅ Model: Sonnet
- ✅ Tools: Read-only (no Write/Edit)

---

## What's Missing ❌

1. **Automatic triggering** - No hook on task creation to check vagueness
2. **Source filtering** - No way to bypass agent-created tasks
3. **Question integration** - QuestionEngine not called by clarification workflow
4. **Answer enrichment** - Answers not used to update task description

---

## Implementation Requirements

### FR-1: Automatic Vagueness Detection on Task Creation

**Hook Location:** POST /api/tasks endpoint

**Logic:**
```typescript
1. Task created with source='user' (default)
2. Async: Check vagueness (don't block API response)
3. If vague (score ≥ 0.4) → trigger clarification workflow
4. If clear OR agent-created → skip clarification
```

**Vagueness Scoring:**
```typescript
Combined score =
  (pattern score × 0.5) +      // Vague language patterns
  (length penalty × 0.3) +     // < 10 words
  (gap score × 0.2)            // Missing info categories

Threshold: ≥ 0.4 = vague
```

### FR-2: Source-Based Bypass

**Field:** `tasks.created_by` (already exists in schema)

**Values:**
- `null` or `'human'` → Check vagueness
- `'planning_agent'`, `'build_agent'`, etc. → Bypass

**Rationale:** Agents create well-structured tasks; humans may be vague

### FR-3: QuestionEngine Integration

**Flow:**
```typescript
1. Detect vague task
2. QuestionEngine.analyzeGaps(task) → Identify missing categories
3. QuestionEngine.generateQuestions(task, 5) → Generate 3-5 questions
4. Filter to required + important (skip optional)
5. requestClarification(taskId, questionText) → Block task
```

**Question Priorities:**
- **Required (priority ≥ 8):** Outcome, acceptance criteria
- **Important (priority 6-7):** Scope, dependencies
- **Optional (priority < 6):** Implementation details, context

### FR-4: Answer Processing and Task Enrichment

**Flow:**
```typescript
1. User answers via Telegram
2. answerClarification(requestId, answer)
3. QuestionEngine.processAnswer(taskId, answer) → Extract info
4. Update task description with:
   - Extracted acceptance criteria
   - Identified file paths
   - Discovered dependencies
5. Unblock task (status: blocked → pending)
```

### FR-5: Timeout Handling

**Behavior:**
- Timeout: 24 hours
- Action: Auto-expire clarification, unblock task
- Note: Add warning to task description

---

## Technical Design

### Component 1: Vagueness Checker Service (NEW)

**File:** `parent-harness/orchestrator/src/clarification/vagueness-checker.ts`

```typescript
import { detectVagueness } from '../../../agents/ideation/vagueness-detector.js';
import { Task } from '../db/tasks.js';

export interface VaguenessCheck {
  taskId: string;
  isVague: boolean;
  score: number;
  reasons: string[];
  shouldClarify: boolean;
}

export async function checkTaskVagueness(task: Task): Promise<VaguenessCheck> {
  // Bypass agent-created tasks
  if (task.created_by && task.created_by !== 'human') {
    return {
      taskId: task.id,
      isVague: false,
      score: 0,
      reasons: ['Agent-created task, bypass clarification'],
      shouldClarify: false,
    };
  }

  // Analyze vagueness
  const text = `${task.title}. ${task.description || ''}`;
  const patternAnalysis = detectVagueness(text);

  // Length penalty
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const lengthPenalty = wordCount < 10 ? 0.3 : 0;

  // Combined score
  const combinedScore = Math.min(1.0,
    patternAnalysis.score * 0.5 +
    lengthPenalty
  );

  return {
    taskId: task.id,
    isVague: combinedScore >= 0.4,
    score: combinedScore,
    reasons: [
      ...patternAnalysis.reasons,
      wordCount < 10 ? `Short task description (${wordCount} words)` : null
    ].filter(Boolean) as string[],
    shouldClarify: combinedScore >= 0.4,
  };
}
```

### Component 2: Clarification Workflow Trigger (NEW)

**File:** `parent-harness/orchestrator/src/clarification/workflow.ts`

```typescript
import { checkTaskVagueness } from './vagueness-checker.js';
import { requestClarification } from './index.js';
import { getTask } from '../db/tasks.js';

export async function triggerClarificationWorkflow(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Check vagueness
  const check = await checkTaskVagueness(task);
  if (!check.shouldClarify) {
    console.log(`✅ Task ${task.display_id} is clear (score: ${check.score.toFixed(2)})`);
    return;
  }

  console.log(`❓ Task ${task.display_id} is vague (score: ${check.score.toFixed(2)})`);
  console.log(`   Reasons: ${check.reasons.join(', ')}`);

  // Generate basic clarifying questions
  const questions = [
    "What specific outcome or deliverable do you expect?",
    "Which files, components, or systems should be modified?",
    "How will you verify this task is complete?",
  ];

  const questionText = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n');

  // Request clarification (blocks task)
  await requestClarification(
    taskId,
    `This task needs more detail:\n\n${questionText}`,
    {
      context: `Vagueness score: ${check.score.toFixed(2)}\nReasons: ${check.reasons.join(', ')}`,
      expiresInHours: 24,
    }
  );
}
```

### Component 3: Task API Integration (MODIFY)

**File:** `parent-harness/orchestrator/src/api/tasks.ts`

**Change:** Add async vagueness check after task creation

```typescript
import { triggerClarificationWorkflow } from '../clarification/workflow.js';

tasksRouter.post('/', async (req, res) => {
  const { display_id, title, description, category, priority, task_list_id, parent_task_id, pass_criteria, created_by } = req.body;

  if (!display_id || !title || !task_list_id) {
    return res.status(400).json({
      error: 'Missing required fields: display_id, title, task_list_id',
      status: 400,
    });
  }

  // Create task
  const task = tasks.createTask({
    display_id,
    title,
    description,
    category,
    priority,
    task_list_id,
    parent_task_id,
    pass_criteria,
    created_by: created_by || 'human', // Default to human
  });

  // Check vagueness (async, don't block response)
  setImmediate(async () => {
    try {
      await triggerClarificationWorkflow(task.id);
    } catch (err) {
      console.error(`❌ Clarification workflow failed for ${task.id}:`, err);
    }
  });

  res.status(201).json(task);
});
```

### Component 4: Enhanced Answer Processing (MODIFY)

**File:** `parent-harness/orchestrator/src/clarification/index.ts`

**Change:** Update `answerClarification()` to enrich task description

```typescript
export async function answerClarification(
  requestId: string,
  answer: string,
  answeredBy?: string
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== 'pending') {
    return undefined;
  }

  run(`
    UPDATE clarification_requests
    SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
    WHERE id = ?
  `, [answer, answeredBy ?? 'human', requestId]);

  // NEW: Enrich task description with answer
  const task = tasks.getTask(request.task_id);
  if (task) {
    const enhancedDescription = task.description
      ? `${task.description}\n\n**Clarification:**\n${answer}`
      : `**Clarification:**\n${answer}`;

    tasks.updateTask(task.id, { description: enhancedDescription });
  }

  // Unblock the task
  tasks.updateTask(request.task_id, { status: 'pending' });

  console.log(`✅ Clarification answered for request ${requestId}: ${answer}`);

  return getClarificationRequest(requestId);
}
```

---

## Database Schema

**No changes required!** All tables already exist:
- ✅ `tasks` table with `created_by` field
- ✅ `clarification_requests` table
- ✅ `task_questions` table (in Idea Incubator DB)

---

## Pass Criteria

### 1. New clarification_agent implemented using Sonnet model
**Verification:**
```bash
grep -A 20 "clarification_agent:" parent-harness/orchestrator/src/agents/metadata.ts
# Should show: defaultModel: 'sonnet'
```
**Status:** ✅ Already implemented

### 2. Agent triggers on new user-created tasks (bypass for agent-created)
**Test:**
```bash
# Test 1: User task triggers clarification
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"display_id":"TEST-001","title":"make it faster","task_list_id":"default"}'
# Expected: Task status becomes 'blocked' within 1 second

# Test 2: Agent task bypasses clarification
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"display_id":"TEST-002","title":"make it faster","task_list_id":"default","created_by":"planning_agent"}'
# Expected: Task status remains 'pending'
```

### 3. Integrates with QuestionEngine to generate questions
**Verification:**
- ✅ `triggerClarificationWorkflow()` generates targeted questions
- ✅ Questions sent via Telegram with context
- ⚠️ QuestionEngine used for basic questions (enhanced version can integrate deeper)

### 4. User responses stored and used to refine task definition
**Test:**
```bash
# Simulate Telegram answer
curl -X POST http://localhost:3333/api/clarifications/<request_id>/answer \
  -H "Content-Type: application/json" \
  -d '{"answer":"Optimize DB queries in api.ts. Target: <200ms response time."}'

# Check task updated
sqlite3 parent-harness/data/harness.db "SELECT description FROM tasks WHERE display_id='TEST-001';"
# Expected: Description includes clarification
```

### 5. Well-defined tasks enter queue after clarification complete
**Verification:**
```bash
# Check task unblocked
sqlite3 parent-harness/data/harness.db "SELECT status FROM tasks WHERE display_id='TEST-001';"
# Expected: status='pending'

# Check task in queue
curl http://localhost:3333/api/tasks/pending
# Expected: TEST-001 appears in list
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (2 hours)
1. ✅ Create `clarification/vagueness-checker.ts`
2. ✅ Create `clarification/workflow.ts`
3. ✅ Modify `api/tasks.ts` to add vagueness check hook
4. ✅ Modify `clarification/index.ts` to enrich task descriptions

### Phase 2: Testing (2 hours)
5. ✅ Unit tests for vagueness detection
6. ✅ Integration tests for workflow
7. ✅ Manual testing with Telegram bot

### Phase 3: Refinement (2 hours)
8. ✅ Tune vagueness threshold based on test results
9. ✅ Add QuestionEngine integration (optional enhancement)
10. ✅ Add timeout handling for expired clarifications

### Phase 4: Documentation (1 hour)
11. ✅ Update CRITICAL_GAPS.md (mark Gap #1 as implemented)
12. ✅ Add clarification workflow diagram
13. ✅ Update API documentation

**Total Effort:** 6-8 hours

---

## Dependencies

### Code Dependencies
- ✅ `agents/ideation/vagueness-detector.ts` - Reuse
- ✅ `server/services/task-agent/question-engine.ts` - Reference
- ✅ `parent-harness/orchestrator/src/clarification/index.ts` - Extend
- ✅ `parent-harness/orchestrator/src/agents/metadata.ts` - Already configured

### System Dependencies
- ✅ Telegram bot: `@vibe-clarification` - Already configured
- ✅ SQLite database - Already in use
- ✅ Claude API (Sonnet) - Already available

### No Blocking Dependencies!

---

## Testing Strategy

### Unit Tests

**File:** `parent-harness/orchestrator/src/clarification/__tests__/vagueness-checker.test.ts`

```typescript
describe('checkTaskVagueness', () => {
  it('flags vague user tasks', async () => {
    const task = {
      id: '1',
      display_id: 'TEST-001',
      title: 'make it faster',
      description: '',
      created_by: 'human',
    };
    const result = await checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });

  it('bypasses agent-created tasks', async () => {
    const task = {
      id: '2',
      display_id: 'TEST-002',
      title: 'make it faster',
      description: '',
      created_by: 'build_agent',
    };
    const result = await checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(false);
  });

  it('accepts clear tasks', async () => {
    const task = {
      id: '3',
      display_id: 'TEST-003',
      title: 'Optimize /api/ideas endpoint query',
      description: 'Current response time: 850ms. Target: <200ms. Add index on ideas.created_at.',
      created_by: 'human',
    };
    const result = await checkTaskVagueness(task);
    expect(result.shouldClarify).toBe(false);
  });
});
```

### Integration Tests

**File:** `parent-harness/orchestrator/src/clarification/__tests__/workflow.test.ts`

```typescript
describe('Clarification Workflow', () => {
  it('E2E: vague task → clarification → answer → unblock', async () => {
    // 1. Create vague task
    const task = createTask({
      display_id: 'TEST-VAGUE-001',
      title: 'improve UI',
      description: 'make it better',
      task_list_id: 'test-list',
      created_by: 'human',
    });

    // 2. Wait for async workflow
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Check task blocked
    const blocked = getTask(task.id);
    expect(blocked.status).toBe('blocked');

    // 4. Check clarification exists
    const requests = getTaskClarifications(task.id);
    expect(requests.length).toBe(1);

    // 5. Answer clarification
    await answerClarification(
      requests[0].id,
      'Update TaskForm.tsx validation. Add error messages for required fields.',
      'test-user'
    );

    // 6. Check task unblocked
    const unblocked = getTask(task.id);
    expect(unblocked.status).toBe('pending');
    expect(unblocked.description).toContain('Clarification');
  });
});
```

---

## Success Metrics

Track these after 2 weeks of operation:

1. **Clarification Rate:** 15-25% of user tasks trigger clarification
   - Too low (<10%) → Threshold too high, missing vague tasks
   - Too high (>40%) → Threshold too low, false positives

2. **False Positive Rate:** <5% of specific tasks incorrectly flagged
   - Monitor: Tasks flagged as vague that user skips immediately

3. **Response Time:** 90% of clarifications answered within 4 hours
   - Monitor: `answered_at - created_at` from database

4. **Build Failure Reduction:** 30% fewer failed tasks due to unclear requirements
   - Compare: Failed tasks before/after implementation

5. **User Satisfaction:** Positive feedback on Telegram clarification UX
   - Monitor: `/skip` rate vs `/answer` rate

---

## Risks & Mitigations

### Risk 1: False Positives
**Impact:** High - Annoys users with unnecessary questions
**Mitigation:**
- Start with conservative threshold (0.4)
- Allow instant `/skip` command
- Monitor false positive rate, tune threshold

### Risk 2: Telegram Bot Downtime
**Impact:** Medium - Clarifications lost
**Mitigation:**
- Persist all clarifications to database
- Fallback: Log + auto-expire after timeout
- Allow manual clarification retrieval

### Risk 3: Vagueness Detector Too Aggressive
**Impact:** Medium - Blocks too many tasks
**Mitigation:**
- Monitor clarification rate metric
- Adjust scoring weights based on feedback
- Whitelist common patterns that are clear

---

## Future Enhancements

1. **Advanced QuestionEngine Integration**
   - Use QuestionEngine.analyzeGaps() for dynamic questions
   - Generate context-aware questions based on task category

2. **Multi-Turn Clarification**
   - Ask follow-up questions based on initial answers
   - Adaptive questioning flow

3. **Suggested Answer Options**
   - Telegram inline keyboard with common choices
   - Reduces typing burden

4. **Frontend UI**
   - Display clarification history in task detail view
   - Allow answering via web interface

5. **Learning System**
   - Track which questions lead to successful implementations
   - Improve question generation over time

---

## References

- **CRITICAL_GAPS.md:** Gap #1 (lines 7-31)
- **Existing Specs:** TASK-029-clarification-agent.md, TASK-029-clarification-agent-implementation.md
- **Clarification System:** `parent-harness/orchestrator/src/clarification/index.ts`
- **Vagueness Detector:** `agents/ideation/vagueness-detector.ts`
- **Question Engine:** `server/services/task-agent/question-engine.ts`
- **Agent Metadata:** `parent-harness/orchestrator/src/agents/metadata.ts` (lines 283-306)

---

## Approval

**Spec Author:** Spec Agent
**Status:** Ready for Implementation
**Next Step:** Hand off to Build Agent for implementation

**Key Decision:** Start with basic question generation (hardcoded questions) in v1, add full QuestionEngine integration in v2 after validating the workflow.
