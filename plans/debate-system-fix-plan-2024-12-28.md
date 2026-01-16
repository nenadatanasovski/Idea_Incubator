# Debate System Fix Implementation Plan

**Created:** 2024-12-28
**Status:** Ready for Implementation
**Priority:** High

---

## Executive Summary

This document provides a comprehensive first-principles analysis of the debate system issues and a step-by-step implementation plan to resolve them. Four critical issues have been identified and traced to their root causes.

---

## Issue 1: API Event Counter Inaccuracy

### Problem Statement

The API event counter in the frontend stops counting at a certain point while the debate is still in progress.

### Root Cause Analysis

The `budget:status` event (which carries the `apiCalls` count) is only broadcast at two specific points in `debate.ts`:

1. **Line 257-263**: At the START of the debate phase (initial status)
2. **Line 328-336**: At the END of the debate phase (final status)

**Critical Gap**: No `budget:status` events are emitted DURING the debate phase. Since debates run in parallel (`Promise.all` on line 267-303), the counter appears to freeze because:

- All 30 criterion debates run simultaneously
- Each debate makes 3-6 API calls per round
- API calls increment `costTracker.apiCalls` internally
- But no broadcast happens until ALL debates complete

**Code Evidence** (`agents/debate.ts`):

```typescript
// Lines 254-263: Only one broadcast at START
const initialReport = costTracker.getReport();
if (broadcaster) {
  await broadcaster.budgetStatus(
    initialReport.estimatedCost,
    initialReport.budgetRemaining,
    initialReport.estimatedCost + initialReport.budgetRemaining,
    initialReport.apiCalls
  );
}

// Lines 267-303: All debates run in parallel - NO budgetStatus during
const debatePromises = evaluations.map(eval_ =>
  runCriterionDebate(eval_, ...).catch(...)
);
const allDebates = await Promise.all(debatePromises);

// Lines 328-336: Only one broadcast at END
const finalReport = costTracker.getReport();
if (broadcaster) {
  await broadcaster.budgetStatus(...);
}
```

### Frontend Display Issue

In `DebateViewer.tsx` (lines 639-643):

```typescript
const latestBudgetEvent = useMemo(() => {
  const budgetEvents = events.filter((e) => e.type === "budget:status");
  return budgetEvents.length > 0 ? budgetEvents[budgetEvents.length - 1] : null;
}, [events]);
const apiCalls = latestBudgetEvent?.data.apiCalls as number | undefined;
```

This correctly displays the LAST `budget:status` event, but since no events are emitted during debate, the counter appears frozen.

### Solution

1. Add periodic `budget:status` broadcasts during debate
2. Broadcast after each API call in `runCriterionDebate`
3. Use a debounced broadcast to avoid overwhelming the WebSocket

---

## Issue 2: Budget Limit Not Tied to API Calls

### Problem Statement

The budget limit is based on dollar cost (token pricing), not the number of API calls made.

### Root Cause Analysis

**By Design**: The `CostTracker` class (`utils/cost-tracker.ts`) was intentionally designed to track COST, not API calls.

```typescript
// cost-tracker.ts lines 83-89
checkBudget(): void {
  if (this.unlimitedMode) return;
  const cost = this.getEstimatedCost();  // <- Based on tokens/dollars
  if (cost >= this.budget) {
    throw new BudgetExceededError(cost, this.budget);
  }
}
```

The budget is specified in DOLLARS (default $10, line 41), and `checkBudget()` compares against estimated cost based on token pricing:

```typescript
// Lines 3-7
const PRICING = {
  inputPerMillion: 15.0, // $15 per 1M input tokens
  outputPerMillion: 75.0, // $75 per 1M output tokens
};
```

**API Call Count IS Tracked** (line 52):

```typescript
track(usage: TokenUsage, operation: string = 'unknown'): void {
  this.inputTokens += usage.input_tokens;
  this.outputTokens += usage.output_tokens;
  this.apiCalls++;  // <- API calls ARE counted
  // ...
}
```

