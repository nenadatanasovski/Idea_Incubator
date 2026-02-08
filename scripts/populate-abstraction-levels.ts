/**
 * Migration script to populate abstraction_level for memory blocks
 *
 * Classification logic:
 * 1. Block type influences abstraction level
 * 2. Graph membership provides additional context
 * 3. Content analysis for edge cases
 *
 * Abstraction Level Mapping:
 * - vision: High-level goals, problems, opportunities (why)
 * - strategy: Approaches, decisions, models (how we'll win)
 * - tactic: Specific features, requirements, validations (what to do)
 * - implementation: Technical details, tasks, specs (how to do it)
 */

import { query, run, saveDb } from "../database/db.js";

interface MemoryBlock {
  id: string;
  title: string | null;
  type: string;
  content: string;
  abstraction_level: string | null;
  session_id: string;
}

interface GraphMembership {
  block_id: string;
  graph_type: string;
}

type AbstractionLevel = "vision" | "strategy" | "tactic" | "implementation";

/**
 * Classify abstraction level based on block type, graph membership, and content
 */
function classifyAbstractionLevel(
  block: MemoryBlock,
  graphMemberships: string[],
): AbstractionLevel {
  const type = block.type?.toLowerCase() || "";
  const title = (block.title || "").toLowerCase();
  const content = (block.content || "").toLowerCase();

  // 1. Block type heuristics
  const typeMapping: Record<string, AbstractionLevel> = {
    // Vision level - big picture
    vision: "vision",
    opportunity: "vision",

    // Strategy level - approaches and decisions
    decision: "strategy",
    option: "strategy",
    assumption: "strategy",
    hypothesis: "strategy",

    // Tactic level - specific actions and validations
    insight: "tactic",
    fact: "tactic",
    validation: "tactic",
    pattern: "tactic",

    // Implementation level - technical details
    requirement: "implementation",
    task: "implementation",
    constraint: "implementation",
    action: "implementation",
  };

  // Start with type-based classification
  let level = typeMapping[type] || "tactic";

  // 2. Graph membership refinement
  const hasProblem = graphMemberships.includes("problem");
  const hasSpec = graphMemberships.includes("spec");
  const hasBusiness = graphMemberships.includes("business");
  const hasMarket = graphMemberships.includes("market");
  const hasRisk = graphMemberships.includes("risk");

  // Problem + Market = more likely vision/strategy
  if (hasProblem && hasMarket && !hasSpec) {
    if (level === "tactic") level = "strategy";
  }

  // Business model discussions are strategic
  if (hasBusiness && !hasSpec) {
    if (level === "tactic" || level === "implementation") level = "strategy";
  }

  // Spec-heavy items are more implementation-focused
  if (hasSpec && !hasProblem && !hasMarket) {
    if (level === "strategy") level = "tactic";
  }

  // 3. Content keyword analysis for edge cases
  const visionKeywords = [
    "mission",
    "vision",
    "ultimate",
    "long-term",
    "opportunity",
    "market size",
  ];
  const strategyKeywords = [
    "approach",
    "strategy",
    "model",
    "decision",
    "should we",
    "versus",
    "vs",
    "trade-off",
  ];
  const implementationKeywords = [
    "api",
    "database",
    "component",
    "function",
    "endpoint",
    "ui",
    "ux",
    "screen",
  ];

  const fullText = `${title} ${content}`;

  // Vision keywords bump up
  if (visionKeywords.some((kw) => fullText.includes(kw))) {
    if (level === "tactic") level = "strategy";
    if (level === "strategy" && hasProblem) level = "vision";
  }

  // Strategy keywords keep at strategy
  if (strategyKeywords.some((kw) => fullText.includes(kw))) {
    if (level === "implementation") level = "tactic";
    if (level === "tactic" && (hasBusiness || hasRisk)) level = "strategy";
  }

  // Implementation keywords bump down
  if (implementationKeywords.some((kw) => fullText.includes(kw))) {
    if (level === "strategy") level = "tactic";
    if (level === "tactic") level = "implementation";
  }

  // 4. Question type special handling
  if (type === "question") {
    // Questions about strategy/approach → strategy level
    if (strategyKeywords.some((kw) => fullText.includes(kw))) {
      level = "strategy";
    }
    // Technical questions → implementation
    else if (implementationKeywords.some((kw) => fullText.includes(kw))) {
      level = "implementation";
    }
    // Default questions to tactic (what to do)
    else {
      level = "tactic";
    }
  }

  return level;
}

async function main() {
  const sessionId = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("Abstraction Level Population Script");
  console.log("=".repeat(60));

  // Get blocks to process
  let blocks: MemoryBlock[];
  if (sessionId) {
    console.log(`\nProcessing session: ${sessionId}`);
    blocks = await query<MemoryBlock>(
      "SELECT id, title, type, content, abstraction_level, session_id FROM memory_blocks WHERE session_id = ?",
      [sessionId],
    );
  } else {
    console.log("\nProcessing ALL blocks with null abstraction_level");
    blocks = await query<MemoryBlock>(
      "SELECT id, title, type, content, abstraction_level, session_id FROM memory_blocks WHERE abstraction_level IS NULL OR abstraction_level = ''",
    );
  }

  console.log(`Found ${blocks.length} blocks to process\n`);

  // Get all graph memberships
  const memberships = await query<GraphMembership>(
    "SELECT block_id, graph_type FROM memory_graph_memberships",
  );

  // Build block -> graph types mapping
  const blockGraphTypes = new Map<string, string[]>();
  for (const m of memberships) {
    if (!blockGraphTypes.has(m.block_id)) {
      blockGraphTypes.set(m.block_id, []);
    }
    blockGraphTypes.get(m.block_id)!.push(m.graph_type);
  }

  // Track statistics
  const stats: Record<AbstractionLevel, number> = {
    vision: 0,
    strategy: 0,
    tactic: 0,
    implementation: 0,
  };

  const updates: Array<{
    id: string;
    level: AbstractionLevel;
    title: string;
    type: string;
  }> = [];

  for (const block of blocks) {
    const graphTypes = blockGraphTypes.get(block.id) || [];
    const level = classifyAbstractionLevel(block, graphTypes);

    stats[level]++;
    updates.push({
      id: block.id,
      level,
      title: block.title || block.content.slice(0, 50),
      type: block.type,
    });
  }

  // Print preview
  console.log("Classification Results:");
  console.log("-".repeat(60));

  for (const update of updates) {
    const levelColor = {
      vision: "\x1b[35m", // Purple
      strategy: "\x1b[34m", // Blue
      tactic: "\x1b[32m", // Green
      implementation: "\x1b[33m", // Yellow
    }[update.level];
    const reset = "\x1b[0m";

    console.log(
      `${levelColor}[${update.level.toUpperCase().padEnd(14)}]${reset} ` +
        `(${update.type.padEnd(12)}) ${update.title.slice(0, 50)}`,
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("Statistics:");
  console.log("-".repeat(60));
  console.log(`  Vision:         ${stats.vision}`);
  console.log(`  Strategy:       ${stats.strategy}`);
  console.log(`  Tactic:         ${stats.tactic}`);
  console.log(`  Implementation: ${stats.implementation}`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n[DRY RUN] No changes made. Remove --dry-run to apply.\n");
    return;
  }

  // Apply updates
  console.log("\nApplying updates...");

  for (const update of updates) {
    await run(
      "UPDATE memory_blocks SET abstraction_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [update.level, update.id],
    );
  }

  await saveDb();
  console.log(`\nSuccessfully updated ${updates.length} blocks!\n`);
}

main().catch(console.error);
