/**
 * TEST-FS-015: Sync Relationships to Metadata File
 *
 * Verifies:
 * - syncRelationshipsToFile creates/updates relationships.json
 * - File contains all database relationships
 * - syncRelationshipsFromFile reads file and updates database
 * - Bidirectional sync is idempotent
 * - Handles missing file gracefully (creates it)
 * - Handles empty relationships
 */
import * as fs from "fs";
import * as path from "path";
import {
  addRelationship,
  getRelationships,
  getParent,
  syncRelationshipsToFile,
  syncRelationshipsFromFile,
} from "../../utils/relationship-manager.js";
import { createIdeaFolder } from "../../utils/folder-structure.js";
import { run, saveDb } from "../../database/db.js";
import { getConfig } from "../../config/index.js";
const TEST_USER = "test-user-fs015";
const TEST_IDEA = "sync-test-idea";
async function cleanup() {
  // Clean up test data from database
  await run("DELETE FROM idea_relationships WHERE from_user = ?", [TEST_USER]);
  await saveDb();
  // Clean up test folder
  const config = getConfig();
  const projectRoot = path.dirname(config.paths.ideas);
  const userPath = path.join(projectRoot, "users", TEST_USER);
  if (fs.existsSync(userPath)) {
    fs.rmSync(userPath, { recursive: true });
  }
}
async function test1_syncRelationshipsToFile_createsFile() {
  console.log(
    "\n=== Test 1: syncRelationshipsToFile creates/updates relationships.json ===",
  );
  // Create idea folder
  const ideaPath = await createIdeaFolder(TEST_USER, TEST_IDEA, "business");
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Add a relationship to database
  await addRelationship(
    TEST_USER,
    TEST_IDEA,
    TEST_USER,
    "parent-idea",
    "parent",
    {},
  );
  // Sync to file
  await syncRelationshipsToFile(TEST_USER, TEST_IDEA);
  // Verify file exists
  if (!fs.existsSync(relPath)) {
    throw new Error("relationships.json was not created");
  }
  // Verify file content
  const content = JSON.parse(fs.readFileSync(relPath, "utf-8"));
  if (!content.parent || content.parent.slug !== "parent-idea") {
    throw new Error(
      `Parent relationship not in file. Got: ${JSON.stringify(content.parent)}`,
    );
  }
  console.log("✓ syncRelationshipsToFile creates/updates relationships.json");
  return true;
}
async function test2_fileContainsAllDatabaseRelationships() {
  console.log("\n=== Test 2: File contains all database relationships ===");
  const ideaPath = path.join(
    path.dirname(getConfig().paths.ideas),
    "users",
    TEST_USER,
    "ideas",
    TEST_IDEA,
  );
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Add more relationships
  await addRelationship(
    TEST_USER,
    TEST_IDEA,
    TEST_USER,
    "integration-1",
    "integrates_with",
    {},
  );
  await addRelationship(
    TEST_USER,
    TEST_IDEA,
    TEST_USER,
    "old-idea",
    "evolved_from",
    {},
  );
  await addRelationship(
    TEST_USER,
    TEST_IDEA,
    TEST_USER,
    "competitor",
    "competes_with",
    {},
  );
  // Sync to file
  await syncRelationshipsToFile(TEST_USER, TEST_IDEA);
  // Verify file content
  const content = JSON.parse(fs.readFileSync(relPath, "utf-8"));
  if (!content.parent || content.parent.slug !== "parent-idea") {
    throw new Error("Parent relationship missing from file");
  }
  if (!content.integrates_with || content.integrates_with.length === 0) {
    throw new Error("integrates_with missing from file");
  }
  if (!content.evolved_from || content.evolved_from.slug !== "old-idea") {
    throw new Error("evolved_from missing from file");
  }
  if (
    !content.ai_detected?.competes_with ||
    content.ai_detected.competes_with.length === 0
  ) {
    throw new Error("ai_detected.competes_with missing from file");
  }
  console.log("✓ File contains all database relationships");
  return true;
}
async function test3_syncRelationshipsFromFile_updatesDatabase() {
  console.log(
    "\n=== Test 3: syncRelationshipsFromFile reads file and updates database ===",
  );
  const ideaPath = path.join(
    path.dirname(getConfig().paths.ideas),
    "users",
    TEST_USER,
    "ideas",
    TEST_IDEA,
  );
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Modify the file directly
  const content = JSON.parse(fs.readFileSync(relPath, "utf-8"));
  content.parent = { type: "internal", slug: "new-parent", name: null };
  content.forked_from = { user: TEST_USER, slug: "forked-source" };
  fs.writeFileSync(relPath, JSON.stringify(content, null, 2), "utf-8");
  // Sync from file
  await syncRelationshipsFromFile(TEST_USER, TEST_IDEA);
  // Verify database was updated
  const parent = await getParent(TEST_USER, TEST_IDEA);
  if (!parent || parent.slug !== "new-parent") {
    throw new Error(
      `Parent not updated in database. Got: ${JSON.stringify(parent)}`,
    );
  }
  const relationships = await getRelationships(TEST_USER, TEST_IDEA);
  const forkedRel = relationships.find(
    (r) => r.relationshipType === "forked_from",
  );
  if (!forkedRel || forkedRel.toIdea !== "forked-source") {
    throw new Error("forked_from relationship not in database");
  }
  console.log("✓ syncRelationshipsFromFile reads file and updates database");
  return true;
}
async function test4_bidirectionalSyncIsIdempotent() {
  console.log("\n=== Test 4: Bidirectional sync is idempotent ===");
  const ideaPath = path.join(
    path.dirname(getConfig().paths.ideas),
    "users",
    TEST_USER,
    "ideas",
    TEST_IDEA,
  );
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Get initial state
  const initialRelationships = await getRelationships(TEST_USER, TEST_IDEA);
  const initialFileContent = fs.readFileSync(relPath, "utf-8");
  // Sync to file then from file multiple times
  await syncRelationshipsToFile(TEST_USER, TEST_IDEA);
  await syncRelationshipsFromFile(TEST_USER, TEST_IDEA);
  await syncRelationshipsToFile(TEST_USER, TEST_IDEA);
  await syncRelationshipsFromFile(TEST_USER, TEST_IDEA);
  // Compare with initial state
  const finalRelationships = await getRelationships(TEST_USER, TEST_IDEA);
  const finalFileContent = fs.readFileSync(relPath, "utf-8");
  // Counts should be similar (we're checking idempotency)
  const initialTypes = initialRelationships
    .map((r) => r.relationshipType)
    .sort();
  const finalTypes = finalRelationships.map((r) => r.relationshipType).sort();
  if (JSON.stringify(initialTypes) !== JSON.stringify(finalTypes)) {
    console.log("Initial types:", initialTypes);
    console.log("Final types:", finalTypes);
    throw new Error("Relationship types changed after idempotent sync");
  }
  console.log("✓ Bidirectional sync is idempotent");
  return true;
}
async function test5_handlesMissingFileGracefully() {
  console.log("\n=== Test 5: Handles missing file gracefully (creates it) ===");
  const testIdea = "missing-file-test";
  const ideaPath = await createIdeaFolder(TEST_USER, testIdea, "service");
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Delete the relationships.json file
  if (fs.existsSync(relPath)) {
    fs.unlinkSync(relPath);
  }
  // Sync from file should create it
  await syncRelationshipsFromFile(TEST_USER, testIdea);
  if (!fs.existsSync(relPath)) {
    throw new Error("syncRelationshipsFromFile did not create missing file");
  }
  // Verify it's valid JSON
  const content = JSON.parse(fs.readFileSync(relPath, "utf-8"));
  if (typeof content !== "object") {
    throw new Error("Created file is not valid JSON object");
  }
  console.log("✓ Handles missing file gracefully (creates it)");
  return true;
}
async function test6_handlesEmptyRelationships() {
  console.log("\n=== Test 6: Handles empty relationships ===");
  const testIdea = "empty-rel-test";
  const ideaPath = await createIdeaFolder(TEST_USER, testIdea, "pivot");
  const relPath = path.join(ideaPath, ".metadata", "relationships.json");
  // Sync to file with no relationships
  await syncRelationshipsToFile(TEST_USER, testIdea);
  // Verify file exists and has valid structure
  const content = JSON.parse(fs.readFileSync(relPath, "utf-8"));
  if (content.parent !== null) {
    throw new Error("parent should be null when no relationships");
  }
  if (
    !Array.isArray(content.integrates_with) ||
    content.integrates_with.length !== 0
  ) {
    throw new Error("integrates_with should be empty array");
  }
  // Sync from file with empty data
  await syncRelationshipsFromFile(TEST_USER, testIdea);
  // Verify no relationships in database
  const relationships = await getRelationships(TEST_USER, testIdea);
  // Filter to only outgoing from this idea
  const outgoing = relationships.filter(
    (r) => r.fromUser === TEST_USER && r.fromIdea === testIdea,
  );
  if (outgoing.length !== 0) {
    throw new Error("Should have no relationships in database for empty file");
  }
  console.log("✓ Handles empty relationships");
  return true;
}
async function runTests() {
  console.log("Running TEST-FS-015: Sync Relationships to Metadata File");
  console.log("=========================================================");
  try {
    await cleanup();
    await test1_syncRelationshipsToFile_createsFile();
    await test2_fileContainsAllDatabaseRelationships();
    await test3_syncRelationshipsFromFile_updatesDatabase();
    await test4_bidirectionalSyncIsIdempotent();
    await test5_handlesMissingFileGracefully();
    await test6_handlesEmptyRelationships();
    console.log("\n=========================================================");
    console.log("ALL TESTS PASSED");
    console.log("=========================================================");
    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error(
      "\n=========================================================",
    );
    console.error("TEST FAILED:", error);
    console.error("=========================================================");
    await cleanup();
    process.exit(1);
  }
}
runTests();
