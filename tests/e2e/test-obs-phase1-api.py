#!/usr/bin/env python3
"""
Observability API Tests - Phase 1
Tests for /api/observability endpoints
"""

import requests
import sys

BASE_URL = "http://localhost:3001/api/observability"

def test_executions_list():
    """Test GET /api/observability/executions"""
    resp = requests.get(f"{BASE_URL}/executions")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "success" in data, "Response should have 'success' field"
    assert "data" in data, "Response should have 'data' field"
    # Response structure: { success, data: { data: [], total, limit, offset, hasMore } }
    assert "total" in data["data"], "Response data should have 'total' field"
    assert "data" in data["data"], "Response data should have 'data' array"
    print("  [PASS] GET /executions returns valid response")

def test_executions_pagination():
    """Test pagination on executions endpoint"""
    resp = requests.get(f"{BASE_URL}/executions?limit=5&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    # Access nested data array
    executions = data["data"]["data"]
    assert isinstance(executions, list), "Data should be a list"
    assert len(executions) <= 5, "Should respect limit parameter"
    print("  [PASS] Pagination works correctly")

def test_execution_detail_not_found():
    """Test GET /api/observability/executions/:id with invalid ID"""
    resp = requests.get(f"{BASE_URL}/executions/nonexistent-id-12345")
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    print("  [PASS] Returns 404 for non-existent execution")

def test_transcript_endpoint():
    """Test GET /api/observability/executions/:id/transcript"""
    # First get an execution ID if any exist
    resp = requests.get(f"{BASE_URL}/executions?limit=1")
    data = resp.json()
    executions = data["data"]["data"]

    if executions and len(executions) > 0:
        exec_id = executions[0]["id"]
        resp = requests.get(f"{BASE_URL}/executions/{exec_id}/transcript")
        assert resp.status_code == 200
        result = resp.json()
        assert "success" in result
        assert "data" in result
        print(f"  [PASS] Transcript endpoint works for execution {exec_id[:8]}...")
    else:
        print("  [SKIP] No executions available to test transcript")

def test_tool_uses_endpoint():
    """Test GET /api/observability/executions/:id/tool-uses"""
    resp = requests.get(f"{BASE_URL}/executions?limit=1")
    data = resp.json()
    executions = data["data"]["data"]

    if executions and len(executions) > 0:
        exec_id = executions[0]["id"]
        resp = requests.get(f"{BASE_URL}/executions/{exec_id}/tool-uses")
        assert resp.status_code == 200
        result = resp.json()
        assert "success" in result
        print(f"  [PASS] Tool uses endpoint works")
    else:
        print("  [SKIP] No executions available")

def test_assertions_endpoint():
    """Test GET /api/observability/executions/:id/assertions"""
    resp = requests.get(f"{BASE_URL}/executions?limit=1")
    data = resp.json()
    executions = data["data"]["data"]

    if executions and len(executions) > 0:
        exec_id = executions[0]["id"]
        resp = requests.get(f"{BASE_URL}/executions/{exec_id}/assertions")
        assert resp.status_code == 200
        result = resp.json()
        assert "success" in result
        print(f"  [PASS] Assertions endpoint works")
    else:
        print("  [SKIP] No executions available")

def test_tool_summary_endpoint():
    """Test GET /api/observability/executions/:id/tool-summary"""
    resp = requests.get(f"{BASE_URL}/executions?limit=1")
    data = resp.json()
    executions = data["data"]["data"]

    if executions and len(executions) > 0:
        exec_id = executions[0]["id"]
        resp = requests.get(f"{BASE_URL}/executions/{exec_id}/tool-summary")
        assert resp.status_code == 200
        result = resp.json()
        assert "success" in result
        print(f"  [PASS] Tool summary endpoint works")
    else:
        print("  [SKIP] No executions available")

def test_assertion_summary_endpoint():
    """Test GET /api/observability/executions/:id/assertion-summary"""
    resp = requests.get(f"{BASE_URL}/executions?limit=1")
    data = resp.json()
    executions = data["data"]["data"]

    if executions and len(executions) > 0:
        exec_id = executions[0]["id"]
        resp = requests.get(f"{BASE_URL}/executions/{exec_id}/assertion-summary")
        assert resp.status_code == 200
        result = resp.json()
        assert "success" in result
        print(f"  [PASS] Assertion summary endpoint works")
    else:
        print("  [SKIP] No executions available")

def test_message_bus_logs_endpoint():
    """Test GET /api/observability/logs/message-bus"""
    resp = requests.get(f"{BASE_URL}/logs/message-bus")
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data
    assert "data" in data
    print("  [PASS] Message bus logs endpoint works")

def main():
    print("\n=== Observability API Tests (Phase 1) ===\n")

    tests = [
        ("Executions List", test_executions_list),
        ("Executions Pagination", test_executions_pagination),
        ("Execution Not Found", test_execution_detail_not_found),
        ("Transcript Endpoint", test_transcript_endpoint),
        ("Tool Uses Endpoint", test_tool_uses_endpoint),
        ("Assertions Endpoint", test_assertions_endpoint),
        ("Tool Summary Endpoint", test_tool_summary_endpoint),
        ("Assertion Summary Endpoint", test_assertion_summary_endpoint),
        ("Message Bus Logs Endpoint", test_message_bus_logs_endpoint),
    ]

    passed = 0
    failed = 0
    skipped = 0

    for name, test_fn in tests:
        print(f"Testing: {name}")
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] {e}")
            failed += 1
        except requests.exceptions.ConnectionError:
            print(f"  [SKIP] Server not running")
            skipped += 1
        except Exception as e:
            print(f"  [ERROR] {e}")
            failed += 1

    print(f"\n=== Results: {passed} passed, {failed} failed, {skipped} skipped ===\n")

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
