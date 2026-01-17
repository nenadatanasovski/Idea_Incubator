#!/bin/bash
# File: tests/e2e/test-obs-phase4-executions.sh
# Run: chmod +x tests/e2e/test-obs-phase4-executions.sh && ./tests/e2e/test-obs-phase4-executions.sh

set -e
echo "=== Phase 4: Executions Migration Tests ==="

FRONTEND_URL="http://localhost:3002"
API_URL="http://localhost:3001"

# Test 4.1: Executions tab renders
echo "Testing /observability/executions route..."
EXECUTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/observability/executions")
if [ "$EXECUTIONS_STATUS" != "200" ]; then
    echo "FAIL: /observability/executions returned $EXECUTIONS_STATUS"
    exit 1
fi
echo "✓ /observability/executions returns 200"

# Test 4.2: Executions API endpoint
echo "Testing executions API..."
API_RESPONSE=$(curl -s "$API_URL/api/observability/executions")
if ! echo "$API_RESPONSE" | grep -q '"success":true'; then
    echo "FAIL: Executions API did not return success"
    exit 1
fi
echo "✓ Executions API returns success"

# Test 4.3: Execution detail route
echo "Testing execution detail route pattern..."
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/observability/executions/test-id-123")
if [ "$DETAIL_STATUS" != "200" ]; then
    echo "FAIL: Execution detail route returned $DETAIL_STATUS"
    exit 1
fi
echo "✓ Execution detail route works"

# Test 4.4: Single execution API
echo "Testing single execution API..."
# This may return 404 for non-existent ID, which is acceptable
SINGLE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/observability/executions/non-existent")
if [ "$SINGLE_RESPONSE" = "404" ] || [ "$SINGLE_RESPONSE" = "200" ]; then
    echo "✓ Single execution API responds correctly"
else
    echo "FAIL: Single execution API returned unexpected $SINGLE_RESPONSE"
    exit 1
fi

echo ""
echo "=== Phase 4 Tests PASSED ==="
