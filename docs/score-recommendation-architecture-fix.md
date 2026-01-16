# Score & Recommendation Architecture Fix

## Executive Summary

There are fundamental architectural issues causing score discrepancies and recommendation mismatches. This document provides a first-principles analysis and implementation plan.

**Current Status:**

- Step 1 (recommendation recalculation in API) - **COMPLETED**
- Steps 2-4 - **PENDING** (required for full fix)

---

## Issue 1: Score Discrepancy (6.9 vs 7.0)

### Observed Behavior

- "Evaluation Complete" modal shows: **6.9**
- Scorecard "Overall Evaluation Score" shows: **7.0**
- Difference: **0.1** (approximately 1.4%)

### First Principles Analysis

**Question: Where should the "true" score come from?**

The post-debate score should be:

```
POST_DEBATE_SCORE = Σ (category_avg × category_weight)

Where:
  category_avg = AVG(criterion_initial_score + criterion_debate_adjustment)
```

**Data Flow Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVALUATION PHASE                                   │
│                         (agents/evaluator.ts)                               │
│                                                                             │
│  For each criterion:                                                        │
│    score = AI evaluation (1-10)                                             │
│    confidence = AI confidence (0-1)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         evaluations TABLE                                    │
│                                                                             │
│  ┌────────────┬──────────────┬─────────────┬─────────────┬──────────────┐  │
│  │ criterion  │ initial_score │ final_score │ agent_score │ category     │  │
│  ├────────────┼──────────────┼─────────────┼─────────────┼──────────────┤  │
│  │ PR1        │ 8.0          │ 8.0         │ 8.0         │ problem      │  │
│  │ PR2        │ 7.5          │ 7.5         │ 7.5         │ problem      │  │
│  │ ...        │ ...          │ ...         │ ...         │ ...          │  │
│  └────────────┴──────────────┴─────────────┴─────────────┴──────────────┘  │
│                                                                             │
│  NOTE: final_score = initial_score at this point (PRE-debate)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DEBATE PHASE                                      │
│                          (agents/debate.ts)                                 │
│                                                                             │
│  For each criterion:                                                        │
│    Red Team challenges the evaluation                                       │
│    Evaluator defends                                                        │
│    Arbiter judges → score_adjustment (-2, -1, 0, +1, +2)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐    ┌────────────────────────────────────────┐
│     debate_rounds TABLE        │    │        final_syntheses TABLE           │
│                               │    │                                        │
│ ┌──────────┬────────────────┐ │    │  ┌──────────────┬────────────────────┐ │
│ │criterion │score_adjustment│ │    │  │ overall_score│ recommendation     │ │
│ ├──────────┼────────────────┤ │    │  ├──────────────┼────────────────────┤ │
│ │ PR1      │ -1             │ │    │  │ 3.26 (WRONG!)│ ABANDON (WRONG!)   │ │
│ │ PR2      │ 0              │ │    │  └──────────────┴────────────────────┘ │
│ │ SO1      │ -2             │ │    │                                        │
│ │ ...      │ ...            │ │    │  Value calculated by synthesis agent   │
│ └──────────┴────────────────┘ │    │  using unknown/buggy logic             │
└───────────────────────────────┘    └────────────────────────────────────────┘
```

### The Core Problem

**`evaluations.final_score` is NEVER updated after debate.**

This creates data inconsistency:

- `evaluations.final_score` = PRE-debate scores
- `debate_rounds.score_adjustment` = debate adjustments (stored separately)
- `final_syntheses.overall_score` = POST-debate score (but calculated by synthesis agent, unreliable)

### Why 6.9 vs 7.0?

| Display Location      | Data Source                        | Calculation                              | Score   |
| --------------------- | ---------------------------------- | ---------------------------------------- | ------- |
| "Evaluation Complete" | `/api/ideas/:slug/synthesis`       | `AVG(evaluations.final_score)` × weights | **6.9** |
| Scorecard             | `/api/ideas/:slug/category-scores` | Same calculation                         | **7.0** |

**The 0.1 difference is likely due to:**

1. **Rounding at different stages** - one rounds before averaging, one after
2. **Different query execution** - floating point arithmetic differences
3. **Missing debate adjustments in both** - both use PRE-debate scores

**Both are showing PRE-debate scores, neither includes debate adjustments!**

---

## Issue 2: Recommendation "ABANDON" with Score 7.0

### Observed Behavior

- Displayed score: **7.0** (Promising)
- Displayed recommendation: **ABANDON** (Should be PURSUE for score >= 7.0)

### First Principles Analysis

**Question: When and how is the recommendation determined?**

**Recommendation Thresholds (agents/config.ts:318-324):**
| Score Range | Recommendation |
|-------------|----------------|
| 8.0 - 10.0 | PURSUE |
| 7.0 - 7.9 | PURSUE |
| 6.0 - 6.9 | REFINE |
| 5.0 - 5.9 | REFINE |
| 4.0 - 4.9 | PAUSE |
| 1.0 - 3.9 | ABANDON |

**The Bug Chain:**

```
1. Synthesis agent calculated overall_score = 3.26 (WRONG)
                              │
                              ▼
