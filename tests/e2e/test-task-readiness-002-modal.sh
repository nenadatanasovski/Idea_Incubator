#!/bin/bash
#
# Test: Task Completion Modal
# Phase 3 validation tests for Task Completion Modal components
#
# Pass Criteria:
#   - [ ] TaskCompletionModal.tsx component exists
#   - [ ] ReadinessIndicator.tsx component exists
#   - [ ] Components use readiness API endpoint
#   - [ ] Execute button disabled when readiness < 70%
#   - [ ] Missing items displayed correctly

set -e

echo "============================================================"
echo "Task Completion Modal Tests - Phase 3"
echo "============================================================"

PASSED=0
FAILED=0

# Test helper function
test_result() {
    local test_name=$1
    local result=$2
    if [ "$result" -eq 0 ]; then
        echo "PASS: $test_name"
        PASSED=$((PASSED + 1))
    else
        echo "FAIL: $test_name"
        FAILED=$((FAILED + 1))
    fi
}

echo ""
echo "--- Test: Component Files Exist ---"

# Check TaskCompletionModal.tsx exists
if [ -f "frontend/src/components/pipeline/TaskCompletionModal.tsx" ]; then
    test_result "TaskCompletionModal.tsx exists" 0
else
    test_result "TaskCompletionModal.tsx exists" 1
fi

# Check ReadinessIndicator.tsx exists
if [ -f "frontend/src/components/pipeline/ReadinessIndicator.tsx" ]; then
    test_result "ReadinessIndicator.tsx exists" 0
else
    test_result "ReadinessIndicator.tsx exists" 1
fi

# Check ParallelismControls.tsx exists (from Phase 2)
if [ -f "frontend/src/components/pipeline/ParallelismControls.tsx" ]; then
    test_result "ParallelismControls.tsx exists" 0
else
    test_result "ParallelismControls.tsx exists" 1
fi

# Check ParallelismPreview.tsx exists (from Phase 2)
if [ -f "frontend/src/components/pipeline/ParallelismPreview.tsx" ]; then
    test_result "ParallelismPreview.tsx exists" 0
else
    test_result "ParallelismPreview.tsx exists" 1
fi

echo ""
echo "--- Test: Component Uses Readiness API ---"

# Check TaskCompletionModal uses readiness endpoint
if grep -q "api/pipeline/tasks/.*readiness" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "TaskCompletionModal uses readiness API" 0
else
    test_result "TaskCompletionModal uses readiness API" 1
fi

# Check ReadinessIndicator uses readiness endpoint
if grep -q "api/pipeline/tasks/.*readiness" frontend/src/components/pipeline/ReadinessIndicator.tsx; then
    test_result "ReadinessIndicator uses readiness API" 0
else
    test_result "ReadinessIndicator uses readiness API" 1
fi

echo ""
echo "--- Test: Execute Button Logic ---"

# Check Execute button is conditionally disabled based on isReady
if grep -q 'disabled={!readiness?.isReady}' frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Execute button disabled when not ready" 0
else
    test_result "Execute button disabled when not ready" 1
fi

echo ""
echo "--- Test: Missing Items Display ---"

# Check missingItems is displayed
if grep -q "missingItems" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Missing items displayed in modal" 0
else
    test_result "Missing items displayed in modal" 1
fi

echo ""
echo "--- Test: Progress Bar Component ---"

# Check ReadinessProgressBar exists in modal
if grep -q "ReadinessProgressBar" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Readiness progress bar exists" 0
else
    test_result "Readiness progress bar exists" 1
fi

echo ""
echo "--- Test: Auto-Fill Button ---"

# Check Auto-Fill button exists
if grep -q "Auto-Fill" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Auto-Fill button exists" 0
else
    test_result "Auto-Fill button exists" 1
fi

echo ""
echo "--- Test: Manual Add Option ---"

# Check manual add option exists
if grep -q "Add manually" frontend/src/components/pipeline/TaskCompletionModal.tsx || \
   grep -q "onManualAdd" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Manual add option exists" 0
else
    test_result "Manual add option exists" 1
fi

echo ""
echo "--- Test: Status Icons ---"

# Check status icons (CheckCircle, XCircle, AlertCircle)
if grep -q "CheckCircle" frontend/src/components/pipeline/TaskCompletionModal.tsx && \
   grep -q "XCircle" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Status icons (pass/fail) included" 0
else
    test_result "Status icons (pass/fail) included" 1
fi

echo ""
echo "--- Test: High Priority Fields Marked ---"

# Check isHighPriority prop is used for AC and tests
if grep -q "isHighPriority" frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "High priority fields marked (25% weight)" 0
else
    test_result "High priority fields marked (25% weight)" 1
fi

echo ""
echo "--- Test: Data Testids Present ---"

# Check data-testid attributes for testing
if grep -q 'data-testid="task-completion-modal"' frontend/src/components/pipeline/TaskCompletionModal.tsx && \
   grep -q 'data-testid="execute-now-btn"' frontend/src/components/pipeline/TaskCompletionModal.tsx; then
    test_result "Data testids present for testing" 0
else
    test_result "Data testids present for testing" 1
fi

# Check ReadinessIndicator has data-testid
if grep -q 'data-testid="readiness-indicator"' frontend/src/components/pipeline/ReadinessIndicator.tsx; then
    test_result "ReadinessIndicator has data-testid" 0
else
    test_result "ReadinessIndicator has data-testid" 1
fi

echo ""
echo "============================================================"
echo "Results: $PASSED passed, $FAILED failed"
echo "============================================================"

if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "Phase 3 tests FAILED"
    exit 1
else
    echo ""
    echo "All Phase 3 tests PASSED!"
    exit 0
fi
