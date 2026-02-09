# TASK-029: Implement Clarification Agent for Vague Task Detection

**Status:** Specification
**Priority:** P1 (Critical Gap #1 from CRITICAL_GAPS.md)
**Effort:** Medium
**Created:** 2026-02-08

---

## Overview

Implement automatic vagueness detection and clarification workflow for user-created tasks. When users create vague tasks (e.g., "make it faster", "add authentication"), the Clarification Agent will automatically detect ambiguity, generate targeted questions using QuestionEngine, block task execution, and wait for user responses via Telegram before proceeding.

**Problem:** Currently, vague user tasks proceed directly to execution, leading to misaligned implementations that don't meet user intent.

**Solution:** Automatic interception + clarification loop before task execution begins.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Clarification System** (`parent-harness/orchestrator/src/clarification/index.ts`)
   - ✅ Database schema: `clarification_requests` table
   - ✅ Functions: `requestClarification()`, `answerClarification()`, `skipClarification()`
   - ✅ Task blocking: Sets task status to 'blocked' when clarification needed
   - ✅ Telegram integration: Sends questions to clarification bot
   - ✅ Plan approval workflow: Handles strategic plan approvals
   - ❌ **Gap:** No automatic triggering on vague tasks

2. **QuestionEngine** (`server/services/task-agent/question-engine.ts`)
   - ✅ 8 question categories: outcome, scope, implementation, dependencies, testing, risks, acceptance, context
   - ✅ Gap analysis: `analyzeGaps()` identifies missing information
   - ✅ Question generation: `generateQuestions()` creates targeted questions
   - ✅ Answer processing: `processAnswer()` extracts structured info
   - ✅ Database persistence: `task_questions` table
   - ❌ **Gap:** Not integrated with parent-harness clarification system

3. **Vagueness Detector** (`agents/ideation/vagueness-detector.ts`)
   - ✅ Pattern detection: hedging, non-committal, deflecting, unclear language
   - ✅ Scoring system: 0-1 vagueness score
   - ✅ Message classification: substantive, vague, confirmation, question, confused, short
   - ❌ **Gap:** Not used for task vagueness detection

4. **Agent Registry** (`parent-harness/orchestrator/src/agents/metadata.ts`)
   - ✅ `clarification_agent` metadata defined
   - ✅ Telegram bot configured: `@vibe-clarification`
   - ✅ Model: Sonnet (efficient for question generation)
   - ❌ **Gap:** Agent not implemented in spawner

5. **Task Schema** (`parent-harness/database/schema.sql`)
   - ✅ `created_by` field: Tracks task creator
   - ✅ `status` field: Supports 'blocked' state
   - ❌ **Gap:** No `source` field to differentiate user vs agent-created tasks

---

## Requirements

### Functional Requirements

**FR-1: Automatic Vagueness Detection**
- On task creation, analyze task title + description for vagueness
- Use multi-factor scoring:
  - Word count (< 10 words = high vagueness)
  - Pattern matching (hedging, unclear language)
  - QuestionEngine gap analysis (missing critical categories)
- Vagueness threshold: score ≥ 0.4 triggers clarification

**FR-2: Source-Based Triggering**
- Only trigger for user-created tasks (`created_by = 'human'` or `created_by IS NULL`)
- Bypass for agent-created tasks (`created_by = '<agent_id>'`)
- Rationale: Agents create well-structured tasks; humans may be vague

**FR-3: Question Generation via QuestionEngine**
- Use QuestionEngine's gap analysis to identify missing information
- Generate 3-5 targeted questions (priority: required > important > optional)
- Focus on high-priority categories: outcome, scope, acceptance, dependencies
- Format questions with suggested options where possible

**FR-4: Task Blocking During Clarification**
- Set task status to 'blocked' when clarification requested
- Prevent assignment to Build Agent until clarification complete
- Store clarification request ID in task metadata

**FR-5: Telegram-Based Human Loop**
- Send formatted questions to `@vibe-clarification` bot
- Include task ID, title, and numbered questions
- Support commands:
  - `/answer <question_num> <answer>` - Answer specific question
  - `/answer_all <answers>` - Answer all questions at once
  - `/skip` - Skip clarification and proceed with best guess
- Timeout: 24 hours → auto-skip if no response

**FR-6: Answer Processing & Task Enrichment**
- Store answers in `clarification_requests` table
- Use QuestionEngine to extract structured info (file paths, dependencies, acceptance criteria)
- Update task description with clarification context
- Unblock task (status: blocked → pending)
- Trigger task queue refresh

**FR-7: Clarification History**
- Store all questions + answers in database
- Link to task via `task_id` foreign key
- Display in task detail view (future frontend work)

### Non-Functional Requirements

**NFR-1: Performance**
- Vagueness detection: < 500ms
- Question generation: < 2s
- No impact on agent-created task creation speed

**NFR-2: Reliability**
- Handle Telegram bot failures gracefully (fallback: log + allow task)
- Persist state across orchestrator restarts
- Resume pending clarifications on startup

**NFR-3: User Experience**
- Clear, non-technical question phrasing
- Suggested options reduce cognitive load
- Timeout prevents indefinite blocking

---

## Technical Design

### Architecture

```
User creates task
    ↓
Task Created (via API or Planning Agent)
    ↓
[Vagueness Detector]
    ↓
Vague? → NO → Task enters queue normally
    ↓ YES
[QuestionEngine.analyzeGaps()]
    ↓
[QuestionEngine.generateQuestions(3-5)]
    ↓
[Clarification.requestClarification()]
    ↓ (blocks task, status → 'blocked')
[Telegram notification to @vibe-clarification]
    ↓
User answers via Telegram commands
    ↓
[Clarification.answerClarification()]
    ↓
[QuestionEngine.processAnswer()] → Extract structured info
    ↓
Update task description + metadata
    ↓
Task unblocked (status → 'pending')
    ↓
Task enters queue for Build Agent
```

### Implementation Components

#### 1. Vagueness Analyzer Service
**File:** `parent-harness/orchestrator/src/services/vagueness-analyzer.ts`

```typescript
import { detectVagueness } from '../../../agents/ideation/vagueness-detector.js';
import { QuestionEngine } from '../../../server/services/task-agent/question-engine.js';

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

  // 4. Combined scoring
  const combinedScore = Math.min(1.0,
    patternAnalysis.score * 0.4 +
    (1 - gapAnalysis.gapScore / 100) * 0.4 +
    lengthPenalty * 0.2
  );

  return {
    isVague: combinedScore >= 0.4,
    score: combinedScore,
    reasons: [
      ...patternAnalysis.reasons,
      ...gapAnalysis.recommendations,
      wordCount < 10 ? `Very short task (${wordCount} words)` : null
    ].filter(Boolean),
    gapAnalysis: {
      missingCategories: gapAnalysis.missingCategories,
      gapScore: gapAnalysis.gapScore,
    },
  };
}
```

#### 2. Enhanced Clarification Hook
**File:** `parent-harness/orchestrator/src/hooks/clarification-hook.ts`

```typescript
import { Task } from '../db/tasks.js';
import { analyzeTaskVagueness } from '../services/vagueness-analyzer.js';
import { requestClarification } from '../clarification/index.js';
import { QuestionEngine } from '../../../server/services/task-agent/question-engine.js';

/**
 * Hook: After task creation, check if clarification needed
 */
export async function onTaskCreated(task: Task): Promise<void> {
  // Skip for agent-created tasks
  if (task.created_by && task.created_by !== 'human') {
    console.log(`⏩ Skipping clarification for agent-created task: ${task.display_id}`);
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

  // Request clarification (blocks task)
  const questionText = questions
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join('\n');

  await requestClarification(task.id,
    `This task needs clarification. Please answer:\n\n${questionText}`,
    {
      context: `Vagueness score: ${vagueness.score.toFixed(2)}`,
      expiresInHours: 24,
    }
  );
}
```

#### 3. Telegram Command Handlers
**File:** `parent-harness/orchestrator/src/telegram/commands/clarification-commands.ts`

```typescript
import { answerClarification, skipClarification, getPendingClarifications } from '../../clarification/index.js';
import { QuestionEngine } from '../../../../server/services/task-agent/question-engine.js';

export function registerClarificationCommands(bot: TelegramBot) {
  // List pending clarifications
  bot.onText(/^\/clarifications$/, async (msg) => {
    const pending = getPendingClarifications();
    if (pending.length === 0) {
      return bot.reply(msg, '✅ No pending clarifications');
    }

    let message = `❓ Pending Clarifications (${pending.length}):\n\n`;
    for (const req of pending) {
      message += `📋 ${req.task_id}\n${req.question}\n\n`;
    }
    bot.reply(msg, message);
  });

  // Answer clarification
  bot.onText(/^\/answer\s+(.+)$/, async (msg, match) => {
    const answer = match[1];
    const pending = getPendingClarifications();

    if (pending.length === 0) {
      return bot.reply(msg, '⚠️ No pending clarifications');
    }

    const request = pending[0]; // Most recent
    await answerClarification(request.id, answer, msg.from?.username);

    bot.reply(msg, `✅ Answer recorded for ${request.task_id}`);
  });

  // Skip clarification
  bot.onText(/^\/skip$/, async (msg) => {
    const pending = getPendingClarifications();

    if (pending.length === 0) {
      return bot.reply(msg, '⚠️ No pending clarifications');
    }

    const request = pending[0];
    await skipClarification(request.id, 'Skipped by user');

    bot.reply(msg, `⏩ Clarification skipped for ${request.task_id}`);
  });
}
```

#### 4. Integration with Task Creation
**File:** `parent-harness/orchestrator/src/db/tasks.ts`

```typescript
// Add to createTask function:

export function createTask(data: CreateTaskInput): Task {
  // ... existing logic ...

  const task = getTask(id);

  // Trigger clarification hook (async, non-blocking)
  import('../hooks/clarification-hook.js').then(({ onTaskCreated }) => {
    onTaskCreated(task).catch(err => {
      console.error(`Clarification hook failed for ${task.display_id}:`, err);
    });
  });

  return task;
}
```

---

## Database Schema Changes

### New Fields

No schema changes required! Existing tables support all functionality:
- `tasks.created_by` - Already exists for source tracking
- `tasks.status` - Already supports 'blocked' state
- `clarification_requests` table - Already exists with all needed fields
- `task_questions` table - Already exists in Idea Incubator (may need migration to parent-harness)

### Optional Enhancement: Task Metadata

Add JSON metadata field for storing clarification context:

```sql
ALTER TABLE tasks ADD COLUMN metadata TEXT; -- JSON blob

-- Example metadata:
{
  "clarification": {
    "requested_at": "2026-02-08T10:30:00Z",
    "request_id": "uuid",
    "vagueness_score": 0.65,
    "questions_count": 4,
    "answered_at": "2026-02-08T11:15:00Z"
  }
}
```

---

## Pass Criteria

### Essential (Must Pass)

1. **Vagueness Detection**
   - ✅ Vague user task (< 10 words, generic) triggers clarification
   - ✅ Clear user task (detailed description) bypasses clarification
   - ✅ Agent-created task always bypasses clarification

2. **Question Generation**
   - ✅ QuestionEngine generates 3-5 targeted questions based on gaps
   - ✅ Questions prioritize: outcome, acceptance criteria, scope
   - ✅ Questions stored in `task_questions` table (if exists) or clarification context

3. **Task Blocking**
   - ✅ Task status set to 'blocked' when clarification requested
   - ✅ Blocked tasks excluded from Build Agent assignment queue
   - ✅ Task unblocked after clarification answered/skipped

4. **Telegram Integration**
   - ✅ Clarification questions sent to `@vibe-clarification` bot
   - ✅ `/answer`, `/skip`, `/clarifications` commands work correctly
   - ✅ Answers stored in database

5. **Answer Processing**
   - ✅ Answered clarifications unblock tasks (status: blocked → pending)
   - ✅ Task description enriched with clarification context
   - ✅ Skipped clarifications also unblock tasks

6. **Type Safety & Build**
   - ✅ TypeScript compilation passes (`npm run build`)
   - ✅ All tests pass (`npm test`)
   - ✅ No new linting errors

### Nice-to-Have (Optional)

- [ ] Frontend UI for viewing clarification history
- [ ] Suggested answer options in Telegram (inline keyboard)
- [ ] Multi-question answering in single command
- [ ] Clarification analytics (avg time to answer, skip rate)

---

## Dependencies

### Code Dependencies

1. **QuestionEngine** (`server/services/task-agent/question-engine.ts`)
   - Status: ✅ Exists
   - Action: Port or import into parent-harness if needed

2. **Vagueness Detector** (`agents/ideation/vagueness-detector.ts`)
   - Status: ✅ Exists
   - Action: Import into parent-harness services

3. **Clarification System** (`parent-harness/orchestrator/src/clarification/index.ts`)
   - Status: ✅ Exists
   - Action: Extend with automatic triggering logic

4. **Telegram Bot** (`parent-harness/orchestrator/src/telegram/`)
   - Status: ✅ Exists
   - Action: Add clarification command handlers

### Database Dependencies

- `clarification_requests` table - ✅ Already exists
- `task_questions` table - ⚠️ Exists in Idea Incubator, may need migration
- `tasks.created_by` field - ✅ Already exists

### Task Dependencies

- None (independent implementation)

---

## Testing Strategy

### Unit Tests

**File:** `tests/parent-harness/clarification-agent.test.ts`

```typescript
describe('Clarification Agent', () => {
  describe('Vagueness Detection', () => {
    it('detects vague tasks (< 10 words)', async () => {
      const task = { title: 'Make it faster', description: '' };
      const result = await analyzeTaskVagueness(task);
      expect(result.isVague).toBe(true);
      expect(result.score).toBeGreaterThan(0.4);
    });

    it('accepts clear tasks', async () => {
      const task = {
        title: 'Add OAuth authentication',
        description: 'Implement OAuth 2.0 login flow with Google provider...'
      };
      const result = await analyzeTaskVagueness(task);
      expect(result.isVague).toBe(false);
    });

    it('bypasses agent-created tasks', async () => {
      const task = { created_by: 'build_agent', title: 'Fix bug' };
      // Should not trigger clarification hook
    });
  });

  describe('Question Generation', () => {
    it('generates 3-5 questions for vague task', async () => {
      const task = { title: 'Add auth', description: '' };
      const qe = new QuestionEngine();
      const questions = await qe.generateQuestions(task, 5);
      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(5);
    });

    it('prioritizes required questions', async () => {
      // Test question importance ordering
    });
  });

  describe('Task Blocking', () => {
    it('sets task to blocked when clarification requested', async () => {
      // Test requestClarification() sets status = 'blocked'
    });

    it('unblocks task when answered', async () => {
      // Test answerClarification() sets status = 'pending'
    });
  });
});
```

### Integration Tests

**File:** `tests/integration/clarification-workflow.test.ts`

```typescript
describe('Clarification Workflow', () => {
  it('E2E: vague task → clarification → answer → unblock', async () => {
    // 1. Create vague task
    const task = createTask({
      display_id: 'TEST-001',
      title: 'Improve performance',
      created_by: 'human',
    });

    // 2. Wait for clarification hook
    await waitFor(() => task.status === 'blocked');

    // 3. Get pending clarifications
    const pending = getPendingClarifications();
    expect(pending.length).toBe(1);

    // 4. Answer clarification
    await answerClarification(pending[0].id, 'Focus on API response times');

    // 5. Verify task unblocked
    const updated = getTask(task.id);
    expect(updated.status).toBe('pending');
  });
});
```

### Manual Testing Checklist

- [ ] Create vague task via API → Telegram notification received
- [ ] Answer via `/answer <text>` → Task unblocked
- [ ] Create clear task → No clarification triggered
- [ ] Create task as build_agent → No clarification triggered
- [ ] Skip clarification → Task unblocked
- [ ] 24h timeout → Task auto-unblocked

---

## Risks & Mitigations

### Risk 1: False Positives (Clear tasks flagged as vague)
**Impact:** High (annoys users)
**Mitigation:**
- Tune vagueness threshold (start at 0.5, lower to 0.4 if too strict)
- Combine pattern detection + gap analysis + length check
- Allow quick `/skip` command

### Risk 2: QuestionEngine Overhead
**Impact:** Medium (slows task creation)
**Mitigation:**
- Run clarification hook asynchronously (non-blocking)
- Cache QuestionEngine instance
- Limit to 5 questions max

### Risk 3: Telegram Bot Downtime
**Impact:** Medium (clarifications lost)
**Mitigation:**
- Fallback: Log clarification request, allow task to proceed after 5 min
- Persist clarifications in database
- Implement retry logic

### Risk 4: Task Questions Table Missing in Parent-Harness
**Impact:** Medium (no question persistence)
**Mitigation:**
- Create migration to add `task_questions` table
- Or: Embed questions in `clarification_requests.context` as JSON

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 hours)
1. Create `vagueness-analyzer.ts` service
2. Add `clarification-hook.ts` with `onTaskCreated()`
3. Update `tasks.ts` to trigger hook on creation
4. Add database migration for `task_questions` table (if needed)

