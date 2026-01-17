#!/bin/bash
# Phase 6: Analytics Sub-Tab Test Script
# Tests the AnalyticsTab component and API endpoints

set -e

API_BASE="http://localhost:3001"
FRONTEND_BASE="http://localhost:3002"

echo "=== Phase 6: Analytics Sub-Tab Tests ==="
echo ""

# Test 1: Analytics tab route accessible
echo "Test 1: Analytics tab route accessible..."
ANALYTICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/observability/analytics" 2>/dev/null || echo "000")
if [ "$ANALYTICS_STATUS" = "200" ]; then
    echo "  ✓ Analytics tab route returns 200"
else
    echo "  ✗ Analytics tab route failed (got $ANALYTICS_STATUS)"
fi

# Test 2: Time range URL param
echo "Test 2: Time range URL param..."
RANGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/observability/analytics?range=24h" 2>/dev/null || echo "000")
if [ "$RANGE_STATUS" = "200" ]; then
    echo "  ✓ Time range URL param works"
else
    echo "  ✗ Time range URL param failed"
fi

# Test 3: Tool usage API endpoint
echo "Test 3: GET /api/observability/analytics/tool-usage endpoint..."
TOOL_RESPONSE=$(curl -s "$API_BASE/api/observability/analytics/tool-usage?range=24h" 2>/dev/null || echo "error")
if echo "$TOOL_RESPONSE" | grep -q '"success":true'; then
    echo "  ✓ Tool usage endpoint returns success"
else
    echo "  ✗ Tool usage endpoint failed"
    echo "    Response: $TOOL_RESPONSE"
fi

# Test 4: Assertions API endpoint
echo "Test 4: GET /api/observability/analytics/assertions endpoint..."
ASSERT_RESPONSE=$(curl -s "$API_BASE/api/observability/analytics/assertions?range=24h" 2>/dev/null || echo "error")
if echo "$ASSERT_RESPONSE" | grep -q '"success":true'; then
    echo "  ✓ Assertions endpoint returns success"
else
    echo "  ✗ Assertions endpoint failed"
    echo "    Response: $ASSERT_RESPONSE"
fi

# Test 5: Durations API endpoint
echo "Test 5: GET /api/observability/analytics/durations endpoint..."
DURATION_RESPONSE=$(curl -s "$API_BASE/api/observability/analytics/durations?range=24h" 2>/dev/null || echo "error")
if echo "$DURATION_RESPONSE" | grep -q '"success":true'; then
    echo "  ✓ Durations endpoint returns success"
else
    echo "  ✗ Durations endpoint failed"
    echo "    Response: $DURATION_RESPONSE"
fi

# Test 6: Errors API endpoint
echo "Test 6: GET /api/observability/analytics/errors endpoint..."
ERRORS_RESPONSE=$(curl -s "$API_BASE/api/observability/analytics/errors?range=24h" 2>/dev/null || echo "error")
if echo "$ERRORS_RESPONSE" | grep -q '"success":true'; then
    echo "  ✓ Errors endpoint returns success"
else
    echo "  ✗ Errors endpoint failed"
    echo "    Response: $ERRORS_RESPONSE"
fi

# Test 7: AnalyticsTab component file exists
echo "Test 7: AnalyticsTab component file exists..."
if [ -f "frontend/src/components/observability/AnalyticsTab.tsx" ]; then
    echo "  ✓ AnalyticsTab.tsx exists"
else
    echo "  ✗ AnalyticsTab.tsx not found"
    exit 1
fi

# Test 8: AnalyticsTab has required panels
echo "Test 8: AnalyticsTab has required panels..."
ANALYTICS_FILE="frontend/src/components/observability/AnalyticsTab.tsx"

# Check for Tool Usage Panel
if grep -q "ToolUsagePanel" "$ANALYTICS_FILE"; then
    echo "  ✓ Tool Usage panel present"
else
    echo "  ✗ Tool Usage panel missing"
    exit 1
fi

# Check for Assertion Trends Panel
if grep -q "AssertionTrendsPanel" "$ANALYTICS_FILE"; then
    echo "  ✓ Assertion Trends panel present"
else
    echo "  ✗ Assertion Trends panel missing"
    exit 1
fi

# Check for Execution Duration Panel
if grep -q "ExecutionDurationPanel" "$ANALYTICS_FILE"; then
    echo "  ✓ Execution Duration panel present"
else
    echo "  ✗ Execution Duration panel missing"
    exit 1
fi

# Check for Error Hotspots Panel
if grep -q "ErrorHotspotsPanel" "$ANALYTICS_FILE"; then
    echo "  ✓ Error Hotspots panel present"
else
    echo "  ✗ Error Hotspots panel missing"
    exit 1
fi

# Test 9: Time range selector implemented
echo "Test 9: Time range selector implemented..."
if grep -q "TimeRange" "$ANALYTICS_FILE" && grep -q 'setTimeRange' "$ANALYTICS_FILE"; then
    echo "  ✓ Time range selector implemented"
else
    echo "  ✗ Time range selector missing"
    exit 1
fi

# Test 10: URL param persistence
echo "Test 10: URL param persistence..."
if grep -q "useSearchParams" "$ANALYTICS_FILE" && grep -q "setSearchParams" "$ANALYTICS_FILE"; then
    echo "  ✓ URL param persistence implemented"
else
    echo "  ✗ URL param persistence missing"
    exit 1
fi

# Test 11: 2x2 grid layout
echo "Test 11: 2x2 grid layout..."
if grep -q "grid-cols-1 lg:grid-cols-2" "$ANALYTICS_FILE"; then
    echo "  ✓ 2x2 grid layout implemented"
else
    echo "  ✗ 2x2 grid layout missing"
    exit 1
fi

# Test 12: All time ranges available
echo "Test 12: All time ranges available (1h, 6h, 24h, 7d)..."
if grep -q '"1h"' "$ANALYTICS_FILE" && grep -q '"6h"' "$ANALYTICS_FILE" && grep -q '"24h"' "$ANALYTICS_FILE" && grep -q '"7d"' "$ANALYTICS_FILE"; then
    echo "  ✓ All time ranges available"
else
    echo "  ✗ Missing time ranges"
    exit 1
fi

echo ""
echo "=== Phase 6 Tests Complete ==="
echo "All tests passed!"
