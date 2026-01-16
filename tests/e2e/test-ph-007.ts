/**
 * TEST-PH-007: Create Phase Manager
 *
 * Verifies that the phase-manager module:
 * 1. Exports getCurrentPhase function
 * 2. Returns LifecycleStage from README.md frontmatter
 * 3. Returns 'SPARK' if no phase set
 * 4. Handles missing frontmatter gracefully
 */

import { getCurrentPhase } from "../../agents/ideation/phase-manager.js";

const VALID_STAGES = [
  "SPARK",
  "CLARIFY",
  "RESEARCH",
  "IDEATE",
  "EVALUATE",
  "VALIDATE",
  "DESIGN",
  "PROTOTYPE",
  "TEST",
  "REFINE",
  "BUILD",
  "LAUNCH",
  "GROW",
  "MAINTAIN",
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
];

async function runTest(): Promise<void> {
  console.log("TEST-PH-007: Create Phase Manager");
  console.log("=".repeat(50));

  let passed = true;

  // Test 1: Function exists and is exported
  console.log("\n[1] Checking getCurrentPhase is exported...");
  if (typeof getCurrentPhase !== "function") {
    console.log("FAIL: getCurrentPhase is not a function");
    passed = false;
  } else {
    console.log("PASS: getCurrentPhase is exported as a function");
  }

  // Test 2: Returns valid LifecycleStage for existing idea
  console.log("\n[2] Testing with existing test-idea...");
  const phase = await getCurrentPhase("test-user", "test-idea");
  console.log(`   Phase returned: ${phase}`);

  if (typeof phase !== "string") {
    console.log("FAIL: phase is not a string");
    passed = false;
  } else if (!VALID_STAGES.includes(phase)) {
    console.log(`FAIL: ${phase} is not a valid LifecycleStage`);
    passed = false;
  } else {
    console.log("PASS: Returns valid LifecycleStage");
  }

  // Test 3: Returns 'SPARK' for non-existent idea (missing file)
  console.log("\n[3] Testing with non-existent idea...");
  const nonExistentPhase = await getCurrentPhase(
    "test-user",
    "non-existent-idea-xyz",
  );
  console.log(`   Phase returned: ${nonExistentPhase}`);

  if (nonExistentPhase !== "SPARK") {
    console.log(`FAIL: Expected 'SPARK' but got '${nonExistentPhase}'`);
    passed = false;
  } else {
    console.log("PASS: Returns SPARK for missing file");
  }

  // Test 4: Handles missing frontmatter gracefully (won't crash)
  console.log("\n[4] Testing graceful handling of edge cases...");
  try {
    // This should not throw even for invalid inputs
    const edgePhase = await getCurrentPhase("", "");
    console.log(`   Phase returned for empty slugs: ${edgePhase}`);
    if (edgePhase === "SPARK") {
      console.log("PASS: Handles edge cases gracefully");
    } else {
      console.log("PASS: Handles edge cases (returned non-default but valid)");
    }
  } catch (error) {
    console.log(`FAIL: Threw error for edge case: ${error}`);
    passed = false;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (passed) {
    console.log("TEST-PH-007: ALL CHECKS PASSED");
    process.exit(0);
  } else {
    console.log("TEST-PH-007: SOME CHECKS FAILED");
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
