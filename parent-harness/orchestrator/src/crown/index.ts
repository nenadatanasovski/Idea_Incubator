/**
 * Crown Agent (SIA Monitoring System)
 *
 * Runs every 10 minutes to monitor agent health and intervene on issues.
 * The "Crown" oversees all agents and ensures smooth operation.
 */

import { query, run, getOne } from "../db/index.js";
import * as agents from "../db/agents.js";
import * as sessions from "../db/sessions.js";
import * as tasks from "../db/tasks.js";
import { events as dbEvents } from "../db/events.js";
import { notifyAdmin, sendToBot } from "../telegram/index.js";
import { spawnAgentSession, spawnWithPrompt } from "../spawner/index.js";

// Crown monitoring interval (10 minutes)
const CROWN_INTERVAL_MS = 10 * 60 * 1000;

// Thresholds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 min without heartbeat = stuck
const FAILURE_THRESHOLD = 3; // 3+ consecutive failures = problematic
const ERROR_RATE_THRESHOLD = 0.5; // 50%+ failure rate = concerning

interface AgentHealth {
  agentId: string;
  status: string;
  recentSessions: number;
  failedSessions: number;
  failureRate: number;
  lastHeartbeat: Date | null;
  timeSinceHeartbeat: number | null;
  currentTaskId: string | null;
  isStuck: boolean;
  consecutiveFailures: number;
}

interface CrownReport {
  timestamp: Date;
  healthChecks: AgentHealth[];
  interventions: string[];
  alerts: string[];
}

let crownInterval: NodeJS.Timeout | null = null;
let lastReport: CrownReport | null = null;
let lastReportSentAt: number = 0;
const REPORT_RATE_LIMIT_MS = 60 * 60 * 1000; // Only send 1 report per hour max

/**
 * Start the Crown monitoring system
 */
export function startCrown(): void {
  console.log("👑 Crown Agent (SIA Monitor) starting...");

  // Run initial check after 1 minute
  setTimeout(() => {
    runCrownCheck().catch((err) => console.error("Crown check error:", err));
  }, 60 * 1000);

  // Then run every 10 minutes
  crownInterval = setInterval(() => {
    runCrownCheck().catch((err) => console.error("Crown check error:", err));
  }, CROWN_INTERVAL_MS);

  console.log("👑 Crown Agent scheduled (every 10 minutes)");
}

/**
 * Stop the Crown monitoring system
 */
export function stopCrown(): void {
  if (crownInterval) {
    clearInterval(crownInterval);
    crownInterval = null;
    console.log("👑 Crown Agent stopped");
  }
}

/**
 * Run a Crown health check
 */
export async function runCrownCheck(): Promise<CrownReport> {
  console.log("👑 Crown check starting...");

  const report: CrownReport = {
    timestamp: new Date(),
    healthChecks: [],
    interventions: [],
    alerts: [],
  };

  try {
    // 1. Check agent health
    const healthChecks = await checkAgentHealth();
    report.healthChecks = healthChecks;

    // 2. Analyze and intervene
    for (const health of healthChecks) {
      // Check for stuck agents
      if (health.isStuck && health.status === "working") {
        const intervention = await handleStuckAgent(health);
        if (intervention) report.interventions.push(intervention);
      }

      // Check for high failure rate
      if (
        health.failureRate >= ERROR_RATE_THRESHOLD &&
        health.recentSessions >= 3
      ) {
        report.alerts.push(
          `⚠️ ${health.agentId} has ${Math.round(health.failureRate * 100)}% failure rate`,
        );
      }

      // Check for consecutive failures
      if (health.consecutiveFailures >= FAILURE_THRESHOLD) {
        const intervention = await handleRepeatedFailures(health);
        if (intervention) report.interventions.push(intervention);
      }
    }

    // 3. Check for orphaned tasks (in_progress but no agent working on them)
    const orphanedTasks = await checkOrphanedTasks();
    for (const task of orphanedTasks) {
      const intervention = await handleOrphanedTask(task);
      if (intervention) report.interventions.push(intervention);
    }

    // 4. Check for task queue health and loop detection
    const queueHealth = await checkTaskQueue();
    if (queueHealth.alerts.length > 0) {
      report.alerts.push(...queueHealth.alerts);
    }
    if (queueHealth.interventions.length > 0) {
      report.interventions.push(...queueHealth.interventions);
    }

    // 5. Run SIA deep analysis if issues detected
    // DISABLED: SIA spawning consumes too many tokens. Just log alerts for now.
    // Re-enabled SIA analysis for blocked task resolution
    if (report.interventions.length > 0 || report.alerts.length > 0) {
      const siaResult = await runSIAAnalysis(healthChecks);
      if (siaResult) {
        report.interventions.push(`🧠 SIA: ${siaResult}`);
      }
    }
    if (report.alerts.length > 0) {
      console.log(`👑 Crown alerts: ${report.alerts.length} issues`);
    }

    // 6. Report if there are issues
    // DISABLED: Crown reports are spamming Telegram with alerts for disabled agents
    // if (report.interventions.length > 0 || report.alerts.length > 0) {
    //   await sendCrownReport(report);
    // }

    lastReport = report;
    console.log(
      `👑 Crown check complete: ${report.interventions.length} interventions, ${report.alerts.length} alerts`,
    );
  } catch (error) {
    console.error("👑 Crown check error:", error);
    report.alerts.push(`Crown check failed: ${error}`);
  }

  return report;
}

