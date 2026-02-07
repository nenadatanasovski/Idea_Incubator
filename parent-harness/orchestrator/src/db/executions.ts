/**
 * Task Executions - Detailed tracking of task execution attempts
 */

import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface TaskExecution {
  id: string;
  task_id: string;
  agent_id: string;
  session_id: string | null;
  attempt_number: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  output: string | null;
  error: string | null;
  files_modified: string | null;  // JSON array
  tokens_used: number;
  validation_command: string | null;
  validation_output: string | null;
  validation_success: number | null;  // SQLite boolean
  created_at: string;
}

export interface CreateExecutionInput {
  task_id: string;
  agent_id: string;
  session_id?: string;
  attempt_number?: number;
}

export interface UpdateExecutionInput {
  status?: TaskExecution['status'];
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  output?: string;
  error?: string;
  files_modified?: string[];
  tokens_used?: number;
  validation_command?: string;
  validation_output?: string;
  validation_success?: boolean;
}

/**
 * Create a new execution record
 */
export function createExecution(input: CreateExecutionInput): TaskExecution {
  const id = uuidv4();
  
  // Get the next attempt number if not provided
  const attemptNumber = input.attempt_number ?? getNextAttemptNumber(input.task_id);

  run(`
    INSERT INTO task_executions (
      id, task_id, agent_id, session_id, attempt_number, status, started_at
    )
    VALUES (?, ?, ?, ?, ?, 'running', datetime('now'))
  `, [
    id,
    input.task_id,
    input.agent_id,
    input.session_id ?? null,
    attemptNumber,
  ]);

  return getExecution(id)!;
}

/**
 * Get the next attempt number for a task
 */
export function getNextAttemptNumber(taskId: string): number {
  const result = getOne<{ max_attempt: number | null }>(
    'SELECT MAX(attempt_number) as max_attempt FROM task_executions WHERE task_id = ?',
    [taskId]
  );
  return (result?.max_attempt ?? 0) + 1;
}

/**
 * Get a single execution by ID
 */
export function getExecution(id: string): TaskExecution | undefined {
  return getOne<TaskExecution>(
    'SELECT * FROM task_executions WHERE id = ?',
    [id]
  );
}

/**
 * Get execution by session ID
 */
export function getExecutionBySession(sessionId: string): TaskExecution | undefined {
  return getOne<TaskExecution>(
    'SELECT * FROM task_executions WHERE session_id = ?',
    [sessionId]
  );
}

/**
 * Update an execution
 */
export function updateExecution(id: string, updates: UpdateExecutionInput): TaskExecution | undefined {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
    
    if (updates.status === 'completed' || updates.status === 'failed') {
      setClauses.push("completed_at = datetime('now')");
    }
  }
  if (updates.started_at !== undefined) {
    setClauses.push('started_at = ?');
    params.push(updates.started_at);
  }
  if (updates.duration_ms !== undefined) {
    setClauses.push('duration_ms = ?');
    params.push(updates.duration_ms);
  }
  if (updates.output !== undefined) {
    setClauses.push('output = ?');
    params.push(updates.output);
  }
  if (updates.error !== undefined) {
    setClauses.push('error = ?');
    params.push(updates.error);
  }
  if (updates.files_modified !== undefined) {
    setClauses.push('files_modified = ?');
    params.push(JSON.stringify(updates.files_modified));
  }
  if (updates.tokens_used !== undefined) {
    setClauses.push('tokens_used = ?');
    params.push(updates.tokens_used);
  }
  if (updates.validation_command !== undefined) {
    setClauses.push('validation_command = ?');
    params.push(updates.validation_command);
  }
  if (updates.validation_output !== undefined) {
    setClauses.push('validation_output = ?');
    params.push(updates.validation_output);
  }
  if (updates.validation_success !== undefined) {
    setClauses.push('validation_success = ?');
    params.push(updates.validation_success ? 1 : 0);
  }

  if (setClauses.length === 0) return getExecution(id);

  params.push(id);
  run(`UPDATE task_executions SET ${setClauses.join(', ')} WHERE id = ?`, params);

  return getExecution(id);
}

/**
 * Complete an execution successfully
 */
export function completeExecution(
  id: string,
  output: string,
  filesModified?: string[],
  tokensUsed?: number
): TaskExecution | undefined {
  return updateExecution(id, {
    status: 'completed',
    output,
    files_modified: filesModified,
    tokens_used: tokensUsed,
  });
}

/**
 * Fail an execution
 */
export function failExecution(id: string, error: string): TaskExecution | undefined {
  return updateExecution(id, {
    status: 'failed',
    error,
  });
}

/**
 * Get executions for a task
 */
export function getTaskExecutions(
  taskId: string,
  options?: { limit?: number; offset?: number }
): TaskExecution[] {
  let sql = 'SELECT * FROM task_executions WHERE task_id = ? ORDER BY attempt_number DESC';
  const params: unknown[] = [taskId];

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return query<TaskExecution>(sql, params);
}

/**
 * Get executions by agent
 */
export function getAgentExecutions(
  agentId: string,
  options?: { limit?: number; status?: TaskExecution['status'] }
): TaskExecution[] {
  let sql = 'SELECT * FROM task_executions WHERE agent_id = ?';
  const params: unknown[] = [agentId];

  if (options?.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return query<TaskExecution>(sql, params);
}

/**
 * Get the latest execution for a task
 */
export function getLatestExecution(taskId: string): TaskExecution | undefined {
  return getOne<TaskExecution>(
    'SELECT * FROM task_executions WHERE task_id = ? ORDER BY attempt_number DESC LIMIT 1',
    [taskId]
  );
}

/**
 * Count execution attempts for a task
 */
export function countExecutionAttempts(taskId: string): number {
  const result = getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM task_executions WHERE task_id = ?',
    [taskId]
  );
  return result?.count ?? 0;
}

/**
 * Get running executions
 */
export function getRunningExecutions(): TaskExecution[] {
  return query<TaskExecution>(
    "SELECT * FROM task_executions WHERE status = 'running' ORDER BY started_at ASC"
  );
}

export default {
  createExecution,
  getExecution,
  getExecutionBySession,
  updateExecution,
  completeExecution,
  failExecution,
  getTaskExecutions,
  getAgentExecutions,
  getLatestExecution,
  countExecutionAttempts,
  getNextAttemptNumber,
  getRunningExecutions,
};
