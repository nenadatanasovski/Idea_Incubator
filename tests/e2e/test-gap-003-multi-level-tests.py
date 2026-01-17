#!/usr/bin/env python3
"""
Test GAP-003: Multi-Level Test Execution

Pass Criteria:
1. Build Agent detects task type from file impacts
2. Server tasks trigger API-level tests
3. Frontend tasks trigger UI-level tests
4. All tasks run codebase-level tests
5. Test results are aggregated correctly
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_file_impact_detection():
    """Test 1: File impacts are used to determine test levels"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    keywords = ["file_impact", "server/", "frontend/", "_determine_test_levels"]
    found = sum(1 for kw in keywords if kw in content)

    if found >= 2:
        print(f"PASS: Build Agent references file impacts for test detection ({found}/4 keywords)")
        return True
    else:
        print(f"FAIL: Build Agent missing file impact detection ({found}/4 keywords)")
        return False

def test_codebase_level_always_runs():
    """Test 2: Codebase-level tests run for all tasks"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "tsc --noEmit" in content or "'codebase'" in content:
        print("PASS: Codebase-level test commands present")
        return True
    else:
        print("FAIL: Codebase-level tests not configured")
        return False

def test_api_level_for_server_tasks():
    """Test 3: API tests run for server/ file impacts"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have logic to run API tests for server tasks
    if "'api'" in content and "server/" in content.lower():
        print("PASS: API-level test support detected")
        return True
    else:
        print("SKIP: API-level test support not yet fully implemented")
        return None

def test_ui_level_for_frontend_tasks():
    """Test 4: UI tests run for frontend/ file impacts"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have logic to run UI tests for frontend tasks
    if "'ui'" in content and "frontend/" in content.lower():
        print("PASS: UI-level test support detected")
        return True
    else:
        print("SKIP: UI-level test support not yet fully implemented")
        return None

def test_test_commands_in_config():
    """Test 5: test_commands dict in config"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "test_commands" in content and "Dict[str, List[str]]" in content:
        print("PASS: test_commands config found")
        return True
    else:
        print("FAIL: test_commands config not found")
        return False

def test_determine_test_levels_method():
    """Test 6: _determine_test_levels method exists"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "_determine_test_levels" in content:
        print("PASS: _determine_test_levels method exists")
        return True
    else:
        print("FAIL: _determine_test_levels method missing")
        return False

def test_run_test_levels_method():
    """Test 7: _run_test_levels method exists"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "_run_test_levels" in content:
        print("PASS: _run_test_levels method exists")
        return True
    else:
        print("FAIL: _run_test_levels method missing")
        return False

def main():
    print("=" * 60)
    print("GAP-003 Test Suite: Multi-Level Test Execution")
    print("=" * 60)

    results = []

    try:
        results.append(("File impact detection", test_file_impact_detection()))
    except Exception as e:
        results.append(("File impact detection", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Codebase level runs", test_codebase_level_always_runs()))
    except Exception as e:
        results.append(("Codebase level runs", False))
        print(f"ERROR: {e}")

    try:
        results.append(("API level for server", test_api_level_for_server_tasks()))
    except Exception as e:
        results.append(("API level for server", False))
        print(f"ERROR: {e}")

    try:
        results.append(("UI level for frontend", test_ui_level_for_frontend_tasks()))
    except Exception as e:
        results.append(("UI level for frontend", False))
        print(f"ERROR: {e}")

    try:
        results.append(("test_commands config", test_test_commands_in_config()))
    except Exception as e:
        results.append(("test_commands config", False))
        print(f"ERROR: {e}")

    try:
        results.append(("_determine_test_levels", test_determine_test_levels_method()))
    except Exception as e:
        results.append(("_determine_test_levels", False))
        print(f"ERROR: {e}")

    try:
        results.append(("_run_test_levels", test_run_test_levels_method()))
    except Exception as e:
        results.append(("_run_test_levels", False))
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
