/**
 * Neo4j Schema Setup Script
 *
 * Applies constraints, indexes, and full-text search from 02-NEO4J-SCHEMA.md
 * Run with: npx tsx scripts/neo4j-setup-schema.ts
 */

import { getSession, verifyConnection, closeDriver } from "../config/neo4j.js";

const CONSTRAINTS = [
  // Primary key constraint
  "CREATE CONSTRAINT block_id_unique IF NOT EXISTS FOR (b:Block) REQUIRE b.id IS UNIQUE",
];

const INDEXES = [
  // Session/Idea scoping (required for ALL queries)
  "CREATE INDEX idx_block_session IF NOT EXISTS FOR (b:Block) ON (b.sessionId)",
  "CREATE INDEX idx_block_idea IF NOT EXISTS FOR (b:Block) ON (b.ideaId)",

  // Status filtering
  "CREATE INDEX idx_block_status IF NOT EXISTS FOR (b:Block) ON (b.status)",

  // Composite: Session + Status (most common pattern)
  "CREATE INDEX idx_block_session_status IF NOT EXISTS FOR (b:Block) ON (b.sessionId, b.status)",

  // Title search
  "CREATE INDEX idx_block_title IF NOT EXISTS FOR (b:Block) ON (b.title)",

  // Artifact linking
  "CREATE INDEX idx_block_artifact IF NOT EXISTS FOR (b:Block) ON (b.artifactId)",

  // Temporal queries
  "CREATE INDEX idx_block_created IF NOT EXISTS FOR (b:Block) ON (b.createdAt)",
  "CREATE INDEX idx_block_updated IF NOT EXISTS FOR (b:Block) ON (b.updatedAt)",

  // Confidence-based filtering
  "CREATE INDEX idx_block_confidence IF NOT EXISTS FOR (b:Block) ON (b.confidence)",

  // Abstraction level queries
  "CREATE INDEX idx_block_abstraction IF NOT EXISTS FOR (b:Block) ON (b.abstractionLevel)",

  // Topic dimension queries
  "CREATE INDEX idx_block_topic IF NOT EXISTS FOR (b:Block) ON (b.topic)",
];

const FULLTEXT_INDEX = `
  CREATE FULLTEXT INDEX block_content_search IF NOT EXISTS
  FOR (b:Block) ON EACH [b.title, b.content]
`;

async function setupSchema(): Promise<void> {
  console.log("\n🔧 Neo4j Schema Setup\n");
  console.log("=".repeat(60));

  // Verify connection first
  console.log("\n📡 Verifying connection...");
  const connected = await verifyConnection();
  if (!connected) {
    throw new Error("Cannot connect to Neo4j. Is the database running?");
  }
  console.log("✅ Connected to Neo4j\n");

  const session = getSession();

  try {
    // Apply constraints
    console.log("📋 Creating constraints...");
    for (const constraint of CONSTRAINTS) {
      try {
        await session.run(constraint);
        console.log(`  ✅ ${constraint.substring(0, 60)}...`);
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          console.log(
            `  ⏭️  Already exists: ${constraint.substring(0, 40)}...`,
          );
        } else {
          throw error;
        }
      }
    }

    // Apply indexes
    console.log("\n📋 Creating indexes...");
    for (const index of INDEXES) {
      try {
        await session.run(index);
        const indexName = index.match(/idx_\w+/)?.[0] || "index";
        console.log(`  ✅ ${indexName}`);
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          const indexName = index.match(/idx_\w+/)?.[0] || "index";
          console.log(`  ⏭️  Already exists: ${indexName}`);
        } else {
          throw error;
        }
      }
    }

    // Apply full-text index
    console.log("\n📋 Creating full-text search index...");
    try {
      await session.run(FULLTEXT_INDEX);
      console.log("  ✅ block_content_search");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("  ⏭️  Already exists: block_content_search");
      } else {
        throw error;
      }
    }

    // Verify schema
    console.log("\n🔍 Verifying schema...");

    const constraints = await session.run("SHOW CONSTRAINTS");
    console.log(`  Constraints: ${constraints.records.length}`);

    const indexes = await session.run("SHOW INDEXES");
    console.log(`  Indexes: ${indexes.records.length}`);

    // Test with a sample block
    console.log("\n🧪 Testing schema with sample block...");

    await session.run(`
      CREATE (b:Block:Knowledge {
        id: 'test-schema-' + randomUUID(),
        sessionId: 'test-session',
        title: 'Schema test block',
        content: 'This is a test block to verify the schema works.',
        status: 'active',
        confidence: 0.9,
        abstractionLevel: 'implementation',
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN b.id as id
    `);
    console.log("  ✅ Created test block");

    // Query it back
    const result = await session.run(`
      MATCH (b:Block {sessionId: 'test-session'})
      WHERE b.title CONTAINS 'Schema test'
      RETURN b.id as id, b.title as title
    `);

    if (result.records.length > 0) {
      console.log("  ✅ Query returned block");
    } else {
      throw new Error("Test block not found after creation");
    }

    // Clean up test block
    await session.run(`
      MATCH (b:Block {sessionId: 'test-session'})
      WHERE b.title CONTAINS 'Schema test'
      DELETE b
    `);
    console.log("  ✅ Cleaned up test block");

    console.log("\n" + "=".repeat(60));
    console.log("✅ Schema setup complete!\n");
    console.log("Next steps:");
    console.log("  1. Run migration: npx tsx scripts/migrate-to-neo4j.ts");
    console.log("  2. Verify data: npm run neo4j:verify");
    console.log("\n");
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    await setupSchema();
  } catch (error) {
    console.error("\n❌ Schema setup failed:", error);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

main();
