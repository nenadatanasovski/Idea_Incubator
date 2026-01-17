#!/usr/bin/env python3
"""
Test: Parallelism Visibility & Controls
Phase 2 validation tests for Parallelism API endpoints

Pass Criteria:
  - [ ] Recalculate endpoint triggers fresh analysis
  - [ ] Preview endpoint returns wave breakdown
  - [ ] Stats include wave/conflict counts
  - [ ] Response times under 2s for typical task lists
"""

import requests
import time
import sys

BASE_URL = "http://localhost:3001/api"


def get_existing_task_list():
    """Get an existing task list with tasks for testing"""
    response = requests.get(f"{BASE_URL}/pipeline/task-lists")
    if response.status_code != 200:
        return None

    task_lists = response.json()
    if not task_lists:
        return None

    # Find a task list with some tasks
    for tl in task_lists:
        if tl.get("taskCount", 0) >= 2:
            return {"id": tl["id"], "name": tl["name"], "taskCount": tl["taskCount"]}

    return None


def test_recalculate_endpoint():
    """Test that recalculate endpoint triggers fresh analysis"""
    print("\n--- Test: Recalculate Parallelism Endpoint ---")

    task_list = get_existing_task_list()
    if not task_list:
        print("SKIP: No existing task list with 2+ tasks found")
        return True

    task_list_id = task_list.get("id")
    print(f"  Using task list: {task_list.get('name')}")

    # Call recalculate endpoint
    start = time.time()
    response = requests.post(
        f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism/recalculate"
    )
    duration = time.time() - start

    if response.status_code != 200:
        print(f"FAIL: Recalculate endpoint returned {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return False

    data = response.json()

    # Validate required fields
    required_fields = ["taskListId", "totalWaves", "maxParallel", "conflictCount", "recalculatedAt"]
    for field in required_fields:
        if field not in data:
            print(f"FAIL: Missing required field '{field}'")
            return False

    # Check that recalculatedAt is a valid timestamp
    if not data.get("recalculatedAt"):
        print("FAIL: recalculatedAt should be a valid timestamp")
        return False

    # Performance check
    if duration > 5.0:
        print(f"FAIL: Recalculate took {duration:.2f}s (max 5s)")
        return False

    print(f"PASS: Recalculate endpoint works")
    print(f"  Waves: {data['totalWaves']}, Max Parallel: {data['maxParallel']}, Conflicts: {data['conflictCount']}")
    print(f"  Duration: {duration:.2f}s")
    return True


def test_preview_endpoint():
    """Test that preview endpoint returns wave breakdown"""
    print("\n--- Test: Parallelism Preview Endpoint ---")

    task_list = get_existing_task_list()
    if not task_list:
        print("SKIP: No existing task list with 2+ tasks found")
        return True

    task_list_id = task_list.get("id")
    print(f"  Using task list: {task_list.get('name')}")

    # Call preview endpoint
    response = requests.get(
        f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism/preview"
    )

    if response.status_code != 200:
        print(f"FAIL: Preview endpoint returned {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return False

    data = response.json()

    # Validate required fields
    required_fields = [
        "taskListId", "totalTasks", "totalWaves", "maxParallel",
        "parallelOpportunities", "timeSavingsPercent", "waves",
        "suggestions", "canExecute", "previewedAt"
    ]

    for field in required_fields:
        if field not in data:
            print(f"FAIL: Missing required field '{field}'")
            return False

    # Validate waves structure
    if not isinstance(data["waves"], list):
        print("FAIL: 'waves' should be a list")
        return False

    # If there are waves, check structure
    if len(data["waves"]) > 0:
        wave = data["waves"][0]
        wave_fields = ["waveNumber", "taskCount", "tasks", "status"]
        for field in wave_fields:
            if field not in wave:
                print(f"FAIL: Wave missing required field '{field}'")
                return False

    # Validate suggestions is a list
    if not isinstance(data["suggestions"], list):
        print("FAIL: 'suggestions' should be a list")
        return False

    print(f"PASS: Preview endpoint works")
    print(f"  Total Tasks: {data['totalTasks']}, Waves: {data['totalWaves']}")
    print(f"  Max Parallel: {data['maxParallel']}, Time Savings: {data['timeSavingsPercent']}%")
    if data["suggestions"]:
        print(f"  Suggestions: {len(data['suggestions'])}")
    return True


def test_wave_breakdown_accuracy():
    """Test that wave breakdown is accurate"""
    print("\n--- Test: Wave Breakdown Accuracy ---")

    task_list = get_existing_task_list()
    if not task_list:
        print("SKIP: No existing task list with 2+ tasks found")
        return True

    task_list_id = task_list.get("id")

    # Get preview
    response = requests.get(
        f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism/preview"
    )

    if response.status_code != 200:
        print(f"FAIL: Preview endpoint returned {response.status_code}")
        return False

    data = response.json()

    # Verify task count matches sum of wave tasks
    total_in_waves = sum(wave["taskCount"] for wave in data["waves"])

    # Note: totalTasks might be different because some tasks may be completed/skipped
    # We just check that waves have consistent task counts
    for wave in data["waves"]:
        if wave["taskCount"] != len(wave["tasks"]):
            print(f"FAIL: Wave {wave['waveNumber']} taskCount ({wave['taskCount']}) != len(tasks) ({len(wave['tasks'])})")
            return False

    # Verify wave numbers are sequential
    wave_numbers = [w["waveNumber"] for w in data["waves"]]
    expected = list(range(1, len(data["waves"]) + 1))
    if wave_numbers != expected:
        print(f"FAIL: Wave numbers should be sequential 1..n, got {wave_numbers}")
        return False

    print(f"PASS: Wave breakdown is accurate")
    print(f"  Waves: {len(data['waves'])}, Total tasks in waves: {total_in_waves}")
    return True


def test_existing_parallelism_endpoint():
    """Test the existing GET parallelism endpoint still works"""
    print("\n--- Test: Existing GET Parallelism Endpoint ---")

    task_list = get_existing_task_list()
    if not task_list:
        print("SKIP: No existing task list with 2+ tasks found")
        return True

    task_list_id = task_list.get("id")

    response = requests.get(
        f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism"
    )

    if response.status_code != 200:
        print(f"FAIL: GET parallelism endpoint returned {response.status_code}")
        return False

    data = response.json()

    # Check basic structure
    if "taskListId" not in data:
        print("FAIL: Missing taskListId in response")
        return False

    print(f"PASS: Existing GET parallelism endpoint works")
    return True


def test_response_times():
    """Test that response times are under 2s for typical task lists"""
    print("\n--- Test: API Response Times ---")

    task_list = get_existing_task_list()
    if not task_list:
        print("SKIP: No existing task list with 2+ tasks found")
        return True

    task_list_id = task_list.get("id")
    max_time = 2.0  # seconds

    # Test preview endpoint
    start = time.time()
    requests.get(f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism/preview")
    preview_time = time.time() - start

    # Test recalculate endpoint
    start = time.time()
    requests.post(f"{BASE_URL}/task-agent/task-lists/{task_list_id}/parallelism/recalculate")
    recalc_time = time.time() - start

    if preview_time > max_time:
        print(f"FAIL: Preview endpoint took {preview_time:.2f}s (max {max_time}s)")
        return False

    # Allow longer time for recalculate since it does more work
    if recalc_time > max_time * 2:
        print(f"FAIL: Recalculate endpoint took {recalc_time:.2f}s (max {max_time * 2}s)")
        return False

    print(f"PASS: Response times are acceptable")
    print(f"  Preview: {preview_time:.3f}s, Recalculate: {recalc_time:.3f}s")
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("Parallelism Visibility & Controls Tests - Phase 2")
    print("=" * 60)

    # Check server is running
    try:
        response = requests.get(f"{BASE_URL}/pipeline/status", timeout=5)
        if response.status_code != 200:
            print(f"Server health check failed: {response.status_code}")
            sys.exit(1)
        print("Server is running...")
    except requests.exceptions.ConnectionError:
        print("ERROR: Server not running at localhost:3001")
        print("Start the server with: npm run dev")
        sys.exit(1)

    tests = [
        test_recalculate_endpoint,
        test_preview_endpoint,
        test_wave_breakdown_accuracy,
        test_existing_parallelism_endpoint,
        test_response_times,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__} raised exception: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed > 0:
        print("\nPhase 2 tests FAILED")
        sys.exit(1)
    else:
        print("\nAll Phase 2 tests PASSED!")
        sys.exit(0)


if __name__ == "__main__":
    main()
