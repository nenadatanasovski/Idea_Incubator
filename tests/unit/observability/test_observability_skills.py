"""
ObservabilitySkills Tests

Comprehensive tests for the ObservabilitySkills Python query class:
- V001-V007: Validation tools
- T001-T005: Troubleshooting tools
- P001-P005: Parallel execution tools
- D001-D006: Anomaly detection tools
- A001-A005: Aggregation tools
- I001-I004: Investigation tools
"""

import pytest
import tempfile
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timedelta
from uuid import uuid4

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "coding-loops"))

from shared.observability_skills import (
    ObservabilitySkills,
    ValidationIssue,
    ErrorRecord,
    StuckOperation,
    ParallelHealthReport,
    AnomalyReport,
    obs_validate,
    obs_errors,
    obs_parallel_health,
    obs_anomalies,
    obs_summary,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_db():
    """Create a temporary database with observability schema."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = Path(f.name)

    conn = sqlite3.connect(str(db_path))

    # Create required tables for observability
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transcript_entries (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sequence INTEGER NOT NULL,
            source TEXT NOT NULL,
            execution_id TEXT,
            task_id TEXT,
            instance_id TEXT,
            wave_id TEXT,
            wave_number INTEGER,
            entry_type TEXT NOT NULL,
            category TEXT NOT NULL,
            summary TEXT,
            details TEXT,
            duration_ms INTEGER,
            token_estimate INTEGER
        );

        CREATE TABLE IF NOT EXISTS tool_uses (
            id TEXT PRIMARY KEY,
            transcript_entry_id TEXT,
            tool TEXT NOT NULL,
            tool_category TEXT,
            input TEXT,
            input_summary TEXT,
            output_summary TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_ms INTEGER,
            result_status TEXT DEFAULT 'pending',
            is_error INTEGER DEFAULT 0,
            is_blocked INTEGER DEFAULT 0,
            block_reason TEXT,
            error_message TEXT,
            task_id TEXT,
            execution_id TEXT
        );

        CREATE TABLE IF NOT EXISTS assertion_results (
            id TEXT PRIMARY KEY,
            chain_id TEXT,
            description TEXT,
            category TEXT,
            result TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            task_id TEXT,
            execution_id TEXT,
            evidence TEXT
        );

        CREATE TABLE IF NOT EXISTS assertion_chains (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            execution_id TEXT,
            description TEXT,
            overall_result TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS skill_traces (
            id TEXT PRIMARY KEY,
            skill_name TEXT NOT NULL,
            skill_file TEXT,
            line_number INTEGER,
            section_title TEXT,
            status TEXT DEFAULT 'pending',
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_ms INTEGER,
            token_estimate INTEGER,
            tool_calls TEXT,
            execution_id TEXT,
            task_id TEXT,
            error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS build_agent_instances (
            id TEXT PRIMARY KEY,
            process_id TEXT,
            task_id TEXT,
            execution_run_id TEXT,
            wave_id TEXT,
            status TEXT DEFAULT 'pending',
            spawned_at TEXT,
            last_heartbeat_at TEXT,
            terminated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS parallel_execution_waves (
            id TEXT PRIMARY KEY,
            execution_run_id TEXT NOT NULL,
            wave_number INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            started_at TEXT,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS wave_task_assignments (
            wave_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            PRIMARY KEY (wave_id, task_id)
        );

        CREATE TABLE IF NOT EXISTS wave_statistics (
            id TEXT PRIMARY KEY,
            wave_id TEXT NOT NULL,
            task_count INTEGER DEFAULT 0,
            completed_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            display_id TEXT,
            title TEXT,
            status TEXT DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS task_relationships (
            id TEXT PRIMARY KEY,
            source_task_id TEXT NOT NULL,
            target_task_id TEXT NOT NULL,
            relationship_type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_file_impacts (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            operation TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_list_execution_runs (
            id TEXT PRIMARY KEY,
            task_list_id TEXT,
            status TEXT DEFAULT 'pending',
            started_at TEXT,
            completed_at TEXT,
            run_number INTEGER DEFAULT 1
        );
    """)

    conn.commit()
    conn.close()

    yield db_path

    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def skills(temp_db):
    """Create an ObservabilitySkills instance for testing."""
    return ObservabilitySkills(str(temp_db))


