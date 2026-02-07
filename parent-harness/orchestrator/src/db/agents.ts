import { query, getOne, run } from './index.js';

export interface Agent {
  id: string;
  name: string;
  type: string;
  model: string;
  telegram_channel: string | null;
  status: 'idle' | 'working' | 'error' | 'stuck' | 'stopped';
  current_task_id: string | null;
  current_session_id: string | null;
  last_heartbeat: string | null;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
  updated_at: string;
  running_instances?: number;  // Count of active sessions for this agent type
}

/**
 * Get running session counts per agent type
 */
export function getRunningInstanceCounts(): Record<string, number> {
  const rows = query<{ agent_id: string; count: number }>(`
    SELECT agent_id, COUNT(*) as count 
    FROM agent_sessions 
    WHERE status = 'running' 
    GROUP BY agent_id
  `);
  
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.agent_id] = row.count;
  }
  return counts;
}

/**
 * Get all agents with running instance counts
 */
export function getAgents(): Agent[] {
  const agents = query<Agent>('SELECT * FROM agents ORDER BY name');
  const instanceCounts = getRunningInstanceCounts();
  
  // Add running_instances to each agent
  return agents.map(agent => ({
    ...agent,
    running_instances: instanceCounts[agent.id] || 0
  }));
}

/**
 * Get a single agent by ID
 */
export function getAgent(id: string): Agent | undefined {
  return getOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
}

/**
 * Get agents by status
 */
export function getAgentsByStatus(status: Agent['status']): Agent[] {
  return query<Agent>('SELECT * FROM agents WHERE status = ?', [status]);
}

/**
 * Get idle agents
 */
export function getIdleAgents(): Agent[] {
  return getAgentsByStatus('idle');
}

/**
 * Get working agents
 */
export function getWorkingAgents(): Agent[] {
  return getAgentsByStatus('working');
}

/**
 * Update agent status
 */
export function updateAgentStatus(
  id: string, 
  status: Agent['status'],
  currentTaskId?: string | null,
  currentSessionId?: string | null
): void {
  run(`
    UPDATE agents 
    SET status = ?, 
        current_task_id = ?,
        current_session_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `, [status, currentTaskId ?? null, currentSessionId ?? null, id]);
}

/**
 * Update agent heartbeat
 */
export function updateHeartbeat(id: string): void {
  run(`
    UPDATE agents 
    SET last_heartbeat = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
}

/**
 * Clear agent heartbeat (for stale agent cleanup)
 */
export function clearHeartbeat(id: string): void {
  run(`
    UPDATE agents 
    SET last_heartbeat = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
}

/**
 * Increment tasks completed counter
 */
export function incrementTasksCompleted(id: string): void {
  run(`
    UPDATE agents 
    SET tasks_completed = tasks_completed + 1,
        updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
}

/**
 * Increment tasks failed counter
 */
export function incrementTasksFailed(id: string): void {
  run(`
    UPDATE agents 
    SET tasks_failed = tasks_failed + 1,
        updated_at = datetime('now')
    WHERE id = ?
  `, [id]);
}

export interface CreateAgentInput {
  id: string;
  name: string;
  type: string;
  description?: string;
  model?: string;
  temperature?: number;
  telegramChannel?: string;
}

/**
 * Create a new agent
 */
export function createAgent(input: CreateAgentInput): Agent {
  run(`
    INSERT INTO agents (id, name, type, model, telegram_channel, status, tasks_completed, tasks_failed)
    VALUES (?, ?, ?, ?, ?, 'idle', 0, 0)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      model = excluded.model,
      telegram_channel = excluded.telegram_channel,
      updated_at = datetime('now')
  `, [
    input.id,
    input.name,
    input.type,
    input.model ?? 'sonnet',
    input.telegramChannel ?? null,
  ]);
  
  return getAgent(input.id)!;
}

export default {
  getAgents,
  getAgent,
  getAgentsByStatus,
  getIdleAgents,
  getWorkingAgents,
  updateAgentStatus,
  updateHeartbeat,
  clearHeartbeat,
  incrementTasksCompleted,
  incrementTasksFailed,
  createAgent,
};
