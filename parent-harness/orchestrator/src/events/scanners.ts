/**
 * Scanners - Lightweight periodic checks that emit events
 * 
 * Instead of one big tick loop that does everything,
 * we have individual scanners that:
 * 1. Run on their own schedule
 * 2. Are lightweight (just check conditions)
 * 3. Emit events when they find something
 * 
 * Services react to these events - scanners don't do heavy work.
 * 
 * This is Phase 6 of the event-driven architecture.
 */

import { bus } from './bus.js';
import * as tasks from '../db/tasks.js';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as config from '../config/index.js';
import * as spawner from '../spawner/index.js';
import { isRunnableProductionTask } from '../orchestrator/task-gating.js';

interface ScannerConfig {
  enabled: boolean;
  intervalMs: number;
  lastRun: Date | null;
}

// ============ PENDING TASK SCANNER ============

class PendingTaskScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 10000, // Check every 10 seconds (was 5s)
    lastRun: null,
  };
  private emittedTasks = new Set<string>();
  private lastEmitTime = new Map<string, number>();

  start(): void {
    if (this.interval) return;
    console.log('🔍 Pending Task Scanner: Starting');
    
    this.scan();
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    this.config.lastRun = new Date();

    // Find pending tasks that aren't being processed
    const pendingTasks = tasks.getPendingTasks().filter(isRunnableProductionTask);
    const idleAgents = agents.getIdleAgents();

    // Only emit if we have both work and workers
    if (pendingTasks.length > 0 && idleAgents.length > 0) {
      const now = Date.now();
      
      // Emit event for each pending task, with debounce (30s between emissions for same task)
      for (const task of pendingTasks.slice(0, 5)) { // Max 5 at a time
        const lastEmit = this.lastEmitTime.get(task.id) || 0;
        if (now - lastEmit > 30000) { // 30 second debounce
          this.lastEmitTime.set(task.id, now);
          bus.emit('task:pending', { task });
        }
      }
      
      // Clean up old entries (tasks no longer pending)
      const pendingIds = new Set(pendingTasks.map(t => t.id));
      for (const [taskId] of this.lastEmitTime) {
        if (!pendingIds.has(taskId)) {
          this.lastEmitTime.delete(taskId);
        }
      }
    }
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ STUCK AGENT SCANNER ============

class StuckAgentScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 60000, // Check every minute
    lastRun: null,
  };
  private stuckThresholdMs = 15 * 60 * 1000; // 15 minutes

  start(): void {
    if (this.interval) return;
    console.log('🔍 Stuck Agent Scanner: Starting');
    
    this.scan();
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    this.config.lastRun = new Date();

    const workingAgents = agents.getWorkingAgents();
    const now = Date.now();

    for (const agent of workingAgents) {
      if (!agent.last_heartbeat) continue;

      const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > this.stuckThresholdMs) {
        console.log(`🔍 Stuck Agent Scanner: ${agent.name} is stuck (${Math.round(timeSinceHeartbeat / 60000)}min)`);
        bus.emit('agent:stuck', { 
          agent, 
          reason: `No heartbeat for ${Math.round(timeSinceHeartbeat / 60000)} minutes` 
        });
      }
    }
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ PLANNING SCANNER ============

class PlanningScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 60 * 60 * 1000, // Check every hour
    lastRun: null,
  };
  private lastPlanningRun: Date | null = null;

  start(): void {
    if (this.interval) return;
    console.log('🔍 Planning Scanner: Starting');
    
    this.scan();
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    this.config.lastRun = new Date();

    const cfg = config.getConfig();
    if (!cfg.planning.enabled) return;

    const intervalMs = cfg.planning.interval_hours * 60 * 60 * 1000;
    const now = Date.now();

    if (!this.lastPlanningRun) {
      this.lastPlanningRun = new Date();
      return; // Skip on first run
    }

    if (now - this.lastPlanningRun.getTime() >= intervalMs) {
      console.log('🔍 Planning Scanner: Planning cycle due');
      bus.emit('schedule:planning_due', {});
      this.lastPlanningRun = new Date();
    }
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  recordPlanningRun(): void {
    this.lastPlanningRun = new Date();
  }
}

// ============ CLEANUP SCANNER ============

class CleanupScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 24 * 60 * 60 * 1000, // Check daily
    lastRun: null,
  };

  start(): void {
    if (this.interval) return;
    console.log('🔍 Cleanup Scanner: Starting');
    
    // Run cleanup on startup
    setTimeout(() => this.scan(), 30000);
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    this.config.lastRun = new Date();

    const cfg = config.getConfig();
    if (!cfg.cleanup.auto_cleanup) return;

    console.log('🔍 Cleanup Scanner: Cleanup due');
    bus.emit('schedule:cleanup_due', {});
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ QA VERIFICATION SCANNER ============

class QAVerificationScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // Every 5 minutes (like legacy QA_EVERY_N_TICKS * 30s)
    lastRun: null,
  };
  private processing = false;

  start(): void {
    if (this.interval) return;
    console.log('🔍 QA Verification Scanner: Starting');
    
    // First scan after 2 minutes
    setTimeout(() => this.scan(), 2 * 60 * 1000);
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    if (this.processing) {
      console.log('🔍 QA Scanner: Already processing, skipping');
      return;
    }
    this.config.lastRun = new Date();

    // Find tasks in pending_verification status
    const pendingVerification = tasks.getTasks({ status: 'pending_verification' });
    
    if (pendingVerification.length === 0) {
      return; // Nothing to verify
    }

    console.log(`🔍 QA Scanner: Found ${pendingVerification.length} tasks to verify`);
    
    // Emit events for QA service to pick up
    for (const task of pendingVerification.slice(0, 3)) { // Max 3 at a time
      bus.emit('task:ready_for_qa', { task });
    }
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ SELF-IMPROVEMENT SCANNER (SIA Investigation) ============

class SelfImprovementScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 10 * 60 * 1000, // Every 10 minutes - give time for investigation
    lastRun: null,
  };
  private investigating = false;

  start(): void {
    if (this.interval) return;
    console.log('🔍 Self-Improvement Scanner (SIA): Starting');
    
    // First investigation after 3 minutes
    setTimeout(() => this.scan(), 3 * 60 * 1000);
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async scan(): Promise<void> {
    if (!this.config.enabled) return;
    if (this.investigating) {
      console.log('🧠 SIA: Already investigating, skipping');
      return;
    }
    this.config.lastRun = new Date();

    // Find the most important failed task to investigate
    const failedTasks = tasks.getTasks({ status: 'failed' });
    const worthInvestigating = failedTasks
      .filter(t => (t.retry_count || 0) >= 2 && (t.retry_count || 0) < 5) // Failed 2-4 times
      .filter(t => !(t.category === 'test' && !t.description)) // Skip empty test fixture tasks
      .sort((a, b) => {
        // Prioritize by priority then retry count
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
        const aPri = priorityOrder[a.priority] ?? 2;
        const bPri = priorityOrder[b.priority] ?? 2;
        if (aPri !== bPri) return aPri - bPri;
        return (b.retry_count || 0) - (a.retry_count || 0);
      });
    
    if (worthInvestigating.length === 0) {
      // No tasks worth investigating - maybe try one that failed once
      const singleFailures = failedTasks
        .filter(t => (t.retry_count || 0) === 1)
        .filter(t => !(t.category === 'test' && !t.description));
      if (singleFailures.length > 0) {
        await this.investigateTask(singleFailures[0]);
      }
      return;
    }

    // Investigate the top priority failed task
    await this.investigateTask(worthInvestigating[0]);
  }

  private async investigateTask(task: ReturnType<typeof tasks.getTask>): Promise<void> {
    if (!task) return;
    
    this.investigating = true;
    console.log(`🧠 SIA: Investigating failed task ${task.display_id}: ${task.title}`);

    // Get SIA agent
    const siaAgent = agents.getAgent('sia_agent');
    if (!siaAgent) {
      console.log('🧠 SIA: No SIA agent found, using build_agent');
    }

    // Build investigation prompt
    const investigationPrompt = this.buildInvestigationPrompt(task);

    try {
      // Update SIA agent status
      const agentId = siaAgent?.id || 'build_agent';
      agents.updateHeartbeat(agentId);
      agents.updateAgentStatus(agentId, 'working', task.id, null);

      // Spawn investigation session
      console.log(`🧠 SIA: Spawning investigation for ${task.display_id}`);
      
      const result = await spawner.spawnAgentSession({
        taskId: task.id,
        agentId: agentId,
        model: 'opus', // Use Opus for investigation
        timeout: 600, // 10 minute timeout
        customPrompt: investigationPrompt,
      });

      if (result.success) {
        console.log(`🧠 SIA: Investigation complete for ${task.display_id}`);
        // Task status will be updated by the spawner based on output
      } else {
        console.log(`🧠 SIA: Investigation failed - ${result.error}`);
        // Reset task to pending for another attempt
        tasks.updateTask(task.id, { status: 'pending', assigned_agent_id: null });
      }
    } catch (err) {
      console.error('🧠 SIA: Investigation error:', err);
    } finally {
      this.investigating = false;
      // Reset agent to idle
      const agentId = siaAgent?.id || 'build_agent';
      agents.updateAgentStatus(agentId, 'idle', null, null);
    }
  }

  private buildInvestigationPrompt(task: ReturnType<typeof tasks.getTask>): string {
    if (!task) return '';
    
    return `You are SIA (Strategic Improvement Agent) investigating a repeatedly failing task.

## FAILED TASK
- ID: ${task.display_id}
- Title: ${task.title}
- Description: ${task.description || 'No description'}
- Retry Count: ${task.retry_count || 0}
- Category: ${task.category || 'unknown'}

## YOUR MISSION
1. INVESTIGATE: Read the relevant source files to understand what this task requires
2. ANALYZE: Look at the actual code, find the root cause of failures
3. FIX: Implement the fix yourself - don't just describe it, DO IT
4. VERIFY: Run \`npx tsc --noEmit\` to verify your changes compile

## CODEBASE
Root: /home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator

## APPROACH
- Read files first to understand the current state
- Look for TypeScript errors, missing implementations, incorrect types
- Make surgical fixes - don't rewrite everything
- Test your changes compile before declaring complete

## OUTPUT
When done, output one of:
- TASK_COMPLETE: <what you fixed and how>
- TASK_FAILED: <why it can't be fixed, what needs human intervention>

Be thorough but focused. Fix the actual issue, not symptoms.`;
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ STATE RECONCILIATION SCANNER ============

class StateReconciliationScanner {
  private interval: NodeJS.Timeout | null = null;
  private config: ScannerConfig = {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // Every 5 minutes
    lastRun: null,
  };
  private sessionMismatchCounts = new Map<string, number>();

  start(): void {
    if (this.interval) return;
    console.log('🔍 State Reconciliation Scanner: Starting');
    
    // First scan after 1 minute
    setTimeout(() => this.scan(), 60000);
    this.interval = setInterval(() => this.scan(), this.config.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scan(): void {
    if (!this.config.enabled) return;
    this.config.lastRun = new Date();

    let fixes = 0;

    // Fix 1: Agents marked "working" with stale heartbeats (>20 min) but no task
    const workingAgents = agents.getWorkingAgents();
    const now = Date.now();
    
    for (const agent of workingAgents) {
      const lastHb = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : 0;
      const staleMs = now - lastHb;
      
      // If heartbeat is stale (>20 min) and no current task, reset to idle
      if (staleMs > 20 * 60 * 1000) {
        if (!agent.current_task_id) {
          console.log(`🔄 Reconciliation: Reset ${agent.name} (stale heartbeat, no task)`);
          agents.updateAgentStatus(agent.id, 'idle', null, null);
          agents.updateHeartbeat(agent.id);
          fixes++;
        }
      }
    }

    // Fix 2: Tasks "in_progress" but assigned agent is idle
    const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
    
    for (const task of inProgressTasks) {
      if (!task.assigned_agent_id) {
        // No agent assigned - reset to pending
        console.log(`🔄 Reconciliation: Reset ${task.display_id} (in_progress but no agent)`);
        tasks.updateTask(task.id, { status: 'pending', assigned_agent_id: null });
        fixes++;
        continue;
      }
      
      const agent = agents.getAgent(task.assigned_agent_id);
      if (!agent || agent.status === 'idle') {
        // Agent is idle but task thinks it's being worked on
        console.log(`🔄 Reconciliation: Reset ${task.display_id} (agent ${agent?.name || 'unknown'} is idle)`);
        tasks.updateTask(task.id, { status: 'pending', assigned_agent_id: null });
        fixes++;
      }
    }

    // Fix 3: Agent working on a task that doesn't exist or isn't in_progress
    for (const agent of workingAgents) {
      if (agent.current_task_id) {
        const task = tasks.getTask(agent.current_task_id);
        if (!task || task.status !== 'in_progress') {
          console.log(`🔄 Reconciliation: Reset ${agent.name} (task ${agent.current_task_id} not in_progress)`);
          agents.updateAgentStatus(agent.id, 'idle', null, null);
          agents.updateHeartbeat(agent.id);
          fixes++;
        }
      }
    }

    // Fix 4: Close orphan running sessions after repeated mismatch checks.
    const runningSessions = sessions.getRunningSessions();
    const runningSessionIds = new Set(runningSessions.map(s => s.id));
    for (const [sessionId] of this.sessionMismatchCounts) {
      if (!runningSessionIds.has(sessionId)) {
        this.sessionMismatchCounts.delete(sessionId);
      }
    }

    for (const session of runningSessions) {
      const task = session.task_id ? tasks.getTask(session.task_id) : null;
      const agent = agents.getAgent(session.agent_id);
      const taskAligned = !!task && task.status === 'in_progress';
      const agentAligned =
        !!agent &&
        agent.status === 'working' &&
        agent.current_session_id === session.id &&
        agent.current_task_id === session.task_id;

      if (taskAligned && agentAligned) {
        this.sessionMismatchCounts.delete(session.id);
        continue;
      }

      const nextCount = (this.sessionMismatchCounts.get(session.id) || 0) + 1;
      this.sessionMismatchCounts.set(session.id, nextCount);
      if (nextCount < 2) {
        continue;
      }

      sessions.updateSessionStatus(
        session.id,
        'terminated',
        undefined,
        `State reconciliation closed orphan running session (taskAligned=${taskAligned}, agentAligned=${agentAligned})`
      );
      this.sessionMismatchCounts.delete(session.id);
      fixes++;
    }

    if (fixes > 0) {
      console.log(`🔄 State Reconciliation: Fixed ${fixes} inconsistencies`);
      bus.emit('system:error', { 
        source: 'state_reconciliation', 
        error: new Error(`Fixed ${fixes} state inconsistencies`) 
      });
    }
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============ EXPORTS ============

export const pendingTaskScanner = new PendingTaskScanner();
export const stuckAgentScanner = new StuckAgentScanner();
export const planningScanner = new PlanningScanner();
export const cleanupScanner = new CleanupScanner();
export const qaVerificationScanner = new QAVerificationScanner();
export const selfImprovementScanner = new SelfImprovementScanner();
export const stateReconciliationScanner = new StateReconciliationScanner();

/**
 * Start all scanners
 */
export function startAllScanners(): void {
  pendingTaskScanner.start();
  stuckAgentScanner.start();
  planningScanner.start();
  cleanupScanner.start();
  qaVerificationScanner.start();
  selfImprovementScanner.start();
  stateReconciliationScanner.start();
  console.log('🔍 All scanners started');
}

/**
 * Stop all scanners
 */
export function stopAllScanners(): void {
  pendingTaskScanner.stop();
  stuckAgentScanner.stop();
  planningScanner.stop();
  cleanupScanner.stop();
  qaVerificationScanner.stop();
  selfImprovementScanner.stop();
  stateReconciliationScanner.stop();
  console.log('🔍 All scanners stopped');
}

/**
 * Get scanner status
 */
export function getScannerStatus(): Record<string, ScannerConfig> {
  return {
    pendingTask: pendingTaskScanner.getConfig(),
    stuckAgent: stuckAgentScanner.getConfig(),
    planning: planningScanner.getConfig(),
    cleanup: cleanupScanner.getConfig(),
    qaVerification: qaVerificationScanner.getConfig(),
    selfImprovement: selfImprovementScanner.getConfig(),
    stateReconciliation: stateReconciliationScanner.getConfig(),
  };
}

export default {
  pendingTaskScanner,
  stuckAgentScanner,
  planningScanner,
  cleanupScanner,
  stateReconciliationScanner,
  startAllScanners,
  stopAllScanners,
  getScannerStatus,
};
