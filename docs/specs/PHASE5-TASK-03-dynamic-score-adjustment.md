# PHASE5-TASK-03: Dynamic Score Adjustment Based on Debate Outcomes

**Status:** Specification
**Priority:** P1 (High - Phase 5)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement dynamic score adjustment system that updates criterion scores based on debate outcomes between evaluators and red-team challengers, with arbiter verdicts determining score deltas that are applied in real-time and persisted to the database.

**Problem:** The debate system currently exists (`agents/debate.ts`, `agents/arbiter.ts`) and generates score adjustments through arbiter verdicts, but the implementation has gaps:

1. Score adjustments are calculated but not always properly applied to `evaluations.final_score`
2. Migration 015 attempted to fix score propagation but issues remain
3. Real-time score updates during debate may not reflect in database immediately
4. No systematic validation that debate outcomes actually modify final scores
5. Score deltas from multiple rounds need proper accumulation and capping

**Solution:** Strengthen the dynamic score adjustment pipeline to ensure arbiter verdicts reliably update evaluation scores, with proper constraints, real-time propagation, database persistence, and validation that the debate system actually changes outcomes.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Debate System** (`agents/debate.ts`)
   - ✅ `runCriterionDebate()` orchestrates multi-round debates
   - ✅ Calculates `finalScore` from `originalScore + summary.netScoreAdjustment`
   - ✅ Clamps final score to [1, 10] range
   - ✅ Updates confidence: `finalConfidence = confidence + summary.netConfidenceImpact`
   - ✅ Returns `CriterionDebate` with both original and final scores
   - ✅ `runFullDebate()` calculates category-level score deltas
   - ❌ **Gap:** Score update logic is in-memory; unclear if persisted correctly
   - ❌ **Gap:** No explicit database write for `final_score` during debate

2. **Arbiter Agent** (`agents/arbiter.ts`)
   - ✅ `judgeRound()` returns `RoundResult` with verdicts
   - ✅ Each `ArbiterVerdict` has `scoreAdjustment` (-3 to +3)
   - ✅ `summarizeDebate()` aggregates adjustments across rounds
   - ✅ Caps `netScoreAdjustment` to [-5, +5]
   - ✅ Calculates `recommendedFinalScore = clamp(originalScore + netScoreAdjustment, 1, 10)`
   - ✅ Tracks `confidenceImpact` (-0.3 to +0.3) and caps total to [-0.5, +0.5]
   - ❌ **Gap:** No validation that recommended score is actually applied

3. **Database Schema** (`database/migrations/`)
   - ✅ `evaluations` table has `initial_score` and `final_score` columns
   - ✅ Migration 015 attempted to fix score updates: `UPDATE evaluations SET final_score = ...`
   - ✅ Migration 016 recalculated synthesis scores from final_score
   - ✅ `debate_rounds` table tracks `score_adjustment` per verdict
   - ❌ **Gap:** Migrations are one-time fixes; runtime update path unclear
   - ❌ **Gap:** No database trigger or procedure to auto-update final_score

4. **Debate Routes** (`server/routes/debates.ts`)
   - ✅ GET `/api/debates/:runId` recalculates scores from `evaluations.final_score`
   - ✅ Retrieves `debate_rounds` with `score_adjustment` values
   - ✅ Displays original vs. final scores in UI
   - ❌ **Gap:** Read-only endpoint; no write path for score updates

5. **Evaluation Orchestrator** (`agents/orchestrator.ts`)
   - ✅ Runs evaluation pipeline: evaluate → debate → synthesize
   - ✅ Stores evaluation results in database
   - ❌ **Gap:** Where is `final_score` updated? In evaluator, debate, or synthesis?
   - ❌ **Gap:** No explicit call to persist debate outcome scores

### Gaps Identified

1. **Score Update Path Unclear** - Code calculates `finalScore` but persistence path is not explicit
2. **No Real-Time Update** - Scores may update at end of debate, not per-round
3. **No Validation Tests** - No test that verifies debate actually changes final_score
4. **Migration Dependency** - Relying on migrations to fix scores suggests runtime path is broken
5. **No Rollback/History** - If debate fails mid-way, no way to revert to original score
6. **No Audit Trail** - Score changes not logged with reasoning (which verdict caused delta)
7. **No Capping Enforcement** - Adjustments capped in summary but not validated in DB

---

## Requirements

### Functional Requirements

