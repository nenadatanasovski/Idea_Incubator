// agents/ux/journey-runner.ts - Execute user journeys step by step

import { v4 as uuid } from "uuid";
import {
  Journey,
  JourneyStep,
  StepResult,
  UXRunResult,
} from "../../types/ux.js";
import { MCPBridge } from "./mcp-bridge.js";
import { ScreenshotManager } from "./screenshot-manager.js";

const DEFAULT_STEP_TIMEOUT = 10000;
const DEFAULT_JOURNEY_TIMEOUT = 60000;

export interface RunJourneyOptions {
  screenshotOnFailure?: boolean;
  screenshotDir?: string;
}

/**
 * Wait for an element and throw if not found
 */
async function waitForElement(
  bridge: MCPBridge,
  selector: string,
  timeout: number,
): Promise<void> {
  const found = await bridge.waitForSelector(selector, timeout);
  if (!found) {
    throw new Error(`Element not found: ${selector}`);
  }
}

/**
 * Run a complete journey
 */
export async function runJourney(
  journey: Journey,
  bridge: MCPBridge,
  options: RunJourneyOptions = {},
): Promise<UXRunResult> {
  const runId = uuid();
  const startedAt = new Date().toISOString();
  const screenshotManager = new ScreenshotManager(options.screenshotDir);
  const journeyTimeout = journey.timeout || DEFAULT_JOURNEY_TIMEOUT;

  const steps: StepResult[] = [];
  const screenshots: string[] = [];
  let passed = true;
  let status: "completed" | "failed" | "timeout" = "completed";

  const timeoutPromise = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), journeyTimeout);
  });

  try {
    await bridge.navigate(journey.startUrl);

    for (let i = 0; i < journey.steps.length; i++) {
      const step = journey.steps[i];

      const stepResultOrTimeout = await Promise.race([
        executeStep(step, i, bridge, screenshotManager, runId),
        timeoutPromise,
      ]);

      if (stepResultOrTimeout === "timeout") {
        status = "timeout";
        passed = false;
        steps.push({
          stepIndex: i,
          action: step.action,
          target: step.target,
          status: "failed",
          error: "Journey timeout exceeded",
          durationMs: 0,
        });
        break;
      }

      const stepResult = stepResultOrTimeout;
      steps.push(stepResult);

      if (stepResult.screenshotPath) {
        screenshots.push(stepResult.screenshotPath);
      }

      if (stepResult.status === "failed") {
        passed = false;
        status = "failed";

        if (options.screenshotOnFailure) {
          try {
            const failScreenshot = await screenshotManager.capture(
              bridge,
              runId,
              i,
              "failure",
            );
            screenshots.push(failScreenshot);
          } catch {
            // Ignore screenshot failure
          }
        }

        break;
      }
    }
  } catch (error) {
    passed = false;
    status = "failed";
    steps.push({
      stepIndex: steps.length,
      action: "navigate",
      target: journey.startUrl,
      status: "failed",
      error: (error as Error).message,
      durationMs: 0,
    });
  }

  const completedAt = new Date().toISOString();
  const durationMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();

  return {
    id: runId,
    journeyId: journey.id,
    status,
    passed,
    steps,
    accessibilityIssues: [],
    screenshots,
    durationMs,
    startedAt,
    completedAt,
  };
}

/**
 * Execute a single step
 */
async function executeStep(
  step: JourneyStep,
  index: number,
  bridge: MCPBridge,
  screenshotManager: ScreenshotManager,
  runId: string,
): Promise<StepResult> {
  const startTime = Date.now();
  const timeout = step.timeout || DEFAULT_STEP_TIMEOUT;

  try {
    const screenshotPath = await executeStepAction(
      step,
      bridge,
      screenshotManager,
      runId,
      index,
      timeout,
    );

    return {
      stepIndex: index,
      action: step.action,
      target: step.target,
      status: "passed",
      screenshotPath,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      stepIndex: index,
      action: step.action,
      target: step.target,
      status: "failed",
      error: (error as Error).message,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute the action for a step, returning optional screenshot path
 */
async function executeStepAction(
  step: JourneyStep,
  bridge: MCPBridge,
  screenshotManager: ScreenshotManager,
  runId: string,
  index: number,
  timeout: number,
): Promise<string | undefined> {
  switch (step.action) {
    case "navigate":
      await bridge.navigate(step.target!);
      return undefined;

    case "click":
      await waitForElement(bridge, step.target!, timeout);
      await bridge.click(step.target!);
      return undefined;

    case "type":
      await waitForElement(bridge, step.target!, timeout);
      await bridge.type(step.target!, step.value!);
      return undefined;

    case "select":
      await waitForElement(bridge, step.target!, timeout);
      await bridge.select(step.target!, step.value!);
      return undefined;

    case "wait":
      await waitForElement(bridge, step.target!, timeout);
      return undefined;

    case "assert":
      await executeAssert(step.target!, step.value!, bridge, timeout);
      return undefined;

    case "screenshot":
      return screenshotManager.capture(bridge, runId, index, step.description);
  }
}

/**
 * Assert element contains expected value
 */
async function executeAssert(
  selector: string,
  expectedValue: string,
  bridge: MCPBridge,
  timeout: number,
): Promise<void> {
  await waitForElement(bridge, selector, timeout);

  const actualValue = await bridge.getTextContent(selector);
  if (actualValue === null) {
    throw new Error(`Could not get text content of: ${selector}`);
  }

  if (!actualValue.includes(expectedValue)) {
    throw new Error(
      `Assertion failed: expected "${selector}" to contain "${expectedValue}", got "${actualValue}"`,
    );
  }
}
