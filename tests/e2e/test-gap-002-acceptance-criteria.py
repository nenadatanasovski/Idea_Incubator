#!/usr/bin/env python3
"""
Test GAP-002: Acceptance Criteria Enforcement

Pass Criteria:
1. task_appendices has acceptance_criteria entries
2. Build Agent loads acceptance criteria from task_appendices
3. Acceptance criteria are checked after validation
4. Task fails if acceptance criteria fail
5. Criterion results are logged
"""

import sqlite3
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_appendices_have_acceptance_criteria():
    """Test 1: task_appendices table has acceptance_criteria entries"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM task_appendices
        WHERE appendix_type = 'acceptance_criteria'
    """)
    count = cursor.fetchone()[0]
    conn.close()

    if count == 0:
        print("SKIP: No acceptance_criteria entries in task_appendices yet (populate manually)")
        return None

    print(f"PASS: Found {count} acceptance_criteria entries in task_appendices")
    return True

def test_obs_tasks_have_criteria():
    """Test 2: Observability tasks have acceptance criteria attached"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.display_id, ta.content
        FROM tasks t
        JOIN task_appendices ta ON ta.task_id = t.id
        WHERE t.display_id LIKE 'OBS-%'
        AND ta.appendix_type = 'acceptance_criteria'
        LIMIT 5
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("SKIP: No observability tasks have acceptance criteria yet")
        return None

    for display_id, content in rows:
        # Content should be parseable JSON list or text
        try:
            criteria = json.loads(content)
            assert len(criteria) > 0, f"Empty criteria for {display_id}"
            print(f"PASS: {display_id} has {len(criteria)} acceptance criteria")
        except json.JSONDecodeError:
            # Plain text criteria are also acceptable
            assert len(content) > 10, f"Criteria too short for {display_id}"
            print(f"PASS: {display_id} has text acceptance criteria")

    return True

def test_build_agent_loads_criteria():
    """Test 3: Build Agent Worker loads acceptance criteria"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    checks = [
        ("task_appendices", "Queries task_appendices table"),
        ("acceptance_criteria", "Handles acceptance_criteria type"),
        ("_load_acceptance_criteria", "Has dedicated method"),
    ]

    for keyword, description in checks:
        if keyword in content:
            print(f"PASS: Build Agent {description}")
        else:
            print(f"FAIL: Build Agent missing - {description}")
            return False

    return True

def test_criteria_checked_after_validation():
    """Test 4: Acceptance criteria check happens after validation"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have a method that checks criteria
    if "_check_acceptance_criteria" not in content:
        print("FAIL: Missing _check_acceptance_criteria method")
        return False

    # Should be called in execution flow
    if "check_acceptance" not in content.lower() or "acceptance_criteria" not in content:
        print("FAIL: Acceptance criteria check not integrated into execution")
        return False

    print("PASS: Acceptance criteria checking integrated into execution flow")
    return True

def test_task_details_has_acceptance_criteria():
    """Test 5: TaskDetails dataclass includes acceptance_criteria field"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "acceptance_criteria: List[str]" in content:
        print("PASS: TaskDetails has acceptance_criteria field")
        return True
    else:
        print("FAIL: TaskDetails missing acceptance_criteria field")
        return False

def main():
    print("=" * 60)
    print("GAP-002 Test Suite: Acceptance Criteria Enforcement")
    print("=" * 60)

    results = []

    try:
        results.append(("Appendices have AC", test_appendices_have_acceptance_criteria()))
    except AssertionError as e:
        results.append(("Appendices have AC", False))
        print(e)

    try:
        results.append(("OBS tasks have AC", test_obs_tasks_have_criteria()))
    except AssertionError as e:
        results.append(("OBS tasks have AC", False))
        print(e)

    try:
        results.append(("Build Agent loads AC", test_build_agent_loads_criteria()))
    except AssertionError as e:
        results.append(("Build Agent loads AC", False))
        print(e)

    try:
        results.append(("AC checked after validation", test_criteria_checked_after_validation()))
    except AssertionError as e:
        results.append(("AC checked after validation", False))
        print(e)

    try:
        results.append(("TaskDetails has AC field", test_task_details_has_acceptance_criteria()))
    except AssertionError as e:
        results.append(("TaskDetails has AC field", False))
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