/**
 * Check health of all agents
 */
async function checkAgentHealth(): Promise<AgentHealth[]> {
  const allAgents = agents.getAgents();
  const now = Date.now();
  const healthChecks: AgentHealth[] = [];

  for (const agent of allAgents) {
    // Skip orchestrator and sia_agent (they don't do tasks)
    if (agent.id === "orchestrator" || agent.id === "sia_agent") continue;

    // Get recent sessions (last 2 hours)
    const recentSessions = query<{ status: string }>(
      `SELECT status FROM agent_sessions 
       WHERE agent_id = ? AND started_at > datetime('now', '-2 hours')`,
      [agent.id],
    );

    const failedSessions = recentSessions.filter(
      (s) => s.status === "failed",
    ).length;
    const failureRate =
      recentSessions.length > 0 ? failedSessions / recentSessions.length : 0;

    // Get consecutive failures
    const recentResults = query<{ status: string }>(
      `SELECT status FROM agent_sessions 
       WHERE agent_id = ? ORDER BY started_at DESC LIMIT 5`,
      [agent.id],
    );

    let consecutiveFailures = 0;
    for (const r of recentResults) {
      if (r.status === "failed") consecutiveFailures++;
      else break;
    }

    // Calculate time since last heartbeat
    const lastHeartbeat = agent.last_heartbeat
      ? new Date(agent.last_heartbeat)
      : null;
    const timeSinceHeartbeat = lastHeartbeat
      ? now - lastHeartbeat.getTime()
      : null;

    // Check if agent has a recent session (started in last 5 min)
    const recentActiveSession = getOne<{ started_at: string }>(
      `SELECT started_at FROM agent_sessions 
       WHERE agent_id = ? AND status = 'running' 
       AND started_at > datetime('now', '-5 minutes')
       LIMIT 1`,
      [agent.id],
    );

    // Only mark as stuck if:
    // 1. Has been working with no heartbeat for STUCK_THRESHOLD_MS AND
    // 2. Does NOT have a recently started session (grace period for new sessions)
    const hasGracePeriod = !!recentActiveSession;
    const isStuck =
      !hasGracePeriod &&
      timeSinceHeartbeat !== null &&
      timeSinceHeartbeat > STUCK_THRESHOLD_MS;

    healthChecks.push({
      agentId: agent.id,
      status: agent.status,
      recentSessions: recentSessions.length,
      failedSessions,
      failureRate,
      lastHeartbeat,
      timeSinceHeartbeat,
      currentTaskId: agent.current_task_id,
      isStuck,
      consecutiveFailures,
    });
  }

  return healthChecks;
}

/**
 * Handle a stuck agent
 */
async function handleStuckAgent(health: AgentHealth): Promise<string | null> {
  console.log(`👑 Intervening: ${health.agentId} is stuck`);

  // Reset agent to idle
  agents.updateAgentStatus(health.agentId, "idle", null, null);

  // If there was a task, mark it as pending for retry
  if (health.currentTaskId) {
    const task = tasks.getTask(health.currentTaskId);
    if (task && task.status === "in_progress") {
      tasks.failTaskWithContext(health.currentTaskId, {
        error: "Agent became stuck (Crown intervention)",
        agentId: health.agentId,
        source: "crown_stuck_handler",
      });
      tasks.updateTask(health.currentTaskId, {
        status: "pending",
        assigned_agent_id: null,
      });
    }
  }

  const msg = `🔄 Reset stuck agent ${health.agentId} (no heartbeat for ${Math.round((health.timeSinceHeartbeat || 0) / 60000)} min)`;
  console.log(`👑 ${msg}`);
  return msg;
}

