#!/usr/bin/env tsx
/**
 * Monitoring Agent Runner
 *
 * Continuous monitoring loop that:
 * 1. Watches all agents for heartbeats, errors, and blocks
 * 2. Learns baseline metrics for anomaly detection
 * 3. Reconciles state between UI and database
 * 4. Executes corrective actions with human confirmation
 * 5. Escalates issues that need attention
 *
 * Usage:
 *   npx tsx server/monitoring/run-monitoring.ts
 *   npx tsx server/monitoring/run-monitoring.ts --level verbose
 */

import { MonitoringAgent, MonitoringLevel } from "./monitoring-agent.js";
import { BaselineLearner, VIBE_METRICS } from "./baseline-learner.js";
import { ResponseEscalator } from "./response-escalator.js";
import { ActionExecutor, createDefaultActions } from "./action-executor.js";
import { StateReconciler, createDefaultDomains } from "./state-reconciler.js";
import { query, getOne, run as dbRun } from "../../database/db.js";
import { createTaskExecutor, TaskExecutor } from "../services/task-executor.js";
import * as path from "path";

// Parse CLI arguments
const args = process.argv.slice(2);
const levelArg = args.find((a) => a.startsWith("--level="));
const monitoringLevel: MonitoringLevel = levelArg
  ? (levelArg.split("=")[1] as MonitoringLevel)
  : "standard";

// Task list argument for autonomous execution
const taskListArg = args.find((a) => a.startsWith("--task-list="));
const taskListPath = taskListArg ? taskListArg.split("=")[1] : null;

// Auto-start execution
const autoStart = args.includes("--auto-start");

// Dry run mode (don't actually modify files)
const dryRun = args.includes("--dry-run");

console.log(`
╔══════════════════════════════════════════════════════════════╗
║             MONITORING AGENT - CONTINUOUS LOOP               ║
║                    Level: ${monitoringLevel.padEnd(8)}                           ║
║                 Task List: ${(taskListPath || "None").slice(-30).padEnd(30)}  ║
║                Auto-Start: ${(autoStart ? "Yes" : "No").padEnd(30)}  ║
║                  Dry Run: ${(dryRun ? "Yes" : "No").padEnd(30)}   ║
╚══════════════════════════════════════════════════════════════╝
`);

// Create a database adapter that matches the expected interface
const dbAdapter = {
  async run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }> {
    await dbRun(sql, params as (string | number | boolean | null)[]);
    return { lastID: 0, changes: 0 };
  },
  async get<T>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const result = (await getOne(
      sql,
      params as (string | number | boolean | null)[],
    )) as T | null;
    return result ?? undefined;
  },
  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return (await query(
      sql,
      params as (string | number | boolean | null)[],
    )) as unknown as T[];
  },
};

// Initialize components
const monitoringAgent = new MonitoringAgent(dbAdapter, {
  level: monitoringLevel,
  heartbeatIntervalMs: 30000, // 30 seconds
  healthCheckIntervalMs: 60000, // 1 minute
  agentTimeoutMs: 5 * 60 * 1000, // 5 minutes
  alertThresholds: {
    pendingQuestions: 5,
    blockedAgents: 2,
    errorRate: 15,
    responseTimeMs: 60000,
  },
});

const baselineLearner = new BaselineLearner({
  minSamplesForBaseline: 5,
  updateInterval: 30000, // 30 seconds
  anomalyThresholds: {
    low: 2,
    medium: 3,
    high: 4,
    critical: 5,
  },
});

const responseEscalator = new ResponseEscalator(
  {} as any, // CommunicationHub placeholder
  [], // default rules
);

const actionExecutor = new ActionExecutor({
  autoConfirmThreshold: 0.9,
  maxRetries: 3,
  confirmationTimeout: 300000, // 5 minutes
});

const stateReconciler = new StateReconciler();

// Register default actions
for (const action of createDefaultActions()) {
  actionExecutor.registerAction(action);
}

// Register default reconciliation domains
for (const domain of createDefaultDomains()) {
  stateReconciler.registerDomain(domain);
}

// Wire up event handlers
monitoringAgent.on("issue:detected", async (issue) => {
  console.log(
    `[MonitoringLoop] Issue detected: ${issue.description} (${issue.severity})`,
  );

  // Record metric for anomaly detection
  baselineLearner.recordMetric(VIBE_METRICS.AGENT_ERROR_RATE, 1, {
    agentId: issue.agentId || "system",
    issueType: issue.type,
  });

  // Handle the issue (determines level and executes response)
  const response = await responseEscalator.handleIssue(issue);
  console.log(`[MonitoringLoop] Response: ${JSON.stringify(response)}`);
});

