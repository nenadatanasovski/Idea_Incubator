// server/monitoring/state-reconciler.ts
// MON-004: State Reconciler - Compares data sources and detects drift

import { EventEmitter } from "events";

/**
 * A data source that can provide state for reconciliation.
 */
export interface StateSource {
  id: string;
  name: string;
  type: "database" | "api" | "event_bus" | "ui" | "file_system" | "cache";
  priority: number; // Higher = more authoritative (source of truth)
  fetchState: () => Promise<Record<string, unknown>>;
}

/**
 * Result of comparing two values.
 */
export interface FieldComparison {
  field: string;
  sourceA: { id: string; value: unknown };
  sourceB: { id: string; value: unknown };
  match: boolean;
  drift:
    | "missing_a"
    | "missing_b"
    | "value_mismatch"
    | "type_mismatch"
    | "none";
}

/**
 * Result of a reconciliation check.
 */
export interface ReconciliationResult {
  id: string;
  timestamp: Date;
  domain: string;
  sources: string[];
  consistent: boolean;
  comparisons: FieldComparison[];
  driftCount: number;
  suggestedAction?: string;
}

/**
 * Reconciliation domain - a group of sources to compare.
 */
export interface ReconciliationDomain {
  id: string;
  name: string;
  sources: StateSource[];
  fields: string[]; // Fields to compare (dot notation for nested)
  interval: number; // How often to check (ms)
  enabled: boolean;
}

/**
 * Configuration for State Reconciler.
 */
export interface StateReconcilerConfig {
  maxHistory: number;
  driftThreshold: number; // Max acceptable drift count before alerting
}

const DEFAULT_CONFIG: StateReconcilerConfig = {
  maxHistory: 500,
  driftThreshold: 3,
};

/**
 * State Reconciler - Compares multiple data sources to detect drift.
 *
 * The Monitoring Agent uses this to ensure:
 * 1. Database state matches event bus state
 * 2. API responses match database
 * 3. UI state matches backend state
 * 4. File system matches database (unified FS)
 *
 * When drift is detected, it emits events for the Response Escalator.
 */
export class StateReconciler extends EventEmitter {
  private config: StateReconcilerConfig;
  private domains: Map<string, ReconciliationDomain> = new Map();
  private results: ReconciliationResult[] = [];
  private intervalTimers: Map<string, ReturnType<typeof setInterval>> =
    new Map();
  private running: boolean = false;

