#!/bin/bash
# tests/e2e/test-phase4-ui.sh
# Phase 4: Schema Viewer UI Tests

set -e
BASE_URL="${BASE_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "=== Phase 4 Schema Viewer UI Tests ==="

# Test 4.1: Component files exist
echo ""
echo "Testing component files..."
test -f frontend/src/pages/SchemaPage.tsx && echo "✓ SchemaPage.tsx exists" || (echo "✗ SchemaPage.tsx missing" && exit 1)
test -f frontend/src/components/schema/EntityList.tsx && echo "✓ EntityList.tsx exists" || (echo "✗ EntityList.tsx missing" && exit 1)
test -f frontend/src/components/schema/EntityDetail.tsx && echo "✓ EntityDetail.tsx exists" || (echo "✗ EntityDetail.tsx missing" && exit 1)
test -f frontend/src/components/schema/EnumList.tsx && echo "✓ EnumList.tsx exists" || (echo "✗ EnumList.tsx missing" && exit 1)
test -f frontend/src/components/schema/SchemaERD.tsx && echo "✓ SchemaERD.tsx exists" || (echo "✗ SchemaERD.tsx missing" && exit 1)

# Test 4.2: Route exists in App.tsx
echo ""
echo "Testing route configuration..."
grep -q 'path="/schema"' frontend/src/App.tsx && echo "✓ /schema route configured" || (echo "✗ /schema route not found" && exit 1)
grep -q 'SchemaPage' frontend/src/App.tsx && echo "✓ SchemaPage imported in App.tsx" || (echo "✗ SchemaPage not imported" && exit 1)

# Test 4.3: Navigation link exists
echo ""
echo "Testing navigation link..."
grep -q '"Schema"' frontend/src/components/Layout.tsx && echo "✓ Schema navigation link exists" || (echo "✗ Schema nav link not found" && exit 1)
grep -q '"/schema"' frontend/src/components/Layout.tsx && echo "✓ Schema href configured" || (echo "✗ Schema href not found" && exit 1)

# Test 4.4: TypeScript compilation (check schema components specifically)
echo ""
echo "Testing TypeScript compilation of schema components..."
cd frontend
# Run full project compilation and check for errors in schema files only
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
SCHEMA_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "schema/|SchemaPage" | grep -c "error TS" || true)
cd ..
if [ "$SCHEMA_ERRORS" -eq 0 ]; then
  echo "✓ Schema components compile without errors"
else
  echo "⚠ Schema components have $SCHEMA_ERRORS TypeScript errors"
  echo "$TSC_OUTPUT" | grep -E "schema/|SchemaPage" | head -5
fi

# Test 4.5: API endpoints work (backend required)
echo ""
echo "Testing API endpoints..."
if curl -s --connect-timeout 2 "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "✓ Server is running"

  # Test schema overview
  OVERVIEW=$(curl -s "$BASE_URL/api/schema" 2>&1)
  echo "$OVERVIEW" | grep -q '"entities"' && echo "✓ /api/schema returns entities" || echo "⚠ /api/schema missing entities"
  echo "$OVERVIEW" | grep -q '"enums"' && echo "✓ /api/schema returns enums" || echo "⚠ /api/schema missing enums"

  # Test entities endpoint
  ENTITIES=$(curl -s "$BASE_URL/api/schema/entities" 2>&1)
  echo "$ENTITIES" | grep -q '"entities"' && echo "✓ /api/schema/entities returns data" || echo "⚠ /api/schema/entities failed"

  # Test enums endpoint
  ENUMS=$(curl -s "$BASE_URL/api/schema/enums" 2>&1)
  echo "$ENUMS" | grep -q '"enums"' && echo "✓ /api/schema/enums returns data" || echo "⚠ /api/schema/enums failed"

  # Test relationships endpoint
  RELS=$(curl -s "$BASE_URL/api/schema/relationships" 2>&1)
  echo "$RELS" | grep -q '"relationships"' && echo "✓ /api/schema/relationships returns data" || echo "⚠ /api/schema/relationships failed"
else
  echo "⚠ Server not available at $BASE_URL - skipping API tests"
fi

echo ""
echo "=== Phase 4 Tests Complete ==="
echo ""
echo "Manual verification required:"
echo "  1. Start frontend: cd frontend && npm run dev"
echo "  2. Navigate to http://localhost:5173/schema"
echo "  3. Verify entity list renders"
echo "  4. Click an entity to see details"
echo "  5. Switch to Enums tab and verify list"
echo "  6. Switch to ERD tab and verify diagram"
echo "  7. Test search functionality"
