import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as sessions from '../db/sessions.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import * as spawner from '../spawner/index.js';
import * as planning from '../planning/index.js';
import * as qa from '../qa/index.js';

// Configuration
const TICK_INTERVAL_MS = 30_000; // 30 seconds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const PLANNING_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
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
 * Main orchestration loop
 */
export async function startOrchestrator(): Promise<void> {
  if (isRunning) {
    console.warn('⚠️ Orchestrator already running');
    return;
  }

  isRunning = true;
  console.log('🎯 Orchestrator started');
  console.log(`   Spawn agents: ${SPAWN_AGENTS ? 'ENABLED' : 'DISABLED (set HARNESS_SPAWN_AGENTS=true)'}`);
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
    setInterval(async () => {
      if (isRunning) {
        await runPlanning();
      }
    }, PLANNING_INTERVAL_MS);
    
    // Run initial planning after 1 minute
    setTimeout(async () => {
      if (isRunning) {
        await runPlanning();
      }
    }, 60_000);
  }
}

/**
 * Run planning analysis
 */
async function runPlanning(): Promise<void> {
  planningCount++;
  console.log(`📊 Planning cycle #${planningCount} starting...`);
  
  try {
    // Get or create default task list
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
 * Single orchestration tick
 */
async function tick(): Promise<void> {
  tickCount++;
  const startTime = Date.now();

  try {
    // 1. Check agent health
    await checkAgentHealth();

    // 2. Run QA verification every 10th tick
    if (RUN_QA && tickCount % QA_EVERY_N_TICKS === 0) {
      console.log(`🔍 QA cycle triggered (tick #${tickCount})`);
      await qa.runQACycle();
    }

    // 3. Assign pending tasks to idle agents
    await assignTasks();

    // 4. Log tick event
    const workingAgents = agents.getWorkingAgents();
    const idleAgents = agents.getIdleAgents();

    events.cronTick(tickCount, workingAgents.length, idleAgents.length);

    const duration = Date.now() - startTime;
    console.log(`⏰ Tick #${tickCount}: ${workingAgents.length} working, ${idleAgents.length} idle (${duration}ms)`);

  } catch (error) {
    console.error('❌ Tick error:', error);
    events.cronTick(tickCount, 0, 0);
  }
}

/**
 * Check agent health and mark stuck agents
 */
async function checkAgentHealth(): Promise<void> {
  const allAgents = agents.getAgents();
  const now = Date.now();

  for (const agent of allAgents) {
    if (agent.status === 'working' && agent.last_heartbeat) {
      const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > STUCK_THRESHOLD_MS) {
        console.warn(`⚠️ Agent ${agent.id} appears stuck (${Math.floor(timeSinceHeartbeat / 1000)}s since heartbeat)`);
        
        // Mark agent as stuck
        agents.updateAgentStatus(agent.id, 'stuck', agent.current_task_id, agent.current_session_id);
        ws.agentStatusChanged(agents.getAgent(agent.id));

        // Log event
        events.agentError(agent.id, `Agent stuck - no heartbeat for ${Math.floor(timeSinceHeartbeat / 60000)} minutes`);
      }
    }
  }
}

/**
 * Assign pending tasks to idle agents
 */
async function assignTasks(): Promise<void> {
  // Get pending tasks (with no unmet dependencies)
  const pendingTasks = tasks.getPendingTasks();
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
 */
function findSuitableAgent(task: tasks.Task, availableAgents: agents.Agent[]): agents.Agent | null {
  // Map task categories to preferred agent types
  const categoryAgentMap: Record<string, string[]> = {
    feature: ['build_agent'],
    bug: ['build_agent'],
    test: ['qa_agent', 'validation_agent'],
    documentation: ['spec_agent'],
    research: ['research_agent'],
    planning: ['planning_agent'],
    decomposition: ['decomposition_agent', 'task_agent'],
  };

  const preferredTypes = categoryAgentMap[task.category ?? 'feature'] || ['build_agent'];

  // Try to find preferred agent
  for (const type of preferredTypes) {
    const agent = availableAgents.find(a => a.type === type);
    if (agent) return agent;
  }

  // Fall back to any available agent (except orchestrator, sia)
  const fallbackAgent = availableAgents.find(
    a => !['orchestrator', 'sia'].includes(a.type)
  );

  return fallbackAgent ?? null;
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
    spawner.spawnAgentSession({
      taskId: task.id,
      agentId: agent.id,
      model: agent.model || 'opus',
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

  console.log(`❌ Failed ${task.display_id}: ${error}`);
}

export default {
  startOrchestrator,
  stopOrchestrator,
  completeTask,
  failTask,
};
