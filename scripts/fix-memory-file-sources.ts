/**
 * Migration script to fix memory file source data in the database
 * Ensures all blocks with source_type: "memory_file" have proper navigation properties
 */

import { getDb, saveDb, query, run } from "../database/db.js";

interface BlockRow {
  id: string;
  session_id: string;
  properties: string;
}

async function fixMemoryFileSources() {
  console.log("Starting memory file source migration...");

  // Initialize database
  await getDb();

  // Find all blocks with memory_file source type
  const blocks = await query<BlockRow>(
    `SELECT id, session_id, properties
     FROM memory_blocks
     WHERE json_extract(properties, '$.source_type') = 'memory_file'`,
  );

  console.log(`Found ${blocks.length} blocks with source_type: "memory_file"`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;

  for (const block of blocks) {
    try {
      const properties = JSON.parse(block.properties || "{}");
      let needsUpdate = false;

      // Check if memory_file_type is missing but source_id exists
      if (!properties.memory_file_type && properties.source_id) {
        properties.memory_file_type = properties.source_id;
        needsUpdate = true;
        console.log(`  [${block.id}] Added memory_file_type from source_id`);
      }

      // If there's no memory_file_type at all, try to infer from the block content or set a default
      if (!properties.memory_file_type) {
        // Check if we can infer from source_id pattern
        if (properties.source_id) {
          properties.memory_file_type = properties.source_id;
          needsUpdate = true;
          console.log(`  [${block.id}] Set memory_file_type from source_id`);
        }
      }

      if (needsUpdate) {
        await run(
          `UPDATE memory_blocks
           SET properties = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [JSON.stringify(properties), block.id],
        );
        updatedCount++;
      } else {
        alreadyCorrectCount++;
      }
    } catch (error) {
      console.error(`  [${block.id}] Error processing: ${error}`);
    }
  }

  console.log("\nMigration complete:");
  console.log(`  - Updated: ${updatedCount} blocks`);
  console.log(`  - Already correct: ${alreadyCorrectCount} blocks`);
  console.log(`  - Total processed: ${blocks.length} blocks`);

  // Also check for any blocks that might have been incorrectly stored with "external" type
  // but have memory file properties
  const externalBlocks = await query<BlockRow>(
    `SELECT id, session_id, properties
     FROM memory_blocks
     WHERE json_extract(properties, '$.source_type') = 'external'
       AND (json_extract(properties, '$.memory_file_type') IS NOT NULL
            OR json_extract(properties, '$.memory_file_title') IS NOT NULL)`,
  );

  if (externalBlocks.length > 0) {
    console.log(
      `\nFound ${externalBlocks.length} blocks incorrectly marked as "external" that should be "memory_file":`,
    );

    for (const block of externalBlocks) {
      try {
        const properties = JSON.parse(block.properties || "{}");
        properties.source_type = "memory_file";

        await run(
          `UPDATE memory_blocks
           SET properties = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [JSON.stringify(properties), block.id],
        );

        console.log(
          `  [${block.id}] Fixed source_type: external -> memory_file`,
        );
        updatedCount++;
      } catch (error) {
        console.error(`  [${block.id}] Error fixing: ${error}`);
      }
    }
  }

  // Save database to disk
  await saveDb();
  console.log("\nDatabase saved.");
}

fixMemoryFileSources().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
