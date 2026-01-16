# Observability SQL Tools for Agents

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > SQL Tools
> **Location:** `docs/specs/observability/tools/OBSERVABILITY-SQL-TOOLS.md`
> **Purpose:** Comprehensive SQL scripts for agents to validate, troubleshoot, investigate, and aggregate observability data

---

## First Principles Design

### Source of Truth Hierarchy

1. **`transcript_entries`** - The canonical record of all events (immutable append-only log)
2. **`tool_uses`** - Detailed tool invocation data (linked to transcript)
3. **`assertion_results`** - Validation evidence (linked to tool uses)
4. **`skill_traces`** - Skill execution paths (linked to transcript)
5. **`message_bus_log`** - Human-readable event stream (derived)

### Invariants That Must Hold

- Sequence numbers are monotonically increasing per execution
- Every tool_use has a corresponding transcript_entry
- Timestamps follow causal order: start_time < end_time
- Wave tasks sum equals total tasks in execution
- Lock acquires must have matching releases (or timeout)

---

## Tool Categories

| Category              | Purpose                               | Use When                          |
| --------------------- | ------------------------------------- | --------------------------------- |
| **Validation**        | Verify data integrity and invariants  | After execution, before reporting |
| **Troubleshooting**   | Find errors and blocked operations    | When execution fails              |
| **Investigation**     | Deep-dive into execution patterns     | Understanding behavior            |
| **Aggregation**       | Generate summaries and metrics        | Dashboards, reports               |
| **Parallelization**   | Detect concurrency issues             | Multi-agent execution             |
| **Anomaly Detection** | Find outliers and unexpected patterns | Proactive monitoring              |

---

## 1. VALIDATION TOOLS

### V001: Verify Transcript Sequence Integrity

```sql
-- Detects gaps or duplicates in transcript sequence numbers
-- Truth: Sequences must be monotonic with no gaps
SELECT
    execution_id,
    sequence,
    LAG(sequence) OVER (PARTITION BY execution_id ORDER BY sequence) as prev_seq,
    sequence - LAG(sequence) OVER (PARTITION BY execution_id ORDER BY sequence) as gap
FROM transcript_entries
WHERE execution_id = ?
HAVING gap IS NOT NULL AND gap != 1
ORDER BY sequence;
```

### V002: Verify Tool Use Linkage

```sql
-- Every tool_use must have a corresponding transcript_entry
-- Truth: Orphaned tool_uses indicate logging failure
SELECT tu.id, tu.tool, tu.start_time, tu.execution_id
FROM tool_uses tu
LEFT JOIN transcript_entries te ON tu.transcript_entry_id = te.id
WHERE tu.execution_id = ?
  AND te.id IS NULL;
```

### V003: Verify Temporal Consistency

```sql
-- Start times must precede end times
-- Truth: Negative durations indicate clock skew or logging bugs
SELECT
    id, tool, start_time, end_time, duration_ms,
    CASE
        WHEN end_time IS NULL THEN 'incomplete'
        WHEN end_time < start_time THEN 'INVALID: end < start'
        WHEN duration_ms < 0 THEN 'INVALID: negative duration'
        ELSE 'valid'
    END as temporal_status
FROM tool_uses
WHERE execution_id = ?
  AND (end_time < start_time OR duration_ms < 0);
```

### V004: Verify Lock Balance

```sql
-- Lock acquires must match releases
-- Truth: Unbalanced locks indicate resource leaks
WITH lock_events AS (
    SELECT
        json_extract(details, '$.file_path') as file_path,
        entry_type,
        timestamp
    FROM transcript_entries
    WHERE execution_id = ?
      AND entry_type IN ('lock_acquire', 'lock_release')
)
SELECT
    file_path,
    SUM(CASE WHEN entry_type = 'lock_acquire' THEN 1 ELSE 0 END) as acquires,
    SUM(CASE WHEN entry_type = 'lock_release' THEN 1 ELSE 0 END) as releases,
    SUM(CASE WHEN entry_type = 'lock_acquire' THEN 1 ELSE 0 END) -
    SUM(CASE WHEN entry_type = 'lock_release' THEN 1 ELSE 0 END) as unreleased
FROM lock_events
GROUP BY file_path
HAVING unreleased != 0;
```

### V005: Verify Assertion Chain Completeness