/**
 * Handle repeated failures
 */
async function handleRepeatedFailures(
  health: AgentHealth,
): Promise<string | null> {
  console.log(
    `👑 Intervening: ${health.agentId} has ${health.consecutiveFailures} consecutive failures`,
  );

  // Reset agent to idle (will pick up different task)
  if (health.status === "working" || health.status === "stuck") {
    agents.updateAgentStatus(health.agentId, "idle", null, null);
  }

  // If same task keeps failing, mark it for review
  if (health.currentTaskId) {
    const task = tasks.getTask(health.currentTaskId);
    if (task && task.retry_count && task.retry_count >= 3) {
      tasks.updateTask(health.currentTaskId, { status: "blocked" });
      // Emit retry exhaustion event for dashboard alerts
      dbEvents.retryExhausted(
        health.currentTaskId,
        task.title || task.display_id,
        task.retry_count,
      );
      return `🚫 Blocked task ${task.display_id} after ${task.retry_count} retries - needs human review`;
    }
  }

  return `⚠️ ${health.agentId} reset after ${health.consecutiveFailures} consecutive failures`;
}

/**
 * Check for orphaned tasks
 */
async function checkOrphanedTasks(): Promise<tasks.Task[]> {
  // Tasks marked as in_progress but no agent is working on them
  const inProgressTasks = tasks.getTasks({ status: "in_progress" });
  const workingAgents = agents.getWorkingAgents();
  const activeTaskIds = new Set(
    workingAgents.map((a) => a.current_task_id).filter(Boolean),
  );

  return inProgressTasks.filter((t) => !activeTaskIds.has(t.id));
}

/**
 * Handle orphaned task
 */
async function handleOrphanedTask(task: tasks.Task): Promise<string | null> {
  console.log(`👑 Found orphaned task: ${task.display_id}`);

  // Reset to pending for reassignment
  tasks.updateTask(task.id, { status: "pending" });

  return `🔄 Reset orphaned task ${task.display_id} to pending`;
}

/**
 * Check task queue health and detect loops
 */
async function checkTaskQueue(): Promise<{
  alerts: string[];
  interventions: string[];
}> {
  const alerts: string[] = [];
  const interventions: string[] = [];

  const pending = tasks.getTasks({ status: "pending" });
  const blocked = tasks.getTasks({ status: "blocked" });
  const failed = tasks.getTasks({ status: "failed" });

  // Alert if too many blocked tasks
  if (blocked.length >= 5) {
    alerts.push(
      `🚫 ${blocked.length} tasks blocked - may need human intervention`,
    );
  }

  // Alert if no progress (many pending, none in progress)
  const inProgress = tasks.getTasks({ status: "in_progress" });
  const idleAgents = agents.getIdleAgents();
  if (pending.length > 10 && inProgress.length === 0 && idleAgents.length > 0) {
    alerts.push(
      `⚠️ ${pending.length} pending tasks but no progress - check agent assignment`,
    );
  }

  // LOOP DETECTION: Find tasks with rapid re-assignment (3+ sessions in 10 min)
  const rapidReassign = query<{
    task_id: string;
    session_count: number;
    agents: string;
  }>(`
    SELECT task_id, COUNT(*) as session_count, GROUP_CONCAT(agent_id) as agents
    FROM agent_sessions 
    WHERE started_at > datetime('now', '-10 minutes')
    GROUP BY task_id
    HAVING session_count >= 3
    ORDER BY session_count DESC
  `);

  for (const loop of rapidReassign) {
    const task = tasks.getTask(loop.task_id);
    if (!task) continue;

    // Only block if task is still pending or in_progress
    if (task.status === "pending" || task.status === "in_progress") {
      // Fail once (single retry authority), then block to stop the loop.
      tasks.failTaskWithContext(loop.task_id, {
        error: `Loop detected: ${loop.session_count} sessions in 10 minutes`,
        source: "crown_loop_detector",
      });
      tasks.updateTask(loop.task_id, {
        status: "blocked",
        assigned_agent_id: null,
      });

      interventions.push(
        `🔄 LOOP DETECTED: ${task.display_id} had ${loop.session_count} sessions in 10 min - BLOCKED`,
      );
      console.log(
        `👑 Loop detected: ${task.display_id} - ${loop.session_count} sessions by ${loop.agents}`,
      );
    }
  }

  return { alerts, interventions };
}

/**
 * Run SIA deep analysis on stuck/failing patterns
 * Spawns SIA agent to analyze codebase and recommend fixes
 */
