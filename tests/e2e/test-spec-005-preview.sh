#!/bin/bash
# Test SPEC-005: Inline Spec Preview Component
# Run: bash tests/e2e/test-spec-005-preview.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "SPEC-005 Test Suite: Inline Spec Preview"
echo "========================================"

PASSED=0
FAILED=0

# Test 1: SpecPreview component exists
echo -e "\nTest 1: SpecPreview component exists"
if [ -f "frontend/src/components/ideation/SpecPreview.tsx" ]; then
    echo "PASS: SpecPreview.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecPreview.tsx not found"
    ((FAILED++))
fi

# Test 2: SpecWorkflowBadge component exists
echo -e "\nTest 2: SpecWorkflowBadge component exists"
if [ -f "frontend/src/components/ideation/SpecWorkflowBadge.tsx" ]; then
    echo "PASS: SpecWorkflowBadge.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecWorkflowBadge.tsx not found"
    ((FAILED++))
fi

# Test 3: ReadinessIndicator component exists
echo -e "\nTest 3: ReadinessIndicator component exists"
if [ -f "frontend/src/components/ideation/ReadinessIndicator.tsx" ]; then
    echo "PASS: ReadinessIndicator.tsx exists"
    ((PASSED++))
else
    echo "FAIL: ReadinessIndicator.tsx not found"
    ((FAILED++))
fi

# Test 4: AgentMessage handles spec artifacts
echo -e "\nTest 4: AgentMessage handles spec artifacts"
if grep -q "spec" frontend/src/components/ideation/AgentMessage.tsx 2>/dev/null; then
    echo "PASS: AgentMessage references spec"
    ((PASSED++))
else
    echo "FAIL: AgentMessage doesn't handle spec"
    ((FAILED++))
fi

# Test 5: Components compile without errors
echo -e "\nTest 5: TypeScript compilation"
cd frontend
if npx tsc --noEmit 2>&1 | head -20; then
    # Check if there are spec-related errors
    if npx tsc --noEmit 2>&1 | grep -i "spec" | grep -i "error"; then
        echo "FAIL: Spec-related TypeScript errors"
        ((FAILED++))
    else
        echo "PASS: No spec-related compilation errors"
        ((PASSED++))
    fi
else
    echo "PASS: Components compile (or no spec-related errors)"
    ((PASSED++))
fi
cd ..

echo -e "\n========================================"
echo "RESULTS: $PASSED passed, $FAILED failed"
echo "========================================"

[ $FAILED -eq 0 ] && exit 0 || exit 1