```sql
-- Every started chain must be completed
-- Truth: Incomplete chains indicate execution interruption
-- Note: Uses created_at as proxy since started_at/completed_at not in schema.
--       Checks overall_result != 'completed' to detect incomplete chains.
SELECT
    ac.id, ac.task_id, ac.description, ac.created_at,
    ac.overall_result,
    COUNT(ar.id) as assertion_count
FROM assertion_chains ac
LEFT JOIN assertion_results ar ON ac.id = ar.chain_id
WHERE ac.execution_id = ?
  AND ac.overall_result NOT IN ('pass', 'fail')
GROUP BY ac.id;
```

### V006: Verify Wave Task Counts

```sql
-- Wave statistics must match actual task counts
-- Truth: Mismatches indicate tracking bugs
SELECT
    w.id as wave_id,
    w.wave_number,
    ws.task_count as reported_total,
    COUNT(wta.task_id) as actual_total,
    ws.task_count - COUNT(wta.task_id) as discrepancy
FROM parallel_execution_waves w
LEFT JOIN wave_statistics ws ON w.id = ws.wave_id
LEFT JOIN wave_task_assignments wta ON w.id = wta.wave_id
WHERE w.execution_run_id = ?
GROUP BY w.id
HAVING discrepancy != 0;
```

### V007: Verify Foreign Key Integrity

```sql
-- Check all FK relationships are valid
-- Truth: Broken FKs indicate data corruption
SELECT 'tool_uses → transcript_entries' as relationship,
       COUNT(*) as broken_count
FROM tool_uses tu
WHERE tu.transcript_entry_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM transcript_entries WHERE id = tu.transcript_entry_id)

UNION ALL

SELECT 'assertion_results → assertion_chains',
       COUNT(*)
FROM assertion_results ar
WHERE ar.chain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM assertion_chains WHERE id = ar.chain_id)

UNION ALL

SELECT 'wave_task_assignments → parallel_execution_waves',
       COUNT(*)
FROM wave_task_assignments wta
WHERE NOT EXISTS (SELECT 1 FROM parallel_execution_waves WHERE id = wta.wave_id);
```

---

## 2. TROUBLESHOOTING TOOLS

### T001: Find All Errors in Execution

```sql
-- Comprehensive error summary across all tables
-- Pattern: Error cascade detection
SELECT
    'tool_error' as error_type,
    tu.tool as source,
    tu.start_time as occurred_at,
    SUBSTR(tu.output_summary, 1, 200) as details,
    tu.task_id
FROM tool_uses tu
WHERE tu.execution_id = ?
  AND tu.result_status = 'error'

UNION ALL

SELECT
    'assertion_fail',
    ar.category,
    ar.timestamp,
    json_extract(ar.evidence, '$.errorMessage') as error_message,
    ar.task_id
FROM assertion_results ar
WHERE ar.execution_id = ?
  AND ar.result = 'fail'

UNION ALL

SELECT
    'skill_failed',
    st.skill_name,
    st.end_time,
    st.error_message,
    st.task_id
FROM skill_traces st
WHERE st.execution_id = ?
  AND st.status = 'failed'

UNION ALL

SELECT
    'transcript_error',
    te.entry_type,
    te.timestamp,
    te.summary,
    te.task_id
FROM transcript_entries te
WHERE te.execution_id = ?
  AND te.entry_type = 'error'

ORDER BY occurred_at;
```

### T002: Find Blocked Commands

```sql
-- Security-blocked operations with context
-- Pattern: Detect permission issues
SELECT
    tu.tool,
    tu.input_summary,
    tu.block_reason,
    tu.start_time,
    tu.task_id,
    te.summary as context
FROM tool_uses tu
LEFT JOIN transcript_entries te ON tu.transcript_entry_id = te.id
WHERE tu.execution_id = ?
  AND tu.is_blocked = 1
ORDER BY tu.start_time;
```

### T003: Find First Error in Chain

```sql
-- Identify the root cause error (first in sequence)
-- Truth: First error often cascades to subsequent failures
WITH first_error AS (
    SELECT MIN(sequence) as first_error_seq
    FROM transcript_entries
    WHERE execution_id = ?
      AND entry_type = 'error'
)
SELECT te.*, tu.output_summary as tool_output
FROM transcript_entries te
LEFT JOIN tool_uses tu ON te.id = tu.transcript_entry_id
CROSS JOIN first_error fe
WHERE te.execution_id = ?
  AND te.sequence >= fe.first_error_seq
  AND te.sequence <= fe.first_error_seq + 5
ORDER BY te.sequence;
```

### T004: Find Incomplete Operations

