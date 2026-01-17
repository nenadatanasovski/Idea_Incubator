#!/usr/bin/env python3
"""
Observability E2E Integration Tests

Tests the full integration flow:
1. Create execution run and wave records
2. Initialize observability producers
3. Write transcript entries
4. Log tool uses
5. Record assertions
6. Trace skills
7. Verify all data persisted to database
"""

import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime
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


def get_db_path() -> Path:
    """Get the database path."""
    return PROJECT_ROOT / "database" / "ideas.db"


def setup_test_context():
    """Set up test context with all required parent records."""
    db_path = get_db_path()

    # Generate unique IDs
    task_list_id = f"test-list-e2e-{uuid.uuid4().hex[:8]}"
    exec_id = f"test-exec-e2e-{uuid.uuid4().hex[:8]}"
    task_id = f"test-task-e2e-{uuid.uuid4().hex[:8]}"
    wave_id = f"test-wave-e2e-{uuid.uuid4().hex[:8]}"
    instance_id = f"test-inst-e2e-{uuid.uuid4().hex[:8]}"

    conn = sqlite3.connect(str(db_path), timeout=10)
    try:
        # Create task list (status must be one of: draft, ready, in_progress, paused, completed, archived)
        conn.execute(
            """INSERT INTO task_lists_v2 (id, name, status, created_at)
               VALUES (?, 'E2E Test Task List', 'ready', datetime('now'))""",
            (task_list_id,)
        )

        # Create execution run
        conn.execute(
            """INSERT INTO task_list_execution_runs (id, task_list_id, run_number, status, started_at)
               VALUES (?, ?, 1, 'running', datetime('now'))""",
            (exec_id, task_list_id)
        )

        # Create task (status must be one of: pending, in_progress, completed, failed)
        conn.execute(
            """INSERT INTO tasks (id, display_id, title, task_list_id, status, created_at)
               VALUES (?, 'TU-E2E-TST-001', 'E2E Test Task', ?, 'pending', datetime('now'))""",
            (task_id, task_list_id)
        )

        # Create wave (status must be one of: pending, in_progress, completed, failed)
        conn.execute(
            """INSERT INTO parallel_execution_waves (id, task_list_id, wave_number, status, started_at)
               VALUES (?, ?, 1, 'in_progress', datetime('now'))""",
            (wave_id, task_list_id)
        )

        conn.commit()
    finally:
        conn.close()

    return {
        "db_path": db_path,
        "task_list_id": task_list_id,
        "execution_id": exec_id,
        "task_id": task_id,
        "wave_id": wave_id,
        "instance_id": instance_id
    }


def cleanup_test_context(ctx: dict):
    """Clean up test data."""
    conn = sqlite3.connect(str(ctx["db_path"]), timeout=10)
    try:
        # Delete in dependency order
        conn.execute("DELETE FROM skill_traces WHERE execution_id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM assertion_results WHERE execution_id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM assertion_chains WHERE execution_id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM tool_uses WHERE execution_id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM parallel_execution_waves WHERE id = ?", (ctx["wave_id"],))
        conn.execute("DELETE FROM tasks WHERE id = ?", (ctx["task_id"],))
        conn.execute("DELETE FROM task_list_execution_runs WHERE id = ?", (ctx["execution_id"],))
        conn.execute("DELETE FROM task_lists_v2 WHERE id = ?", (ctx["task_list_id"],))
        conn.commit()
    finally:
        conn.close()


def test1_e2e_transcript_flow():
    """Test full transcript write flow."""
    ctx = None
    try:
        from shared.transcript_writer import TranscriptWriter

        ctx = setup_test_context()

        tw = TranscriptWriter(
            execution_id=ctx["execution_id"],
            instance_id=ctx["instance_id"],
            wave_id=ctx["wave_id"],
            wave_number=1,
            db_path=ctx["db_path"]
        )

        # Write multiple entries
        entry1 = tw.write({
            "entry_type": "phase_start",
            "category": "lifecycle",
            "task_id": ctx["task_id"],
            "summary": "E2E test phase started"
        })

        entry2 = tw.write({
            "entry_type": "decision",
            "category": "reasoning",
            "task_id": ctx["task_id"],
            "summary": "E2E test decision made"
        })

        tw.flush()
        tw.close()

        # Verify in database
        conn = sqlite3.connect(str(ctx["db_path"]))
        cursor = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?",
            (ctx["execution_id"],)
        )
        count = cursor.fetchone()[0]
        conn.close()

        cleanup_test_context(ctx)

        record_test(
            "E2E Test 1: Full transcript flow",
            count >= 2,
            f"Created {count} transcript entries"
        )
    except Exception as e:
        if ctx:
            cleanup_test_context(ctx)
        record_test("E2E Test 1: Full transcript flow", False, str(e))