monitoringAgent.on("agent:status", ({ agentId, status, previousStatus }) => {
  console.log(
    `[MonitoringLoop] Agent ${agentId}: ${previousStatus} -> ${status}`,
  );

  // Record state change
  baselineLearner.recordMetric(
    VIBE_METRICS.AGENT_QUEUE_SIZE,
    status === "blocked" ? 1 : 0,
    { agentId },
  );
});

monitoringAgent.on("health:check", (metrics) => {
  // Record health metrics
  baselineLearner.recordMetric(VIBE_METRICS.SYSTEM_CPU, metrics.activeAgents);
  baselineLearner.recordMetric(
    VIBE_METRICS.API_LATENCY,
    metrics.averageResponseTime,
  );

  if (monitoringLevel === "verbose" || monitoringLevel === "debug") {
    console.log(`[MonitoringLoop] Health check:`, {
      active: metrics.activeAgents,
      blocked: metrics.blockedAgents,
      pending: metrics.pendingQuestions,
      uptime: Math.round(metrics.systemUptime / 1000) + "s",
    });
  }
});

baselineLearner.on("anomaly:detected", (anomaly) => {
  console.log(
    `[MonitoringLoop] Anomaly detected in ${anomaly.metric}: ${anomaly.value} (${anomaly.deviationScore.toFixed(1)}σ)`,
  );

  // Create an observation for the action executor
  const observation = actionExecutor.createObservation(
    `anomaly_${anomaly.metric}`,
    "automated",
    `Anomaly detected: ${anomaly.metric} = ${anomaly.value.toFixed(2)}`,
    { anomaly },
    0.7, // 70% confidence for automated detection
    anomaly.severity === "high" || anomaly.severity === "critical"
      ? ["notify-human"]
      : [],
  );

  console.log(`[MonitoringLoop] Created observation: ${observation.id}`);
});

// Track reconciliation
let reconciliationCount = 0;
async function performReconciliation(): Promise<void> {
  reconciliationCount++;

  // Get current agent states from different sources
  try {
    const dbAgents = await query<{
      agent_id: string;
      status: string;
      last_activity: string;
    }>(`SELECT agent_id, status, last_activity FROM agent_states`);
    // Database state source removed (was unused)

    // For now, just log the state (in production, would compare with UI state)
    if (monitoringLevel === "debug") {
      console.log(`[MonitoringLoop] Reconciliation #${reconciliationCount}:`, {
        dbAgents: dbAgents.length,
      });
    }
  } catch (err) {
    // Tables may not exist yet
    if (monitoringLevel === "debug") {
      console.log(`[MonitoringLoop] Reconciliation skipped (no data yet)`);
    }
  }
}

// Initialize Task Executor if task list provided
let taskExecutor: TaskExecutor | null = null;
if (taskListPath) {
  taskExecutor = createTaskExecutor({
    taskListPath: path.resolve(process.cwd(), taskListPath),
    autoStart,
    maxConcurrent: 1,
    retryAttempts: 2,
    dryRun,
  });

  // Wire up task executor events
  taskExecutor.on("taskList:loaded", (data) => {
    console.log(
      `[TaskExecutor] Loaded: ${data.title} (${data.pendingTasks} pending tasks)`,
    );
  });

  taskExecutor.on("task:started", (data) => {
    console.log(
      `[TaskExecutor] Starting: ${data.taskId} - ${data.description}`,
    );
    monitoringAgent.updateAgentStatus(data.agent, "working", {
      currentTask: data.taskId,
    });
  });

  taskExecutor.on("task:completed", (data) => {
    console.log(`[TaskExecutor] Completed: ${data.taskId}`);
    baselineLearner.recordMetric(VIBE_METRICS.AGENT_TASK_DURATION, 1);
  });

  taskExecutor.on("task:failed", (data) => {
    console.log(`[TaskExecutor] FAILED: ${data.taskId} - ${data.error}`);
    monitoringAgent.detectIssue(
      "error",
      "high",
      `Task ${data.taskId} failed: ${data.error}`,
      { taskId: data.taskId, error: data.error },
      "build-agent",
    );
  });

  taskExecutor.on("executor:complete", (data) => {
    console.log(
      `[TaskExecutor] All tasks complete! ${data.completed} completed, ${data.failed} failed`,
    );
  });
}

