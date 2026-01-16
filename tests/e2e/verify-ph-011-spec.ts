// Verification Code from spec
import { generateHandoffBrief } from "../../agents/ideation/handoff-generator.js";

async function runSpecVerification() {
  console.log("Running spec verification code...\n");

  const brief = await generateHandoffBrief(
    "test-user",
    "test-idea",
    "RESEARCH",
    "EVALUATE",
  );

  // Assert checks from spec
  console.log("Checking: typeof brief === 'string'");
  if (typeof brief !== "string") {
    throw new Error("brief is not a string");
  }
  console.log("  PASS\n");

  console.log("Checking: brief.includes('# Handoff Brief')");
  if (!brief.includes("# Handoff Brief")) {
    throw new Error("brief does not include '# Handoff Brief'");
  }
  console.log("  PASS\n");

  console.log("Checking: brief.includes('RESEARCH')");
  if (!brief.includes("RESEARCH")) {
    throw new Error("brief does not include 'RESEARCH'");
  }
  console.log("  PASS\n");

  console.log("Checking: brief.includes('EVALUATE')");
  if (!brief.includes("EVALUATE")) {
    throw new Error("brief does not include 'EVALUATE'");
  }
  console.log("  PASS\n");

  console.log('Checking: brief.includes("What\'s Complete")');
  if (!brief.includes("What's Complete")) {
    throw new Error('brief does not include "What\'s Complete"');
  }
  console.log("  PASS\n");

  console.log("=== All spec assertions PASSED ===");
}

runSpecVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err.message);
  process.exit(1);
});
