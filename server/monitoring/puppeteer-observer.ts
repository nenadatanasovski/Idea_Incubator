// server/monitoring/puppeteer-observer.ts
// MON-003: Puppeteer MCP Observer - UI validation through browser automation

import { EventEmitter } from "events";

/**
 * UI element to observe for validation.
 */
export interface UIElement {
  selector: string;
  description: string;
  expectedState?: "visible" | "hidden" | "enabled" | "disabled" | "contains";
  expectedValue?: string;
}

/**
 * UI validation rule.
 */
export interface UIValidationRule {
  id: string;
  name: string;
  url: string;
  elements: UIElement[];
  interval: number; // How often to check (ms)
  enabled: boolean;
}

/**
 * Result of a UI observation.
 */
export interface UIObservation {
  ruleId: string;
  ruleName: string;
  timestamp: Date;
  url: string;
  success: boolean;
  elementResults: {
    selector: string;
    description: string;
    passed: boolean;
    actual?: string;
    expected?: string;
    error?: string;
  }[];
  screenshotPath?: string;
  error?: string;
}

/**
 * Configuration for Puppeteer Observer.
 */
export interface PuppeteerObserverConfig {
  baseUrl: string;
  screenshotDir: string;
  defaultTimeout: number;
  headless: boolean;
  viewport: { width: number; height: number };
}

const DEFAULT_CONFIG: PuppeteerObserverConfig = {
  baseUrl: "http://localhost:3000",
  screenshotDir: "./screenshots/monitoring",
  defaultTimeout: 30000,
  headless: true,
  viewport: { width: 1920, height: 1080 },
};

/**
 * Default UI validation rules for the Vibe platform.
 */
const DEFAULT_RULES: UIValidationRule[] = [
  {
    id: "dashboard-health",
    name: "Dashboard Health Check",
    url: "/dashboard",
    elements: [
      {
        selector: '[data-testid="agent-status"]',
        description: "Agent status panel",
        expectedState: "visible",
      },
      {
        selector: '[data-testid="question-queue"]',
        description: "Question queue panel",
        expectedState: "visible",
      },
    ],
    interval: 60000, // Check every minute
    enabled: true,
  },
  {
    id: "api-health",
    name: "API Health Endpoint",
    url: "/api/health",
    elements: [
      {
        selector: "pre",
        description: "JSON response",
        expectedState: "visible",
      },
    ],
    interval: 30000, // Check every 30 seconds
    enabled: true,
  },
];

/**
 * Puppeteer Observer - Validates UI state using browser automation.
 *
 * This observer uses the Puppeteer MCP tools to:
 * 1. Navigate to pages
 * 2. Check element visibility/state
 * 3. Take screenshots for evidence
 * 4. Report discrepancies to the monitoring system
 *
 * Note: Actual Puppeteer MCP calls are made through the MCP interface.
 * This class provides the orchestration logic.
 */
export class PuppeteerObserver extends EventEmitter {
  private config: PuppeteerObserverConfig;
  private rules: UIValidationRule[];
  private observations: UIObservation[] = [];
  private intervalTimers: Map<string, ReturnType<typeof setInterval>> =
    new Map();
  private running: boolean = false;
  private maxObservations: number = 1000;

  // MCP tool interface (to be injected)
  private mcpNavigate?: (url: string) => Promise<void>;
  private mcpScreenshot?: (path: string) => Promise<string>;
  private mcpEvaluate?: (script: string) => Promise<unknown>;

  constructor(
    config: Partial<PuppeteerObserverConfig> = {},
    rules?: UIValidationRule[],
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = rules || DEFAULT_RULES;
  }

  /**
   * Set the MCP tool functions for browser automation.
   * These should be bound to actual MCP tool calls.
   */
  setMCPTools(tools: {
    navigate: (url: string) => Promise<void>;
    screenshot: (path: string) => Promise<string>;
    evaluate: (script: string) => Promise<unknown>;
  }): void {
    this.mcpNavigate = tools.navigate;
    this.mcpScreenshot = tools.screenshot;
    this.mcpEvaluate = tools.evaluate;
  }

