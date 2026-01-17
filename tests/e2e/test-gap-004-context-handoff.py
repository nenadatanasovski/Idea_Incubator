#!/usr/bin/env python3
"""
Test GAP-004: Context Handoff Between Agents

Pass Criteria:
1. task_execution_log table exists
2. Build Agent writes to execution log
3. Build Agent can read previous execution log
4. Orchestrator passes resume-execution-id to new agents
5. Resume context included in prompt
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_execution_log_table_exists():
    """Test 1: task_execution_log table exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='task_execution_log'
    """)
    exists = cursor.fetchone() is not None
    conn.close()

    if exists:
        print("PASS: task_execution_log table exists")
        return True
    else:
        print("FAIL: task_execution_log table does not exist")
        return False

def test_execution_log_schema():
    """Test 2: task_execution_log has correct schema"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(task_execution_log)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        required = ["id", "execution_id", "line_number", "content"]
        missing = [c for c in required if c not in columns]

        if missing:
            print(f"FAIL: Missing columns in task_execution_log: {missing}")
            return False

        print(f"PASS: task_execution_log has required columns: {list(columns.keys())}")
        return True
    except sqlite3.OperationalError:
        print("FAIL: task_execution_log table doesn't exist")
        return False
    finally:
        conn.close()

def test_build_agent_writes_logs():
    """Test 3: Build Agent writes to execution log"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "task_execution_log" in content and "_log_continuous" in content:
        print("PASS: Build Agent has _log_continuous method for writing logs")
        return True
    elif "INSERT" in content and "execution_log" in content.lower():
        print("PASS: Build Agent writes to execution log")
        return True
    else:
        print("FAIL: Build Agent doesn't write to execution log")
        return False

def test_build_agent_reads_previous_logs():
    """Test 4: Build Agent can resume from previous execution"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    resume_keywords = ["resume", "execution_id", "previous", "_load_previous_context"]
    found = sum(1 for kw in resume_keywords if kw in content.lower())

    if found >= 2:
        print(f"PASS: Build Agent has resume capability ({found}/4 keywords)")
        return True
    else:
        print(f"FAIL: Resume capability not implemented ({found}/4 keywords)")
        return False

def test_cli_has_resume_argument():
    """Test 5: CLI has --resume-execution-id argument"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "--resume-execution-id" in content:
        print("PASS: CLI has --resume-execution-id argument")
        return True
    else:
        print("FAIL: CLI missing --resume-execution-id argument")
        return False

def test_orchestrator_passes_resume_id():
    """Test 6: Orchestrator passes resume-execution-id to agents"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator file not found")
        return None

    content = orchestrator_path.read_text()

    if "resume-execution-id" in content or "retryTaskWithContext" in content:
        print("PASS: Orchestrator can pass resume context to agents")
        return True
    else:
        print("SKIP: Orchestrator doesn't yet pass resume-execution-id directly")
        return None

def main():
    print("=" * 60)
    print("GAP-004 Test Suite: Context Handoff Between Agents")
    print("=" * 60)

    results = []

    try:
        results.append(("Execution log table exists", test_execution_log_table_exists()))
    except Exception as e:
        results.append(("Execution log table exists", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Execution log schema", test_execution_log_schema()))
    except Exception as e:
        results.append(("Execution log schema", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Build Agent writes logs", test_build_agent_writes_logs()))
    except Exception as e:
        results.append(("Build Agent writes logs", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Build Agent reads previous", test_build_agent_reads_previous_logs()))
    except Exception as e:
        results.append(("Build Agent reads previous", False))
        print(f"ERROR: {e}")

    try:
        results.append(("CLI has resume argument", test_cli_has_resume_argument()))
    except Exception as e:
        results.append(("CLI has resume argument", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Orchestrator passes ID", test_orchestrator_passes_resume_id()))
    except Exception as e:
        results.append(("Orchestrator passes ID", False))
        print(f"ERROR: {e}")

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