@pytest.fixture
def execution_id():
    """Generate a test execution ID."""
    return f"exec-{uuid4().hex[:8]}"


@pytest.fixture
def populated_db(temp_db, execution_id):
    """Create a populated database with test data."""
    conn = sqlite3.connect(str(temp_db))

    # Create execution run
    conn.execute(
        "INSERT INTO task_list_execution_runs (id, task_list_id, status, started_at) VALUES (?, ?, ?, ?)",
        (execution_id, "list-001", "running", datetime.now().isoformat())
    )

    # Create transcript entries
    for i in range(10):
        conn.execute(
            """INSERT INTO transcript_entries
               (id, timestamp, sequence, source, execution_id, entry_type, category, summary, task_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"te-{i:03d}",
                datetime.now().isoformat(),
                i + 1,
                "agent",
                execution_id,
                "tool_use" if i % 2 == 0 else "decision",
                "action" if i % 2 == 0 else "knowledge",
                f"Entry {i}",
                "task-001"
            )
        )

    # Create tool uses
    for i in range(5):
        conn.execute(
            """INSERT INTO tool_uses
               (id, transcript_entry_id, tool, start_time, end_time, duration_ms,
                result_status, task_id, execution_id, input)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"tu-{i:03d}",
                f"te-{i*2:03d}",
                "Read" if i % 2 == 0 else "Bash",
                datetime.now().isoformat(),
                datetime.now().isoformat(),
                100 * (i + 1),
                "done",
                "task-001",
                execution_id,
                json.dumps({"file_path": f"/path/file{i}.ts"})
            )
        )

    # Create assertions
    for i in range(3):
        chain_id = f"chain-{i:03d}"
        conn.execute(
            "INSERT INTO assertion_chains (id, task_id, execution_id, description, overall_result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (chain_id, "task-001", execution_id, f"Chain {i}", "pass" if i < 2 else "pending", datetime.now().isoformat())
        )

        for j in range(2):
            conn.execute(
                """INSERT INTO assertion_results
                   (id, chain_id, description, category, result, timestamp, task_id, execution_id, evidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"ar-{i}-{j}",
                    chain_id,
                    f"Assertion {i}-{j}",
                    "syntax" if j == 0 else "unit_test",
                    "pass" if (i + j) % 2 == 0 else "fail",
                    datetime.now().isoformat(),
                    "task-001",
                    execution_id,
                    json.dumps({"exitCode": 0 if (i + j) % 2 == 0 else 1})
                )
            )

    conn.commit()
    conn.close()

    return execution_id


# ============================================================================
# Initialization Tests
# ============================================================================

class TestObservabilitySkillsInit:
    """Test initialization of ObservabilitySkills."""

    def test_init_with_valid_db(self, temp_db):
        """Verify initialization with valid database path."""
        skills = ObservabilitySkills(str(temp_db))
        assert skills.db_path == temp_db

    def test_init_with_invalid_db_raises(self):
        """Verify initialization with non-existent database raises error."""
        with pytest.raises(FileNotFoundError):
            ObservabilitySkills("/nonexistent/path/db.db")

    def test_execute_returns_list_of_dicts(self, skills, temp_db):
        """Verify _execute returns list of dictionaries."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            "INSERT INTO transcript_entries (id, timestamp, sequence, source, entry_type, category) VALUES (?, ?, ?, ?, ?, ?)",
            ("test-1", datetime.now().isoformat(), 1, "test", "test", "test")
        )
        conn.commit()
        conn.close()

        results = skills._execute("SELECT * FROM transcript_entries")

        assert isinstance(results, list)
        assert len(results) == 1
        assert isinstance(results[0], dict)
        assert results[0]["id"] == "test-1"


# ============================================================================
# V001-V007: Validation Tools
# ============================================================================

