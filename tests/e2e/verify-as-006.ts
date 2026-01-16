// Verification Code from spec for TEST-AS-006
import {
  saveArtifact,
  loadArtifact,
} from "../../agents/ideation/unified-artifact-store.js";
import * as fs from "fs";

async function verify() {
  // Clean up first
  if (fs.existsSync("users/test-user")) {
    fs.rmSync("users/test-user", { recursive: true });
  }

  await saveArtifact("test-user", "test-idea", {
    type: "markdown",
    title: "Load Test",
    content: "# Load Test\nBody",
    filePath: "load-test.md",
  });

  const loaded = await loadArtifact("test-user", "test-idea", "load-test.md");

  // Assertions from spec
  console.log("Checking assertions from spec...");

  if (loaded === null) {
    console.error("FAIL: loaded is null");
    process.exit(1);
  }

  if (loaded.title !== "Load Test") {
    console.error(`FAIL: loaded.title !== 'Load Test', got '${loaded.title}'`);
    process.exit(1);
  }
  console.log('✓ loaded.title === "Load Test"');

  if (loaded.tokenCount <= 0) {
    console.error(
      `FAIL: loaded.tokenCount should be > 0, got ${loaded.tokenCount}`,
    );
    process.exit(1);
  }
  console.log(`✓ loaded.tokenCount > 0 (${loaded.tokenCount})`);

  // Clean up
  fs.rmSync("users/test-user", { recursive: true });

  console.log("\nAll spec verification assertions passed!");
  console.log("TEST PASSED: TEST-AS-006");
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