But `apiCalls` is never used in budget enforcement—only in reporting.

### Ambiguity in User's Intent

The user's complaint may mean one of:

1. **Want API call-based limits**: "Stop after X API calls" (not currently supported)
2. **Display issue**: API calls shown don't match actual calls made (different issue)
3. **Misleading UI**: Counter suggests control that doesn't exist

### Solution Options

**Option A**: Add API call limit support

- Add `maxApiCalls` parameter to CostTracker
- Add `checkApiCallLimit()` method
- Allow budget to be specified as either dollars OR API calls

**Option B**: Clarify in UI

- Make clear that "Budget" is in dollars, not API calls
- Show API calls as informational only
- Add tooltip explaining the difference

---

## Issue 3: Debate List Display Issues

### Problem Statement

The debate list does not properly show debates that have passed, and timestamps are incorrect or missing.

### Root Cause Analysis

The `/api/debates` endpoint (`server/api.ts` lines 1258-1286) queries the `debate_rounds` table:

```sql
SELECT
  d.evaluation_run_id,
  d.idea_id,
  i.slug as idea_slug,
  i.title as idea_title,
  COUNT(*) as round_count,
  COUNT(DISTINCT d.criterion) as criterion_count,
  MIN(d.timestamp) as started_at,
  MAX(d.timestamp) as latest_at
FROM debate_rounds d
JOIN ideas i ON d.idea_id = i.id
GROUP BY d.evaluation_run_id, d.idea_id
ORDER BY MAX(d.timestamp) DESC
```

**Issue 1: Debate Rounds Only Populated When Debate Occurs**

If `--skip-debate` is used or debate fails, the `debate_rounds` table has no entries. The SQL query will return nothing for those evaluations.

**Evidence**: Evaluations ARE saved to `evaluations` table (lines 580-635 of `scripts/evaluate.ts`), but debate sessions query only `debate_rounds`.

**Issue 2: "Passed" Status Not Stored or Queried**

There is no explicit "passed/failed/completed" status field. The only indicators are:

- Presence of `debate_rounds` entries (debate happened)
- Presence of `final_syntheses` entries (synthesis completed)
- `evaluation_events` table (real-time events stored)

**Issue 3: Timestamp Inconsistency**

The `debate_rounds.timestamp` field is set in `saveDebateResults()` (`scripts/evaluate.ts` line 678):

```typescript
timestamp: new Date().toISOString();
```

This creates the SAME timestamp for all rounds in a batch (not staggered by actual execution time).

**Issue 4: Frontend Relative Time Calculation**

`DebateList.tsx` (lines 60-73) calculates relative time:

```typescript
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  // ...
}
```

If the timestamp stored is incorrect or missing, the display will be wrong.

### Solution

1. Add `evaluation_sessions` table to track overall session status
2. Show all evaluation sessions, not just those with debate rounds
3. Store accurate per-event timestamps
4. Add explicit completion status field

---

## Issue 4: Debate Sections Don't Start With Evaluator

### Problem Statement

Debate sections in the viewer do not consistently start with an evaluator/evaluation assessment.

### Root Cause Analysis

**The fundamental flow should be:**

```
1. Evaluator provides initial assessment (score + reasoning)
2. Red Team challenges the assessment
3. Evaluator defends
4. Arbiter judges
5. Repeat for N rounds
```

**Current Implementation Issues:**

#### Issue A: Initial Assessment Broadcast Timing

In `specialized-evaluators.ts` (lines 441-453), `evaluatorInitial` is broadcast AFTER all 5 criteria for a category are evaluated:

```typescript
// Broadcast each evaluation result as INITIAL assessment (before debate)
if (broadcaster) {
  for (const result of results) {
    await broadcaster.evaluatorInitial(
      result.criterion.name,
      result.criterion.category,
      result.reasoning,
      result.score,
    );
  }
}
```

This means ALL initial assessments are broadcast BEFORE any debates start.

#### Issue B: Debate Phase Doesn't Re-Broadcast Initial Assessment

