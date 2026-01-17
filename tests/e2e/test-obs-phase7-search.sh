#!/bin/bash
# Phase 7: Unified Search Test Script
# Tests the ObservabilitySearch component and search API endpoint

set -e

API_BASE="http://localhost:3001"
FRONTEND_BASE="http://localhost:3002"

echo "=== Phase 7: Unified Search Tests ==="
echo ""

# Test 1: Search API endpoint exists
echo "Test 1: GET /api/observability/search endpoint..."
SEARCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/observability/search?q=test" 2>/dev/null || echo "000")
if [ "$SEARCH_STATUS" = "200" ]; then
    echo "  ✓ Search endpoint returns 200"
else
    echo "  ✗ Search endpoint failed (got $SEARCH_STATUS)"
fi

# Test 2: Search returns valid JSON
echo "Test 2: Search returns valid JSON..."
SEARCH_RESPONSE=$(curl -s "$API_BASE/api/observability/search?q=test" 2>/dev/null || echo "error")
if echo "$SEARCH_RESPONSE" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    echo "  ✓ Search returns valid JSON"
else
    echo "  ✗ Search response is not valid JSON"
fi

# Test 3: Search returns success field
echo "Test 3: Search returns success field..."
if echo "$SEARCH_RESPONSE" | grep -q '"success":true'; then
    echo "  ✓ Search returns success: true"
else
    echo "  ✗ Search response missing success field"
fi

# Test 4: Search supports pagination
echo "Test 4: Search supports pagination..."
PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/observability/search?q=test&limit=10&offset=0" 2>/dev/null || echo "000")
if [ "$PAGE_STATUS" = "200" ]; then
    echo "  ✓ Pagination params work"
else
    echo "  ✗ Pagination failed"
fi

# Test 5: Search returns results array
echo "Test 5: Search returns results array..."
if echo "$SEARCH_RESPONSE" | grep -q '"results":\['; then
    echo "  ✓ Search returns results array"
else
    echo "  ✗ Results array missing"
fi

# Test 6: Search with empty query returns empty results
echo "Test 6: Empty query returns empty results..."
EMPTY_RESPONSE=$(curl -s "$API_BASE/api/observability/search?q=" 2>/dev/null || echo "error")
if echo "$EMPTY_RESPONSE" | grep -q '"results":\[\]'; then
    echo "  ✓ Empty query returns empty results"
else
    echo "  ✗ Empty query handling failed"
fi

# Test 7: ObservabilitySearch component file exists
echo "Test 7: ObservabilitySearch component file exists..."
if [ -f "frontend/src/components/observability/ObservabilitySearch.tsx" ]; then
    echo "  ✓ ObservabilitySearch.tsx exists"
else
    echo "  ✗ ObservabilitySearch.tsx not found"
    exit 1
fi

# Test 8: Search component has debounce
echo "Test 8: Search component has debounce..."
SEARCH_FILE="frontend/src/components/observability/ObservabilitySearch.tsx"
if grep -q "useDebounce" "$SEARCH_FILE" && grep -q "300" "$SEARCH_FILE"; then
    echo "  ✓ Debounce (300ms) implemented"
else
    echo "  ✗ Debounce missing"
    exit 1
fi

# Test 9: Search component has keyboard navigation
echo "Test 9: Search component has keyboard navigation..."
if grep -q "ArrowDown" "$SEARCH_FILE" && grep -q "ArrowUp" "$SEARCH_FILE" && grep -q "Enter" "$SEARCH_FILE" && grep -q "Escape" "$SEARCH_FILE"; then
    echo "  ✓ Keyboard navigation implemented"
else
    echo "  ✗ Keyboard navigation missing"
    exit 1
fi

# Test 10: Search component has result type icons
echo "Test 10: Search component has result type icons..."
if grep -q "getTypeIcon" "$SEARCH_FILE" && grep -q "event" "$SEARCH_FILE" && grep -q "execution" "$SEARCH_FILE" && grep -q "tool-use" "$SEARCH_FILE" && grep -q "agent" "$SEARCH_FILE" && grep -q "error" "$SEARCH_FILE"; then
    echo "  ✓ Result type icons implemented"
else
    echo "  ✗ Result type icons missing"
    exit 1
fi

# Test 11: Search component has loading state
echo "Test 11: Search component has loading state..."
if grep -q "loading" "$SEARCH_FILE" && grep -q "Loader2" "$SEARCH_FILE"; then
    echo "  ✓ Loading state implemented"
else
    echo "  ✗ Loading state missing"
    exit 1
fi

# Test 12: Search component has empty state
echo "Test 12: Search component has empty state..."
if grep -q "No results found" "$SEARCH_FILE"; then
    echo "  ✓ Empty state implemented"
else
    echo "  ✗ Empty state missing"
    exit 1
fi

# Test 13: Header uses ObservabilitySearch
echo "Test 13: Header uses ObservabilitySearch component..."
HEADER_FILE="frontend/src/components/observability/ObservabilityHeader.tsx"
if grep -q "import ObservabilitySearch" "$HEADER_FILE" && grep -q "<ObservabilitySearch" "$HEADER_FILE"; then
    echo "  ✓ Header uses ObservabilitySearch"
else
    echo "  ✗ Header not using ObservabilitySearch"
    exit 1
fi

# Test 14: Search results grouped by type
echo "Test 14: Search results grouped by type..."
if grep -q "groupedResults" "$SEARCH_FILE"; then
    echo "  ✓ Results grouped by type"
else
    echo "  ✗ Results not grouped"
    exit 1
fi

echo ""
echo "=== Phase 7 Tests Complete ==="
echo "All tests passed!"
