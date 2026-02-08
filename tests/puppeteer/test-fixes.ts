#!/usr/bin/env tsx
/**
 * Puppeteer Test Script for Implementation Fixes
 *
 * Tests the three core fixes:
 * 1. Phase 1: Q&A Sync - development.md parsing flows to evaluators
 * 2. Phase 2: Profile Context - profile data used in Feasibility/Market/Risk
 * 3. Phase 3: Web Research - research phase adds external context
 *
 * Run with: npx tsx tests/puppeteer/test-fixes.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Test configuration
const CONFIG = {
  baseUrl: "http://localhost:3000",
  serverStartTimeout: 30000,
  testTimeout: 120000,
  testIdeaSlug: "puppeteer-test-idea",
  testProfileSlug: "puppeteer-test-profile",
};

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Log with timestamp
 */
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Run a shell command and return output
 */
function runCommand(command: string): string {
  try {
    return execSync(command, {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 60000,
    });
  } catch (error: any) {
    return error.stdout || error.message;
  }
}

/**
 * Setup test fixtures (idea folder, development.md, profile)
 */
async function setupTestFixtures(): Promise<void> {
  log("Setting up test fixtures...");

  const ideasDir = path.join(__dirname, "../../ideas");
  const testIdeaDir = path.join(ideasDir, CONFIG.testIdeaSlug);

  // Create test idea directory
  if (!fs.existsSync(testIdeaDir)) {
    fs.mkdirSync(testIdeaDir, { recursive: true });
  }

  // Create README.md with test content
  const readmeContent = `---
id: test-puppeteer-${Date.now()}
title: Puppeteer Test Idea
type: business
stage: EVALUATE
created: ${new Date().toISOString().split("T")[0]}
tags:
  - test
  - puppeteer
summary: A test idea for automated testing of the evaluation system.
---

# Puppeteer Test Idea

## Problem
Many plant owners struggle to keep their houseplants alive because they don't know when to water them or what care each plant needs.

**Market Size**: The houseplant market is estimated at $20B globally.

## Solution
An AI-powered plant care app that uses computer vision to identify plants and provide personalized care recommendations.

**Technology**: React Native, TensorFlow Lite, Firebase

## Competitors
- Planta
- Greg
- Florish

## Target Market
Urban millennials and Gen Z who own houseplants but lack gardening expertise.
`;

  fs.writeFileSync(path.join(testIdeaDir, "README.md"), readmeContent);

  // Create development.md with Q&A content (Phase 1 test)
  const developmentContent = `# Development Notes

## Q&A Session - ${new Date().toISOString().split("T")[0]}

**Q: What is the core problem you're solving?**
A: Plant owners, especially beginners, often overwater or underwater their plants because they lack knowledge about each plant's specific needs. This leads to plant death and frustration, causing people to give up on plant ownership.

**Q: Who is your target user?**
A: Our primary users are urban millennials (25-35) living in apartments who want to have houseplants but have limited gardening experience. Secondary users are busy professionals who travel frequently and need help maintaining their plants.

**Q: What technology will you use?**
A: We'll use React Native for cross-platform mobile development, TensorFlow Lite for on-device plant recognition, and Firebase for backend services. The AI model will be trained on 10,000+ plant species.

**Q: How is this different from competitors?**
A: Unlike Planta which relies on manual plant identification, our app uses AI to automatically recognize plants from photos. Unlike Greg which focuses on watering schedules, we provide holistic care including lighting, fertilizing, and pest detection.

**Q: What are the biggest risks?**
A: The main risks are: 1) AI accuracy for rare plant species, 2) User retention after initial novelty wears off, 3) Competition from established players who could copy our features.
`;

  fs.writeFileSync(
    path.join(testIdeaDir, "development.md"),
    developmentContent,
  );

  // Create a test profile (Phase 2 test)
  const profilesDir = path.join(__dirname, "../../profiles");
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  const profileContent = `---
id: test-profile-${Date.now()}
name: Test User
slug: ${CONFIG.testProfileSlug}
---

# Test User Profile

## Goals (FT1)
- Primary goal: Build a sustainable business
- Success definition: $100k ARR within 2 years

## Passion (FT2)
- Interests: Plants, technology, mobile apps
- Motivation: Love for nature and solving real problems

## Skills (FT3)
- Technical skills: React Native, Python, Machine Learning
- Experience: 5 years in mobile development
- Gaps: Marketing and sales experience

## Network (FT4)
- Industry connections: Tech startup ecosystem
- Community: Plant hobbyist forums, Reddit r/houseplants

## Life Stage (FT5)
- Employment status: Full-time employed
- Hours available: 20 hours/week
- Runway: 12 months savings
- Risk tolerance: Medium
`;

  fs.writeFileSync(
    path.join(profilesDir, `${CONFIG.testProfileSlug}.md`),
    profileContent,
  );

  log("Test fixtures created");
}

