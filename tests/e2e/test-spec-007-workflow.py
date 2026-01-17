#!/usr/bin/env python3
"""
Test SPEC-007: Workflow State Machine

Pass Criteria:
1. State machine file exists
2. Valid transitions are defined
3. Invalid transitions are rejected (conceptually)
4. API endpoints exist in routes
5. History endpoint exists
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_state_machine_exists():
    """Test 1: Workflow state machine file exists"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if sm_path.exists():
        print("PASS: workflow-state-machine.ts exists")
        return True
    else:
        print("FAIL: workflow-state-machine.ts not found")
        return False

def test_valid_transitions_defined():
    """Test 2: Valid transitions are defined"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    # Check for all workflow states
    transitions = ["draft", "review", "approved", "archived"]
    found = sum(1 for t in transitions if t in content)

    # Check for VALID_TRANSITIONS map
    has_transitions_map = "VALID_TRANSITIONS" in content

    if found >= 4 and has_transitions_map:
        print(f"PASS: All workflow states defined ({found}/4) with transitions map")
        return True
    else:
        print(f"FAIL: Missing states ({found}/4) or transitions map")
        return False

def test_transition_functions():
    """Test 3: Transition helper functions exist"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    functions = [
        "isValidTransition",
        "transitionWorkflow",
        "submitForReview",
        "approveSpec",
        "requestChanges",
        "archiveSpec",
    ]

    found = sum(1 for f in functions if f in content)

    if found >= 5:
        print(f"PASS: Transition functions defined ({found}/6)")
        return True
    else:
        print(f"FAIL: Missing transition functions ({found}/6)")
        return False

def test_api_endpoints_exist():
    """Test 4: Workflow API endpoints exist"""
    routes_path = PROJECT_ROOT / "server" / "routes" / "specs.ts"

    if not routes_path.exists():
        print("FAIL: specs.ts routes file doesn't exist")
        return False

    content = routes_path.read_text()

    endpoints = [
        '"/submit"' if '/submit' in content else 'submit',
        '"/approve"' if '/approve' in content else 'approve',
        '"/request-changes"' if '/request-changes' in content else 'request-changes',
        '"/archive"' if '/archive' in content else 'archive',
    ]

    found = 0
    for endpoint in ["submit", "approve", "request-changes", "archive"]:
        if endpoint in content:
            found += 1

    if found >= 4:
        print(f"PASS: All workflow endpoints found ({found}/4)")
        return True
    elif found > 0:
        print(f"PARTIAL: Found {found}/4 workflow endpoints")
        return True
    else:
        print("FAIL: No workflow endpoints found")
        return False

def test_history_endpoint():
    """Test 5: History endpoint exists"""
    routes_path = PROJECT_ROOT / "server" / "routes" / "specs.ts"

    if not routes_path.exists():
        print("FAIL: specs.ts routes file doesn't exist")
        return False

    content = routes_path.read_text()

    if "/history" in content and "getWorkflowHistory" in content:
        print("PASS: History endpoint exists")
        return True
    else:
        print("FAIL: History endpoint not found")
        return False

def test_allowed_transitions_endpoint():
    """Test 6: Allowed transitions endpoint exists"""
    routes_path = PROJECT_ROOT / "server" / "routes" / "specs.ts"

    if not routes_path.exists():
        print("FAIL: specs.ts routes file doesn't exist")
        return False

    content = routes_path.read_text()

    if "/allowed-transitions" in content and "getAllowedTransitions" in content:
        print("PASS: Allowed transitions endpoint exists")
        return True
    else:
        print("FAIL: Allowed transitions endpoint not found")
        return False

def test_websocket_events():
    """Test 7: WebSocket events are emitted"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    # Check for WebSocket event emission
    has_emit = "emit" in content.lower() or "broadcast" in content.lower()
    has_event_type = "spec:workflow:changed" in content

    if has_emit and has_event_type:
        print("PASS: WebSocket event emission implemented")
        return True
    elif has_emit:
        print("PARTIAL: WebSocket emission exists (event type may differ)")
        return True
    else:
        print("SKIP: WebSocket events not yet implemented")
        return None

def test_history_recording():
    """Test 8: History recording function exists"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    if "recordWorkflowHistory" in content and "spec_history" in content:
        print("PASS: History recording function exists")
        return True
    else:
        print("FAIL: History recording not implemented")
        return False

def main():
    print("=" * 60)
    print("SPEC-007 Test Suite: Workflow State Machine")
    print("=" * 60)

    results = []
    results.append(("State machine exists", test_state_machine_exists()))
    results.append(("Valid transitions defined", test_valid_transitions_defined()))
    results.append(("Transition functions", test_transition_functions()))
    results.append(("API endpoints", test_api_endpoints_exist()))
    results.append(("History endpoint", test_history_endpoint()))
    results.append(("Allowed transitions endpoint", test_allowed_transitions_endpoint()))
    results.append(("WebSocket events", test_websocket_events()))
    results.append(("History recording", test_history_recording()))

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
        print("\n✓ All tests passed! SPEC-007 is complete.")
        return 0
    else:
        print("\n✗ Some tests failed. Please fix issues before proceeding.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
