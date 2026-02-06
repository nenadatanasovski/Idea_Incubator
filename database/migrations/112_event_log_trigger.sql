-- Migration: 112_event_log_trigger.sql
-- Purpose: Create trigger to auto-populate message_bus_log from events
-- Depends on: 087_observability_schema.sql (message_bus_log table)
--            111_events_table.sql (events table)

-- -----------------------------------------------------------------------------
-- Trigger: Auto-populate message_bus_log from events
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS tr_event_to_log
AFTER INSERT ON events
WHEN NEW.event_type IN (
    'test_started', 'test_passed', 'test_failed', 'test_blocked',
    'file_locked', 'file_unlocked', 'file_conflict',
    'stuck_detected', 'regression_detected', 'deadlock_detected',
    'decision_needed', 'decision_made',
    'knowledge_recorded',
    'checkpoint_created', 'rollback_triggered',
    'task_started', 'task_completed', 'task_failed',
    'wave_started', 'wave_completed', 'wave_failed',
    'agent_spawned', 'agent_terminated'
)
BEGIN
    INSERT INTO message_bus_log (
        id, event_id, timestamp, source, event_type, correlation_id,
        human_summary, severity, category, payload
    )
    SELECT
        'mbl-' || lower(hex(randomblob(8))),
        NEW.id, NEW.timestamp, NEW.source, NEW.event_type, NEW.correlation_id,
        -- Generate human-readable summary
        CASE NEW.event_type
            WHEN 'test_started' THEN 'Loop ' || NEW.source || ' started working on ' || COALESCE(json_extract(NEW.payload, '$.test_id'), 'unknown')
            WHEN 'test_passed' THEN 'Test ' || COALESCE(json_extract(NEW.payload, '$.test_id'), 'unknown') || ' PASSED'
            WHEN 'test_failed' THEN 'Test ' || COALESCE(json_extract(NEW.payload, '$.test_id'), 'unknown') || ' FAILED: ' || COALESCE(json_extract(NEW.payload, '$.error_message'), 'unknown error')
            WHEN 'file_locked' THEN 'Loop ' || NEW.source || ' locked ' || COALESCE(json_extract(NEW.payload, '$.file_path'), 'file')
            WHEN 'file_unlocked' THEN 'Loop ' || NEW.source || ' released ' || COALESCE(json_extract(NEW.payload, '$.file_path'), 'file')
            WHEN 'file_conflict' THEN 'CONFLICT: ' || COALESCE(json_extract(NEW.payload, '$.loop_a'), '?') || ' and ' || COALESCE(json_extract(NEW.payload, '$.loop_b'), '?') || ' modified ' || COALESCE(json_extract(NEW.payload, '$.file_path'), 'file')
            WHEN 'stuck_detected' THEN 'STUCK: Loop ' || COALESCE(json_extract(NEW.payload, '$.loop_id'), NEW.source) || ' failed ' || COALESCE(json_extract(NEW.payload, '$.consecutive_failures'), '?') || 'x'
            WHEN 'decision_needed' THEN 'DECISION: ' || COALESCE(json_extract(NEW.payload, '$.summary'), 'decision required')
            WHEN 'decision_made' THEN 'DECIDED: ' || COALESCE(json_extract(NEW.payload, '$.choice'), '?') || ' by ' || COALESCE(json_extract(NEW.payload, '$.decided_by'), '?')
            WHEN 'knowledge_recorded' THEN 'LEARNED: ' || COALESCE(json_extract(NEW.payload, '$.content'), 'new knowledge')
            WHEN 'checkpoint_created' THEN 'CHECKPOINT: ' || COALESCE(json_extract(NEW.payload, '$.checkpoint_id'), '?') || ' created'
            WHEN 'rollback_triggered' THEN 'ROLLBACK: ' || NEW.source || ' rolling back to ' || COALESCE(json_extract(NEW.payload, '$.checkpoint_id'), '?')
            WHEN 'task_started' THEN 'Task ' || COALESCE(json_extract(NEW.payload, '$.task_id'), '?') || ' started by ' || NEW.source
            WHEN 'task_completed' THEN 'Task ' || COALESCE(json_extract(NEW.payload, '$.task_id'), '?') || ' completed'
            WHEN 'task_failed' THEN 'Task ' || COALESCE(json_extract(NEW.payload, '$.task_id'), '?') || ' FAILED: ' || COALESCE(json_extract(NEW.payload, '$.error'), 'unknown')
            WHEN 'wave_started' THEN 'Wave ' || COALESCE(json_extract(NEW.payload, '$.wave_number'), '?') || ' started with ' || COALESCE(json_extract(NEW.payload, '$.task_count'), '?') || ' tasks'
            WHEN 'wave_completed' THEN 'Wave ' || COALESCE(json_extract(NEW.payload, '$.wave_number'), '?') || ' completed'
            WHEN 'wave_failed' THEN 'Wave ' || COALESCE(json_extract(NEW.payload, '$.wave_number'), '?') || ' FAILED'
            WHEN 'agent_spawned' THEN 'Agent ' || COALESCE(json_extract(NEW.payload, '$.agent_id'), '?') || ' spawned for task ' || COALESCE(json_extract(NEW.payload, '$.task_id'), '?')
            WHEN 'agent_terminated' THEN 'Agent ' || COALESCE(json_extract(NEW.payload, '$.agent_id'), '?') || ' terminated: ' || COALESCE(json_extract(NEW.payload, '$.reason'), 'completed')
            ELSE NEW.event_type || ' from ' || NEW.source
        END,
        -- Determine severity
        CASE
            WHEN NEW.event_type IN ('test_failed', 'file_conflict', 'stuck_detected', 'regression_detected', 'deadlock_detected', 'task_failed', 'wave_failed') THEN 'error'
            WHEN NEW.event_type IN ('decision_needed', 'resource_warning', 'test_blocked', 'digression_detected', 'timeout_warning') THEN 'warning'
            WHEN NEW.event_type IN ('system_error', 'critical_failure') THEN 'critical'
            ELSE 'info'
        END,
        -- Determine category
        CASE
            WHEN NEW.event_type LIKE 'test_%' OR NEW.event_type LIKE 'task_%' OR NEW.event_type LIKE 'wave_%' OR NEW.event_type LIKE '%checkpoint%' OR NEW.event_type LIKE '%rollback%' OR NEW.event_type LIKE 'agent_%' THEN 'lifecycle'
            WHEN NEW.event_type LIKE 'file_%' OR NEW.event_type LIKE '%conflict%' OR NEW.event_type LIKE '%deadlock%' OR NEW.event_type LIKE '%lock%' THEN 'coordination'
            WHEN NEW.event_type LIKE '%failed%' OR NEW.event_type LIKE '%stuck%' OR NEW.event_type LIKE '%regression%' OR NEW.event_type LIKE '%error%' THEN 'failure'
            WHEN NEW.event_type LIKE '%decision%' OR NEW.event_type LIKE '%human%' THEN 'decision'
            ELSE 'lifecycle'
        END,
        NEW.payload;
END;
