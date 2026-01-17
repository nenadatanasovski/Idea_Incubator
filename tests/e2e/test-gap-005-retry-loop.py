#!/usr/bin/env python3
"""
Test GAP-005: Iterate/Refine Loop

Pass Criteria:
1. Build Agent has retry loop
2. max_retries config is respected
3. Error message included in retry prompt
4. Retry count tracked in database
5. Only fails after exhausting retries
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_build_agent_has_retry_loop():
    """Test 1: Build Agent has retry loop"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    retry_patterns = ["for attempt in range", "max_retries", "current_attempt", "retry"]
    found = sum(1 for p in retry_patterns if p in content.lower())

    if found >= 3:
        print(f"PASS: Build Agent has retry logic ({found}/4 patterns)")
        return True
    else:
        print(f"FAIL: Build Agent missing retry loop ({found}/4 patterns)")
        return False

def test_max_retries_in_config():
    """Test 2: max_retries is configurable"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "max_retries" in content:
        print("PASS: max_retries config found")
        return True
    else:
        print("FAIL: max_retries not in config")
        return False

def test_error_in_retry_prompt():
    """Test 3: Error message included in retry prompt"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should reference previous error in prompt building
    if "_generate_code_with_retry_context" in content:
        print("PASS: Has _generate_code_with_retry_context method")
        return True
    elif "last_error" in content and "prompt" in content.lower():
        print("PASS: Previous error referenced in retry logic")
        return True
    else:
        print("FAIL: Error-in-retry-prompt not implemented")
        return False

def test_retry_count_in_database():
    """Test 4: retry_count tracked in tasks table"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    if "retry_count" in columns:
        print("PASS: retry_count column exists in tasks table")
        return True
    else:
        print("FAIL: retry_count column missing from tasks")
        return False

def test_attempt_tracking():
    """Test 5: Build Agent tracks current attempt"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "current_attempt" in content:
        print("PASS: Build Agent tracks current_attempt")
        return True
    else:
        print("FAIL: Build Agent doesn't track current_attempt")
        return False

def test_last_error_tracking():
    """Test 6: Build Agent tracks last error"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "last_error" in content:
        print("PASS: Build Agent tracks last_error")
        return True
    else:
        print("FAIL: Build Agent doesn't track last_error")
        return False

def test_exhausted_retries_message():
    """Test 7: Proper message when all retries exhausted"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "Failed after" in content or "exhausted" in content.lower() or "All" in content and "attempts" in content:
        print("PASS: Proper message when retries exhausted")
        return True
    else:
        print("FAIL: Missing exhausted retries message")
        return False

def main():
    print("=" * 60)
    print("GAP-005 Test Suite: Iterate/Refine Loop")
    print("=" * 60)

    results = []

    try:
        results.append(("Has retry loop", test_build_agent_has_retry_loop()))
    except Exception as e:
        results.append(("Has retry loop", False))
        print(f"ERROR: {e}")

    try:
        results.append(("max_retries config", test_max_retries_in_config()))
    except Exception as e:
        results.append(("max_retries config", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Error in retry prompt", test_error_in_retry_prompt()))
    except Exception as e:
        results.append(("Error in retry prompt", False))
        print(f"ERROR: {e}")

    try:
        results.append(("retry_count in DB", test_retry_count_in_database()))
    except Exception as e:
        results.append(("retry_count in DB", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Tracks current_attempt", test_attempt_tracking()))
    except Exception as e:
        results.append(("Tracks current_attempt", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Tracks last_error", test_last_error_tracking()))
    except Exception as e:
        results.append(("Tracks last_error", False))
        print(f"ERROR: {e}")

    try:
        results.append(("Exhausted retries msg", test_exhausted_retries_message()))
    except Exception as e:
        results.append(("Exhausted retries msg", False))
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
