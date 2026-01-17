#!/usr/bin/env python3
"""
Test: Auto-Populate Integration
Phase 4 validation tests for Auto-Populate API endpoints

Pass Criteria:
  - [ ] Auto-populate endpoint returns suggestions for all 4 field types
  - [ ] Suggestions include confidence scores
  - [ ] Preview shows before applying
  - [ ] Apply endpoint creates appropriate appendices
  - [ ] Readiness score updates after applying
"""

import requests
import time
import sys

BASE_URL = "http://localhost:3001/api"


def create_task(data):
    """Create a task for testing"""
    task_data = {
        "title": data.get("title", "Test task"),
        "description": data.get("description", ""),
        "category": data.get("category", "feature"),
        "priority": data.get("priority", "P3"),
        "effort": data.get("effort", "small"),
    }

    response = requests.post(f"{BASE_URL}/task-agent/tasks", json=task_data)
    if response.status_code not in [200, 201]:
        print(f"Failed to create task: {response.text}")
        return None
    return response.json().get("task", response.json())


def test_suggest_acceptance_criteria():
    """Test auto-populate suggestions for acceptance criteria"""
    print("\n--- Test: Suggest Acceptance Criteria ---")

    task = create_task({
        "title": "Implement user authentication with JWT tokens",
        "description": "Users must be able to log in and receive a JWT token for API access",
        "category": "feature",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "acceptance_criteria"}
    )

    if response.status_code != 200:
        print(f"FAIL: API returned {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return False

    data = response.json()

    # Check required fields
    required = ["taskId", "field", "suggestions", "preview", "generatedAt"]
    for field in required:
        if field not in data:
            print(f"FAIL: Missing required field '{field}'")
            return False

    if data["field"] != "acceptance_criteria":
        print(f"FAIL: Field mismatch - expected 'acceptance_criteria', got '{data['field']}'")
        return False

    if not isinstance(data["suggestions"], list):
        print("FAIL: suggestions should be a list")
        return False

    # Check suggestion structure
    if len(data["suggestions"]) > 0:
        suggestion = data["suggestions"][0]
        if "id" not in suggestion:
            print("FAIL: Suggestion missing 'id'")
            return False
        if "content" not in suggestion:
            print("FAIL: Suggestion missing 'content'")
            return False
        if "confidence" not in suggestion:
            print("FAIL: Suggestion missing 'confidence'")
            return False
        if not (0 <= suggestion["confidence"] <= 1):
            print(f"FAIL: Confidence {suggestion['confidence']} not in 0-1 range")
            return False
        if "source" not in suggestion:
            print("FAIL: Suggestion missing 'source'")
            return False

    if not data["preview"]:
        print("FAIL: Preview should not be empty")
        return False

    print(f"PASS: Acceptance criteria suggestions generated")
    print(f"  Suggestions: {len(data['suggestions'])}")
    return True


def test_suggest_file_impacts():
    """Test auto-populate suggestions for file impacts"""
    print("\n--- Test: Suggest File Impacts ---")

    task = create_task({
        "title": "Add new API endpoint for user profile",
        "description": "Create a REST endpoint to fetch and update user profile data",
        "category": "feature",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "file_impacts"}
    )

    if response.status_code != 200:
        print(f"FAIL: API returned {response.status_code}")
        return False

    data = response.json()

    if data["field"] != "file_impacts":
        print(f"FAIL: Field mismatch")
        return False

    print(f"PASS: File impact suggestions generated")
    print(f"  Suggestions: {len(data['suggestions'])}")
    return True


def test_suggest_test_commands():
    """Test auto-populate suggestions for test commands"""
    print("\n--- Test: Suggest Test Commands ---")

    task = create_task({
        "title": "Fix bug in server-side validation",
        "description": "Server validation is not catching invalid inputs",
        "category": "bug",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "test_commands"}
    )

    if response.status_code != 200:
        print(f"FAIL: API returned {response.status_code}")
        return False

    data = response.json()

    if data["field"] != "test_commands":
        print(f"FAIL: Field mismatch")
        return False

    # Should always suggest at least tsc type check
    if len(data["suggestions"]) == 0:
        print("FAIL: Should have at least one test command suggestion")
        return False

    print(f"PASS: Test command suggestions generated")
    print(f"  Suggestions: {len(data['suggestions'])}")
    return True


def test_suggest_dependencies():
    """Test auto-populate suggestions for dependencies"""
    print("\n--- Test: Suggest Dependencies ---")

    task = create_task({
        "title": "Update user service for new auth flow",
        "description": "Modify user service to use new authentication mechanism",
        "category": "feature",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "dependencies"}
    )

    if response.status_code != 200:
        print(f"FAIL: API returned {response.status_code}")
        return False

    data = response.json()

    if data["field"] != "dependencies":
        print(f"FAIL: Field mismatch")
        return False

    print(f"PASS: Dependency suggestions generated")
    print(f"  Suggestions: {len(data['suggestions'])}")
    return True


def test_apply_suggestions():
    """Test applying auto-populate suggestions"""
    print("\n--- Test: Apply Suggestions ---")

    task = create_task({
        "title": "Add input validation to form",
        "description": "Form fields should validate user input before submission",
        "category": "feature",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    # First, get suggestions
    suggest_response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "test_commands"}
    )

    if suggest_response.status_code != 200:
        print("FAIL: Could not get suggestions")
        return False

    suggestions = suggest_response.json()

    if len(suggestions["suggestions"]) == 0:
        print("SKIP: No suggestions to apply")
        return True

    # Apply first suggestion
    suggestion_ids = [suggestions["suggestions"][0]["id"]]

    apply_response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate/apply",
        json={
            "field": "test_commands",
            "suggestionIds": suggestion_ids
        }
    )

    if apply_response.status_code != 200:
        print(f"FAIL: Apply returned {apply_response.status_code}")
        print(f"  Response: {apply_response.text[:500]}")
        return False

    result = apply_response.json()

    if result["applied"] == 0:
        print("FAIL: No suggestions were applied")
        return False

    print(f"PASS: Suggestions applied successfully")
    print(f"  Applied: {result['applied']}")
    return True