**FR-1: Score Adjustment Calculation**

- MUST aggregate `scoreAdjustment` from all arbiter verdicts across all rounds
- MUST cap total adjustment to [-5, +5] to prevent extreme swings
- MUST calculate `finalScore = originalScore + cappedAdjustment`
- MUST clamp final score to [1, 10] range
- MUST track per-round cumulative adjustments for progressive UI updates
- SHOULD weight adjustments by arbiter confidence (if implemented)
- SHOULD detect and flag contradictory verdicts (large swings back and forth)

**FR-2: Real-Time Score Updates**

- MUST update `evaluations.final_score` after EACH round completes
- MUST broadcast score changes via WebSocket to connected clients
- MUST emit `criterion:score-updated` event with delta information
- MUST show progressive score movement in UI (original → round 1 → round 2 → final)
- SHOULD debounce database writes if rounds complete rapidly (<100ms apart)
- SHOULD batch updates for parallel criterion debates

**FR-3: Database Persistence**

- MUST store `final_score` in `evaluations` table after debate completes
- MUST preserve `initial_score` as original pre-debate score
- MUST link score changes to `debate_rounds` entries for audit trail
- MUST handle partial debates (if budget exceeded mid-debate)
- MUST support idempotent updates (re-running debate overwrites cleanly)
- SHOULD store score adjustment history in separate table (optional)
- SHOULD support score "freezing" (lock final_score from further changes)

**FR-4: Confidence Adjustment**

- MUST update `evaluations.confidence` based on `netConfidenceImpact`
- MUST cap confidence to [0.0, 1.0] range
- MUST increase confidence when evaluator wins consistently
- MUST decrease confidence when red team exposes weaknesses
- SHOULD track confidence separately from score (orthogonal concerns)

**FR-5: Validation & Constraints**

- MUST reject individual `scoreAdjustment` values outside [-3, +3]
- MUST validate `finalScore` is in [1, 10] before database write
- MUST log warning if adjustment exceeds ±3 points
- MUST detect score manipulation attempts (e.g., all verdicts = +3)
- SHOULD alert if >80% of verdicts go same direction (bias detection)
- SHOULD validate that debate actually produces different outcome (not always same score)

**FR-6: Fallback & Error Handling**

- MUST preserve `initial_score` if debate fails completely
- MUST set `final_score = initial_score` if no valid verdicts
- MUST handle budget exceeded gracefully (partial debate is valid)
- MUST support rollback to `initial_score` if synthesis fails
- SHOULD log all score changes with timestamps for debugging
- SHOULD support manual override (admin can force specific final_score)

### Non-Functional Requirements

**NFR-1: Performance**

- Score updates MUST complete within 100ms per criterion
- Database writes SHOULD be batched for parallel debates
- Real-time UI updates MUST not block debate execution
- WebSocket broadcasts SHOULD be throttled to max 10/sec per room

**NFR-2: Data Integrity**

- `final_score` MUST be nullable (NULL = debate not run yet)
- Score history MUST be append-only (no destructive updates)
- `debate_rounds.score_adjustment` MUST sum to match `final_score - initial_score`
- Database constraints MUST enforce score ranges at schema level

**NFR-3: Observability**

- MUST log each score change with: criterion, round, adjustment, verdict_id
- MUST emit metrics: avg_adjustment, max_adjustment, adjustment_stddev
- MUST track "debate impact ratio" (how often debates change outcomes)
- SHOULD provide dashboard showing score distributions before/after debate

**NFR-4: Testability**

- MUST provide test fixtures with known adjustments
- MUST test edge cases: all +3, all -3, mixed, zero adjustments
- MUST verify database state matches in-memory calculations
- MUST test partial debates (budget exceeded after 1 round)

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Debate Orchestrator                          │
│                   (agents/debate.ts)                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ Round  │  │ Round  │  │ Round  │
    │   1    │  │   2    │  │   N    │
    └────┬───┘  └────┬───┘  └────┬───┘
         │           │           │
         └───────────┼───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Arbiter Verdicts    │
         │  scoreAdjustment: -3  │
         │  scoreAdjustment: +1  │
         │  scoreAdjustment: +2  │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  summarizeDebate()    │
         │  netAdjustment = Σ    │
         │  cap to [-5, +5]      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ calculateFinalScore() │
         │ final = orig + net    │
         │ clamp to [1, 10]      │
         └───────────┬───────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │   DB   │  │WebSocket│ │ Memory │
    │ Write  │  │Broadcast│ │ Update │
    └────────┘  └────────┘  └────────┘