```sql
-- Operations that started but never completed
-- Pattern: Detect hangs, timeouts, crashes
SELECT
    'tool_use' as operation_type,
    tu.id,
    tu.tool,
    tu.start_time,
    tu.task_id,
    ROUND((julianday('now') - julianday(tu.start_time)) * 86400) as age_seconds
FROM tool_uses tu
WHERE tu.execution_id = ?
  AND tu.end_time IS NULL
  AND tu.start_time < datetime('now', '-5 minutes')

UNION ALL

SELECT
    'skill_trace',
    st.id,
    st.skill_name,
    st.start_time,
    st.task_id,
    ROUND((julianday('now') - julianday(st.start_time)) * 86400)
FROM skill_traces st
WHERE st.execution_id = ?
  AND st.end_time IS NULL
  AND st.start_time < datetime('now', '-5 minutes')

UNION ALL

SELECT
    'assertion_chain',
    ac.id,
    ac.description,
    ac.created_at,
    ac.task_id,
    ROUND((julianday('now') - julianday(ac.created_at)) * 86400)
FROM assertion_chains ac
WHERE ac.execution_id = ?
  AND ac.overall_result NOT IN ('pass', 'fail')
  AND ac.created_at < datetime('now', '-5 minutes');
```

### T005: Find Repeated Failures

```sql
-- Same error occurring multiple times (indicates systemic issue)
-- Pattern: Repeated failures on same file/tool combination
SELECT
    tu.tool,
    json_extract(tu.input, '$.file_path') as file_path,
    COUNT(*) as failure_count,
    GROUP_CONCAT(DISTINCT tu.task_id) as affected_tasks,
    MIN(tu.start_time) as first_failure,
    MAX(tu.start_time) as last_failure
FROM tool_uses tu
WHERE tu.execution_id = ?
  AND tu.result_status = 'error'
GROUP BY tu.tool, json_extract(tu.input, '$.file_path')
HAVING failure_count > 1
ORDER BY failure_count DESC;
```

### T006: Find Task Blockers

```sql
-- Why is a task blocked? Find dependencies and conflicts
SELECT
    t.display_id,
    t.title,
    t.status,
    'dependency' as blocker_type,
    dep_task.display_id as blocker_id,
    dep_task.status as blocker_status
FROM tasks t
JOIN task_relationships tr ON t.id = tr.target_task_id AND tr.relationship_type = 'depends_on'
JOIN tasks dep_task ON tr.source_task_id = dep_task.id
WHERE t.id = ?
  AND dep_task.status NOT IN ('completed', 'verified')

UNION ALL

SELECT
    t.display_id,
    t.title,
    t.status,
    'file_conflict',
    conflict_task.display_id,
    conflict_task.status
FROM tasks t
JOIN task_file_impacts tfi1 ON t.id = tfi1.task_id
JOIN task_file_impacts tfi2 ON tfi1.file_path = tfi2.file_path AND tfi1.task_id != tfi2.task_id
JOIN tasks conflict_task ON tfi2.task_id = conflict_task.id
WHERE t.id = ?
  AND conflict_task.status = 'in_progress'
  AND (tfi1.operation IN ('CREATE', 'UPDATE', 'DELETE') OR tfi2.operation IN ('CREATE', 'UPDATE', 'DELETE'));
```

---

## 3. INVESTIGATION TOOLS

### I001: Trace Full Execution Path for Task

```sql
-- Complete chronological history of a task
-- Use: Understanding what happened during task execution
SELECT
    te.sequence,
    te.timestamp,
    te.entry_type,
    te.summary,
    tu.tool,
    tu.result_status,
    tu.duration_ms,
    ar.category as assertion_type,
    ar.result as assertion_result
FROM transcript_entries te
LEFT JOIN tool_uses tu ON te.id = tu.transcript_entry_id
LEFT JOIN assertion_results ar ON te.task_id = ar.task_id
    AND te.entry_type = 'assertion'
    AND te.timestamp = ar.timestamp
WHERE te.task_id = ?
ORDER BY te.sequence;
```

### I002: Analyze Tool Usage Patterns

```sql
-- Which tools are used most, by whom, and success rates
SELECT
    tu.tool,
    tu.tool_category,
    COUNT(*) as total_uses,
    SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN result_status = 'blocked' THEN 1 ELSE 0 END) as blocked,
    ROUND(100.0 * SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
    ROUND(AVG(duration_ms), 0) as avg_duration_ms,
    ROUND(MAX(duration_ms), 0) as max_duration_ms,
    COUNT(DISTINCT task_id) as tasks_using
FROM tool_uses tu
WHERE tu.execution_id = ?
GROUP BY tu.tool, tu.tool_category
ORDER BY total_uses DESC;
```

