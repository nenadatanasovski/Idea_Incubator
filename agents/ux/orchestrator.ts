// agents/ux/orchestrator.ts - Main entry point for UX Agent
// OBS-107: Integrated with ObservableAgent for unified observability

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
import { ObservableAgent } from "../../server/agents/observable-agent.js";
import { v4 as uuid } from "uuid";

export interface UXRunOptions {
  buildId?: string;
  screenshotOnFailure?: boolean;
  runAccessibility?: boolean;
  accessibilityOptions?: AccessibilityCheckOptions;
  timeout?: number;
}

/**
 * Main orchestrator for UX testing
 * OBS-107: Extends ObservableAgent for observability
 */
export class UXOrchestrator extends ObservableAgent {
  private bridge: MCPBridge;

  constructor(bridge: MCPBridge) {
    // OBS-107: Initialize observability base class
    const executionId = `ux-${uuid().slice(0, 8)}`;
    const instanceId = `ux-agent-${uuid().slice(0, 8)}`;
    super({
      executionId,
      instanceId,
      agentType: "ux-agent",
    });
    this.bridge = bridge;
  }

  /**
   * Run a journey by ID
   * OBS-107: Added observability logging
   */
  async runJourneyById(
    journeyId: string,
    options: UXRunOptions = {},
  ): Promise<UXRunResult> {
    const journey = getJourney(journeyId);
    if (!journey) {
      await this.logError(`Journey not found: ${journeyId}`, journeyId);
      throw new Error(`Journey not found: ${journeyId}`);
    }
    return this.runCustomJourney(journey, options);
  }

  /**
   * Run a custom journey
   * OBS-107: Added observability logging with phases and assertions
   */
  async runCustomJourney(
    journey: Journey,
    options: UXRunOptions = {},
  ): Promise<UXRunResult> {
    const taskId = `ux-journey-${journey.id}`;

    // OBS-107: Log task start
    await this.logTaskStart(taskId, `UX Journey: ${journey.name}`);

    try {
      // OBS-107: Phase 1 - Setup
      await this.logPhaseStart("setup", { journeyId: journey.id });

      const journeyWithTimeout: Journey = {
        ...journey,
        timeout: options.timeout || journey.timeout,
      };

      const runOptions: RunJourneyOptions = {
        screenshotOnFailure: options.screenshotOnFailure ?? true,
      };

      await this.logPhaseEnd("setup", { timeout: journeyWithTimeout.timeout });

      // OBS-107: Phase 2 - Execute journey
      await this.logPhaseStart("execute", { stepCount: journey.steps.length });

      const result = await runJourney(
        journeyWithTimeout,
        this.bridge,
        runOptions,
      );

      await this.logPhaseEnd("execute", {
        passed: result.passed,
        stepsPassed: result.steps.filter((s) => s.status === "passed").length,
        stepsFailed: result.steps.filter((s) => s.status === "failed").length,
      });

      // OBS-107: Phase 3 - Accessibility (optional)
      if (options.runAccessibility && result.passed) {
        await this.logPhaseStart("accessibility");
        result.accessibilityIssues = await this.tryAccessibilityCheck(
          options.accessibilityOptions,
        );
        await this.logPhaseEnd("accessibility", {
          issueCount: result.accessibilityIssues.length,
        });
      }

      // OBS-107: Phase 4 - Save results
      await this.logPhaseStart("save");
      await this.saveRun(result, options.buildId);
      await this.logPhaseEnd("save", { buildId: options.buildId });

      // OBS-107: Start assertion chain for journey validation
      const chainId = await this.startAssertionChain(
        taskId,
        `UX Journey: ${journey.name}`,
      );

      // Record assertion for overall journey result
      await this.assertManual(
        taskId,
        "journey",
        `Journey ${journey.id} completion`,
        result.passed,
        {
          totalSteps: result.steps.length,
          passedSteps: result.steps.filter((s) => s.status === "passed").length,
          durationMs: result.durationMs,
        },
      );

      // Record assertions for each step
      for (const step of result.steps) {
        await this.assertManual(
          taskId,
          "step",
          `Step ${step.stepIndex}: ${step.action}`,
          step.status === "passed",
          {
            stepIndex: step.stepIndex,
            action: step.action,
            durationMs: step.durationMs,
            error: step.error,
          },
        );
      }

      await this.endAssertionChain(chainId);

      // OBS-107: Log task completion
      await this.logTaskEnd(taskId, result.passed ? "complete" : "failed", {
        passed: result.passed,
        stepCount: result.steps.length,
        durationMs: result.durationMs,
      });

      return result;
    } catch (error) {
      // OBS-107: Log error
      await this.logError(
        error instanceof Error ? error.message : String(error),
        taskId,
      );
      await this.logTaskEnd(taskId, "failed");
      throw error;
    } finally {
      // OBS-107: Cleanup
      await this.close();
    }
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