def test2_e2e_tool_logging_flow():
    """Test full tool logging flow."""
    ctx = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger

        ctx = setup_test_context()

        tw = TranscriptWriter(
            execution_id=ctx["execution_id"],
            instance_id=ctx["instance_id"],
            wave_id=ctx["wave_id"],
            wave_number=1,
            db_path=ctx["db_path"]
        )

        tl = ToolUseLogger(tw, db_path=ctx["db_path"])

        # Log multiple tool uses
        tool1_id = tl.log_start("Read", {"file_path": "/test/e2e.txt"}, ctx["task_id"])
        tl.log_end(tool1_id, "File contents")

        tool2_id = tl.log_start("Write", {"file_path": "/test/out.txt", "content": "data"}, ctx["task_id"])
        tl.log_end(tool2_id, "Written successfully")

        tw.flush()
        tw.close()

        # Verify in database
        conn = sqlite3.connect(str(ctx["db_path"]))
        cursor = conn.execute(
            "SELECT COUNT(*) FROM tool_uses WHERE execution_id = ?",
            (ctx["execution_id"],)
        )
        count = cursor.fetchone()[0]

        cursor = conn.execute(
            "SELECT DISTINCT tool FROM tool_uses WHERE execution_id = ?",
            (ctx["execution_id"],)
        )
        tools = [r[0] for r in cursor.fetchall()]
        conn.close()

        cleanup_test_context(ctx)

        record_test(
            "E2E Test 2: Full tool logging flow",
            count >= 2 and "Read" in tools and "Write" in tools,
            f"Logged {count} tool uses: {tools}"
        )
    except Exception as e:
        if ctx:
            cleanup_test_context(ctx)
        record_test("E2E Test 2: Full tool logging flow", False, str(e))


def test3_e2e_assertion_chain_flow():
    """Test full assertion chain flow."""
    ctx = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.assertion_recorder import AssertionRecorder

        ctx = setup_test_context()

        tw = TranscriptWriter(
            execution_id=ctx["execution_id"],
            instance_id=ctx["instance_id"],
            wave_id=ctx["wave_id"],
            wave_number=1,
            db_path=ctx["db_path"]
        )

        ar = AssertionRecorder(tw, ctx["execution_id"], db_path=ctx["db_path"])

        # Run assertion chain
        chain_id = ar.start_chain(ctx["task_id"], "E2E validation chain")

        ar.assert_manual(ctx["task_id"], "file_created", "Test file exists", True)
        ar.assert_manual(ctx["task_id"], "compilation", "TypeScript compiles", True)
        ar.assert_manual(ctx["task_id"], "test_pass", "Tests pass", False)

        result = ar.end_chain(chain_id)

        tw.flush()
        tw.close()

        # Verify chain result
        passed = (
            result.overall_result == "fail" and  # One assertion failed
            result.pass_count == 2 and
            result.fail_count == 1
        )

        cleanup_test_context(ctx)

        record_test(
            "E2E Test 3: Full assertion chain flow",
            passed,
            f"Chain result: {result.overall_result}, {result.pass_count} pass, {result.fail_count} fail"
        )
    except Exception as e:
        if ctx:
            cleanup_test_context(ctx)
        record_test("E2E Test 3: Full assertion chain flow", False, str(e))


def test4_e2e_skill_trace_flow():
    """Test full skill tracing flow."""
    ctx = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger
        from shared.skill_tracer import SkillTracer

        ctx = setup_test_context()

        tw = TranscriptWriter(
            execution_id=ctx["execution_id"],
            instance_id=ctx["instance_id"],
            wave_id=ctx["wave_id"],
            wave_number=1,
            db_path=ctx["db_path"]
        )

        tl = ToolUseLogger(tw, db_path=ctx["db_path"])
        st = SkillTracer(tw, tl, db_path=ctx["db_path"])

        # Trace a skill with nested tool calls
        skill_ref = st.create_skill_ref(
            skill_name="commit",
            skill_file="skills/git.md",
            line_number=42,
            section_title="Git Commit Skill"
        )

        trace_id = st.trace_start(skill_ref, task_id=ctx["task_id"])

        # Simulate tool calls within skill
        tool_id = tl.log_start("Bash", {"command": "git status"}, ctx["task_id"])
        st.add_tool_call(trace_id, tool_id)
        tl.log_end(tool_id, "On branch main")

        st.trace_end(trace_id, "success")

        tw.flush()
        tw.close()

        # Verify in database
        conn = sqlite3.connect(str(ctx["db_path"]))
        cursor = conn.execute(
            "SELECT id, status, skill_name, tool_calls FROM skill_traces WHERE id = ?",
            (trace_id,)
        )
        row = cursor.fetchone()
        conn.close()

        passed = row is not None and row[1] == "success" and row[2] == "commit"
        tool_calls = json.loads(row[3]) if row and row[3] else []

        cleanup_test_context(ctx)

        record_test(
            "E2E Test 4: Full skill trace flow",
            passed and len(tool_calls) >= 1,
            f"Skill: {row[2] if row else 'N/A'}, Status: {row[1] if row else 'N/A'}, Tool calls: {len(tool_calls)}"
        )
    except Exception as e:
        if ctx:
            cleanup_test_context(ctx)
        record_test("E2E Test 4: Full skill trace flow", False, str(e))