```

### Data Flow

1. **Debate Initialization**

   ```typescript
   // agents/debate.ts: runCriterionDebate()
   const originalScore = evaluation.score;
   const originalConfidence = evaluation.confidence;

   // Store original as initial_score (if not already set)
   await updateEvaluation(evaluationId, {
     initial_score: originalScore,
     confidence: originalConfidence,
   });
   ```

2. **Per-Round Updates**

   ```typescript
   // After each round completes
   for (let round = 1; round <= config.roundsPerChallenge; round++) {
     const roundResult = await judgeRound(...);
     rounds.push(roundResult);

     // Calculate running score
     const runningSummary = summarizeDebate(rounds, originalScore);
     const runningScore = clamp(
       originalScore + runningSummary.netScoreAdjustment,
       1,
       10
     );

     // Update database with intermediate score
     await updateEvaluation(evaluationId, {
       final_score: runningScore,
       confidence: clamp(
         originalConfidence + runningSummary.netConfidenceImpact,
         0.0,
         1.0
       )
     });

     // Broadcast update
     broadcaster?.scoreUpdated(
       criterion.name,
       criterion.category,
       originalScore,
       runningScore,
       round
     );
   }
   ```

3. **Final Score Commit**

   ```typescript
   // After all rounds complete
   const summary = summarizeDebate(rounds, originalScore);
   const finalScore = Math.max(1, Math.min(10, summary.recommendedFinalScore));
   const finalConfidence = Math.max(
     0,
     Math.min(1, originalConfidence + summary.netConfidenceImpact),
   );

   // Final database update
   await updateEvaluation(evaluationId, {
     final_score: finalScore,
     confidence: finalConfidence,
     debate_complete: true,
   });

   // Broadcast completion
   broadcaster?.criterionComplete(
     criterion.name,
     criterion.category,
     originalScore,
     finalScore,
   );
   ```

### Database Schema Changes

**Add columns to `evaluations` table:**

```sql
-- Migration: 018_debate_score_tracking.sql

-- Add debate completion tracking
ALTER TABLE evaluations ADD COLUMN debate_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE evaluations ADD COLUMN debate_round_count INTEGER DEFAULT 0;
ALTER TABLE evaluations ADD COLUMN last_score_update TIMESTAMP;

-- Add constraints to ensure score validity
ALTER TABLE evaluations ADD CONSTRAINT valid_initial_score
  CHECK (initial_score IS NULL OR (initial_score >= 1 AND initial_score <= 10));
ALTER TABLE evaluations ADD CONSTRAINT valid_final_score
  CHECK (final_score IS NULL OR (final_score >= 1 AND final_score <= 10));
ALTER TABLE evaluations ADD CONSTRAINT valid_confidence
  CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- Create index for debate queries
CREATE INDEX idx_evaluations_debate ON evaluations(evaluation_run_id, debate_complete);
```

**Optional: Score change audit table:**

```sql
-- Track all score changes for debugging
CREATE TABLE IF NOT EXISTS score_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id TEXT NOT NULL,
  criterion TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  score_before INTEGER NOT NULL,
  score_after INTEGER NOT NULL,
  score_delta INTEGER NOT NULL,
  confidence_before REAL NOT NULL,
  confidence_after REAL NOT NULL,
  verdict_id TEXT,
  adjustment_reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE
);

CREATE INDEX idx_score_changes ON score_change_log(evaluation_id, timestamp);
```

### Code Changes

**File: `agents/debate.ts`**

Add score update function:

```typescript
/**
 * Update evaluation score in database after debate round
 */