2. interpretScore(3.26) returned recommendation = 'ABANDON'
                              │
                              ▼
3. saveFinalSynthesis() stored:
   - overall_score = 3.26
   - recommendation = 'ABANDON'
                              │
                              ▼
4. API now recalculates score from evaluations → 6.9/7.0
   But recommendation still reads from stored 'ABANDON'
```

### Root Cause of Wrong Synthesis Score

**Investigation needed:** Why did the synthesis agent calculate 3.26 when evaluations average 7.0?

Possible causes:

1. **Bug in synthesis agent's score aggregation logic**
2. **Synthesis agent received partial/corrupted data**
3. **Timing issue** - synthesis ran before all evaluations were saved
4. **Different weighting logic** in synthesis agent vs API

**Location to investigate:** `agents/synthesis.ts` - how does it calculate `overallScore`?

---

## Issue 3: Frontend Reverse-Engineering Initial Score

### Observed Behavior

- Scorecard shows "Initial: 8.3, After Debate: 7.0"

### The Hack

**EvaluationScorecard.tsx:333-335:**

```javascript
const initialScore = synthesis?.overall_score
  ? synthesis.overall_score +
    (rounds.reduce((sum, r) => sum + r.score_adjustment, 0) * -1) /
      rounds.length
  : weightedAvg;
