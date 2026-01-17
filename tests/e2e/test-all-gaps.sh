#!/bin/bash
# Master test script for Build Agent Gap Remediation
# Run: bash tests/e2e/test-all-gaps.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "BUILD AGENT GAP REMEDIATION - TEST SUITE"
echo "========================================"
echo ""

PASSED=0
FAILED=0

run_test() {
    local name=$1
    local script=$2

    echo "----------------------------------------"
    echo "Running: $name"
    echo "----------------------------------------"

    if python3 "$script"; then
        ((PASSED++)) || true
    else
        ((FAILED++)) || true
    fi
    echo ""
}

# Phase 1: Critical
run_test "GAP-001: Per-Task Validation" "tests/e2e/test-gap-001-validation-commands.py"
run_test "GAP-002: Acceptance Criteria" "tests/e2e/test-gap-002-acceptance-criteria.py"

# Phase 2: High Priority
run_test "GAP-003: Multi-Level Tests" "tests/e2e/test-gap-003-multi-level-tests.py"
run_test "GAP-004: Context Handoff" "tests/e2e/test-gap-004-context-handoff.py"

# Phase 3: Medium Priority
run_test "GAP-005: Iterate/Refine Loop" "tests/e2e/test-gap-005-retry-loop.py"
run_test "GAP-006: SIA Integration" "tests/e2e/test-gap-006-sia-integration.py"

echo "========================================"
echo "FINAL RESULTS"
echo "========================================"
echo "Test Suites Passed:  $PASSED"
echo "Test Suites Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ ALL GAP TESTS PASSED!"
    exit 0
else
    echo "✗ SOME GAP TESTS FAILED - See output above"
    exit 1
fi
