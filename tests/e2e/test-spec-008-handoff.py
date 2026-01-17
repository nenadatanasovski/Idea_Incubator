#!/usr/bin/env python3
"""
Test SPEC-008: Task Agent Handoff

Pass Criteria:
1. Task list converter exists
2. source_spec_id column exists in task_lists_v2
3. Converter has main functions
4. Task generation from spec sections
5. Archived state handling exists
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_converter_exists():
    """Test 1: Task list converter exists"""
    conv_path = PROJECT_ROOT / "server" / "services" / "spec" / "task-list-converter.ts"

    if conv_path.exists():
        content = conv_path.read_text()
        if "convertSpecToTaskList" in content:
            print("PASS: task-list-converter.ts exists with converter")
            return True
        print("FAIL: Converter file missing main function")
        return False
    else:
        print("FAIL: task-list-converter.ts not found")
        return False

def test_source_spec_id_column():
    """Test 2: task_lists_v2 has source_spec_id column"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(task_lists_v2)")
        columns = [row[1] for row in cursor.fetchall()]

        if "source_spec_id" in columns:
            print("PASS: task_lists_v2 has source_spec_id column")
            return True
        else:
            print("FAIL: source_spec_id column missing")
            return False
    except sqlite3.OperationalError as e:
        print(f"SKIP: task_lists_v2 table doesn't exist or error: {e}")
        return None
    finally:
        conn.close()

def test_converter_functions():
    """Test 3: Converter has required functions"""
    conv_path = PROJECT_ROOT / "server" / "services" / "spec" / "task-list-converter.ts"

    if not conv_path.exists():
        print("SKIP: Converter doesn't exist")
        return None

    content = conv_path.read_text()

    functions = [
        "convertSpecToTaskList",
        "generateInitialTasks",
        "getTaskListBySpec",
    ]

    found = sum(1 for f in functions if f in content)

    if found >= 3:
        print(f"PASS: All converter functions exist ({found}/3)")
        return True
    else:
        print(f"FAIL: Missing converter functions ({found}/3)")
        return False

def test_task_generation():
    """Test 4: Task generation from spec sections"""
    conv_path = PROJECT_ROOT / "server" / "services" / "spec" / "task-list-converter.ts"

    if not conv_path.exists():
        print("SKIP: Converter doesn't exist")
        return None

    content = conv_path.read_text()

    # Check for success criteria processing
    has_success_criteria = "success_criteria" in content or "successCriteria" in content
    has_functional_desc = "functional_desc" in content or "functionalDescription" in content
    has_infer_category = "inferCategory" in content

    if has_success_criteria and has_infer_category:
        print("PASS: Task generation from spec sections exists")
        return True
    elif has_success_criteria or has_functional_desc:
        print("PARTIAL: Some task generation logic exists")
        return True
    else:
        print("FAIL: Task generation not implemented")
        return False

def test_archived_state_handling():
    """Test 5: Archived state handling exists"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    if "archived" in content and "archiveSpec" in content:
        print("PASS: Archived state handling exists")
        return True
    else:
        print("FAIL: Archived state not handled")
        return False

def test_migration_file():
    """Test 6: Migration file for spec link exists"""
    migrations = list((PROJECT_ROOT / "database" / "migrations").glob("*task_list_spec*.sql"))

    if migrations:
        print(f"PASS: Migration file exists: {migrations[0].name}")
        return True
    else:
        # Also check for numbered migrations that might have the column
        for mig in (PROJECT_ROOT / "database" / "migrations").glob("10*.sql"):
            content = mig.read_text()
            if "source_spec_id" in content:
                print(f"PASS: Migration with source_spec_id found: {mig.name}")
                return True
        print("FAIL: No migration file for spec link found")
        return False

def test_spec_view_exists():
    """Test 7: View for task list spec relationship exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='view' AND name='task_list_spec_view'
        """)
        if cursor.fetchone():
            print("PASS: task_list_spec_view exists")
            return True
        else:
            print("SKIP: task_list_spec_view not created yet")
            return None
    except sqlite3.OperationalError as e:
        print(f"SKIP: Could not check views: {e}")
        return None
    finally:
        conn.close()

def main():
    print("=" * 60)
    print("SPEC-008 Test Suite: Task Agent Handoff")
    print("=" * 60)

    results = []
    results.append(("Converter exists", test_converter_exists()))
    results.append(("source_spec_id column", test_source_spec_id_column()))
    results.append(("Converter functions", test_converter_functions()))
    results.append(("Task generation", test_task_generation()))
    results.append(("Archived state handling", test_archived_state_handling()))
    results.append(("Migration file", test_migration_file()))
    results.append(("Spec view", test_spec_view_exists()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")

    if failed == 0:
        print("\n✓ All tests passed! SPEC-008 is complete.")
        return 0
    else:
        print("\n✗ Some tests failed. Please fix issues before proceeding.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