In `debate.ts` `runCriterionDebate()` (lines 82-89), `criterionStart` IS broadcast:

```typescript
// Broadcast criterion debate start with initial assessment
if (broadcaster) {
  await broadcaster.criterionStart(
    criterion.name,
    criterion.category,
    evaluation.score,
    evaluation.reasoning,
  );
}
```

**But** this is `debate:criterion:start`, NOT `evaluator:initial`.

#### Issue C: Frontend Event Grouping Logic

In `DebateViewer.tsx` `groupEventsByCriterion()` (lines 78-225), the logic handles EITHER:

```typescript
case 'debate:criterion:start':
  debate.evaluatorAssessment = {
    content: event.data.content || '',
    score: event.data.score,
    timestamp: event.timestamp,
  }
  debate.originalScore = event.data.score
  break

case 'evaluator:initial':
  if (!debate.evaluatorAssessment) {  // Only if not already set!
    debate.evaluatorAssessment = { ... }
  }
  break
```

The `evaluator:initial` case has a guard: `if (!debate.evaluatorAssessment)`.

**Race Condition**: If `debate:criterion:start` arrives before `evaluator:initial`, the assessment is set. If `evaluator:initial` arrives first, it's set. But if neither arrives first for a criterion, the assessment is missing.

#### Issue D: Parallel Debate Execution Creates Event Interleaving

With 30 debates running in parallel (line 267 of `debate.ts`):

```typescript
const debatePromises = evaluations.map(eval_ =>
  runCriterionDebate(...)
);
const allDebates = await Promise.all(debatePromises);
```

Events from different criteria interleave in unpredictable order:

- Criterion A: criterion:start
- Criterion B: criterion:start
- Criterion C: redteam:challenge (before criterion:start!)
- Criterion A: redteam:challenge

The frontend `groupEventsByCriterion()` groups by criterion name, so events eventually get sorted, BUT if the first event for a criterion is a `redteam:challenge` (not `criterion:start`), no `evaluatorAssessment` is ever set.

#### Issue E: Event Loss Due to WebSocket Timing

In `useDebateStream.ts`, events are buffered (line 103):

```typescript
events: [...prev.events.slice(-maxEvents + 1), event],
```

With `maxEvents = 500`, older events can be dropped. If `evaluator:initial` events are at the start and get dropped, the assessment is lost.

### Solution

1. Ensure `debate:criterion:start` is ALWAYS the first event for each criterion
2. Include full evaluator assessment data in `debate:criterion:start`
3. Remove the guard in frontend that skips `evaluator:initial` if assessment exists
4. Consider sequential broadcast of initial events before parallel debate

---

## Implementation Plan

### Phase 1: Fix API Event Counter (Issue 1)

**File: `agents/debate.ts`**

#### Step 1.1: Add Periodic Budget Broadcasts in `runCriterionDebate`

After each major operation (challenge generation, defense, judging), broadcast budget status:

```typescript
// After line 98 (generateAllChallenges)
if (broadcaster) {
  const report = costTracker.getReport();
  await broadcaster.budgetStatus(
    report.estimatedCost,
    report.budgetRemaining,
    report.estimatedCost + report.budgetRemaining,
    report.apiCalls,
  );
}
```

Repeat after:

- Line 156 (generateDefense)
- Line 178 (judgeRound)

#### Step 1.2: Add Debounced Broadcast Helper

Create a helper to prevent excessive broadcasts:

```typescript
function createDebouncedBroadcast(
  broadcaster: Broadcaster,
  intervalMs: number = 1000,
) {
  let lastBroadcast = 0;
  return async (costTracker: CostTracker) => {
    const now = Date.now();
    if (now - lastBroadcast >= intervalMs) {
      const report = costTracker.getReport();
      await broadcaster.budgetStatus(
        report.estimatedCost,
        report.budgetRemaining,
        report.estimatedCost + report.budgetRemaining,
        report.apiCalls,
      );
      lastBroadcast = now;
    }
  };
}
```

---

### Phase 2: Clarify Budget vs API Calls (Issue 2)

