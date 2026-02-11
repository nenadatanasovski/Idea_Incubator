/**
 * ARCH-001 Block Type Migration Script
 *
 * Migrates existing blocks from old types (15+) to new 9 canonical types.
 * Run with: npx tsx scripts/migrate-block-types.ts
 *
 * Options:
 *   --dry-run    Show what would change without modifying data
 *   --verbose    Show each block being migrated
 */

import { query, run, saveDb } from "../database/db.js";

// Type mapping from ARCH-001-TYPE-MAPPING.md
const TYPE_MAPPING: Record<string, string> = {
  // Old schema types → new
  content: "knowledge",
  synthesis: "knowledge",
  pattern: "knowledge",
  derived: "knowledge",
  cycle: "knowledge",
  stakeholder_view: "knowledge",
  decision: "decision",
  option: "decision",
  assumption: "assumption",
  action: "task",
  external: "evidence",
  placeholder: "question",

  // Old extractor types → new
  insight: "knowledge",
  fact: "knowledge",
  requirement: "requirement",
  question: "question",

  // Old memory-block-type.ts types → new
  constraint: "requirement",
  blocker: "task",
  epic: "task",
  story: "task",
  bug: "task",
  milestone: "task",
  evaluation: "evidence",
  learning: "knowledge",
  persona: "knowledge",
  meta: "knowledge",

  // Already correct (no change needed)
  knowledge: "knowledge",
  task: "task",
  proposal: "proposal",
  artifact: "artifact",
  evidence: "evidence",
};

// Types to remove (not migrate to blocks)
const TYPES_TO_REMOVE = ["link", "topic"];

// New valid types
const VALID_NEW_TYPES = [
  "knowledge",
  "decision",
  "assumption",
  "question",
  "requirement",
  "task",
  "proposal",
  "artifact",
  "evidence",
];

interface MigrationStats {
  total: number;
  migrated: number;
  alreadyCorrect: number;
  removed: number;
  errors: number;
  byOldType: Record<string, number>;
  byNewType: Record<string, number>;
}

async function migrateBlockTypes(
  dryRun: boolean,
  verbose: boolean,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    alreadyCorrect: 0,
    removed: 0,
    errors: 0,
    byOldType: {},
    byNewType: {},
  };

  console.log(
    `\n🔄 ARCH-001 Block Type Migration ${dryRun ? "(DRY RUN)" : ""}\n`,
  );
  console.log("=".repeat(60));

  // Get all blocks
  const blocks = await query<{
    id: string;
    type: string;
    title: string | null;
    content: string;
    properties: string | null;
  }>("SELECT id, type, title, content, properties FROM memory_blocks");

  stats.total = blocks.length;
  console.log(`\nFound ${blocks.length} blocks to process\n`);

  for (const block of blocks) {
    const oldType = block.type.toLowerCase();
    stats.byOldType[oldType] = (stats.byOldType[oldType] || 0) + 1;

    // Check if type should be removed
    if (TYPES_TO_REMOVE.includes(oldType)) {
      if (verbose) {
        console.log(`🗑️  REMOVE: ${block.id} (type: ${oldType})`);
      }

      if (!dryRun) {
        // Mark as superseded instead of deleting (safer)
        await run(
          `UPDATE memory_blocks SET status = 'superseded', properties = ? WHERE id = ?`,
          [
            JSON.stringify({
              ...JSON.parse(block.properties || "{}"),
              migratedFrom: oldType,
              migrationNote: "Type removed in ARCH-001 migration",
              migratedAt: new Date().toISOString(),
            }),
            block.id,
          ],
        );
      }

      stats.removed++;
      continue;
    }

    // Check if already correct
    if (VALID_NEW_TYPES.includes(oldType)) {
      stats.alreadyCorrect++;
      stats.byNewType[oldType] = (stats.byNewType[oldType] || 0) + 1;
      continue;
    }

    // Map to new type
    const newType = TYPE_MAPPING[oldType];

    if (!newType) {
      console.error(`❌ Unknown type: ${oldType} (block: ${block.id})`);
      stats.errors++;
      continue;
    }

    if (verbose) {
      const preview = (block.title || block.content.substring(0, 40)).substring(
        0,
        40,
      );
      console.log(`📝 ${oldType} → ${newType}: "${preview}..."`);
    }

    if (!dryRun) {
      // Update block type and add migration metadata to properties
      const existingProps = JSON.parse(block.properties || "{}");
      const newProps = {
        ...existingProps,
        migratedFrom: oldType,
        migratedAt: new Date().toISOString(),
      };

      // Preserve semantic info for certain types
      if (oldType === "option") {
        newProps.wasOption = true;
      }
      if (oldType === "fact") {
        newProps.wasFactType = true;
      }
      if (oldType === "insight") {
        newProps.wasInsight = true;
      }
      if (oldType === "pattern") {
        newProps.wasPattern = true;
      }

      await run(
        `UPDATE memory_blocks SET type = ?, properties = ? WHERE id = ?`,
        [newType, JSON.stringify(newProps), block.id],
      );
    }

    stats.migrated++;
    stats.byNewType[newType] = (stats.byNewType[newType] || 0) + 1;
  }

  // Also migrate the memory_block_types junction table
  console.log("\n📋 Migrating memory_block_types junction table...\n");

  const blockTypes = await query<{
    block_id: string;
    block_type: string;
  }>("SELECT block_id, block_type FROM memory_block_types");

  let junctionMigrated = 0;
  let junctionRemoved = 0;

  for (const bt of blockTypes) {
    const oldType = bt.block_type.toLowerCase();

    if (TYPES_TO_REMOVE.includes(oldType)) {
      if (!dryRun) {
        await run(
          "DELETE FROM memory_block_types WHERE block_id = ? AND block_type = ?",
          [bt.block_id, bt.block_type],
        );
      }
      junctionRemoved++;
      continue;
    }

    if (VALID_NEW_TYPES.includes(oldType)) {
      continue; // Already correct
    }

    const newType = TYPE_MAPPING[oldType];
    if (newType && newType !== oldType) {
      if (!dryRun) {
        // Update or insert (handle duplicates)
        await run(
          "UPDATE OR IGNORE memory_block_types SET block_type = ? WHERE block_id = ? AND block_type = ?",
          [newType, bt.block_id, bt.block_type],
        );
      }
      junctionMigrated++;
    }
  }

  console.log(
    `Junction table: ${junctionMigrated} migrated, ${junctionRemoved} removed`,
  );

  if (!dryRun) {
    await saveDb();
    console.log("\n💾 Database saved\n");
  }

  return stats;
}

