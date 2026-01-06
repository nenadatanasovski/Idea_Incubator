import { generateHandoffBrief } from '../../agents/ideation/handoff-generator.js';

async function verify() {
  console.log("=== TEST-PH-011 Verification ===\n");

  // Check 1: Function exists and is exported
  console.log("1. Checking generateHandoffBrief function exists...");
  if (typeof generateHandoffBrief !== 'function') {
    throw new Error("generateHandoffBrief is not a function");
  }
  console.log("   OK: generateHandoffBrief is exported\n");

  // Check 2: Generate a handoff brief
  console.log("2. Generating handoff brief...");
  const brief = await generateHandoffBrief('test-user', 'test-idea', 'RESEARCH', 'EVALUATE');

  if (typeof brief !== 'string') {
    throw new Error("generateHandoffBrief did not return a string");
  }
  console.log("   OK: Returns a string\n");

  // Check 3: Verify required sections
  console.log("3. Checking required sections...");

  const requiredSections = [
    { pattern: /# Handoff Brief/i, name: "Header with phases and date" },
    { pattern: /RESEARCH/, name: "fromPhase mentioned" },
    { pattern: /EVALUATE/, name: "toPhase mentioned" },
    { pattern: /What's Complete/i, name: "What's Complete section" },
    { pattern: /What's Incomplete/i, name: "What's Incomplete section" },
    { pattern: /Key Insights for Next Phase/i, name: "Key Insights for Next Phase" },
    { pattern: /AI Recommendation/i, name: "AI Recommendation" },
    { pattern: /Confidence Score/i, name: "Confidence score" },
    { pattern: /\[ \]/i, name: "Decision checkboxes" },
  ];

  let allSectionsPresent = true;
  for (const section of requiredSections) {
    if (section.pattern.test(brief)) {
      console.log(`   OK: ${section.name}`);
    } else {
      console.log(`   FAIL: ${section.name} - MISSING`);
      allSectionsPresent = false;
    }
  }

  if (!allSectionsPresent) {
    console.log("\n--- Generated Brief (first 1500 chars) ---");
    console.log(brief.substring(0, 1500));
    throw new Error("Not all required sections present");
  }

  console.log("\n=== All Pass Criteria Met ===");
  console.log("TEST PASSED: TEST-PH-011");
}

verify().catch((err) => {
  console.error("\nTEST FAILED:", err.message);
  process.exit(1);
});