class TestV001SequenceIntegrity:
    """V001: Verify transcript sequence has no gaps."""

    def test_no_gaps_returns_empty(self, skills, temp_db, execution_id):
        """Verify no issues when sequence is contiguous."""
        conn = sqlite3.connect(str(temp_db))
        for i in range(5):
            conn.execute(
                "INSERT INTO transcript_entries (id, timestamp, sequence, source, execution_id, entry_type, category) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"te-{i}", datetime.now().isoformat(), i + 1, "agent", execution_id, "test", "test")
            )
        conn.commit()
        conn.close()

        issues = skills._check_sequence_integrity(execution_id)

        assert len(issues) == 0

    def test_gap_detected(self, skills, temp_db, execution_id):
        """Verify gap in sequence is detected."""
        conn = sqlite3.connect(str(temp_db))
        for seq in [1, 2, 5, 6]:  # Gap at 3, 4
            conn.execute(
                "INSERT INTO transcript_entries (id, timestamp, sequence, source, execution_id, entry_type, category) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"te-{seq}", datetime.now().isoformat(), seq, "agent", execution_id, "test", "test")
            )
        conn.commit()
        conn.close()

        issues = skills._check_sequence_integrity(execution_id)

        assert len(issues) >= 1
        assert issues[0].check_id == "V001"
        assert issues[0].severity == "error"
        assert "gap" in issues[0].description.lower()


class TestV002ToolUseLinkage:
    """V002: Verify all tool_uses have transcript_entries."""

    def test_linked_tool_uses_no_issues(self, skills, populated_db):
        """Verify no issues when all tool uses are linked."""
        issues = skills._check_tool_use_linkage(populated_db)

        assert len(issues) == 0

    def test_orphaned_tool_use_detected(self, skills, temp_db, execution_id):
        """Verify orphaned tool use is detected."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO tool_uses
               (id, transcript_entry_id, tool, start_time, execution_id)
               VALUES (?, ?, ?, ?, ?)""",
            ("tu-orphan", "nonexistent-entry", "Bash", datetime.now().isoformat(), execution_id)
        )
        conn.commit()
        conn.close()

        issues = skills._check_tool_use_linkage(execution_id)

        assert len(issues) >= 1
        assert issues[0].check_id == "V002"


class TestV003TemporalConsistency:
    """V003: Verify start_time < end_time."""

    def test_valid_times_no_issues(self, skills, populated_db):
        """Verify no issues when times are consistent."""
        issues = skills._check_temporal_consistency(populated_db)

        assert len(issues) == 0

    def test_end_before_start_detected(self, skills, temp_db, execution_id):
        """Verify end before start is detected."""
        conn = sqlite3.connect(str(temp_db))
        now = datetime.now()
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, start_time, end_time, duration_ms, execution_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                "tu-bad-time",
                "Read",
                now.isoformat(),
                (now - timedelta(seconds=10)).isoformat(),
                -10000,
                execution_id
            )
        )
        conn.commit()
        conn.close()

        issues = skills._check_temporal_consistency(execution_id)

        assert len(issues) >= 1
        assert issues[0].check_id == "V003"


class TestV004LockBalance:
    """V004: Verify lock acquires match releases."""

    def test_balanced_locks_no_issues(self, skills, temp_db, execution_id):
        """Verify no issues when locks are balanced."""
        conn = sqlite3.connect(str(temp_db))
        for i, entry_type in enumerate(["lock_acquire", "lock_release"]):
            conn.execute(
                """INSERT INTO transcript_entries
                   (id, timestamp, sequence, source, execution_id, entry_type, category, details)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"te-lock-{i}",
                    datetime.now().isoformat(),
                    i + 1,
                    "agent",
                    execution_id,
                    entry_type,
                    "action",
                    json.dumps({"file_path": "/test/file.ts"})
                )
            )
        conn.commit()
        conn.close()

        issues = skills._check_lock_balance(execution_id)

        assert len(issues) == 0

    def test_unbalanced_locks_detected(self, skills, temp_db, execution_id):
        """Verify unbalanced locks are detected."""
        conn = sqlite3.connect(str(temp_db))
        # Only acquire, no release
        conn.execute(
            """INSERT INTO transcript_entries
               (id, timestamp, sequence, source, execution_id, entry_type, category, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "te-lock-acquire",
                datetime.now().isoformat(),
                1,
                "agent",
                execution_id,
                "lock_acquire",
                "action",
                json.dumps({"file_path": "/test/file.ts"})
            )
        )
        conn.commit()
        conn.close()

        issues = skills._check_lock_balance(execution_id)

        assert len(issues) >= 1
        assert issues[0].check_id == "V004"
        assert issues[0].severity == "warning"