**File: `utils/cost-tracker.ts`**

#### Step 2.1: Add Optional API Call Limit

```typescript
export class CostTracker {
  private maxApiCalls?: number; // NEW

  constructor(
    budgetDollars: number = 10.0,
    unlimited: boolean = false,
    maxApiCalls?: number,
  ) {
    this.budget = budgetDollars;
    this.unlimitedMode = unlimited;
    this.maxApiCalls = maxApiCalls; // NEW
  }

  // NEW method
  checkApiCallLimit(): void {
    if (this.maxApiCalls && this.apiCalls >= this.maxApiCalls) {
      throw new ApiCallLimitError(this.apiCalls, this.maxApiCalls);
    }
  }
}
```

#### Step 2.2: Update Frontend UI

**File: `frontend/src/pages/DebateViewer.tsx`**

Add clarifying labels:

```tsx
{
  apiCalls !== undefined && (
    <span
      className="text-cyan-400"
      title="Total API calls made (informational)"
    >
      API Calls: {apiCalls}
    </span>
  );
}
{
  latestBudgetEvent && (
    <span
      className="text-green-400"
      title="Budget in dollars controls when evaluation stops"
    >
      Budget: ${latestBudgetEvent.data.remaining?.toFixed(2)} remaining
    </span>
  );
}
```

---

### Phase 3: Fix Debate List Display (Issue 3)

**File: `server/api.ts`**

#### Step 3.1: Update Query to Include All Sessions

Replace the `debate_rounds` query with a union that includes `evaluation_sessions`:

```typescript
// GET /api/debates
const sessions = await query<{
  evaluation_run_id: string;
  idea_slug: string;
  idea_title: string;
  status: string;
  round_count: number;
  criterion_count: number;
  started_at: string;
  latest_at: string;
}>(`
  SELECT
    es.id as evaluation_run_id,
    i.slug as idea_slug,
    i.title as idea_title,
    CASE
      WHEN fs.id IS NOT NULL THEN 'complete'
      WHEN dr.id IS NULL THEN 'evaluation-only'
      ELSE 'in-progress'
    END as status,
    COALESCE((SELECT COUNT(*) FROM debate_rounds WHERE evaluation_run_id = es.id), 0) as round_count,
    COALESCE((SELECT COUNT(DISTINCT criterion) FROM debate_rounds WHERE evaluation_run_id = es.id), 0) as criterion_count,
    es.created_at as started_at,
    COALESCE(
      (SELECT MAX(timestamp) FROM debate_rounds WHERE evaluation_run_id = es.id),
      es.created_at
    ) as latest_at
  FROM evaluation_sessions es
  JOIN ideas i ON es.idea_id = i.id
  LEFT JOIN debate_rounds dr ON dr.evaluation_run_id = es.id
  LEFT JOIN final_syntheses fs ON fs.evaluation_run_id = es.id
  GROUP BY es.id
  ORDER BY latest_at DESC
`);
```

#### Step 3.2: Add Status Indicator in Frontend

**File: `frontend/src/pages/DebateList.tsx`**

```tsx
{
  session.status === "complete" && (
    <CheckCircle className="h-4 w-4 text-green-500" />
  );
}
{
  session.status === "in-progress" && (
    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
  );
}
{
  session.status === "evaluation-only" && (
    <AlertCircle className="h-4 w-4 text-amber-500" title="No debate was run" />
  );
}
```

---

### Phase 4: Ensure Evaluator-First Ordering (Issue 4)

**File: `agents/debate.ts`**

#### Step 4.1: Broadcast Criterion Start Before Any Operations

Move `criterionStart` broadcast to the VERY beginning and ensure it contains full assessment data:

```typescript
export async function runCriterionDebate(
  criterion: CriterionDefinition,
  evaluation: EvaluationResult,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
): Promise<CriterionDebate> {
  // FIRST thing: broadcast criterion start with FULL initial assessment
  if (broadcaster) {
    await broadcaster.criterionStart(
      criterion.name,
      criterion.category,
      evaluation.score,
      evaluation.reasoning, // Full reasoning included
    );
  }

  // Then proceed with challenges, etc.
  // ...
}
```