  /**
   * Start the observer with periodic checks.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log("[PuppeteerObserver] Starting UI observation...");

    // Set up interval timers for each enabled rule
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Run immediately
      this.runRule(rule).catch((err) => {
        console.error(
          `[PuppeteerObserver] Initial check failed for ${rule.id}:`,
          err,
        );
      });

      // Set up periodic checks
      const timer = setInterval(() => {
        this.runRule(rule).catch((err) => {
          console.error(
            `[PuppeteerObserver] Periodic check failed for ${rule.id}:`,
            err,
          );
        });
      }, rule.interval);

      this.intervalTimers.set(rule.id, timer);
    }

    console.log(
      `[PuppeteerObserver] Started with ${this.rules.filter((r) => r.enabled).length} active rules`,
    );
  }

  /**
   * Stop the observer.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Clear all interval timers
    for (const [ruleId, timer] of this.intervalTimers) {
      clearInterval(timer);
      this.intervalTimers.delete(ruleId);
    }

    console.log("[PuppeteerObserver] Stopped");
  }

  /**
   * Run a single validation rule.
   */
  async runRule(rule: UIValidationRule): Promise<UIObservation> {
    const observation: UIObservation = {
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: new Date(),
      url: rule.url,
      success: false,
      elementResults: [],
    };

    try {
      // Navigate to the page
      const fullUrl = rule.url.startsWith("http")
        ? rule.url
        : `${this.config.baseUrl}${rule.url}`;

      if (this.mcpNavigate) {
        await this.mcpNavigate(fullUrl);
      } else {
        // Simulate navigation for testing
        console.log(`[PuppeteerObserver] Would navigate to: ${fullUrl}`);
      }

      // Check each element
      for (const element of rule.elements) {
        const result = await this.checkElement(element);
        observation.elementResults.push(result);
      }

      // Take screenshot
      if (this.mcpScreenshot) {
        const screenshotPath = `${this.config.screenshotDir}/${rule.id}_${Date.now()}.png`;
        observation.screenshotPath = await this.mcpScreenshot(screenshotPath);
      }

      // Determine overall success
      observation.success = observation.elementResults.every((r) => r.passed);
    } catch (error) {
      observation.error =
        error instanceof Error ? error.message : String(error);
      observation.success = false;
    }

    // Store observation
    this.addObservation(observation);

    // Emit events
    if (observation.success) {
      this.emit("observation:success", observation);
    } else {
      this.emit("observation:failure", observation);
      this.emit("issue:detected", {
        type: "ui_validation",
        severity: "medium",
        description: `UI validation failed for ${rule.name}: ${observation.error || "Element checks failed"}`,
        evidence: observation,
      });
    }

    return observation;
  }

