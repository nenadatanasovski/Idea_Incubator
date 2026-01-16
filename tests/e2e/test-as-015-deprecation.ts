/**
 * TEST-AS-015: Test that deprecation warnings are logged
 */
import {
  saveArtifact,
  getArtifactsBySession,
} from "../../agents/ideation/artifact-store.js";

// Capture console.warn output
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.join(" "));
  originalWarn.apply(console, args);
};

async function testDeprecation() {
  // Create a mock that will cause the function to call logDeprecation
  // without actually running DB queries
  try {
    // Call the function - it will trigger logDeprecation before the DB call fails
    await saveArtifact({
      id: "test",
      sessionId: "test",
      type: "markdown",
      title: "test",
      content: "test",
    });
  } catch (e) {
    // Expected - DB might not be available
  }

  try {
    await getArtifactsBySession("test");
  } catch (e) {
    // Expected - DB might not be available
  }

  // Check if deprecation warnings were logged
  const hasDeprecationWarnings = warnings.some((w) =>
    w.includes("[DEPRECATED]"),
  );

  console.log("\n--- Deprecation Test Results ---");
  console.log("Captured warnings:", warnings);
  console.log("Has deprecation warnings:", hasDeprecationWarnings);

  if (hasDeprecationWarnings) {
    console.log("\nDeprecation warnings are working correctly!");
    console.log("TEST-AS-015 (deprecation check): PASS");
    process.exit(0);
  } else {
    console.log("\nNo deprecation warnings found!");
    console.log("TEST-AS-015 (deprecation check): FAIL");
    process.exit(1);
  }
}

testDeprecation();
