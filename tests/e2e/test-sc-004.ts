/**
 * TEST-SC-004: Convert Draft to Named Idea
 *
 * Tests the POST /api/ideation/session/:sessionId/name-idea endpoint
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { createDraftFolder } from "../../utils/folder-structure.js";
import { run, getOne, saveDb } from "../../database/db.js";

const API_BASE = "http://localhost:3001/api/ideation";

interface TestResult {
  passed: boolean;
  criteria: { [key: string]: boolean };
  errors: string[];
}

/**
 * Create a test session directly in the database.
 */
async function createTestSession(
  userSlug: string,
  ideaSlug: string,
): Promise<string> {
  const sessionId = uuidv4();
  await run(
    `INSERT INTO ideation_sessions (id, user_slug, idea_slug, profile_id) VALUES (?, ?, ?, ?)`,
    [sessionId, userSlug, ideaSlug, "test-profile"],
  );
  await saveDb();
  return sessionId;
}

async function runTests(): Promise<TestResult> {
  const result: TestResult = {
    passed: false,
    criteria: {},
    errors: [],
  };

  const userSlug = "test-user-sc004";

  try {
    // Setup: Create a draft folder and session
    console.log("Setting up test environment...");
    const draft = await createDraftFolder(userSlug);
    console.log("Created draft:", draft.draftId);

    const sessionId = await createTestSession(userSlug, draft.draftId);
    console.log("Created session:", sessionId);

    // Test 1: Endpoint exists
    console.log("\n--- Test 1: Endpoint exists ---");
    const response1 = await fetch(
      `${API_BASE}/session/${sessionId}/name-idea`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My New Idea", ideaType: "business" }),
      },
    );
    result.criteria["endpoint_exists"] = response1.status !== 404;
    console.log(
      "Endpoint exists:",
      result.criteria["endpoint_exists"],
      "Status:",
      response1.status,
    );

    if (!result.criteria["endpoint_exists"]) {
      result.errors.push(
        "Endpoint POST /api/ideation/session/:sessionId/name-idea does not exist",
      );
      return result;
    }

    const data1 = await response1.json();
    console.log("Response:", JSON.stringify(data1, null, 2));

    // Test 2: Renames draft folder to slugified title
    const expectedSlug = "my-new-idea";
    const newIdeaPath = path.join(
      process.cwd(),
      "users",
      userSlug,
      "ideas",
      expectedSlug,
    );
    const oldDraftPath = path.join(
      process.cwd(),
      "users",
      userSlug,
      "ideas",
      draft.draftId,
    );

    result.criteria["renames_draft_folder"] =
      fs.existsSync(newIdeaPath) && !fs.existsSync(oldDraftPath);
    console.log(
      "Renames draft folder:",
      result.criteria["renames_draft_folder"],
    );
    console.log("  New path exists:", fs.existsSync(newIdeaPath));
    console.log("  Old path removed:", !fs.existsSync(oldDraftPath));

    // Test 3: Adds all templates to the renamed folder
    const requiredFiles = [
      "README.md",
      "development.md",
      "target-users.md",
      "problem-solution.md",
      "business-model.md",
      "team.md",
      "research/market.md",
      "research/competitive.md",
      "validation/assumptions.md",
      "planning/brief.md",
      "planning/mvp-scope.md",
      "planning/architecture.md",
      "marketing/gtm.md",
      "marketing/pitch.md",
      "networking/contacts.md",
      "build/spec.md",
      ".metadata/relationships.json",
      ".metadata/priority.json",
      ".metadata/index.json",
    ];

    const missingFiles: string[] = [];
    for (const file of requiredFiles) {
      const filePath = path.join(newIdeaPath, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }
    result.criteria["adds_templates"] = missingFiles.length === 0;
    console.log("Adds all templates:", result.criteria["adds_templates"]);
    if (missingFiles.length > 0) {
      console.log("  Missing files:", missingFiles);
    }

    // Test 4: Updates session's idea_slug in database
    const sessionRow = await getOne<{ idea_slug: string }>(
      "SELECT idea_slug FROM ideation_sessions WHERE id = ?",
      [sessionId],
    );
    result.criteria["updates_session_db"] =
      sessionRow?.idea_slug === expectedSlug;
    console.log(
      "Updates session idea_slug:",
      result.criteria["updates_session_db"],
      "Value:",
      sessionRow?.idea_slug,
    );

    // Test 5: Returns updated session with new ideaSlug
    result.criteria["returns_updated_session"] =
      response1.status === 200 && data1.session?.ideaSlug === expectedSlug;
    console.log(
      "Returns updated session:",
      result.criteria["returns_updated_session"],
    );

    // Test 6: Returns 400 if session not linked to draft
    console.log("\n--- Test 6: Returns 400 for non-draft session ---");
    const nonDraftSessionId = await createTestSession(
      userSlug + "-nodraft",
      "regular-idea",
    );
    const response6 = await fetch(
      `${API_BASE}/session/${nonDraftSessionId}/name-idea`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", ideaType: "business" }),
      },
    );
    result.criteria["returns_400_for_non_draft"] = response6.status === 400;
    console.log(
      "Returns 400 for non-draft:",
      result.criteria["returns_400_for_non_draft"],
      "Status:",
      response6.status,
    );

    // Test 7: Returns 409 if target slug already exists
    console.log("\n--- Test 7: Returns 409 for duplicate slug ---");
    // Create another draft
    const draft2 = await createDraftFolder(userSlug);
    const sessionId2 = await createTestSession(userSlug, draft2.draftId);

    const response7 = await fetch(
      `${API_BASE}/session/${sessionId2}/name-idea`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My New Idea", ideaType: "business" }), // Same title as before
      },
    );
    result.criteria["returns_409_for_duplicate"] = response7.status === 409;
    console.log(
      "Returns 409 for duplicate:",
      result.criteria["returns_409_for_duplicate"],
      "Status:",
      response7.status,
    );

    // Test 8: Handles special characters in title (slugifies correctly)
    console.log("\n--- Test 8: Handles special characters ---");
    const draft3 = await createDraftFolder(userSlug);
    const sessionId3 = await createTestSession(userSlug, draft3.draftId);

    const response8 = await fetch(
      `${API_BASE}/session/${sessionId3}/name-idea`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Idea! @#$% Special (Chars) 123",
          ideaType: "business",
        }),
      },
    );
    const data8 = await response8.json();
    const expectedSpecialSlug = "test-idea-special-chars-123";
    result.criteria["handles_special_chars"] =
      response8.status === 200 &&
      data8.session?.ideaSlug === expectedSpecialSlug;
    console.log(
      "Handles special characters:",
      result.criteria["handles_special_chars"],
    );
    console.log("  Expected slug:", expectedSpecialSlug);
    console.log("  Actual slug:", data8.session?.ideaSlug);

    // Test 9: Updates all artifacts' idea_slug in database
    console.log("\n--- Test 9: Updates artifacts idea_slug ---");
    // Create a draft and add an artifact to it
    const draft4 = await createDraftFolder(userSlug);
    const sessionId4 = await createTestSession(userSlug, draft4.draftId);

    // Insert a test artifact with the draft slug
    const artifactId = uuidv4();
    await run(
      `INSERT INTO ideation_artifacts (id, session_id, user_slug, idea_slug, type, title, content, file_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        artifactId,
        sessionId4,
        userSlug,
        draft4.draftId,
        "markdown",
        "Test Artifact",
        "Test content",
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    await saveDb();

    await fetch(`${API_BASE}/session/${sessionId4}/name-idea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Artifact Test Idea",
        ideaType: "business",
      }),
    });

    const artifactRow = await getOne<{ idea_slug: string }>(
      "SELECT idea_slug FROM ideation_artifacts WHERE id = ?",
      [artifactId],
    );
    result.criteria["updates_artifacts_db"] =
      artifactRow?.idea_slug === "artifact-test-idea";
    console.log(
      "Updates artifacts idea_slug:",
      result.criteria["updates_artifacts_db"],
      "Value:",
      artifactRow?.idea_slug,
    );

    // Calculate overall pass
    result.passed = Object.values(result.criteria).every((v) => v);
  } catch (error) {
    result.errors.push(`Test error: ${error}`);
    console.error("Test error:", error);
  }

  return result;
}

// Run tests
runTests()
  .then((result) => {
    console.log("\n========================================");
    console.log("TEST-SC-004 RESULTS");
    console.log("========================================");
    console.log("Criteria:");
    for (const [key, value] of Object.entries(result.criteria)) {
      console.log(`  [${value ? "PASS" : "FAIL"}] ${key}`);
    }
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }
    console.log(
      "\n" +
        (result.passed
          ? "TEST PASSED: TEST-SC-004"
          : "TEST FAILED: TEST-SC-004"),
    );
    process.exit(result.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
