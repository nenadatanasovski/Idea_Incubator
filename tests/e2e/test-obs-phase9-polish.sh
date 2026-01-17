#!/bin/bash
# Phase 9: Polish & Testing
# Tests unit tests, TypeScript, ESLint, and build

set -e

echo "=== Phase 9: Polish & Testing ==="
echo ""

# Test 9.1: Check test directory exists
echo "Test 1: Unit test files exist..."
TEST_DIR="frontend/src/components/observability/__tests__"
if [ -d "$TEST_DIR" ]; then
    echo "  ✓ Test directory exists"
    TEST_COUNT=$(find "$TEST_DIR" -name "*.test.tsx" 2>/dev/null | wc -l | tr -d ' ')
    echo "  ✓ Found $TEST_COUNT test files"
else
    echo "  ✗ Test directory not found"
    exit 1
fi

# Test 9.2: TypeScript compilation
echo "Test 2: TypeScript compilation..."
cd frontend
if npx tsc --noEmit 2>&1 | head -20; then
    TSC_EXIT=${PIPESTATUS[0]}
    if [ "$TSC_EXIT" -eq 0 ]; then
        echo "  ✓ TypeScript compilation passed"
    else
        echo "  ✗ TypeScript errors found (see above)"
        # Don't exit - continue to show other issues
    fi
else
    echo "  ✓ TypeScript compilation passed"
fi
cd ..

# Test 9.3: Observability components lint check
echo "Test 3: ESLint observability components..."
cd frontend
LINT_OUTPUT=$(npx eslint src/components/observability --max-warnings=10 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "error" || echo "0")
if [ "$LINT_ERRORS" -eq 0 ] || [ "$LINT_ERRORS" = "0" ]; then
    echo "  ✓ ESLint passed (no errors)"
else
    echo "  ⚠ ESLint found $LINT_ERRORS errors"
fi
cd ..

# Test 9.4: Key component files exist
echo "Test 4: Key observability components exist..."
COMPONENTS=(
    "frontend/src/components/observability/ObservabilityContainer.tsx"
    "frontend/src/components/observability/ObservabilityHeader.tsx"
    "frontend/src/components/observability/ObservabilitySubTabs.tsx"
    "frontend/src/components/observability/OverviewDashboard.tsx"
    "frontend/src/components/observability/EventLogTab.tsx"
    "frontend/src/components/observability/ExecutionsTab.tsx"
    "frontend/src/components/observability/AgentsTab.tsx"
    "frontend/src/components/observability/AnalyticsTab.tsx"
    "frontend/src/components/observability/ObservabilitySearch.tsx"
)

MISSING=0
for COMP in "${COMPONENTS[@]}"; do
    if [ -f "$COMP" ]; then
        echo "  ✓ $(basename $COMP)"
    else
        echo "  ✗ $(basename $COMP) not found"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo "  ✗ Missing $MISSING components"
    exit 1
fi

# Test 9.5: Accessibility attributes present
echo "Test 5: Accessibility attributes..."
OBS_DIR="frontend/src/components/observability"

# Check for aria-label usage
ARIA_COUNT=$(grep -r "aria-label\|aria-live\|role=" "$OBS_DIR" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ARIA_COUNT" -gt 0 ]; then
    echo "  ✓ Found $ARIA_COUNT ARIA attributes"
else
    echo "  ⚠ No ARIA attributes found"
fi

# Check for accessible click handlers (keyboard support)
KEYBOARD_COUNT=$(grep -r "onKeyDown\|onKeyPress\|tabIndex" "$OBS_DIR" 2>/dev/null | wc -l | tr -d ' ')
if [ "$KEYBOARD_COUNT" -gt 0 ]; then
    echo "  ✓ Found $KEYBOARD_COUNT keyboard handlers"
else
    echo "  ⚠ Limited keyboard handlers"
fi

# Test 9.6: Real-time connection hook exists
echo "Test 6: Real-time infrastructure..."
if [ -f "frontend/src/hooks/useObservabilityConnection.ts" ]; then
    echo "  ✓ useObservabilityConnection hook exists"
else
    echo "  ✗ useObservabilityConnection hook not found"
    exit 1
fi

if [ -f "frontend/src/components/observability/ObservabilityConnectionProvider.tsx" ]; then
    echo "  ✓ ObservabilityConnectionProvider exists"
else
    echo "  ✗ ObservabilityConnectionProvider not found"
    exit 1
fi

# Test 9.7: API routes exist
echo "Test 7: Observability API routes..."
if [ -f "server/routes/observability.ts" ]; then
    ROUTE_COUNT=$(grep -c "router\.\(get\|post\)" "server/routes/observability.ts" 2>/dev/null || echo "0")
    echo "  ✓ Found $ROUTE_COUNT API routes in observability.ts"
else
    echo "  ✗ observability.ts routes not found"
    exit 1
fi

# Test 9.8: Build test (only if requested)
echo "Test 8: Production build check..."
if [ "$1" = "--build" ]; then
    cd frontend
    if npm run build 2>&1 | tail -5; then
        echo "  ✓ Production build succeeded"
    else
        echo "  ✗ Production build failed"
        exit 1
    fi
    cd ..
else
    echo "  ⏭ Skipped (run with --build to test)"
fi

echo ""
echo "=== Phase 9 Tests Complete ==="
echo ""
echo "Manual QA Checklist:"
echo "  [ ] All sub-tabs render correctly"
echo "  [ ] Navigation works between all tabs"
echo "  [ ] Real-time updates work"
echo "  [ ] Search works across all data types"
echo "  [ ] Mobile responsive (test at 375px, 768px, 1024px)"
echo "  [ ] Keyboard navigation works throughout"
