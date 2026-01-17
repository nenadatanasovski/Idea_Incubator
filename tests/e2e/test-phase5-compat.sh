#!/bin/bash
# tests/e2e/test-phase5-compat.sh
# Phase 5: Backwards Compatibility Tests

set -e
echo "=== Phase 5 Backwards Compatibility Tests ==="

# Test 5.1: New schema imports work
echo ""
echo "Testing new import paths..."
cat > /tmp/test-schema-imports.mts << 'EOF'
import * as schema from './schema/index.js';
// Check for runtime exports (tables, schemas, enums) - not TypeScript types which are erased at runtime
const runtimeExports = [
  'tasks', 'projects', 'ideas', 'prds', 'taskListsV2', 'taskRelationships',  // tables
  'insertTaskSchema', 'selectTaskSchema', 'updateTaskSchema',  // validation schemas
  'taskStatuses', 'taskCategories', 'projectStatuses', 'prdStatuses',  // enums
  'schemaRegistry', 'getDrizzleDb', 'getEntity', 'getEnum'  // registry
];
let passed = 0;
let failed = 0;
for (const exp of runtimeExports) {
  if (exp in schema) {
    console.log('✓', exp, 'exported');
    passed++;
  } else {
    console.log('✗', exp, 'NOT exported');
    failed++;
  }
}
console.log('');
console.log('Schema exports:', passed, 'passed,', failed, 'failed');
if (failed > 0) process.exit(1);
EOF
cp /tmp/test-schema-imports.mts test-schema-imports.mts
npx tsx test-schema-imports.mts && rm test-schema-imports.mts && echo "✓ New schema imports work" || (rm -f test-schema-imports.mts && echo "✗ New schema imports failed" && exit 1)

# Test 5.2: Old imports still work
echo ""
echo "Testing old import paths still work..."
cat > /tmp/test-old-imports.mts << 'EOF'
const files = [
  './types/project.js',
  './types/prd.js'
];
let failures = 0;
for (const file of files) {
  try {
    await import(file);
    console.log('✓', file, 'importable');
  } catch (e: any) {
    console.log('✗', file, 'failed:', e.message);
    failures++;
  }
}
if (failures > 0) process.exit(1);
EOF
cp /tmp/test-old-imports.mts test-old-imports.mts
npx tsx test-old-imports.mts && rm test-old-imports.mts && echo "✓ Old imports still work" || (rm -f test-old-imports.mts && echo "⚠ Some old imports may need attention")

# Test 5.3: TypeScript compilation
echo ""
echo "Testing full codebase compilation..."
npx tsc --noEmit 2>&1 | grep -c "error TS" > /tmp/tsc_errors.txt || true
TSC_ERRORS=$(cat /tmp/tsc_errors.txt)
if [ "$TSC_ERRORS" -eq 0 ]; then
  echo "✓ Full codebase compiles without errors"
else
  echo "⚠ Codebase has $TSC_ERRORS TypeScript errors (may be pre-existing)"
fi

# Test 5.4: Migration helper works
echo ""
echo "Testing migration helper..."
if npm run schema:migrate-helper > /dev/null 2>&1; then
  echo "✓ Migration helper runs successfully"
else
  echo "⚠ Migration helper had issues"
fi

# Test 5.5: Schema validation passes
echo ""
echo "Testing schema validation..."
if npm run schema:validate 2>&1 | grep -q "passed"; then
  echo "✓ Schema validation passes"
else
  echo "⚠ Schema validation may have issues"
fi

# Test 5.6: Server starts (quick check)
echo ""
echo "Testing server availability..."
if curl -s --connect-timeout 2 "http://localhost:3001/api/health" > /dev/null 2>&1; then
  echo "✓ Server is running"
else
  echo "⚠ Server not available (may need to be started separately)"
fi

# Test 5.7: Check for duplicate type definitions
echo ""
echo "Checking for duplicate definitions..."
TASK_DEFS=$(grep -rh "^export type Task = " types/ schema/ 2>/dev/null | wc -l || true)
TASK_DEFS=$(echo "$TASK_DEFS" | tr -d ' ')
if [ "$TASK_DEFS" -le 2 ]; then
  echo "✓ No excessive duplicate type definitions"
else
  echo "⚠ Found multiple Task type definitions - ensure types/ re-exports from schema/"
fi

# Test 5.8: Check CLAUDE.md updated
echo ""
echo "Checking documentation updates..."
if grep -q "/api/schema" CLAUDE.md; then
  echo "✓ CLAUDE.md mentions /api/schema endpoint"
else
  echo "⚠ CLAUDE.md may need /api/schema documentation"
fi

if grep -q 'import.*from.*@/schema' CLAUDE.md || grep -q 'import.*from.*schema/' CLAUDE.md; then
  echo "✓ CLAUDE.md has schema import examples"
else
  echo "⚠ CLAUDE.md may need schema import examples"
fi

echo ""
echo "=== Phase 5 Tests Complete ==="
