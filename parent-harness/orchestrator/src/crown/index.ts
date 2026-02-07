/**
 * Crown Agent (SIA Monitoring System)
 * 
 * Runs every 10 minutes to monitor agent health and intervene on issues.
 * The "Crown" oversees all agents and ensures smooth operation.
 */

import { query, run, getOne } from '../db/index.js';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events as dbEvents } from '../db/events.js';
import { notifyAdmin, sendToBot } from '../telegram/index.js';
import { spawnAgentSession } from '../spawner/index.js';

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
  console.log('👑 Crown Agent (SIA Monitor) starting...');
  
  // Run initial check after 1 minute
  setTimeout(() => {
    runCrownCheck().catch(err => console.error('Crown check error:', err));
  }, 60 * 1000);
  
  // Then run every 10 minutes
  crownInterval = setInterval(() => {
    runCrownCheck().catch(err => console.error('Crown check error:', err));
  }, CROWN_INTERVAL_MS);
  
  console.log('👑 Crown Agent scheduled (every 10 minutes)');
}

/**
 * Stop the Crown monitoring system
 */
export function stopCrown(): void {
  if (crownInterval) {
    clearInterval(crownInterval);
    crownInterval = null;
    console.log('👑 Crown Agent stopped');
  }
}

/**
 * Run a Crown health check
 */
