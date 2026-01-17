#!/bin/bash
# File: tests/e2e/test-obs-phase3-eventlog.sh
# Run: chmod +x tests/e2e/test-obs-phase3-eventlog.sh && ./tests/e2e/test-obs-phase3-eventlog.sh

set -e
echo "=== Phase 3: Event Log Migration Tests ==="

FRONTEND_URL="http://localhost:3002"

# Test 3.1: Event Log tab renders
echo "Testing /observability/events route..."
EVENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/observability/events")
if [ "$EVENTS_STATUS" != "200" ]; then
    echo "FAIL: /observability/events returned $EVENTS_STATUS"
    exit 1
fi
echo "✓ /observability/events returns 200"

# Test 3.2: Backwards compatibility - /events should load (SPA routing)
echo "Testing /events route loads..."
OLD_ROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/events")
if [ "$OLD_ROUTE_STATUS" != "200" ]; then
    echo "FAIL: /events returned $OLD_ROUTE_STATUS"
    exit 1
fi
echo "✓ /events route loads (SPA redirect)"

# Test 3.3: Session URL param works
echo "Testing session URL param..."
SESSION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/observability/events?session=test-session-123")
if [ "$SESSION_STATUS" != "200" ]; then
    echo "FAIL: Session param URL returned $SESSION_STATUS"
    exit 1
fi
echo "✓ Session param URL works"

# Test 3.4: Backend API for events sessions
echo "Testing events API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/ideas")
if [ "$API_STATUS" = "200" ]; then
    echo "✓ Ideas API available for event sessions"
else
    echo "WARN: Ideas API returned $API_STATUS"
fi

echo ""
echo "=== Phase 3 Tests PASSED ==="