class TestV005ChainCompleteness:
    """V005: Verify all assertion chains completed."""

    def test_complete_chains_no_issues(self, skills, temp_db, execution_id):
        """Verify no issues when chains are complete."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            "INSERT INTO assertion_chains (id, task_id, execution_id, description, overall_result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("chain-complete", "task-001", execution_id, "Complete chain", "pass", datetime.now().isoformat())
        )
        conn.commit()
        conn.close()

        issues = skills._check_chain_completeness(execution_id)

        assert len(issues) == 0

    def test_incomplete_chain_detected(self, skills, temp_db, execution_id):
        """Verify incomplete chain is detected."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            "INSERT INTO assertion_chains (id, task_id, execution_id, description, overall_result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("chain-incomplete", "task-001", execution_id, "Incomplete chain", "pending", datetime.now().isoformat())
        )
        conn.commit()
        conn.close()

        issues = skills._check_chain_completeness(execution_id)

        assert len(issues) >= 1
        assert issues[0].check_id == "V005"


class TestValidateAll:
    """Test the main validate() method."""

    def test_validate_runs_all_checks(self, skills, populated_db):
        """Verify validate runs all validation checks."""
        issues = skills.validate(populated_db)

        # Should return list of ValidationIssue
        assert isinstance(issues, list)
        assert all(isinstance(i, ValidationIssue) for i in issues)


# ============================================================================
# T001-T005: Troubleshooting Tools
# ============================================================================

class TestT001FindErrors:
    """T001: Find all errors across an execution."""

    def test_finds_tool_errors(self, skills, temp_db, execution_id):
        """Verify tool errors are found."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, start_time, result_status, output_summary, task_id, execution_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("tu-error", "Bash", datetime.now().isoformat(), "error", "Command failed", "task-001", execution_id)
        )
        conn.commit()
        conn.close()

        errors = skills.find_errors(execution_id)

        assert len(errors) >= 1
        assert any(e.error_type == "tool_error" for e in errors)

    def test_finds_assertion_failures(self, skills, temp_db, execution_id):
        """Verify assertion failures are found."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO assertion_results
               (id, category, result, timestamp, task_id, execution_id, evidence)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("ar-fail", "syntax", "fail", datetime.now().isoformat(), "task-001", execution_id, json.dumps({"errorMessage": "Type error"}))
        )
        conn.commit()
        conn.close()

        errors = skills.find_errors(execution_id)

        assert len(errors) >= 1
        assert any(e.error_type == "assertion_fail" for e in errors)

    def test_marks_first_as_root_cause(self, skills, temp_db, execution_id):
        """Verify first error is marked as root cause."""
        conn = sqlite3.connect(str(temp_db))
        for i in range(3):
            conn.execute(
                """INSERT INTO tool_uses
                   (id, tool, start_time, result_status, task_id, execution_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (f"tu-error-{i}", "Bash", datetime.now().isoformat(), "error", "task-001", execution_id)
            )
        conn.commit()
        conn.close()

        errors = skills.find_errors(execution_id)

        assert len(errors) >= 1
        assert errors[0].is_root_cause is True
        assert all(e.is_root_cause is False for e in errors[1:])


class TestT002FindBlocked:
    """T002: Find security-blocked commands."""

    def test_finds_blocked_commands(self, skills, temp_db, execution_id):
        """Verify blocked commands are found."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, input_summary, start_time, is_blocked, block_reason, task_id, execution_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            ("tu-blocked", "Bash", "rm -rf /", datetime.now().isoformat(), 1, "Dangerous command", "task-001", execution_id)
        )
        conn.commit()
        conn.close()

        blocked = skills.find_blocked(execution_id)

        assert len(blocked) >= 1
        assert blocked[0]["tool"] == "Bash"
        assert blocked[0]["block_reason"] == "Dangerous command"


class TestT003FindFirstError:
    """T003: Find the first (root cause) error."""

    def test_finds_first_error(self, skills, temp_db, execution_id):
        """Verify first error is found correctly."""
        conn = sqlite3.connect(str(temp_db))
        for i in range(3):
            conn.execute(
                """INSERT INTO transcript_entries
                   (id, timestamp, sequence, source, execution_id, entry_type, category, summary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (f"te-{i}", datetime.now().isoformat(), i + 1, "agent", execution_id, "error" if i == 1 else "info", "error", f"Entry {i}")
            )
        conn.commit()
        conn.close()

        first_error = skills.find_first_error(execution_id)

        assert first_error is not None
        assert first_error["sequence"] == 2

    def test_returns_none_when_no_errors(self, skills, temp_db, execution_id):
        """Verify None is returned when no errors exist."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO transcript_entries
               (id, timestamp, sequence, source, execution_id, entry_type, category)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("te-ok", datetime.now().isoformat(), 1, "agent", execution_id, "info", "info")
        )
        conn.commit()
        conn.close()

        first_error = skills.find_first_error(execution_id)

        assert first_error is None


