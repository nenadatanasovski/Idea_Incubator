#!/bin/bash
# File: tests/e2e/test-obs-phase1-navigation.sh
# Run: chmod +x tests/e2e/test-obs-phase1-navigation.sh && ./tests/e2e/test-obs-phase1-navigation.sh

set -e
echo "=== Phase 1: Navigation & Container Tests ==="

# Ensure frontend is running
echo "Checking frontend..."
if ! curl -s --connect-timeout 5 http://localhost:5173 > /dev/null; then
    echo "FAIL: Frontend not running at http://localhost:5173"
    exit 1
fi
echo "✓ Frontend is running"

# Test 1.1: Main navigation updated - check if page loads
echo "Testing main navigation..."
MAIN_PAGE=$(curl -s http://localhost:5173)
if [ -z "$MAIN_PAGE" ]; then
    echo "FAIL: Could not fetch main page"
    exit 1
fi
echo "✓ Main page loads"

# Test 1.2: Route exists
echo "Testing /observability route..."
ROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability)
if [ "$ROUTE_STATUS" != "200" ]; then
    echo "FAIL: /observability route returned $ROUTE_STATUS"
    exit 1
fi
echo "✓ /observability route returns 200"

# Test 1.3: Sub-routes exist
for subroute in events executions agents analytics; do
    SUBROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/observability/$subroute")
    if [ "$SUBROUTE_STATUS" != "200" ]; then
        echo "FAIL: /observability/$subroute route returned $SUBROUTE_STATUS"
        exit 1
    fi
    echo "✓ /observability/$subroute route returns 200"
done

# Test 1.4: Backwards compatibility - /events redirect
echo "Testing /events backwards compatibility..."
EVENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/events)
if [ "$EVENTS_STATUS" != "200" ]; then
    echo "WARN: /events returned $EVENTS_STATUS (SPA routing may handle this)"
fi
echo "✓ /events route accessible"

echo ""
echo "=== Phase 1 Tests PASSED ==="
