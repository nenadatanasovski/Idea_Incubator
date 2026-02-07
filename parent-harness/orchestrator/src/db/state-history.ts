/**
 * Task State History - Audit trail for task state transitions
 */

import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface TaskStateHistory {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  actor_type: 'user' | 'agent' | 'system';
  reason: string | null;
  metadata: string | null;
  created_at: string;
}

export interface CreateStateHistoryInput {
  task_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by: string;
  actor_type: 'user' | 'agent' | 'system';
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a state transition
 */
export function logStateTransition(input: CreateStateHistoryInput): TaskStateHistory {
  const id = uuidv4();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  run(`
    INSERT INTO task_state_history (
      id, task_id, from_status, to_status, changed_by, actor_type, reason, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.task_id,
    input.from_status ?? null,
    input.to_status,
    input.changed_by,
    input.actor_type,
    input.reason ?? null,
    metadata,
  ]);

  return getStateHistory(id)!;
}

/**
 * Get a single state history entry by ID
 */
export function getStateHistory(id: string): TaskStateHistory | undefined {
  return getOne<TaskStateHistory>(
    'SELECT * FROM task_state_history WHERE id = ?',
    [id]
  );
}

/**
 * Get state history for a task
 */
export function getTaskStateHistory(
  taskId: string,
  options?: { limit?: number; offset?: number }
): TaskStateHistory[] {
  let sql = 'SELECT * FROM task_state_history WHERE task_id = ? ORDER BY created_at DESC';
  const params: unknown[] = [taskId];

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return query<TaskStateHistory>(sql, params);
}

/**
 * Get all state history entries
 */
export function getAllStateHistory(options?: {
  limit?: number;
  offset?: number;
  actorType?: 'user' | 'agent' | 'system';
}): TaskStateHistory[] {
  let sql = 'SELECT * FROM task_state_history WHERE 1=1';
  const params: unknown[] = [];

  if (options?.actorType) {
    sql += ' AND actor_type = ?';
    params.push(options.actorType);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return query<TaskStateHistory>(sql, params);
}

/**
 * Get the latest state change for a task
 */
export function getLatestStateChange(taskId: string): TaskStateHistory | undefined {
  return getOne<TaskStateHistory>(
    'SELECT * FROM task_state_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
    [taskId]
  );
}

/**
 * Get state changes by actor
 */
export function getStateChangesByActor(
  changedBy: string,
  options?: { limit?: number }
): TaskStateHistory[] {
  let sql = 'SELECT * FROM task_state_history WHERE changed_by = ? ORDER BY created_at DESC';
  const params: unknown[] = [changedBy];

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return query<TaskStateHistory>(sql, params);
}

/**
 * Count state transitions for a task
 */
export function countTaskTransitions(taskId: string): number {
  const result = getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM task_state_history WHERE task_id = ?',
    [taskId]
  );
  return result?.count ?? 0;
}

export default {
  logStateTransition,
  getStateHistory,
  getTaskStateHistory,
  getAllStateHistory,
  getLatestStateChange,
  getStateChangesByActor,
  countTaskTransitions,
};
