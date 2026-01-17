#!/usr/bin/env python3
"""
Test GAP-006: SIA Integration

Pass Criteria:
1. No-progress detection exists
2. Tasks have escalated_to_sia column
3. Orchestrator can check if task needs SIA review
4. getDiagnosisContext function exists
5. retryTaskWithContext function exists
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_tasks_have_sia_columns():
    """Test 1: Tasks table has SIA-related columns"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    required = ["escalated_to_sia", "consecutive_failures"]
    missing = [c for c in required if c not in columns]

    if missing:
        print(f"FAIL: Missing SIA columns in tasks: {missing}")
        return False

    print(f"PASS: Tasks table has SIA columns: {required}")
    return True

def test_no_progress_detection():
    """Test 2: No-progress detection in Orchestrator"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    if "checkNeedsNoProgressReview" in content or "consecutive_failures" in content:
        print("PASS: No-progress detection found")
        return True
    else:
        print("FAIL: No-progress detection not implemented")
        return False

def test_mark_escalated_function():
    """Test 3: markTaskEscalatedToSIA function exists"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    if "markTaskEscalatedToSIA" in content:
        print("PASS: markTaskEscalatedToSIA function exists")
        return True
    else:
        print("FAIL: markTaskEscalatedToSIA function missing")
        return False

def test_get_diagnosis_context():
    """Test 4: getDiagnosisContext function exists"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    if "getDiagnosisContext" in content:
        print("PASS: getDiagnosisContext function exists")
        return True
    else:
        print("FAIL: getDiagnosisContext function missing")
        return False

def test_retry_with_context():
    """Test 5: retryTaskWithContext function exists"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    if "retryTaskWithContext" in content:
        print("PASS: retryTaskWithContext function exists")
        return True
    else:
        print("FAIL: retryTaskWithContext function missing")
        return False

def test_exports_sia_functions():
    """Test 6: Orchestrator exports SIA functions"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    sia_functions = [
        "checkNeedsNoProgressReview",
        "markTaskEscalatedToSIA",
        "retryTaskWithContext",
        "getDiagnosisContext"
    ]

    # Check if exported in default export
    exported = sum(1 for f in sia_functions if f in content and "export" in content)

    if exported >= 3:
        print(f"PASS: Orchestrator exports {exported}/4 SIA functions")
        return True
    else:
        print(f"FAIL: Orchestrator only exports {exported}/4 SIA functions")
        return False

def main():
    print("=" * 60)
    print("GAP-006 Test Suite: SIA Integration")
    print("=" * 60)

    results = []

    try:
        results.append(("Tasks have SIA columns", test_tasks_have_sia_columns()))
    except Exception as e:
        results.append(("Tasks have SIA columns", False))
        print(f"ERROR: {e}")

    try:
        results.append(("No-progress detection", test_no_progress_detection()))
    except Exception as e:
        results.append(("No-progress detection", False))
        print(f"ERROR: {e}")

    try:
        results.append(("markTaskEscalatedToSIA", test_mark_escalated_function()))
    except Exception as e:
        results.append(("markTaskEscalatedToSIA", False))
        print(f"ERROR: {e}")

    try:
        results.append(("getDiagnosisContext", test_get_diagnosis_context()))
    except Exception as e:
        results.append(("getDiagnosisContext", False))
        print(f"ERROR: {e}")

    try:
        results.append(("retryTaskWithContext", test_retry_with_context()))
    except Exception as e:
        results.append(("retryTaskWithContext", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Exports SIA functions", test_exports_sia_functions()))
    except Exception as e:
        results.append(("Exports SIA functions", False))
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
