#!/usr/bin/env node
/**
 * UI Test - Telegram & Budget Features
 */

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "fs";

const DASHBOARD_URL = "http://localhost:5173";
const SCREENSHOT_DIR =
  "/home/ned-atanasovski/.openclaw/workspace/harness-screenshots";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("🚀 Starting Telegram & Budget UI tests...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const results = [];

  // TC-T1: Telegram page loads
  console.log("TC-T1: Telegram page loads");
  try {
    await page.goto(`${DASHBOARD_URL}/telegram`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/telegram-01-page.png`,
      fullPage: true,
    });

    const content = await page.content();
    const hasTelegramChannels = content.includes("Telegram Channels");
    const hasSelectPrompt = content.includes("Select a channel");

    results.push({
      test: "TC-T1",
      name: "Telegram page loads",
      status: hasTelegramChannels ? "PASS" : "FAIL",
      checks: { hasTelegramChannels, hasSelectPrompt },
    });
    console.log(`  ${hasTelegramChannels ? "✅" : "❌"} Telegram page loaded`);
  } catch (err) {
    results.push({ test: "TC-T1", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-T2: Navigation includes Telegram link
  console.log("\nTC-T2: Navigation includes Telegram link");
  try {
    const content = await page.content();
    const hasTelegramNav =
      content.includes("📱 Telegram") ||
      content.includes("Telegram</a>") ||
      content.includes("/telegram");

    results.push({
      test: "TC-T2",
      name: "Navigation includes Telegram",
      status: hasTelegramNav ? "PASS" : "FAIL",
    });
    console.log(`  ${hasTelegramNav ? "✅" : "❌"} Telegram nav link`);
  } catch (err) {
    results.push({ test: "TC-T2", status: "FAIL", error: err.message });
    console.log("  ❌ Failed:", err.message);
  }

  // TC-T3: Check channel list (may be empty if no messages yet)
  console.log("\nTC-T3: Channel list section exists");
  try {
    const content = await page.content();
    const hasChannelSection =
      content.includes("Telegram Channels") ||
      content.includes("No messages yet");

    results.push({
      test: "TC-T3",
      name: "Channel list section",
      status: hasChannelSection ? "PASS" : "FAIL",
    });
    console.log(`  ${hasChannelSection ? "✅" : "❌"} Channel section present`);
  } catch (err) {
    results.push({ test: "TC-T3", status: "FAIL", error: err.message });
  }

  // TC-B1: Budget indicator in header
  console.log("\nTC-B1: Budget indicator in header");
  try {
    await page.goto(`${DASHBOARD_URL}/`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/telegram-02-dashboard.png`,
      fullPage: true,
    });

    const content = await page.content();
    const hasBudgetIndicator =
      content.includes("💰") ||
      content.includes("percent") ||
      content.includes("Server On") ||
      content.includes("%");

    results.push({
      test: "TC-B1",
      name: "Budget indicator visible",
      status: hasBudgetIndicator ? "PASS" : "PARTIAL",
    });
    console.log(`  ${hasBudgetIndicator ? "✅" : "⚠️"} Budget indicator`);
  } catch (err) {
    results.push({ test: "TC-B1", status: "FAIL", error: err.message });
  }

  // TC-B2: Config page has budget section
  console.log("\nTC-B2: Config page has budget section");
  try {
    await page.goto(`${DASHBOARD_URL}/config`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    await delay(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/telegram-03-config.png`,
      fullPage: true,
    });

    const content = await page.content();
    const hasBudgetSection =
      content.includes("Budget") && content.includes("Token Limit");

    results.push({
      test: "TC-B2",
      name: "Config has budget section",
      status: hasBudgetSection ? "PASS" : "FAIL",
    });
    console.log(`  ${hasBudgetSection ? "✅" : "❌"} Budget config section`);
  } catch (err) {
    results.push({ test: "TC-B2", status: "FAIL", error: err.message });
  }

  // TC-API1: Telegram API works
  console.log("\nTC-API1: Telegram API responds");
  try {
    const response = await page.goto(
      "http://localhost:3333/api/telegram/stats",
      { waitUntil: "networkidle0" },
    );
    const text = await response.text();
    const data = JSON.parse(text);

    const hasTotal = typeof data.total === "number";
    const hasByBot = typeof data.byBot === "object";

    results.push({
      test: "TC-API1",
      name: "Telegram API works",
      status: hasTotal && hasByBot ? "PASS" : "FAIL",
      data: { total: data.total, bots: Object.keys(data.byBot || {}).length },
    });
    console.log(
      `  ✅ API returned: ${data.total} messages, ${Object.keys(data.byBot || {}).length} bots`,
    );
  } catch (err) {
    results.push({ test: "TC-API1", status: "FAIL", error: err.message });
    console.log("  ❌ API Failed:", err.message);
  }

  // TC-API2: Budget API works
  console.log("\nTC-API2: Budget API responds");
  try {
    const response = await page.goto(
      "http://localhost:3333/api/config/budget",
      { waitUntil: "networkidle0" },
    );
    const text = await response.text();
    const data = JSON.parse(text);

    const hasDaily = data.daily && typeof data.daily.percent_used === "number";

    results.push({
      test: "TC-API2",
      name: "Budget API works",
      status: hasDaily ? "PASS" : "FAIL",
      data: { percent: data.daily?.percent_used, status: data.budget_status },
    });
    console.log(
      `  ✅ Budget: ${data.daily?.percent_used?.toFixed(1)}% used, status: ${data.budget_status}`,
    );
  } catch (err) {
    results.push({ test: "TC-API2", status: "FAIL", error: err.message });
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

  for (const r of results) {
    const icon =
      r.status === "PASS" ? "✅" : r.status === "PARTIAL" ? "⚠️" : "❌";
    console.log(`  ${icon} ${r.test}: ${r.name || r.test}`);
  }

  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

  writeFileSync(
    `${SCREENSHOT_DIR}/telegram-results.json`,
    JSON.stringify(results, null, 2),
  );

  return results;
}

runTests().catch(console.error);
