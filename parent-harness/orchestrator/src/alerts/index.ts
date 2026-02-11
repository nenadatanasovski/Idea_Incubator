/**
 * Alert Rules Engine
 *
 * Monitors system health and triggers alerts for critical conditions.
 *
 * First Principles:
 * 1. Actionable: Every alert should require action
 * 2. No Spam: Same alert once per hour max
 * 3. Severity: Critical > Warning > Info
 * 4. Multi-Channel: Log + Telegram + Event
 */

import { events, getEvents, ObservabilityEvent } from "../db/events.js";
import { notifyAgent } from "../telegram/direct-telegram.js";
import * as agents from "../db/agents.js";
import * as tasks from "../db/tasks.js";
import { getBuildHealth } from "../build-health/index.js";
import { getStabilityStats } from "../stability/index.js";

// Alert definitions
interface AlertRule {
  id: string;
  name: string;
  severity: "critical" | "warning" | "info";
  check: () => Promise<{ triggered: boolean; message: string }>;
  cooldownMs: number; // Minimum time between same alerts
}

// Track last alert times
const lastAlertTimes = new Map<string, number>();

// Alert rules
const ALERT_RULES: AlertRule[] = [
  {
    id: "all_agents_stuck",
    name: "All Agents Stuck",
    severity: "critical",
    cooldownMs: 30 * 60 * 1000, // 30 min
    check: async () => {
      const allAgents = agents.getAgents();
      const workingAgents = allAgents.filter(
        (a) => !["orchestrator", "sia"].includes(a.type) && a.status !== "idle",
      );
      const stuckAgents = allAgents.filter((a) => a.status === "stuck");

      if (
        stuckAgents.length > 0 &&
        stuckAgents.length === workingAgents.length
      ) {
        return {
          triggered: true,
          message: `All ${stuckAgents.length} working agents are stuck!`,
        };
      }
      return { triggered: false, message: "" };
    },
  },
  {
    id: "high_failure_rate",
    name: "High Task Failure Rate",
    severity: "warning",
    cooldownMs: 60 * 60 * 1000, // 1 hour
    check: async () => {
      // Get recent task stats from events
      const recentEvents: ObservabilityEvent[] = getEvents({
        since: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        limit: 500,
      });

      const completed = recentEvents.filter(
        (e: ObservabilityEvent) => e.type === "task:completed",
      ).length;
      const failed = recentEvents.filter(
        (e: ObservabilityEvent) => e.type === "task:failed",
      ).length;
      const total = completed + failed;

      if (total >= 5) {
        // Need at least 5 tasks to calculate
        const successRate = (completed / total) * 100;
        if (successRate < 30) {
          return {
            triggered: true,
            message: `Task success rate is ${successRate.toFixed(0)}% (${completed}/${total}) in last 30min`,
          };
        }
      }
      return { triggered: false, message: "" };
    },
  },
  {
    id: "build_critical",
    name: "Build Health Critical",
    severity: "critical",
    cooldownMs: 60 * 60 * 1000, // 1 hour
    check: async () => {
      const health = getBuildHealth();
      if (health.status === "critical") {
        return {
          triggered: true,
          message: `Build critical: ${health.errorCount} TypeScript errors`,
        };
      }
      return { triggered: false, message: "" };
    },
  },
  {
    id: "high_crash_count",
    name: "High Crash Count",
    severity: "warning",
    cooldownMs: 60 * 60 * 1000, // 1 hour
    check: async () => {
      const stats = getStabilityStats();
      if (stats.crashCount >= 5) {
        return {
          triggered: true,
          message: `Orchestrator has crashed ${stats.crashCount} times this session`,
        };
      }
      return { triggered: false, message: "" };
    },
  },
  {
    id: "tasks_blocked_too_long",
    name: "Tasks Blocked Too Long",
    severity: "warning",
    cooldownMs: 2 * 60 * 60 * 1000, // 2 hours
    check: async () => {
      const allTasks = tasks.getTasks({ status: "blocked" });
      // Count tasks blocked for more than 24 hours
      const now = Date.now();
      const staleBlocked = allTasks.filter((t) => {
        if (!t.updated_at) return false;
        const age = now - new Date(t.updated_at).getTime();
        return age > 24 * 60 * 60 * 1000;
      });

      if (staleBlocked.length >= 5) {
        return {
          triggered: true,
          message: `${staleBlocked.length} tasks have been blocked for 24+ hours`,
        };
      }
      return { triggered: false, message: "" };
    },
  },
];

/**
 * Check if an alert should fire (respecting cooldown)
 */
function shouldFireAlert(ruleId: string, cooldownMs: number): boolean {
  const lastFired = lastAlertTimes.get(ruleId) || 0;
  const elapsed = Date.now() - lastFired;
  return elapsed >= cooldownMs;
}

/**
 * Record that an alert was fired
 */
function recordAlertFired(ruleId: string): void {
  lastAlertTimes.set(ruleId, Date.now());
}

/**
 * Run all alert checks
 */
export async function checkAlerts(): Promise<void> {
  for (const rule of ALERT_RULES) {
    try {
      // Check cooldown first
      if (!shouldFireAlert(rule.id, rule.cooldownMs)) {
        continue;
      }

      // Run the check
      const result = await rule.check();

      if (result.triggered) {
        // Fire the alert
        await fireAlert(rule, result.message);
        recordAlertFired(rule.id);
      }
    } catch (err) {
      console.error(`Alert check error (${rule.id}):`, err);
    }
  }
}

/**
 * Fire an alert
 */
async function fireAlert(rule: AlertRule, message: string): Promise<void> {
  const emoji =
    rule.severity === "critical"
      ? "🚨"
      : rule.severity === "warning"
        ? "⚠️"
        : "ℹ️";
  const fullMessage = `${emoji} *${rule.name}*\n${message}`;

  // Log to console
  console.log(
    `[ALERT] ${rule.severity.toUpperCase()}: ${rule.name} - ${message}`,
  );

  // Log to events
  if (rule.severity === "critical") {
    events.systemError?.("alerts", `${rule.name}: ${message}`);
  }

  // Send to Telegram (monitor bot)
  try {
    await notifyAgent("monitor", fullMessage);
  } catch (err) {
    console.error("Failed to send Telegram alert:", err);
  }
}

/**
 * Get current alert status
 */
export function getAlertStatus(): {
  rules: { id: string; name: string; lastFired: string | null }[];
  recentAlerts: number;
} {
  const now = Date.now();
  const recentWindow = 60 * 60 * 1000; // 1 hour

  const rules = ALERT_RULES.map((rule) => ({
    id: rule.id,
    name: rule.name,
    lastFired: lastAlertTimes.has(rule.id)
      ? new Date(lastAlertTimes.get(rule.id)!).toISOString()
      : null,
  }));

  const recentAlerts = Array.from(lastAlertTimes.values()).filter(
    (time) => now - time < recentWindow,
  ).length;

  return { rules, recentAlerts };
}

/**
 * Start alert monitoring (call from orchestrator tick)
 */
export function initAlerts(): void {
  console.log("🔔 Alert engine initialized");
}

export default {
  checkAlerts,
  getAlertStatus,
  initAlerts,
};