def test5_e2e_combined_flow():
    """Test combined observability flow simulating real agent execution."""
    ctx = None
    try:
        from shared.transcript_writer import TranscriptWriter
        from shared.tool_use_logger import ToolUseLogger
        from shared.assertion_recorder import AssertionRecorder
        from shared.skill_tracer import SkillTracer

        ctx = setup_test_context()

        # Initialize all producers (like build_agent_worker)
        tw = TranscriptWriter(
            execution_id=ctx["execution_id"],
            instance_id=ctx["instance_id"],
            wave_id=ctx["wave_id"],
            wave_number=1,
            db_path=ctx["db_path"]
        )

        tl = ToolUseLogger(tw, db_path=ctx["db_path"])
        ar = AssertionRecorder(tw, ctx["execution_id"], db_path=ctx["db_path"])
        st = SkillTracer(tw, tl, db_path=ctx["db_path"])

        # Simulate agent execution lifecycle
        tw.write({
            "entry_type": "phase_start",
            "category": "lifecycle",
            "task_id": ctx["task_id"],
            "summary": "Agent execution started"
        })

        # Read task file
        tool_id = tl.log_start("Read", {"file_path": "tasks.md"}, ctx["task_id"])
        tl.log_end(tool_id, "Task content")

        # Execute a skill
        skill_ref = st.create_skill_ref("build", "skills/build.md", 10, "Build")
        trace_id = st.trace_start(skill_ref, task_id=ctx["task_id"])

        # Tool within skill
        bash_id = tl.log_start("Bash", {"command": "npm run build"}, ctx["task_id"])
        st.add_tool_call(trace_id, bash_id)
        tl.log_end(bash_id, "Build complete")

        st.trace_end(trace_id, "success")

        # Run validation assertions
        chain_id = ar.start_chain(ctx["task_id"], "Build validation")
        ar.assert_manual(ctx["task_id"], "build_success", "Build completed", True)
        ar.assert_manual(ctx["task_id"], "no_errors", "No errors", True)
        result = ar.end_chain(chain_id)

        tw.write({
            "entry_type": "phase_complete",
            "category": "lifecycle",
            "task_id": ctx["task_id"],
            "summary": "Agent execution completed"
        })

        tw.flush()
        tw.close()

        # Verify all data
        conn = sqlite3.connect(str(ctx["db_path"]))

        transcript_count = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?",
            (ctx["execution_id"],)
        ).fetchone()[0]

        tool_count = conn.execute(
            "SELECT COUNT(*) FROM tool_uses WHERE execution_id = ?",
            (ctx["execution_id"],)
        ).fetchone()[0]

        skill_count = conn.execute(
            "SELECT COUNT(*) FROM skill_traces WHERE execution_id = ?",
            (ctx["execution_id"],)
        ).fetchone()[0]

        conn.close()

        cleanup_test_context(ctx)

        passed = (
            transcript_count >= 2 and
            tool_count >= 2 and
            skill_count >= 1 and
            result.overall_result == "pass"
        )

        record_test(
            "E2E Test 5: Combined agent execution flow",
            passed,
            f"Transcripts: {transcript_count}, Tools: {tool_count}, Skills: {skill_count}, Chain: {result.overall_result}"
        )
    except Exception as e:
        if ctx:
            cleanup_test_context(ctx)
        record_test("E2E Test 5: Combined agent execution flow", False, str(e))


def run_all_tests():
    """Run all E2E integration tests."""
    print("=== OBSERVABILITY E2E INTEGRATION TESTS ===\n")

    test1_e2e_transcript_flow()
    test2_e2e_tool_logging_flow()
    test3_e2e_assertion_chain_flow()
    test4_e2e_skill_trace_flow()
    test5_e2e_combined_flow()

    # Summary
    passed = len([r for r in results if r["passed"]])
    failed = len([r for r in results if not r["passed"]])

    print("\n=== SUMMARY ===")
    print(f"Passed: {passed}/{len(results)}")
    print(f"Failed: {failed}/{len(results)}")

    if failed == 0:
        print("\n✓ ALL E2E TESTS PASSED")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
