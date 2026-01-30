#!/usr/bin/env tsx
/**
 * Memory Graph Migration Script
 *
 * Migrates data from deprecated ideation_memory_files table to memory_blocks.
 * This is a one-time migration script for Phase 5 of the memory graph migration.
 *
 * Usage:
 *   npx tsx scripts/migrate-memory-files-to-blocks.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Preview what would be migrated without making changes
 */

import { getDb, saveDb, query } from "../database/db.js";
import { v4 as uuidv4 } from "uuid";

interface LegacyMemoryFile {
  id: string;
  session_id: string;
  file_type: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
}

// Map legacy file types to memory block types
const FILE_TYPE_TO_BLOCK_TYPE: Record<string, string> = {
  self_discovery: "synthesis",
  market_discovery: "synthesis",
  narrowing_state: "decision",
  idea_candidate: "synthesis",
  viability_assessment: "synthesis",
  conversation_summary: "synthesis",
  handoff_notes: "synthesis",
};

// Map legacy file types to graph memberships
const FILE_TYPE_TO_GRAPH_MEMBERSHIPS: Record<string, string[]> = {
  self_discovery: ["user", "problem"],
  market_discovery: ["market", "competition"],
  narrowing_state: ["problem", "solution"],
  idea_candidate: ["solution", "product"],
  viability_assessment: ["market", "validation"],
  conversation_summary: ["problem", "solution"],
  handoff_notes: ["problem", "solution"],
};

async function checkIfAlreadyMigrated(
  sessionId: string,
  fileType: string,
): Promise<boolean> {
  const existing = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM memory_blocks
     WHERE session_id = ?
     AND properties LIKE ?`,
    [sessionId, `%"migrated_from_file_type":"${fileType}"%`],
  );
  return (existing[0]?.count || 0) > 0;
}

async function migrateFile(
  file: LegacyMemoryFile,
  dryRun: boolean,
): Promise<{ success: boolean; reason?: string }> {
  // Check if already migrated
  const alreadyMigrated = await checkIfAlreadyMigrated(
    file.session_id,
    file.file_type,
  );
  if (alreadyMigrated) {
    return { success: false, reason: "Already migrated" };
  }

  const blockType = FILE_TYPE_TO_BLOCK_TYPE[file.file_type] || "synthesis";
  const graphMemberships = FILE_TYPE_TO_GRAPH_MEMBERSHIPS[file.file_type] || [
    "problem",
  ];
  const blockId = `migrated_${uuidv4()}`;

  const properties = {
    migrated_from: "ideation_memory_files",
    migrated_from_file_type: file.file_type,
    original_id: file.id,
    migrated_at: new Date().toISOString(),
    legacy_version: file.version,
  };

  if (dryRun) {
    console.log(`  [DRY RUN] Would migrate: ${file.id}`);
    console.log(`    File type: ${file.file_type} -> Block type: ${blockType}`);
    console.log(`    Graph memberships: ${graphMemberships.join(", ")}`);
    console.log(`    Content length: ${file.content.length} chars`);
    return { success: true };
  }

  const db = await getDb();

  try {
    // Insert into memory_blocks
    db.run(
      `INSERT INTO memory_blocks
       (id, session_id, type, content, properties, status, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', 0.8, ?, ?)`,
      [
        blockId,
        file.session_id,
        blockType,
        file.content,
        JSON.stringify(properties),
        file.created_at,
        file.updated_at,
      ],
    );

    // Insert block type
    db.run(
      `INSERT OR IGNORE INTO memory_block_types (block_id, block_type)
       VALUES (?, ?)`,
      [blockId, blockType],
    );

    // Insert graph memberships
    for (const membership of graphMemberships) {
      db.run(
        `INSERT OR IGNORE INTO memory_graph_memberships (block_id, graph_type, created_at)
         VALUES (?, ?, ?)`,
        [blockId, membership, new Date().toISOString()],
      );
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runMigration(dryRun: boolean): Promise<MigrationResult> {
  console.log("\n=== Memory Graph Migration Script ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`);
  console.log("");

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all legacy memory files
  const legacyFiles = await query<LegacyMemoryFile>(
    `SELECT * FROM ideation_memory_files ORDER BY session_id, file_type`,
  );

  result.total = legacyFiles.length;

  console.log(`Found ${result.total} legacy memory files to process`);
  console.log("");

  if (result.total === 0) {
    console.log("No legacy files to migrate. Migration complete!");
    return result;
  }

  // Group by session for better logging
  const bySession = new Map<string, LegacyMemoryFile[]>();
  for (const file of legacyFiles) {
    const files = bySession.get(file.session_id) || [];
    files.push(file);
    bySession.set(file.session_id, files);
  }

  console.log(`Processing ${bySession.size} sessions...`);
  console.log("");

  for (const [sessionId, files] of bySession) {
    console.log(`Session: ${sessionId.slice(0, 12)}...`);

    for (const file of files) {
      const migrationResult = await migrateFile(file, dryRun);

      if (migrationResult.success) {
        result.migrated++;
        if (!dryRun) {
          console.log(
            `  ✓ Migrated: ${file.file_type} (${file.content.length} chars)`,
          );
        }
      } else {
        if (migrationResult.reason === "Already migrated") {
          result.skipped++;
          console.log(`  - Skipped: ${file.file_type} (already migrated)`);
        } else {
          result.errors.push(
            `${file.id}: ${migrationResult.reason || "Unknown error"}`,
          );
          console.log(
            `  ✗ Error: ${file.file_type} - ${migrationResult.reason}`,
          );
        }
      }
    }
    console.log("");
  }

  // Save changes if not dry run
  if (!dryRun && result.migrated > 0) {
    await saveDb();
    console.log("Changes saved to database.");
  }

  // Summary
  console.log("=== Migration Summary ===");
  console.log(`Total files:    ${result.total}`);
  console.log(`Migrated:       ${result.migrated}`);
  console.log(`Skipped:        ${result.skipped}`);
  console.log(`Errors:         ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((err) => console.log(`  - ${err}`));
  }

  return result;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

runMigration(dryRun)
  .then((result) => {
    process.exit(result.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
