"""
Observability SQL Tools - Python Implementation

This module provides executable observability skills for agents to validate,
troubleshoot, investigate, and aggregate execution data.

Usage:
    from shared.observability_skills import ObservabilitySkills

    skills = ObservabilitySkills("database/observability.db")

    # Validate an execution
    issues = skills.validate(execution_id)

    # Find all errors
    errors = skills.find_errors(execution_id)

    # Check parallel health
    health = skills.parallel_health(execution_id)
"""

import sqlite3
import json
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path


@dataclass
class ValidationIssue:
    """A validation failure detected in the data."""
    check_id: str
    description: str
    severity: str  # 'error', 'warning', 'info'
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ErrorRecord:
    """An error found in execution."""
    error_type: str
    source: str
    occurred_at: str
    details: str
    task_id: Optional[str] = None
    is_root_cause: bool = False


@dataclass
class StuckOperation:
    """An operation that appears stuck."""
    operation_type: str
    operation_id: str
    name: str
    started_at: str
    task_id: Optional[str] = None
    age_seconds: int = 0


@dataclass
class ParallelHealthReport:
    """Health status of parallel execution."""
    wave_progress: List[Dict[str, Any]]
    stuck_agents: List[Dict[str, Any]]
    file_conflicts: List[Dict[str, Any]]
    utilization: List[Dict[str, Any]]
    is_healthy: bool = True
    issues: List[str] = field(default_factory=list)


@dataclass
class AnomalyReport:
    """Detected anomalies in execution."""
    unusual_durations: List[Dict[str, Any]]
    error_cascades: List[Dict[str, Any]]
    activity_spikes: List[Dict[str, Any]]
    orphaned_resources: List[Dict[str, Any]]
    circular_waits: List[Dict[str, Any]]


