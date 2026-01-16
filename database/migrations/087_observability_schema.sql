-- =============================================================================
-- Migration: 087_observability_schema.sql
-- Purpose: Create observability and operability tables for Build Agent tracking
-- Created: 2026-01-16
-- Reference: docs/specs/observability/appendices/DATABASE.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: transcript_entries
-- Unified transcript entries - each row is one line in the JSONL transcript
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcript_entries (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,              -- ISO8601 with milliseconds
    sequence INTEGER NOT NULL,            -- Monotonic within execution
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT,                         -- FK to tasks (nullable for non-task entries)
    instance_id TEXT NOT NULL,            -- Build Agent instance ID
    wave_number INTEGER,                  -- Parallel execution wave
    entry_type TEXT NOT NULL,             -- TranscriptEntryType enum
    category TEXT NOT NULL,               -- EntryCategory enum
    summary TEXT NOT NULL,                -- Human-readable (max 200 chars)
    details TEXT,                         -- JSON: structured details
    skill_ref TEXT,                       -- JSON: SkillReference
    tool_calls TEXT,                      -- JSON array: ToolCall[]
    assertions TEXT,                      -- JSON array: AssertionResult[]
    duration_ms INTEGER,                  -- Time for this operation
    token_estimate INTEGER,               -- Estimated tokens used
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_transcript_execution ON transcript_entries(execution_id);
CREATE INDEX IF NOT EXISTS idx_transcript_task ON transcript_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_transcript_type ON transcript_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_transcript_timestamp ON transcript_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_transcript_exec_sequence ON transcript_entries(execution_id, sequence);
CREATE INDEX IF NOT EXISTS idx_transcript_instance ON transcript_entries(instance_id);
CREATE INDEX IF NOT EXISTS idx_transcript_wave ON transcript_entries(wave_number);


-- -----------------------------------------------------------------------------
-- Table: skill_traces
-- Skill invocation traces - captures every use of SKILLS.md or skill files
-- NOTE: Created before tool_uses due to FK dependency
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_traces (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT NOT NULL,                -- FK to tasks
    skill_name TEXT NOT NULL,             -- Skill identifier
    skill_file TEXT NOT NULL,             -- Path to skill file
    line_number INTEGER,                  -- Line where skill is defined
    section_title TEXT,                   -- Section heading
    input_summary TEXT,                   -- Summarized inputs (max 500 chars)
    output_summary TEXT,                  -- Summarized outputs (max 500 chars)
    start_time TEXT NOT NULL,             -- ISO8601
    end_time TEXT,                        -- ISO8601 (null if in progress)
    duration_ms INTEGER,                  -- Total duration
    token_estimate INTEGER,               -- Estimated tokens
    status TEXT NOT NULL,                 -- 'success', 'partial', 'failed'
    error_message TEXT,                   -- Error details if failed
    tool_calls TEXT,                      -- JSON array: tool use IDs
    sub_skills TEXT,                      -- JSON array: skill_trace IDs
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_skill_trace_execution ON skill_traces(execution_id);
CREATE INDEX IF NOT EXISTS idx_skill_trace_skill ON skill_traces(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_trace_task ON skill_traces(task_id);
CREATE INDEX IF NOT EXISTS idx_skill_trace_status ON skill_traces(status);
CREATE INDEX IF NOT EXISTS idx_skill_trace_start ON skill_traces(start_time);


-- -----------------------------------------------------------------------------
-- Table: tool_uses
-- Tool use records - atomic unit of agent action (file read, write, bash, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_uses (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT,                         -- FK to tasks (nullable)
    transcript_entry_id TEXT NOT NULL,    -- FK to transcript_entries
    tool TEXT NOT NULL,                   -- Tool name (Read, Write, Bash, etc.)
    tool_category TEXT NOT NULL,          -- Category (file_read, file_write, shell, etc.)
    input TEXT NOT NULL,                  -- JSON: structured input
    input_summary TEXT NOT NULL,          -- Human-readable (max 200 chars)
    result_status TEXT NOT NULL,          -- 'done', 'error', 'blocked'
    output TEXT,                          -- JSON: structured output
    output_summary TEXT NOT NULL,         -- Human-readable (max 500 chars)
    is_error INTEGER NOT NULL DEFAULT 0,  -- 1 if tool failed
    is_blocked INTEGER NOT NULL DEFAULT 0,-- 1 if security-blocked
    error_message TEXT,                   -- Error details
    block_reason TEXT,                    -- Why command was blocked
    start_time TEXT NOT NULL,             -- ISO8601
    end_time TEXT NOT NULL,               -- ISO8601
    duration_ms INTEGER NOT NULL,         -- Execution time
    within_skill TEXT,                    -- FK to skill_traces (if within skill)
    parent_tool_use_id TEXT,              -- FK to tool_uses (for nested calls)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (transcript_entry_id) REFERENCES transcript_entries(id),
    FOREIGN KEY (within_skill) REFERENCES skill_traces(id),
    FOREIGN KEY (parent_tool_use_id) REFERENCES tool_uses(id)
);

CREATE INDEX IF NOT EXISTS idx_tool_use_execution ON tool_uses(execution_id);
CREATE INDEX IF NOT EXISTS idx_tool_use_task ON tool_uses(task_id);
CREATE INDEX IF NOT EXISTS idx_tool_use_tool ON tool_uses(tool);
CREATE INDEX IF NOT EXISTS idx_tool_use_category ON tool_uses(tool_category);
CREATE INDEX IF NOT EXISTS idx_tool_use_status ON tool_uses(result_status);
CREATE INDEX IF NOT EXISTS idx_tool_use_timestamp ON tool_uses(start_time);
CREATE INDEX IF NOT EXISTS idx_tool_use_skill ON tool_uses(within_skill);
CREATE INDEX IF NOT EXISTS idx_tool_use_transcript ON tool_uses(transcript_entry_id);
CREATE INDEX IF NOT EXISTS idx_tool_use_errors ON tool_uses(is_error) WHERE is_error = 1;
CREATE INDEX IF NOT EXISTS idx_tool_use_blocked ON tool_uses(is_blocked) WHERE is_blocked = 1;


-- -----------------------------------------------------------------------------
-- Table: assertion_chains
-- Groups of ordered assertions for a task
-- NOTE: Created before assertion_results due to FK dependency
-- INCLUDES: started_at and completed_at columns (P1 fix from data model alignment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assertion_chains (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,                -- FK to tasks
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    description TEXT NOT NULL,            -- What this chain validates
    overall_result TEXT NOT NULL,         -- 'pass', 'fail', 'partial'
    pass_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,
    first_failure_id TEXT,                -- FK to assertion_results (set after insert)
    started_at TEXT,                      -- When chain started (P1 fix)
    completed_at TEXT,                    -- When chain completed (P1 fix)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_chain_execution ON assertion_chains(execution_id);
CREATE INDEX IF NOT EXISTS idx_chain_task ON assertion_chains(task_id);
CREATE INDEX IF NOT EXISTS idx_chain_result ON assertion_chains(overall_result);
CREATE INDEX IF NOT EXISTS idx_chain_started ON assertion_chains(started_at);


-- -----------------------------------------------------------------------------
-- Table: assertion_results
-- Test assertions with pass/fail and evidence
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assertion_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,                -- FK to tasks
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    category TEXT NOT NULL,               -- Category (file_created, tsc_compiles, etc.)
    description TEXT NOT NULL,            -- What we're asserting
    result TEXT NOT NULL,                 -- 'pass', 'fail', 'skip', 'warn'
    evidence TEXT NOT NULL,               -- JSON: AssertionEvidence
    chain_id TEXT,                        -- FK to assertion_chains
    chain_position INTEGER,               -- Position in chain (0-indexed)
    timestamp TEXT NOT NULL,              -- When assertion was made
    duration_ms INTEGER,                  -- How long assertion took
    transcript_entry_id TEXT,             -- Link to transcript entry
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (transcript_entry_id) REFERENCES transcript_entries(id),
    FOREIGN KEY (chain_id) REFERENCES assertion_chains(id)
);

CREATE INDEX IF NOT EXISTS idx_assertion_task ON assertion_results(task_id);
CREATE INDEX IF NOT EXISTS idx_assertion_execution ON assertion_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_assertion_result ON assertion_results(result);
CREATE INDEX IF NOT EXISTS idx_assertion_chain ON assertion_results(chain_id);
CREATE INDEX IF NOT EXISTS idx_assertion_category ON assertion_results(category);
CREATE INDEX IF NOT EXISTS idx_assertion_timestamp ON assertion_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_assertion_failures ON assertion_results(result) WHERE result = 'fail';


-- -----------------------------------------------------------------------------
-- Table: message_bus_log
-- Human-readable log auto-populated via trigger from events table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_bus_log (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,               -- FK to events
    timestamp TEXT NOT NULL,              -- Event timestamp
    source TEXT NOT NULL,                 -- Event source
    event_type TEXT NOT NULL,             -- Event type
    correlation_id TEXT,                  -- For related events
    human_summary TEXT NOT NULL,          -- Plain English description
    severity TEXT NOT NULL,               -- 'info', 'warning', 'error', 'critical'
    category TEXT NOT NULL,               -- 'lifecycle', 'coordination', 'failure', 'decision'
    transcript_entry_id TEXT,             -- Link to transcript entry
    task_id TEXT,                         -- Related task
    execution_id TEXT,                    -- Related execution
    payload TEXT,                         -- JSON (filtered)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_mbus_log_timestamp ON message_bus_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_mbus_log_severity ON message_bus_log(severity);
CREATE INDEX IF NOT EXISTS idx_mbus_log_category ON message_bus_log(category);
CREATE INDEX IF NOT EXISTS idx_mbus_log_source ON message_bus_log(source);
CREATE INDEX IF NOT EXISTS idx_mbus_log_event_type ON message_bus_log(event_type);
CREATE INDEX IF NOT EXISTS idx_mbus_log_correlation ON message_bus_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_mbus_log_execution ON message_bus_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_mbus_log_task ON message_bus_log(task_id);
CREATE INDEX IF NOT EXISTS idx_mbus_log_errors ON message_bus_log(severity) WHERE severity IN ('error', 'critical');


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


-- -----------------------------------------------------------------------------
-- Update first_failure_id FK on assertion_chains after assertion_results created
-- -----------------------------------------------------------------------------
ALTER TABLE assertion_chains ADD CONSTRAINT fk_first_failure
    FOREIGN KEY (first_failure_id) REFERENCES assertion_results(id);