#### Step 4.2: Remove Redundant `evaluatorInitial` from specialized-evaluators.ts

Since `criterionStart` now contains the initial assessment, remove the separate `evaluatorInitial` broadcast (or keep both for backwards compatibility but ensure ordering).

**File: `agents/specialized-evaluators.ts`** (lines 441-453)

Option A: Remove the broadcast entirely
Option B: Add a small delay to ensure `criterionStart` arrives first

#### Step 4.3: Update Frontend to Handle Both Event Types

**File: `frontend/src/pages/DebateViewer.tsx`**

Update `groupEventsByCriterion()` to merge data from both event types:

```typescript
case 'debate:criterion:start':
  // Always set/update the assessment
  debate.evaluatorAssessment = {
    content: event.data.content || debate.evaluatorAssessment?.content || '',
    score: event.data.score ?? debate.evaluatorAssessment?.score,
    timestamp: event.timestamp,
  }
  debate.originalScore = event.data.score ?? debate.originalScore
  break

case 'evaluator:initial':
  // Merge with existing if present, otherwise create new
  debate.evaluatorAssessment = {
    content: event.data.content || debate.evaluatorAssessment?.content || '',
    score: event.data.score ?? debate.evaluatorAssessment?.score,
    timestamp: debate.evaluatorAssessment?.timestamp || event.timestamp,
  }
  if (event.data.score !== undefined) {
    debate.originalScore = event.data.score
  }
  break
```

---

## Testing Plan

### Test Case 1: API Counter Accuracy

1. Start an evaluation
2. Observe the API call counter updating every second
3. Compare final count to CostTracker log

### Test Case 2: Budget Display

1. Set a $5 budget
2. Run evaluation until budget exhausted
3. Verify message shows "Budget Exceeded" with correct amounts

### Test Case 3: Debate List

1. Run evaluation with debate
2. Run evaluation WITHOUT debate (--skip-debate)
3. Verify both appear in list with correct status

### Test Case 4: Evaluator-First Ordering

1. Connect to live debate viewer
2. Start evaluation
3. For EACH criterion card, verify evaluator assessment appears before any challenges

---

## Rollback Plan

If issues arise:

1. Revert `debate.ts` to previous version (budget broadcast changes)
2. Revert `DebateViewer.tsx` event handling changes
3. Revert API query changes

All changes are additive and backwards-compatible with existing data.

---

## Appendix: File Change Summary

| File                                  | Changes                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `agents/debate.ts`                    | Add periodic budget broadcasts, ensure criterionStart is first |
| `agents/specialized-evaluators.ts`    | Remove or delay evaluatorInitial broadcasts                    |
| `utils/cost-tracker.ts`               | Add optional API call limit                                    |
| `server/api.ts`                       | Update /api/debates query to include all sessions              |
| `frontend/src/pages/DebateViewer.tsx` | Update event grouping logic, add status display                |
| `frontend/src/pages/DebateList.tsx`   | Add status indicators, improve timestamp display               |
| `utils/broadcast.ts`                  | No changes needed                                              |

---

## Estimated Effort

| Phase                         | Complexity | Effort        |
| ----------------------------- | ---------- | ------------- |
| Phase 1: API Counter          | Low        | ~2 hours      |
| Phase 2: Budget Clarification | Low        | ~1 hour       |
| Phase 3: Debate List          | Medium     | ~3 hours      |
| Phase 4: Evaluator-First      | Medium     | ~3 hours      |
| Testing                       | Medium     | ~2 hours      |
| **Total**                     |            | **~11 hours** |

---

## Conclusion

The four issues stem from:

1. **Insufficient event broadcasting** during parallel operations
2. **Misunderstood budget semantics** (dollars vs API calls)
3. **Incomplete query** that misses non-debate evaluations
4. **Race conditions** in parallel event emission and frontend grouping

All issues are fixable with targeted changes that maintain backwards compatibility.
