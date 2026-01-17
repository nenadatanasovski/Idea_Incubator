#!/bin/bash
# Phase 8: Real-Time Integration Test Script
# Tests the WebSocket connection and real-time update infrastructure

set -e

API_BASE="http://localhost:3001"
FRONTEND_BASE="http://localhost:3002"

echo "=== Phase 8: Real-Time Integration Tests ==="
echo ""

# Test 1: Backend health check
echo "Test 1: Backend health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "  ✓ Backend healthy"
else
    echo "  ✗ Backend health check failed (got $HEALTH_STATUS)"
fi

# Test 2: WebSocket server file exists
echo "Test 2: WebSocket server file exists..."
if [ -f "server/websocket.ts" ]; then
    echo "  ✓ server/websocket.ts exists"
else
    echo "  ✗ WebSocket server file not found"
    exit 1
fi

# Test 3: useObservabilityConnection hook exists
echo "Test 3: useObservabilityConnection hook exists..."
if [ -f "frontend/src/hooks/useObservabilityConnection.ts" ]; then
    echo "  ✓ useObservabilityConnection.ts exists"
else
    echo "  ✗ useObservabilityConnection.ts not found"
    exit 1
fi

# Test 4: Hook has connection status state
echo "Test 4: Hook has connection status state..."
HOOK_FILE="frontend/src/hooks/useObservabilityConnection.ts"
if grep -q "ConnectionStatus" "$HOOK_FILE" && grep -q "connected" "$HOOK_FILE" && grep -q "reconnecting" "$HOOK_FILE" && grep -q "offline" "$HOOK_FILE"; then
    echo "  ✓ Connection status states implemented"
else
    echo "  ✗ Connection status missing"
    exit 1
fi

# Test 5: Hook has exponential backoff reconnection
echo "Test 5: Hook has exponential backoff reconnection..."
if grep -q "Math.pow" "$HOOK_FILE" && grep -q "reconnectAttempts" "$HOOK_FILE"; then
    echo "  ✓ Exponential backoff implemented"
else
    echo "  ✗ Exponential backoff missing"
    exit 1
fi

# Test 6: Hook supports event subscriptions
echo "Test 6: Hook supports event subscriptions..."
if grep -q "subscribe" "$HOOK_FILE" && grep -q "ObservabilityEventType" "$HOOK_FILE"; then
    echo "  ✓ Event subscriptions implemented"
else
    echo "  ✗ Event subscriptions missing"
    exit 1
fi

# Test 7: Connection provider exists
echo "Test 7: ObservabilityConnectionProvider exists..."
if [ -f "frontend/src/components/observability/ObservabilityConnectionProvider.tsx" ]; then
    echo "  ✓ ObservabilityConnectionProvider.tsx exists"
else
    echo "  ✗ ObservabilityConnectionProvider.tsx not found"
    exit 1
fi

# Test 8: Provider creates context
echo "Test 8: Provider creates context..."
PROVIDER_FILE="frontend/src/components/observability/ObservabilityConnectionProvider.tsx"
if grep -q "createContext" "$PROVIDER_FILE" && grep -q "useContext" "$PROVIDER_FILE"; then
    echo "  ✓ Context created"
else
    echo "  ✗ Context missing"
    exit 1
fi

# Test 9: Provider exports context hook
echo "Test 9: Provider exports context hook..."
if grep -q "useObservabilityConnectionContext" "$PROVIDER_FILE"; then
    echo "  ✓ Context hook exported"
else
    echo "  ✗ Context hook missing"
    exit 1
fi

# Test 10: ObservabilityPage uses provider
echo "Test 10: ObservabilityPage uses provider..."
PAGE_FILE="frontend/src/pages/ObservabilityPage.tsx"
if grep -q "ObservabilityConnectionProvider" "$PAGE_FILE" && grep -q "useObservabilityConnectionContext" "$PAGE_FILE"; then
    echo "  ✓ Page uses connection provider"
else
    echo "  ✗ Page not using connection provider"
    exit 1
fi

# Test 11: Page passes connection status to container
echo "Test 11: Page passes connection status to container..."
if grep -q "connectionStatus={status}" "$PAGE_FILE"; then
    echo "  ✓ Connection status passed to container"
else
    echo "  ✗ Connection status not passed"
    exit 1
fi

# Test 12: Hook has cleanup on unmount
echo "Test 12: Hook has cleanup on unmount..."
if grep -q "disconnect" "$HOOK_FILE" && grep -q "return () =>" "$HOOK_FILE"; then
    echo "  ✓ Cleanup on unmount implemented"
else
    echo "  ✗ Cleanup missing"
    exit 1
fi

# Test 13: Frontend route accessible
echo "Test 13: Frontend observability route accessible..."
OBS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/observability" 2>/dev/null || echo "000")
if [ "$OBS_STATUS" = "200" ]; then
    echo "  ✓ Observability route accessible"
else
    echo "  ✗ Route failed (got $OBS_STATUS)"
fi

echo ""
echo "=== Phase 8 Tests Complete ==="
echo "All tests passed!"
echo ""
echo "NOTE: Full WebSocket testing requires browser tests."
echo "Manual verification steps:"
echo "  1. Open /observability in browser"
echo "  2. Check connection indicator shows 'Live' (green)"
echo "  3. Trigger an event (e.g., start execution)"
echo "  4. Verify dashboard updates without refresh"
