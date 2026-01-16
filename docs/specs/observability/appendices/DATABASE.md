# Observability Appendix B: Database Schema

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > Appendix B: Database
> **Location:** `docs/specs/observability/appendices/DATABASE.md`
> **Purpose:** Complete SQL schema and migration files for the observability system
> **Usage:** Copy to `database/migrations/087_observability_schema.sql`

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Table Definitions](#2-table-definitions)
3. [Indexes](#3-indexes)
4. [Triggers](#4-triggers)
5. [Complete Migration File](#5-complete-migration-file)
6. [Common Queries](#6-common-queries)

---

## 1. Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY DATABASE SCHEMA                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐      ┌─────────────────────┐                           │
│  │ transcript_entries  │      │     tool_uses       │                           │
│  │ ─────────────────── │      │ ─────────────────── │                           │
│  │ id (PK)             │◄────►│ transcript_entry_id │                           │
│  │ execution_id (FK)   │      │ execution_id (FK)   │                           │
│  │ task_id (FK)        │      │ task_id (FK)        │                           │
│  │ entry_type          │      │ tool                │                           │
│  │ category            │      │ result_status       │                           │
│  │ summary             │      │ within_skill (FK)   │──┐                        │
│  └─────────────────────┘      └─────────────────────┘  │                        │
│           │                            │               │                        │
│           │                            │               │                        │
│           ▼                            ▼               ▼                        │
│  ┌─────────────────────┐      ┌─────────────────────┐                           │
│  │  assertion_results  │      │   skill_traces      │                           │
│  │ ─────────────────── │      │ ─────────────────── │                           │
│  │ id (PK)             │      │ id (PK)             │                           │
│  │ task_id (FK)        │      │ execution_id (FK)   │                           │
│  │ execution_id (FK)   │      │ task_id (FK)        │                           │
│  │ category            │      │ skill_name          │                           │
│  │ result              │      │ skill_file          │                           │
│  │ chain_id (FK)       │──┐   │ status              │                           │
│  └─────────────────────┘  │   └─────────────────────┘                           │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────┐      ┌─────────────────────┐                           │
│  │  assertion_chains   │      │  message_bus_log    │                           │
│  │ ─────────────────── │      │ ─────────────────── │                           │
│  │ id (PK)             │      │ id (PK)             │                           │
│  │ task_id (FK)        │      │ event_id (FK)       │                           │
│  │ execution_id (FK)   │      │ human_summary       │                           │
│  │ overall_result      │      │ severity            │                           │
│  │ first_failure_id    │      │ category            │                           │
│  └─────────────────────┘      └─────────────────────┘                           │
│                                        ▲                                        │
│                                        │                                        │
│                               (auto-populated via trigger)                      │
│                                        │                                        │
│                               ┌─────────────────────┐                           │
│                               │      events         │                           │
│                               │ (existing table)    │                           │
│                               └─────────────────────┘                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Table Definitions

### 2.1 transcript_entries

```sql
-- Unified transcript entries
-- Each row is one line in the JSONL transcript
CREATE TABLE IF NOT EXISTS transcript_entries (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Timestamps
    timestamp TEXT NOT NULL,              -- ISO8601 with milliseconds
    sequence INTEGER NOT NULL,            -- Monotonic within execution

    -- Context
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT,                         -- FK to tasks (nullable for non-task entries)
    instance_id TEXT NOT NULL,            -- Build Agent instance ID
    wave_number INTEGER,                  -- Parallel execution wave

    -- Event classification
    entry_type TEXT NOT NULL,             -- See TranscriptEntryType enum
    category TEXT NOT NULL,               -- See EntryCategory enum

    -- Content
    summary TEXT NOT NULL,                -- Human-readable (max 200 chars)
    details TEXT,                         -- JSON: structured details

    -- Traceability (JSON blobs for flexibility)
    skill_ref TEXT,                       -- JSON: SkillReference
    tool_calls TEXT,                      -- JSON array: ToolCall[]
    assertions TEXT,                      -- JSON array: AssertionResult[]

    -- Metrics
    duration_ms INTEGER,                  -- Time for this operation
    token_estimate INTEGER,               -- Estimated tokens used

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Entry type check constraint
-- Valid values: phase_start, phase_end, task_start, task_end, tool_use,
--               skill_invoke, skill_complete, decision, validation,
--               assertion, discovery, error, checkpoint, lock_acquire, lock_release
```

### 2.2 tool_uses

```sql
-- Tool use records (atomic unit of agent action)
-- Captures every file read, write, edit, bash command, etc.
CREATE TABLE IF NOT EXISTS tool_uses (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Context
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT,                         -- FK to tasks (nullable)
    transcript_entry_id TEXT NOT NULL,    -- FK to transcript_entries

    -- Tool identity
    tool TEXT NOT NULL,                   -- Tool name (Read, Write, Bash, etc.)
    tool_category TEXT NOT NULL,          -- Category (file_read, file_write, shell, etc.)

    -- Invocation
    input TEXT NOT NULL,                  -- JSON: structured input
    input_summary TEXT NOT NULL,          -- Human-readable (max 200 chars)

    -- Result
    result_status TEXT NOT NULL,          -- 'done', 'error', 'blocked'
    output TEXT,                          -- JSON: structured output
    output_summary TEXT NOT NULL,         -- Human-readable (max 500 chars)

    -- Error handling
    is_error INTEGER NOT NULL DEFAULT 0,  -- 1 if tool failed
    is_blocked INTEGER NOT NULL DEFAULT 0,-- 1 if security-blocked
    error_message TEXT,                   -- Error details
    block_reason TEXT,                    -- Why command was blocked

    -- Metrics
    start_time TEXT NOT NULL,             -- ISO8601
    end_time TEXT NOT NULL,               -- ISO8601
    duration_ms INTEGER NOT NULL,         -- Execution time

    -- Nesting context
    within_skill TEXT,                    -- FK to skill_traces (if within skill)
    parent_tool_use_id TEXT,              -- FK to tool_uses (for nested calls)

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (transcript_entry_id) REFERENCES transcript_entries(id),
    FOREIGN KEY (within_skill) REFERENCES skill_traces(id),
    FOREIGN KEY (parent_tool_use_id) REFERENCES tool_uses(id)
);

-- Result status check constraint
-- Valid values: 'done', 'error', 'blocked'
```

### 2.3 skill_traces

```sql
-- Skill invocation traces
-- Captures every use of SKILLS.md or skill files
CREATE TABLE IF NOT EXISTS skill_traces (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Context
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs
    task_id TEXT NOT NULL,                -- FK to tasks

    -- Skill identity
    skill_name TEXT NOT NULL,             -- Skill identifier
    skill_file TEXT NOT NULL,             -- Path to skill file
    line_number INTEGER,                  -- Line where skill is defined
    section_title TEXT,                   -- Section heading

    -- Invocation summary
    input_summary TEXT,                   -- Summarized inputs (max 500 chars)
    output_summary TEXT,                  -- Summarized outputs (max 500 chars)

    -- Timing
    start_time TEXT NOT NULL,             -- ISO8601
    end_time TEXT,                        -- ISO8601 (null if in progress)
    duration_ms INTEGER,                  -- Total duration
    token_estimate INTEGER,               -- Estimated tokens

    -- Outcome
    status TEXT NOT NULL,                 -- 'success', 'partial', 'failed'
    error_message TEXT,                   -- Error details if failed

    -- Nested references (JSON for flexibility)
    tool_calls TEXT,                      -- JSON array: tool use IDs
    sub_skills TEXT,                      -- JSON array: skill_trace IDs

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

### 2.4 assertion_results

```sql
-- Assertion results
-- Test assertions with pass/fail and evidence
CREATE TABLE IF NOT EXISTS assertion_results (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Context
    task_id TEXT NOT NULL,                -- FK to tasks
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs

    -- Assertion definition
    category TEXT NOT NULL,               -- Category (file_created, tsc_compiles, etc.)
    description TEXT NOT NULL,            -- What we're asserting

    -- Result
    result TEXT NOT NULL,                 -- 'pass', 'fail', 'skip', 'warn'

    -- Evidence
    evidence TEXT NOT NULL,               -- JSON: AssertionEvidence

    -- Chain membership
    chain_id TEXT,                        -- FK to assertion_chains
    chain_position INTEGER,               -- Position in chain (0-indexed)

    -- Timing
    timestamp TEXT NOT NULL,              -- When assertion was made
    duration_ms INTEGER,                  -- How long assertion took

    -- Traceability
    transcript_entry_id TEXT,             -- Link to transcript entry

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (transcript_entry_id) REFERENCES transcript_entries(id),
    FOREIGN KEY (chain_id) REFERENCES assertion_chains(id)
);

-- Result check constraint
-- Valid values: 'pass', 'fail', 'skip', 'warn'
```

### 2.5 assertion_chains

```sql
-- Assertion chains
-- Groups of ordered assertions for a task
CREATE TABLE IF NOT EXISTS assertion_chains (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Context
    task_id TEXT NOT NULL,                -- FK to tasks
    execution_id TEXT NOT NULL,           -- FK to task_list_execution_runs

    -- Description
    description TEXT NOT NULL,            -- What this chain validates

    -- Results summary
    overall_result TEXT NOT NULL,         -- 'pass', 'fail', 'partial'
    pass_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,

    -- Quick access to first failure
    first_failure_id TEXT,                -- FK to assertion_results

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (first_failure_id) REFERENCES assertion_results(id)
);
```

### 2.6 message_bus_log

```sql
-- Message bus human-readable log
-- Auto-populated via trigger from events table
CREATE TABLE IF NOT EXISTS message_bus_log (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- From original event
    event_id TEXT NOT NULL,               -- FK to events
    timestamp TEXT NOT NULL,              -- Event timestamp
    source TEXT NOT NULL,                 -- Event source
    event_type TEXT NOT NULL,             -- Event type
    correlation_id TEXT,                  -- For related events

    -- Human-readable
    human_summary TEXT NOT NULL,          -- Plain English description
    severity TEXT NOT NULL,               -- 'info', 'warning', 'error', 'critical'
    category TEXT NOT NULL,               -- 'lifecycle', 'coordination', 'failure', 'decision'

    -- Links
    transcript_entry_id TEXT,             -- Link to transcript entry
    task_id TEXT,                         -- Related task
    execution_id TEXT,                    -- Related execution

    -- Original payload (filtered)
    payload TEXT,                         -- JSON

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (event_id) REFERENCES events(id)
);
```

---

## 3. Indexes

```sql
-- =========================================
-- TRANSCRIPT ENTRIES INDEXES
-- =========================================

-- Query by execution (most common)
CREATE INDEX IF NOT EXISTS idx_transcript_execution
    ON transcript_entries(execution_id);

-- Query by task
CREATE INDEX IF NOT EXISTS idx_transcript_task
    ON transcript_entries(task_id);

-- Filter by entry type
CREATE INDEX IF NOT EXISTS idx_transcript_type
    ON transcript_entries(entry_type);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_transcript_timestamp
    ON transcript_entries(timestamp);

-- Sequence ordering within execution
CREATE INDEX IF NOT EXISTS idx_transcript_exec_sequence
    ON transcript_entries(execution_id, sequence);


-- =========================================
-- TOOL USES INDEXES
-- =========================================

-- Query by execution
CREATE INDEX IF NOT EXISTS idx_tool_use_execution
    ON tool_uses(execution_id);

-- Query by task
CREATE INDEX IF NOT EXISTS idx_tool_use_task
    ON tool_uses(task_id);

-- Filter by tool name
CREATE INDEX IF NOT EXISTS idx_tool_use_tool
    ON tool_uses(tool);

-- Filter by category
CREATE INDEX IF NOT EXISTS idx_tool_use_category
    ON tool_uses(tool_category);

-- Filter by status (for finding errors/blocked)
CREATE INDEX IF NOT EXISTS idx_tool_use_status
    ON tool_uses(result_status);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_tool_use_timestamp
    ON tool_uses(start_time);

-- Query by skill context
CREATE INDEX IF NOT EXISTS idx_tool_use_skill
    ON tool_uses(within_skill);

-- Query errors only
CREATE INDEX IF NOT EXISTS idx_tool_use_errors
    ON tool_uses(is_error) WHERE is_error = 1;

-- Query blocked only
CREATE INDEX IF NOT EXISTS idx_tool_use_blocked
    ON tool_uses(is_blocked) WHERE is_blocked = 1;


-- =========================================
-- SKILL TRACES INDEXES
-- =========================================

-- Query by execution
CREATE INDEX IF NOT EXISTS idx_skill_trace_execution
    ON skill_traces(execution_id);

-- Query by skill name
CREATE INDEX IF NOT EXISTS idx_skill_trace_skill
    ON skill_traces(skill_name);

-- Query by task
CREATE INDEX IF NOT EXISTS idx_skill_trace_task
    ON skill_traces(task_id);

-- Query by status
CREATE INDEX IF NOT EXISTS idx_skill_trace_status
    ON skill_traces(status);


-- =========================================
-- ASSERTION RESULTS INDEXES
-- =========================================

-- Query by task
CREATE INDEX IF NOT EXISTS idx_assertion_task
    ON assertion_results(task_id);

-- Query by execution
CREATE INDEX IF NOT EXISTS idx_assertion_execution
    ON assertion_results(execution_id);

-- Filter by result
CREATE INDEX IF NOT EXISTS idx_assertion_result
    ON assertion_results(result);

-- Query by chain
CREATE INDEX IF NOT EXISTS idx_assertion_chain
    ON assertion_results(chain_id);

-- Query by category
CREATE INDEX IF NOT EXISTS idx_assertion_category
    ON assertion_results(category);

-- Query failures only
CREATE INDEX IF NOT EXISTS idx_assertion_failures
    ON assertion_results(result) WHERE result = 'fail';


-- =========================================
-- ASSERTION CHAINS INDEXES
-- =========================================

-- Query by execution
CREATE INDEX IF NOT EXISTS idx_chain_execution
    ON assertion_chains(execution_id);

-- Query by task
CREATE INDEX IF NOT EXISTS idx_chain_task
    ON assertion_chains(task_id);


-- =========================================
-- MESSAGE BUS LOG INDEXES
-- =========================================

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_mbus_log_timestamp
    ON message_bus_log(timestamp);

-- Filter by severity
CREATE INDEX IF NOT EXISTS idx_mbus_log_severity
    ON message_bus_log(severity);

-- Filter by category
CREATE INDEX IF NOT EXISTS idx_mbus_log_category
    ON message_bus_log(category);

-- Filter by source
CREATE INDEX IF NOT EXISTS idx_mbus_log_source
    ON message_bus_log(source);

-- Filter by event type
CREATE INDEX IF NOT EXISTS idx_mbus_log_event_type
    ON message_bus_log(event_type);

-- Query by correlation
CREATE INDEX IF NOT EXISTS idx_mbus_log_correlation
    ON message_bus_log(correlation_id);

-- Query errors/critical only
CREATE INDEX IF NOT EXISTS idx_mbus_log_errors
    ON message_bus_log(severity)
    WHERE severity IN ('error', 'critical');
```

---

## 4. Triggers

### 4.1 Auto-populate Message Bus Log

```sql
-- Trigger to auto-create human-readable log entries from events
CREATE TRIGGER IF NOT EXISTS tr_event_to_log
AFTER INSERT ON events
BEGIN
    INSERT INTO message_bus_log (
        id,
        event_id,
        timestamp,
        source,
        event_type,
        correlation_id,
        human_summary,
        severity,
        category,
        payload
    )
    SELECT
        -- Generate unique ID
        'mbl-' || lower(hex(randomblob(8))),

        -- Copy from event
        NEW.id,
        NEW.timestamp,
        NEW.source,
        NEW.event_type,
        NEW.correlation_id,

        -- Generate human-readable summary
        CASE NEW.event_type
            WHEN 'test_started' THEN
                'Loop ' || NEW.source || ' started working on ' ||
                json_extract(NEW.payload, '$.test_id')
            WHEN 'test_passed' THEN
                'Test ' || json_extract(NEW.payload, '$.test_id') || ' PASSED'
            WHEN 'test_failed' THEN
                'Test ' || json_extract(NEW.payload, '$.test_id') || ' FAILED: ' ||
                json_extract(NEW.payload, '$.error_message')
            WHEN 'file_locked' THEN
                'Loop ' || NEW.source || ' locked ' ||
                json_extract(NEW.payload, '$.file_path')
            WHEN 'file_unlocked' THEN
                'Loop ' || NEW.source || ' released ' ||
                json_extract(NEW.payload, '$.file_path')
            WHEN 'file_conflict' THEN
                'CONFLICT: Both ' || json_extract(NEW.payload, '$.loop_a') ||
                ' and ' || json_extract(NEW.payload, '$.loop_b') ||
                ' modified ' || json_extract(NEW.payload, '$.file_path')
            WHEN 'stuck_detected' THEN
                'STUCK: Loop ' || json_extract(NEW.payload, '$.loop_id') ||
                ' failed ' || json_extract(NEW.payload, '$.consecutive_failures') || 'x'
            WHEN 'decision_needed' THEN
                'DECISION: ' || json_extract(NEW.payload, '$.summary')
            WHEN 'decision_made' THEN
                'DECIDED: ' || json_extract(NEW.payload, '$.choice') ||
                ' by ' || json_extract(NEW.payload, '$.decided_by')
            WHEN 'knowledge_recorded' THEN
                'LEARNED: ' || json_extract(NEW.payload, '$.content')
            WHEN 'regression_detected' THEN
                'REGRESSION: ' || json_extract(NEW.payload, '$.test_id') ||
                ' was passing, now failing'
            WHEN 'checkpoint_created' THEN
                'CHECKPOINT: ' || json_extract(NEW.payload, '$.checkpoint_id') ||
                ' created for ' || json_extract(NEW.payload, '$.test_id')
            WHEN 'rollback_triggered' THEN
                'ROLLBACK: ' || NEW.source || ' rolling back to ' ||
                json_extract(NEW.payload, '$.checkpoint_id')
            ELSE
                NEW.event_type || ' from ' || NEW.source
        END,

        -- Determine severity
        CASE
            WHEN NEW.event_type IN (
                'test_failed',
                'file_conflict',
                'stuck_detected',
                'regression_detected',
                'deadlock_detected'
            ) THEN 'error'
            WHEN NEW.event_type IN (
                'decision_needed',
                'resource_warning',
                'test_blocked',
                'digression_detected',
                'timeout_warning'
            ) THEN 'warning'
            WHEN NEW.event_type IN (
                'system_error',
                'critical_failure'
            ) THEN 'critical'
            ELSE 'info'
        END,

        -- Determine category
        CASE
            WHEN NEW.event_type LIKE 'test_%' OR
                 NEW.event_type LIKE '%checkpoint%' OR
                 NEW.event_type LIKE '%rollback%' THEN 'lifecycle'
            WHEN NEW.event_type LIKE 'file_%' OR
                 NEW.event_type LIKE '%conflict%' OR
                 NEW.event_type LIKE '%deadlock%' OR
                 NEW.event_type LIKE '%lock%' THEN 'coordination'
            WHEN NEW.event_type LIKE '%failed%' OR
                 NEW.event_type LIKE '%stuck%' OR
                 NEW.event_type LIKE '%regression%' OR
                 NEW.event_type LIKE '%error%' THEN 'failure'
            WHEN NEW.event_type LIKE '%decision%' OR
                 NEW.event_type LIKE '%human%' THEN 'decision'
            ELSE 'lifecycle'
        END,

        -- Copy payload
        NEW.payload;
END;
```

---

## 5. Complete Migration File

Copy the following to `database/migrations/087_observability_schema.sql`:

```sql
-- =============================================================================
-- Migration: 087_observability_schema.sql
-- Purpose: Create observability and operability tables
-- Created: 2026-01-16
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: transcript_entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcript_entries (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    execution_id TEXT NOT NULL,
    task_id TEXT,
    instance_id TEXT NOT NULL,
    wave_number INTEGER,
    entry_type TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    skill_ref TEXT,
    tool_calls TEXT,
    assertions TEXT,
    duration_ms INTEGER,
    token_estimate INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_transcript_execution ON transcript_entries(execution_id);
CREATE INDEX IF NOT EXISTS idx_transcript_task ON transcript_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_transcript_type ON transcript_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_transcript_timestamp ON transcript_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_transcript_exec_sequence ON transcript_entries(execution_id, sequence);


-- -----------------------------------------------------------------------------
-- Table: tool_uses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_uses (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    task_id TEXT,
    transcript_entry_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    tool_category TEXT NOT NULL,
    input TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    result_status TEXT NOT NULL,
    output TEXT,
    output_summary TEXT NOT NULL,
    is_error INTEGER NOT NULL DEFAULT 0,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    block_reason TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    within_skill TEXT,
    parent_tool_use_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_tool_use_errors ON tool_uses(is_error) WHERE is_error = 1;
CREATE INDEX IF NOT EXISTS idx_tool_use_blocked ON tool_uses(is_blocked) WHERE is_blocked = 1;


-- -----------------------------------------------------------------------------
-- Table: skill_traces
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_traces (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    skill_file TEXT NOT NULL,
    line_number INTEGER,
    section_title TEXT,
    input_summary TEXT,
    output_summary TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_ms INTEGER,
    token_estimate INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    tool_calls TEXT,
    sub_skills TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_skill_trace_execution ON skill_traces(execution_id);
CREATE INDEX IF NOT EXISTS idx_skill_trace_skill ON skill_traces(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_trace_task ON skill_traces(task_id);
CREATE INDEX IF NOT EXISTS idx_skill_trace_status ON skill_traces(status);


-- -----------------------------------------------------------------------------
-- Table: assertion_results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assertion_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    result TEXT NOT NULL,
    evidence TEXT NOT NULL,
    chain_id TEXT,
    chain_position INTEGER,
    timestamp TEXT NOT NULL,
    duration_ms INTEGER,
    transcript_entry_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (transcript_entry_id) REFERENCES transcript_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_assertion_task ON assertion_results(task_id);
CREATE INDEX IF NOT EXISTS idx_assertion_execution ON assertion_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_assertion_result ON assertion_results(result);
CREATE INDEX IF NOT EXISTS idx_assertion_chain ON assertion_results(chain_id);
CREATE INDEX IF NOT EXISTS idx_assertion_category ON assertion_results(category);
CREATE INDEX IF NOT EXISTS idx_assertion_failures ON assertion_results(result) WHERE result = 'fail';


-- -----------------------------------------------------------------------------
-- Table: assertion_chains
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assertion_chains (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    description TEXT NOT NULL,
    overall_result TEXT NOT NULL,
    pass_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,
    first_failure_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (execution_id) REFERENCES task_list_execution_runs(id),
    FOREIGN KEY (first_failure_id) REFERENCES assertion_results(id)
);

CREATE INDEX IF NOT EXISTS idx_chain_execution ON assertion_chains(execution_id);
CREATE INDEX IF NOT EXISTS idx_chain_task ON assertion_chains(task_id);


-- -----------------------------------------------------------------------------
-- Table: message_bus_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_bus_log (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    correlation_id TEXT,
    human_summary TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    transcript_entry_id TEXT,
    task_id TEXT,
    execution_id TEXT,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_mbus_log_timestamp ON message_bus_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_mbus_log_severity ON message_bus_log(severity);
CREATE INDEX IF NOT EXISTS idx_mbus_log_category ON message_bus_log(category);
CREATE INDEX IF NOT EXISTS idx_mbus_log_source ON message_bus_log(source);
CREATE INDEX IF NOT EXISTS idx_mbus_log_event_type ON message_bus_log(event_type);
CREATE INDEX IF NOT EXISTS idx_mbus_log_correlation ON message_bus_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_mbus_log_errors ON message_bus_log(severity) WHERE severity IN ('error', 'critical');


-- -----------------------------------------------------------------------------
-- Trigger: Auto-populate message_bus_log from events
-- -----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS tr_event_to_log
AFTER INSERT ON events
BEGIN
    INSERT INTO message_bus_log (
        id, event_id, timestamp, source, event_type, correlation_id,
        human_summary, severity, category, payload
    )
    SELECT
        'mbl-' || lower(hex(randomblob(8))),
        NEW.id, NEW.timestamp, NEW.source, NEW.event_type, NEW.correlation_id,
        CASE NEW.event_type
            WHEN 'test_started' THEN 'Loop ' || NEW.source || ' started working on ' || json_extract(NEW.payload, '$.test_id')
            WHEN 'test_passed' THEN 'Test ' || json_extract(NEW.payload, '$.test_id') || ' PASSED'
            WHEN 'test_failed' THEN 'Test ' || json_extract(NEW.payload, '$.test_id') || ' FAILED: ' || json_extract(NEW.payload, '$.error_message')
            WHEN 'file_locked' THEN 'Loop ' || NEW.source || ' locked ' || json_extract(NEW.payload, '$.file_path')
            WHEN 'file_conflict' THEN 'CONFLICT: ' || json_extract(NEW.payload, '$.loop_a') || ' and ' || json_extract(NEW.payload, '$.loop_b') || ' modified ' || json_extract(NEW.payload, '$.file_path')
            WHEN 'stuck_detected' THEN 'STUCK: Loop ' || json_extract(NEW.payload, '$.loop_id') || ' failed ' || json_extract(NEW.payload, '$.consecutive_failures') || 'x'
            WHEN 'decision_needed' THEN 'DECISION: ' || json_extract(NEW.payload, '$.summary')
            WHEN 'knowledge_recorded' THEN 'LEARNED: ' || json_extract(NEW.payload, '$.content')
            ELSE NEW.event_type || ' from ' || NEW.source
        END,
        CASE
            WHEN NEW.event_type IN ('test_failed', 'file_conflict', 'stuck_detected', 'regression_detected') THEN 'error'
            WHEN NEW.event_type IN ('decision_needed', 'resource_warning', 'test_blocked', 'digression_detected') THEN 'warning'
            ELSE 'info'
        END,
        CASE
            WHEN NEW.event_type LIKE 'test_%' THEN 'lifecycle'
            WHEN NEW.event_type LIKE 'file_%' OR NEW.event_type LIKE '%conflict%' OR NEW.event_type LIKE '%deadlock%' THEN 'coordination'
            WHEN NEW.event_type LIKE '%failed%' OR NEW.event_type LIKE '%stuck%' OR NEW.event_type LIKE '%regression%' THEN 'failure'
            WHEN NEW.event_type LIKE '%decision%' OR NEW.event_type LIKE '%human%' THEN 'decision'
            ELSE 'lifecycle'
        END,
        NEW.payload;
END;
```

---

## 6. Common Queries

### 6.1 Get Transcript for Execution

```sql
SELECT * FROM transcript_entries
WHERE execution_id = ?
ORDER BY sequence;
```

### 6.2 Get Tool Uses with Errors

```sql
SELECT * FROM tool_uses
WHERE execution_id = ?
  AND is_error = 1
ORDER BY start_time;
```

### 6.3 Get Blocked Commands

```sql
SELECT * FROM tool_uses
WHERE execution_id = ?
  AND is_blocked = 1
ORDER BY start_time;
```

### 6.4 Get Tool Usage Summary

```sql
SELECT
    tool,
    tool_category,
    COUNT(*) as total,
    SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN result_status = 'blocked' THEN 1 ELSE 0 END) as blocked,
    AVG(duration_ms) as avg_duration_ms
FROM tool_uses
WHERE execution_id = ?
GROUP BY tool, tool_category
ORDER BY total DESC;
```

### 6.5 Get Assertion Summary

```sql
SELECT
    category,
    COUNT(*) as total,
    SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped
FROM assertion_results
WHERE execution_id = ?
GROUP BY category;
```

### 6.6 Get Skill Usage Summary

```sql
SELECT
    skill_name,
    skill_file,
    COUNT(*) as invocations,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(duration_ms) as total_duration_ms
FROM skill_traces
WHERE execution_id = ?
GROUP BY skill_name, skill_file;
```

### 6.7 Get Recent Error Logs

```sql
SELECT * FROM message_bus_log
WHERE severity IN ('error', 'critical')
  AND timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC
LIMIT 50;
```

### 6.8 Get Correlated Events

```sql
SELECT * FROM message_bus_log
WHERE correlation_id = ?
ORDER BY timestamp;
```

### 6.9 Get Execution Pass Rate

```sql
SELECT
    execution_id,
    COUNT(*) as total,
    SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
    ROUND(
        100.0 * SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) as pass_rate
FROM assertion_results
WHERE execution_id = ?
GROUP BY execution_id;
```

### 6.10 Get Tool Calls Within Skill

```sql
SELECT tu.* FROM tool_uses tu
WHERE tu.within_skill = ?
ORDER BY tu.start_time;
```

---

_Copy the migration file to `database/migrations/087_observability_schema.sql` and run `npm run migrate`._
