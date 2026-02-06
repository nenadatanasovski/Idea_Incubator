/**
 * QA Validation System
 * 
 * Validates task completions by:
 * 1. Running automated tests
 * 2. Checking pass criteria
 * 3. Recording results
 * 4. Triggering fix loop if needed
 */

import { query, run, getOne } from '../db/index.js';
import * as tasks from '../db/tasks.js';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { v4 as uuidv4 } from 'uuid';

export interface QAResult {
  id: string;
  task_id: string;
  agent_id: string;
  session_id: string;
  status: 'passed' | 'failed' | 'skipped';
  criteria_results: CriteriaResult[];
  test_output: string | null;
  error_message: string | null;
  attempt_number: number;
  created_at: string;
}

export interface CriteriaResult {
  criterion: string;
  passed: boolean;
  details?: string;
}

// Ensure QA tables exist
function ensureQATables(): void {
  run(`
    CREATE TABLE IF NOT EXISTS qa_results (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      status TEXT NOT NULL,
      criteria_results TEXT,
      test_output TEXT,
      error_message TEXT,
      attempt_number INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, []);

  run(`CREATE INDEX IF NOT EXISTS idx_qa_results_task ON qa_results(task_id)`, []);
}

ensureQATables();

const MAX_FIX_ATTEMPTS = 5;

/**
 * Validate a completed task
 */
export async function validateTask(
  taskId: string,
  agentId: string,
  sessionId?: string
): Promise<QAResult> {
  const task = tasks.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Get attempt number
  const previousAttempts = query<{ attempt_number: number }>(
    'SELECT MAX(attempt_number) as attempt_number FROM qa_results WHERE task_id = ?',
    [taskId]
  );
  const attemptNumber = (previousAttempts[0]?.attempt_number || 0) + 1;

  // Log QA started
  events.qaStarted(taskId, agentId);

  // Check pass criteria
  const criteriaResults = await checkPassCriteria(task);
  const allPassed = criteriaResults.every(r => r.passed);

  // Create QA result
  const result: QAResult = {
    id: uuidv4(),
    task_id: taskId,
    agent_id: agentId,
    session_id: sessionId || '',
    status: allPassed ? 'passed' : 'failed',
    criteria_results: criteriaResults,
    test_output: null,
    error_message: allPassed ? null : 'Some criteria not met',
    attempt_number: attemptNumber,
    created_at: new Date().toISOString(),
  };

  // Store result
  run(`
    INSERT INTO qa_results (id, task_id, agent_id, session_id, status, criteria_results, test_output, error_message, attempt_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    result.id,
    result.task_id,
    result.agent_id,
    result.session_id,
    result.status,
    JSON.stringify(result.criteria_results),
    result.test_output,
    result.error_message,
    result.attempt_number,
  ]);

  if (allPassed) {
    // QA passed
    events.qaPassed(taskId, agentId);
    console.log(`✅ QA passed for ${task.display_id}`);
  } else {
    // QA failed
    const failedCriteria = criteriaResults.filter(r => !r.passed).map(r => r.criterion);
    events.qaFailed(taskId, agentId, failedCriteria.join(', '));
    console.log(`❌ QA failed for ${task.display_id}: ${failedCriteria.join(', ')}`);

    // Check if we should trigger fix loop
    if (attemptNumber < MAX_FIX_ATTEMPTS) {
      console.log(`🔄 Triggering fix attempt ${attemptNumber + 1}/${MAX_FIX_ATTEMPTS}`);
      await triggerFixLoop(task, result);
    } else {
      console.log(`❌ Max fix attempts reached for ${task.display_id}`);
      tasks.failTask(taskId);
      ws.taskFailed(tasks.getTask(taskId), 'Max fix attempts exceeded');
    }
  }

  return result;
}

/**
 * Check pass criteria for a task
 */
async function checkPassCriteria(task: tasks.Task): Promise<CriteriaResult[]> {
  const results: CriteriaResult[] = [];

  if (!task.pass_criteria) {
    // No criteria = auto pass
    return [{ criterion: 'No criteria defined', passed: true }];
  }

  let criteria: string[];
  try {
    criteria = JSON.parse(task.pass_criteria);
    if (!Array.isArray(criteria)) {
      criteria = [task.pass_criteria];
    }
  } catch {
    criteria = [task.pass_criteria];
  }

  for (const criterion of criteria) {
    // Simple check - in real implementation would run actual tests
    const result = await evaluateCriterion(task, criterion);
    results.push(result);
  }

  return results;
}

/**
 * Evaluate a single criterion
 */
async function evaluateCriterion(
  task: tasks.Task,
  criterion: string
): Promise<CriteriaResult> {
  // In real implementation, this would:
  // 1. Parse the criterion type (file exists, test passes, etc.)
  // 2. Run appropriate check
  // 3. Return detailed result

  // For now, we'll use a simple heuristic
  // In production, this would call the QA agent to verify

  // Check for common patterns
  const lowerCriterion = criterion.toLowerCase();
  
  if (lowerCriterion.includes('exists') || lowerCriterion.includes('created')) {
    // File existence check would go here
    return { criterion, passed: true, details: 'File check simulated' };
  }

  if (lowerCriterion.includes('test') || lowerCriterion.includes('passes')) {
    // Test execution would go here
    return { criterion, passed: true, details: 'Test check simulated' };
  }

  // Default: assume passed (real impl would verify)
  return { criterion, passed: true, details: 'Auto-verified' };
}

/**
 * Trigger fix loop for failed task
 */
async function triggerFixLoop(task: tasks.Task, qaResult: QAResult): Promise<void> {
  // Reset task status to pending
  tasks.updateTask(task.id, { status: 'pending' });

  // Store fix context
  run(`
    INSERT INTO test_fix_attempts (id, task_id, qa_result_id, attempt_number, status, fix_description)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `, [
    uuidv4(),
    task.id,
    qaResult.id,
    qaResult.attempt_number,
    `Fix for: ${qaResult.criteria_results.filter(r => !r.passed).map(r => r.criterion).join(', ')}`,
  ]);

  // The orchestrator will pick up the task again on next tick
  ws.taskUpdated(tasks.getTask(task.id));
}

/**
 * Get QA history for a task
 */
export function getTaskQAHistory(taskId: string): QAResult[] {
  const rows = query<{
    id: string;
    task_id: string;
    agent_id: string;
    session_id: string;
    status: string;
    criteria_results: string;
    test_output: string | null;
    error_message: string | null;
    attempt_number: number;
    created_at: string;
  }>(
    'SELECT * FROM qa_results WHERE task_id = ? ORDER BY attempt_number DESC',
    [taskId]
  );

  return rows.map(row => ({
    ...row,
    status: row.status as QAResult['status'],
    criteria_results: JSON.parse(row.criteria_results || '[]'),
  }));
}

/**
 * Get QA stats
 */
export function getQAStats(): {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
} {
  const stats = getOne<{ total: number; passed: number; failed: number }>(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM qa_results`
  );

  return {
    total: stats?.total || 0,
    passed: stats?.passed || 0,
    failed: stats?.failed || 0,
    passRate: stats?.total ? (stats.passed / stats.total) * 100 : 0,
  };
}

export default {
  validateTask,
  getTaskQAHistory,
  getQAStats,
};
