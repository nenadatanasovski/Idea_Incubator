#!/usr/bin/env node
/**
 * Quick UI validation script
 * Run with: node ui-test.mjs
 */

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "fs";

const DASHBOARD_URL = "http://localhost:5173";
const SCREENSHOT_DIR =
  "/home/ned-atanasovski/.openclaw/workspace/harness-screenshots";

// Ensure screenshot dir exists
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("🚀 Starting UI tests...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture console messages
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("  🔴 Console error:", msg.text());
    }
  });

  const results = [];

  // TC-1: Dashboard Page
  console.log("TC-1: Dashboard Page");
  try {
    await page.goto(DASHBOARD_URL, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000); // Extra wait for React
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-dashboard.png`,
      fullPage: true,
    });

    const content = await page.content();
    results.push({
      test: "TC-1",
      status: "PASS",
      checks: {
        title: content.includes("Parent Harness"),
        agentStatus:
          content.includes("Agent Status") || content.includes("AGENT STATUS"),
        eventStream:
          content.includes("Event Stream") || content.includes("EVENT STREAM"),
        taskQueue:
          content.includes("Task Queue") || content.includes("TASK QUEUE"),
      },
    });
    console.log("  ✅ Dashboard loaded");
  } catch (err) {
    results.push({ test: "TC-1", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-4: Agents Page
  console.log("\nTC-4: Agents Page");
  try {
    await page.goto(`${DASHBOARD_URL}/agents`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(3000); // Wait for API fetch
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-agents.png`,
      fullPage: true,
    });

    const content = await page.content();
    const hasAgentFleet = content.includes("Agent Fleet");
    const hasBuildAgent = content.includes("Build Agent");
    const hasAgentList =
      content.includes("bg-gray-700/50") || content.includes("cursor-pointer");

    // Try to click on first agent card
    const agentCards = await page.$$('[class*="cursor-pointer"]');
    console.log(`  Found ${agentCards.length} clickable elements`);

    if (agentCards.length > 0) {
      await agentCards[0].click();
      await delay(1000);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-agents-detail.png`,
        fullPage: true,
      });
    }

    const contentAfterClick = await page.content();

    results.push({
      test: "TC-4",
      status: hasBuildAgent ? "PASS" : "PARTIAL",
      checks: {
        agentFleet: hasAgentFleet,
        buildAgent: hasBuildAgent,
        roleSection: contentAfterClick.includes("Role"),
        toolsSection: contentAfterClick.includes("Tools"),
        telegramSection: contentAfterClick.includes("Telegram"),
      },
    });
    console.log(
      `  ${hasBuildAgent ? "✅" : "⚠️"} Agents page ${hasBuildAgent ? "has agents" : "empty"}`,
    );
  } catch (err) {
    results.push({ test: "TC-4", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-5: Config Page
  console.log("\nTC-5: Config Page");
  try {
    await page.goto(`${DASHBOARD_URL}/config`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(3000); // Wait for API fetch
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-config.png`,
      fullPage: true,
    });

    const content = await page.content();

    // Check for section titles (without emoji which may not render)
    const checks = {
      title: content.includes("Harness Configuration"),
      planningSection: content.includes("Planning"),
      agentsSection: content.includes("Agents"),
      budgetSection: content.includes("Budget"),
      retrySection: content.includes("Retry"),
      circuitBreakerSection: content.includes("Circuit Breaker"),
      qaSection: content.includes("QA"),
      saveButton: content.includes("Save"),
      resetButton: content.includes("Reset"),
      clearCacheButton:
        content.includes("Clear Cache") || content.includes("Clear"),
      // New settings
      fallbackChain: content.includes("Fallback"),
      maxOutputTokens: content.includes("Output Tokens"),
      p0Reserve: content.includes("P0") || content.includes("Reserve"),
      maxAttempts: content.includes("Attempts"),
      backoffMultiplier:
        content.includes("Backoff") || content.includes("Multiplier"),
      failureThreshold: content.includes("Threshold"),
      cooldown: content.includes("Cooldown"),
      // Check for actual config fields
      intervalHours: content.includes("Interval"),
      maxConcurrent: content.includes("Concurrent"),
      tokenLimit:
        content.includes("Token Limit") || content.includes("daily_token"),
    };

    const passedCount = Object.values(checks).filter((v) => v).length;
    const totalCount = Object.keys(checks).length;

    results.push({
      test: "TC-5",
      status:
        passedCount >= totalCount * 0.8
          ? "PASS"
          : passedCount >= totalCount * 0.5
            ? "PARTIAL"
            : "FAIL",
      checks,
      summary: `${passedCount}/${totalCount} checks passed`,
    });

    console.log(
      `  ${passedCount >= totalCount * 0.8 ? "✅" : "⚠️"} Config page: ${passedCount}/${totalCount} checks`,
    );

    // Log failed checks
    for (const [key, value] of Object.entries(checks)) {
      if (!value) console.log(`    ❌ Missing: ${key}`);
    }
  } catch (err) {
    results.push({ test: "TC-5", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-13: Tasks Page
  console.log("\nTC-13: Tasks Page");
  try {
    await page.goto(`${DASHBOARD_URL}/tasks`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-tasks.png`,
      fullPage: true,
    });
    results.push({ test: "TC-13", status: "PASS" });
    console.log("  ✅ Tasks page loaded");
  } catch (err) {
    results.push({ test: "TC-13", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-14: Sessions Page
  console.log("\nTC-14: Sessions Page");
  try {
    await page.goto(`${DASHBOARD_URL}/sessions`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-sessions.png`,
      fullPage: true,
    });
    results.push({ test: "TC-14", status: "PASS" });
    console.log("  ✅ Sessions page loaded");
  } catch (err) {
    results.push({ test: "TC-14", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.status === "PASS").length;
  const partial = results.filter((r) => r.status === "PARTIAL").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️ Partial: ${partial}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

  // Write results to file
  writeFileSync(
    `${SCREENSHOT_DIR}/results.json`,
    JSON.stringify(results, null, 2),
  );

  return results;
}

runTests().catch(console.error);