async function updateEvaluationScore(
  evaluationId: string,
  updates: {
    initial_score?: number;
    final_score?: number;
    confidence?: number;
    debate_complete?: boolean;
    debate_round_count?: number;
  },
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.initial_score !== undefined) {
    fields.push("initial_score = ?");
    values.push(updates.initial_score);
  }
  if (updates.final_score !== undefined) {
    fields.push("final_score = ?");
    values.push(updates.final_score);
  }
  if (updates.confidence !== undefined) {
    fields.push("confidence = ?");
    values.push(updates.confidence);
  }
  if (updates.debate_complete !== undefined) {
    fields.push("debate_complete = ?");
    values.push(updates.debate_complete ? 1 : 0);
  }
  if (updates.debate_round_count !== undefined) {
    fields.push("debate_round_count = ?");
    values.push(updates.debate_round_count);
  }

  fields.push("last_score_update = ?");
  values.push(new Date().toISOString());

  values.push(evaluationId);

  db.run(`UPDATE evaluations SET ${fields.join(", ")} WHERE id = ?`, values);
}
```

Modify `runCriterionDebate()`:

```typescript
export async function runCriterionDebate(
  criterion: CriterionDefinition,
  evaluation: EvaluationResult,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  debouncedBudgetBroadcast?: (costTracker: CostTracker) => Promise<void>,
): Promise<CriterionDebate> {
  const config = getConfig();
  const debateConfig = config.debate;

  // Store original score as initial_score if not already set
  await updateEvaluationScore(evaluation.id, {
    initial_score: evaluation.score,
    confidence: evaluation.confidence,
  });

  logInfo(`Starting debate for: ${criterion.name}`);

  // ... existing challenge generation ...

  const rounds: RoundResult[] = [];
  let previousContext = "";

  for (let round = 1; round <= debateConfig.roundsPerChallenge; round++) {
    logDebug(`Round ${round} for ${criterion.name}`);

    // ... existing round logic ...

    const roundResult = await judgeRound(
      activeChallenges,
      defenses,
      round,
      previousContext,
      costTracker,
    );

    rounds.push(roundResult);

    // ✨ NEW: Update score after each round
    const runningSummary = summarizeDebate(rounds, evaluation.score);
    const runningScore = Math.max(
      1,
      Math.min(10, runningSummary.recommendedFinalScore),
    );
    const runningConfidence = Math.max(
      0,
      Math.min(1, evaluation.confidence + runningSummary.netConfidenceImpact),
    );

    await updateEvaluationScore(evaluation.id, {
      final_score: runningScore,
      confidence: runningConfidence,
      debate_round_count: round,
    });

    // ✨ NEW: Broadcast progressive update
    if (broadcaster) {
      await broadcaster.scoreUpdated(
        criterion.name,
        criterion.category,
        evaluation.score,
        runningScore,
        round,
        debateConfig.roundsPerChallenge,
      );
    }

    // ... rest of round logic ...
  }

  // Final summary
  const summary = summarizeDebate(rounds, evaluation.score);
  const finalScore = Math.max(1, Math.min(10, summary.recommendedFinalScore));
  const finalConfidence = Math.max(
    0,
    Math.min(1, evaluation.confidence + summary.netConfidenceImpact),
  );

  // ✨ NEW: Mark debate as complete
  await updateEvaluationScore(evaluation.id, {
    final_score: finalScore,
    confidence: finalConfidence,
    debate_complete: true,
  });

  // ... existing return ...
}
```

**File: `utils/broadcast.ts`**

Add new event type:

```typescript
export interface BroadcastEvents {
  // ... existing events ...

  "score:updated": {
    criterion: string;
    category: string;
    originalScore: number;
    currentScore: number;
    round: number;
    totalRounds: number;
  };
}

export function createBroadcaster(ws: WebSocket, room: string) {
  // ... existing methods ...

  scoreUpdated: async (
    criterion: string,
    category: string,
    originalScore: number,
    currentScore: number,
    round: number,
    totalRounds: number,
  ) => {
    await emit("score:updated", {
      criterion,
      category,
      originalScore,
      currentScore,
      round,
      totalRounds,
    });
  };
}
```

### Validation Logic

**Score adjustment validation:**

```typescript
/**
 * Validate score adjustment is within acceptable bounds
 */
