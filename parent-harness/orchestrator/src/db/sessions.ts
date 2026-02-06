import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgentSession {
  id: string;
  agent_id: string;
  task_id: string | null;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'terminated';
  started_at: string;
  ended_at: string | null;
  total_iterations: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost: number;
  final_result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IterationLog {
  id: string;
  session_id: string;
  iteration_number: number;
  input_message: string | null;
  output_message: string | null;
  tool_calls: string | null;
  tool_results: string | null;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  duration_ms: number;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

/**
 * Get all sessions
 */
export function getSessions(filters?: {
  agentId?: string;
  taskId?: string;
  status?: AgentSession['status'];
  limit?: number;
  offset?: number;
}): AgentSession[] {
  let sql = 'SELECT * FROM agent_sessions WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.agentId) {
    sql += ' AND agent_id = ?';
    params.push(filters.agentId);
  }
  if (filters?.taskId) {
    sql += ' AND task_id = ?';
    params.push(filters.taskId);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return query<AgentSession>(sql, params);
}

/**
 * Get a single session by ID
 */
export function getSession(id: string): AgentSession | undefined {
  return getOne<AgentSession>('SELECT * FROM agent_sessions WHERE id = ?', [id]);
}

/**
 * Get session with iterations
 */
export function getSessionWithIterations(id: string): (AgentSession & { iterations: IterationLog[] }) | undefined {
  const session = getSession(id);
  if (!session) return undefined;

  const iterations = query<IterationLog>(
    'SELECT * FROM iteration_logs WHERE session_id = ? ORDER BY iteration_number ASC',
    [id]
  );

  return { ...session, iterations };
}

/**
 * Get iterations for a session
 */
export function getSessionIterations(sessionId: string): IterationLog[] {
  return query<IterationLog>(
    'SELECT * FROM iteration_logs WHERE session_id = ? ORDER BY iteration_number ASC',
    [sessionId]
  );
}

/**
 * Create a new session
 */
export function createSession(agentId: string, taskId?: string): AgentSession {
  const id = uuidv4();

  run(`
    INSERT INTO agent_sessions (id, agent_id, task_id, status, started_at)
    VALUES (?, ?, ?, 'starting', datetime('now'))
  `, [id, agentId, taskId ?? null]);

  return getSession(id)!;
}

/**
 * Update session status
 */
export function updateSessionStatus(
  id: string,
  status: AgentSession['status'],
  finalResult?: string,
  errorMessage?: string
): void {
  const updates: string[] = ['status = ?', 'updated_at = datetime(\'now\')'];
  const params: unknown[] = [status];

  if (status === 'completed' || status === 'failed' || status === 'terminated') {
    updates.push('ended_at = datetime(\'now\')');
  }

  if (finalResult !== undefined) {
    updates.push('final_result = ?');
    params.push(finalResult);
  }

  if (errorMessage !== undefined) {
    updates.push('error_message = ?');
    params.push(errorMessage);
  }

  params.push(id);
  run(`UPDATE agent_sessions SET ${updates.join(', ')} WHERE id = ?`, params);
}

/**
 * Log an iteration
 */
export function logIteration(
  sessionId: string,
  iterationNumber: number,
  data: {
    inputMessage?: string;
    outputMessage?: string;
    toolCalls?: object[];
    toolResults?: object[];
    tokensInput: number;
    tokensOutput: number;
    cost: number;
    durationMs: number;
    status: IterationLog['status'];
    errorMessage?: string;
  }
): IterationLog {
  const id = uuidv4();

  run(`
    INSERT INTO iteration_logs (
      id, session_id, iteration_number, input_message, output_message,
      tool_calls, tool_results, tokens_input, tokens_output, cost,
      duration_ms, status, error_message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    sessionId,
    iterationNumber,
    data.inputMessage ?? null,
    data.outputMessage ?? null,
    data.toolCalls ? JSON.stringify(data.toolCalls) : null,
    data.toolResults ? JSON.stringify(data.toolResults) : null,
    data.tokensInput,
    data.tokensOutput,
    data.cost,
    data.durationMs,
    data.status,
    data.errorMessage ?? null,
  ]);

  // Update session totals
  run(`
    UPDATE agent_sessions 
    SET total_iterations = total_iterations + 1,
        total_tokens_input = total_tokens_input + ?,
        total_tokens_output = total_tokens_output + ?,
        total_cost = total_cost + ?,
        status = 'running',
        updated_at = datetime('now')
    WHERE id = ?
  `, [data.tokensInput, data.tokensOutput, data.cost, sessionId]);

  return getOne<IterationLog>('SELECT * FROM iteration_logs WHERE id = ?', [id])!;
}

/**
 * Terminate a session
 */
export function terminateSession(id: string): void {
  updateSessionStatus(id, 'terminated');
}

export default {
  getSessions,
  getSession,
  getSessionWithIterations,
  getSessionIterations,
  createSession,
  updateSessionStatus,
  logIteration,
  terminateSession,
};
