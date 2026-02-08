import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as sessions from '../db/sessions.js';
import { events } from '../db/events.js';
import { getDb } from '../db/index.js';
import { ws } from '../websocket.js';
import * as spawner from '../spawner/index.js';
import * as planning from '../planning/index.js';
import * as qa from '../qa/index.js';
import * as selfImprovement from '../self-improvement/index.js';
import * as clarification from '../clarification/index.js';
import * as waves from '../waves/index.js';
import * as crown from '../crown/index.js';
import { notify } from '../telegram/index.js';
import { recordTick, crashProtect } from '../stability/index.js';
import { checkAlerts, initAlerts } from '../alerts/index.js';

// Configuration
const TICK_INTERVAL_MS = 30_000; // 30 seconds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const PLANNING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (was 2 hours - reduced to save tokens)
const QA_EVERY_N_TICKS = 10; // Run QA every 10th tick
const MAX_RETRIES = 5;

// Feature flags
const SPAWN_AGENTS = process.env.HARNESS_SPAWN_AGENTS === 'true'; // Set to 'true' to enable
const RUN_PLANNING = process.env.HARNESS_RUN_PLANNING === 'true'; // Set to 'true' to enable
const RUN_QA = process.env.HARNESS_RUN_QA !== 'false'; // Enabled by default

let tickCount = 0;
let planningCount = 0;
let isRunning = false;

/**
 * Check if the orchestrator tick loop is running
 */
export function isOrchestratorRunning(): boolean {
  return isRunning;
}

/**
 * Main orchestration loop
 */
export async function startOrchestrator(): Promise<void> {
  if (isRunning) {
    console.warn('⚠️ Orchestrator already running');
    return;
  }

  isRunning = true;
  console.log('🎯 Orchestrator started');
  
  // Wait for spawner to check Claude CLI availability
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const canSpawn = SPAWN_AGENTS && spawner.isEnabled();
  if (SPAWN_AGENTS && !spawner.isEnabled()) {
    console.warn('   ⚠️ HARNESS_SPAWN_AGENTS=true but Claude CLI not found!');
  }
  console.log(`   Spawn agents: ${canSpawn ? 'ENABLED ✅' : 'DISABLED'}`);
  if (!canSpawn) {
    console.log(`      Set HARNESS_SPAWN_AGENTS=true (Claude CLI must be installed)`);
  }
  console.log(`   Run planning: ${RUN_PLANNING ? 'ENABLED' : 'DISABLED (set HARNESS_RUN_PLANNING=true)'}`);

  // Initial tick
  await tick();

  // Schedule recurring ticks
  setInterval(async () => {
    if (isRunning) {
      await tick();
    }
  }, TICK_INTERVAL_MS);

  // Schedule planning analysis (every 2 hours)
  if (RUN_PLANNING) {
    // Check if there are already pending tasks - skip initial planning if so
    const existingTasks = tasks.getTasks({ status: 'pending' });
    const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
    
    if (existingTasks.length > 0 || inProgressTasks.length > 0) {
      console.log(`📊 Skipping initial planning - ${existingTasks.length} pending, ${inProgressTasks.length} in progress`);
    } else {
      console.log('📊 Running initial planning analysis...');
      runPlanning().catch(err => console.error('Initial planning error:', err));
    }
    
    // Then schedule recurring planning (only if no pending tasks)
    setInterval(async () => {
      if (isRunning) {
        const pending = tasks.getTasks({ status: 'pending' });
        const inProg = tasks.getTasks({ status: 'in_progress' });
        if (pending.length === 0 && inProg.length === 0) {
          await runPlanning();
        } else {
          console.log(`📊 Skipping scheduled planning - ${pending.length} pending, ${inProg.length} in progress`);
        }
      }
    }, PLANNING_INTERVAL_MS);
  }

  // Start Crown Agent (SIA monitoring system)
  crown.startCrown();

  // Initialize alert engine
  initAlerts();
}

/**
 * Run FULL planning pipeline:
 * 1. Strategic Planning → High-level vision & phases
 * 2. Clarification → Human approval via Telegram
 * 3. Tactical Planning → Atomic tasks with waves
 * 4. Wave Execution → Parallel execution
 */
