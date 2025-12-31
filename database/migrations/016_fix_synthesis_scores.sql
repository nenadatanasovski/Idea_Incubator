-- Migration 016: Fix synthesis scores to match updated evaluations
--
-- Problem: Migration 015 updated evaluations.final_score but didn't update
-- final_syntheses.overall_score, causing score mismatches in the UI.
--
-- This migration recalculates synthesis.overall_score from the corrected
-- evaluation final_scores.

-- Update final_syntheses.overall_score to match recalculated weighted average
-- First average within each category (5 criteria per category), then apply weights
UPDATE final_syntheses
SET overall_score = (
  SELECT ROUND(
    SUM(cat_avg * cat_weight), 2
  )
  FROM (
    SELECT
      e.category,
      AVG(e.final_score) as cat_avg,
      CASE e.category
        WHEN 'problem' THEN 0.20
        WHEN 'solution' THEN 0.20
        WHEN 'feasibility' THEN 0.15
        WHEN 'fit' THEN 0.15
        WHEN 'market' THEN 0.15
        WHEN 'risk' THEN 0.15
        ELSE 0.0
      END as cat_weight
    FROM evaluations e
    WHERE e.idea_id = final_syntheses.idea_id
      AND e.evaluation_run_id = final_syntheses.evaluation_run_id
    GROUP BY e.category
  )
),
overall_confidence = (
  SELECT ROUND(AVG(e.confidence), 2)
  FROM evaluations e
  WHERE e.idea_id = final_syntheses.idea_id
    AND e.evaluation_run_id = final_syntheses.evaluation_run_id
)
WHERE EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.idea_id = final_syntheses.idea_id
    AND e.evaluation_run_id = final_syntheses.evaluation_run_id
);

-- Note: The executive_summary text still contains the old score value
-- This is historical data and shouldn't be modified (would require AI regeneration)