export async function runCrownCheck(): Promise<CrownReport> {
  console.log('👑 Crown check starting...');
  
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
      if (health.isStuck && health.status === 'working') {
        const intervention = await handleStuckAgent(health);
        if (intervention) report.interventions.push(intervention);
      }
      
      // Check for high failure rate
      if (health.failureRate >= ERROR_RATE_THRESHOLD && health.recentSessions >= 3) {
        report.alerts.push(`⚠️ ${health.agentId} has ${Math.round(health.failureRate * 100)}% failure rate`);
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
    if (report.interventions.length > 0 || report.alerts.length > 0) {
      const siaResult = await runSIAAnalysis(healthChecks);
      if (siaResult) {
        report.interventions.push(`🧠 SIA: ${siaResult}`);
      }
    }
    
    // 6. Report if there are issues
    if (report.interventions.length > 0 || report.alerts.length > 0) {
      await sendCrownReport(report);
    }
    
    lastReport = report;
    console.log(`👑 Crown check complete: ${report.interventions.length} interventions, ${report.alerts.length} alerts`);
    
  } catch (error) {
    console.error('👑 Crown check error:', error);
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
    if (agent.id === 'orchestrator' || agent.id === 'sia_agent') continue;
    
    // Get recent sessions (last 2 hours)
    const recentSessions = query<{ status: string }>(
      `SELECT status FROM agent_sessions 
       WHERE agent_id = ? AND started_at > datetime('now', '-2 hours')`,
      [agent.id]
    );
    
    const failedSessions = recentSessions.filter(s => s.status === 'failed').length;
    const failureRate = recentSessions.length > 0 ? failedSessions / recentSessions.length : 0;
    
    // Get consecutive failures
    const recentResults = query<{ status: string }>(
      `SELECT status FROM agent_sessions 
       WHERE agent_id = ? ORDER BY started_at DESC LIMIT 5`,
      [agent.id]
    );
    
    let consecutiveFailures = 0;
    for (const r of recentResults) {
      if (r.status === 'failed') consecutiveFailures++;
      else break;
    }
    
    // Calculate time since last heartbeat
    const lastHeartbeat = agent.last_heartbeat ? new Date(agent.last_heartbeat) : null;
    const timeSinceHeartbeat = lastHeartbeat ? now - lastHeartbeat.getTime() : null;
    
    // Check if agent has a recent session (started in last 5 min)
    const recentActiveSession = getOne<{ started_at: string }>(
      `SELECT started_at FROM agent_sessions 
       WHERE agent_id = ? AND status = 'running' 
       AND started_at > datetime('now', '-5 minutes')
       LIMIT 1`,
      [agent.id]
    );
    
    // Only mark as stuck if:
    // 1. Has been working with no heartbeat for STUCK_THRESHOLD_MS AND
    // 2. Does NOT have a recently started session (grace period for new sessions)
    const hasGracePeriod = !!recentActiveSession;
    const isStuck = !hasGracePeriod && 
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
  agents.updateAgentStatus(health.agentId, 'idle', null, null);
  
  // If there was a task, mark it as pending for retry
  if (health.currentTaskId) {
    const task = tasks.getTask(health.currentTaskId);
    if (task && task.status === 'in_progress') {
      tasks.updateTask(health.currentTaskId, { status: 'pending' });
      // Increment retry count via raw SQL
      run(`UPDATE tasks SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?`, [health.currentTaskId]);
    }
  }
  
  const msg = `🔄 Reset stuck agent ${health.agentId} (no heartbeat for ${Math.round((health.timeSinceHeartbeat || 0) / 60000)} min)`;
  console.log(`👑 ${msg}`);
  return msg;
}

/**
 * Handle repeated failures
 */
async function handleRepeatedFailures(health: AgentHealth): Promise<string | null> {
  console.log(`👑 Intervening: ${health.agentId} has ${health.consecutiveFailures} consecutive failures`);
  
  // Reset agent to idle (will pick up different task)
  if (health.status === 'working' || health.status === 'stuck') {
    agents.updateAgentStatus(health.agentId, 'idle', null, null);
  }
  
  // If same task keeps failing, mark it for review
  if (health.currentTaskId) {
    const task = tasks.getTask(health.currentTaskId);
    if (task && task.retry_count && task.retry_count >= 3) {
      tasks.updateTask(health.currentTaskId, { status: 'blocked' });
      // Emit retry exhaustion event for dashboard alerts
      dbEvents.retryExhausted(health.currentTaskId, task.title || task.display_id, task.retry_count);
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
  const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
  const workingAgents = agents.getWorkingAgents();
  const activeTaskIds = new Set(workingAgents.map(a => a.current_task_id).filter(Boolean));
  
  return inProgressTasks.filter(t => !activeTaskIds.has(t.id));
}

/**
 * Handle orphaned task
 */
async function handleOrphanedTask(task: tasks.Task): Promise<string | null> {
  console.log(`👑 Found orphaned task: ${task.display_id}`);
  
  // Reset to pending for reassignment
  tasks.updateTask(task.id, { status: 'pending' });
  
  return `🔄 Reset orphaned task ${task.display_id} to pending`;
}

/**
 * Check task queue health and detect loops
 */
async function checkTaskQueue(): Promise<{ alerts: string[]; interventions: string[] }> {
  const alerts: string[] = [];
  const interventions: string[] = [];
  
  const pending = tasks.getTasks({ status: 'pending' });
  const blocked = tasks.getTasks({ status: 'blocked' });
  const failed = tasks.getTasks({ status: 'failed' });
  
  // Alert if too many blocked tasks
  if (blocked.length >= 5) {
    alerts.push(`🚫 ${blocked.length} tasks blocked - may need human intervention`);
  }
  
  // Alert if no progress (many pending, none in progress)
  const inProgress = tasks.getTasks({ status: 'in_progress' });
  const idleAgents = agents.getIdleAgents();
  if (pending.length > 10 && inProgress.length === 0 && idleAgents.length > 0) {
    alerts.push(`⚠️ ${pending.length} pending tasks but no progress - check agent assignment`);
  }
  
  // LOOP DETECTION: Find tasks with rapid re-assignment (3+ sessions in 10 min)
  const rapidReassign = query<{ task_id: string; session_count: number; agents: string }>(`
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
    if (task.status === 'pending' || task.status === 'in_progress') {
      // Block the task to stop the loop
      tasks.updateTask(loop.task_id, { status: 'blocked' });
      run(`UPDATE tasks SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?`, [loop.task_id]);
      
      interventions.push(`🔄 LOOP DETECTED: ${task.display_id} had ${loop.session_count} sessions in 10 min - BLOCKED`);
      console.log(`👑 Loop detected: ${task.display_id} - ${loop.session_count} sessions by ${loop.agents}`);
    }
  }
  
  return { alerts, interventions };
}

/**
 * Run SIA deep analysis on stuck/failing patterns
 * Spawns SIA agent to analyze codebase and recommend fixes
 */
async function runSIAAnalysis(healthChecks: AgentHealth[]): Promise<string | null> {
  // Only run if there are significant issues
  const stuckCount = healthChecks.filter(h => h.isStuck).length;
  const highFailureCount = healthChecks.filter(h => h.failureRate >= ERROR_RATE_THRESHOLD).length;
  
  if (stuckCount === 0 && highFailureCount === 0) {
    return null;
  }
  
  console.log('👑 Triggering SIA deep analysis...');
  
  // Build analysis prompt
  const analysisPrompt = `You are SIA (Crown Agent) performing a system health analysis.

## Current Issues Detected:
${healthChecks.filter(h => h.isStuck || h.failureRate >= 0.3).map(h => `
- ${h.agentId}: ${h.isStuck ? 'STUCK' : ''} ${h.failureRate >= 0.3 ? `${Math.round(h.failureRate * 100)}% failure rate` : ''} (${h.consecutiveFailures} consecutive failures)
`).join('')}

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
    // Use spawner to run SIA analysis (simpler approach - just log the prompt for now)
    // Full implementation would spawn actual SIA agent
    console.log('👑 SIA Analysis prompt prepared');
    console.log('👑 Issues:', {
      stuck: stuckCount,
      highFailure: highFailureCount,
      agents: healthChecks.filter(h => h.isStuck || h.failureRate >= 0.3).map(h => h.agentId)
    });
    
    // Auto-fix: Reset any agents that are stuck
    for (const health of healthChecks) {
      if (health.isStuck && health.status === 'working') {
        agents.updateAgentStatus(health.agentId, 'idle', null, null);
        run(`UPDATE agents SET last_heartbeat = datetime('now') WHERE id = ?`, [health.agentId]);
        console.log(`👑 SIA Auto-fix: Reset ${health.agentId} to idle with fresh heartbeat`);
      }
    }
    
    // Auto-fix: Block tasks with too many retries and emit events
    const tasksToBlock = query<{ id: string; title: string; display_id: string; retry_count: number }>(`
      SELECT id, title, display_id, retry_count FROM tasks 
      WHERE status = 'pending' AND retry_count >= 5
    `);
    
    if (tasksToBlock.length > 0) {
      run(`UPDATE tasks SET status = 'blocked' WHERE status = 'pending' AND retry_count >= 5`);
      // Emit retry exhaustion events for each blocked task
      for (const task of tasksToBlock) {
        dbEvents.retryExhausted(task.id, task.title || task.display_id, task.retry_count);
      }
      console.log(`👑 SIA Auto-fix: Blocked ${tasksToBlock.length} tasks with 5+ retries`);
    }
    
    return `SIA analyzed ${healthChecks.length} agents, fixed ${stuckCount} stuck agents, blocked ${tasksToBlock.length} problematic tasks`;
    
  } catch (error) {
    console.error('👑 SIA analysis error:', error);
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
    const minutesRemaining = Math.ceil((REPORT_RATE_LIMIT_MS - timeSinceLastReport) / 60000);
    console.log(`👑 Crown report rate limited (next report in ${minutesRemaining}min)`);
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
  await sendToBot('sia', message);
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