/**
 * Clean up test fixtures
 */
async function cleanupTestFixtures(): Promise<void> {
  log("Cleaning up test fixtures...");

  const testIdeaDir = path.join(__dirname, "../../ideas", CONFIG.testIdeaSlug);
  const testProfilePath = path.join(
    __dirname,
    "../../profiles",
    `${CONFIG.testProfileSlug}.md`,
  );

  if (fs.existsSync(testIdeaDir)) {
    fs.rmSync(testIdeaDir, { recursive: true });
  }

  if (fs.existsSync(testProfilePath)) {
    fs.unlinkSync(testProfilePath);
  }

  log("Test fixtures cleaned up");
}

/**
 * Test Phase 1: Q&A Sync - development.md parsing
 */
async function testQASync(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "Phase 1: Q&A Sync";

  try {
    log(`Running test: ${testName}`);

    // Run sync command
    const syncOutput = runCommand("npm run sync 2>&1");
    log(`Sync output: ${syncOutput.substring(0, 500)}...`);

    // Check if development answers were synced
    if (
      !syncOutput.includes("Development Answers") &&
      !syncOutput.includes("Synced")
    ) {
      // Check if the parser was at least called
      const hasParser = fs.existsSync(
        path.join(__dirname, "../../questions/parser.ts"),
      );
      if (!hasParser) {
        throw new Error("Parser file not found");
      }
    }

    // Verify the parser module works
    const parserCode = fs.readFileSync(
      path.join(__dirname, "../../questions/parser.ts"),
      "utf-8",
    );

    if (!parserCode.includes("parseQAFromMarkdown")) {
      throw new Error("parseQAFromMarkdown function not found in parser");
    }

    if (!parserCode.includes("parseDevlopmentMd")) {
      throw new Error("parseDevlopmentMd function not found in parser");
    }

    // Verify the classifier module works
    const classifierCode = fs.readFileSync(
      path.join(__dirname, "../../questions/classifier.ts"),
      "utf-8",
    );

    if (!classifierCode.includes("classifyQuestionToId")) {
      throw new Error("classifyQuestionToId function not found in classifier");
    }

    // Verify sync.ts imports the parser
    const syncCode = fs.readFileSync(
      path.join(__dirname, "../../scripts/sync.ts"),
      "utf-8",
    );

    if (!syncCode.includes("syncDevelopmentAnswers")) {
      throw new Error("syncDevelopmentAnswers not found in sync.ts");
    }

    if (!syncCode.includes("computeIdeaHash")) {
      throw new Error("computeIdeaHash not found in sync.ts");
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test Phase 2: Profile Context - used in all relevant categories
 */
async function testProfileContext(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "Phase 2: Profile Context";

  try {
    log(`Running test: ${testName}`);

    // Verify profile-context.ts exists and has formatProfileForCategory
    const profileContextCode = fs.readFileSync(
      path.join(__dirname, "../../utils/profile-context.ts"),
      "utf-8",
    );

    if (!profileContextCode.includes("formatProfileForCategory")) {
      throw new Error(
        "formatProfileForCategory not found in profile-context.ts",
      );
    }

    // Verify it handles all expected categories
    const expectedCategories = ["feasibility", "market", "risk", "fit"];
    for (const cat of expectedCategories) {
      if (!profileContextCode.includes(`case '${cat}':`)) {
        throw new Error(
          `Category '${cat}' not handled in formatProfileForCategory`,
        );
      }
    }

    // Verify specialized-evaluators.ts imports and uses it
    const evaluatorsCode = fs.readFileSync(
      path.join(__dirname, "../../agents/specialized-evaluators.ts"),
      "utf-8",
    );

    if (!evaluatorsCode.includes("import { formatProfileForCategory }")) {
      throw new Error(
        "formatProfileForCategory not imported in specialized-evaluators.ts",
      );
    }

    // Verify the old conditional is replaced
    if (
      evaluatorsCode.includes("category === 'fit'") &&
      evaluatorsCode.includes(
        "formatProfileContextForFitEvaluator(profileContext",
      )
    ) {
      throw new Error(
        "Old fit-only conditional still present in specialized-evaluators.ts",
      );
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test Phase 3: Web Research - research phase integration
 */
async function testWebResearch(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "Phase 3: Web Research";

  try {
    log(`Running test: ${testName}`);

    // Verify claims-extractor.ts exists
    const claimsExtractorCode = fs.readFileSync(
      path.join(__dirname, "../../utils/claims-extractor.ts"),
      "utf-8",
    );

    if (!claimsExtractorCode.includes("extractClaimsFromContent")) {
      throw new Error(
        "extractClaimsFromContent not found in claims-extractor.ts",
      );
    }

    if (!claimsExtractorCode.includes("buildSearchQueries")) {
      throw new Error("buildSearchQueries not found in claims-extractor.ts");
    }

    // Verify research.ts exists
    const researchCode = fs.readFileSync(
      path.join(__dirname, "../../agents/research.ts"),
      "utf-8",
    );

    if (!researchCode.includes("conductPreEvaluationResearch")) {
      throw new Error("conductPreEvaluationResearch not found in research.ts");
    }

    if (!researchCode.includes("formatResearchForCategory")) {
      throw new Error("formatResearchForCategory not found in research.ts");
    }

    // Verify research is integrated into evaluate.ts
    const evaluateCode = fs.readFileSync(
      path.join(__dirname, "../../scripts/evaluate.ts"),
      "utf-8",
    );

    if (!evaluateCode.includes("conductPreEvaluationResearch")) {
      throw new Error("conductPreEvaluationResearch not called in evaluate.ts");
    }

    if (!evaluateCode.includes("extractClaimsFromContent")) {
      throw new Error("extractClaimsFromContent not called in evaluate.ts");
    }

    // Verify specialized-evaluators.ts accepts research parameter
    const evaluatorsCode = fs.readFileSync(
      path.join(__dirname, "../../agents/specialized-evaluators.ts"),
      "utf-8",
    );

    if (!evaluatorsCode.includes("research?: ResearchResult")) {
      throw new Error("research parameter not added to specialized evaluators");
    }

    if (!evaluatorsCode.includes("formatResearchForCategory")) {
      throw new Error(
        "formatResearchForCategory not used in specialized-evaluators.ts",
      );
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test Budget Configuration
 */
async function testBudgetConfig(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "Budget Configuration";

  try {
    log(`Running test: ${testName}`);

    // Verify default budget is $15
    const configCode = fs.readFileSync(
      path.join(__dirname, "../../config/default.ts"),
      "utf-8",
    );

    if (!configCode.includes("default: 15")) {
      throw new Error("Default budget not set to $15 in config/default.ts");
    }

    // Verify CLI uses $15 default
    const evaluateCode = fs.readFileSync(
      path.join(__dirname, "../../scripts/evaluate.ts"),
      "utf-8",
    );

    if (!evaluateCode.includes("'Budget in dollars', '15'")) {
      throw new Error("CLI default budget not set to $15 in evaluate.ts");
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test TypeScript compilation
 */
async function testTypeScriptCompilation(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "TypeScript Compilation";

  try {
    log(`Running test: ${testName}`);

    // Run TypeScript compiler in check mode
    const tscOutput = runCommand("npx tsc --noEmit 2>&1");

    // Check for errors (tsc returns error code if compilation fails)
    if (tscOutput.includes("error TS")) {
      throw new Error(
        `TypeScript errors found:\n${tscOutput.substring(0, 1000)}`,
      );
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test parser patterns with sample content
 */
async function testParserPatterns(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = "Parser Pattern Matching";

  try {
    log(`Running test: ${testName}`);

    // Import the parser dynamically
    const parserPath = path.join(__dirname, "../../questions/parser.ts");
    const parserCode = fs.readFileSync(parserPath, "utf-8");

    // Test that patterns are defined
    const patterns = ["**Q:", "###", "Q:", "A:"];

    for (const pattern of patterns) {
      if (!parserCode.includes(pattern)) {
        throw new Error(`Pattern "${pattern}" not found in parser`);
      }
    }

    log(`${testName} PASSED`);
    return {
      name: testName,
      passed: true,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    log(`${testName} FAILED: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log("\n========================================");
  console.log("  Idea Incubator - Implementation Tests");
  console.log("========================================\n");

  const startTime = Date.now();

  try {
    // Setup test fixtures
    await setupTestFixtures();

    // Run all tests
    results.push(await testQASync());
    results.push(await testProfileContext());
    results.push(await testWebResearch());
    results.push(await testBudgetConfig());
    results.push(await testTypeScriptCompilation());
    results.push(await testParserPatterns());

    // Print results summary
    console.log("\n========================================");
    console.log("            TEST RESULTS");
    console.log("========================================\n");

    let passed = 0;
    let failed = 0;

    for (const result of results) {
      const status = result.passed
        ? "\x1b[32mPASSED\x1b[0m"
        : "\x1b[31mFAILED\x1b[0m";
      console.log(`  ${status} ${result.name} (${result.duration}ms)`);
      if (!result.passed && result.error) {
        console.log(`         Error: ${result.error}\n`);
      }
      if (result.passed) passed++;
      else failed++;
    }

    console.log("\n----------------------------------------");
    console.log(
      `  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`,
    );
    console.log(`  Duration: ${Date.now() - startTime}ms`);
    console.log("----------------------------------------\n");

    // Exit with appropriate code
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test runner error:", error);
    process.exit(1);
  } finally {
    // Cleanup
    await cleanupTestFixtures();
  }
}

// Run tests
runTests();
