-- Migration 015: Fix evaluations.final_score to include debate adjustments
-- First Principles: post-debate score = initial_score + sum(debate_adjustments)
--
-- This is a ONE-TIME migration for existing data where:
-- 1. evaluations.final_score was never updated after debate
-- 2. debate_rounds.score_adjustment contains the adjustments but wasn't applied
--
-- After this migration:
-- - evaluations.final_score will reflect the actual post-debate score
-- - Future evaluations will be updated by saveDebateResults() in evaluate.ts

-- Step 1: Update evaluations.final_score by summing debate adjustments
-- Uses COALESCE to handle cases where initial_score might be null (legacy data)
-- Uses MIN/MAX to clamp values to valid range [1, 10] to respect CHECK constraint
UPDATE evaluations
SET final_score = MAX(1, MIN(10,
  COALESCE(initial_score, final_score) + COALESCE(
    (SELECT SUM(score_adjustment)
     FROM debate_rounds d
     WHERE d.idea_id = evaluations.idea_id
       AND d.evaluation_run_id = evaluations.evaluation_run_id
       AND d.criterion = evaluations.criterion),
    0
  )
))
WHERE EXISTS (
  SELECT 1 FROM debate_rounds d
  WHERE d.idea_id = evaluations.idea_id
    AND d.evaluation_run_id = evaluations.evaluation_run_id
);

-- Verification query (run manually to verify migration):
-- SELECT
--   e.criterion,
--   e.initial_score,
--   e.final_score as new_final_score,
--   (SELECT SUM(score_adjustment)
--    FROM debate_rounds d
--    WHERE d.idea_id = e.idea_id
--      AND d.evaluation_run_id = e.evaluation_run_id
--      AND d.criterion = e.criterion) as expected_adjustment
-- FROM evaluations e
-- WHERE e.evaluation_run_id = 'YOUR_RUN_ID'
-- ORDER BY e.category, e.criterion;