### I003: Analyze Skill Execution Patterns

```sql
-- Which skills are invoked, success rates, common failure points
SELECT
    st.skill_name,
    st.skill_file,
    COUNT(*) as invocations,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
    ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
    GROUP_CONCAT(DISTINCT CASE WHEN status = 'failed' THEN st.line_number END) as failure_lines
FROM skill_traces st
WHERE st.execution_id = ?
GROUP BY st.skill_name, st.skill_file
ORDER BY invocations DESC;
```

### I004: Analyze File Access Patterns

```sql
-- Which files are accessed most, by what operations
SELECT
    json_extract(tu.input, '$.file_path') as file_path,
    tu.tool,
    COUNT(*) as access_count,
    SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as errors,
    COUNT(DISTINCT tu.task_id) as tasks_accessing,
    MIN(tu.start_time) as first_access,
    MAX(tu.start_time) as last_access
FROM tool_uses tu
WHERE tu.execution_id = ?
  AND json_extract(tu.input, '$.file_path') IS NOT NULL
GROUP BY json_extract(tu.input, '$.file_path'), tu.tool
ORDER BY access_count DESC
LIMIT 50;
```

### I005: Find Related Events by Correlation

```sql
-- Find all events related to a specific event via correlation_id
SELECT
    mbl.timestamp,
    mbl.event_type,
    mbl.source,
    mbl.severity,
    mbl.human_summary,
    mbl.payload
FROM message_bus_log mbl
WHERE mbl.correlation_id = ?
   OR mbl.correlation_id IN (
       SELECT correlation_id
       FROM message_bus_log
       WHERE id = ?
   )
ORDER BY mbl.timestamp;
```

### I006: Reconstruct Decision Points

```sql
-- Find all decision entries with their context
SELECT
    te.timestamp,
    te.summary as decision,
    te.task_id,
    json_extract(te.details, '$.options') as options,
    json_extract(te.details, '$.chosen') as chosen_option,
    json_extract(te.details, '$.reasoning') as reasoning,
    prev.summary as previous_context
FROM transcript_entries te
LEFT JOIN transcript_entries prev ON te.execution_id = prev.execution_id
    AND prev.sequence = te.sequence - 1
WHERE te.execution_id = ?
  AND te.entry_type = 'decision'
ORDER BY te.sequence;
```

### I007: Analyze Assertion Evidence

```sql
-- Get detailed assertion results with tool evidence
SELECT
    ar.category,
    ar.description,
    ar.result,
    json_extract(ar.evidence, '$.errorMessage') as error_message,
    ar.timestamp,
    ar.task_id,
    tu.tool as evidence_tool,
    tu.input_summary as evidence_input,
    tu.output_summary as evidence_output
FROM assertion_results ar
LEFT JOIN tool_uses tu ON ar.evidence_tool_use_id = tu.id
WHERE ar.execution_id = ?
ORDER BY ar.timestamp;
```

---

## 4. AGGREGATION TOOLS

### A001: Execution Summary Dashboard

```sql
-- High-level execution metrics
SELECT
    e.id as execution_id,
    e.task_list_id,
    e.status,
    e.started_at,
    e.completed_at,
    ROUND((julianday(e.completed_at) - julianday(e.started_at)) * 86400, 0) as duration_seconds,
    (SELECT COUNT(*) FROM transcript_entries WHERE execution_id = e.id) as transcript_entries,
    (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id) as tool_uses,
    (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id AND result_status = 'error') as errors,
    (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id AND is_blocked = 1) as blocked,
    (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id) as assertions,
    (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id AND result = 'pass') as passed,
    (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id AND result = 'fail') as failed,
    (SELECT COUNT(*) FROM skill_traces WHERE execution_id = e.id) as skill_invocations
FROM task_list_execution_runs e
WHERE e.id = ?;
```

### A002: Task Completion Summary

```sql
-- Task status breakdown for execution
SELECT
    t.status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
    GROUP_CONCAT(t.display_id, ', ') as task_ids
FROM tasks t
JOIN wave_task_assignments wta ON t.id = wta.task_id
JOIN parallel_execution_waves w ON wta.wave_id = w.id
WHERE w.execution_run_id = ?
GROUP BY t.status
ORDER BY
    CASE t.status
        WHEN 'completed' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'blocked' THEN 4
        WHEN 'failed' THEN 5
    END;
```

### A003: Hourly Activity Heatmap

