import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgentSession {
  id: string;
  agent_id: string;
  task_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'terminated';
  started_at: string;
  completed_at: string | null;
  total_iterations: number;
  current_iteration: number;
  metadata: string | null;
  output: string | null;
  error_message: string | null;
}

export interface IterationLog {
  id: string;
  session_id: string;
  iteration_number: number;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'qa_pending' | 'qa_passed' | 'qa_failed';
  tasks_attempted: number;
  tasks_completed: number;
  tasks_failed: number;
}

interface SessionMetadata {
  output?: string;
  errorMessage?: string;
  terminal?: {
    status: AgentSession['status'];
    completedAt: string;
    output?: string;
    errorMessage?: string;
  };
  [key: string]: unknown;
}

function parseSessionMetadata(metadata: string | null): SessionMetadata {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === 'object' && parsed ? parsed as SessionMetadata : {};
  } catch {
    return {};
  }
}

function hydrateSession(row: AgentSession): AgentSession {
  const parsed = parseSessionMetadata(row.metadata);
  const terminal = parsed.terminal;
  return {
    ...row,
    output: row.output ?? terminal?.output ?? parsed.output ?? null,
    error_message: row.error_message ?? terminal?.errorMessage ?? parsed.errorMessage ?? null,
  };
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

  sql += ' ORDER BY started_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return query<AgentSession>(sql, params).map(hydrateSession);
}

/**
 * Get a single session by ID
 */
export function getSession(id: string): AgentSession | undefined {
  const session = getOne<AgentSession>('SELECT * FROM agent_sessions WHERE id = ?', [id]);
  return session ? hydrateSession(session) : undefined;
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
    INSERT INTO agent_sessions (id, agent_id, task_id, status)
    VALUES (?, ?, ?, 'running')
  `, [id, agentId, taskId ?? null]);

  return getSession(id)!;
}

/**
 * Update session status
 */
export function updateSessionStatus(
  id: string,
  status: AgentSession['status'],
  output?: string,
  errorMessage?: string
): void {
  if (status === 'completed' || status === 'failed' || status === 'terminated') {
    const existing = getSession(id);
    const existingMetadata = parseSessionMetadata(existing?.metadata || null);
    const completedAtIso = new Date().toISOString();
    const mergedMetadata: SessionMetadata = {
      ...existingMetadata,
      output: output ?? existingMetadata.output,
      errorMessage: errorMessage ?? existingMetadata.errorMessage,
      terminal: {
        status,
        completedAt: completedAtIso,
        output: output ?? existingMetadata.terminal?.output ?? existingMetadata.output,
        errorMessage:
          errorMessage ??
          existingMetadata.terminal?.errorMessage ??
          existingMetadata.errorMessage,
      },
    };
    run(
      `UPDATE agent_sessions SET status = ?, completed_at = datetime('now'), metadata = ? WHERE id = ?`,
      [status, JSON.stringify(mergedMetadata), id]
    );
  } else {
    run(`UPDATE agent_sessions SET status = ? WHERE id = ?`, [status, id]);
  }
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
    status: 'running' | 'completed' | 'failed';
    errorMessage?: string;
  }
): IterationLog {
  const id = uuidv4();

  // Map status to schema-compatible value
  const schemaStatus = data.status === 'running' ? 'running' : 
                       data.status === 'completed' ? 'completed' : 'failed';

  run(`
    INSERT INTO iteration_logs (id, session_id, iteration_number, status)
    VALUES (?, ?, ?, ?)
  `, [id, sessionId, iterationNumber, schemaStatus]);

  // Update session iteration count
  run(`
    UPDATE agent_sessions 
    SET total_iterations = total_iterations + 1,
        current_iteration = ?
    WHERE id = ?
  `, [iterationNumber, sessionId]);

  return getOne<IterationLog>('SELECT * FROM iteration_logs WHERE id = ?', [id])!;
}

/**
 * Terminate a session
 */
export function terminateSession(id: string): void {
  updateSessionStatus(id, 'terminated');
}

/**
 * Get sessions by task ID (most recent first)
 */
export function getSessionsByTask(taskId: string): AgentSession[] {
  return query<AgentSession>(
    'SELECT * FROM agent_sessions WHERE task_id = ? ORDER BY started_at DESC',
    [taskId]
  ).map(hydrateSession);
}

/**
 * Get running sessions
 */
export function getRunningSessions(): AgentSession[] {
  return query<AgentSession>(
    `SELECT * FROM agent_sessions
     WHERE status = 'running'
     ORDER BY started_at ASC`
  ).map(hydrateSession);
}

export default {
  getSessions,
  getSession,
  getSessionWithIterations,
  getSessionIterations,
  getSessionsByTask,
  getRunningSessions,
  createSession,
  updateSessionStatus,
  logIteration,
  terminateSession,
};