class ObservabilitySkills:
    """
    Observability SQL tools for agents.

    Provides validation, troubleshooting, investigation, and aggregation
    capabilities for execution data stored in SQLite.
    """

    def __init__(self, db_path: str = "database/observability.db"):
        """Initialize with database path."""
        self.db_path = Path(db_path)
        self._ensure_db_exists()

    def _ensure_db_exists(self) -> None:
        """Verify database exists."""
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {self.db_path}")

    def _execute(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute SQL and return results as list of dicts."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    # =========================================================================
    # VALIDATION TOOLS (V001-V007)
    # =========================================================================

    def validate(self, execution_id: str) -> List[ValidationIssue]:
        """
        Run all validation checks on an execution.

        Returns list of validation issues found (empty = all passed).
        """
        issues = []

        # V001: Sequence Integrity
        issues.extend(self._check_sequence_integrity(execution_id))

        # V002: Tool Use Linkage
        issues.extend(self._check_tool_use_linkage(execution_id))

        # V003: Temporal Consistency
        issues.extend(self._check_temporal_consistency(execution_id))

        # V004: Lock Balance
        issues.extend(self._check_lock_balance(execution_id))

        # V005: Chain Completeness
        issues.extend(self._check_chain_completeness(execution_id))

        # V006: Wave Task Counts
        issues.extend(self._check_wave_counts(execution_id))

        # V007: FK Integrity
        issues.extend(self._check_fk_integrity())

        return issues

    def _check_sequence_integrity(self, execution_id: str) -> List[ValidationIssue]:
        """V001: Verify transcript sequence has no gaps."""
        sql = """
        WITH sequenced AS (
            SELECT
                sequence,
                LAG(sequence) OVER (ORDER BY sequence) as prev_seq
            FROM transcript_entries
            WHERE execution_id = ?
        )
        SELECT sequence, prev_seq, sequence - prev_seq as gap
        FROM sequenced
        WHERE prev_seq IS NOT NULL AND sequence - prev_seq != 1
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V001",
                description=f"Sequence gap detected: {r['prev_seq']} -> {r['sequence']} (gap={r['gap']})",
                severity="error",
                details=r
            )
            for r in results
        ]

    def _check_tool_use_linkage(self, execution_id: str) -> List[ValidationIssue]:
        """V002: Verify all tool_uses have transcript_entries."""
        sql = """
        SELECT tu.id, tu.tool, tu.start_time
        FROM tool_uses tu
        LEFT JOIN transcript_entries te ON tu.transcript_entry_id = te.id
        WHERE tu.execution_id = ?
          AND tu.transcript_entry_id IS NOT NULL
          AND te.id IS NULL
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V002",
                description=f"Orphaned tool_use: {r['tool']} ({r['id']})",
                severity="error",
                details=r
            )
            for r in results
        ]

    def _check_temporal_consistency(self, execution_id: str) -> List[ValidationIssue]:
        """V003: Verify start_time < end_time."""
        sql = """
        SELECT id, tool, start_time, end_time, duration_ms
        FROM tool_uses
        WHERE execution_id = ?
          AND end_time IS NOT NULL
          AND (end_time < start_time OR duration_ms < 0)
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V003",
                description=f"Temporal inconsistency in {r['tool']}: end < start",
                severity="error",
                details=r
            )
            for r in results
        ]

    def _check_lock_balance(self, execution_id: str) -> List[ValidationIssue]:
        """V004: Verify lock acquires match releases."""
        sql = """
        WITH lock_events AS (
            SELECT
                json_extract(details, '$.file_path') as file_path,
                entry_type
            FROM transcript_entries
            WHERE execution_id = ?
              AND entry_type IN ('lock_acquire', 'lock_release')
        )
        SELECT
            file_path,
            SUM(CASE WHEN entry_type = 'lock_acquire' THEN 1 ELSE 0 END) as acquires,
            SUM(CASE WHEN entry_type = 'lock_release' THEN 1 ELSE 0 END) as releases
        FROM lock_events
        GROUP BY file_path
        HAVING acquires != releases
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V004",
                description=f"Unbalanced locks on {r['file_path']}: {r['acquires']} acquires, {r['releases']} releases",
                severity="warning",
                details=r
            )
            for r in results
        ]

    def _check_chain_completeness(self, execution_id: str) -> List[ValidationIssue]:
        """V005: Verify all assertion chains completed."""
        sql = """
        SELECT id, task_id, description, created_at, overall_result
        FROM assertion_chains
        WHERE execution_id = ?
          AND overall_result NOT IN ('pass', 'fail')
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V005",
                description=f"Incomplete assertion chain: {r['description']}",
                severity="warning",
                details=r
            )
            for r in results
        ]

    def _check_wave_counts(self, execution_id: str) -> List[ValidationIssue]:
        """V006: Verify wave statistics match actual counts."""
        sql = """
        SELECT
            w.id as wave_id,
            w.wave_number,
            ws.task_count as reported,
            COUNT(wta.task_id) as actual
        FROM parallel_execution_waves w
        LEFT JOIN wave_statistics ws ON w.id = ws.wave_id
        LEFT JOIN wave_task_assignments wta ON w.id = wta.wave_id
        WHERE w.execution_run_id = ?
        GROUP BY w.id
        HAVING reported IS NOT NULL AND reported != actual
        """
        results = self._execute(sql, (execution_id,))

        return [
            ValidationIssue(
                check_id="V006",
                description=f"Wave {r['wave_number']} task count mismatch: reported={r['reported']}, actual={r['actual']}",
                severity="error",
                details=r
            )
            for r in results
        ]

    def _check_fk_integrity(self) -> List[ValidationIssue]:
        """V007: Verify foreign key integrity."""
        checks = [
            ("tool_uses → transcript_entries", """
                SELECT COUNT(*) as broken
                FROM tool_uses tu
                WHERE tu.transcript_entry_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM transcript_entries WHERE id = tu.transcript_entry_id)
            """),
            ("assertion_results → assertion_chains", """
                SELECT COUNT(*) as broken
                FROM assertion_results ar
                WHERE ar.chain_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM assertion_chains WHERE id = ar.chain_id)
            """),
            ("wave_task_assignments → parallel_execution_waves", """
                SELECT COUNT(*) as broken
                FROM wave_task_assignments wta
                WHERE NOT EXISTS (SELECT 1 FROM parallel_execution_waves WHERE id = wta.wave_id)
            """),
        ]

        issues = []
        for name, sql in checks:
            results = self._execute(sql)
            if results and results[0]['broken'] > 0:
                issues.append(ValidationIssue(
                    check_id="V007",
                    description=f"Broken FK: {name} ({results[0]['broken']} records)",
                    severity="error",
                    details={"relationship": name, "count": results[0]['broken']}
                ))

        return issues

    # =========================================================================
    # TROUBLESHOOTING TOOLS (T001-T006)
    # =========================================================================

    def find_errors(self, execution_id: str) -> List[ErrorRecord]:
        """
        T001: Find all errors across an execution.

        Returns unified list of errors from all sources.
        """
        sql = """
        SELECT 'tool_error' as error_type, tu.tool as source,
               tu.start_time as occurred_at, SUBSTR(tu.output_summary, 1, 200) as details,
               tu.task_id
        FROM tool_uses tu
        WHERE tu.execution_id = ? AND tu.result_status = 'error'

        UNION ALL

        SELECT 'assertion_fail', ar.category, ar.timestamp,
               json_extract(ar.evidence, '$.errorMessage') as error_message, ar.task_id
        FROM assertion_results ar
        WHERE ar.execution_id = ? AND ar.result = 'fail'

        UNION ALL

        SELECT 'skill_failed', st.skill_name, st.end_time, st.error_message, st.task_id
        FROM skill_traces st
        WHERE st.execution_id = ? AND st.status = 'failed'

        UNION ALL

        SELECT 'transcript_error', te.entry_type, te.timestamp, te.summary, te.task_id
        FROM transcript_entries te
        WHERE te.execution_id = ? AND te.entry_type = 'error'

        ORDER BY occurred_at
        """
        results = self._execute(sql, (execution_id,) * 4)

        errors = [
            ErrorRecord(
                error_type=r['error_type'],
                source=r['source'],
                occurred_at=r['occurred_at'],
                details=r['details'] or '',
                task_id=r['task_id'],
                is_root_cause=(i == 0)  # First error is root cause
            )
            for i, r in enumerate(results)
        ]

        return errors

    def find_blocked(self, execution_id: str) -> List[Dict[str, Any]]:
        """T002: Find security-blocked commands."""
        sql = """
        SELECT tu.tool, tu.input_summary, tu.block_reason, tu.start_time, tu.task_id
        FROM tool_uses tu
        WHERE tu.execution_id = ? AND tu.is_blocked = 1
        ORDER BY tu.start_time
        """
        return self._execute(sql, (execution_id,))

    def find_first_error(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """T003: Find the first (root cause) error."""
        sql = """
        WITH first_error AS (
            SELECT MIN(sequence) as first_seq
            FROM transcript_entries
            WHERE execution_id = ? AND entry_type = 'error'
        )
        SELECT te.*, tu.output_summary as tool_output
        FROM transcript_entries te
        LEFT JOIN tool_uses tu ON te.id = tu.transcript_entry_id
        CROSS JOIN first_error fe
        WHERE te.execution_id = ? AND te.sequence = fe.first_seq
        """
        results = self._execute(sql, (execution_id, execution_id))
        return results[0] if results else None

    def find_incomplete(self, execution_id: str) -> List[StuckOperation]:
        """T004: Find operations that never completed."""
        sql = """
        SELECT 'tool_use' as operation_type, tu.id, tu.tool as name,
               tu.start_time as started_at, tu.task_id,
               ROUND((julianday('now') - julianday(tu.start_time)) * 86400) as age_seconds
        FROM tool_uses tu
        WHERE tu.execution_id = ?
          AND tu.end_time IS NULL
          AND tu.start_time < datetime('now', '-5 minutes')

        UNION ALL

        SELECT 'skill_trace', st.id, st.skill_name, st.start_time, st.task_id,
               ROUND((julianday('now') - julianday(st.start_time)) * 86400)
        FROM skill_traces st
        WHERE st.execution_id = ?
          AND st.end_time IS NULL
          AND st.start_time < datetime('now', '-5 minutes')

        UNION ALL

        SELECT 'assertion_chain', ac.id, ac.description, ac.created_at, ac.task_id,
               ROUND((julianday('now') - julianday(ac.created_at)) * 86400)
        FROM assertion_chains ac
        WHERE ac.execution_id = ?
          AND ac.overall_result NOT IN ('pass', 'fail')
          AND ac.created_at < datetime('now', '-5 minutes')
        """
        results = self._execute(sql, (execution_id,) * 3)

        return [
            StuckOperation(
                operation_type=r['operation_type'],
                operation_id=r['id'],
                name=r['name'],
                started_at=r['started_at'],
                task_id=r['task_id'],
                age_seconds=int(r['age_seconds'] or 0)
            )
            for r in results
        ]

    def find_repeated_failures(self, execution_id: str) -> List[Dict[str, Any]]:
        """T005: Find errors occurring multiple times."""
        sql = """
        SELECT tu.tool, json_extract(tu.input, '$.file_path') as file_path,
               COUNT(*) as failure_count,
               GROUP_CONCAT(DISTINCT tu.task_id) as affected_tasks
        FROM tool_uses tu
        WHERE tu.execution_id = ? AND tu.result_status = 'error'
        GROUP BY tu.tool, json_extract(tu.input, '$.file_path')
        HAVING failure_count > 1
        ORDER BY failure_count DESC
        """
        return self._execute(sql, (execution_id,))

    # =========================================================================
    # PARALLEL EXECUTION TOOLS (P001-P007)
    # =========================================================================

    def parallel_health(self, execution_id: str) -> ParallelHealthReport:
        """
        Check health of parallel execution.

        Returns comprehensive health report including stuck agents,
        file conflicts, and utilization.
        """
        # P001: Wave Progress
        wave_progress = self._execute("""
            SELECT w.wave_number, w.status, w.started_at, w.completed_at,
                   COUNT(wta.task_id) as total_tasks,
                   SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                   SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM parallel_execution_waves w
            JOIN wave_task_assignments wta ON w.id = wta.wave_id
            JOIN tasks t ON wta.task_id = t.id
            WHERE w.execution_run_id = ?
            GROUP BY w.id ORDER BY w.wave_number
        """, (execution_id,))

        # P002: Stuck Agents (use julianday with localtime for timezone-safe comparison)
        stuck_agents = self._execute("""
            SELECT bai.id, bai.process_id, bai.task_id,
                   bai.spawned_at, bai.last_heartbeat_at,
                   ROUND((julianday('now', 'localtime') - julianday(replace(bai.last_heartbeat_at, 'T', ' '))) * 86400) as seconds_since_heartbeat
            FROM build_agent_instances bai
            WHERE bai.execution_run_id = ?
              AND bai.status = 'executing'
              AND (julianday('now', 'localtime') - julianday(replace(bai.last_heartbeat_at, 'T', ' '))) * 86400 > 120
        """, (execution_id,))

        # P003: File Conflicts
        file_conflicts = self._execute("""
            SELECT wta1.task_id as task1_id, wta2.task_id as task2_id,
                   tfi1.file_path, tfi1.operation as task1_op, tfi2.operation as task2_op
            FROM wave_task_assignments wta1
            JOIN wave_task_assignments wta2 ON wta1.wave_id = wta2.wave_id AND wta1.task_id < wta2.task_id
            JOIN task_file_impacts tfi1 ON wta1.task_id = tfi1.task_id
            JOIN task_file_impacts tfi2 ON wta2.task_id = tfi2.task_id AND tfi1.file_path = tfi2.file_path
            WHERE wta1.wave_id IN (SELECT id FROM parallel_execution_waves WHERE execution_run_id = ?)
              AND (tfi1.operation IN ('CREATE', 'UPDATE', 'DELETE')
                   OR tfi2.operation IN ('CREATE', 'UPDATE', 'DELETE'))
        """, (execution_id,))

        # P004: Utilization (max_possible computed as tasks in wave)
        utilization = self._execute("""
            SELECT w.wave_number,
                   COUNT(DISTINCT bai.id) as agents_used,
                   COUNT(DISTINCT wta.task_id) as tasks_in_wave,
                   COUNT(DISTINCT wta.task_id) as max_possible
            FROM parallel_execution_waves w
            JOIN wave_task_assignments wta ON w.id = wta.wave_id
            LEFT JOIN build_agent_instances bai ON w.id = bai.wave_id
            LEFT JOIN wave_statistics ws ON w.id = ws.wave_id
            WHERE w.execution_run_id = ?
            GROUP BY w.id ORDER BY w.wave_number
        """, (execution_id,))

        # Determine overall health
        issues = []
        if stuck_agents:
            issues.append(f"{len(stuck_agents)} stuck agent(s) detected")
        if file_conflicts:
            issues.append(f"{len(file_conflicts)} file conflict(s) detected")

        return ParallelHealthReport(
            wave_progress=wave_progress,
            stuck_agents=stuck_agents,
            file_conflicts=file_conflicts,
            utilization=utilization,
            is_healthy=(len(issues) == 0),
            issues=issues
        )

    def find_wave_bottlenecks(self, execution_id: str) -> List[Dict[str, Any]]:
        """P005: Find slowest tasks in each wave."""
        sql = """
        WITH task_durations AS (
            SELECT wta.wave_id, wta.task_id, t.display_id, t.title,
                   ROUND((julianday(wta.completed_at) - julianday(wta.started_at)) * 86400) as duration_sec
            FROM wave_task_assignments wta
            JOIN tasks t ON wta.task_id = t.id
            JOIN parallel_execution_waves w ON wta.wave_id = w.id
            WHERE w.execution_run_id = ? AND wta.completed_at IS NOT NULL
        ),
        ranked AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY wave_id ORDER BY duration_sec DESC) as rank
            FROM task_durations
        )
        SELECT wave_id, task_id, display_id, title, duration_sec
        FROM ranked WHERE rank <= 3
        ORDER BY wave_id, rank
        """
        return self._execute(sql, (execution_id,))

    # =========================================================================
    # ANOMALY DETECTION TOOLS (D001-D006)
    # =========================================================================

    def detect_anomalies(self, execution_id: str) -> AnomalyReport:
        """
        Detect unusual patterns in execution.

        Returns report of anomalies including unusual durations,
        error cascades, and circular waits.
        """
        # D001: Unusual Durations (>3x average)
        unusual_durations = self._execute("""
            WITH tool_stats AS (
                SELECT tool, AVG(duration_ms) as avg_duration
                FROM tool_uses WHERE execution_id = ?
                GROUP BY tool
            )
            SELECT tu.id, tu.tool, tu.duration_ms, ts.avg_duration,
                   ROUND(tu.duration_ms / ts.avg_duration, 1) as times_avg, tu.task_id
            FROM tool_uses tu
            JOIN tool_stats ts ON tu.tool = ts.tool
            WHERE tu.execution_id = ? AND tu.duration_ms > ts.avg_duration * 3
            ORDER BY times_avg DESC
        """, (execution_id, execution_id))

        # D002: Error Cascades
        error_cascades = self._execute("""
            WITH error_sequences AS (
                SELECT sequence, task_id, summary,
                       LAG(sequence) OVER (ORDER BY sequence) as prev_seq
                FROM transcript_entries
                WHERE execution_id = ? AND entry_type = 'error'
            )
            SELECT COUNT(*) as cascade_size, GROUP_CONCAT(DISTINCT task_id) as affected_tasks
            FROM error_sequences
            WHERE prev_seq IS NOT NULL AND sequence - prev_seq <= 10
            GROUP BY (sequence - prev_seq <= 10)
            HAVING cascade_size > 2
        """, (execution_id,))

        # D004: Activity Spikes
        activity_spikes = self._execute("""
            WITH minute_buckets AS (
                SELECT strftime('%Y-%m-%d %H:%M', timestamp) as minute, COUNT(*) as events
                FROM transcript_entries WHERE execution_id = ?
                GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
            ),
            stats AS (SELECT AVG(events) as avg_events FROM minute_buckets)
            SELECT mb.minute, mb.events, s.avg_events
            FROM minute_buckets mb CROSS JOIN stats s
            WHERE mb.events > s.avg_events * 2
            ORDER BY mb.events DESC
        """, (execution_id,))

        # D005: Orphaned Resources
        orphaned_resources = self._execute("""
            SELECT 'file_lock' as resource_type,
                   json_extract(te_acquire.details, '$.file_path') as resource_id,
                   te_acquire.timestamp as acquired_at
            FROM transcript_entries te_acquire
            LEFT JOIN transcript_entries te_release ON
                te_acquire.execution_id = te_release.execution_id
                AND json_extract(te_acquire.details, '$.file_path') = json_extract(te_release.details, '$.file_path')
                AND te_release.entry_type = 'lock_release'
                AND te_release.sequence > te_acquire.sequence
            WHERE te_acquire.execution_id = ?
              AND te_acquire.entry_type = 'lock_acquire'
              AND te_release.id IS NULL
        """, (execution_id,))

        # D006: Circular Waits (simplified check)
        circular_waits = self._execute("""
            SELECT t1.display_id as task1, t2.display_id as task2
            FROM task_relationships tr1
            JOIN task_relationships tr2 ON tr1.target_task_id = tr2.source_task_id
            JOIN tasks t1 ON tr1.source_task_id = t1.id
            JOIN tasks t2 ON tr2.target_task_id = t2.id
            WHERE tr1.relationship_type = 'depends_on'
              AND tr2.relationship_type = 'depends_on'
              AND tr2.target_task_id = tr1.source_task_id
        """)

        return AnomalyReport(
            unusual_durations=unusual_durations,
            error_cascades=error_cascades,
            activity_spikes=activity_spikes,
            orphaned_resources=orphaned_resources,
            circular_waits=circular_waits
        )

    # =========================================================================
    # AGGREGATION TOOLS (A001-A006)
    # =========================================================================

    def execution_summary(self, execution_id: str) -> Dict[str, Any]:
        """A001: Get high-level execution metrics."""
        results = self._execute("""
            SELECT e.id as execution_id, e.status, e.started_at, e.completed_at,
                   ROUND((julianday(e.completed_at) - julianday(e.started_at)) * 86400) as duration_seconds,
                   (SELECT COUNT(*) FROM transcript_entries WHERE execution_id = e.id) as transcript_entries,
                   (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id) as tool_uses,
                   (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id AND result_status = 'error') as errors,
                   (SELECT COUNT(*) FROM tool_uses WHERE execution_id = e.id AND is_blocked = 1) as blocked,
                   (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id) as assertions,
                   (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id AND result = 'pass') as passed,
                   (SELECT COUNT(*) FROM assertion_results WHERE execution_id = e.id AND result = 'fail') as failed
            FROM task_list_execution_runs e WHERE e.id = ?
        """, (execution_id,))

        return results[0] if results else {}

    def tool_usage_stats(self, execution_id: str) -> List[Dict[str, Any]]:
        """I002: Analyze tool usage patterns."""
        return self._execute("""
            SELECT tool, tool_category, COUNT(*) as total_uses,
                   SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
                   SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as errors,
                   SUM(CASE WHEN result_status = 'blocked' THEN 1 ELSE 0 END) as blocked,
                   ROUND(100.0 * SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
                   ROUND(AVG(duration_ms)) as avg_duration_ms
            FROM tool_uses WHERE execution_id = ?
            GROUP BY tool, tool_category ORDER BY total_uses DESC
        """, (execution_id,))

    def pass_rate_by_category(self, execution_id: str) -> List[Dict[str, Any]]:
        """A004: Get assertion pass rates by category."""
        return self._execute("""
            SELECT category, COUNT(*) as total,
                   SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
                   SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
                   ROUND(100.0 * SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) /
                         NULLIF(SUM(CASE WHEN result IN ('pass', 'fail') THEN 1 ELSE 0 END), 0), 1) as pass_rate
            FROM assertion_results WHERE execution_id = ?
            GROUP BY category ORDER BY pass_rate ASC
        """, (execution_id,))

    def duration_percentiles(self, execution_id: str) -> List[Dict[str, Any]]:
        """A005: Get tool duration percentiles."""
        return self._execute("""
            WITH ranked AS (
                SELECT tool, duration_ms,
                       ROW_NUMBER() OVER (PARTITION BY tool ORDER BY duration_ms) as rn,
                       COUNT(*) OVER (PARTITION BY tool) as cnt
                FROM tool_uses WHERE execution_id = ? AND duration_ms IS NOT NULL
            )
            SELECT tool, cnt as total_calls,
                   MAX(CASE WHEN rn = CAST(cnt * 0.5 AS INT) THEN duration_ms END) as p50_ms,
                   MAX(CASE WHEN rn = CAST(cnt * 0.9 AS INT) THEN duration_ms END) as p90_ms,
                   MAX(CASE WHEN rn = CAST(cnt * 0.99 AS INT) THEN duration_ms END) as p99_ms,
                   MAX(duration_ms) as max_ms
            FROM ranked GROUP BY tool ORDER BY p90_ms DESC
        """, (execution_id,))

    # =========================================================================
    # INVESTIGATION TOOLS (I001-I007)
    # =========================================================================

    def trace_task(self, task_id: str) -> List[Dict[str, Any]]:
        """I001: Get complete execution path for a task."""
        return self._execute("""
            SELECT te.sequence, te.timestamp, te.entry_type, te.summary,
                   tu.tool, tu.result_status, tu.duration_ms
            FROM transcript_entries te
            LEFT JOIN tool_uses tu ON te.id = tu.transcript_entry_id
            WHERE te.task_id = ?
            ORDER BY te.sequence
        """, (task_id,))

    def analyze_file_access(self, execution_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """I004: Analyze file access patterns."""
        return self._execute("""
            SELECT json_extract(input, '$.file_path') as file_path, tool,
                   COUNT(*) as access_count,
                   SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
                   SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as errors
            FROM tool_uses
            WHERE execution_id = ?
              AND json_extract(input, '$.file_path') IS NOT NULL
            GROUP BY json_extract(input, '$.file_path'), tool
            ORDER BY access_count DESC LIMIT ?
        """, (execution_id, limit))


# Convenience functions for direct skill invocation
def obs_validate(execution_id: str, db_path: str = "database/observability.db") -> List[ValidationIssue]:
    """Run /obs-validate skill."""
    return ObservabilitySkills(db_path).validate(execution_id)


def obs_errors(execution_id: str, db_path: str = "database/observability.db") -> List[ErrorRecord]:
    """Run /obs-errors skill."""
    return ObservabilitySkills(db_path).find_errors(execution_id)


def obs_parallel_health(execution_id: str, db_path: str = "database/observability.db") -> ParallelHealthReport:
    """Run /obs-parallel-health skill."""
    return ObservabilitySkills(db_path).parallel_health(execution_id)


def obs_anomalies(execution_id: str, db_path: str = "database/observability.db") -> AnomalyReport:
    """Run /obs-anomalies skill."""
    return ObservabilitySkills(db_path).detect_anomalies(execution_id)


def obs_summary(execution_id: str, db_path: str = "database/observability.db") -> Dict[str, Any]:
    """Run /obs-summary skill."""
    return ObservabilitySkills(db_path).execution_summary(execution_id)
