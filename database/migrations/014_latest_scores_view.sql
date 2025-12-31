-- Migration 014: Create idea_latest_scores view
-- This view returns scores ONLY from the most recent evaluation run
-- Fixes the issue where idea_scores averaged ALL runs (lifetime data)

-- Create a new view that filters to latest run only
CREATE VIEW IF NOT EXISTS idea_latest_scores AS
WITH latest_runs AS (
  -- Get the most recent evaluation_run_id for each idea
  SELECT
    e1.idea_id,
    e1.evaluation_run_id,
    e1.evaluated_at as latest_at
  FROM evaluations e1
  INNER JOIN (
    SELECT idea_id, MAX(evaluated_at) as max_at
    FROM evaluations
    GROUP BY idea_id
  ) e2 ON e1.idea_id = e2.idea_id AND e1.evaluated_at = e2.max_at
  GROUP BY e1.idea_id
)
SELECT
    i.id,
    i.slug,
    i.title,
    i.lifecycle_stage,
    ROUND(AVG(e.final_score), 2) as avg_score,
    ROUND(AVG(e.confidence), 2) as avg_confidence,
    lr.evaluation_run_id as latest_run_id,
    lr.latest_at as last_evaluated,
    COUNT(DISTINCT e.evaluation_run_id) as total_evaluation_count
FROM ideas i
LEFT JOIN latest_runs lr ON i.id = lr.idea_id
LEFT JOIN evaluations e ON i.id = e.idea_id AND e.evaluation_run_id = lr.evaluation_run_id
GROUP BY i.id;