function printStats(stats: MigrationStats): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));

  console.log(`\nTotal blocks:     ${stats.total}`);
  console.log(`Already correct:  ${stats.alreadyCorrect}`);
  console.log(`Migrated:         ${stats.migrated}`);
  console.log(`Removed:          ${stats.removed}`);
  console.log(`Errors:           ${stats.errors}`);

  console.log("\n📈 Old types found:");
  const sortedOld = Object.entries(stats.byOldType).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedOld) {
    const newType =
      TYPE_MAPPING[type] ||
      (TYPES_TO_REMOVE.includes(type) ? "REMOVED" : "UNKNOWN");
    console.log(`  ${type.padEnd(20)} → ${newType.padEnd(12)} (${count})`);
  }

  console.log("\n📊 New type distribution:");
  const sortedNew = Object.entries(stats.byNewType).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedNew) {
    const bar = "█".repeat(Math.min(count, 50));
    console.log(`  ${type.padEnd(12)} ${String(count).padStart(5)} ${bar}`);
  }

  console.log("\n");
}

async function validateMigration(): Promise<boolean> {
  console.log("\n🔍 Validating migration...\n");

  // Check for any remaining old types
  const oldTypes = Object.keys(TYPE_MAPPING).filter(
    (t) => !VALID_NEW_TYPES.includes(t),
  );

  for (const oldType of oldTypes) {
    const remaining = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks WHERE type = ? AND status != 'superseded'`,
      [oldType],
    );

    if (remaining[0]?.count > 0) {
      console.error(
        `❌ Found ${remaining[0].count} blocks still with type: ${oldType}`,
      );
      return false;
    }
  }

  // Verify all active blocks have valid types
  const invalid = await query<{ id: string; type: string }>(
    `SELECT id, type FROM memory_blocks WHERE status != 'superseded' AND type NOT IN (${VALID_NEW_TYPES.map(() => "?").join(",")})`,
    VALID_NEW_TYPES,
  );

  if (invalid.length > 0) {
    console.error(`❌ Found ${invalid.length} blocks with invalid types:`);
    for (const block of invalid.slice(0, 10)) {
      console.error(`   - ${block.id}: ${block.type}`);
    }
    return false;
  }

  // Count by new types
  console.log("✅ Type distribution after migration:");
  for (const type of VALID_NEW_TYPES) {
    const count = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks WHERE type = ? AND status != 'superseded'`,
      [type],
    );
    console.log(`   ${type.padEnd(12)}: ${count[0]?.count || 0}`);
  }

  console.log("\n✅ Migration validated successfully!\n");
  return true;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  try {
    const stats = await migrateBlockTypes(dryRun, verbose);
    printStats(stats);

    if (!dryRun) {
      const valid = await validateMigration();
      if (!valid) {
        process.exit(1);
      }
    } else {
      console.log("💡 Run without --dry-run to apply changes\n");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
