-- Migration 017: Make score calculations consistent across the system
--
-- Problem: idea_latest_scores view uses simple AVG, but synthesis uses weighted average.
-- This causes scores to differ (e.g., 3.0 vs 3.04).
--
-- Solution: Update the view to use weighted average by category.

DROP VIEW IF EXISTS idea_latest_scores;

CREATE VIEW idea_latest_scores AS
WITH latest_runs AS (
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
),
category_averages AS (
  SELECT
    e.idea_id,
    e.evaluation_run_id,
    e.category,
    AVG(e.final_score) as cat_avg,
    AVG(e.confidence) as cat_conf,
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
  GROUP BY e.idea_id, e.evaluation_run_id, e.category
)
SELECT
    i.id,
    i.slug,
    i.title,
    i.lifecycle_stage,
    ROUND(SUM(ca.cat_avg * ca.cat_weight), 2) as avg_score,
    ROUND(AVG(ca.cat_conf), 2) as avg_confidence,
    lr.evaluation_run_id as latest_run_id,
    lr.latest_at as last_evaluated,
    (SELECT COUNT(DISTINCT evaluation_run_id) FROM evaluations WHERE idea_id = i.id) as total_evaluation_count
FROM ideas i
LEFT JOIN latest_runs lr ON i.id = lr.idea_id
LEFT JOIN category_averages ca ON i.id = ca.idea_id AND ca.evaluation_run_id = lr.evaluation_run_id
GROUP BY i.id;
