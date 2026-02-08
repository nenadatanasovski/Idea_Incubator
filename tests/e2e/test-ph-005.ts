/**
 * TEST-PH-005: Bulk classify all documents
 */

import {
  classifyAllDocuments,
} from "../../agents/ideation/document-classifier.js";
import * as fs from "fs";
import * as path from "path";

const USERS_ROOT = path.join(process.cwd(), "users");
const TEST_USER = "test-user";
const TEST_IDEA = "test-idea";

async function setupTestData(): Promise<void> {
  // Create test user and idea directories
  const ideaFolder = path.join(USERS_ROOT, TEST_USER, "ideas", TEST_IDEA);

  // Create directories
  fs.mkdirSync(path.join(ideaFolder, "research"), { recursive: true });
  fs.mkdirSync(path.join(ideaFolder, "planning"), { recursive: true });
  fs.mkdirSync(path.join(ideaFolder, ".metadata"), { recursive: true });

  // Create test markdown files
  fs.writeFileSync(path.join(ideaFolder, "README.md"), "# Test Idea\n");
  fs.writeFileSync(path.join(ideaFolder, "development.md"), "# Development\n");
  fs.writeFileSync(
    path.join(ideaFolder, "target-users.md"),
    "# Target Users\n",
  );
  fs.writeFileSync(
    path.join(ideaFolder, "research", "market.md"),
    "# Market Research\n",
  );
  fs.writeFileSync(
    path.join(ideaFolder, "research", "competitive.md"),
    "# Competitive Analysis\n",
  );
  fs.writeFileSync(path.join(ideaFolder, "planning", "brief.md"), "# Brief\n");
}

async function cleanupTestData(): Promise<void> {
  const ideaFolder = path.join(USERS_ROOT, TEST_USER, "ideas", TEST_IDEA);
  if (fs.existsSync(ideaFolder)) {
    fs.rmSync(ideaFolder, { recursive: true });
  }
  // Clean up test user if empty
  const userFolder = path.join(USERS_ROOT, TEST_USER);
  if (fs.existsSync(userFolder)) {
    const ideasFolder = path.join(userFolder, "ideas");
    const ideas = fs.existsSync(ideasFolder) ? fs.readdirSync(ideasFolder) : [];
    if (ideas.length === 0) {
      fs.rmSync(userFolder, { recursive: true });
    }
  }
}

async function runTest(): Promise<void> {
  console.log("TEST-PH-005: Bulk classify all documents\n");

  try {
    // Setup test data
    await setupTestData();

    // Test 1: classifyAllDocuments returns array
    const classifications = await classifyAllDocuments(
      TEST_USER,
      TEST_IDEA,
      "RESEARCH",
    );
    console.log(
      "1. Returns array:",
      Array.isArray(classifications) ? "PASS" : "FAIL",
    );

    // Test 2: All items have correct structure
    const hasCorrectStructure = classifications.every(
      (c) =>
        typeof c.path === "string" &&
        ["required", "recommended", "optional"].includes(c.classification),
    );
    console.log("2. Correct structure:", hasCorrectStructure ? "PASS" : "FAIL");

    // Test 3: All .md files are included
    const paths = classifications.map((c) => c.path);
    const expectedPaths = [
      "README.md",
      "development.md",
      "target-users.md",
      "research/market.md",
      "research/competitive.md",
      "planning/brief.md",
    ];
    const allIncluded = expectedPaths.every((p) => paths.includes(p));
    console.log("3. All .md files included:", allIncluded ? "PASS" : "FAIL");

    // Test 4: Reason is provided
    const hasReasons = classifications.every(
      (c) => c.reason && c.reason.length > 0,
    );
    console.log("4. Reason provided:", hasReasons ? "PASS" : "FAIL");

    // Test 5: Sorted by classification (required first, then recommended, then optional)
    let prevPriority = 2; // required = 2
    let sorted = true;
    const priorityMap: Record<string, number> = {
      required: 2,
      recommended: 1,
      optional: 0,
    };
    for (const c of classifications) {
      const priority = priorityMap[c.classification];
      if (priority > prevPriority) {
        sorted = false;
        break;
      }
      prevPriority = priority;
    }
    console.log("5. Sorted by classification:", sorted ? "PASS" : "FAIL");

    // Print classifications for verification
    console.log("\nClassifications:");
    classifications.forEach((c) => {
      console.log(
        `  ${c.classification.padEnd(12)} ${c.path.padEnd(30)} ${c.reason}`,
      );
    });

    // Overall result
    const allPassed =
      hasCorrectStructure && allIncluded && hasReasons && sorted;
    console.log(
      "\n" +
        (allPassed
          ? "TEST-PH-005: ALL PASS CRITERIA MET"
          : "TEST-PH-005: SOME CRITERIA FAILED"),
    );
  } finally {
    await cleanupTestData();
  }
}

runTest().catch(console.error);