async function runSIAAnalysis(
  healthChecks: AgentHealth[],
): Promise<string | null> {
  // Only run if there are significant issues
  const stuckCount = healthChecks.filter((h) => h.isStuck).length;
  const highFailureCount = healthChecks.filter(
    (h) => h.failureRate >= ERROR_RATE_THRESHOLD,
  ).length;

  if (stuckCount === 0 && highFailureCount === 0) {
    return null;
  }

  console.log("👑 Triggering SIA deep analysis...");

  // Build analysis prompt
  const analysisPrompt = `You are SIA (Crown Agent) performing a system health analysis.

## Current Issues Detected:
${healthChecks
  .filter((h) => h.isStuck || h.failureRate >= 0.3)
  .map(
    (h) => `
- ${h.agentId}: ${h.isStuck ? "STUCK" : ""} ${h.failureRate >= 0.3 ? `${Math.round(h.failureRate * 100)}% failure rate` : ""} (${h.consecutiveFailures} consecutive failures)
`,
  )
  .join("")}

## Your Tasks:
1. Check agent_sessions table for recent failure patterns
2. Check tasks table for blocked or repeatedly failing tasks
3. Analyze if there are code issues preventing agent success
4. Check if agents are properly configured

## Codebase to analyze:
- parent-harness/orchestrator/src/ - harness code
- parent-harness/data/harness.db - database

## Actions you can take:
1. Reset stuck agents: Run SQL to set status='idle', current_task_id=NULL
2. Reset stuck tasks: Run SQL to set status='pending' 
3. Block problematic tasks: Set status='blocked' for tasks with 5+ retries
4. Report findings for human review

Analyze and fix what you can. Report what needs human intervention.
Output: TASK_COMPLETE: <summary of actions taken>`;

  try {
    console.log("👑 SIA Analysis starting...");
    console.log("👑 Issues:", {
      stuck: stuckCount,
      highFailure: highFailureCount,
      agents: healthChecks
        .filter((h) => h.isStuck || h.failureRate >= 0.3)
        .map((h) => h.agentId),
    });

    // Auto-fix: Reset any agents that are stuck
    let fixedAgents = 0;
    for (const health of healthChecks) {
      if (health.isStuck && health.status === "working") {
        agents.updateAgentStatus(health.agentId, "idle", null, null);
        run(`UPDATE agents SET last_heartbeat = datetime('now') WHERE id = ?`, [
          health.agentId,
        ]);
        console.log(
          `👑 SIA Auto-fix: Reset ${health.agentId} to idle with fresh heartbeat`,
        );
        fixedAgents++;
      }
    }

    // Find blocked tasks that need investigation
    const blockedTasks = query<{
      id: string;
      title: string;
      display_id: string;
      description: string;
      retry_count: number;
      pass_criteria: string;
    }>(`
      SELECT id, title, display_id, description, retry_count, pass_criteria 
      FROM tasks 
      WHERE status = 'blocked' 
      ORDER BY retry_count DESC 
      LIMIT 3
    `);

    // If there are blocked tasks, spawn SIA to investigate and fix the MOST blocked one
    if (blockedTasks.length > 0) {
      const targetTask = blockedTasks[0]; // Pick the most retried task

      // Get recent failure logs for this task
      const recentSessions = query<{
        agent_id: string;
        status: string;
        output: string;
      }>(
        `
        SELECT agent_id, status, output 
        FROM agent_sessions 
        WHERE task_id = ? AND status = 'failed'
        ORDER BY started_at DESC 
        LIMIT 3
      `,
        [targetTask.id],
      );

      const errorSummary = recentSessions
        .map(
          (s) =>
            `Agent ${s.agent_id}: ${s.output?.slice(0, 500) || "No output logged"}`,
        )
        .join("\n\n");

      const siaPrompt = `You are SIA, the autonomous debugging agent.

## YOUR MISSION
A task has failed ${targetTask.retry_count} times. You must investigate WHY and FIX the underlying issue.

## BLOCKED TASK
- ID: ${targetTask.display_id}
- Title: ${targetTask.title}
- Description: ${targetTask.description || "No description"}
- Pass Criteria: ${targetTask.pass_criteria || "Not specified"}
- Retry Count: ${targetTask.retry_count}

## RECENT ERRORS
${errorSummary || "No error details available"}

## YOUR APPROACH
1. Read the codebase to understand what the task was trying to do
2. Look at the error patterns - what's actually failing?
3. Is there a bug in the code preventing success?
4. Is the task specification unclear or impossible?
5. FIX the underlying issue if it's a code bug
6. If unfixable, explain EXACTLY what needs human intervention

## ACTIONS YOU CAN TAKE
- Read files to understand the codebase
- Write/Edit files to fix bugs
- Run commands to test fixes
- If you fix the issue, update the harness DB to unblock the task:
  sqlite3 /home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator/parent-harness/data/harness.db "UPDATE tasks SET status = 'pending', retry_count = 0 WHERE display_id = '${targetTask.display_id}'"

## OUTPUT
TASK_COMPLETE: Fixed <issue> by <action>
OR
TASK_COMPLETE: Cannot auto-fix because <specific reason> - requires <specific human action>

Do NOT just say "needs human intervention" - be SPECIFIC about what the issue is and what needs to be done.`;

      console.log(
        `👑 SIA investigating blocked task: ${targetTask.display_id}`,
      );

      // Spawn SIA agent to investigate (use sonnet for quality debugging)
      const result = await spawnWithPrompt(siaPrompt, {
        model: "sonnet",
        timeout: 300,
        label: "sia_debug",
      });

      if (result.success) {
        console.log(
          `👑 SIA investigation complete: ${result.output?.slice(0, 200)}`,
        );
        // Send result to Telegram
        const summary =
          result.output?.match(/TASK_COMPLETE:\s*(.+)/s)?.[1]?.slice(0, 500) ||
          "Investigation complete";
        await sendToBot(
          "sia",
          `🧠 <b>SIA Investigation: ${targetTask.display_id}</b>\n\n${summary}`,
        );
        return `SIA investigated ${targetTask.display_id}: ${summary.slice(0, 100)}`;
      } else {
        console.log(`👑 SIA investigation failed: ${result.error}`);
      }
    }

    // Also block tasks with too many retries
    const tasksToBlock = query<{
      id: string;
      title: string;
      display_id: string;
      retry_count: number;
    }>(`
      SELECT id, title, display_id, retry_count FROM tasks 
      WHERE status = 'pending' AND retry_count >= 5
    `);

    if (tasksToBlock.length > 0) {
      run(
        `UPDATE tasks SET status = 'blocked' WHERE status = 'pending' AND retry_count >= 5`,
      );
      for (const task of tasksToBlock) {
        dbEvents.retryExhausted(
          task.id,
          task.title || task.display_id,
          task.retry_count,
        );
      }
      console.log(
        `👑 SIA Auto-fix: Blocked ${tasksToBlock.length} tasks with 5+ retries`,
      );
    }

    return `SIA analyzed ${healthChecks.length} agents, fixed ${fixedAgents} stuck agents, blocked ${tasksToBlock.length} problematic tasks`;
  } catch (error) {
    console.error("👑 SIA analysis error:", error);
    return null;
  }
}