  constructor(config: Partial<StateReconcilerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a reconciliation domain.
   */
  registerDomain(domain: ReconciliationDomain): void {
    this.domains.set(domain.id, domain);
    console.log(
      `[StateReconciler] Registered domain: ${domain.name} (${domain.sources.length} sources)`,
    );

    // Start monitoring if already running
    if (this.running && domain.enabled) {
      this.startDomainMonitoring(domain);
    }
  }

  /**
   * Remove a domain.
   */
  unregisterDomain(domainId: string): void {
    const timer = this.intervalTimers.get(domainId);
    if (timer) {
      clearInterval(timer);
      this.intervalTimers.delete(domainId);
    }
    this.domains.delete(domainId);
  }

  /**
   * Start the reconciler with periodic checks.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log("[StateReconciler] Starting state reconciliation...");

    for (const domain of this.domains.values()) {
      if (domain.enabled) {
        this.startDomainMonitoring(domain);
      }
    }

    console.log(`[StateReconciler] Started with ${this.domains.size} domains`);
  }

  /**
   * Start monitoring a specific domain.
   */
  private startDomainMonitoring(domain: ReconciliationDomain): void {
    // Run immediately
    this.reconcileDomain(domain.id).catch((err) => {
      console.error(
        `[StateReconciler] Initial reconciliation failed for ${domain.id}:`,
        err,
      );
    });

    // Set up periodic checks
    const timer = setInterval(() => {
      this.reconcileDomain(domain.id).catch((err) => {
        console.error(
          `[StateReconciler] Periodic reconciliation failed for ${domain.id}:`,
          err,
        );
      });
    }, domain.interval);

    this.intervalTimers.set(domain.id, timer);
  }

  /**
   * Stop the reconciler.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    for (const [domainId, timer] of this.intervalTimers) {
      clearInterval(timer);
      this.intervalTimers.delete(domainId);
    }

    console.log("[StateReconciler] Stopped");
  }

  /**
   * Reconcile a specific domain.
   */
  async reconcileDomain(domainId: string): Promise<ReconciliationResult> {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }

    const result: ReconciliationResult = {
      id: `${domainId}_${Date.now()}`,
      timestamp: new Date(),
      domain: domain.name,
      sources: domain.sources.map((s) => s.id),
      consistent: true,
      comparisons: [],
      driftCount: 0,
    };

    try {
      // Fetch state from all sources
      const states = await this.fetchAllStates(domain.sources);

      // Compare each pair of sources for each field
      for (const field of domain.fields) {
        const comparisons = this.compareField(field, domain.sources, states);
        result.comparisons.push(...comparisons);
      }

      // Calculate drift count
      result.driftCount = result.comparisons.filter(
        (c) => c.drift !== "none",
      ).length;
      result.consistent = result.driftCount === 0;

      // Suggest action if drift detected
      if (!result.consistent) {
        result.suggestedAction = this.suggestAction(domain, result);
      }
    } catch (error) {
      result.consistent = false;
      result.suggestedAction = `Reconciliation error: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Store result
    this.addResult(result);

    // Emit events
    if (result.consistent) {
      this.emit("reconciliation:success", result);
    } else {
      this.emit("reconciliation:drift", result);

      // Emit issue for Response Escalator if drift exceeds threshold
      if (result.driftCount >= this.config.driftThreshold) {
        this.emit("issue:detected", {
          type: "state_drift",
          severity:
            result.driftCount >= this.config.driftThreshold * 2
              ? "high"
              : "medium",
          description: `State drift detected in ${domain.name}: ${result.driftCount} inconsistencies`,
          evidence: result,
        });
      }
    }

    return result;
  }

  /**
   * Fetch state from all sources.
   */
  private async fetchAllStates(
    sources: StateSource[],
  ): Promise<Map<string, Record<string, unknown>>> {
    const states = new Map<string, Record<string, unknown>>();

    for (const source of sources) {
      try {
        const state = await source.fetchState();
        states.set(source.id, state);
      } catch (error) {
        console.error(
          `[StateReconciler] Failed to fetch state from ${source.id}:`,
          error,
        );
        states.set(source.id, { __error: String(error) });
      }
    }

    return states;
  }

  /**
   * Compare a field across all sources.
   */
  private compareField(
    field: string,
    sources: StateSource[],
    states: Map<string, Record<string, unknown>>,
  ): FieldComparison[] {
    const comparisons: FieldComparison[] = [];

    // Compare each pair
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const sourceA = sources[i];
        const sourceB = sources[j];
        const stateA = states.get(sourceA.id) || {};
        const stateB = states.get(sourceB.id) || {};

        const valueA = this.getNestedValue(stateA, field);
        const valueB = this.getNestedValue(stateB, field);

        const comparison: FieldComparison = {
          field,
          sourceA: { id: sourceA.id, value: valueA },
          sourceB: { id: sourceB.id, value: valueB },
          match: false,
          drift: "none",
        };

        // Check for drift
        if (valueA === undefined && valueB !== undefined) {
          comparison.drift = "missing_a";
        } else if (valueA !== undefined && valueB === undefined) {
          comparison.drift = "missing_b";
        } else if (typeof valueA !== typeof valueB) {
          comparison.drift = "type_mismatch";
        } else if (!this.deepEqual(valueA, valueB)) {
          comparison.drift = "value_mismatch";
        } else {
          comparison.match = true;
        }

        comparisons.push(comparison);
      }
    }

    return comparisons;
  }

  /**
   * Get a nested value using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Deep equality check.
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      for (const key of aKeys) {
        if (!this.deepEqual(aObj[key], bObj[key])) return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Suggest a corrective action based on drift.
   */
  private suggestAction(
    domain: ReconciliationDomain,
    result: ReconciliationResult,
  ): string {
    const driftTypes = new Map<string, number>();
    for (const comp of result.comparisons) {
      if (comp.drift !== "none") {
        driftTypes.set(comp.drift, (driftTypes.get(comp.drift) || 0) + 1);
      }
    }

    const dominant = [...driftTypes.entries()].sort((a, b) => b[1] - a[1])[0];

    // Find highest priority source (source of truth)
    const sourceOfTruth = domain.sources.reduce((a, b) =>
      a.priority > b.priority ? a : b,
    );

    switch (dominant?.[0]) {
      case "value_mismatch":
        return `Sync values from ${sourceOfTruth.name} (source of truth) to other sources`;
      case "missing_a":
      case "missing_b":
        return `Propagate missing fields from ${sourceOfTruth.name}`;
      case "type_mismatch":
        return `Investigate type inconsistencies - manual review recommended`;
      default:
        return `Review drift in ${domain.name}`;
    }
  }

  /**
   * Store a reconciliation result.
   */
  private addResult(result: ReconciliationResult): void {
    this.results.push(result);

    if (this.results.length > this.config.maxHistory) {
      this.results = this.results.slice(-this.config.maxHistory);
    }
  }

  /**
   * Get reconciliation history.
   */
  getResults(domainId?: string): ReconciliationResult[] {
    if (domainId) {
      return this.results.filter((r) => r.domain === domainId);
    }
    return [...this.results];
  }

  /**
   * Get the latest result for each domain.
   */
  getLatestResults(): Map<string, ReconciliationResult> {
    const latest = new Map<string, ReconciliationResult>();

    for (const result of this.results) {
      const existing = latest.get(result.domain);
      if (!existing || result.timestamp > existing.timestamp) {
        latest.set(result.domain, result);
      }
    }

    return latest;
  }

  /**
   * Force reconciliation of all domains.
   */
  async reconcileAll(): Promise<ReconciliationResult[]> {
    const results: ReconciliationResult[] = [];

    for (const domain of this.domains.values()) {
      if (domain.enabled) {
        try {
          const result = await this.reconcileDomain(domain.id);
          results.push(result);
        } catch (error) {
          console.error(
            `[StateReconciler] Failed to reconcile ${domain.id}:`,
            error,
          );
        }
      }
    }

    return results;
  }

  /**
   * Get registered domains.
   */
  getDomains(): ReconciliationDomain[] {
    return [...this.domains.values()];
  }

  /**
   * Get status.
   */
  getStatus(): {
    running: boolean;
    domainCount: number;
    totalResults: number;
    recentDrift: number;
  } {
    const recentCutoff = Date.now() - 5 * 60 * 1000; // Last 5 minutes
    const recentDrift = this.results.filter(
      (r) => !r.consistent && r.timestamp.getTime() > recentCutoff,
    ).length;

    return {
      running: this.running,
      domainCount: this.domains.size,
      totalResults: this.results.length,
      recentDrift,
    };
  }
}

/**
 * Create default domains for Vibe platform reconciliation.
 */
export function createDefaultDomains(): ReconciliationDomain[] {
  return [
    // Example: Database vs API state
    {
      id: "session-state",
      name: "Session State Consistency",
      sources: [], // Will be populated at runtime
      fields: ["session.status", "session.phase", "session.ideaId"],
      interval: 30000, // Check every 30 seconds
      enabled: false, // Enable when sources are registered
    },
    {
      id: "agent-state",
      name: "Agent State Consistency",
      sources: [],
      fields: ["agent.status", "agent.taskCount", "agent.lastActivity"],
      interval: 15000,
      enabled: false,
    },
  ];
}
