/**
 * Browser-based E2E Tests: Task Readiness Pipeline Enhancements
 *
 * These tests use Puppeteer to validate all UI integrations work correctly.
 * Run with: npx ts-node tests/e2e/browser-task-readiness-tests.ts
 *
 * Test Coverage:
 * - ReadinessIndicator in TaskDetailModal header
 * - TaskCompletionModal opens from "Check Readiness" button
 * - ParallelismControls shows stats and recalculate button
 * - ParallelismPreview shows wave breakdown
 * - Execute button disabled when readiness < 70%
 */

import puppeteer, { Browser, Page } from "puppeteer";

const BASE_URL = "http://localhost:5173";
const API_BASE = "http://localhost:3001/api";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: (page: Page) => Promise<void>,
  page: Page,
): Promise<void> {
  const start = Date.now();
  try {
    await testFn(page);
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ PASS: ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      passed: false,
      error: errorMsg,
      duration: Date.now() - start,
    });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${errorMsg}`);
  }
}

async function waitForSelector(
  page: Page,
  selector: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

async function getTaskListWithTasks(): Promise<string | null> {
  const response = await fetch(`${API_BASE}/pipeline/task-lists`);
  if (!response.ok) return null;
  const taskLists = await response.json();
  for (const tl of taskLists) {
    if (tl.taskCount >= 2) return tl.id;
  }
  return taskLists[0]?.id || null;
}

// ============================================
// Test Functions
// ============================================

async function testPipelinePageLoads(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');
}

async function testParallelismControlsVisible(page: Page): Promise<void> {
  // Select a task list first
  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  // Get a task list ID and select it
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  // Select task list from dropdown
  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1]; // Second select is task lists
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Check ParallelismControls is visible
  await waitForSelector(page, '[data-testid="parallelism-controls"]');
}

async function testRecalculateButton(page: Page): Promise<void> {
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1];
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Click recalculate button
  await waitForSelector(page, '[data-testid="recalculate-parallelism-btn"]');
  await page.click('[data-testid="recalculate-parallelism-btn"]');

  // Wait for response (button should show "Calculating..." then finish)
  await page.waitForTimeout(2000);

  // Verify stats are shown (Waves/Max Parallel chips should appear)
  const hasStats = await page.evaluate(() => {
    const controls = document.querySelector(
      '[data-testid="parallelism-controls"]',
    );
    return (
      controls?.textContent?.includes("Waves") ||
      controls?.textContent?.includes("Max Parallel")
    );
  });

  if (!hasStats)
    throw new Error("Parallelism stats not displayed after recalculate");
}

async function testParallelismPreviewToggle(page: Page): Promise<void> {
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1];
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Click Preview button
  await waitForSelector(page, '[data-testid="toggle-parallelism-preview-btn"]');
  await page.click('[data-testid="toggle-parallelism-preview-btn"]');

  await page.waitForTimeout(500);

  // Verify ParallelismPreview is visible
  await waitForSelector(page, '[data-testid="parallelism-preview"]');
}

async function testTaskDetailModalWithReadiness(page: Page): Promise<void> {
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1];
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Click on a task cell to open TaskDetailModal
  const taskCell = await page.$('[data-testid^="wave-cell-"]');
  if (!taskCell) throw new Error("No task cell found");
  await taskCell.click();

  await page.waitForTimeout(500);

  // Verify ReadinessIndicator is visible in modal header
  await waitForSelector(page, '[data-testid="readiness-indicator"]');

  // Verify Check Readiness button is visible
  await waitForSelector(page, '[data-testid="check-readiness-btn"]');
}

async function testTaskCompletionModal(page: Page): Promise<void> {
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1];
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Click on a task cell
  const taskCell = await page.$('[data-testid^="wave-cell-"]');
  if (!taskCell) throw new Error("No task cell found");
  await taskCell.click();

  await page.waitForTimeout(500);

  // Click Check Readiness button
  await waitForSelector(page, '[data-testid="check-readiness-btn"]');
  await page.click('[data-testid="check-readiness-btn"]');

  await page.waitForTimeout(500);

  // Verify TaskCompletionModal is visible
  await waitForSelector(page, '[data-testid="task-completion-modal"]');

  // Verify readiness progress bar is visible
  await waitForSelector(page, '[data-testid="readiness-progress-bar"]');
}

async function testExecuteButtonDisabledWhenNotReady(
  page: Page,
): Promise<void> {
  const taskListId = await getTaskListWithTasks();
  if (!taskListId) throw new Error("No task list with tasks found");

  await page.goto(`${BASE_URL}/pipeline`);
  await waitForSelector(page, '[data-testid="pipeline-dashboard"]');

  await page.evaluate((id) => {
    const selects = document.querySelectorAll("select");
    const taskListSelect = selects[1];
    if (taskListSelect) {
      (taskListSelect as HTMLSelectElement).value = id;
      taskListSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, taskListId);

  await page.waitForTimeout(1000);

  // Click on a task cell
  const taskCell = await page.$('[data-testid^="wave-cell-"]');
  if (!taskCell) throw new Error("No task cell found");
  await taskCell.click();

  await page.waitForTimeout(500);

  // Click Check Readiness button
  await waitForSelector(page, '[data-testid="check-readiness-btn"]');
  await page.click('[data-testid="check-readiness-btn"]');

  await page.waitForTimeout(1000);

  // Check if execute button is disabled
  const isDisabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="execute-now-btn"]');
    return btn?.hasAttribute("disabled");
  });

  // Get readiness score from the modal
  const readinessText = await page.evaluate(() => {
    const progressBar = document.querySelector(
      '[data-testid="readiness-progress-bar"]',
    );
    return progressBar?.textContent || "";
  });

  // Extract readiness percentage
  const match = readinessText.match(/(\d+)%/);
  const readiness = match ? parseInt(match[1], 10) : 0;

  // If readiness < 70%, button should be disabled
  if (readiness < 70 && !isDisabled) {
    throw new Error(
      `Execute button should be disabled when readiness is ${readiness}% (< 70%)`,
    );
  }

  // If readiness >= 70%, button should be enabled
  if (readiness >= 70 && isDisabled) {
    throw new Error(
      `Execute button should be enabled when readiness is ${readiness}% (>= 70%)`,
    );
  }
}

async function testReadinessAPIEndpoint(page: Page): Promise<void> {
  // Get a task ID from the database
  const taskListsResponse = await fetch(`${API_BASE}/pipeline/task-lists`);
  const taskLists = await taskListsResponse.json();

  if (!taskLists.length) throw new Error("No task lists found");

  // Get tasks from first list
  const statusResponse = await fetch(
    `${API_BASE}/pipeline/status?taskListId=${taskLists[0].id}`,
  );
  const status = await statusResponse.json();

  // Find a task ID
  let taskId: string | null = null;
  for (const lane of status.lanes || []) {
    for (const task of lane.tasks || []) {
      taskId = task.taskId;
      break;
    }
    if (taskId) break;
  }

  if (!taskId) throw new Error("No task found");

  // Test readiness endpoint
  const readinessResponse = await fetch(
    `${API_BASE}/pipeline/tasks/${taskId}/readiness`,
  );
  if (!readinessResponse.ok) {
    throw new Error(`Readiness API returned ${readinessResponse.status}`);
  }

  const readinessData = await readinessResponse.json();

  // Validate response structure
  const requiredFields = [
    "taskId",
    "overall",
    "rules",
    "threshold",
    "isReady",
    "missingItems",
  ];
  for (const field of requiredFields) {
    if (!(field in readinessData)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate rules structure
  const requiredRules = [
    "singleConcern",
    "boundedFiles",
    "timeBounded",
    "testable",
    "independent",
    "clearCompletion",
  ];
  for (const rule of requiredRules) {
    if (!(rule in readinessData.rules)) {
      throw new Error(`Missing required rule: ${rule}`);
    }
  }
}

// ============================================
// Main Test Runner
// ============================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Browser E2E Tests: Task Readiness Pipeline Enhancements");
  console.log("=".repeat(60));
  console.log("");

  let browser: Browser | null = null;

  try {
    // Check if server is running
    try {
      await fetch(`${API_BASE}/pipeline/status`);
    } catch {
      console.error("ERROR: Server not running at localhost:3001");
      console.error("Start the server with: npm run dev");
      process.exit(1);
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Run all tests
    await runTest("Pipeline page loads", testPipelinePageLoads, page);
    await runTest(
      "ParallelismControls visible when task list selected",
      testParallelismControlsVisible,
      page,
    );
    await runTest(
      "Recalculate button updates stats",
      testRecalculateButton,
      page,
    );
    await runTest(
      "ParallelismPreview toggle works",
      testParallelismPreviewToggle,
      page,
    );
    await runTest(
      "TaskDetailModal shows ReadinessIndicator",
      testTaskDetailModalWithReadiness,
      page,
    );
    await runTest(
      "TaskCompletionModal opens from Check Readiness button",
      testTaskCompletionModal,
      page,
    );
    await runTest(
      "Execute button disabled when readiness < 70%",
      testExecuteButtonDisabledWhenNotReady,
      page,
    );
    await runTest(
      "Readiness API endpoint returns valid data",
      testReadinessAPIEndpoint,
      page,
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("");
    console.log("Failed tests:");
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  } else {
    console.log("");
    console.log("All tests PASSED!");
    process.exit(0);
  }
}

main().catch(console.error);
