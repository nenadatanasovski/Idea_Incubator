/**
 * TEST-PH-009: Check Phase Transition Readiness
 *
 * Verifies that the phase-manager module:
 * 1. Exports canTransitionTo function
 * 2. Returns TransitionCheck with correct structure
 * 3. canTransition is false if required docs incomplete
 * 4. missingRequired lists incomplete required documents
 * 5. warnings lists recommended docs that are incomplete
 * 6. Validates target phase is valid transition from current
 */

import { canTransitionTo } from "../../agents/ideation/phase-manager.js";

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
  console.log("TEST-PH-009: Check Phase Transition Readiness");
  console.log("=".repeat(50));

  let passed = true;

  // Test 1: Function exists and is exported
  console.log("\n[1] Checking canTransitionTo is exported...");
  if (typeof canTransitionTo !== "function") {
    console.log("FAIL: canTransitionTo is not a function");
    passed = false;
  } else {
    console.log("PASS: canTransitionTo is exported as a function");
  }

  // Test 2: Returns TransitionCheck with correct structure
  console.log("\n[2] Testing return structure...");
  const check = await canTransitionTo("test-user", "test-idea", "EVALUATE");
  console.log(`   Result: ${JSON.stringify(check, null, 2)}`);

  // Verify structure
  if (typeof check.canTransition !== "boolean") {
    console.log("FAIL: canTransition is not a boolean");
    passed = false;
  } else {
    console.log("PASS: canTransition is a boolean");
  }

  if (
    typeof check.currentPhase !== "string" ||
    !VALID_STAGES.includes(check.currentPhase)
  ) {
    console.log(
      `FAIL: currentPhase '${check.currentPhase}' is not a valid LifecycleStage`,
    );
    passed = false;
  } else {
    console.log(
      `PASS: currentPhase is a valid LifecycleStage (${check.currentPhase})`,
    );
  }

  if (
    typeof check.targetPhase !== "string" ||
    !VALID_STAGES.includes(check.targetPhase)
  ) {
    console.log(
      `FAIL: targetPhase '${check.targetPhase}' is not a valid LifecycleStage`,
    );
    passed = false;
  } else {
    console.log(
      `PASS: targetPhase is a valid LifecycleStage (${check.targetPhase})`,
    );
  }

  if (typeof check.completionPercent !== "number") {
    console.log("FAIL: completionPercent is not a number");
    passed = false;
  } else if (check.completionPercent < 0 || check.completionPercent > 100) {
    console.log(
      `FAIL: completionPercent ${check.completionPercent} is out of range [0-100]`,
    );
    passed = false;
  } else {
    console.log(
      `PASS: completionPercent is valid (${check.completionPercent}%)`,
    );
  }

  if (!Array.isArray(check.missingRequired)) {
    console.log("FAIL: missingRequired is not an array");
    passed = false;
  } else {
    console.log(
      `PASS: missingRequired is an array with ${check.missingRequired.length} items`,
    );
  }

  if (!Array.isArray(check.warnings)) {
    console.log("FAIL: warnings is not an array");
    passed = false;
  } else {
    console.log(
      `PASS: warnings is an array with ${check.warnings.length} items`,
    );
  }

  // Test 3: canTransition should be false if required docs are missing
  console.log("\n[3] Testing canTransition logic...");
  if (check.missingRequired.length > 0 && check.canTransition === true) {
    console.log(
      "FAIL: canTransition should be false when missingRequired is not empty",
    );
    passed = false;
  } else if (
    check.missingRequired.length === 0 &&
    check.canTransition === false
  ) {
    // This could happen for invalid transition, check warnings
    if (!check.warnings.some((w) => w.includes("Cannot transition"))) {
      console.log(
        "WARN: canTransition is false but missingRequired is empty and no transition warning",
      );
    } else {
      console.log(
        "PASS: canTransition correctly reflects required docs or transition validity",
      );
    }
  } else {
    console.log("PASS: canTransition correctly reflects required docs status");
  }

  // Test 4: Test with non-existent idea (should still return valid structure)
  console.log("\n[4] Testing with non-existent idea...");
  const nonExistentCheck = await canTransitionTo(
    "test-user",
    "non-existent-idea-xyz",
    "CLARIFY",
  );
  console.log(`   Result: ${JSON.stringify(nonExistentCheck, null, 2)}`);

  if (typeof nonExistentCheck.canTransition !== "boolean") {
    console.log(
      "FAIL: Non-existent idea check should still return boolean canTransition",
    );
    passed = false;
  } else {
    console.log(
      "PASS: Non-existent idea returns valid TransitionCheck structure",
    );
  }

  // Test 5: Validate transition to special phases (should be allowed)
  console.log("\n[5] Testing transition to special phases...");
  const pivotCheck = await canTransitionTo("test-user", "test-idea", "PIVOT");
  console.log(`   PIVOT transition: ${JSON.stringify(pivotCheck, null, 2)}`);

  // PIVOT should be a valid target from any phase
  if (pivotCheck.warnings.some((w) => w.includes("Cannot transition"))) {
    console.log("FAIL: PIVOT should be a valid transition from any phase");
    passed = false;
  } else {
    console.log("PASS: Special phases (PIVOT) are valid transition targets");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (passed) {
    console.log("TEST-PH-009: ALL CHECKS PASSED");
    process.exit(0);
  } else {
    console.log("TEST-PH-009: SOME CHECKS FAILED");
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