```

**What this does:**

```
initialScore = synthesis.overall_score - (total_adjustments / round_count)
```

**Why this is wrong:**

1. Divides by `rounds.length` (total rounds) but adjustments are per-criterion, not per-round
2. Assumes `synthesis.overall_score` is POST-debate (but we established it might be wrong)
3. Reverse-engineering indicates architectural debt

**The correct approach:** Store `initial_score` explicitly, don't calculate backwards.

---

## Architectural Problems Summary

| #   | Problem                    | Location                | Impact                              | Fix Complexity |
| --- | -------------------------- | ----------------------- | ----------------------------------- | -------------- |
| 1   | Split Score Storage        | DB Schema               | Scores inconsistent                 | HIGH           |
| 2   | No Score Reconciliation    | evaluate.ts             | `final_score` never updated         | MEDIUM         |
| 3   | Recommendation Lock-in     | evaluate.ts             | Wrong recommendations persist       | LOW (DONE)     |
| 4   | Inconsistent Recalculation | server/api.ts           | Different scores in different views | MEDIUM         |
| 5   | Frontend Workarounds       | EvaluationScorecard.tsx | Fragile, incorrect math             | LOW            |
| 6   | Synthesis Agent Bug        | agents/synthesis.ts     | Wrong scores saved                  | UNKNOWN        |

---

## What Has Been Implemented (DONE)

### API Recommendation Recalculation

**Files modified:** `server/api.ts`

**Endpoints fixed:**

1. `/api/ideas/:slug/synthesis` - now recalculates recommendation from score
2. `/api/debates/:runId` - now recalculates recommendation from score

**Logic added:**

```typescript
function getRecommendationFromScore(score: number): string {
  if (score >= 7.0) return "PURSUE";
  if (score >= 5.0) return "REFINE";
  if (score >= 4.0) return "PAUSE";
  return "ABANDON";
}
```

**Result:** Recommendation now matches score in API responses.

---

## What Still Needs Implementation (PENDING)

### Phase 1: Fix Score Calculation to Include Debate Adjustments

**Priority: HIGH**
**Estimated effort: 2-4 hours**

#### Step 1.1: Verify Schema

First, confirm the schema has required columns:

```bash
sqlite3 database/ideas.db ".schema evaluations"
```

Expected columns:

- `initial_score` - score before debate
- `final_score` - should be score after debate (currently same as initial)

```bash
sqlite3 database/ideas.db ".schema debate_rounds"
```

Expected columns:

- `criterion` - which criterion this adjustment is for
- `score_adjustment` - the adjustment value (-2 to +2)

#### Step 1.2: Update API Score Calculation

**File:** `server/api.ts`

**Current (WRONG) - line ~808:**

```typescript
const categoryScores = await query<{ category: string; avg_score: number }>(
  `SELECT category, AVG(final_score) as avg_score
   FROM evaluations
   WHERE idea_id = ? AND evaluation_run_id = ?
   GROUP BY category`,
  [idea.id, targetRunId],
);
```

**Fixed:**

```typescript
const categoryScores = await query<{ category: string; avg_score: number }>(
  `SELECT
    e.category,
    AVG(e.initial_score + COALESCE(adj.total_adjustment, 0)) as avg_score
   FROM evaluations e
   LEFT JOIN (
     SELECT
       idea_id,
       evaluation_run_id,
       criterion,
       SUM(score_adjustment) as total_adjustment
     FROM debate_rounds
     GROUP BY idea_id, evaluation_run_id, criterion
   ) adj ON e.idea_id = adj.idea_id
        AND e.evaluation_run_id = adj.evaluation_run_id
        AND e.criterion = adj.criterion
   WHERE e.idea_id = ? AND e.evaluation_run_id = ?
   GROUP BY e.category`,
  [idea.id, targetRunId],
);
```

**Also update these endpoints:**

- `/api/ideas/:slug/category-scores` (used by Scorecard)
- `/api/debates/:runId` (same pattern)

#### Step 1.3: Update useCategoryScores Hook

**File:** `frontend/src/hooks/useEvaluations.ts`

The hook calls `/api/ideas/:slug/category-scores`. After fixing the API, verify the hook receives correct data.

### Phase 2: Update evaluations.final_score After Debate

**Priority: MEDIUM**
**Estimated effort: 1-2 hours**

#### Step 2.1: Modify saveDebateResults()

**File:** `scripts/evaluate.ts` (around line 819)

After saving debate rounds, update evaluations:

```typescript
async function saveDebateResults(
  ideaId: string,
  sessionId: string,
  debateResult: FullDebateResult,
): Promise<void> {
  // ... existing code to save debate_rounds ...

  // NEW: Update evaluations.final_score with debate adjustments
  for (const debate of debateResult.debates) {
    const adjustment = debate.finalScore - debate.originalScore;

    await run(
      `UPDATE evaluations
       SET final_score = initial_score + ?
       WHERE idea_id = ?
         AND evaluation_run_id = ?
         AND criterion = ?`,
      [adjustment, ideaId, sessionId, debate.criterion.name],
    );
  }
}
```

#### Step 2.2: Verify Data Model

Check that `debate.finalScore` and `debate.originalScore` exist in `FullDebateResult`:

```typescript
interface CriterionDebate {
  criterion: CriterionDefinition;
  originalScore: number; // Pre-debate
  finalScore: number; // Post-debate
  // ...
}
```

### Phase 3: Data Migration for Existing Records

**Priority: LOW** (only needed if historical accuracy matters)
**Estimated effort: 1 hour**

#### Step 3.1: Create Migration Script

**File:** `database/migrations/015_fix_debate_scores.sql`

```sql
-- Migration 015: Fix evaluations.final_score to include debate adjustments
-- This is a ONE-TIME migration for existing data