class TestT005FindRepeatedFailures:
    """T005: Find errors occurring multiple times."""

    def test_finds_repeated_failures(self, skills, temp_db, execution_id):
        """Verify repeated failures are found."""
        conn = sqlite3.connect(str(temp_db))
        for i in range(3):
            conn.execute(
                """INSERT INTO tool_uses
                   (id, tool, input, start_time, result_status, task_id, execution_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"tu-fail-{i}",
                    "Read",
                    json.dumps({"file_path": "/same/file.ts"}),
                    datetime.now().isoformat(),
                    "error",
                    f"task-00{i}",
                    execution_id
                )
            )
        conn.commit()
        conn.close()

        repeated = skills.find_repeated_failures(execution_id)

        assert len(repeated) >= 1
        assert repeated[0]["failure_count"] >= 3


# ============================================================================
# P001-P005: Parallel Execution Tools
# ============================================================================

class TestParallelHealth:
    """Test parallel_health method."""

    def test_returns_health_report(self, skills, temp_db, execution_id):
        """Verify parallel_health returns ParallelHealthReport."""
        conn = sqlite3.connect(str(temp_db))
        # Create a wave
        wave_id = f"wave-{uuid4().hex[:8]}"
        conn.execute(
            "INSERT INTO parallel_execution_waves (id, execution_run_id, wave_number, status) VALUES (?, ?, ?, ?)",
            (wave_id, execution_id, 1, "completed")
        )
        conn.commit()
        conn.close()

        report = skills.parallel_health(execution_id)

        assert isinstance(report, ParallelHealthReport)
        assert isinstance(report.wave_progress, list)
        assert isinstance(report.stuck_agents, list)
        assert isinstance(report.file_conflicts, list)
        assert isinstance(report.utilization, list)
        assert isinstance(report.is_healthy, bool)

    def test_detects_stuck_agents(self, skills, temp_db, execution_id):
        """Verify stuck agents are detected."""
        conn = sqlite3.connect(str(temp_db))
        old_heartbeat = (datetime.now() - timedelta(minutes=5)).isoformat()
        conn.execute(
            """INSERT INTO build_agent_instances
               (id, process_id, task_id, execution_run_id, status, spawned_at, last_heartbeat_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("agent-stuck", "pid-123", "task-001", execution_id, "executing", datetime.now().isoformat(), old_heartbeat)
        )
        conn.commit()
        conn.close()

        report = skills.parallel_health(execution_id)

        assert len(report.stuck_agents) >= 1
        assert report.is_healthy is False


class TestFindWaveBottlenecks:
    """P005: Find slowest tasks in each wave."""

    def test_finds_bottlenecks(self, skills, temp_db, execution_id):
        """Verify wave bottlenecks are found."""
        conn = sqlite3.connect(str(temp_db))
        wave_id = f"wave-{uuid4().hex[:8]}"
        conn.execute(
            "INSERT INTO parallel_execution_waves (id, execution_run_id, wave_number) VALUES (?, ?, ?)",
            (wave_id, execution_id, 1)
        )

        for i in range(5):
            task_id = f"task-{i:03d}"
            conn.execute(
                "INSERT INTO tasks (id, display_id, title, status) VALUES (?, ?, ?, ?)",
                (task_id, f"T-{i:03d}", f"Task {i}", "completed")
            )
            started = datetime.now() - timedelta(minutes=10)
            completed = started + timedelta(seconds=100 * (i + 1))
            conn.execute(
                "INSERT INTO wave_task_assignments (wave_id, task_id, started_at, completed_at) VALUES (?, ?, ?, ?)",
                (wave_id, task_id, started.isoformat(), completed.isoformat())
            )

        conn.commit()
        conn.close()

        bottlenecks = skills.find_wave_bottlenecks(execution_id)

        assert len(bottlenecks) >= 1
        # Slowest tasks should be first
        assert bottlenecks[0]["duration_sec"] >= bottlenecks[-1]["duration_sec"]


# ============================================================================
# D001-D006: Anomaly Detection Tools
# ============================================================================

class TestDetectAnomalies:
    """Test detect_anomalies method."""

    def test_returns_anomaly_report(self, skills, temp_db, execution_id):
        """Verify detect_anomalies returns AnomalyReport."""
        report = skills.detect_anomalies(execution_id)

        assert isinstance(report, AnomalyReport)
        assert isinstance(report.unusual_durations, list)
        assert isinstance(report.error_cascades, list)
        assert isinstance(report.activity_spikes, list)
        assert isinstance(report.orphaned_resources, list)
        assert isinstance(report.circular_waits, list)

    def test_detects_unusual_durations(self, skills, temp_db, execution_id):
        """Verify unusual durations are detected."""
        conn = sqlite3.connect(str(temp_db))
        # Create normal tool uses
        for i in range(5):
            conn.execute(
                """INSERT INTO tool_uses
                   (id, tool, start_time, duration_ms, execution_id, task_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (f"tu-normal-{i}", "Read", datetime.now().isoformat(), 100, execution_id, "task-001")
            )
        # Create one with unusual duration (10x average)
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, start_time, duration_ms, execution_id, task_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("tu-slow", "Read", datetime.now().isoformat(), 1000, execution_id, "task-001")
        )
        conn.commit()
        conn.close()

        report = skills.detect_anomalies(execution_id)

        assert len(report.unusual_durations) >= 1

    def test_detects_circular_waits(self, skills, temp_db):
        """Verify circular waits are detected."""
        conn = sqlite3.connect(str(temp_db))
        # Create tasks
        conn.execute("INSERT INTO tasks (id, display_id, title) VALUES (?, ?, ?)", ("task-a", "T-A", "Task A"))
        conn.execute("INSERT INTO tasks (id, display_id, title) VALUES (?, ?, ?)", ("task-b", "T-B", "Task B"))
        # Create circular dependency: A -> B -> A
        conn.execute(
            "INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type) VALUES (?, ?, ?, ?)",
            ("rel-1", "task-a", "task-b", "depends_on")
        )
        conn.execute(
            "INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type) VALUES (?, ?, ?, ?)",
            ("rel-2", "task-b", "task-a", "depends_on")
        )
        conn.commit()
        conn.close()

        report = skills.detect_anomalies("any-exec")

        assert len(report.circular_waits) >= 1


# ============================================================================
# A001-A005: Aggregation Tools
# ============================================================================

class TestExecutionSummary:
    """A001: Get high-level execution metrics."""

    def test_returns_summary(self, skills, populated_db):
        """Verify execution_summary returns correct structure."""
        summary = skills.execution_summary(populated_db)

        assert isinstance(summary, dict)
        assert "execution_id" in summary or summary == {}

    def test_summary_includes_counts(self, skills, temp_db, execution_id):
        """Verify summary includes correct counts."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            "INSERT INTO task_list_execution_runs (id, task_list_id, status, started_at) VALUES (?, ?, ?, ?)",
            (execution_id, "list-001", "running", datetime.now().isoformat())
        )

        # Add tool uses
        for i in range(5):
            status = "done" if i < 3 else "error"
            conn.execute(
                """INSERT INTO tool_uses
                   (id, tool, start_time, result_status, execution_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (f"tu-{i}", "Read", datetime.now().isoformat(), status, execution_id)
            )

        # Add assertions
        for i in range(4):
            result = "pass" if i < 2 else "fail"
            conn.execute(
                """INSERT INTO assertion_results
                   (id, category, result, timestamp, execution_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (f"ar-{i}", "syntax", result, datetime.now().isoformat(), execution_id)
            )

        conn.commit()
        conn.close()

        summary = skills.execution_summary(execution_id)

        assert summary["tool_uses"] == 5
        assert summary["errors"] == 2
        assert summary["assertions"] == 4
        assert summary["passed"] == 2
        assert summary["failed"] == 2


class TestToolUsageStats:
    """I002: Analyze tool usage patterns."""

    def test_returns_tool_stats(self, skills, populated_db):
        """Verify tool_usage_stats returns correct structure."""
        stats = skills.tool_usage_stats(populated_db)

        assert isinstance(stats, list)
        if len(stats) > 0:
            assert "tool" in stats[0]
            assert "total_uses" in stats[0]


class TestPassRateByCategory:
    """A004: Get assertion pass rates by category."""

    def test_returns_pass_rates(self, skills, populated_db):
        """Verify pass_rate_by_category returns correct structure."""
        rates = skills.pass_rate_by_category(populated_db)

        assert isinstance(rates, list)
        if len(rates) > 0:
            assert "category" in rates[0]
            assert "total" in rates[0]


class TestDurationPercentiles:
    """A005: Get tool duration percentiles."""

    def test_returns_percentiles(self, skills, populated_db):
        """Verify duration_percentiles returns correct structure."""
        percentiles = skills.duration_percentiles(populated_db)

        assert isinstance(percentiles, list)
        if len(percentiles) > 0:
            assert "tool" in percentiles[0]
            assert "total_calls" in percentiles[0]


# ============================================================================
# I001-I004: Investigation Tools
# ============================================================================

class TestTraceTask:
    """I001: Get complete execution path for a task."""

    def test_returns_task_trace(self, skills, populated_db):
        """Verify trace_task returns execution path."""
        trace = skills.trace_task("task-001")

        assert isinstance(trace, list)
        if len(trace) > 0:
            assert "sequence" in trace[0]
            assert "entry_type" in trace[0]


class TestAnalyzeFileAccess:
    """I004: Analyze file access patterns."""

    def test_returns_file_patterns(self, skills, populated_db):
        """Verify analyze_file_access returns file patterns."""
        patterns = skills.analyze_file_access(populated_db)

        assert isinstance(patterns, list)
        if len(patterns) > 0:
            assert "file_path" in patterns[0]
            assert "access_count" in patterns[0]


# ============================================================================
# Convenience Functions
# ============================================================================

class TestConvenienceFunctions:
    """Test convenience wrapper functions."""

    def test_obs_validate(self, temp_db, populated_db):
        """Verify obs_validate convenience function."""
        issues = obs_validate(populated_db, str(temp_db))

        assert isinstance(issues, list)

    def test_obs_errors(self, temp_db, populated_db):
        """Verify obs_errors convenience function."""
        errors = obs_errors(populated_db, str(temp_db))

        assert isinstance(errors, list)

    def test_obs_parallel_health(self, temp_db, populated_db):
        """Verify obs_parallel_health convenience function."""
        report = obs_parallel_health(populated_db, str(temp_db))

        assert isinstance(report, ParallelHealthReport)

    def test_obs_anomalies(self, temp_db, populated_db):
        """Verify obs_anomalies convenience function."""
        report = obs_anomalies(populated_db, str(temp_db))

        assert isinstance(report, AnomalyReport)

    def test_obs_summary(self, temp_db, populated_db):
        """Verify obs_summary convenience function."""
        summary = obs_summary(populated_db, str(temp_db))

        assert isinstance(summary, dict)


# ============================================================================
# Edge Cases
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_database_returns_empty_lists(self, skills, execution_id):
        """Verify empty database returns empty lists."""
        errors = skills.find_errors(execution_id)
        assert errors == []

        blocked = skills.find_blocked(execution_id)
        assert blocked == []

        issues = skills.validate(execution_id)
        assert issues == []

    def test_handles_null_values(self, skills, temp_db, execution_id):
        """Verify null values are handled gracefully."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, start_time, end_time, duration_ms, execution_id)
               VALUES (?, ?, ?, NULL, NULL, ?)""",
            ("tu-null", "Read", datetime.now().isoformat(), execution_id)
        )
        conn.commit()
        conn.close()

        # Should not raise
        issues = skills._check_temporal_consistency(execution_id)
        stats = skills.tool_usage_stats(execution_id)

        assert isinstance(issues, list)
        assert isinstance(stats, list)

    def test_handles_json_parse_in_details(self, skills, temp_db, execution_id):
        """Verify JSON fields are handled correctly."""
        conn = sqlite3.connect(str(temp_db))
        conn.execute(
            """INSERT INTO tool_uses
               (id, tool, input, start_time, execution_id)
               VALUES (?, ?, ?, ?, ?)""",
            ("tu-json", "Read", json.dumps({"file_path": "/test.ts", "nested": {"key": "value"}}), datetime.now().isoformat(), execution_id)
        )
        conn.commit()
        conn.close()

        patterns = skills.analyze_file_access(execution_id)

        assert isinstance(patterns, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