async function runPlanning(): Promise<void> {
  planningCount++;
  console.log(`📊 Planning cycle #${planningCount} starting...`);
  
  try {
    const taskListId = 'default-task-list';
    
    // ============ PHASE 1: STRATEGIC PLANNING ============
    console.log('🧠 Phase 1: Strategic Planning...');
    const { session: stratSession, plan } = await planning.runStrategicPlanning(taskListId);
    
    if (!plan) {
      console.error('❌ Strategic planning failed - no plan generated');
      await notify.agentError('planning', 'Strategic planning failed').catch(() => {});
      return;
    }

    console.log(`✅ Strategic plan created: ${plan.phases.length} phases`);
    
    // ============ PHASE 2: CLARIFICATION (Human approval) ============
    // First check if ANY plan is already approved in DB (e.g., from manual approval or restart)
    const db = getDb();
    const approvedInDb = db.prepare(`
      SELECT id FROM plan_approvals 
      WHERE status = 'approved' 
      AND task_list_id = ? 
      AND expires_at > datetime('now')
      ORDER BY updated_at DESC LIMIT 1
    `).get(taskListId) as { id: string } | undefined;
    
    let approved = !!approvedInDb;
    let feedback: string | undefined;
    
    if (approved) {
      console.log(`✅ Plan already approved in DB (${approvedInDb?.id}) - skipping approval wait`);
    } else {
      console.log('🤝 Phase 2: Requesting human approval via Telegram...');
      await notify.planningComplete(plan.phases.length).catch(() => {});
      
      const result = await clarification.requestPlanApproval(
        stratSession.id,
        plan,
        taskListId
      );
      approved = result.approved;
      feedback = result.feedback;
    }

    if (!approved) {
      console.log(`📝 Plan not approved: ${feedback}`);
      
      if (feedback && feedback !== 'Plan rejected' && feedback !== 'Approval timed out after 30 minutes') {
        // Feedback provided - could loop back to strategic planning with feedback
        // For now, just log and exit
        console.log('💡 Feedback received. Manual re-planning required.');
        await notify.agentError('clarification', `Plan needs revision: ${feedback}`).catch(() => {});
      }
      return;
    }

    console.log('✅ Plan approved by human!');
    
    // Cache the approved plan for future restarts
    planning.cacheApprovedPlan(plan, taskListId);
    console.log('💾 Approved plan cached for future sessions');
    
    // ============ PHASE 3: TACTICAL PLANNING (Task decomposition) ============
    console.log('🔧 Phase 3: Tactical Planning - Creating atomic tasks...');
    
    // Format approved plan for tactical agent
    const approvedPlanText = `
## Vision: ${plan.visionSummary}

## Phases:
${plan.phases.map((p, i) => `
### Phase ${i + 1}: ${p.name}
- Goal: ${p.goal}
- Priority: ${p.priority}
- Deliverables: ${p.deliverables.join(', ')}
`).join('\n')}
`;

    const { tasks: atomicTasks } = await planning.runTacticalPlanning(taskListId, approvedPlanText);
    
    if (atomicTasks.length === 0) {
      console.error('❌ Tactical planning failed - no tasks generated');
      return;
    }

    const maxWave = Math.max(...atomicTasks.map(t => t.wave));
    console.log(`✅ Created ${atomicTasks.length} atomic tasks across ${maxWave} waves`);

    // ============ PHASE 4: WAVE EXECUTION ============
    console.log('🌊 Phase 4: Starting wave execution...');
    
    // Create wave run
    const waveRun = waves.planWaves(taskListId);
    waves.startWaveRun(waveRun.id);
    
    console.log(`🌊 Wave execution started: Run ID ${waveRun.id}`);
    await notify.waveStarted?.(1, atomicTasks.filter(t => t.wave === 1).length).catch(() => {});

    events.planningCompleted(planningCount, atomicTasks.length);
    console.log(`📊 Planning cycle #${planningCount} complete`);
    
  } catch (error) {
    console.error('❌ Planning error:', error);
    events.planningCompleted(planningCount, 0);
  }
}

/**
 * Run LEGACY planning (just tactical - for backward compat)
 */
async function runLegacyPlanning(): Promise<void> {
  planningCount++;
  console.log(`📊 Legacy planning cycle #${planningCount} starting...`);
  
  try {
    const taskListId = 'default-task-list';
    const session = await planning.runDailyPlanning(taskListId);
    events.planningCompleted(planningCount, session.tasks_created ? JSON.parse(session.tasks_created).length : 0);
    console.log(`📊 Planning cycle #${planningCount} complete`);
  } catch (error) {
    console.error('❌ Planning error:', error);
  }
}