```sql
-- Activity distribution by hour
SELECT
    strftime('%Y-%m-%d %H:00', timestamp) as hour,
    COUNT(*) as events,
    SUM(CASE WHEN entry_type = 'tool_use' THEN 1 ELSE 0 END) as tool_uses,
    SUM(CASE WHEN entry_type = 'error' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN entry_type = 'assertion' THEN 1 ELSE 0 END) as assertions
FROM transcript_entries
WHERE execution_id = ?
GROUP BY strftime('%Y-%m-%d %H:00', timestamp)
ORDER BY hour;
```

### A004: Pass Rate by Category

```sql
-- Assertion pass rates grouped by category
SELECT
    ar.category,
    COUNT(*) as total,
    SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped,
    SUM(CASE WHEN result = 'warn' THEN 1 ELSE 0 END) as warnings,
    ROUND(100.0 * SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN result IN ('pass', 'fail') THEN 1 ELSE 0 END), 0), 1) as pass_rate
FROM assertion_results ar
WHERE ar.execution_id = ?
GROUP BY ar.category
ORDER BY pass_rate ASC;
```

### A005: Duration Percentiles

```sql
-- Tool duration distribution (P50, P90, P99)
WITH ranked AS (
    SELECT
        tool,
        duration_ms,
        ROW_NUMBER() OVER (PARTITION BY tool ORDER BY duration_ms) as rn,
        COUNT(*) OVER (PARTITION BY tool) as cnt
    FROM tool_uses
    WHERE execution_id = ?
      AND duration_ms IS NOT NULL
)
SELECT
    tool,
    cnt as total_calls,
    MAX(CASE WHEN rn = CAST(cnt * 0.5 AS INT) THEN duration_ms END) as p50_ms,
    MAX(CASE WHEN rn = CAST(cnt * 0.9 AS INT) THEN duration_ms END) as p90_ms,
    MAX(CASE WHEN rn = CAST(cnt * 0.99 AS INT) THEN duration_ms END) as p99_ms,
    MAX(duration_ms) as max_ms
FROM ranked
GROUP BY tool
ORDER BY p90_ms DESC;
```

### A006: Cross-Execution Comparison

```sql
-- Compare metrics across multiple executions
SELECT
    e.id,
    e.started_at,
    COUNT(DISTINCT te.id) as transcript_entries,
    COUNT(DISTINCT tu.id) as tool_uses,
    SUM(CASE WHEN tu.result_status = 'error' THEN 1 ELSE 0 END) as errors,
    ROUND(AVG(tu.duration_ms), 0) as avg_tool_duration,
    COUNT(DISTINCT ar.id) as assertions,
    ROUND(100.0 * SUM(CASE WHEN ar.result = 'pass' THEN 1 ELSE 0 END) /
          NULLIF(COUNT(ar.id), 0), 1) as pass_rate
FROM task_list_execution_runs e
LEFT JOIN transcript_entries te ON e.id = te.execution_id
LEFT JOIN tool_uses tu ON e.id = tu.execution_id
LEFT JOIN assertion_results ar ON e.id = ar.execution_id
WHERE e.task_list_id = ?
GROUP BY e.id
ORDER BY e.started_at DESC
LIMIT 10;
```

---

## 5. PARALLELIZATION TOOLS

### P001: Wave Progress Overview

```sql
-- Current state of all waves in execution
SELECT
    w.wave_number,
    w.status,
    w.started_at,
    w.completed_at,
    COUNT(wta.task_id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / COUNT(wta.task_id), 1) as progress_pct
FROM parallel_execution_waves w
JOIN wave_task_assignments wta ON w.id = wta.wave_id
JOIN tasks t ON wta.task_id = t.id
WHERE w.execution_run_id = ?
GROUP BY w.id
ORDER BY w.wave_number;
```

### P002: Find Stuck Agents

```sql
-- Agents that have been executing too long without heartbeat
SELECT
    bai.id,
    bai.process_id,
    bai.status,
    bai.task_id,
    t.display_id as task_display_id,
    bai.spawned_at,
    bai.last_heartbeat_at,
    ROUND((julianday('now') - julianday(bai.last_heartbeat_at)) * 86400, 0) as seconds_since_heartbeat,
    ROUND((julianday('now') - julianday(bai.spawned_at)) * 86400, 0) as total_runtime_seconds
FROM build_agent_instances bai
LEFT JOIN tasks t ON bai.task_id = t.id
WHERE bai.execution_run_id = ?
  AND bai.status = 'executing'
  AND bai.last_heartbeat_at < datetime('now', '-2 minutes');
```

### P003: Detect File Conflicts in Wave

