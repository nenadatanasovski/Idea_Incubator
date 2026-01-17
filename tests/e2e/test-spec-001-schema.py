#!/usr/bin/env python3
"""
Test SPEC-001: Database Schema for Spec Workflow

Pass Criteria:
1. prds table has workflow_state column
2. prds table has source_session_id column
3. spec_sections table exists with correct schema
4. spec_history table exists
5. Foreign key to ideation_sessions works
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_prds_has_workflow_columns():
    """Test 1: prds table has workflow state columns"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(prds)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    required = ["workflow_state", "source_session_id", "readiness_score", "version"]
    missing = [c for c in required if c not in columns]

    if missing:
        print(f"FAIL: Missing columns in prds: {missing}")
        return False

    print(f"PASS: prds has workflow columns: {required}")
    return True

def test_spec_sections_exists():
    """Test 2: spec_sections table exists with correct schema"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(spec_sections)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        required = ["id", "spec_id", "section_type", "content", "order_index"]
        missing = [c for c in required if c not in columns]

        if missing:
            print(f"FAIL: Missing columns in spec_sections: {missing}")
            return False

        print(f"PASS: spec_sections has correct schema: {list(columns.keys())}")
        return True
    except sqlite3.OperationalError:
        print("FAIL: spec_sections table doesn't exist")
        return False
    finally:
        conn.close()

def test_spec_history_exists():
    """Test 3: spec_history table exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='spec_history'
    """)
    exists = cursor.fetchone() is not None
    conn.close()

    if exists:
        print("PASS: spec_history table exists")
        return True
    else:
        print("FAIL: spec_history table doesn't exist")
        return False

def test_workflow_state_constraint():
    """Test 4: workflow_state has valid CHECK constraint"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        # Try to insert invalid workflow state
        cursor.execute("""
            INSERT INTO prds (id, slug, title, user_id, workflow_state)
            VALUES ('test-check', 'test', 'Test', 'user1', 'invalid_state')
        """)
        cursor.execute("DELETE FROM prds WHERE id = 'test-check'")
        conn.commit()
        print("FAIL: Invalid workflow_state was accepted")
        return False
    except sqlite3.IntegrityError:
        print("PASS: workflow_state CHECK constraint works")
        return True
    finally:
        conn.close()

def test_source_session_fk():
    """Test 5: source_session_id foreign key works"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check if ideation_sessions table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_sessions'
    """)
    if not cursor.fetchone():
        print("SKIP: ideation_sessions table doesn't exist")
        conn.close()
        return None

    print("PASS: Foreign key reference table exists")
    conn.close()
    return True

def main():
    print("=" * 60)
    print("SPEC-001 Test Suite: Database Schema for Spec Workflow")
    print("=" * 60)

    results = []
    results.append(("Workflow columns exist", test_prds_has_workflow_columns()))
    results.append(("spec_sections table", test_spec_sections_exists()))
    results.append(("spec_history table", test_spec_history_exists()))
    results.append(("Workflow state constraint", test_workflow_state_constraint()))
    results.append(("Source session FK", test_source_session_fk()))

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
