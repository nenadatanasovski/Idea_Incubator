#!/bin/bash
# tests/e2e/test-phase1-foundation.sh
# Phase 1 Foundation Tests for Self-Documenting Data Model

set -e
echo "=== Phase 1 Foundation Tests ==="

# Test 1.1: Dependencies
echo ""
echo "Test 1.1: Testing dependencies..."
npm ls drizzle-orm drizzle-zod zod drizzle-kit zod-to-json-schema > /dev/null 2>&1 && echo "✓ All 5 dependencies installed" || {
  echo "✗ Missing dependencies"
  exit 1
}

# Test 1.2: Directory structure
echo ""
echo "Test 1.2: Testing directory structure..."
test -d schema && echo "✓ schema/ exists" || { echo "✗ schema/ missing"; exit 1; }
test -d schema/entities && echo "✓ schema/entities/ exists" || { echo "✗ schema/entities/ missing"; exit 1; }
test -d schema/relations && echo "✓ schema/relations/ exists" || { echo "✗ schema/relations/ missing"; exit 1; }
test -d schema/enums && echo "✓ schema/enums/ exists" || { echo "✗ schema/enums/ missing"; exit 1; }

# Test 1.3: Core files
echo ""
echo "Test 1.3: Testing core files..."
test -f schema/index.ts && echo "✓ schema/index.ts exists" || { echo "✗ schema/index.ts missing"; exit 1; }
test -f schema/registry.ts && echo "✓ schema/registry.ts exists" || { echo "✗ schema/registry.ts missing"; exit 1; }
test -f schema/db.ts && echo "✓ schema/db.ts exists" || { echo "✗ schema/db.ts missing"; exit 1; }
test -f schema/entities/_template.ts && echo "✓ template exists" || { echo "✗ template missing"; exit 1; }

# Test 1.4: Drizzle config
echo ""
echo "Test 1.4: Testing Drizzle config..."
test -f drizzle.config.ts && echo "✓ drizzle.config.ts exists" || { echo "✗ drizzle.config.ts missing"; exit 1; }

# Test 1.5: NPM scripts
echo ""
echo "Test 1.5: Testing NPM scripts..."
grep -q '"schema:generate"' package.json && echo "✓ schema:generate script exists" || { echo "✗ schema:generate missing"; exit 1; }
grep -q '"schema:validate"' package.json && echo "✓ schema:validate script exists" || { echo "✗ schema:validate missing"; exit 1; }

# Test 1.6: Schema validation
echo ""
echo "Test 1.6: Running schema validation..."
npx tsx scripts/validate-schema.ts && echo "✓ Schema validation passed" || { echo "✗ Schema validation failed"; exit 1; }

# Test 1.7: First entity proof of concept
echo ""
echo "Test 1.7: Testing first entity (project)..."
test -f schema/entities/project.ts && echo "✓ project entity file exists" || { echo "✗ project entity missing"; exit 1; }

# Test 1.8: Enum files exist
echo ""
echo "Test 1.8: Testing enum files..."
test -f schema/enums/task-status.ts && echo "✓ task-status enum exists" || { echo "✗ task-status missing"; exit 1; }
test -f schema/enums/task-category.ts && echo "✓ task-category enum exists" || { echo "✗ task-category missing"; exit 1; }

echo ""
echo "=========================================="
echo "=== Phase 1 Tests Complete: ALL PASSED ==="
echo "=========================================="
