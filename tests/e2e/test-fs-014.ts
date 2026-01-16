/**
 * TEST-FS-014: Store Relationship in Database
 *
 * Verifies that the relationship manager functions work correctly:
 * - addRelationship inserts row into idea_relationships table
 * - getRelationships returns all relationships for an idea
 * - getChildren returns ideas where this idea is parent
 * - getParent returns parent idea if exists, null otherwise
 * - Relationships correctly distinguish internal vs external
 * - Metadata stored as JSON
 */

import { getDb, saveDb, run, query } from "../../database/db.js";
import {
  addRelationship,
  getRelationships,
  getChildren,
  getParent,
  removeRelationship,
} from "../../utils/relationship-manager.js";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function cleanup(): Promise<void> {
  // Clean up test data
  await run(`DELETE FROM idea_relationships WHERE from_user LIKE 'test-%'`);
  await saveDb();
}

async function main(): Promise<void> {
  console.log("\n🧪 TEST-FS-014: Store Relationship in Database\n");

  // Initialize database
  await getDb();

  // Clean up any previous test data
  await cleanup();

  // Test 1: addRelationship inserts row into idea_relationships table
  await test("addRelationship inserts row into idea_relationships table", async () => {
    const id = await addRelationship(
      "test-user1",
      "test-feature-idea",
      "test-user1",
      "test-parent-app",
      "parent",
      { note: "test relationship" },
    );

    if (!id) {
      throw new Error("addRelationship did not return an ID");
    }

    // Verify the row was inserted
    const rows = await query<{ id: string }>(
      `SELECT id FROM idea_relationships WHERE id = ?`,
      [id],
    );
    if (rows.length !== 1) {
      throw new Error(`Expected 1 row, got ${rows.length}`);
    }
  });

  // Test 2: getRelationships returns all relationships for an idea
  await test("getRelationships returns all relationships for an idea", async () => {
    // Add another relationship
    await addRelationship(
      "test-user1",
      "test-feature-idea",
      "test-user2",
      "test-other-idea",
      "integrates_with",
      {},
    );

    const relationships = await getRelationships(
      "test-user1",
      "test-feature-idea",
    );

    if (relationships.length < 2) {
      throw new Error(
        `Expected at least 2 relationships, got ${relationships.length}`,
      );
    }

    // Verify relationships have the expected structure
    const hasParent = relationships.some(
      (r) => r.relationshipType === "parent",
    );
    const hasIntegration = relationships.some(
      (r) => r.relationshipType === "integrates_with",
    );

    if (!hasParent) {
      throw new Error("Missing parent relationship");
    }
    if (!hasIntegration) {
      throw new Error("Missing integrates_with relationship");
    }
  });

  // Test 3: getChildren returns ideas where this idea is parent
  await test("getChildren returns ideas where this idea is parent", async () => {
    // The 'test-feature-idea' has a parent relationship pointing to 'test-parent-app'
    // So 'test-parent-app' should have 'test-feature-idea' as a child
    const children = await getChildren("test-user1", "test-parent-app");

    if (children.length !== 1) {
      throw new Error(`Expected 1 child, got ${children.length}`);
    }

    if (children[0].slug !== "test-feature-idea") {
      throw new Error(
        `Expected child slug 'test-feature-idea', got '${children[0].slug}'`,
      );
    }

    if (children[0].userSlug !== "test-user1") {
      throw new Error(
        `Expected child userSlug 'test-user1', got '${children[0].userSlug}'`,
      );
    }
  });

  // Test 4: getParent returns parent idea if exists
  await test("getParent returns parent idea if exists", async () => {
    const parent = await getParent("test-user1", "test-feature-idea");

    if (!parent) {
      throw new Error("Expected parent to exist, got null");
    }

    if (parent.slug !== "test-parent-app") {
      throw new Error(
        `Expected parent slug 'test-parent-app', got '${parent.slug}'`,
      );
    }

    if (parent.userSlug !== "test-user1") {
      throw new Error(
        `Expected parent userSlug 'test-user1', got '${parent.userSlug}'`,
      );
    }
  });

  // Test 5: getParent returns null when no parent exists
  await test("getParent returns null when no parent exists", async () => {
    const parent = await getParent("test-user1", "test-parent-app");

    if (parent !== null) {
      throw new Error(`Expected null, got ${JSON.stringify(parent)}`);
    }
  });

  // Test 6: Relationships correctly distinguish internal vs external
  await test("Relationships correctly distinguish internal vs external", async () => {
    // Add an external relationship (no toUser/toIdea, has metadata.externalName)
    const externalId = await addRelationship(
      "test-user1",
      "test-shopify-plugin",
      null,
      null,
      "parent",
      { externalName: "Shopify" },
    );

    // Verify it was stored correctly
    const rows = await query<{ to_external: string | null }>(
      `SELECT to_external FROM idea_relationships WHERE id = ?`,
      [externalId],
    );

    if (rows.length !== 1) {
      throw new Error(`Expected 1 row, got ${rows.length}`);
    }

    if (rows[0].to_external !== "Shopify") {
      throw new Error(
        `Expected to_external 'Shopify', got '${rows[0].to_external}'`,
      );
    }
  });

  // Test 7: Metadata stored as JSON
  await test("Metadata stored as JSON", async () => {
    const complexMetadata = {
      description: "A complex relationship",
      tags: ["important", "feature"],
      priority: 1,
      nested: {
        key: "value",
      },
    };

    const id = await addRelationship(
      "test-user1",
      "test-idea-with-metadata",
      "test-user1",
      "test-other-idea-2",
      "collaboration",
      complexMetadata,
    );

    const rows = await query<{ metadata: string }>(
      `SELECT metadata FROM idea_relationships WHERE id = ?`,
      [id],
    );

    if (rows.length !== 1) {
      throw new Error(`Expected 1 row, got ${rows.length}`);
    }

    // Verify metadata is valid JSON
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(rows[0].metadata);
    } catch {
      throw new Error("Metadata is not valid JSON");
    }

    if (parsedMetadata.description !== "A complex relationship") {
      throw new Error(`Metadata description mismatch`);
    }

    if (
      !Array.isArray(parsedMetadata.tags) ||
      parsedMetadata.tags.length !== 2
    ) {
      throw new Error(`Metadata tags mismatch`);
    }

    if (parsedMetadata.nested?.key !== "value") {
      throw new Error(`Metadata nested value mismatch`);
    }

    // Also verify through the getRelationships function
    const relationships = await getRelationships(
      "test-user1",
      "test-idea-with-metadata",
    );
    const collabRel = relationships.find(
      (r) => r.relationshipType === "collaboration",
    );

    if (!collabRel) {
      throw new Error(
        "Collaboration relationship not found via getRelationships",
      );
    }

    if (collabRel.metadata.description !== "A complex relationship") {
      throw new Error(
        "Metadata not correctly parsed in getRelationships result",
      );
    }
  });

  // Test 8: removeRelationship works correctly
  await test("removeRelationship removes the relationship", async () => {
    const id = await addRelationship(
      "test-user1",
      "test-to-remove",
      "test-user1",
      "test-target",
      "child",
      {},
    );

    // Verify it exists
    let rows = await query<{ id: string }>(
      `SELECT id FROM idea_relationships WHERE id = ?`,
      [id],
    );
    if (rows.length !== 1) {
      throw new Error("Relationship was not created");
    }

    // Remove it
    await removeRelationship(id);

    // Verify it's gone
    rows = await query<{ id: string }>(
      `SELECT id FROM idea_relationships WHERE id = ?`,
      [id],
    );
    if (rows.length !== 0) {
      throw new Error("Relationship was not removed");
    }
  });

  // Clean up test data
  await cleanup();

  // Print summary
  console.log("\n📊 Test Summary\n");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    console.log("\nTEST PASSED: TEST-FS-014");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
