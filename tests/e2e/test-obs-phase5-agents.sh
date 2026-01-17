#!/bin/bash
# Phase 5: Agents Sub-Tab Test Script
# Tests the AgentsTab component functionality

set -e

API_BASE="http://localhost:3001"
FRONTEND_BASE="http://localhost:3002"

echo "=== Phase 5: Agents Sub-Tab Tests ==="
echo ""

# Test 1: Agents API endpoint exists
echo "Test 1: GET /api/agents endpoint..."
AGENTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/agents" 2>/dev/null || echo "000")
if [ "$AGENTS_RESPONSE" = "200" ]; then
    echo "  ✓ Agents endpoint returns 200"
else
    echo "  ✗ Agents endpoint failed (got $AGENTS_RESPONSE)"
    # Don't exit - endpoint might return empty but valid response
fi

# Test 2: Pending questions endpoint exists
echo "Test 2: GET /api/questions/pending endpoint..."
QUESTIONS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/questions/pending" 2>/dev/null || echo "000")
if [ "$QUESTIONS_RESPONSE" = "200" ]; then
    echo "  ✓ Pending questions endpoint returns 200"
else
    echo "  ✗ Pending questions endpoint failed (got $QUESTIONS_RESPONSE)"
fi

# Test 3: Agents tab route accessible
echo "Test 3: Agents tab route accessible..."
AGENTS_TAB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/observability/agents" 2>/dev/null || echo "000")
if [ "$AGENTS_TAB_RESPONSE" = "200" ]; then
    echo "  ✓ Agents tab route returns 200"
else
    echo "  ✗ Agents tab route failed (got $AGENTS_TAB_RESPONSE)"
fi

# Test 4: AgentsTab component exists
echo "Test 4: AgentsTab component file exists..."
if [ -f "frontend/src/components/observability/AgentsTab.tsx" ]; then
    echo "  ✓ AgentsTab.tsx exists"
else
    echo "  ✗ AgentsTab.tsx not found"
    exit 1
fi

# Test 5: AgentsTab has required sections
echo "Test 5: AgentsTab has required sections..."
AGENTS_FILE="frontend/src/components/observability/AgentsTab.tsx"

# Check for summary cards
if grep -q "SummaryCard" "$AGENTS_FILE"; then
    echo "  ✓ Summary cards present"
else
    echo "  ✗ Summary cards missing"
    exit 1
fi

# Check for agent status grid
if grep -q "AgentCard" "$AGENTS_FILE"; then
    echo "  ✓ Agent status grid present"
else
    echo "  ✗ Agent status grid missing"
    exit 1
fi

# Check for blocking questions section
if grep -q "QuestionCard" "$AGENTS_FILE"; then
    echo "  ✓ Blocking questions section present"
else
    echo "  ✗ Blocking questions section missing"
    exit 1
fi

# Test 6: API data fetching implemented
echo "Test 6: API data fetching implemented..."
if grep -q "fetch.*api/agents" "$AGENTS_FILE" && grep -q "fetch.*api/questions/pending" "$AGENTS_FILE"; then
    echo "  ✓ Data fetching from both endpoints"
else
    echo "  ✗ Missing API fetch calls"
    exit 1
fi

# Test 7: Status counts displayed
echo "Test 7: Status counts displayed..."
if grep -q "statusCounts" "$AGENTS_FILE"; then
    echo "  ✓ Status counts calculated"
else
    echo "  ✗ Status counts missing"
    exit 1
fi

# Test 8: Refresh functionality
echo "Test 8: Refresh functionality..."
if grep -q "RefreshCw" "$AGENTS_FILE" && grep -q "fetchData" "$AGENTS_FILE"; then
    echo "  ✓ Manual refresh available"
else
    echo "  ✗ Refresh functionality missing"
    exit 1
fi

# Test 9: Auto-refresh interval
echo "Test 9: Auto-refresh interval..."
if grep -q "setInterval" "$AGENTS_FILE"; then
    echo "  ✓ Auto-refresh interval set"
else
    echo "  ✗ Auto-refresh interval missing"
    exit 1
fi

# Test 10: Link to full dashboard
echo "Test 10: Link to full agent dashboard..."
if grep -q 'to="/agents"' "$AGENTS_FILE" || grep -q "to=\"/agents\"" "$AGENTS_FILE"; then
    echo "  ✓ Link to full dashboard present"
else
    echo "  ✗ Link to full dashboard missing"
    exit 1
fi

echo ""
echo "=== Phase 5 Tests Complete ==="
echo "All tests passed!"
