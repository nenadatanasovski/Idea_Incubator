/**
 * SQLite to Neo4j Migration Script
 *
 * Migrates blocks and links from SQLite to Neo4j.
 * Run AFTER neo4j-setup-schema.ts and migrate-block-types.ts
 *
 * Usage: npx tsx scripts/migrate-to-neo4j.ts [--dry-run] [--verbose]
 */

import { query } from "../database/db.js";
import { getSession, verifyConnection, closeDriver } from "../config/neo4j.js";

interface MigrationStats {
  blocksTotal: number;
  blocksMigrated: number;
  blocksErrors: number;
  linksTotal: number;
  linksMigrated: number;
  linksErrors: number;
}

// Map block type to Neo4j label
const TYPE_TO_LABEL: Record<string, string> = {
  knowledge: "Knowledge",
  decision: "Decision",
  assumption: "Assumption",
  question: "Question",
  requirement: "Requirement",
  task: "Task",
  proposal: "Proposal",
  artifact: "Artifact",
  evidence: "Evidence",
};

async function migrateBlocks(
  dryRun: boolean,
  verbose: boolean,
): Promise<Partial<MigrationStats>> {
  console.log("\n📦 Migrating blocks...\n");

  const blocks = await query<{
    id: string;
    session_id: string;
    idea_id: string | null;
    type: string;
    title: string | null;
    content: string;
    properties: string | null;
    status: string;
    confidence: number | null;
    abstraction_level: string | null;
    created_at: string;
    updated_at: string;
    extracted_from_message_id: string | null;
    artifact_id: string | null;
  }>("SELECT * FROM memory_blocks WHERE status != ?", ["superseded"]);

  const stats = {
    blocksTotal: blocks.length,
    blocksMigrated: 0,
    blocksErrors: 0,
  };

  console.log(`Found ${blocks.length} blocks to migrate\n`);

  if (blocks.length === 0) {
    return stats;
  }

  const session = getSession();

  try {
    for (const block of blocks) {
      const label = TYPE_TO_LABEL[block.type] || "Knowledge";

      if (verbose) {
        const preview = (
          block.title || block.content.substring(0, 40)
        ).substring(0, 40);
        console.log(`  📝 ${block.type} → :${label} "${preview}..."`);
      }

      if (!dryRun) {
        try {
          await session.run(
            `
            CREATE (b:Block:${label} {
              id: $id,
              sessionId: $sessionId,
              ideaId: $ideaId,
              title: $title,
              content: $content,
              properties: $properties,
              status: $status,
              confidence: $confidence,
              abstractionLevel: $abstractionLevel,
              topic: $topic,
              createdAt: datetime($createdAt),
              updatedAt: datetime($updatedAt),
              extractedFromMessageId: $extractedFromMessageId,
              artifactId: $artifactId
            })
          `,
            {
              id: block.id,
              sessionId: block.session_id,
              ideaId: block.idea_id,
              title: block.title,
              content: block.content,
              properties: block.properties,
              status: block.status || "active",
              confidence: block.confidence,
              abstractionLevel: block.abstraction_level,
              topic: extractTopic(block.properties),
              createdAt: block.created_at || new Date().toISOString(),
              updatedAt: block.updated_at || new Date().toISOString(),
              extractedFromMessageId: block.extracted_from_message_id,
              artifactId: block.artifact_id,
            },
          );

          stats.blocksMigrated++;
        } catch (error: any) {
          console.error(
            `  ❌ Error migrating block ${block.id}:`,
            error.message,
          );
          stats.blocksErrors++;
        }
      } else {
        stats.blocksMigrated++;
      }
    }
  } finally {
    await session.close();
  }

  return stats;
}

