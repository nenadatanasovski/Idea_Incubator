#!/usr/bin/env python3
"""
Observability Phase 2 Producer Unit Tests

Tests the Python producer classes:
- TranscriptWriter
- ToolUseLogger
- AssertionRecorder
- SkillTracer
"""

import json
import os
import sqlite3
import sys
import tempfile
import uuid
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "coding-loops"))

# Test results tracking
results = []

def record_test(name: str, passed: bool, details: str = None):
    """Record a test result."""
    results.append({"name": name, "passed": passed, "details": details})
    status = "✓ PASS" if passed else "✗ FAIL"
    detail_str = f" - {details}" if details else ""
    print(f"{status}: {name}{detail_str}")


def setup_test_db():
    """Create a test database with required schema."""
    db_path = PROJECT_ROOT / "database" / "ideas.db"
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    return db_path


def create_test_execution_run(db_path: Path, exec_id: str, task_list_id: str = None, task_id: str = None):
    """Create a test execution run record for FK compliance."""
    if task_list_id is None:
        task_list_id = f"test-list-{uuid.uuid4().hex[:8]}"

    conn = sqlite3.connect(str(db_path), timeout=10)
    try:
        # Create a task list first (if it doesn't exist)
        # Status must be one of: draft, ready, in_progress, paused, completed, archived
        conn.execute(
            """INSERT OR IGNORE INTO task_lists_v2 (id, name, status, created_at)
               VALUES (?, 'Test Task List', 'ready', datetime('now'))""",
            (task_list_id,)
        )
        # Create the execution run with run_number
        conn.execute(
            """INSERT INTO task_list_execution_runs (id, task_list_id, run_number, status, started_at)
               VALUES (?, ?, 1, 'running', datetime('now'))""",
            (exec_id, task_list_id)
        )
        # Create a test task if requested (for FK compliance on skill_traces, etc.)
        if task_id:
            conn.execute(
                """INSERT OR IGNORE INTO tasks (id, display_id, title, task_list_id, status, created_at)
                   VALUES (?, ?, 'Test Task', ?, 'pending', datetime('now'))""",
                (task_id, f"TU-TEST-TST-001", task_list_id)
            )
        conn.commit()
    finally:
        conn.close()
    return task_list_id


def cleanup_test_execution_run(db_path: Path, exec_id: str, task_list_id: str, task_id: str = None):
    """Clean up test execution run record."""
    conn = sqlite3.connect(str(db_path), timeout=10)
    try:
        if task_id:
            conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.execute("DELETE FROM task_list_execution_runs WHERE id = ?", (exec_id,))
        conn.execute("DELETE FROM task_lists_v2 WHERE id = ?", (task_list_id,))
        conn.commit()
    finally:
        conn.close()


def test1_transcript_writer_import():
    """Test that TranscriptWriter can be imported."""
    try:
        from shared.transcript_writer import TranscriptWriter, TranscriptEntryType
        record_test("Test 1: TranscriptWriter imports", True)
        return True
    except ImportError as e:
        record_test("Test 1: TranscriptWriter imports", False, str(e))
        return False


def test2_transcript_writer_creates_entries():
    """Test that TranscriptWriter creates transcript entries."""
    db_path = None
    exec_id = None
    task_list_id = None
    try:
        from shared.transcript_writer import TranscriptWriter

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"

        # Create parent record for FK compliance
        task_list_id = create_test_execution_run(db_path, exec_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )

        # Write an entry
        entry_id = tw.write({
            "entry_type": "phase_start",
            "category": "lifecycle",
            "summary": "Test phase started"
        })

        # Flush to database
        tw.flush()

        # Verify sequence incremented
        seq = tw.get_sequence()

        tw.close()

        # Check database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT id FROM transcript_entries WHERE id = ?",
            (entry_id,)
        )
        rows = cursor.fetchall()
        conn.close()

        # Clean up test data
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            "DELETE FROM transcript_entries WHERE execution_id = ?",
            (exec_id,)
        )
        conn.commit()
        conn.close()

        # Clean up FK parent records
        cleanup_test_execution_run(db_path, exec_id, task_list_id)

        record_test(
            "Test 2: TranscriptWriter creates entries",
            len(rows) == 1 and seq >= 1,
            f"Entry created: {len(rows) == 1}, Sequence: {seq}"
        )
        return True
    except Exception as e:
        # Clean up on error
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_execution_run(db_path, exec_id, task_list_id)
            except:
                pass
        record_test("Test 2: TranscriptWriter creates entries", False, str(e))
        return False