/**
 * Send Crown report to Telegram (rate limited to 1 per hour)
 */
async function sendCrownReport(report: CrownReport): Promise<void> {
  const now = Date.now();
  const timeSinceLastReport = now - lastReportSentAt;

  // Rate limit: only send 1 report per hour
  if (timeSinceLastReport < REPORT_RATE_LIMIT_MS) {
    const minutesRemaining = Math.ceil(
      (REPORT_RATE_LIMIT_MS - timeSinceLastReport) / 60000,
    );
    console.log(
      `👑 Crown report rate limited (next report in ${minutesRemaining}min)`,
    );
    return;
  }

  let message = `👑 <b>CROWN AGENT REPORT</b>\n`;
  message += `<code>${report.timestamp.toISOString()}</code>\n\n`;

  if (report.interventions.length > 0) {
    message += `<b>Interventions:</b>\n`;
    for (const i of report.interventions) {
      message += `• ${i}\n`;
    }
    message += `\n`;
  }

  if (report.alerts.length > 0) {
    message += `<b>Alerts:</b>\n`;
    for (const a of report.alerts) {
      message += `• ${a}\n`;
    }
  }

  // Send via SIA bot (Crown identity)
  await sendToBot("sia", message);
  lastReportSentAt = now;
}

/**
 * Get last Crown report
 */
export function getLastReport(): CrownReport | null {
  return lastReport;
}

/**
 * Force a Crown check (for API)
 */
export async function triggerCrownCheck(): Promise<CrownReport> {
  return runCrownCheck();
}

export default {
  startCrown,
  stopCrown,
  runCrownCheck,
  getLastReport,
  triggerCrownCheck,
};