-- Step 1: Calculate correct final scores
-- Note: This assumes debate_rounds.criterion matches evaluations.criterion exactly

UPDATE evaluations
SET final_score = initial_score + COALESCE(
  (SELECT SUM(score_adjustment)
   FROM debate_rounds d
   WHERE d.idea_id = evaluations.idea_id
     AND d.evaluation_run_id = evaluations.evaluation_run_id
     AND d.criterion = evaluations.criterion),
  0
)
WHERE EXISTS (
  SELECT 1 FROM debate_rounds d
  WHERE d.idea_id = evaluations.idea_id
    AND d.evaluation_run_id = evaluations.evaluation_run_id
);

-- Step 2: Verify the migration worked
-- Run this query to check:
-- SELECT e.criterion, e.initial_score, e.final_score,
--        (e.final_score - e.initial_score) as calculated_delta,
--        (SELECT SUM(score_adjustment) FROM debate_rounds d
--         WHERE d.idea_id = e.idea_id AND d.evaluation_run_id = e.evaluation_run_id
--         AND d.criterion = e.criterion) as expected_delta
-- FROM evaluations e
-- WHERE e.evaluation_run_id = 'YOUR_RUN_ID';
```

#### Step 3.2: Run Migration

```bash
npm run migrate
```

### Phase 4: Remove Frontend Workarounds

**Priority: LOW**
**Estimated effort: 30 minutes**

#### Step 4.1: Fix EvaluationScorecard.tsx

**File:** `frontend/src/components/EvaluationScorecard.tsx`

**Remove the reverse calculation (line 333-335):**

```typescript
// OLD (WRONG):
const initialScore = synthesis?.overall_score
  ? synthesis.overall_score + (rounds.reduce((sum, r) => sum + r.score_adjustment, 0) * -1) / rounds.length
  : weightedAvg;

// NEW (CORRECT):
// After Phase 2, weightedAvg will be POST-debate scores
// For initial score, either:
// Option A: Calculate from evaluations.initial_score
// Option B: Store initial_score in synthesis table
const initialScore = /* get from API or calculate */;
```

---

## Testing Plan

### Manual Test Cases

#### Test 1: New Evaluation Without Debate

```bash
npm run evaluate my-idea -- --skip-debate
```

**Expected:**

- [ ] All score displays show same value
- [ ] Recommendation matches score threshold
- [ ] No "Initial/After Debate" shown (no debate)

#### Test 2: New Evaluation With Debate

```bash
npm run evaluate my-idea
```

**Expected:**

- [ ] "Evaluation Complete" score = Scorecard score = Synthesis score
- [ ] Recommendation matches displayed score
- [ ] "Initial" score > "After Debate" score (if red team won rounds)
- [ ] Delta shown is mathematically correct

#### Test 3: Historical Data (After Migration)

1. Open an idea that was evaluated before the fix
2. Check all score displays

**Expected:**

- [ ] Scores now correct and consistent
- [ ] Recommendation matches score

### Automated Tests to Add

**File:** `tests/score-consistency.test.ts`

```typescript
describe("Score Consistency", () => {
  it("API returns same score from /synthesis and /category-scores", async () => {
    const synthesis = await getSynthesis("test-idea");
    const categories = await getCategoryScores("test-idea");
    const calculatedScore = calculateWeightedAverage(categories);
    expect(synthesis.overall_score).toBeCloseTo(calculatedScore, 1);
  });

  it("Recommendation matches score threshold", async () => {
    const synthesis = await getSynthesis("test-idea");
    const expectedRec = getExpectedRecommendation(synthesis.overall_score);
    expect(synthesis.recommendation).toBe(expectedRec);
  });

  it("Debate adjustments are included in final score", async () => {
    // Run evaluation with debate
    // Check that final_score = initial_score + sum(adjustments)
  });
});
```

---

## Debugging Commands

### Check Current Data State

```bash
# See what scores are stored
sqlite3 database/ideas.db "
  SELECT
    e.criterion,
    e.initial_score,
    e.final_score,
    e.final_score - e.initial_score as stored_delta
  FROM evaluations e
  WHERE e.evaluation_run_id = 'YOUR_RUN_ID'
  ORDER BY e.category, e.criterion;
