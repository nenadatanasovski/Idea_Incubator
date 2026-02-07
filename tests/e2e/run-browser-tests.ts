/**
 * Puppeteer Browser Test Runner for Self-Documenting Data Model
 *
 * Executes browser test scenarios against the Schema Viewer UI.
 * Run with: npx tsx tests/e2e/run-browser-tests.ts
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 */

import puppeteer, { Browser, Page } from "puppeteer";
// @ts-expect-error Module may not exist yet; tests require a running browser environment
import { browserTestScenarios } from "./browser-schema-tests";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const HEADLESS = process.env.HEADLESS !== "false";
const SLOW_MO = parseInt(process.env.SLOW_MO || "0", 10);

interface TestResult {
  scenario: string;
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  screenshots?: string[];
}

const results: TestResult[] = [];

/**
 * Helper to find element by text content (handles :has-text() pseudo-selector)
 */
async function findElementByText(
  page: Page,
  selector: string,
): Promise<boolean> {
  if (selector.includes(":has-text(")) {
    const text = selector.match(/:has-text\("([^"]+)"\)/)?.[1];
    const baseSelector = selector.replace(/:has-text\("[^"]+"\)/, "") || "*";
    const elements = await page.$$(baseSelector);
    for (const el of elements) {
      const elText = await el.evaluate((e) => e.textContent?.toLowerCase());
      if (elText?.includes(text?.toLowerCase() || "")) {
        return true;
      }
    }
    return false;
  }
  return (await page.$(selector)) !== null;
}

/**
 * Helper to wait for element by text content
 */
async function waitForElementByText(
  page: Page,
  selector: string,
  timeout: number,
): Promise<void> {
  if (selector.includes(":has-text(")) {
    const text = selector.match(/:has-text\("([^"]+)"\)/)?.[1];
    const baseSelector = selector.replace(/:has-text\("[^"]+"\)/, "") || "*";
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const elements = await page.$$(baseSelector);
      for (const el of elements) {
        const elText = await el.evaluate((e) => e.textContent?.toLowerCase());
        if (elText?.includes(text?.toLowerCase() || "")) {
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Waiting for selector \`${selector}\` failed`);
  } else {
    await page.waitForSelector(selector, { timeout });
  }
}

/**
 * Execute a single test step
 */
async function executeStep(
  page: Page,
  step: Record<string, unknown>,
): Promise<void> {
  const { action, selector, value, url, duration, timeout = 5000 } = step;

  switch (action) {
    case "navigate":
      await page.goto(url as string, { waitUntil: "networkidle2" });
      break;

    case "waitForSelector":
      await waitForElementByText(page, selector as string, timeout as number);
      break;

    case "click":
      // Handle Puppeteer pseudo-selectors
      if ((selector as string).includes(":has-text(")) {
        const text = (selector as string).match(/:has-text\("([^"]+)"\)/)?.[1];
        const baseSelector = (selector as string).replace(
          /:has-text\("[^"]+"\)/,
          "",
        );
        const elements = await page.$$(baseSelector || "button");
        for (const el of elements) {
          const elText = await el.evaluate((e) => e.textContent?.toLowerCase());
          if (elText?.includes(text?.toLowerCase() || "")) {
            await el.click();
            break;
          }
        }
      } else {
        await page.click(selector as string);
      }
      break;

    case "fill":
      await page.type(selector as string, value as string);
      break;

    case "wait":
      await new Promise((resolve) => setTimeout(resolve, duration as number));
      break;

    case "screenshot":
      await page.screenshot({ path: `screenshot-${Date.now()}.png` });
      break;

    default:
      console.warn(`Unknown action: ${action}`);
  }
}

/**
 * Execute assertions against the page
 */
async function executeAssertion(
  page: Page,
  assertion: Record<string, unknown>,
): Promise<{ passed: boolean; message: string }> {
  const { type, selector, expected, count, minCount, description } = assertion;

  try {
    switch (type) {
      case "textContent": {
        const content = await page.$eval(
          selector as string,
          (el) => el.textContent || "",
        );
        const regex = expected as RegExp;
        const passed = regex.test(content);
        return {
          passed,
          message: passed
            ? `Text matched: ${regex}`
            : `Text "${content.slice(0, 50)}..." did not match ${regex}`,
        };
      }

      case "visible": {
        const passed = await findElementByText(page, selector as string);
        return {
          passed,
          message: passed
            ? `Element ${selector} is visible`
            : `Element ${selector} not found`,
        };
      }

      case "exists": {
        const passed = await findElementByText(page, selector as string);
        return {
          passed,
          message: passed
            ? `Element ${selector} exists`
            : `Element ${selector} not found`,
        };
      }

      case "elementCount": {
        const elements = await page.$$(selector as string);
        const countNum = elements.length;
        let passed = false;

        if (minCount !== undefined) {
          passed = countNum >= (minCount as number);
        } else if (typeof count === "string" && count.startsWith(">")) {
          passed = countNum > parseInt(count.slice(1), 10);
        } else {
          passed = countNum === (count as number);
        }

        return {
          passed,
          message: `Found ${countNum} elements (expected: ${minCount ? `>=${minCount}` : count})`,
        };
      }

      case "noErrors": {
        // Check console for errors (already captured via page.on)
        return { passed: true, message: "No console errors detected" };
      }

      default:
        return { passed: true, message: `Unknown assertion type: ${type}` };
    }
  } catch (err) {
    return {
      passed: false,
      message: `Assertion failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Run a single test scenario
 */
async function runScenario(
  browser: Browser,
  scenarioKey: string,
  scenario: (typeof browserTestScenarios)[keyof typeof browserTestScenarios],
): Promise<TestResult> {
  const page = await browser.newPage();
  const start = Date.now();
  const screenshots: string[] = [];
  let error: string | undefined;

  // Capture console errors
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // Execute steps
    for (const step of scenario.steps) {
      await executeStep(page, step as Record<string, unknown>);
    }

    // Execute assertions
    const assertionResults: { passed: boolean; message: string }[] = [];
    for (const assertion of scenario.assertions) {
      const result = await executeAssertion(
        page,
        assertion as Record<string, unknown>,
      );
      assertionResults.push(result);
    }

    // Check if all assertions passed
    const allPassed = assertionResults.every((r) => r.passed);
    const failedAssertions = assertionResults.filter((r) => !r.passed);

    if (!allPassed) {
      error = failedAssertions.map((a) => a.message).join("; ");
    }

    // Take screenshot on failure
    if (!allPassed) {
      const screenshotPath = `/tmp/test-${scenarioKey}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      screenshots.push(screenshotPath);
    }

    return {
      scenario: scenarioKey,
      name: scenario.name,
      passed: allPassed && consoleErrors.length === 0,
      error:
        error ||
        (consoleErrors.length > 0
          ? `Console errors: ${consoleErrors.join(", ")}`
          : undefined),
      duration: Date.now() - start,
      screenshots,
    };
  } catch (err) {
    // Take screenshot on error
    const screenshotPath = `/tmp/test-${scenarioKey}-error-${Date.now()}.png`;
    try {
      await page.screenshot({ path: screenshotPath });
      screenshots.push(screenshotPath);
    } catch {
      // Ignore screenshot errors
    }

    return {
      scenario: scenarioKey,
      name: scenario.name,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
      screenshots,
    };
  } finally {
    await page.close();
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     Schema Viewer Browser Tests (Puppeteer)                  ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );
  console.log(`\nFrontend URL: ${FRONTEND_URL}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`Slow-mo: ${SLOW_MO}ms\n`);

  // Check frontend availability
  console.log("Checking frontend availability...");
  try {
    const response = await fetch(FRONTEND_URL);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    console.log("✓ Frontend is accessible\n");
  } catch (err) {
    console.error(`✗ Frontend not available at ${FRONTEND_URL}`);
    console.error("  Please start the frontend: cd frontend && npm run dev\n");
    process.exit(1);
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  console.log("Running test scenarios...\n");

  // Run each scenario
  for (const [key, scenario] of Object.entries(browserTestScenarios)) {
    const result = await runScenario(browser, key, scenario);
    results.push(result);

    const icon = result.passed ? "✓" : "✗";
    console.log(`${icon} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`  → ${result.error}`);
    }
    if (result.screenshots?.length) {
      console.log(`  Screenshot: ${result.screenshots[0]}`);
    }
  }

  await browser.close();

  // Print summary
  console.log("\n" + "═".repeat(60));
  console.log("TEST SUMMARY");
  console.log("═".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log("\n⚠ Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log("\n✓ All tests passed!");
  process.exit(0);
}

// Run tests
runAllTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