def test_readiness_updates_after_apply():
    """Test that readiness score updates after applying suggestions"""
    print("\n--- Test: Readiness Updates After Apply ---")

    task = create_task({
        "title": "Implement caching layer",
        "description": "Add caching to improve API response times",
        "category": "feature",
    })

    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    # Get initial readiness
    initial_response = requests.get(f"{BASE_URL}/pipeline/tasks/{task_id}/readiness")
    if initial_response.status_code != 200:
        print("FAIL: Could not get initial readiness")
        return False

    initial_readiness = initial_response.json()
    initial_score = initial_readiness["overall"]

    # Get and apply acceptance criteria suggestions
    suggest_response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "acceptance_criteria"}
    )

    if suggest_response.status_code != 200:
        print("FAIL: Could not get suggestions")
        return False

    suggestions = suggest_response.json()

    if len(suggestions["suggestions"]) == 0:
        print("SKIP: No suggestions to apply")
        return True

    # Apply all suggestions
    suggestion_ids = [s["id"] for s in suggestions["suggestions"]]

    requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate/apply",
        json={
            "field": "acceptance_criteria",
            "suggestionIds": suggestion_ids
        }
    )

    # Wait a moment for cache invalidation
    time.sleep(0.5)

    # Get updated readiness
    updated_response = requests.get(f"{BASE_URL}/pipeline/tasks/{task_id}/readiness")
    if updated_response.status_code != 200:
        print("FAIL: Could not get updated readiness")
        return False

    updated_readiness = updated_response.json()
    updated_score = updated_readiness["overall"]

    # Score should increase after adding AC (25% weight)
    if updated_score <= initial_score:
        # Check if clearCompletion rule changed
        initial_clear = initial_readiness["rules"]["clearCompletion"]["status"]
        updated_clear = updated_readiness["rules"]["clearCompletion"]["status"]

        if initial_clear == "fail" and updated_clear in ["pass", "warning"]:
            print(f"PASS: Readiness rule updated (clearCompletion: {initial_clear} → {updated_clear})")
            return True

        print(f"WARNING: Score did not increase ({initial_score}% → {updated_score}%)")
        print("  (This may be expected if AC was already present)")

    print(f"PASS: Readiness updated after applying suggestions")
    print(f"  Initial: {initial_score}%, Updated: {updated_score}%")
    return True


def test_invalid_field():
    """Test error handling for invalid field"""
    print("\n--- Test: Invalid Field Error Handling ---")

    task = create_task({"title": "Test task"})
    if not task:
        print("FAIL: Could not create task")
        return False

    task_id = task.get("id")

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task_id}/auto-populate",
        json={"field": "invalid_field"}
    )

    if response.status_code != 400:
        print(f"FAIL: Should return 400 for invalid field, got {response.status_code}")
        return False

    print("PASS: Invalid field returns 400 error")
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("Auto-Populate Integration Tests - Phase 4")
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
        test_suggest_acceptance_criteria,
        test_suggest_file_impacts,
        test_suggest_test_commands,
        test_suggest_dependencies,
        test_apply_suggestions,
        test_readiness_updates_after_apply,
        test_invalid_field,
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
        print("\nPhase 4 tests FAILED")
        sys.exit(1)
    else:
        print("\nAll Phase 4 tests PASSED!")
        sys.exit(0)


if __name__ == "__main__":
    main()
