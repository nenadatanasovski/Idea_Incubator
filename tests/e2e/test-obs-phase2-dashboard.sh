#!/bin/bash
# File: tests/e2e/test-obs-phase2-dashboard.sh
# Run: chmod +x tests/e2e/test-obs-phase2-dashboard.sh && ./tests/e2e/test-obs-phase2-dashboard.sh

set -e
echo "=== Phase 2: Overview Dashboard Tests ==="

API_BASE="http://localhost:3001"

# Test 2.1: Stats endpoint exists and returns data
echo "Testing /api/observability/stats..."
STATS_RESPONSE=$(curl -s "$API_BASE/api/observability/stats")
if ! echo "$STATS_RESPONSE" | grep -q '"success":true'; then
    echo "FAIL: Stats endpoint did not return success"
    echo "Response: $STATS_RESPONSE"
    exit 1
fi
echo "✓ Stats endpoint returns success"

# Verify stats fields exist
for field in activeExecutions errorRate blockedAgents pendingQuestions lastUpdated; do
    if ! echo "$STATS_RESPONSE" | grep -q "\"$field\""; then
        echo "FAIL: Stats response missing field: $field"
        exit 1
    fi
    echo "✓ Stats has field: $field"
done

# Test 2.2: Health endpoint
echo "Testing /api/observability/health..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/api/observability/health")
if ! echo "$HEALTH_RESPONSE" | grep -q '"success":true'; then
    echo "FAIL: Health endpoint did not return success"
    exit 1
fi
echo "✓ Health endpoint returns success"

# Verify health fields
for field in status issues metrics lastUpdated; do
    if ! echo "$HEALTH_RESPONSE" | grep -q "\"$field\""; then
        echo "FAIL: Health response missing field: $field"
        exit 1
    fi
    echo "✓ Health has field: $field"
done

# Test 2.3: Activity endpoint
echo "Testing /api/observability/activity..."
ACTIVITY_RESPONSE=$(curl -s "$API_BASE/api/observability/activity?limit=5")
if ! echo "$ACTIVITY_RESPONSE" | grep -q '"success":true'; then
    echo "FAIL: Activity endpoint did not return success"
    exit 1
fi
echo "✓ Activity endpoint returns success"

# Test 2.4: Frontend loads overview
echo "Testing frontend loads overview..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/observability)
if [ "$FRONTEND_STATUS" != "200" ]; then
    echo "FAIL: Overview page returned $FRONTEND_STATUS"
    exit 1
fi
echo "✓ Overview page loads"

echo ""
echo "=== Phase 2 Tests PASSED ==="
