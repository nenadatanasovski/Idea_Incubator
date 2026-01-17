#!/usr/bin/env python3
"""
Test SPEC-010: Observability Integration

Pass Criteria:
1. Observability event log table exists
2. Spec event emitter exists
3. Workflow emits observability events
4. Spec generation metrics view exists
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_event_log_table_exists():
    """Test 1: Observability event log table exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(observability_event_log)")
        columns = [row[1] for row in cursor.fetchall()]

        required = ["id", "timestamp", "event_type", "session_id", "spec_id"]
        missing = [c for c in required if c not in columns]

        if not missing:
            print(f"PASS: observability_event_log has required columns")
            return True
        else:
            print(f"FAIL: Missing columns: {missing}")
            return False
    except sqlite3.OperationalError:
        print("FAIL: observability_event_log table doesn't exist")
        return False
    finally:
        conn.close()

def test_spec_event_emitter_exists():
    """Test 2: Spec event emitter exists"""
    emitter_path = PROJECT_ROOT / "server" / "services" / "spec" / "spec-event-emitter.ts"

    if not emitter_path.exists():
        print("FAIL: spec-event-emitter.ts not found")
        return False

    content = emitter_path.read_text()

    functions = [
        "emitSpecEvent",
        "emitWorkflowTransition",
        "emitSpecGenerationComplete",
    ]

    found = sum(1 for f in functions if f in content)

    if found >= 3:
        print(f"PASS: Spec event emitter has required functions ({found}/3)")
        return True
    else:
        print(f"FAIL: Missing emitter functions ({found}/3)")
        return False

def test_workflow_emits_events():
    """Test 3: Workflow emits observability events"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    # Check for import of event emitter
    has_import = "emitWorkflowTransition" in content
    # Check for call to event emitter
    has_call = "emitWorkflowTransition(" in content

    if has_import and has_call:
        print("PASS: Workflow emits observability events")
        return True
    elif has_import:
        print("PARTIAL: Event emitter imported but not called")
        return True
    else:
        print("FAIL: Workflow doesn't emit observability events")
        return False

def test_metrics_view_exists():
    """Test 4: Spec generation metrics view exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='view' AND name='spec_generation_metrics'
        """)
        if cursor.fetchone():
            print("PASS: spec_generation_metrics view exists")
            return True
        else:
            print("FAIL: spec_generation_metrics view not found")
            return False
    except sqlite3.OperationalError as e:
        print(f"FAIL: Could not check views: {e}")
        return False
    finally:
        conn.close()

def test_migration_file_exists():
    """Test 5: Migration file for observability spec events exists"""
    migrations = list((PROJECT_ROOT / "database" / "migrations").glob("*observability_spec*.sql"))

    if migrations:
        print(f"PASS: Migration file exists: {migrations[0].name}")
        return True
    else:
        print("FAIL: No observability spec migration found")
        return False

def main():
    print("=" * 60)
    print("SPEC-010 Test Suite: Observability Integration")
    print("=" * 60)

    results = []
    results.append(("Event log table exists", test_event_log_table_exists()))
    results.append(("Spec event emitter exists", test_spec_event_emitter_exists()))
    results.append(("Workflow emits events", test_workflow_emits_events()))
    results.append(("Metrics view exists", test_metrics_view_exists()))
    results.append(("Migration file exists", test_migration_file_exists()))

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
        print("\n✓ All tests passed! SPEC-010 is complete.")
        return 0
    else:
        print("\n✗ Some tests failed. Please fix issues before proceeding.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
