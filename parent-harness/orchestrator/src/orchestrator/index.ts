import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as sessions from '../db/sessions.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';

// Configuration
const TICK_INTERVAL_MS = 30_000; // 30 seconds
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RETRIES = 5;

let tickCount = 0;
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

  // Initial tick
  await tick();

  // Schedule recurring ticks
  setInterval(async () => {
    if (isRunning) {
      await tick();
    }
  }, TICK_INTERVAL_MS);
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

    // 2. Assign pending tasks to idle agents
    await assignTasks();

    // 3. Log tick event
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
  // Create session for the task
  const session = sessions.createSession(agent.id, task.id);

  // Update task status
  tasks.assignTask(task.id, agent.id);

  // Update agent status
  agents.updateAgentStatus(agent.id, 'working', task.id, session.id);

  // Log event
  events.taskAssigned(task.id, agent.id, task.title);

  // Broadcast via WebSocket
  ws.taskAssigned(tasks.getTask(task.id), agent.id);
  ws.agentStatusChanged(agents.getAgent(agent.id));
  ws.sessionStarted(session);

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
