#!/usr/bin/env npx tsx
/**
 * VER-001: Self-Spec Test
 *
 * Runs the Spec Agent to generate its own specification.
 * This proves the Spec Agent can describe itself.
 */

import * as fs from "fs";
import * as path from "path";
import {
  createSpecAgent,
  type SpecOutput,
} from "../agents/specification/core.js";

const SPEC_AGENT_DIR = "ideas/vibe/agents/spec-agent";
const BRIEF_PATH = path.join(SPEC_AGENT_DIR, "planning/brief.md");
const BUILD_DIR = path.join(SPEC_AGENT_DIR, "build");

async function runSelfSpec(): Promise<void> {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║           VER-001: Spec Agent Self-Specification          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  // Verify brief exists
  if (!fs.existsSync(BRIEF_PATH)) {
    console.error(`❌ Brief not found at: ${BRIEF_PATH}`);
    process.exit(1);
  }
  console.log(`✓ Found brief at: ${BRIEF_PATH}`);

  // Ensure build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }
  console.log(`✓ Build directory: ${BUILD_DIR}`);

  // Create Spec Agent
  console.log("\n⏳ Creating Spec Agent...");
  const agent = createSpecAgent({
    strictMode: false,
  });

  // Run spec generation
  console.log("⏳ Generating self-specification...");
  console.log("   (This may take a minute as it calls Claude API)\n");

  try {
    const result: SpecOutput = await agent.generateSpec({
      briefPath: BRIEF_PATH,
      ideaSlug: "spec-agent",
      skipQuestions: true,
      useDefaults: true,
    });

    // Check for blocking issues
    if (!result.spec && result.questions.length > 0) {
      console.log("⚠️  Blocked by questions:");
      result.questions.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q.content}`);
      });
      process.exit(1);
    }

    // Write spec.md
    const specPath = path.join(BUILD_DIR, "spec.md");
    fs.writeFileSync(specPath, result.spec);
    console.log(`✓ Generated: ${specPath}`);

    // Write tasks.md
    const tasksPath = path.join(BUILD_DIR, "tasks.md");
    fs.writeFileSync(tasksPath, result.tasks);
    console.log(`✓ Generated: ${tasksPath}`);

    // Print summary
    console.log(
      "\n╔═══════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║                    Generation Summary                      ║",
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝",
    );
    console.log(`   Tasks generated: ${result.metadata.taskCount}`);
    console.log(`   Complexity: ${result.metadata.complexity}`);
    console.log(`   Tokens used: ${result.metadata.tokensUsed}`);

    if (result.metadata.warnings.length > 0) {
      console.log("\n   Warnings:");
      result.metadata.warnings.forEach((w) => console.log(`   ⚠️  ${w}`));
    }

    if (result.questions.length > 0) {
      console.log(`\n   Non-blocking questions (${result.questions.length}):`);
      result.questions.slice(0, 3).forEach((q) => {
        console.log(`   • ${q.content.substring(0, 60)}...`);
      });
    }

    console.log("\n✅ VER-001: Self-specification COMPLETE");
    console.log("   Spec Agent successfully described itself!");
    console.log("");
    console.log("   Next: Run VER-002 (Triple-Build Verification)");
    console.log("");
  } catch (error) {
    console.error("\n❌ Self-specification FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run
runSelfSpec().catch(console.error);