"

# See debate adjustments
sqlite3 database/ideas.db "
  SELECT
    criterion,
    SUM(score_adjustment) as total_adjustment
  FROM debate_rounds
  WHERE evaluation_run_id = 'YOUR_RUN_ID'
  GROUP BY criterion;
"

# See synthesis stored values
sqlite3 database/ideas.db "
  SELECT overall_score, recommendation
  FROM final_syntheses
  WHERE evaluation_run_id = 'YOUR_RUN_ID';
"
```

### Verify API Response

```bash
# Check synthesis endpoint
curl http://localhost:3001/api/ideas/YOUR_SLUG/synthesis | jq '.overall_score, .recommendation'

# Check category scores endpoint
curl http://localhost:3001/api/ideas/YOUR_SLUG/category-scores | jq '.[] | {category, avg_score}'
```

---

## Risk Assessment

| Risk                                  | Likelihood | Impact | Mitigation                                           |
| ------------------------------------- | ---------- | ------ | ---------------------------------------------------- |
| Breaking existing evaluations         | LOW        | HIGH   | Backup database before migration                     |
| Score calculation edge cases          | MEDIUM     | MEDIUM | Add unit tests for edge cases                        |
| Frontend cache showing stale data     | MEDIUM     | LOW    | Document need to refresh after changes               |
| Performance impact of complex queries | LOW        | LOW    | Add index on (idea_id, evaluation_run_id, criterion) |
| Migration script fails on bad data    | MEDIUM     | MEDIUM | Add validation queries before UPDATE                 |

---

## Files Summary

| File                                              | Status      | Change Required                      |
| ------------------------------------------------- | ----------- | ------------------------------------ |
| `server/api.ts`                                   | PARTIAL     | Add debate adjustments to score calc |
| `scripts/evaluate.ts`                             | PENDING     | Update final_score after debate      |
| `database/migrations/015_fix_debate_scores.sql`   | PENDING     | Data migration                       |
| `frontend/src/components/EvaluationScorecard.tsx` | PENDING     | Remove reverse calculation           |
| `frontend/src/hooks/useEvaluations.ts`            | PENDING     | Verify after API fix                 |
| `agents/synthesis.ts`                             | INVESTIGATE | Find why it calculated wrong score   |

---

## Open Questions (Need Investigation)

1. **Why did the synthesis agent calculate 3.26 instead of ~7.0?**
   - Check `agents/synthesis.ts` for score calculation logic
   - Check if there's a timing issue in evaluation flow

2. **Are there other places that read scores directly from DB?**
   - Search for `final_syntheses.overall_score` usage
   - Search for `evaluations.final_score` usage

3. **Should we store both pre-debate and post-debate overall scores?**
   - Currently only store one value
   - May want both for analytics

---

## Execution Order

1. **DONE**: API recommendation recalculation
2. **NEXT**: Phase 1 - Fix API score calculation (2-4 hours)
3. **THEN**: Phase 2 - Update evaluations after debate (1-2 hours)
4. **OPTIONAL**: Phase 3 - Data migration (1 hour)
5. **OPTIONAL**: Phase 4 - Frontend cleanup (30 min)

**Total estimated effort: 4-8 hours**