  /**
   * Check a single UI element.
   */
  private async checkElement(
    element: UIElement,
  ): Promise<UIObservation["elementResults"][0]> {
    const result: UIObservation["elementResults"][0] = {
      selector: element.selector,
      description: element.description,
      passed: false,
    };

    try {
      if (!this.mcpEvaluate) {
        // Simulate check for testing
        result.passed = true;
        result.actual = "simulated";
        return result;
      }

      // Build evaluation script based on expected state
      let script: string;

      switch (element.expectedState) {
        case "visible":
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              if (!el) return { found: false };
              const style = window.getComputedStyle(el);
              const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              return { found: true, visible, text: el.textContent?.slice(0, 100) };
            })()
          `;
          break;

        case "hidden":
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              if (!el) return { found: false, hidden: true };
              const style = window.getComputedStyle(el);
              const hidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
              return { found: true, hidden };
            })()
          `;
          break;

        case "enabled":
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              if (!el) return { found: false };
              return { found: true, enabled: !el.disabled };
            })()
          `;
          break;

        case "disabled":
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              if (!el) return { found: false };
              return { found: true, disabled: el.disabled === true };
            })()
          `;
          break;

        case "contains":
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              if (!el) return { found: false };
              const text = el.textContent || '';
              return { found: true, text, contains: text.includes('${element.expectedValue || ""}') };
            })()
          `;
          break;

        default:
          // Default: just check if element exists
          script = `
            (() => {
              const el = document.querySelector('${element.selector}');
              return { found: !!el };
            })()
          `;
      }

      const evalResult = (await this.mcpEvaluate(script)) as Record<
        string,
        unknown
      >;

      if (!evalResult.found) {
        result.passed = false;
        result.error = "Element not found";
        return result;
      }

      // Check based on expected state
      switch (element.expectedState) {
        case "visible":
          result.passed = evalResult.visible === true;
          result.actual = evalResult.visible ? "visible" : "hidden";
          result.expected = "visible";
          break;

        case "hidden":
          result.passed = evalResult.hidden === true;
          result.actual = evalResult.hidden ? "hidden" : "visible";
          result.expected = "hidden";
          break;

        case "enabled":
          result.passed = evalResult.enabled === true;
          result.actual = evalResult.enabled ? "enabled" : "disabled";
          result.expected = "enabled";
          break;

        case "disabled":
          result.passed = evalResult.disabled === true;
          result.actual = evalResult.disabled ? "disabled" : "enabled";
          result.expected = "disabled";
          break;

        case "contains":
          result.passed = evalResult.contains === true;
          result.actual = String(evalResult.text).slice(0, 100);
          result.expected = `contains "${element.expectedValue}"`;
          break;

        default:
          result.passed = true;
          result.actual = "found";
      }
    } catch (error) {
      result.passed = false;
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Add observation to history.
   */
  private addObservation(observation: UIObservation): void {
    this.observations.push(observation);

    // Trim history
    if (this.observations.length > this.maxObservations) {
      this.observations = this.observations.slice(-this.maxObservations);
    }
  }

  /**
   * Get observation history.
   */
  getObservations(ruleId?: string): UIObservation[] {
    if (ruleId) {
      return this.observations.filter((o) => o.ruleId === ruleId);
    }
    return [...this.observations];
  }

  /**
   * Get the latest observation for each rule.
   */
  getLatestObservations(): Map<string, UIObservation> {
    const latest = new Map<string, UIObservation>();

    for (const obs of this.observations) {
      const existing = latest.get(obs.ruleId);
      if (!existing || obs.timestamp > existing.timestamp) {
        latest.set(obs.ruleId, obs);
      }
    }

    return latest;
  }

  /**
   * Add a new validation rule.
   */
  addRule(rule: UIValidationRule): void {
    this.rules.push(rule);

    if (this.running && rule.enabled) {
      // Start checking this rule immediately
      const timer = setInterval(() => {
        this.runRule(rule).catch(console.error);
      }, rule.interval);

      this.intervalTimers.set(rule.id, timer);
    }
  }

  /**
   * Remove a validation rule.
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);

    const timer = this.intervalTimers.get(ruleId);
    if (timer) {
      clearInterval(timer);
      this.intervalTimers.delete(ruleId);
    }
  }

  /**
   * Get all rules.
   */
  getRules(): UIValidationRule[] {
    return [...this.rules];
  }

  /**
   * Run all rules immediately (manual trigger).
   */
  async runAllRules(): Promise<UIObservation[]> {
    const results: UIObservation[] = [];

    for (const rule of this.rules.filter((r) => r.enabled)) {
      try {
        const observation = await this.runRule(rule);
        results.push(observation);
      } catch (error) {
        console.error(
          `[PuppeteerObserver] Failed to run rule ${rule.id}:`,
          error,
        );
      }
    }

    return results;
  }

  /**
   * Get health status of the observer.
   */
  getStatus(): {
    running: boolean;
    ruleCount: number;
    activeRules: number;
    totalObservations: number;
    recentFailures: number;
  } {
    const recentCutoff = Date.now() - 5 * 60 * 1000; // Last 5 minutes
    const recentFailures = this.observations.filter(
      (o) => !o.success && o.timestamp.getTime() > recentCutoff,
    ).length;

    return {
      running: this.running,
      ruleCount: this.rules.length,
      activeRules: this.rules.filter((r) => r.enabled).length,
      totalObservations: this.observations.length,
      recentFailures,
    };
  }
}