```sql
-- Find tasks in same wave that touch same files (potential race condition)
SELECT
    wta1.task_id as task1_id,
    t1.display_id as task1_display,
    wta2.task_id as task2_id,
    t2.display_id as task2_display,
    tfi1.file_path,
    tfi1.operation as task1_op,
    tfi2.operation as task2_op,
    CASE
        WHEN tfi1.operation IN ('CREATE', 'UPDATE', 'DELETE')
         AND tfi2.operation IN ('CREATE', 'UPDATE', 'DELETE') THEN 'CONFLICT: Both write'
        WHEN tfi1.operation = 'DELETE' OR tfi2.operation = 'DELETE' THEN 'CONFLICT: Delete involved'
        ELSE 'OK: Read-only'
    END as conflict_status
FROM wave_task_assignments wta1
JOIN wave_task_assignments wta2 ON wta1.wave_id = wta2.wave_id AND wta1.task_id < wta2.task_id
JOIN task_file_impacts tfi1 ON wta1.task_id = tfi1.task_id
JOIN task_file_impacts tfi2 ON wta2.task_id = tfi2.task_id AND tfi1.file_path = tfi2.file_path
JOIN tasks t1 ON wta1.task_id = t1.id
JOIN tasks t2 ON wta2.task_id = t2.id
WHERE wta1.wave_id IN (SELECT id FROM parallel_execution_waves WHERE execution_run_id = ?)
  AND (tfi1.operation IN ('CREATE', 'UPDATE', 'DELETE')
       OR tfi2.operation IN ('CREATE', 'UPDATE', 'DELETE'));
```

### P004: Analyze Wave Efficiency

```sql
-- How well are we utilizing parallelism?
-- Note: max_parallel_agents computed as task count (max possible parallelism)
SELECT
    w.wave_number,
    COUNT(DISTINCT bai.id) as agents_used,
    COUNT(DISTINCT wta.task_id) as tasks_in_wave,
    COUNT(DISTINCT wta.task_id) as max_possible,  -- Tasks = max parallelism
    ROUND(100.0 * COUNT(DISTINCT bai.id) / NULLIF(COUNT(DISTINCT wta.task_id), 0), 1) as utilization_pct,
    ROUND(ws.duration_ms / 1000.0, 1) as wave_duration_sec,
    ROUND(ws.duration_ms / NULLIF(ws.task_count, 0) / 1000.0, 2) as avg_task_sec
FROM parallel_execution_waves w
JOIN wave_task_assignments wta ON w.id = wta.wave_id
LEFT JOIN build_agent_instances bai ON w.id = bai.wave_id
LEFT JOIN wave_statistics ws ON w.id = ws.wave_id
WHERE w.execution_run_id = ?
GROUP BY w.id
ORDER BY w.wave_number;
```

### P005: Find Wave Bottlenecks

```sql
-- Tasks that took longest in each wave (bottlenecks)
WITH task_durations AS (
    SELECT
        wta.wave_id,
        wta.task_id,
        t.display_id,
        t.title,
        wta.started_at,
        wta.completed_at,
        ROUND((julianday(wta.completed_at) - julianday(wta.started_at)) * 86400, 0) as duration_sec
    FROM wave_task_assignments wta
    JOIN tasks t ON wta.task_id = t.id
    JOIN parallel_execution_waves w ON wta.wave_id = w.id
    WHERE w.execution_run_id = ?
      AND wta.completed_at IS NOT NULL
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY wave_id ORDER BY duration_sec DESC) as rank
    FROM task_durations
)
SELECT wave_id, task_id, display_id, title, duration_sec
FROM ranked
WHERE rank <= 3
ORDER BY wave_id, rank;
```

### P006: Detect Concurrent Execution Overlaps

```sql
-- Find tasks that were executing at the same time
SELECT
    t1.display_id as task1,
    t2.display_id as task2,
    wta1.started_at as task1_start,
    wta1.completed_at as task1_end,
    wta2.started_at as task2_start,
    wta2.completed_at as task2_end,
    -- Calculate overlap in seconds
    ROUND((julianday(MIN(wta1.completed_at, wta2.completed_at)) -
           julianday(MAX(wta1.started_at, wta2.started_at))) * 86400, 0) as overlap_seconds
FROM wave_task_assignments wta1
JOIN wave_task_assignments wta2 ON wta1.wave_id = wta2.wave_id AND wta1.task_id < wta2.task_id
JOIN tasks t1 ON wta1.task_id = t1.id
JOIN tasks t2 ON wta2.task_id = t2.id
JOIN parallel_execution_waves w ON wta1.wave_id = w.id
WHERE w.execution_run_id = ?
  AND wta1.started_at < wta2.completed_at
  AND wta2.started_at < wta1.completed_at
ORDER BY overlap_seconds DESC
LIMIT 20;
```

