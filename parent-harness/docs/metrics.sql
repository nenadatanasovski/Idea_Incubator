-- Harness recovery metrics pack
-- Run after each validation run to compare against baseline.

-- Session/task synchronization
SELECT COUNT(*) AS running_sessions FROM agent_sessions WHERE status='running';
SELECT COUNT(*) AS in_progress_tasks FROM tasks WHERE status='in_progress';
SELECT COUNT(*) AS running_sessions_with_non_in_progress_task
FROM agent_sessions s
JOIN tasks t ON t.id=s.task_id
WHERE s.status='running' AND COALESCE(t.status,'')<>'in_progress';

-- Retry behavior
SELECT MAX(retry_count) AS max_retry_count FROM tasks;
SELECT COUNT(*) AS tasks_retry_ge_policy FROM tasks WHERE retry_count>=5;
SELECT
  COUNT(*) AS retry_rows,
  SUM(CASE WHEN error='Unknown error' THEN 1 ELSE 0 END) AS unknown_error_rows
FROM task_retry_attempts;

-- Assignment churn
SELECT COUNT(*) AS assigned_events
FROM observability_events
WHERE event_type='task:assigned';
SELECT COUNT(DISTINCT task_id) AS distinct_assigned_tasks
FROM observability_events
WHERE event_type='task:assigned';
SELECT
  strftime('%Y-%m-%d %H:%M', timestamp) AS minute_bucket,
  COUNT(*) AS assigned_per_minute
FROM observability_events
WHERE event_type='task:assigned'
GROUP BY minute_bucket
ORDER BY assigned_per_minute DESC
LIMIT 1;

-- Test-task pressure
SELECT COUNT(*) AS test_task_assign_events
FROM observability_events e
JOIN tasks t ON t.id=e.task_id
WHERE e.event_type='task:assigned'
  AND (
    t.category='test'
    OR lower(COALESCE(t.display_id,'')) LIKE 'test_%'
    OR lower(COALESCE(t.display_id,'')) LIKE 'concurrent_%'
  );

-- Observability quality
SELECT
  SUM(CASE WHEN payload IS NOT NULL AND trim(payload)<>'' THEN 1 ELSE 0 END) AS events_with_payload,
  COUNT(*) AS total_events
FROM observability_events;
SELECT COUNT(*) AS cron_ticks_count FROM cron_ticks;
SELECT COUNT(*) AS pipeline_events_count FROM pipeline_events;
SELECT COUNT(*) AS iteration_logs_count FROM iteration_logs;

-- Telegram correlation
SELECT
  COUNT(*) AS telegram_total,
  SUM(CASE WHEN task_id IS NULL THEN 1 ELSE 0 END) AS telegram_task_null,
  SUM(CASE WHEN session_id IS NULL THEN 1 ELSE 0 END) AS telegram_session_null
FROM telegram_messages;

