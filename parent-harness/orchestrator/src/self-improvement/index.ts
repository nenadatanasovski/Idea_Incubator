/**
 * Self-Improvement & Retry System
 * 
 * Implements self-healing loop:
 * - When task fails, analyze error
 * - Create fix approach
 * - Retry up to MAX_RETRIES times
 * - Learn from successes/failures
 */

import * as tasks from '../db/tasks.js';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { run, query, getOne } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const MAX_RETRIES = 5;

export interface RetryAttempt {
  id: string;
  taskId: string;
  attemptNumber: number;
  agentId: string;
  sessionId: string;
  error: string;
  analysisPrompt?: string;
  fixApproach?: string;
  result: 'pending' | 'success' | 'failure';
  createdAt: string;
  completedAt?: string;
}

/**
 * Ensure retry tracking table exists
 */
function ensureRetryTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS task_retry_attempts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      error TEXT,
      source TEXT,
      analysis_prompt TEXT,
      fix_approach TEXT,
      result TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `, []);
}

ensureRetryTable();

/**
 * Get retry count for a task
 */
export function getRetryCount(taskId: string): number {
  const result = getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM task_retry_attempts WHERE task_id = ?',
    [taskId]
  );
  return result?.count || 0;
}

/**
 * Get retry history for a task
 */
export function getRetryHistory(taskId: string): RetryAttempt[] {
  return query<RetryAttempt>(
    'SELECT * FROM task_retry_attempts WHERE task_id = ? ORDER BY attempt_number',
    [taskId]
  );
}

/**
 * Record a retry attempt
 */
export function recordRetryAttempt(
  taskId: string,
  agentId: string,
  sessionId: string | null,
  error: string,
  fixApproach?: string
): RetryAttempt {
  const id = uuidv4();
  const attemptNumber = getRetryCount(taskId) + 1;

  run(`
    INSERT INTO task_retry_attempts (id, task_id, attempt_number, agent_id, session_id, error, fix_approach)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, taskId, attemptNumber, agentId, sessionId, error, fixApproach || null]);

  return {
    id,
    taskId,
    attemptNumber,
    agentId,
    sessionId: sessionId || '',
    error,
    fixApproach,
    result: 'pending',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update retry attempt result
 */
export function updateRetryResult(attemptId: string, result: 'success' | 'failure'): void {
  run(`
    UPDATE task_retry_attempts 
    SET result = ?, completed_at = datetime('now')
    WHERE id = ?
  `, [result, attemptId]);
}

/**
 * Analyze failure and generate fix approach
 */
export function analyzeFailure(error: string, previousAttempts: RetryAttempt[]): string {
  // Build context from previous attempts
  const previousTries = previousAttempts
    .map(a => `Attempt ${a.attemptNumber}: ${a.fixApproach || 'No approach'} → ${a.result}`)
    .join('\n');

  // Generate fix approach based on error patterns
  const errorLower = error.toLowerCase();

  if (errorLower.includes('typescript') || errorLower.includes('ts2')) {
    return 'Focus on fixing TypeScript type errors. Check imports, ensure proper type annotations.';
  }

  if (errorLower.includes('test') || errorLower.includes('expect')) {
    return 'Tests are failing. Review test assertions, check for missing mocks or setup.';
  }

  if (errorLower.includes('build') || errorLower.includes('compile')) {
    return 'Build is failing. Check for syntax errors, missing dependencies, or configuration issues.';
  }

  if (errorLower.includes('timeout')) {
    return 'Operation timed out. Simplify the approach or break into smaller steps.';
  }

  if (errorLower.includes('not found') || errorLower.includes('enoent')) {
    return 'File or directory not found. Verify paths are correct and files exist.';
  }

  if (previousAttempts.length > 0) {
    return `Previous approaches failed:\n${previousTries}\n\nTry a different strategy.`;
  }

  return 'Analyze the error carefully and try a different approach.';
}

/**
 * Check if task should be retried
 */
export function shouldRetry(taskId: string): boolean {
  // Use task's own retry_count field, not task_retry_attempts table
  const task = tasks.getTask(taskId);
  const retryCount = task?.retry_count || 0;
  return retryCount < MAX_RETRIES;
}

/**
 * Prepare task for retry
 */
export function prepareForRetry(taskId: string, error: string): { shouldRetry: boolean; fixApproach?: string } {
  // Use task's own retry_count field, not task_retry_attempts table
  const task = tasks.getTask(taskId);
  const retryCount = task?.retry_count || 0;

  if (retryCount >= MAX_RETRIES) {
    console.log(`❌ Task ${taskId} exceeded max retries (${MAX_RETRIES})`);
    return { shouldRetry: false };
  }

  const previousAttempts = getRetryHistory(taskId);
  const fixApproach = analyzeFailure(error, previousAttempts);

  console.log(`🔄 Preparing retry ${retryCount + 1}/${MAX_RETRIES} for task ${taskId}`);
  console.log(`   Fix approach: ${fixApproach}`);

  // Reset task to pending
  tasks.updateTask(taskId, { status: 'pending' });

  return { shouldRetry: true, fixApproach };
}

/**
 * Get tasks that need retry (failed with retries remaining)
 */
export function getTasksNeedingRetry(): tasks.Task[] {
  const failedTasks = tasks.getTasks({ status: 'failed' });

  return failedTasks.filter(task => {
    // Use task's own retry_count (set by failTask()) - NOT the task_retry_attempts table
    // This prevents infinite retry loops
    const retryCount = task.retry_count || 0;
    if (retryCount >= MAX_RETRIES) {
      console.log(`⏭️ Task ${task.display_id} has ${retryCount} retries (max ${MAX_RETRIES}) - skipping`);
      return false;
    }
    return true;
  });
}

/**
 * Process failed tasks and queue retries
 */
export async function processFailedTasks(): Promise<number> {
  const tasksToRetry = getTasksNeedingRetry();

  if (tasksToRetry.length === 0) {
    return 0;
  }

  console.log(`🔄 Found ${tasksToRetry.length} tasks eligible for retry`);

  let retriedCount = 0;

  for (const task of tasksToRetry) {
    // Get the last session to find the error
    const lastSession = sessions.getSessionsByTask(task.id)[0];
    const error = lastSession?.error_message || 'Unclassified failure';

    const { shouldRetry: canRetry, fixApproach } = prepareForRetry(task.id, error);

    if (canRetry) {
      // Record the retry attempt
      recordRetryAttempt(
        task.id,
        lastSession?.agent_id || 'unknown',
        null,
        error,
        fixApproach
      );

      // Append fix approach to task description for next agent
      const updatedDescription = task.description 
        ? `${task.description}\n\n---\n**Retry Guidance:**\n${fixApproach}`
        : `**Retry Guidance:**\n${fixApproach}`;

      tasks.updateTask(task.id, { 
        status: 'pending',
        description: updatedDescription,
      });

      ws.taskUpdated(tasks.getTask(task.id));
      retriedCount++;
    }
  }

  return retriedCount;
}

/**
 * Record successful completion (for learning)
 */
export function recordSuccess(taskId: string, sessionId: string): void {
  const retryHistory = getRetryHistory(taskId);

  if (retryHistory.length > 0) {
    // This was a retry - mark the last attempt as successful
    const lastAttempt = retryHistory[retryHistory.length - 1];
    updateRetryResult(lastAttempt.id, 'success');

    console.log(`✅ Task ${taskId} succeeded after ${retryHistory.length} retries`);

    // TODO: Store successful approach in agent memory for future reference
  }
}

/**
 * Get retry statistics
 */
export function getRetryStats(): {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  avgRetriesPerTask: number;
} {
  const stats = getOne<{
    total: number;
    success: number;
    failure: number;
    uniqueTasks: number;
  }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN result = 'failure' THEN 1 ELSE 0 END) as failure,
      COUNT(DISTINCT task_id) as uniqueTasks
    FROM task_retry_attempts
  `);

  return {
    totalRetries: stats?.total || 0,
    successfulRetries: stats?.success || 0,
    failedRetries: stats?.failure || 0,
    avgRetriesPerTask: stats?.uniqueTasks ? (stats.total / stats.uniqueTasks) : 0,
  };
}

export default {
  getRetryCount,
  getRetryHistory,
  recordRetryAttempt,
  updateRetryResult,
  analyzeFailure,
  shouldRetry,
  prepareForRetry,
  getTasksNeedingRetry,
  processFailedTasks,
  recordSuccess,
  getRetryStats,
};