### Phase 2: Telegram Integration (1-2 hours)
5. Create `clarification-commands.ts` with `/answer`, `/skip`, `/clarifications`
6. Register commands in Telegram bot
7. Test Telegram flow manually

### Phase 3: Testing (2-3 hours)
8. Write unit tests for vagueness detection
9. Write integration tests for workflow
10. Manual end-to-end testing

### Phase 4: Documentation & Polish (1 hour)
11. Update CRITICAL_GAPS.md (mark Gap #1 as resolved)
12. Add clarification flow diagram to docs
13. Update agent metadata if needed

**Total Estimated Effort:** 6-9 hours

---

## Future Enhancements

1. **Multi-Turn Clarification**
   - Ask follow-up questions based on initial answers
   - Adaptive questioning flow

2. **Suggested Answers**
   - Telegram inline keyboard with common options
   - Reduces typing for users

3. **Clarification Analytics**
   - Track: avg time to answer, skip rate, question effectiveness
   - Use to tune vagueness thresholds

4. **Frontend Integration**
   - Display clarification history in task detail panel
   - Allow answering clarifications via web UI

5. **Proactive Clarification**
   - Planning Agent can request clarification during task decomposition
   - Build Agent can request mid-task clarification if blocked

---

## References

- **CRITICAL_GAPS.md** - Gap #1: User Task Clarification Agent
- **Existing Code:**
  - `parent-harness/orchestrator/src/clarification/index.ts`
  - `server/services/task-agent/question-engine.ts`
  - `agents/ideation/vagueness-detector.ts`
  - `parent-harness/orchestrator/src/agents/metadata.ts`
- **Related Issues:** N/A
- **Design Doc:** (this document)

---

## Approval

**Spec Author:** Spec Agent
**Reviewed By:** (Pending)
**Approved By:** (Pending)
**Date:** 2026-02-08

---

**Status:** Ready for implementation