def test3_tool_use_logger_import():
    """Test that ToolUseLogger can be imported."""
    try:
        from shared.tool_use_logger import ToolUseLogger, ToolCategory
        record_test("Test 3: ToolUseLogger imports", True)
        return True
    except ImportError as e:
        record_test("Test 3: ToolUseLogger imports", False, str(e))
        return False


def test4_tool_use_logger_records():
    """Test that ToolUseLogger records tool uses."""
    db_path = None
    exec_id = None
    task_list_id = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"

        # Create parent record for FK compliance
        task_list_id = create_test_execution_run(db_path, exec_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )
        tl = ToolUseLogger(tw, db_path=db_path)

        # Log a tool use
        tool_id = tl.log_start("Read", {"file_path": "/test/file.txt"})
        tl.log_end(tool_id, "File contents here")

        tw.flush()
        tw.close()

        # Check database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT id, result_status FROM tool_uses WHERE id = ?",
            (tool_id,)
        )
        rows = cursor.fetchall()
        conn.close()

        # Clean up test data
        conn = sqlite3.connect(str(db_path))
        conn.execute("DELETE FROM tool_uses WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (exec_id,))
        conn.commit()
        conn.close()

        # Clean up FK parent records
        cleanup_test_execution_run(db_path, exec_id, task_list_id)

        passed = len(rows) == 1 and rows[0][1] == "done"
        record_test(
            "Test 4: ToolUseLogger records tool uses",
            passed,
            f"Record found: {len(rows) == 1}, Status: {rows[0][1] if rows else 'N/A'}"
        )
        return True
    except Exception as e:
        # Clean up on error
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_execution_run(db_path, exec_id, task_list_id)
            except:
                pass
        record_test("Test 4: ToolUseLogger records tool uses", False, str(e))
        return False


def test5_assertion_recorder_import():
    """Test that AssertionRecorder can be imported."""
    try:
        from shared.assertion_recorder import AssertionRecorder, AssertionCategory
        record_test("Test 5: AssertionRecorder imports", True)
        return True
    except ImportError as e:
        record_test("Test 5: AssertionRecorder imports", False, str(e))
        return False


def test6_assertion_recorder_chains():
    """Test that AssertionRecorder creates chains and records assertions."""
    db_path = None
    exec_id = None
    task_list_id = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.assertion_recorder import AssertionRecorder

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"
        task_id = f"test-task-{uuid.uuid4().hex[:8]}"

        # Create parent record for FK compliance
        task_list_id = create_test_execution_run(db_path, exec_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )
        ar = AssertionRecorder(tw, exec_id, db_path=db_path)

        # Start a chain
        chain_id = ar.start_chain(task_id, "Test validation chain")

        # Record some assertions
        ar.assert_manual(task_id, "custom", "Test pass assertion", True)
        ar.assert_manual(task_id, "custom", "Test fail assertion", False)

        # End chain
        result = ar.end_chain(chain_id)

        tw.flush()
        tw.close()

        # Check chain result
        passed = (
            result.overall_result == "fail" and
            result.pass_count == 1 and
            result.fail_count == 1
        )

        # Clean up test data
        conn = sqlite3.connect(str(db_path))
        conn.execute("DELETE FROM assertion_results WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM assertion_chains WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (exec_id,))
        conn.commit()
        conn.close()

        # Clean up FK parent records
        cleanup_test_execution_run(db_path, exec_id, task_list_id)

        record_test(
            "Test 6: AssertionRecorder chains work",
            passed,
            f"Overall: {result.overall_result}, Pass: {result.pass_count}, Fail: {result.fail_count}"
        )
        return True
    except Exception as e:
        # Clean up on error
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_execution_run(db_path, exec_id, task_list_id)
            except:
                pass
        record_test("Test 6: AssertionRecorder chains work", False, str(e))
        return False


def test7_skill_tracer_import():
    """Test that SkillTracer can be imported."""
    try:
        from shared.skill_tracer import SkillTracer, SkillReference
        record_test("Test 7: SkillTracer imports", True)
        return True
    except ImportError as e:
        record_test("Test 7: SkillTracer imports", False, str(e))
        return False


def test8_skill_tracer_records():
    """Test that SkillTracer records skill traces."""
    db_path = None
    exec_id = None
    task_list_id = None
    test_task_id = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger
        from shared.skill_tracer import SkillTracer

        db_path = setup_test_db()
        exec_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        inst_id = f"test-inst-{uuid.uuid4().hex[:8]}"
        test_task_id = f"test-task-{uuid.uuid4().hex[:8]}"

        # Create parent records for FK compliance (including task)
        task_list_id = create_test_execution_run(db_path, exec_id, task_id=test_task_id)

        tw = TranscriptWriter(
            execution_id=exec_id,
            instance_id=inst_id,
            db_path=db_path
        )
        tl = ToolUseLogger(tw, db_path=db_path)
        st = SkillTracer(tw, tl, db_path=db_path)

        # Create a skill ref and trace it
        skill_ref = st.create_skill_ref(
            skill_name="test-skill",
            skill_file="test/skills.md",
            line_number=42,
            section_title="Test Skill"
        )

        trace_id = st.trace_start(skill_ref, task_id=test_task_id)
        st.trace_end(trace_id, "success")

        tw.flush()
        tw.close()

        # Check database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT id, status FROM skill_traces WHERE id = ?",
            (trace_id,)
        )
        rows = cursor.fetchall()
        conn.close()

        # Clean up
        conn = sqlite3.connect(str(db_path))
        conn.execute("DELETE FROM skill_traces WHERE execution_id = ?", (exec_id,))
        conn.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (exec_id,))
        conn.commit()
        conn.close()

        # Clean up FK parent records
        cleanup_test_execution_run(db_path, exec_id, task_list_id, test_task_id)

        passed = len(rows) == 1 and rows[0][1] == "success"
        record_test(
            "Test 8: SkillTracer records traces",
            passed,
            f"Record found: {len(rows) == 1}, Status: {rows[0][1] if rows else 'N/A'}"
        )
        return True
    except Exception as e:
        # Clean up on error
        if db_path and exec_id and task_list_id:
            try:
                cleanup_test_execution_run(db_path, exec_id, task_list_id, test_task_id)
            except:
                pass
        record_test("Test 8: SkillTracer records traces", False, str(e))
        return False


def run_all_tests():
    """Run all Phase 2 tests."""
    print("=== OBSERVABILITY PHASE 2 PRODUCER UNIT TESTS ===\n")

    test1_transcript_writer_import()
    test2_transcript_writer_creates_entries()
    test3_tool_use_logger_import()
    test4_tool_use_logger_records()
    test5_assertion_recorder_import()
    test6_assertion_recorder_chains()
    test7_skill_tracer_import()
    test8_skill_tracer_records()

    # Summary
    passed = len([r for r in results if r["passed"]])
    failed = len([r for r in results if not r["passed"]])

    print("\n=== SUMMARY ===")
    print(f"Passed: {passed}/{len(results)}")
    print(f"Failed: {failed}/{len(results)}")

    if failed == 0:
        print("\n✓ ALL PHASE 2 TESTS PASSED")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