async function migrateLinks(
  dryRun: boolean,
  verbose: boolean,
): Promise<Partial<MigrationStats>> {
  console.log("\n🔗 Migrating links...\n");

  const links = await query<{
    id: string;
    session_id: string;
    source_block_id: string;
    target_block_id: string;
    link_type: string;
    degree: string | null;
    confidence: number | null;
    reason: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM memory_links WHERE status = ?", ["active"]);

  const stats = {
    linksTotal: links.length,
    linksMigrated: 0,
    linksErrors: 0,
  };

  console.log(`Found ${links.length} links to migrate\n`);

  if (links.length === 0) {
    return stats;
  }

  const session = getSession();

  // Map link types to Neo4j relationship types (SCREAMING_SNAKE_CASE)
  const linkTypeToRel: Record<string, string> = {
    addresses: "ADDRESSES",
    creates: "CREATES",
    requires: "REQUIRES",
    conflicts: "CONFLICTS_WITH",
    supports: "SUPPORTS",
    depends_on: "DEPENDS_ON",
    enables: "ENABLES",
    suggests: "SUGGESTS",
    supersedes: "SUPERSEDES",
    validates: "VALIDATES",
    invalidates: "INVALIDATES",
    references: "REFERENCES",
    evidence_for: "EVIDENCE_FOR",
    elaborates: "ELABORATES",
    refines: "REFINES",
    specializes: "SPECIALIZES",
    alternative_to: "ALTERNATIVE_TO",
    instance_of: "INSTANCE_OF",
    constrained_by: "CONSTRAINED_BY",
    derived_from: "DERIVED_FROM",
    measured_by: "MEASURED_BY",
  };

  try {
    for (const link of links) {
      const relType = linkTypeToRel[link.link_type] || "REFERENCES";

      if (verbose) {
        console.log(
          `  🔗 ${link.source_block_id.substring(0, 8)}... -[${relType}]-> ${link.target_block_id.substring(0, 8)}...`,
        );
      }

      if (!dryRun) {
        try {
          await session.run(
            `
            MATCH (source:Block {id: $sourceId})
            MATCH (target:Block {id: $targetId})
            CREATE (source)-[r:${relType} {
              id: $id,
              sessionId: $sessionId,
              degree: $degree,
              confidence: $confidence,
              reason: $reason,
              status: $status,
              createdAt: datetime($createdAt),
              updatedAt: datetime($updatedAt)
            }]->(target)
          `,
            {
              id: link.id,
              sessionId: link.session_id,
              sourceId: link.source_block_id,
              targetId: link.target_block_id,
              degree: link.degree,
              confidence: link.confidence,
              reason: link.reason,
              status: link.status,
              createdAt: link.created_at || new Date().toISOString(),
              updatedAt: link.updated_at || new Date().toISOString(),
            },
          );

          stats.linksMigrated++;
        } catch (error: any) {
          if (error.message?.includes("already exists")) {
            // Skip duplicate
          } else {
            console.error(
              `  ❌ Error migrating link ${link.id}:`,
              error.message,
            );
            stats.linksErrors++;
          }
        }
      } else {
        stats.linksMigrated++;
      }
    }
  } finally {
    await session.close();
  }

  return stats;
}

function extractTopic(properties: string | null): string | null {
  if (!properties) return null;
  try {
    const props = JSON.parse(properties);
    return props.topic || props.graphMembership?.[0] || null;
  } catch {
    return null;
  }
}

async function validateMigration(): Promise<boolean> {
  console.log("\n🔍 Validating migration...\n");

  const session = getSession();

  try {
    // Count blocks in Neo4j
    const blockCount = await session.run(
      "MATCH (b:Block) RETURN count(b) as count",
    );
    const neo4jBlocks = blockCount.records[0].get("count").toNumber();

    // Count blocks in SQLite
    const sqliteBlocks = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM memory_blocks WHERE status != 'superseded'",
    );

    console.log(`  SQLite blocks: ${sqliteBlocks[0]?.count || 0}`);
    console.log(`  Neo4j blocks:  ${neo4jBlocks}`);

    if (neo4jBlocks !== (sqliteBlocks[0]?.count || 0)) {
      console.log("  ⚠️  Count mismatch (may be expected if some failed)");
    } else {
      console.log("  ✅ Block counts match");
    }

    // Count links
    const linkCount = await session.run(
      "MATCH ()-[r]->() RETURN count(r) as count",
    );
    const neo4jLinks = linkCount.records[0].get("count").toNumber();

    const sqliteLinks = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM memory_links WHERE status = 'active'",
    );

    console.log(`  SQLite links:  ${sqliteLinks[0]?.count || 0}`);
    console.log(`  Neo4j links:   ${neo4jLinks}`);

    // Sample query test
    console.log("\n  Testing sample queries...");

    const sampleQuery = await session.run(`
      MATCH (b:Block)
      WHERE b.status = 'active'
      RETURN b.id as id
      LIMIT 5
    `);
    console.log(
      `  ✅ Sample query returned ${sampleQuery.records.length} results`,
    );

    return true;
  } finally {
    await session.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  console.log(`\n🚀 SQLite to Neo4j Migration ${dryRun ? "(DRY RUN)" : ""}\n`);
  console.log("=".repeat(60));

  try {
    // Verify Neo4j connection
    console.log("\n📡 Verifying Neo4j connection...");
    const connected = await verifyConnection();
    if (!connected) {
      throw new Error(
        "Cannot connect to Neo4j. Run: docker-compose -f docker-compose.neo4j.yml up -d",
      );
    }
    console.log("✅ Connected to Neo4j");

    // Migrate blocks
    const blockStats = await migrateBlocks(dryRun, verbose);

    // Migrate links
    const linkStats = await migrateLinks(dryRun, verbose);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `\nBlocks: ${blockStats.blocksMigrated}/${blockStats.blocksTotal} migrated, ${blockStats.blocksErrors} errors`,
    );
    console.log(
      `Links:  ${linkStats.linksMigrated}/${linkStats.linksTotal} migrated, ${linkStats.linksErrors} errors`,
    );

    // Validate if not dry run
    if (!dryRun) {
      await validateMigration();
    } else {
      console.log("\n💡 Run without --dry-run to apply migration\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

main();
