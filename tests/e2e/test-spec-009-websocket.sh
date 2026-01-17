#!/bin/bash
# Test SPEC-009: WebSocket Integration
# Run: bash tests/e2e/test-spec-009-websocket.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "SPEC-009 Test Suite: WebSocket Integration"
echo "========================================"

PASSED=0
FAILED=0

# Test 1: WebSocket handles spec events
echo -e "\nTest 1: WebSocket handles spec events"
if grep -q "spec:generating\|spec:generated\|spec:updated\|spec:workflow:changed\|readiness:update" server/websocket.ts 2>/dev/null; then
    echo "PASS: WebSocket handles spec events"
    ((PASSED++))
else
    echo "FAIL: WebSocket missing spec events"
    ((FAILED++))
fi

# Test 2: broadcastToSession function exists
echo -e "\nTest 2: broadcastToSession function exists"
if grep -q "export function broadcastToSession" server/websocket.ts 2>/dev/null; then
    echo "PASS: broadcastToSession function exists"
    ((PASSED++))
else
    echo "FAIL: broadcastToSession function not found"
    ((FAILED++))
fi

# Test 3: useSpec hook exists
echo -e "\nTest 3: useSpec hook exists"
if [ -f "frontend/src/hooks/useSpec.ts" ]; then
    echo "PASS: useSpec.ts exists"
    ((PASSED++))
else
    echo "FAIL: useSpec.ts not found"
    ((FAILED++))
fi

# Test 4: useSpec has required functions
echo -e "\nTest 4: useSpec has required functions"
SPEC_FUNCS=0
if [ -f "frontend/src/hooks/useSpec.ts" ]; then
    if grep -q "fetchSpec" frontend/src/hooks/useSpec.ts 2>/dev/null; then ((SPEC_FUNCS++)); fi
    if grep -q "updateSection" frontend/src/hooks/useSpec.ts 2>/dev/null; then ((SPEC_FUNCS++)); fi
    if grep -q "submitForReview" frontend/src/hooks/useSpec.ts 2>/dev/null; then ((SPEC_FUNCS++)); fi
    if grep -q "approve" frontend/src/hooks/useSpec.ts 2>/dev/null; then ((SPEC_FUNCS++)); fi
fi

if [ $SPEC_FUNCS -ge 4 ]; then
    echo "PASS: useSpec has required functions ($SPEC_FUNCS/4)"
    ((PASSED++))
else
    echo "FAIL: useSpec missing functions ($SPEC_FUNCS/4)"
    ((FAILED++))
fi

# Test 5: useReadiness hook exists
echo -e "\nTest 5: useReadiness hook exists"
if [ -f "frontend/src/hooks/useReadiness.ts" ]; then
    echo "PASS: useReadiness.ts exists"
    ((PASSED++))
else
    echo "FAIL: useReadiness.ts not found"
    ((FAILED++))
fi

# Test 6: useReadiness has debounce logic
echo -e "\nTest 6: useReadiness has debounce logic"
if [ -f "frontend/src/hooks/useReadiness.ts" ] && grep -q "debounce\|setTimeout" frontend/src/hooks/useReadiness.ts 2>/dev/null; then
    echo "PASS: useReadiness has debounce logic"
    ((PASSED++))
else
    echo "FAIL: useReadiness missing debounce logic"
    ((FAILED++))
fi

# Test 7: Reducer handles spec state
echo -e "\nTest 7: Reducer handles spec state"
SPEC_ACTIONS=$(grep -c "SPEC_" frontend/src/reducers/ideationReducer.ts 2>/dev/null || echo 0)
if [ "$SPEC_ACTIONS" -ge 5 ]; then
    echo "PASS: Reducer handles spec ($SPEC_ACTIONS spec actions)"
    ((PASSED++))
else
    echo "FAIL: Reducer missing spec handling ($SPEC_ACTIONS spec actions)"
    ((FAILED++))
fi

# Test 8: TypeScript compilation for hooks
echo -e "\nTest 8: TypeScript compilation for hooks"
cd frontend
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
HOOK_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "useSpec|useReadiness" | wc -l | tr -d ' ')
cd ..

if [ "$HOOK_ERRORS" -eq 0 ]; then
    echo "PASS: Hooks compile without errors"
    ((PASSED++))
else
    echo "FAIL: Hook TypeScript errors ($HOOK_ERRORS)"
    ((FAILED++))
fi

# Summary
echo -e "\n========================================"
echo "SPEC-009 Test Summary"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo -e "\n✓ All tests passed! SPEC-009 is complete."
    exit 0
else
    echo -e "\n✗ Some tests failed. Please fix issues before proceeding."
    exit 1
fi
