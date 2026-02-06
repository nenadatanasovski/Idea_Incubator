import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface ObservabilityEvent {
  id: string;
  type: string;
  message: string;
  agent_id: string | null;
  session_id: string | null;
  task_id: string | null;
  severity: 'debug' | 'info' | 'warning' | 'error';
  metadata: string | null;
  created_at: string;
}

export interface CreateEventInput {
  type: string;
  message: string;
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  severity?: ObservabilityEvent['severity'];
  metadata?: object;
}

/**
 * Get events with filters
 */
export function getEvents(filters?: {
  type?: string;
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  severity?: ObservabilityEvent['severity'];
  since?: string;
  limit?: number;
  offset?: number;
}): ObservabilityEvent[] {
  let sql = 'SELECT * FROM observability_events WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters?.agentId) {
    sql += ' AND agent_id = ?';
    params.push(filters.agentId);
  }
  if (filters?.sessionId) {
    sql += ' AND session_id = ?';
    params.push(filters.sessionId);
  }
  if (filters?.taskId) {
    sql += ' AND task_id = ?';
    params.push(filters.taskId);
  }
  if (filters?.severity) {
    sql += ' AND severity = ?';
    params.push(filters.severity);
  }
  if (filters?.since) {
    sql += ' AND created_at >= ?';
    params.push(filters.since);
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

  return query<ObservabilityEvent>(sql, params);
}

/**
 * Get a single event by ID
 */
export function getEvent(id: string): ObservabilityEvent | undefined {
  return getOne<ObservabilityEvent>('SELECT * FROM observability_events WHERE id = ?', [id]);
}

/**
 * Create a new event
 */
export function createEvent(input: CreateEventInput): ObservabilityEvent {
  const id = uuidv4();

  run(`
    INSERT INTO observability_events (
      id, type, message, agent_id, session_id, task_id, severity, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.type,
    input.message,
    input.agentId ?? null,
    input.sessionId ?? null,
    input.taskId ?? null,
    input.severity ?? 'info',
    input.metadata ? JSON.stringify(input.metadata) : null,
  ]);

  return getEvent(id)!;
}

/**
 * Create common event types
 */
export const events = {
  taskAssigned: (taskId: string, agentId: string, taskTitle: string) =>
    createEvent({
      type: 'task:assigned',
      message: `Task assigned to ${agentId}: ${taskTitle}`,
      taskId,
      agentId,
    }),

  taskCompleted: (taskId: string, agentId: string, taskTitle: string) =>
    createEvent({
      type: 'task:completed',
      message: `Task completed: ${taskTitle}`,
      taskId,
      agentId,
      severity: 'info',
    }),

  taskFailed: (taskId: string, agentId: string, taskTitle: string, error: string) =>
    createEvent({
      type: 'task:failed',
      message: `Task failed: ${taskTitle} - ${error}`,
      taskId,
      agentId,
      severity: 'error',
    }),

  agentStarted: (agentId: string, sessionId: string) =>
    createEvent({
      type: 'agent:started',
      message: `Agent ${agentId} started session`,
      agentId,
      sessionId,
    }),

  agentIdle: (agentId: string) =>
    createEvent({
      type: 'agent:idle',
      message: `Agent ${agentId} is now idle`,
      agentId,
    }),

  agentError: (agentId: string, error: string) =>
    createEvent({
      type: 'agent:error',
      message: `Agent ${agentId} error: ${error}`,
      agentId,
      severity: 'error',
    }),

  toolStarted: (agentId: string, sessionId: string, toolName: string, args: string) =>
    createEvent({
      type: 'tool:started',
      message: `${toolName} → ${args}`,
      agentId,
      sessionId,
      severity: 'debug',
    }),

  toolCompleted: (agentId: string, sessionId: string, toolName: string, result: string) =>
    createEvent({
      type: 'tool:completed',
      message: `${toolName} completed: ${result}`,
      agentId,
      sessionId,
      severity: 'debug',
    }),

  qaStarted: (taskId: string, agentId: string) =>
    createEvent({
      type: 'qa:started',
      message: `QA validation started`,
      taskId,
      agentId,
    }),

  qaPassed: (taskId: string, agentId: string) =>
    createEvent({
      type: 'qa:passed',
      message: `QA validation passed`,
      taskId,
      agentId,
    }),

  qaFailed: (taskId: string, agentId: string, reason: string) =>
    createEvent({
      type: 'qa:failed',
      message: `QA validation failed: ${reason}`,
      taskId,
      agentId,
      severity: 'warning',
    }),

  cronTick: (tickNumber: number, workingCount: number, idleCount: number) =>
    createEvent({
      type: 'cron:tick',
      message: `Tick #${tickNumber}: ${workingCount} agents working, ${idleCount} idle`,
      severity: 'debug',
    }),
};

export default {
  getEvents,
  getEvent,
  createEvent,
  events,
};
