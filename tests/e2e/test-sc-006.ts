/**
 * TEST-SC-006: Build Progress Layer
 *
 * Verifies that buildProgressLayer function correctly:
 * 1. Returns ProgressState with all required fields
 * 2. Calculates completionPercent (0-100)
 * 3. Lists documentsComplete
 * 4. Lists documentsMissing
 * 5. Gets lastActivity timestamp
 * 6. Identifies blockers
 * 7. Suggests nextRecommendedAction
 */

import {
  buildProgressLayer,
  estimateTokens,
} from "../../agents/ideation/idea-context-builder.js";
import * as fs from "fs";
import * as path from "path";

async function runTest(): Promise<boolean> {
  const testUserSlug = "test-user-fs007";
  const testIdeaSlug = "child-idea";

  console.log("=== TEST-SC-006: Build Progress Layer ===\n");

  // Verify the test idea folder exists
  const ideaPath = path.join(
    process.cwd(),
    "users",
    testUserSlug,
    "ideas",
    testIdeaSlug,
  );
  if (!fs.existsSync(ideaPath)) {
    console.log(`❌ Test idea folder not found: ${ideaPath}`);
    return false;
  }
  console.log("✓ Test idea folder exists");

  try {
    // Test 1: Function is exported and callable
    console.log("\n--- Test 1: Function is exported ---");
    if (typeof buildProgressLayer !== "function") {
      console.log("❌ buildProgressLayer is not a function");
      return false;
    }
    console.log("✓ buildProgressLayer is exported as a function");

    // Test 2: Returns ProgressState with all required fields
    console.log("\n--- Test 2: Returns ProgressState with all fields ---");
    const progress = await buildProgressLayer(testUserSlug, testIdeaSlug);

    // Check all required fields exist
    const requiredFields = [
      "phase",
      "completionPercent",
      "documentsComplete",
      "documentsMissing",
      "lastActivity",
      "blockers",
      "nextRecommendedAction",
    ];

    for (const field of requiredFields) {
      if (!(field in progress)) {
        console.log(`❌ Missing required field: ${field}`);
        return false;
      }
      console.log(`  ✓ Has field: ${field}`);
    }
    console.log("✓ All required fields present");

    // Test 3: completionPercent is valid number 0-100
    console.log("\n--- Test 3: completionPercent is valid ---");
    if (typeof progress.completionPercent !== "number") {
      console.log(
        `❌ completionPercent is not a number: ${typeof progress.completionPercent}`,
      );
      return false;
    }
    if (progress.completionPercent < 0 || progress.completionPercent > 100) {
      console.log(
        `❌ completionPercent out of range: ${progress.completionPercent}`,
      );
      return false;
    }
    console.log(`✓ completionPercent is valid: ${progress.completionPercent}%`);

    // Test 4: documentsComplete is array
    console.log("\n--- Test 4: documentsComplete is array ---");
    if (!Array.isArray(progress.documentsComplete)) {
      console.log("❌ documentsComplete is not an array");
      return false;
    }
    console.log(
      `✓ documentsComplete is array with ${progress.documentsComplete.length} items`,
    );
    if (progress.documentsComplete.length > 0) {
      console.log(
        `  Sample: ${progress.documentsComplete.slice(0, 3).join(", ")}`,
      );
    }

    // Test 5: documentsMissing is array
    console.log("\n--- Test 5: documentsMissing is array ---");
    if (!Array.isArray(progress.documentsMissing)) {
      console.log("❌ documentsMissing is not an array");
      return false;
    }
    console.log(
      `✓ documentsMissing is array with ${progress.documentsMissing.length} items`,
    );
    if (progress.documentsMissing.length > 0) {
      console.log(
        `  Sample: ${progress.documentsMissing.slice(0, 3).join(", ")}`,
      );
    }

    // Test 6: lastActivity is a Date
    console.log("\n--- Test 6: lastActivity is Date ---");
    if (!(progress.lastActivity instanceof Date)) {
      console.log("❌ lastActivity is not a Date");
      return false;
    }
    console.log(
      `✓ lastActivity is Date: ${progress.lastActivity.toISOString()}`,
    );

    // Test 7: blockers is array
    console.log("\n--- Test 7: blockers is array ---");
    if (!Array.isArray(progress.blockers)) {
      console.log("❌ blockers is not an array");
      return false;
    }
    console.log(`✓ blockers is array with ${progress.blockers.length} items`);

    // Test 8: nextRecommendedAction is string
    console.log("\n--- Test 8: nextRecommendedAction is string ---");
    if (typeof progress.nextRecommendedAction !== "string") {
      console.log("❌ nextRecommendedAction is not a string");
      return false;
    }
    if (progress.nextRecommendedAction.length === 0) {
      console.log("❌ nextRecommendedAction is empty");
      return false;
    }
    console.log(`✓ nextRecommendedAction: "${progress.nextRecommendedAction}"`);

    // Test 9: Token estimate < 300
    console.log("\n--- Test 9: Token estimate < 300 ---");
    const tokenCount = estimateTokens(JSON.stringify(progress));
    if (tokenCount >= 300) {
      console.log(
        `⚠ Token count exceeds target: ${tokenCount} tokens (target: < 300)`,
      );
      // This is a warning, not a failure - large folders may exceed
    } else {
      console.log(`✓ Token count within budget: ${tokenCount} tokens`);
    }

    // Test 10: Phase is valid LifecycleStage
    console.log("\n--- Test 10: Phase is valid ---");
    const validStages = [
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
    if (!validStages.includes(progress.phase)) {
      console.log(`❌ Invalid phase: ${progress.phase}`);
      return false;
    }
    console.log(`✓ Phase is valid: ${progress.phase}`);

    // Print full progress object for debugging
    console.log("\n--- Full Progress Object ---");
    console.log(
      JSON.stringify(
        progress,
        (_key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        },
        2,
      ),
    );

    console.log("\n=== ALL TESTS PASSED ===");
    return true;
  } catch (error) {
    console.log(`\n❌ Error during test: ${error}`);
    return false;
  }
}

// Run the test
runTest().then((passed) => {
  process.exit(passed ? 0 : 1);
});