// Main monitoring loop
async function startMonitoringLoop(): Promise<void> {
  console.log("[MonitoringLoop] Starting components...");

  // Start all components
  await monitoringAgent.start();
  baselineLearner.start();

  // Register the default agents
  const defaultAgents = [
    { id: "spec-agent", type: "specification" },
    { id: "build-agent", type: "build" },
    { id: "validation-agent", type: "validation" },
    { id: "sia", type: "sia" },
    { id: "ux-agent", type: "ux" },
    { id: "monitoring-agent", type: "monitoring" },
  ];

  for (const agent of defaultAgents) {
    monitoringAgent.registerAgent(agent.id, agent.type);
  }

  // Self-register the monitoring agent as running
  monitoringAgent.updateAgentStatus("monitoring-agent", "working", {
    currentTask: "Continuous monitoring loop",
  });

  // Load and optionally start task executor
  if (taskExecutor && taskListPath) {
    try {
      await taskExecutor.loadTaskList(
        path.resolve(process.cwd(), taskListPath),
      );
      console.log("[MonitoringLoop] Task list loaded for autonomous execution");

      if (autoStart) {
        console.log("[MonitoringLoop] Auto-starting task execution...");
        taskExecutor.start();
      } else {
        console.log(
          "[MonitoringLoop] Task executor ready. Use API or --auto-start to begin.",
        );
      }
    } catch (err) {
      console.error("[MonitoringLoop] Failed to load task list:", err);
    }
  }

  // Periodic reconciliation every 2 minutes
  setInterval(performReconciliation, 120000);

  // Periodic status report every 5 minutes
  setInterval(() => {
    const metrics = monitoringAgent.getSystemMetrics();
    const issues = monitoringAgent.getDetectedIssues();
    const baselineStatus = baselineLearner.getStatus();
    const actionStatus = actionExecutor.getStatus();
    const executorStatus = taskExecutor?.getStatus();

    let executorLine =
      "║ Executor: Not configured                                     ║";
    if (executorStatus) {
      const status = executorStatus.running
        ? executorStatus.paused
          ? "Paused"
          : "Running"
        : "Stopped";
      executorLine = `║ Executor: ${status.padEnd(8)} | Done: ${String(executorStatus.completedTasks).padEnd(4)} | Failed: ${String(executorStatus.failedTasks).padEnd(4)} | Pending: ${String(executorStatus.totalTasks - executorStatus.completedTasks - executorStatus.failedTasks).padEnd(4)}║`;
    }

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      STATUS REPORT                           ║
╠══════════════════════════════════════════════════════════════╣
║ Agents:                                                      ║
║   Active: ${String(metrics.activeAgents).padEnd(4)} | Blocked: ${String(metrics.blockedAgents).padEnd(4)} | Questions: ${String(metrics.pendingQuestions).padEnd(4)}║
║                                                              ║
║ Baselines:                                                   ║
║   Metrics: ${String(baselineStatus.trackedMetrics).padEnd(4)} | Data points: ${String(baselineStatus.totalDataPoints).padEnd(6)} | Anomalies: ${String(baselineStatus.recentAnomalies).padEnd(3)}║
║                                                              ║
║ Actions:                                                     ║
║   Plans: ${String(actionStatus.totalPlans).padEnd(4)} | Pending: ${String(actionStatus.pending).padEnd(4)} | Completed: ${String(actionStatus.completed).padEnd(4)}║
║                                                              ║
${executorLine}
║                                                              ║
║ Issues: ${String(issues.length).padEnd(4)} unresolved                                      ║
╚══════════════════════════════════════════════════════════════╝
`);
  }, 300000);

  console.log("[MonitoringLoop] All components started. Press Ctrl+C to stop.");

  // Keep the process running
  process.on("SIGINT", async () => {
    console.log("\n[MonitoringLoop] Shutting down...");
    if (taskExecutor) {
      taskExecutor.stop();
    }
    await monitoringAgent.stop();
    baselineLearner.stop();
    console.log("[MonitoringLoop] Goodbye!");
    process.exit(0);
  });
}

// Run the loop
startMonitoringLoop().catch((error) => {
  console.error("[MonitoringLoop] Fatal error:", error);
  process.exit(1);
});
