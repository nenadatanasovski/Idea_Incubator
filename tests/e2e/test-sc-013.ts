import * as fs from "fs";
import * as path from "path";
import {
  updateRecentlyUpdated,
} from "../../agents/ideation/priority-manager.js";
import {
  getIdeaFolderPath,
  createIdeaFolder,
} from "../../utils/folder-structure.js";

async function runTest() {
  const userSlug = "test-sc013-user";
  const ideaSlug = "test-sc013-idea";

  console.log("=== TEST-SC-013: Update Priority on Activity ===");

  // Setup: Create test idea folder
  console.log("1. Setting up test environment...");
  await createIdeaFolder(userSlug, ideaSlug, "business");
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const priorityPath = path.join(ideaPath, ".metadata", "priority.json");

  // Clean up any existing priority.json
  if (fs.existsSync(priorityPath)) {
    fs.unlinkSync(priorityPath);
  }

  // Test 1: Function is exported
  console.log("2. Checking function export...");
  if (typeof updateRecentlyUpdated !== "function") {
    console.log("FAIL: updateRecentlyUpdated is not a function");
    process.exit(1);
  }
  console.log("   OK: updateRecentlyUpdated is exported");

  // Test 2: Creates priority.json if missing
  console.log("3. Testing creates priority.json if missing...");
  await updateRecentlyUpdated(userSlug, ideaSlug, "research/market.md");
  if (!fs.existsSync(priorityPath)) {
    console.log("FAIL: priority.json was not created");
    process.exit(1);
  }
  console.log("   OK: Creates priority.json if missing");

  // Test 3: Adds file to recently_updated array
  console.log("4. Testing adds file to recently_updated...");
  const priority1 = JSON.parse(fs.readFileSync(priorityPath, "utf-8"));
  if (!priority1.recently_updated.includes("research/market.md")) {
    console.log("FAIL: File not added to recently_updated");
    process.exit(1);
  }
  console.log("   OK: Adds file to recently_updated array");

  // Test 4: Moves file to front if already in list
  console.log("5. Testing moves file to front if already in list...");
  await updateRecentlyUpdated(userSlug, ideaSlug, "planning/brief.md");
  await updateRecentlyUpdated(userSlug, ideaSlug, "research/market.md");
  const priority2 = JSON.parse(fs.readFileSync(priorityPath, "utf-8"));
  if (priority2.recently_updated[0] !== "research/market.md") {
    console.log("FAIL: File not moved to front");
    process.exit(1);
  }
  console.log("   OK: Moves file to front if already in list");

  // Test 5: No duplicate entries
  console.log("6. Testing no duplicate entries...");
  const count = priority2.recently_updated.filter(
    (f: string) => f === "research/market.md",
  ).length;
  if (count !== 1) {
    console.log("FAIL: Duplicate entries found");
    process.exit(1);
  }
  console.log("   OK: No duplicate entries");

  // Test 6: Limits to 10 most recent
  console.log("7. Testing limits to 10 most recent...");
  for (let i = 0; i < 15; i++) {
    await updateRecentlyUpdated(userSlug, ideaSlug, `file${i}.md`);
  }
  const priority3 = JSON.parse(fs.readFileSync(priorityPath, "utf-8"));
  if (priority3.recently_updated.length > 10) {
    console.log(
      "FAIL: List exceeds 10 items, length: " +
        priority3.recently_updated.length,
    );
    process.exit(1);
  }
  console.log("   OK: Limits to 10 most recent");

  // Test 7: Saves changes to priority.json
  console.log("8. Testing saves changes to priority.json...");
  const finalPriority = JSON.parse(fs.readFileSync(priorityPath, "utf-8"));
  if (!Array.isArray(finalPriority.recently_updated)) {
    console.log("FAIL: Changes not saved properly");
    process.exit(1);
  }
  console.log("   OK: Saves changes to priority.json");

  // Cleanup
  console.log("9. Cleaning up test environment...");
  fs.rmSync(path.join(process.cwd(), "users", userSlug), {
    recursive: true,
    force: true,
  });
  console.log("   OK: Cleaned up");

  console.log("\n=== ALL PASS CRITERIA MET ===");
  console.log("TEST PASSED: TEST-SC-013");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