function validateScoreAdjustment(
  originalScore: number,
  finalScore: number,
  netAdjustment: number,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check final score range
  if (finalScore < 1 || finalScore > 10) {
    return {
      valid: false,
      warnings: [`Final score ${finalScore} outside valid range [1, 10]`],
    };
  }

  // Check adjustment magnitude
  if (Math.abs(netAdjustment) > 5) {
    warnings.push(`Net adjustment ${netAdjustment} exceeds recommended max ±5`);
  }

  // Check for extreme changes
  const percentChange = Math.abs((finalScore - originalScore) / originalScore);
  if (percentChange > 0.5 && originalScore > 2) {
    warnings.push(
      `Score changed by ${(percentChange * 100).toFixed(0)}% (${originalScore} → ${finalScore})`,
    );
  }

  // Verify calculation
  const expectedFinal = Math.max(
    1,
    Math.min(10, originalScore + netAdjustment),
  );
  if (finalScore !== expectedFinal) {
    warnings.push(
      `Score mismatch: expected ${expectedFinal}, got ${finalScore}`,
    );
  }

  return { valid: true, warnings };
}
```

---

## Pass Criteria

### Must-Have (P0)

1. ✅ **Score Persistence**: `evaluations.final_score` is updated in database after each debate round
2. ✅ **Calculation Correctness**: `finalScore = clamp(originalScore + netAdjustment, 1, 10)` verified in tests
3. ✅ **Adjustment Capping**: Net adjustments capped to [-5, +5] range
4. ✅ **Database Constraints**: Schema enforces `final_score` in [1, 10], `confidence` in [0.0, 1.0]
5. ✅ **Audit Trail**: All score changes logged with round number and verdict references
6. ✅ **Fallback Handling**: If debate fails, `final_score` defaults to `initial_score`
7. ✅ **Test Coverage**: Unit tests verify score updates for various adjustment scenarios

### Should-Have (P1)

8. ✅ **Real-Time Updates**: WebSocket broadcasts `score:updated` events after each round
9. ✅ **Progressive UI**: Frontend shows score progression across rounds
10. ✅ **Validation Warnings**: System logs warnings for extreme adjustments (>±3)
11. ✅ **Confidence Updates**: `evaluations.confidence` adjusted based on debate outcomes
12. ✅ **Partial Debate Support**: Scores updated correctly if budget exceeded mid-debate

### Nice-to-Have (P2)

13. ⚠️ **Score History Table**: Optional `score_change_log` table for detailed audit
14. ⚠️ **Bias Detection**: Alert if >80% of verdicts favor same side
15. ⚠️ **Manual Override**: Admin API to force specific final_score (with reason)
16. ⚠️ **Rollback Support**: Ability to revert scores to pre-debate state
17. ⚠️ **Dashboard Metrics**: Aggregate stats on debate impact (avg delta, % changed)

---

## Dependencies

### Upstream (must exist first)

- ✅ Debate system (`agents/debate.ts`, `agents/arbiter.ts`)
- ✅ Database migrations (evaluations table schema)
- ✅ WebSocket broadcasting (`utils/broadcast.ts`)
- ✅ Evaluation orchestrator (`agents/orchestrator.ts`)

### Downstream (will use this)

- Final synthesis (needs accurate final_score for recommendation)
- API endpoints (debates.ts already reads final_score)
- Frontend UI (will display score progression)
- Analytics/reporting (needs score deltas for metrics)

### Parallel (can develop simultaneously)

- PHASE5-TASK-02: Evidence collection (orthogonal to score updates)
- PHASE5-TASK-01: Red-team debate system (already exists, just needs integration)

---

## Testing Strategy

### Unit Tests

**File: `tests/unit/debate-scores.test.ts`**

```typescript
describe("Dynamic Score Adjustment", () => {
  it("should update final_score after debate", async () => {
    const originalScore = 7;
    const adjustments = [+2, -1, +1]; // net = +2
    const expectedFinal = 9;

    // Run debate with mock verdicts
    const result = await runMockDebate(originalScore, adjustments);

    expect(result.finalScore).toBe(expectedFinal);

    // Verify database
    const dbScore = await getEvaluationScore(result.evaluationId);
    expect(dbScore.final_score).toBe(expectedFinal);
    expect(dbScore.initial_score).toBe(originalScore);
  });

  it("should cap adjustments to ±5", async () => {
    const originalScore = 5;
    const adjustments = [+3, +3, +3]; // net = +9, capped to +5

    const result = await runMockDebate(originalScore, adjustments);

    expect(result.finalScore).toBe(10); // 5 + 5 = 10
    expect(result.summary.netScoreAdjustment).toBe(5); // capped
  });

  it("should clamp final score to [1, 10]", async () => {
    const originalScore = 2;
    const adjustments = [-3, -3]; // net = -6, would give -4

    const result = await runMockDebate(originalScore, adjustments);

    expect(result.finalScore).toBe(1); // clamped to minimum
  });

  it("should preserve initial_score if debate fails", async () => {
    const originalScore = 8;

    const result = await runMockDebate(originalScore, [], { failDebate: true });

    expect(result.finalScore).toBe(originalScore);
    const dbScore = await getEvaluationScore(result.evaluationId);
    expect(dbScore.final_score).toBe(originalScore);
  });

  it("should update confidence based on debate", async () => {
    const originalConfidence = 0.7;
    const confidenceImpacts = [+0.1, -0.05, +0.15]; // net = +0.2

    const result = await runMockDebate(7, [+1, 0, +2], {
      confidenceImpacts,
    });

    expect(result.finalConfidence).toBe(0.9); // 0.7 + 0.2
  });
});
```

### Integration Tests

**File: `tests/integration/debate-score-persistence.test.ts`**

```typescript
describe("Debate Score Persistence Integration", () => {
  it("should persist scores after multi-round debate", async () => {
    const ideaSlug = "test-idea";
    const criterion = ALL_CRITERIA[0]; // Problem Severity

    // Run actual debate (mocked LLM calls)
    const debate = await runCriterionDebate(
      criterion,
      mockEvaluation({ score: 6, confidence: 0.6 }),
      mockIdeaContent(),
      mockCostTracker(),
      mockBroadcaster(),
    );

    // Verify database updated
    const evaluation = await getEvaluation(debate.criterion.id);
    expect(evaluation.initial_score).toBe(6);
    expect(evaluation.final_score).not.toBe(6); // Changed
    expect(evaluation.debate_complete).toBe(true);

    // Verify debate_rounds recorded
    const rounds = await getDebateRounds(evaluation.evaluation_run_id);
    const totalAdjustment = rounds.reduce(
      (sum, r) => sum + r.score_adjustment,
      0,
    );
    expect(evaluation.final_score).toBe(
      Math.max(1, Math.min(10, 6 + totalAdjustment)),
    );
  });
});
```

---

## Implementation Notes

### Edge Cases

1. **Budget Exceeded Mid-Debate**: If budget runs out after round 2 of 3, score is updated based on completed rounds only. Mark `debate_complete = false` with `debate_round_count = 2`.

2. **All Draws**: If every verdict is DRAW, score adjustments are ±0. `final_score = initial_score`. This is valid.

3. **Contradictory Verdicts**: Round 1: +3, Round 2: -3, net = 0. System allows this; it means debate was inconclusive.

4. **Extreme Original Scores**: If `original_score = 1` and adjustment = -3, final is clamped to 1. If `original_score = 10` and adjustment = +3, final is clamped to 10.

5. **Re-Running Debate**: If debate is run twice for same evaluation, second run overwrites `final_score`. Consider adding `debate_run_count` to track this.

### Performance Considerations

- **Database Writes**: Updating `final_score` after each round adds 2-3 writes per criterion. For 30 criteria × 3 rounds = 90 writes. Acceptable (<1s total).
- **WebSocket Broadcast**: Each score update triggers a broadcast. Throttle to max 10/sec if needed.
- **Concurrent Debates**: If running parallel debates for all criteria, use database transactions to prevent write conflicts.

### Migration Strategy

1. **Phase 1**: Add database columns and constraints (migration 018)
2. **Phase 2**: Update `runCriterionDebate()` to persist scores
3. **Phase 3**: Add WebSocket broadcast for real-time updates
4. **Phase 4**: Add validation and logging
5. **Phase 5**: Add optional audit table for detailed history

### Rollback Plan

If issues arise:

1. Migration 018 is reversible (DROP columns)
2. Score update code is opt-in (can be disabled via config flag)
3. Legacy behavior: final_score updated only at end of debate, not per-round

---

## References

- Existing debate system: `agents/debate.ts`
- Arbiter logic: `agents/arbiter.ts`
- Score migrations: `database/migrations/015_fix_debate_scores.sql`
- API routes: `server/routes/debates.ts`
- WebSocket events: `utils/broadcast.ts`
- Parent Harness strategic plan: `STRATEGIC_PLAN.md` (Phase 5)

---

## Success Metrics

1. **Correctness**: 100% of debates result in `final_score = clamp(initial_score + Σ(adjustments), 1, 10)`
2. **Persistence**: 100% of final scores written to database and retrievable via API
3. **Real-Time**: Score updates visible in UI within 500ms of round completion
4. **Audit**: 100% of score changes have corresponding `debate_rounds` entries
5. **Edge Cases**: All fallback scenarios (budget exceeded, failed debate, all draws) tested and working

---

**END OF SPECIFICATION**