### P007: Agent Lifecycle Analysis

```sql
-- Track agent spawn/complete/fail patterns
SELECT
    bai.id,
    bai.process_id,
    bai.status,
    bai.spawned_at,
    bai.terminated_at,
    ROUND((julianday(bai.terminated_at) - julianday(bai.spawned_at)) * 86400, 1) as total_runtime_sec,
    bai.task_id,
    t.display_id as task_display_id,
    bai.error_message
FROM build_agent_instances bai
LEFT JOIN tasks t ON bai.task_id = t.id
WHERE bai.execution_run_id = ?
ORDER BY bai.spawned_at;
```

---

## 6. ANOMALY DETECTION TOOLS

### D001: Detect Unusual Tool Duration

```sql
-- Tools taking significantly longer than average
WITH tool_stats AS (
    SELECT
        tool,
        AVG(duration_ms) as avg_duration,
        AVG(duration_ms) + 2 *
            (SUM((duration_ms - (SELECT AVG(duration_ms) FROM tool_uses WHERE execution_id = tu.execution_id AND tool = tu.tool)) *
                 (duration_ms - (SELECT AVG(duration_ms) FROM tool_uses WHERE execution_id = tu.execution_id AND tool = tu.tool))) /
             COUNT(*)) as threshold_2sd
    FROM tool_uses tu
    WHERE execution_id = ?
    GROUP BY tool
)
SELECT
    tu.id,
    tu.tool,
    tu.duration_ms,
    ts.avg_duration,
    ROUND(tu.duration_ms / ts.avg_duration, 1) as times_avg,
    tu.task_id,
    tu.input_summary
FROM tool_uses tu
JOIN tool_stats ts ON tu.tool = ts.tool
WHERE tu.execution_id = ?
  AND tu.duration_ms > ts.avg_duration * 3
ORDER BY times_avg DESC;
```

### D002: Detect Error Cascades

```sql
-- Find sequences of errors (one error causing others)
WITH error_sequences AS (
    SELECT
        te.sequence,
        te.task_id,
        te.timestamp,
        te.summary,
        LAG(te.sequence) OVER (ORDER BY te.sequence) as prev_error_seq,
        te.sequence - LAG(te.sequence) OVER (ORDER BY te.sequence) as gap
    FROM transcript_entries te
    WHERE te.execution_id = ?
      AND te.entry_type = 'error'
)
SELECT
    MIN(sequence) as cascade_start_seq,
    MAX(sequence) as cascade_end_seq,
    COUNT(*) as errors_in_cascade,
    GROUP_CONCAT(DISTINCT task_id) as affected_tasks
FROM (
    SELECT *,
           SUM(CASE WHEN gap > 10 OR gap IS NULL THEN 1 ELSE 0 END)
               OVER (ORDER BY sequence) as cascade_group
    FROM error_sequences
) grouped
GROUP BY cascade_group
HAVING COUNT(*) > 2
ORDER BY errors_in_cascade DESC;
```

### D003: Detect Assertion Regression

```sql
-- Assertions that passed before but fail now (across executions)
SELECT
    ar_current.category,
    ar_current.description,
    ar_current.task_id,
    ar_current.result as current_result,
    ar_prev.result as previous_result,
    ar_prev.execution_id as previous_execution
FROM assertion_results ar_current
JOIN assertion_results ar_prev ON
    ar_current.category = ar_prev.category
    AND ar_current.description = ar_prev.description
    AND ar_current.task_id = ar_prev.task_id
JOIN task_list_execution_runs e_current ON ar_current.execution_id = e_current.id
JOIN task_list_execution_runs e_prev ON ar_prev.execution_id = e_prev.id
WHERE ar_current.execution_id = ?
  AND ar_current.result = 'fail'
  AND ar_prev.result = 'pass'
  AND e_prev.started_at < e_current.started_at
ORDER BY ar_current.timestamp;
```

### D004: Detect Unusual Activity Spikes

```sql
-- Periods with abnormally high activity
WITH minute_buckets AS (
    SELECT
        strftime('%Y-%m-%d %H:%M', timestamp) as minute,
        COUNT(*) as events
    FROM transcript_entries
    WHERE execution_id = ?
    GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
),
stats AS (
    SELECT AVG(events) as avg_events,
           AVG(events) * 2 as threshold
    FROM minute_buckets
)
SELECT
    mb.minute,
    mb.events,
    s.avg_events,
    ROUND(mb.events / s.avg_events, 1) as times_average
FROM minute_buckets mb
CROSS JOIN stats s
WHERE mb.events > s.threshold
ORDER BY mb.events DESC;
```

