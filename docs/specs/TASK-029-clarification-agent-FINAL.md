# TASK-029: Clarification Agent - Automatic Vagueness Detection & Triggering

**Status:** Final Specification
**Priority:** P1 (Critical Gap #1 from CRITICAL_GAPS.md)
**Effort:** Medium (6-9 hours)
**Created:** 2026-02-08
**Updated:** 2026-02-09
**Agent:** clarification_agent (Sonnet model)

---

## Executive Summary

Implement automatic vagueness detection and clarification workflow for user-created tasks. When users create vague tasks (e.g., "make it faster", "add authentication"), the system will automatically detect ambiguity, generate targeted questions, block task execution, and wait for user responses before proceeding.

**Key Insight from QA Validation:** The clarification infrastructure (database, API endpoints, QuestionEngine, Telegram bot) already exists. The missing piece is the **automatic trigger mechanism** that detects vague tasks at creation time and invokes the clarification workflow.

---

## Problem Statement

**Current State:**
- Users create vague tasks like "improve performance" or "add auth"
- Tasks immediately proceed to Build Agent execution
- Build Agent makes incorrect assumptions
- Multiple retry cycles required to clarify requirements
- Wasted token budget and implementation time

**Desired State:**
- Vague tasks automatically detected at creation time
- System generates targeted clarifying questions
- Task blocked until user provides answers
- Well-defined task proceeds to execution with complete context

---

## Current Infrastructure Analysis

### ✅ Already Implemented

1. **Clarification Database & API** (`parent-harness/orchestrator/src/clarification/index.ts`)
   - `clarification_requests` table with full schema
   - `requestClarification()` - blocks task, sends Telegram notification
   - `answerClarification()` - unblocks task, stores answer
   - `skipClarification()` - timeout handling
   - Telegram integration with `@vibe-clarification` bot

2. **Question Engine** (`server/services/task-agent/question-engine.ts`)
   - 8 question categories (outcome, scope, implementation, dependencies, testing, risks, acceptance, context)
   - `analyzeGaps()` - identifies missing information
   - `generateQuestions()` - creates targeted questions with priority
   - `processAnswer()` - extracts structured info (file paths, acceptance criteria)
   - `applyAnswers()` - updates task with extracted information
   - `task_questions` table for persistence

3. **Vagueness Detector** (`agents/ideation/vagueness-detector.ts`)
   - Pattern detection (hedging, non-committal, unclear language)
   - Vagueness scoring (0-1 scale)
   - Message classification

4. **Agent Metadata** (`parent-harness/orchestrator/src/agents/metadata.ts`)
   - `clarification_agent` configured with Sonnet model
   - Read-only tools (prevents code modification)
   - Telegram bot: `@vibe-clarification`

### ❌ Missing Components (What This Task Must Implement)

1. **Automatic Triggering** - No hook to detect vague tasks at creation time
2. **Source Filtering** - No logic to bypass agent-created tasks
3. **Question Integration** - QuestionEngine not integrated with clarification workflow
4. **Answer Processing** - Clarification answers not processed to enrich task description

---

## Requirements

### Functional Requirements

**FR-1: Automatic Vagueness Detection on Task Creation**
- Trigger on all task creation events (API and internal)
- Multi-factor vagueness scoring:
  - Word count (< 10 words = penalty)
  - Pattern matching (vagueness-detector.ts)
  - QuestionEngine gap analysis
- Combined threshold: score ≥ 0.4 triggers clarification
- Non-blocking async check (doesn't slow down task creation)

**FR-2: Source-Based Bypass Logic**
- Only trigger for user-created tasks
- User tasks: `created_by = 'human'` or `created_by IS NULL` or via API
- Agent tasks: `created_by = '<agent_id>'` → bypass clarification
- Prevents infinite loops (clarification agent asking about its own tasks)

**FR-3: QuestionEngine Integration**
- Use `QuestionEngine.analyzeGaps()` to identify missing categories
- Call `QuestionEngine.generateQuestions(task, 5)` for 3-5 targeted questions
- Prioritize: required > important > optional
- Focus categories: outcome, acceptance, scope, dependencies
- Store questions in `task_questions` table

**FR-4: Task Blocking During Clarification**
- Set `task.status = 'blocked'` when clarification requested
- Store `clarification_request_id` in task metadata (optional)
- Prevent Build Agent assignment while blocked
- Database consistency: blocked task MUST have pending clarification request

**FR-5: Telegram Human-in-the-Loop**
- Send formatted questions to `@vibe-clarification` bot
- Include task ID, title, context
- Support commands:
  - `/answer <text>` - Answer current clarification
  - `/skip` - Skip and proceed with best guess
  - `/clarifications` - List pending clarifications
- 24-hour timeout → auto-skip if no response

**FR-6: Answer Processing & Task Enrichment**
- Store answer in `clarification_requests.answer`
- Call `QuestionEngine.processAnswer()` to extract:
  - File paths → `task_impacts` table
  - Acceptance criteria → append to task description
  - Dependencies → `task_relationships` table
- Update task description with clarified details
- Unblock task: `status = 'pending'`
- Trigger task queue refresh

### Non-Functional Requirements

**NFR-1: Performance**
- Vagueness detection: < 500ms (non-blocking)
- Question generation: < 2s
- Zero impact on agent-created task speed

**NFR-2: Reliability**
- Graceful Telegram failures (log and proceed)
- Persist state across orchestrator restarts
- Resume pending clarifications on startup
- Database consistency validation (no orphaned blocked tasks)

**NFR-3: User Experience**
- Clear, non-technical question phrasing
- Suggested options where applicable
- Timeout prevents indefinite blocking
- Rich Telegram formatting (bold, code blocks)

---

## Technical Design

### Architecture Flow

```
User creates task (POST /api/tasks OR Planning Agent)
    ↓
1. Task created in database (status='pending')
    ↓
2. Async: checkTaskVagueness(task)
    ↓
   Source check → If created_by matches agent ID → BYPASS (exit)
    ↓
   Vagueness analysis:
     - Pattern detection (vagueness-detector)
     - Gap analysis (QuestionEngine.analyzeGaps)
     - Word count check
     - Combined score calculation
    ↓
   If score < 0.4 → BYPASS (exit)
    ↓
3. Generate questions:
   QuestionEngine.generateQuestions(task, 5)
    ↓
4. Request clarification:
   - Set task.status = 'blocked'
   - Create clarification_request record
   - Send to Telegram with questions
    ↓
5. Wait for user response (async, up to 24h)
    ↓
6. User answers via Telegram → answerClarification()
    ↓
7. Process answer:
   - QuestionEngine.processAnswer() → extract info
   - QuestionEngine.applyAnswers() → update task
   - Append to task description
    ↓
8. Unblock task:
   - Set task.status = 'pending'
   - Task enters normal execution queue
```

### Implementation Components

#### Component 1: Vagueness Analyzer Service

**File:** `parent-harness/orchestrator/src/services/vagueness-analyzer.ts` (NEW)

```typescript
import { detectVagueness } from '../../../agents/ideation/vagueness-detector.js';
import { QuestionEngine } from '../../../server/services/task-agent/question-engine.js';
import { Task } from '../db/tasks.js';

export interface VaguenessScore {
  isVague: boolean;
  score: number; // 0-1
  reasons: string[];
  gapAnalysis: {
    missingCategories: string[];
    gapScore: number;
  };
}

export async function analyzeTaskVagueness(task: Task): Promise<VaguenessScore> {
  const text = `${task.title}. ${task.description || ''}`;

  // 1. Pattern-based vagueness detection
  const patternAnalysis = detectVagueness(text);

  // 2. QuestionEngine gap analysis
  const qe = new QuestionEngine();
  const gapAnalysis = await qe.analyzeGaps(task);

  // 3. Length check
  const wordCount = text.split(/\s+/).length;
  const lengthPenalty = wordCount < 10 ? 0.2 : 0;

  // 4. Combined scoring (weighted average)
  const combinedScore = Math.min(1.0,
    patternAnalysis.score * 0.4 +           // Pattern weight: 40%
    (1 - gapAnalysis.gapScore / 100) * 0.4 + // Gap weight: 40%
    lengthPenalty * 0.2                      // Length weight: 20%
  );

  const reasons = [
    ...patternAnalysis.reasons,
    ...gapAnalysis.recommendations,
    wordCount < 10 ? `Very short description (${wordCount} words)` : null
  ].filter(Boolean) as string[];

  return {
    isVague: combinedScore >= 0.4,
    score: combinedScore,
    reasons,
    gapAnalysis: {
      missingCategories: gapAnalysis.missingCategories,
      gapScore: gapAnalysis.gapScore,
    },
  };
}
```

**Purpose:** Combines multiple detection methods into single vagueness score.

**Dependencies:**
- `agents/ideation/vagueness-detector.ts` (existing)
- `server/services/task-agent/question-engine.ts` (existing)

**Tests:** `__tests__/services/vagueness-analyzer.test.ts`
- Short vague task → score ≥ 0.4
- Detailed specific task → score < 0.4
- Edge cases: empty description, special characters

---

#### Component 2: Clarification Hook

**File:** `parent-harness/orchestrator/src/hooks/clarification-hook.ts` (NEW)

```typescript
import { Task } from '../db/tasks.js';
import { analyzeTaskVagueness } from '../services/vagueness-analyzer.js';
import { requestClarification } from '../clarification/index.js';
import { QuestionEngine } from '../../../server/services/task-agent/question-engine.js';

/**
 * Hook: After task creation, check if clarification needed
 * Called asynchronously (non-blocking)
 */
export async function onTaskCreated(task: Task): Promise<void> {
  try {
    // Skip for agent-created tasks
    if (task.created_by && task.created_by !== 'human' && task.created_by !== 'user') {
      console.log(`⏩ Skipping clarification for agent-created task: ${task.display_id} (created_by: ${task.created_by})`);
      return;
    }

    // Analyze vagueness
    const vagueness = await analyzeTaskVagueness(task);

    if (!vagueness.isVague) {
      console.log(`✅ Task ${task.display_id} is clear (score: ${vagueness.score.toFixed(2)})`);
      return;
    }

    console.log(`❓ Task ${task.display_id} is vague (score: ${vagueness.score.toFixed(2)})`);
    console.log(`   Reasons: ${vagueness.reasons.join(', ')}`);

    // Generate clarifying questions
    const qe = new QuestionEngine();
    const questions = await qe.generateQuestions(task, 5); // Max 5 questions

    if (questions.length === 0) {
      console.log(`⚠️ No questions generated for ${task.display_id}, proceeding without clarification`);
      return;
    }

    // Format questions for Telegram
    const questionText = questions
      .map((q, i) => `${i + 1}. ${q.text}`)
      .join('\n');

    // Request clarification (blocks task + sends Telegram notification)
    await requestClarification(
      task.id,
      `This task needs clarification. Please answer:\n\n${questionText}`,
      {
        context: `Vagueness score: ${vagueness.score.toFixed(2)}\nMissing categories: ${vagueness.gapAnalysis.missingCategories.join(', ')}`,
        expiresInHours: 24,
      }
    );

    console.log(`✅ Clarification workflow triggered for ${task.display_id} (${questions.length} questions)`);
  } catch (error) {
    console.error(`❌ Clarification hook failed for ${task.display_id}:`, error);
    // Don't throw - allow task to proceed if clarification fails
  }
}
```

**Purpose:** Main orchestration logic for automatic clarification triggering.

**Error Handling:** Graceful degradation - if clarification fails, task proceeds normally.

**Tests:** `__tests__/hooks/clarification-hook.test.ts`
- Vague user task → clarification requested
- Clear user task → bypass
- Agent task → bypass
- QuestionEngine failure → graceful fallback

---

#### Component 3: Task API Integration

**File:** `parent-harness/orchestrator/src/api/tasks.ts` (MODIFY)

```typescript
import { onTaskCreated } from '../hooks/clarification-hook.js';

// In POST /api/tasks endpoint (after task creation):

const task = tasks.createTask({
  display_id,
  title,
  description,
  category,
  priority,
  task_list_id,
  parent_task_id,
  pass_criteria,
  created_by: 'user', // Mark API-created tasks as user-created
});

// Trigger clarification hook (async, non-blocking)
setImmediate(() => {
  onTaskCreated(task).catch(err => {
    console.error(`Clarification hook error for ${task.display_id}:`, err);
  });
});

res.status(201).json(task);
```

**Purpose:** Integrate hook into task creation flow without blocking API response.

**Tests:** Integration test for full workflow

---

#### Component 4: Enhanced Answer Processing

**File:** `parent-harness/orchestrator/src/clarification/index.ts` (MODIFY)

```typescript
// Modify answerClarification function to process answers with QuestionEngine

import { QuestionEngine } from '../../../server/services/task-agent/question-engine.js';

export async function answerClarification(
  requestId: string,
  answer: string,
  answeredBy?: string
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== 'pending') {
    return undefined;
  }

  // Store answer
  run(`
    UPDATE clarification_requests
    SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
    WHERE id = ?
  `, [answer, answeredBy ?? 'human', requestId]);

  // NEW: Process answer with QuestionEngine
  const task = tasks.getTask(request.task_id);
  if (task) {
    try {
      const qe = new QuestionEngine();
      const processed = await qe.processAnswer(request.task_id, requestId, answer);

      // Apply extracted information to task
      await qe.applyAnswers(request.task_id, [
        { questionId: requestId, answer, answeredAt: new Date().toISOString() }
      ]);

      // Enrich task description with extracted info
      let enhancedDescription = task.description || '';

      if (processed.extractedInfo.acceptanceCriteria) {
        const criteria = processed.extractedInfo.acceptanceCriteria as string[];
        enhancedDescription += `\n\n**Acceptance Criteria (from clarification):**\n${criteria.map(c => `- ${c}`).join('\n')}`;
      }

      if (processed.extractedInfo.mentionedFiles) {
        const files = processed.extractedInfo.mentionedFiles as string[];
        enhancedDescription += `\n\n**Files to modify:** ${files.join(', ')}`;
      }

      // Update task with enriched description
      tasks.updateTask(task.id, { description: enhancedDescription });

      console.log(`✅ Task ${task.display_id} enriched with clarification data`);
    } catch (error) {
      console.error(`⚠️ Failed to process answer for ${task.display_id}:`, error);
      // Continue anyway - unblock task even if processing fails
    }
  }

  // Unblock the task
  tasks.updateTask(request.task_id, { status: 'pending' });

  console.log(`✅ Clarification answered for request ${requestId}`);

  return getClarificationRequest(requestId);
}
```

**Purpose:** Extract structured information from answers and enrich task definition.

**Tests:** Unit test for answer processing logic

---

#### Component 5: Database Consistency Check

**File:** `parent-harness/orchestrator/src/orchestrator/index.ts` (MODIFY)

```typescript
import { query, run } from '../db/index.js';

// Add to orchestrator startup:

async function validateTaskClarificationConsistency(): Promise<void> {
  // Find blocked tasks without pending clarification requests
  const orphanedBlocked = query<{ id: string; display_id: string }>(`
    SELECT t.id, t.display_id
    FROM tasks t
    LEFT JOIN clarification_requests cr ON t.id = cr.task_id AND cr.status = 'pending'
    WHERE t.status = 'blocked' AND cr.id IS NULL
  `);

  if (orphanedBlocked.length > 0) {
    console.warn(`⚠️ Found ${orphanedBlocked.length} blocked tasks without clarification requests - auto-unblocking`);
    for (const task of orphanedBlocked) {
      run(`UPDATE tasks SET status = 'pending' WHERE id = ?`, [task.id]);
      console.log(`  Unblocked: ${task.display_id}`);
    }
  }
}

// Call during startup
await validateTaskClarificationConsistency();
```

**Purpose:** Prevent stuck tasks due to database inconsistencies (as happened with TASK-029).

---

## Database Schema

### No Schema Changes Required! ✅

All necessary tables already exist:

1. **`tasks` table** - Has `created_by` field for source tracking
2. **`clarification_requests` table** - Full schema with all needed fields
3. **`task_questions` table** - For QuestionEngine persistence
4. **`task_impacts` table** - For extracted file path storage

**Note:** Code uses `created_by` field to track task source (user vs agent).

---

## Pass Criteria

### ✅ Pass Criterion 1: New clarification_agent implemented using Sonnet model

**Already Complete** - Agent exists in `agents/metadata.ts`:
```typescript
clarification_agent: {
  name: 'clarification_agent',
  defaultModel: 'sonnet',
  telegramBotName: 'clarification',
  tools: ['Read'],
  // ...
}
```

**Verification:**
```bash
grep -A 15 "clarification_agent:" parent-harness/orchestrator/src/agents/metadata.ts
```

---

### ✅ Pass Criterion 2: Agent triggers on new user-created tasks (bypass for agent-created)

**Implementation Required:**
- ✅ `onTaskCreated()` hook checks `task.created_by` field
- ✅ Bypasses if `created_by` is not 'human' or 'user'
- ✅ API sets `created_by = 'user'` for all API-created tasks
- ✅ Agents set `created_by = '<agent_id>'` when creating tasks

**Verification:**
```bash
# Test 1: User task triggers clarification
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "TEST-VAGUE-001",
    "title": "make it faster",
    "description": "slow",
    "task_list_id": "<list-id>"
  }'
# Expected: Task status → 'blocked' within 1 second

# Test 2: Agent task bypasses clarification
# (Create task with created_by = 'planning_agent')
# Expected: Task status remains 'pending'
```

---

### ✅ Pass Criterion 3: Integrates with QuestionEngine to generate questions

**Implementation Required:**
- ✅ `onTaskCreated()` calls `QuestionEngine.generateQuestions(task, 5)`
- ✅ Questions filtered by importance (required + important)
- ✅ Questions persisted to `task_questions` table
- ✅ Questions sent via Telegram with context

**Verification:**
```bash
# After creating vague task, check database
sqlite3 parent-harness/data/harness.db \
  "SELECT category, text, importance FROM task_questions
   WHERE task_id = (SELECT id FROM tasks WHERE display_id = 'TEST-VAGUE-001')"
# Expected: 3-5 questions with categories and importance levels
```

---

### ✅ Pass Criterion 4: User responses stored and used to refine task definition

**Implementation Required:**
- ✅ Answers stored in `clarification_requests.answer`
- ✅ `answerClarification()` calls `QuestionEngine.processAnswer()`
- ✅ Extracted info (acceptance criteria, file paths) appended to task description
- ✅ File impacts saved to `task_impacts` table

**Verification:**
```bash
# Simulate answer
curl -X POST http://localhost:3333/api/clarifications/answer \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "<clarification_request_id>",
    "answer": "Optimize database queries in server/api.ts. Response time should be <200ms. Tests: verify /api/ideas endpoint."
  }'

# Check task updated
sqlite3 parent-harness/data/harness.db \
  "SELECT description FROM tasks WHERE display_id = 'TEST-VAGUE-001'"
# Expected: Description includes "Acceptance Criteria" section
```

---

### ✅ Pass Criterion 5: Well-defined tasks enter queue after clarification complete

**Implementation Required:**
- ✅ Task status changes from 'blocked' to 'pending' after answer
- ✅ Task appears in `getPendingTasks()` query
- ✅ Orchestrator can assign task to Build Agent
- ✅ Expired clarifications (24h timeout) also unblock task

**Verification:**
```bash
# After answering clarification
curl http://localhost:3333/api/tasks/pending
# Expected: TEST-VAGUE-001 appears in pending tasks list

# Check task status
sqlite3 parent-harness/data/harness.db \
  "SELECT status, assigned_agent_id FROM tasks WHERE display_id = 'TEST-VAGUE-001'"
# Expected: status='pending', assigned_agent_id=NULL
```

---

## Dependencies

### Code Dependencies (All Existing ✅)

1. **Vagueness Detector** - `agents/ideation/vagueness-detector.ts`
2. **Question Engine** - `server/services/task-agent/question-engine.ts`
3. **Clarification System** - `parent-harness/orchestrator/src/clarification/index.ts`
4. **Telegram Bot** - `parent-harness/orchestrator/src/telegram/index.ts`

### Database Dependencies (All Existing ✅)

1. **`tasks` table** - with `created_by` field
2. **`clarification_requests` table**
3. **`task_questions` table**
4. **`task_impacts` table**

### External Dependencies

- Telegram Bot API (already configured)
- Claude API (Sonnet access for clarification_agent)

---

## Testing Strategy

### Unit Tests

**File:** `parent-harness/orchestrator/src/__tests__/clarification-workflow.test.ts`

```typescript
describe('Clarification Agent', () => {
  describe('Vagueness Detection', () => {
    it('detects vague short tasks', async () => {
      const task = { title: 'Make it faster', description: '', created_by: 'user' };
      const result = await analyzeTaskVagueness(task);
      expect(result.isVague).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.4);
    });

    it('accepts detailed specific tasks', async () => {
      const task = {
        title: 'Optimize database query in server/api.ts',
        description: 'The /api/ideas endpoint takes 850ms. Add index on ideas.created_at...',
        created_by: 'user'
      };
      const result = await analyzeTaskVagueness(task);
      expect(result.isVague).toBe(false);
      expect(result.score).toBeLessThan(0.4);
    });
  });

  describe('Source Filtering', () => {
    it('bypasses agent-created tasks', async () => {
      const task = {
        title: 'Vague task',
        description: 'Do something',
        created_by: 'planning_agent'
      };
      await onTaskCreated(task);
      // Should not create clarification request
      const clarifications = getTaskClarifications(task.id);
      expect(clarifications.length).toBe(0);
    });

    it('triggers for user-created tasks', async () => {
      const task = {
        title: 'Fix bug',
        description: 'App broken',
        created_by: 'user'
      };
      await onTaskCreated(task);
      // Should create clarification request
      const clarifications = getTaskClarifications(task.id);
      expect(clarifications.length).toBe(1);
    });
  });

  describe('Question Generation', () => {
    it('generates 3-5 questions for vague task', async () => {
      const task = { title: 'Add auth', description: '', id: 'test-123' };
      const qe = new QuestionEngine();
      const questions = await qe.generateQuestions(task, 5);
      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Answer Processing', () => {
    it('unblocks task when answered', async () => {
      // Create blocked task with clarification
      const task = createTask({
        display_id: 'TEST-001',
        title: 'Fix perf',
        created_by: 'user'
      });
      const request = await requestClarification(task.id, 'What should be faster?');

      // Answer
      await answerClarification(request.id, 'API response times');

      // Verify unblocked
      const updated = getTask(task.id);
      expect(updated.status).toBe('pending');
    });

    it('enriches task description with answer', async () => {
      const task = createTask({ display_id: 'TEST-002', title: 'Add feature' });
      const request = await requestClarification(task.id, 'What feature?');

      await answerClarification(
        request.id,
        'Add login form in frontend/src/Login.tsx. Must validate email format.'
      );

      const updated = getTask(task.id);
      expect(updated.description).toContain('frontend/src/Login.tsx');
    });
  });
});
```

### Integration Tests

**File:** `tests/integration/clarification-e2e.test.ts`

```typescript
describe('Clarification E2E', () => {
  it('full workflow: vague task → clarification → answer → unblock', async () => {
    // 1. Create vague task
    const response = await fetch('http://localhost:3333/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_id: 'E2E-001',
        title: 'improve performance',
        description: 'make it faster',
        task_list_id: 'test-list'
      })
    });
    const task = await response.json();

    // 2. Wait for async clarification hook
    await sleep(500);

    // 3. Verify task blocked
    const blocked = await getTask(task.id);
    expect(blocked.status).toBe('blocked');

    // 4. Get pending clarification
    const clarifications = getPendingClarifications();
    expect(clarifications.length).toBeGreaterThan(0);

    // 5. Answer clarification
    await answerClarification(
      clarifications[0].id,
      'Optimize API endpoints. Target: <200ms response time. Test: load test with 100 concurrent users.'
    );

    // 6. Verify unblocked
    const unblocked = await getTask(task.id);
    expect(unblocked.status).toBe('pending');
    expect(unblocked.description).toContain('Acceptance Criteria');
  });
});
```

### Manual Testing Checklist

- [ ] Create vague task via API → Task status changes to 'blocked' within 1s
- [ ] Telegram bot receives formatted questions
- [ ] Answer via `/answer` command → Task unblocked
- [ ] Task description enriched with extracted info
- [ ] Create clear task → No clarification triggered
- [ ] Create agent task (source='planning_agent') → Bypass clarification
- [ ] Timeout after 24h → Task auto-unblocked with warning
- [ ] Database consistency: no orphaned blocked tasks on restart

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 hours)

1. ✅ Create `vagueness-analyzer.ts` service
   - Implement `analyzeTaskVagueness()` function
   - Combine pattern detection + gap analysis + length check
   - Write unit tests

2. ✅ Create `clarification-hook.ts`
   - Implement `onTaskCreated()` hook
   - Source filtering logic
   - Question generation integration
   - Error handling

3. ✅ Integrate hook into task creation flow
   - Modify `api/tasks.ts` POST endpoint
   - Modify `db/tasks.ts` to ensure `created_by` field populated
   - Add async hook trigger (non-blocking)

### Phase 2: Answer Processing (1-2 hours)

4. ✅ Enhance `answerClarification()` function
   - Add QuestionEngine processing
   - Extract structured information
   - Enrich task description
   - Write unit tests

5. ✅ Add database consistency check
   - Implement `validateTaskClarificationConsistency()`
   - Add to orchestrator startup
   - Test recovery from inconsistent state

### Phase 3: Testing (2-3 hours)

6. ✅ Write unit tests
   - Vagueness analyzer tests
   - Clarification hook tests
   - Answer processing tests

7. ✅ Write integration tests
   - Full E2E workflow test
   - Edge case coverage

8. ✅ Manual testing
   - Telegram bot integration
   - Timeout handling
   - Task enrichment

### Phase 4: Documentation (1 hour)

9. ✅ Update CRITICAL_GAPS.md (mark Gap #1 as resolved)
10. ✅ Update agent metadata documentation
11. ✅ Create troubleshooting guide

**Total Estimated Effort:** 6-9 hours

---

## Risks & Mitigations

### Risk 1: False Positives (Clear tasks flagged as vague)
**Impact:** High (user frustration)
**Mitigation:**
- Start with threshold 0.4 (tune based on data)
- Combine multiple detection methods
- Allow quick `/skip` command
- Track false positive rate in production

### Risk 2: QuestionEngine Overhead
**Impact:** Medium (slows task creation)
**Mitigation:**
- Async hook (non-blocking)
- Cache QuestionEngine instance
- Limit to 5 questions max
- Timeout after 2 seconds

### Risk 3: Telegram Bot Downtime
**Impact:** Medium (clarifications lost)
**Mitigation:**
- Persist clarifications in database
- Fallback to logs if Telegram fails
- Resume pending clarifications on startup
- 24h timeout prevents indefinite blocking

### Risk 4: Database Inconsistency
**Impact:** Critical (tasks stuck blocked)
**Mitigation:**
- Startup consistency validation
- Orphaned task detection
- Auto-unblock recovery
- Prevent future by enforcing consistency in `updateTask()`

---

## Future Enhancements

1. **Multi-Turn Clarification** - Ask follow-up questions based on answers
2. **Suggested Answer Options** - Telegram inline keyboard with common answers
3. **Clarification Analytics** - Track skip rate, avg response time, question effectiveness
4. **Frontend Integration** - Display clarification history in task detail view
5. **Proactive Mid-Task Clarification** - Allow Build Agent to request clarification during execution

---

## References

- **CRITICAL_GAPS.md** - Gap #1: User Task Clarification Agent
- **FIX-TASK-029-SIA-RESOLUTION.md** - Root cause analysis of blocking issue
- **Existing Specifications:**
  - `TASK-029-clarification-agent.md`
  - `TASK-029-clarification-agent-implementation.md`
- **Existing Code:**
  - `parent-harness/orchestrator/src/clarification/index.ts` (clarification system)
  - `server/services/task-agent/question-engine.ts` (question generation)
  - `agents/ideation/vagueness-detector.ts` (pattern matching)
  - `parent-harness/orchestrator/src/agents/metadata.ts` (agent config)

---

## Approval & Sign-Off

**Spec Author:** Spec Agent
**Status:** ✅ Ready for Implementation
**Date:** 2026-02-09

**Key Takeaway:** The clarification infrastructure is complete. This task implements the **automatic trigger mechanism** that ties it all together. Implementation is straightforward - create 2 new files (vagueness-analyzer, clarification-hook) and modify 2 existing files (api/tasks, clarification/index).

---

## Summary for Build Agent

**What exists:** Database schema, clarification API, QuestionEngine, Telegram bot, vagueness detector

**What's missing:** Automatic triggering when vague tasks are created

**What to build:**
1. `vagueness-analyzer.ts` - Combines multiple detection methods
2. `clarification-hook.ts` - Orchestrates the workflow
3. Modify `api/tasks.ts` - Add async hook trigger
4. Modify `clarification/index.ts` - Add answer processing with QuestionEngine

**Core logic:** If `created_by == 'user'` AND `vagueness_score >= 0.4` → generate questions → block task → wait for Telegram answer → enrich task → unblock

**Total files:** 2 new, 2 modified, ~300 lines of code, 6-9 hours
