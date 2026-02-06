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
}

/**
 * Get all agents
 */
export function getAgents(): Agent[] {
  return query<Agent>('SELECT * FROM agents ORDER BY name');
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

export default {
  getAgents,
  getAgent,
  getAgentsByStatus,
  getIdleAgents,
  getWorkingAgents,
  updateAgentStatus,
  updateHeartbeat,
  incrementTasksCompleted,
  incrementTasksFailed,
};