### D005: Detect Orphaned Resources

```sql
-- Resources that were allocated but never freed
SELECT
    'file_lock' as resource_type,
    json_extract(te_acquire.details, '$.file_path') as resource_id,
    te_acquire.timestamp as acquired_at,
    te_acquire.task_id
FROM transcript_entries te_acquire
LEFT JOIN transcript_entries te_release ON
    te_acquire.execution_id = te_release.execution_id
    AND json_extract(te_acquire.details, '$.file_path') = json_extract(te_release.details, '$.file_path')
    AND te_release.entry_type = 'lock_release'
    AND te_release.sequence > te_acquire.sequence
WHERE te_acquire.execution_id = ?
  AND te_acquire.entry_type = 'lock_acquire'
  AND te_release.id IS NULL

UNION ALL

SELECT
    'checkpoint' as resource_type,
    json_extract(te.details, '$.checkpoint_id') as resource_id,
    te.timestamp as acquired_at,
    te.task_id
FROM transcript_entries te
WHERE te.execution_id = ?
  AND te.entry_type = 'checkpoint'
  AND json_extract(te.details, '$.action') = 'create'
  AND NOT EXISTS (
      SELECT 1 FROM transcript_entries te2
      WHERE te2.execution_id = te.execution_id
        AND te2.entry_type = 'checkpoint'
        AND json_extract(te2.details, '$.checkpoint_id') = json_extract(te.details, '$.checkpoint_id')
        AND json_extract(te2.details, '$.action') IN ('commit', 'rollback')
  );
```

### D006: Detect Circular Wait Patterns

```sql
-- Tasks waiting on each other (deadlock indicator)
WITH RECURSIVE task_waits AS (
    -- Base: direct waits
    SELECT
        t.id as waiting_task,
        t.display_id as waiting_display,
        dep.id as waiting_on_task,
        dep.display_id as waiting_on_display,
        t.display_id || ' -> ' || dep.display_id as path,
        1 as depth
    FROM tasks t
    JOIN task_relationships tr ON t.id = tr.source_task_id AND tr.relationship_type = 'depends_on'
    JOIN tasks dep ON tr.target_task_id = dep.id
    WHERE t.status = 'blocked'

    UNION ALL

    -- Recursive: transitive waits
    SELECT
        tw.waiting_task,
        tw.waiting_display,
        dep.id,
        dep.display_id,
        tw.path || ' -> ' || dep.display_id,
        tw.depth + 1
    FROM task_waits tw
    JOIN task_relationships tr ON tw.waiting_on_task = tr.source_task_id AND tr.relationship_type = 'depends_on'
    JOIN tasks dep ON tr.target_task_id = dep.id
    WHERE tw.depth < 10
      AND tw.path NOT LIKE '%' || dep.display_id || '%'  -- Prevent infinite recursion
)
SELECT *
FROM task_waits
WHERE waiting_task = waiting_on_task  -- Circular dependency found
   OR path LIKE '%' || waiting_display || '%' || waiting_display || '%';  -- Path contains cycle
```

---

## Quick Reference: When to Use What

| Scenario                                | Tools to Use                  |
| --------------------------------------- | ----------------------------- |
| **Execution just completed**            | V001-V007 (all validation)    |
| **Task failed, need to understand why** | T001, T003, T004, I001        |
| **Commands being blocked**              | T002, I004                    |
| **Performance is slow**                 | A005, D001, P005              |
| **Parallel execution issues**           | P001-P007, D006               |
| **Need metrics for dashboard**          | A001-A006                     |
| **Investigating patterns**              | I002-I006, D002               |
| **Something seems wrong but unclear**   | D001-D006 (anomaly detection) |

---

## Tool Naming Convention

- **V###**: Validation (verify data integrity)
- **T###**: Troubleshooting (find problems)
- **I###**: Investigation (understand behavior)
- **A###**: Aggregation (generate metrics)
- **P###**: Parallelization (concurrency analysis)
- **D###**: Detection (find anomalies)

---

_Location: `docs/specs/observability/tools/OBSERVABILITY-SQL-TOOLS.md`_
_Related: [Data Model](../data-model/README.md) | [Database Schema](../appendices/DATABASE.md) | [API](../api/README.md)_
