// agents/ux/orchestrator.ts - Main entry point for UX Agent

import {
  Journey,
  UXRunResult,
  UXRun,
  AccessibilityIssue,
} from "../../types/ux.js";
import { MCPBridge } from "./mcp-bridge.js";
import { runJourney, RunJourneyOptions } from "./journey-runner.js";
import {
  checkAccessibility,
  AccessibilityCheckOptions,
} from "./accessibility-checker.js";
import {
  getJourney,
  getJourneysByTag,
  getAllJourneys,
} from "./journey-definitions.js";
import { saveUXRun, saveStepResults, saveAccessibilityIssues } from "./db.js";

export interface UXRunOptions {
  buildId?: string;
  screenshotOnFailure?: boolean;
  runAccessibility?: boolean;
  accessibilityOptions?: AccessibilityCheckOptions;
  timeout?: number;
}

/**
 * Main orchestrator for UX testing
 */
export class UXOrchestrator {
  private bridge: MCPBridge;

  constructor(bridge: MCPBridge) {
    this.bridge = bridge;
  }

  /**
   * Run a journey by ID
   */
  async runJourneyById(
    journeyId: string,
    options: UXRunOptions = {},
  ): Promise<UXRunResult> {
    const journey = getJourney(journeyId);
    if (!journey) {
      throw new Error(`Journey not found: ${journeyId}`);
    }
    return this.runCustomJourney(journey, options);
  }

  /**
   * Run a custom journey
   */
  async runCustomJourney(
    journey: Journey,
    options: UXRunOptions = {},
  ): Promise<UXRunResult> {
    const journeyWithTimeout: Journey = {
      ...journey,
      timeout: options.timeout || journey.timeout,
    };

    const runOptions: RunJourneyOptions = {
      screenshotOnFailure: options.screenshotOnFailure ?? true,
    };

    const result = await runJourney(
      journeyWithTimeout,
      this.bridge,
      runOptions,
    );

    if (options.runAccessibility && result.passed) {
      result.accessibilityIssues = await this.tryAccessibilityCheck(
        options.accessibilityOptions,
      );
    }

    await this.saveRun(result, options.buildId);

    return result;
  }

  /**
   * Run accessibility check, logging errors but not failing
   */
  private async tryAccessibilityCheck(
    options?: AccessibilityCheckOptions,
  ): Promise<AccessibilityIssue[]> {
    try {
      return await checkAccessibility(this.bridge, options);
    } catch (error) {
      console.error("Accessibility check failed:", error);
      return [];
    }
  }

  /**
   * Run accessibility check on a URL
   */
  async checkAccessibilityUrl(
    url: string,
    options: AccessibilityCheckOptions = {},
  ): Promise<AccessibilityIssue[]> {
    await this.bridge.navigate(url);
    await this.bridge.waitForSelector("body", 5000);
    return checkAccessibility(this.bridge, options);
  }

  /**
   * Run all journeys with a specific tag
   */
  async runJourneysByTag(
    tag: string,
    options: UXRunOptions = {},
  ): Promise<UXRunResult[]> {
    const journeys = getJourneysByTag(tag);
    return this.runJourneys(journeys, options);
  }

  /**
   * Run all registered journeys
   */
  async runAllJourneys(options: UXRunOptions = {}): Promise<UXRunResult[]> {
    const journeys = getAllJourneys();
    return this.runJourneys(journeys, options);
  }

  /**
   * Run multiple journeys sequentially
   */
  private async runJourneys(
    journeys: Journey[],
    options: UXRunOptions,
  ): Promise<UXRunResult[]> {
    const results: UXRunResult[] = [];
    for (const journey of journeys) {
      const result = await this.runCustomJourney(journey, options);
      results.push(result);
    }
    return results;
  }

  /**
   * Save run results to database
   */
  private async saveRun(result: UXRunResult, buildId?: string): Promise<void> {
    const run: UXRun = {
      id: result.id,
      buildId: buildId || null,
      journeyId: result.journeyId,
      status: result.status,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      passed: result.passed ? 1 : 0,
      summaryJson: JSON.stringify({
        stepsTotal: result.steps.length,
        stepsPassed: result.steps.filter((s) => s.status === "passed").length,
        accessibilityIssues: result.accessibilityIssues.length,
        screenshots: result.screenshots.length,
        durationMs: result.durationMs,
      }),
    };

    await saveUXRun(run);
    await saveStepResults(result.id, result.steps);

    if (result.accessibilityIssues.length > 0) {
      await saveAccessibilityIssues(result.id, result.accessibilityIssues);
    }
  }

  /**
   * List available journeys
   */
  listJourneys(): Journey[] {
    return getAllJourneys();
  }

  /**
   * Get journey by ID
   */
  getJourney(id: string): Journey | undefined {
    return getJourney(id);
  }
}