/**
 * Stop the orchestrator
 */
export function stopOrchestrator(): void {
  isRunning = false;
  console.log('🛑 Orchestrator stopped');
}

/**
 * Check if orchestrator is paused via Telegram command
 */
function isOrchestratorPaused(): boolean {
  try {
    const db = getDb();
    const result = db.prepare(`SELECT value FROM system_state WHERE key = 'orchestrator_paused'`).get() as { value: string } | undefined;
    return result?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Single orchestration tick
 */
async function tick(): Promise<void> {
  tickCount++;
  const startTime = Date.now();

  // Check if paused via /stop command
  if (isOrchestratorPaused()) {
    if (tickCount % 10 === 0) {
      console.log(`⏸️ Orchestrator paused (tick #${tickCount} skipped). Use /start to resume.`);
    }
    return;
  }

  try {
    // 1. Check agent health (crash-protected)
    await crashProtect(() => checkAgentHealth(), 'checkAgentHealth');

    // 2. Run QA verification every 10th tick (crash-protected)
    if (RUN_QA && tickCount % QA_EVERY_N_TICKS === 0) {
      console.log(`🔍 QA cycle triggered (tick #${tickCount})`);
      await crashProtect(() => qa.runQACycle(), 'runQACycle');
    }

    // 3. Process failed tasks for retry (every 5th tick, crash-protected)
    if (tickCount % 5 === 0) {
      const retried = await crashProtect(
        async () => selfImprovement.processFailedTasks(),
        'processFailedTasks'
      );
      if (retried && retried > 0) {
        console.log(`🔄 Queued ${retried} tasks for retry`);
      }
    }

    // 4. Check wave completion and advance to next wave (crash-protected)
    await crashProtect(() => checkWaveProgress(), 'checkWaveProgress');

    // 5. Assign pending tasks to idle agents (crash-protected)
    await crashProtect(() => assignTasks(), 'assignTasks');

    // 6. Log tick event
    const workingAgents = agents.getWorkingAgents();
    const idleAgents = agents.getIdleAgents();

    events.cronTick(tickCount, workingAgents.length, idleAgents.length);

    const duration = Date.now() - startTime;
    console.log(`⏰ Tick #${tickCount}: ${workingAgents.length} working, ${idleAgents.length} idle (${duration}ms)`);

    // 7. Record successful tick for stability monitoring
    recordTick(tickCount);

    // 8. Check alerts (every 5th tick to avoid overhead)
    // DISABLED: Alerts were spamming Telegram
    // if (tickCount % 5 === 0) {
    //   await crashProtect(() => checkAlerts(), 'checkAlerts');
    // }

  } catch (error) {
    console.error('❌ Tick error:', error);
    events.cronTick(tickCount, 0, 0);
  }
}

/**
 * Check wave progress and advance to next wave if current is complete
 */
async function checkWaveProgress(): Promise<void> {
  const activeRuns = waves.getWaveRuns().filter(r => r.status === 'running');
  
  for (const run of activeRuns) {
    const completed = waves.checkWaveCompletion(run.id);
    if (completed) {
      const updatedRun = waves.getWaveRun(run.id);
      if (updatedRun?.status === 'completed') {
        console.log(`🏁 Wave run ${run.id} completed all waves!`);
        await notify.waveCompleted?.(updatedRun.total_waves, updatedRun.total_waves, 0).catch(() => {});
      } else if (updatedRun) {
        console.log(`🌊 Advanced to wave ${updatedRun.current_wave + 1}`);
        const nextWaveTasks = tasks.getTasks({}).filter(t => t.wave_number === updatedRun.current_wave + 1);
        await notify.waveStarted?.(updatedRun.current_wave + 1, nextWaveTasks.length).catch(() => {});
      }
    }
  }
}

/**
 * Check agent health and mark stuck agents
 */
/**
 * Check agent health and recover from stuck/stale states
 * 
 * First Principles:
 * 1. Stale = Dead: If heartbeat is stale, the agent process is dead
 * 2. Clean up Dead: Dead agents should be reset to idle
 * 3. Recover Tasks: Tasks from dead agents should be re-queued
 * 4. Don't Spam: Only log the error once, not every tick
 * 5. Grace Period: Give agents a chance before declaring them dead
 */
async function checkAgentHealth(): Promise<void> {
  const allAgents = agents.getAgents();
  const now = Date.now();

  for (const agent of allAgents) {
    // Skip orchestrator and sia - they don't have heartbeats
    if (['orchestrator', 'sia'].includes(agent.type)) continue;

    const lastHeartbeat = agent.last_heartbeat 
      ? new Date(agent.last_heartbeat).getTime() 
      : 0;
    const timeSinceHeartbeat = now - lastHeartbeat;

    // Case 1: Working agent with stale heartbeat → mark stuck
    if (agent.status === 'working' && timeSinceHeartbeat > STUCK_THRESHOLD_MS) {
      console.warn(`⚠️ Agent ${agent.id} appears stuck (${Math.floor(timeSinceHeartbeat / 60000)}min since heartbeat)`);
      
      // Mark agent as stuck (but don't log event - we'll handle cleanup below)
      agents.updateAgentStatus(agent.id, 'stuck', agent.current_task_id, agent.current_session_id);
      ws.agentStatusChanged(agents.getAgent(agent.id));
    }

    // Case 2: Stuck agent → clean up and reset
    if (agent.status === 'stuck') {
      // Only log once when transitioning to cleanup
      const stuckForMinutes = Math.floor(timeSinceHeartbeat / 60000);
      
      // If stuck for more than 30 minutes, assume dead and clean up
      if (timeSinceHeartbeat > 30 * 60 * 1000) {
        console.log(`🧹 Cleaning up dead agent ${agent.id} (stuck for ${stuckForMinutes}min)`);
        
        // Reset the agent's task to pending
        if (agent.current_task_id) {
          const task = tasks.getTask(agent.current_task_id);
          if (task && task.status === 'in_progress') {
            console.log(`   ↩️ Re-queuing task ${task.display_id}`);
            tasks.updateTask(agent.current_task_id, { status: 'pending', assigned_agent_id: undefined });
          }
        }

        // Close any open session
        if (agent.current_session_id) {
          sessions.updateSessionStatus(agent.current_session_id, 'terminated', undefined, 'Agent stuck - cleaned up');
        }

        // Reset agent to idle with cleared heartbeat
        agents.updateAgentStatus(agent.id, 'idle', null, null);
        agents.clearHeartbeat(agent.id);
        ws.agentStatusChanged(agents.getAgent(agent.id));

        // Log event only once during cleanup
        events.agentError(agent.id, `Agent cleaned up after being stuck for ${stuckForMinutes} minutes`);
        events.systemRecovery?.('orchestrator', `Recovered agent ${agent.id} from stuck state`);
      }
    }

    // Case 3: Idle agent with ancient heartbeat → just clear it (no spam)
    if (agent.status === 'idle' && lastHeartbeat > 0 && timeSinceHeartbeat > 60 * 60 * 1000) {
      // Clear stale heartbeat silently - this agent just hasn't been used in a while
      agents.clearHeartbeat(agent.id);
    }
  }
}

// Track recent task failures for cooldown (task_id -> last_failed_at timestamp)
const recentFailures = new Map<string, number>();
const MIN_RETRY_COOLDOWN_MS = 60_000; // 60 seconds minimum between retries
const MAX_RETRY_COOLDOWN_MS = 10 * 60_000; // 10 minutes max cooldown
const COOLDOWN_MULTIPLIER = 2; // Double cooldown each retry

/**
 * Calculate retry cooldown for a task based on retry count
 */
function getRetryCooldown(retryCount: number): number {
  const baseCooldown = MIN_RETRY_COOLDOWN_MS * Math.pow(COOLDOWN_MULTIPLIER, retryCount);
  return Math.min(baseCooldown, MAX_RETRY_COOLDOWN_MS);
}

/**
 * Check if a task is in cooldown period
 */
function isTaskInCooldown(taskId: string, retryCount: number): boolean {
  const lastFailed = recentFailures.get(taskId);
  if (!lastFailed) return false;
  
  const cooldown = getRetryCooldown(retryCount);
  const elapsed = Date.now() - lastFailed;
  
  if (elapsed < cooldown) {
    // Still in cooldown
    return true;
  }
  
  // Cooldown expired, clean up
  recentFailures.delete(taskId);
  return false;
}

/**
 * Record a task failure for cooldown tracking
 */
export function recordTaskFailure(taskId: string): void {
  recentFailures.set(taskId, Date.now());
}

/**
 * Assign pending tasks to idle agents
 * 
 * First Principles:
 * 1. Single Assignment: One task, one agent at a time
 * 2. Cooldown: Failed tasks must wait before retry
 * 3. Priority: P0 > P1 > P2, etc.
 */
async function assignTasks(): Promise<void> {
  // Get pending tasks (with no unmet dependencies)
  let pendingTasks = tasks.getPendingTasks();
  if (pendingTasks.length === 0) return;

  // RATE LIMIT PROTECTION: Skip test tasks - they consume real tokens!
  // Test tasks are created during API testing and shouldn't be executed
  pendingTasks = pendingTasks.filter(t => {
    const isTest = t.category === 'test' || 
                   t.display_id?.startsWith('test_') || 
                   t.display_id?.startsWith('concurrent_');
    if (isTest) {
      console.log(`⏭️ Skipping test task: ${t.display_id}`);
    }
    return !isTest;
  });
  if (pendingTasks.length === 0) return;

  // Get idle agents that can work
  const idleAgents = agents.getIdleAgents();
  if (idleAgents.length === 0) return;

  // Sort tasks by priority
  const sortedTasks = pendingTasks.sort((a, b) => {
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Assign tasks to agents
  for (const task of sortedTasks) {
    // Check cooldown for previously failed tasks
    if (task.retry_count && task.retry_count > 0) {
      if (isTaskInCooldown(task.id, task.retry_count)) {
        // Skip this task - still in cooldown
        continue;
      }
    }

    // Find suitable agent (prefer build_agent for features, qa_agent for tests, etc.)
    const agent = findSuitableAgent(task, idleAgents);
    if (!agent) continue;

    // Assign task
    await assignTaskToAgent(task, agent);

    // Remove agent from available pool
    const agentIndex = idleAgents.findIndex(a => a.id === agent.id);
    if (agentIndex !== -1) {
      idleAgents.splice(agentIndex, 1);
    }

    // Stop if no more idle agents
    if (idleAgents.length === 0) break;
  }
}

/**
 * Find a suitable agent for a task
 * 
 * RATE LIMIT OPTIMIZATION: Only use essential agents (build, qa, spec)
 * Disabled agents that consume tokens without producing value:
 * - planning, validation, research, decomposition, clarification, human_sim, evaluator, task
 */
function findSuitableAgent(task: tasks.Task, availableAgents: agents.Agent[]): agents.Agent | null {
  // ESSENTIAL AGENTS ONLY - disabled wasteful agents to save tokens
  const ALLOWED_AGENT_TYPES = ['build_agent', 'build', 'qa_agent', 'qa', 'spec_agent', 'spec'];
  
  // Debug: log available agent types
  if (availableAgents.length > 0 && availableAgents.length < 5) {
    console.log(`🔍 Available agents: ${availableAgents.map(a => `${a.id}(${a.type})`).join(', ')}`);
  }
  
  // Filter to only allowed agents
  const allowedAgents = availableAgents.filter(a => ALLOWED_AGENT_TYPES.includes(a.type));
  if (allowedAgents.length === 0) {
    if (availableAgents.length > 0) {
      console.log(`⏭️ No allowed agents for ${task.display_id} - available types: ${availableAgents.map(a => a.type).join(', ')}`);
    }
    return null;
  }
  
  // Map task categories to preferred agent types (only essential ones)
  const categoryAgentMap: Record<string, string[]> = {
    feature: ['build_agent', 'build'],
    bug: ['build_agent', 'build'],
    test: ['qa_agent', 'qa'],
    documentation: ['spec_agent', 'spec'],
    // All other categories default to build_agent
  };

  const preferredTypes = categoryAgentMap[task.category ?? 'feature'] || ['build_agent', 'build'];

  // Try to find preferred agent from allowed list
  for (const type of preferredTypes) {
    const agent = allowedAgents.find(a => a.type === type);
    if (agent) return agent;
  }

  // Fall back to build_agent (the workhorse)
  const buildAgent = allowedAgents.find(a => a.type === 'build_agent' || a.type === 'build');
  return buildAgent ?? allowedAgents[0] ?? null;
}

/**
 * Assign a task to an agent
 */
async function assignTaskToAgent(task: tasks.Task, agent: agents.Agent): Promise<void> {
  // Log event
  events.taskAssigned(task.id, agent.id, task.title);

  if (SPAWN_AGENTS) {
    // Actually spawn the agent process
    console.log(`🚀 Spawning ${agent.name} for ${task.display_id}...`);
    
    // Spawn in background (don't await - let it run)
    // NOTE: Don't pass model - let spawner select based on agent type (rate limit optimization)
    spawner.spawnAgentSession({
      taskId: task.id,
      agentId: agent.id,
    }).then(result => {
      if (result.success) {
        console.log(`✅ ${agent.name} completed ${task.display_id}`);
      } else {
        console.log(`❌ ${agent.name} failed ${task.display_id}: ${result.error}`);
      }
    }).catch(err => {
      console.error(`❌ Spawn error for ${agent.name}:`, err);
    });

    // Broadcast task assigned (session created by spawner)
    ws.taskAssigned(tasks.getTask(task.id), agent.id);
  } else {
    // Simulation mode: just update DB records
    const session = sessions.createSession(agent.id, task.id);
    tasks.assignTask(task.id, agent.id);
    agents.updateAgentStatus(agent.id, 'working', task.id, session.id);

    ws.taskAssigned(tasks.getTask(task.id), agent.id);
    ws.agentStatusChanged(agents.getAgent(agent.id));
    ws.sessionStarted(session);
  }

  console.log(`📋 Assigned ${task.display_id} to ${agent.name}`);
}

/**
 * Complete a task (called by agent API)
 */
export async function completeTask(taskId: string, agentId: string, result?: string): Promise<void> {
  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);
  if (!task || !agent) return;

  // Update task
  tasks.completeTask(taskId);

  // Update agent
  agents.updateAgentStatus(agentId, 'idle', null, null);
  agents.incrementTasksCompleted(agentId);

  // Update session
  if (agent.current_session_id) {
    sessions.updateSessionStatus(agent.current_session_id, 'completed', result);
  }

  // Log event
  events.taskCompleted(taskId, agentId, task.title);

  // Broadcast
  ws.taskCompleted(tasks.getTask(taskId));
  ws.agentStatusChanged(agents.getAgent(agentId));

  console.log(`✅ Completed ${task.display_id}`);
}

/**
 * Fail a task (called by agent API or after max retries)
 */
export async function failTask(taskId: string, agentId: string, error: string): Promise<void> {
  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);
  if (!task || !agent) return;

  // Record failure for cooldown tracking
  recordTaskFailure(taskId);

  // Update task
  tasks.failTask(taskId);

  // Update agent
  agents.updateAgentStatus(agentId, 'idle', null, null);
  agents.incrementTasksFailed(agentId);

  // Update session
  if (agent.current_session_id) {
    sessions.updateSessionStatus(agent.current_session_id, 'failed', undefined, error);
  }

  // Log event
  events.taskFailed(taskId, agentId, task.title, error);

  // Broadcast
  ws.taskFailed(tasks.getTask(taskId), error);
  ws.agentStatusChanged(agents.getAgent(agentId));

  // Log with cooldown info
  const cooldown = getRetryCooldown(task.retry_count || 0);
  console.log(`❌ Failed ${task.display_id}: ${error} (cooldown: ${cooldown / 1000}s)`);
}

/**
 * Manual tick trigger (for cron jobs)
 */
export async function manualTick(): Promise<{
  workingCount: number;
  idleCount: number;
  pendingTasks: number;
  assignedTasks: number;
}> {
  const startTime = Date.now();
  
  // Run the tick logic
  await tick();
  
  // Return status
  const workingAgents = agents.getWorkingAgents();
  const idleAgents = agents.getIdleAgents();
  const pendingTasksList = tasks.getPendingTasks();
  
  return {
    workingCount: workingAgents.length,
    idleCount: idleAgents.length,
    pendingTasks: pendingTasksList.length,
    assignedTasks: 0, // Would need to track this in tick()
  };
}

export default {
  startOrchestrator,
  stopOrchestrator,
  completeTask,
  failTask,
  manualTick,
};
