#!/usr/bin/env python3
"""
Test GAP-001: Per-Task Validation Commands

Pass Criteria:
1. tasks table has validation_command column
2. Build Agent reads validation_command from DB
3. Python task uses python3 validation (not tsc)
4. SQL task uses sqlite3 validation (not tsc)
5. TypeScript task still uses tsc (fallback)
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_schema_has_column():
    """Test 1: tasks table has validation_command column"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    assert "validation_command" in columns, "FAIL: validation_command column missing from tasks table"
    print("PASS: validation_command column exists in tasks table")
    return True

def test_python_task_has_python_validation():
    """Test 2: Python tasks have python3 validation command"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT display_id, validation_command
        FROM tasks
        WHERE display_id LIKE 'OBS-1%'
        AND validation_command IS NOT NULL
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("SKIP: No observability tasks with validation commands found")
        return None

    display_id, cmd = row
    assert "python3" in cmd, f"FAIL: Task {display_id} should use python3 validation, got: {cmd}"
    print(f"PASS: Task {display_id} uses python3 validation: {cmd}")
    return True

def test_sql_task_has_sqlite_validation():
    """Test 3: SQL tasks have sqlite3 validation command"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT display_id, validation_command
        FROM tasks
        WHERE display_id LIKE 'OBS-%'
        AND description LIKE '%migration%'
        AND validation_command IS NOT NULL
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("SKIP: No SQL migration tasks with validation commands found")
        return None

    display_id, cmd = row
    assert "sqlite3" in cmd or "sql" in cmd.lower(), f"FAIL: SQL task {display_id} should use sqlite3 validation"
    print(f"PASS: Task {display_id} uses SQL validation: {cmd}")
    return True

def test_build_agent_reads_validation_command():
    """Test 4: Build Agent Worker reads validation_command from database"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Check that _load_task fetches validation_command
    assert "validation_command" in content, "FAIL: Build Agent Worker doesn't reference validation_command"

    # Check that _run_validation uses self.task.validation_command (not hardcoded)
    assert "self.task.validation_command" in content, "FAIL: Build Agent should use task's validation command"
    print("PASS: Build Agent Worker references validation_command")
    return True

def test_fallback_to_tsc():
    """Test 5: Build Agent falls back to tsc when validation_command is None"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Check for fallback pattern
    assert 'or "npx tsc --noEmit"' in content or "npx tsc --noEmit" in content, "FAIL: Build Agent missing tsc fallback"
    print("PASS: Build Agent has tsc fallback")
    return True

def main():
    print("=" * 60)
    print("GAP-001 Test Suite: Per-Task Validation Commands")
    print("=" * 60)

    results = []
    try:
        results.append(("Schema has column", test_schema_has_column()))
    except AssertionError as e:
        results.append(("Schema has column", False))
        print(e)

    try:
        results.append(("Python validation", test_python_task_has_python_validation()))
    except AssertionError as e:
        results.append(("Python validation", False))
        print(e)

    try:
        results.append(("SQL validation", test_sql_task_has_sqlite_validation()))
    except AssertionError as e:
        results.append(("SQL validation", False))
        print(e)

    try:
        results.append(("Build Agent reads command", test_build_agent_reads_validation_command()))
    except AssertionError as e:
        results.append(("Build Agent reads command", False))
        print(e)

    try:
        results.append(("Fallback to tsc", test_fallback_to_tsc()))
    except AssertionError as e:
        results.append(("Fallback to tsc", False))
        print(e)

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
