/**
 * AI Migration Script: Generate titles for existing memory blocks
 *
 * This script uses Claude to generate short 3-5 word titles for memory blocks
 * that don't have titles yet. Run with: npm run migrate:titles
 *
 * Options:
 *   --dry-run    Preview titles without saving to database
 *   --session    Only migrate blocks from a specific session ID
 *   --limit      Maximum number of blocks to process (default: 100)
 */

import { query, run, saveDb } from "../database/db.js";
import { runMigrations } from "../database/migrate.js";
import { client as anthropicClient } from "../utils/anthropic-client.js";

interface MemoryBlock {
  id: string;
  session_id: string;
  type: string;
  title: string | null;
  content: string;
}

interface TitleGenerationResult {
  id: string;
  title: string;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes("--dry-run"),
    sessionId: null as string | null,
    limit: 100,
  };

  const sessionIndex = args.indexOf("--session");
  if (sessionIndex !== -1 && args[sessionIndex + 1]) {
    options.sessionId = args[sessionIndex + 1];
  }

  const limitIndex = args.indexOf("--limit");
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1], 10);
  }

  return options;
}

/**
 * Generate titles for a batch of blocks using Claude
 */
async function generateTitlesForBatch(
  blocks: MemoryBlock[],
): Promise<TitleGenerationResult[]> {
  const prompt = `Generate short, descriptive titles (3-5 words) for these memory blocks from an idea incubation system.

For each block, provide a concise title that:
- Captures the essence of the content
- Uses clear, specific language
- Avoids generic words like "Note", "Item", "Entry"
- Is appropriate for the block type (content, assumption, risk, decision, etc.)

Return a JSON array with objects containing "id" and "title" for each block.

Blocks to title:
${blocks
  .map(
    (b, i) => `
${i + 1}. ID: ${b.id}
   Type: ${b.type}
   Content: ${b.content.substring(0, 300)}${b.content.length > 300 ? "..." : ""}
`,
  )
  .join("")}

Return ONLY a valid JSON array, no markdown:
[{"id": "...", "title": "..."}, ...]`;

  try {
    const response = await anthropicClient.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("No text content in response");
      return [];
    }

    let jsonText = textContent.text.trim();
    // Remove markdown code block if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
    }

    const results = JSON.parse(jsonText) as TitleGenerationResult[];
    return results;
  } catch (error) {
    console.error("Error generating titles:", error);
    return [];
  }
}

/**
 * Main migration function
 */
async function migrateBlockTitles() {
  const options = parseArgs();
  console.log("\n=== Memory Block Title Migration ===\n");
  console.log("Options:", {
    dryRun: options.dryRun,
    sessionId: options.sessionId || "all sessions",
    limit: options.limit,
  });
  console.log("");

  // Run schema migrations first to ensure database is up to date
  console.log("Running schema migrations...");
  await runMigrations();
  console.log("");

  // Get blocks without titles
  let sql = `
    SELECT id, session_id, type, title, content
    FROM memory_blocks
    WHERE (title IS NULL OR title = '')
    AND content IS NOT NULL
    AND LENGTH(content) > 10
  `;
  const params: (string | number)[] = [];

  if (options.sessionId) {
    sql += " AND session_id = ?";
    params.push(options.sessionId);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(options.limit);

  const blocks = await query<MemoryBlock>(sql, params);

  console.log(`Found ${blocks.length} blocks without titles\n`);

  if (blocks.length === 0) {
    console.log("No blocks need title migration. Exiting.");
    return;
  }

  // Process in batches of 10
  const batchSize = 10;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(blocks.length / batchSize)} (${batch.length} blocks)...`,
    );

    const results = await generateTitlesForBatch(batch);

    for (const result of results) {
      const block = batch.find((b) => b.id === result.id);
      if (!block) {
        console.warn(`  - Block ${result.id} not found in batch, skipping`);
        totalSkipped++;
        continue;
      }

      // Validate title
      if (!result.title || result.title.length > 100) {
        console.warn(
          `  - Invalid title for ${result.id}: "${result.title?.substring(0, 50)}..."`,
        );
        totalSkipped++;
        continue;
      }

      console.log(`  - ${block.type}: "${result.title}"`);
      console.log(
        `    Content: ${block.content.substring(0, 60)}${block.content.length > 60 ? "..." : ""}`,
      );

      if (!options.dryRun) {
        await run("UPDATE memory_blocks SET title = ? WHERE id = ?", [
          result.title,
          result.id,
        ]);
        totalUpdated++;
      } else {
        totalUpdated++;
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < blocks.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Save database changes
  if (!options.dryRun) {
    await saveDb();
  }

  console.log("\n=== Migration Complete ===");
  console.log(`Total blocks processed: ${blocks.length}`);
  console.log(`Titles generated: ${totalUpdated}`);
  console.log(`Skipped: ${totalSkipped}`);
  if (options.dryRun) {
    console.log("\n(Dry run - no changes saved to database)");
    console.log("Run without --dry-run to apply changes.");
  }
}

// Run the migration
migrateBlockTitles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
