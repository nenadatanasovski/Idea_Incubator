/**
 * Clarification Agent
 * 
 * Handles tasks that need clarification before proceeding.
 * Sends questions to humans and waits for responses.
 */

import { query, run, getOne } from '../db/index.js';
import * as tasks from '../db/tasks.js';
import { notifyAdmin } from '../telegram/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface ClarificationRequest {
  id: string;
  task_id: string;
  question: string;
  context: string | null;
  options: string | null; // JSON array of suggested options
  status: 'pending' | 'answered' | 'expired' | 'skipped';
  answer: string | null;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
  expires_at: string | null;
}

// Ensure clarification table exists
function ensureClarificationTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS clarification_requests (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      question TEXT NOT NULL,
      context TEXT,
      options TEXT,
      status TEXT DEFAULT 'pending',
      answer TEXT,
      answered_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT,
      expires_at TEXT
    )
  `, []);

  run(`CREATE INDEX IF NOT EXISTS idx_clarification_task ON clarification_requests(task_id)`, []);
  run(`CREATE INDEX IF NOT EXISTS idx_clarification_status ON clarification_requests(status)`, []);
}

ensureClarificationTable();

/**
 * Request clarification for a task
 */
export async function requestClarification(
  taskId: string,
  question: string,
  options?: {
    context?: string;
    suggestedOptions?: string[];
    expiresInHours?: number;
  }
): Promise<ClarificationRequest> {
  const id = uuidv4();
  const expiresAt = options?.expiresInHours
    ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  run(`
    INSERT INTO clarification_requests (id, task_id, question, context, options, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    taskId,
    question,
    options?.context ?? null,
    options?.suggestedOptions ? JSON.stringify(options.suggestedOptions) : null,
    expiresAt,
  ]);

  // Block the task until clarification is received
  tasks.updateTask(taskId, { status: 'blocked' });

  // Notify via Telegram
  const task = tasks.getTask(taskId);
  if (task) {
    await notifyAdmin(
      `❓ <b>Clarification Needed</b>\n\n` +
      `Task: <code>${task.display_id}</code>\n` +
      `Question: ${question}` +
      (options?.suggestedOptions 
        ? `\n\nOptions:\n${options.suggestedOptions.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
        : '')
    );
  }

  console.log(`❓ Clarification requested for ${task?.display_id}: ${question}`);

  return getClarificationRequest(id)!;
}

/**
 * Answer a clarification request
 */
export async function answerClarification(
  requestId: string,
  answer: string,
  answeredBy?: string
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== 'pending') {
    return undefined;
  }

  run(`
    UPDATE clarification_requests 
    SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
    WHERE id = ?
  `, [answer, answeredBy ?? 'human', requestId]);

  // Unblock the task
  tasks.updateTask(request.task_id, { status: 'pending' });

  console.log(`✅ Clarification answered for request ${requestId}: ${answer}`);

  return getClarificationRequest(requestId);
}

/**
 * Skip a clarification (use default or best guess)
 */
export async function skipClarification(
  requestId: string,
  reason?: string
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== 'pending') {
    return undefined;
  }

  run(`
    UPDATE clarification_requests 
    SET status = 'skipped', answer = ?, answered_at = datetime('now')
    WHERE id = ?
  `, [reason ?? 'Skipped - using default', requestId]);

  // Unblock the task
  tasks.updateTask(request.task_id, { status: 'pending' });

  return getClarificationRequest(requestId);
}

/**
 * Get a clarification request
 */
export function getClarificationRequest(id: string): ClarificationRequest | undefined {
  return getOne<ClarificationRequest>(
    'SELECT * FROM clarification_requests WHERE id = ?',
    [id]
  );
}

/**
 * Get pending clarifications
 */
export function getPendingClarifications(): ClarificationRequest[] {
  return query<ClarificationRequest>(
    "SELECT * FROM clarification_requests WHERE status = 'pending' ORDER BY created_at ASC"
  );
}

/**
 * Get clarifications for a task
 */
export function getTaskClarifications(taskId: string): ClarificationRequest[] {
  return query<ClarificationRequest>(
    'SELECT * FROM clarification_requests WHERE task_id = ? ORDER BY created_at DESC',
    [taskId]
  );
}

/**
 * Expire old clarifications
 */
export function expireOldClarifications(): number {
  const result = run(`
    UPDATE clarification_requests 
    SET status = 'expired'
    WHERE status = 'pending' 
      AND expires_at IS NOT NULL 
      AND expires_at < datetime('now')
  `);

  if (result.changes > 0) {
    console.log(`⏰ Expired ${result.changes} clarification requests`);
  }

  return result.changes;
}

/**
 * Check if task has pending clarification
 */
export function hasPendingClarification(taskId: string): boolean {
  const pending = getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM clarification_requests WHERE task_id = ? AND status = 'pending'",
    [taskId]
  );
  return (pending?.count ?? 0) > 0;
}

export default {
  requestClarification,
  answerClarification,
  skipClarification,
  getClarificationRequest,
  getPendingClarifications,
  getTaskClarifications,
  expireOldClarifications,
  hasPendingClarification,
};
