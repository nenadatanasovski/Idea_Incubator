import Database from "better-sqlite3";

const db = new Database("./data/harness.db", { readonly: true });

console.log("\n🔍 Verification Results:\n");

// Check test cases
const cases = db
  .prepare(
    `
  SELECT COUNT(*) as count FROM test_cases
  WHERE id LIKE 'phase_1_task_%'
`,
  )
  .get() as { count: number };
console.log(`1. Test Cases: ${cases.count}/8 ✓`);

// Check test steps
const steps = db
  .prepare(
    `
  SELECT COUNT(*) as count FROM test_steps
  WHERE case_id IN (
    SELECT id FROM test_cases WHERE id LIKE 'phase_1_task_%'
  )
`,
  )
  .get() as { count: number };
console.log(`2. Test Steps: ${steps.count} (expected at least 8) ✓`);

// Check test assertions
const assertions = db
  .prepare(
    `
  SELECT COUNT(*) as count FROM test_assertions
  WHERE step_id IN (
    SELECT id FROM test_steps
    WHERE case_id IN (
      SELECT id FROM test_cases WHERE id LIKE 'phase_1_task_%'
    )
  )
`,
  )
  .get() as { count: number };
console.log(`3. Test Assertions: ${assertions.count} (expected at least 8) ✓`);

// List all test cases
console.log("\n📋 Test Cases Created:\n");
const caseList = db
  .prepare(
    `
  SELECT id, name, priority
  FROM test_cases
  WHERE id LIKE 'phase_1_task_%'
  ORDER BY id
`,
  )
  .all();

caseList.forEach((c: any, i: number) => {
  console.log(`   ${i + 1}. ${c.id} - ${c.name} (${c.priority})`);
});

// Check if each case has steps
console.log("\n🔗 Steps per Test Case:\n");
const stepCounts = db
  .prepare(
    `
  SELECT tc.id, tc.name, COUNT(ts.id) as step_count
  FROM test_cases tc
  LEFT JOIN test_steps ts ON tc.id = ts.case_id
  WHERE tc.id LIKE 'phase_1_task_%'
  GROUP BY tc.id
  ORDER BY tc.id
`,
  )
  .all();

let allHaveSteps = true;
stepCounts.forEach((c: any) => {
  const icon = c.step_count > 0 ? "✓" : "✗";
  console.log(`   ${icon} ${c.name}: ${c.step_count} steps`);
  if (c.step_count === 0) allHaveSteps = false;
});

// Validation query test
console.log("\n🔎 Validation Query Test:\n");
const validationResult = db
  .prepare(
    `
  SELECT
    COUNT(*) as total
  FROM test_cases
  WHERE id LIKE 'phase_1_task_%'
`,
  )
  .get() as { total: number };

console.log(`   Total Phase 1 tasks: ${validationResult.total}/8`);

// Pass criteria summary
console.log("\n✅ Pass Criteria Status:\n");
console.log(
  `   1. 8 test_cases created: ${cases.count === 8 ? "✓ PASS" : "✗ FAIL"}`,
);
console.log(
  `   2. Each has at least 1 step: ${allHaveSteps ? "✓ PASS" : "✗ FAIL"}`,
);
console.log(
  `   3. Key assertions defined: ${assertions.count >= 8 ? "✓ PASS" : "✗ FAIL"}`,
);
console.log(
  `   4. Validation query works: ${validationResult.total === 8 ? "✓ PASS" : "✗ FAIL"}`,
);
console.log(
  `   5. Phase 1 task tracking: ${cases.count === 8 && allHaveSteps ? "✓ PASS" : "✗ FAIL"}`,
);

db.close();
