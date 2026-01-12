/**
 * Task Result Collector
 *
 * Persistent result collection mechanism that:
 * 1. Records task execution results in database
 * 2. Allows querying task status by ID
 * 3. Supports waiting for task completion
 * 4. Provides execution history and metrics
 */

import { EventEmitter } from 'events';
import { query, run, getOne } from '../../database/db.js';
import { TaskResult } from './agent-runner.js';
import { ParsedTask } from './task-loader.js';

export interface TaskExecutionRecord {
  id: string;
  taskId: string;
  taskListPath: string;
  buildId: string;
  status: 'pending' | 'running' | 'validating' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  error?: string;
  output?: string;
  assignedAgent?: string;
  filesModified?: string;
  questionsAsked?: number;
  tokensUsed?: number;
  attempts: number;
  [key: string]: unknown;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  completed: number;
  failed: number;
  inProgress: number;
  avgDurationMs?: number;
  totalTokensUsed: number;
  totalQuestionsAsked: number;
}

/**
 * Task Result Collector - Manages execution results
 */
export class TaskResultCollector extends EventEmitter {
  private pendingExecutions: Map<string, {
    promise: Promise<TaskResult>;
    resolve: (result: TaskResult) => void;
    reject: (error: Error) => void;
    timeoutHandle?: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    super();
  }

  /**
   * Start tracking a task execution
   * Returns an execution ID that can be used to wait for completion
   */
  async startExecution(
    task: ParsedTask,
    taskListPath: string,
    buildId: string,
    assignedAgent: string
  ): Promise<string> {
    const executionId = `exec-${Date.now()}-${task.id}`;

    // Record in database
    try {
      await run(`
        INSERT INTO task_executions (
          id, task_id, build_id, task_list_path, phase, action, file_path,
          status, started_at, assigned_agent, attempts
        ) VALUES (?, ?, ?, ?, 'execution', 'UPDATE', '', 'running', datetime('now'), ?, 1)
      `, [executionId, task.id, buildId, taskListPath, assignedAgent]);
    } catch (error) {
      console.error('[TaskResultCollector] Failed to record execution start:', error);
      // Continue anyway - we can still track in memory
    }

    // Create a promise that will be resolved when task completes
    let resolve: (result: TaskResult) => void;
    let reject: (error: Error) => void;
    const promise = new Promise<TaskResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.pendingExecutions.set(executionId, {
      promise,
      resolve: resolve!,
      reject: reject!,
    });

    this.emit('execution:started', {
      executionId,
      taskId: task.id,
      assignedAgent,
    });

    console.log(`[TaskResultCollector] Started tracking execution ${executionId} for task ${task.id}`);

    return executionId;
  }

  /**
   * Record task completion
   */
  async recordCompletion(
    executionId: string,
    result: TaskResult
  ): Promise<void> {
    const completedAt = new Date().toISOString();

    // Update database - map our statuses to the schema's statuses
    try {
      await run(`
        UPDATE task_executions
        SET
          status = ?,
          completed_at = ?,
          output = ?,
          error = ?,
          files_modified = ?,
          questions_asked = ?,
          tokens_used = ?
        WHERE id = ?
      `, [
        result.success ? 'completed' : 'failed',  // Map to schema's 'completed' not 'complete'
        completedAt,
        result.output || null,
        result.error || null,
        result.filesModified ? JSON.stringify(result.filesModified) : null,
        result.questionsAsked || 0,
        result.tokensUsed || 0,
        executionId,
      ]);
    } catch (error) {
      console.error('[TaskResultCollector] Failed to record completion:', error);
    }

    // Resolve the promise
    const pending = this.pendingExecutions.get(executionId);
    if (pending) {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.resolve(result);
      this.pendingExecutions.delete(executionId);
    }

    this.emit('execution:completed', {
      executionId,
      success: result.success,
      output: result.output,
    });

    console.log(`[TaskResultCollector] Recorded completion for ${executionId}: ${result.success ? 'success' : 'failed'}`);
  }

  /**
   * Record task failure
   */
  async recordFailure(
    executionId: string,
    error: string,
    shouldRetry: boolean = false
  ): Promise<void> {
    const completedAt = new Date().toISOString();

    // Update database
    try {
      await run(`
        UPDATE task_executions
        SET
          status = ?,
          completed_at = ?,
          error = ?,
          attempts = attempts + 1
        WHERE id = ?
      `, [
        shouldRetry ? 'pending' : 'failed',
        completedAt,
        error,
        executionId,
      ]);
    } catch (dbError) {
      console.error('[TaskResultCollector] Failed to record failure:', dbError);
    }

    // Reject the promise if not retrying
    if (!shouldRetry) {
      const pending = this.pendingExecutions.get(executionId);
      if (pending) {
        if (pending.timeoutHandle) {
          clearTimeout(pending.timeoutHandle);
        }
        pending.reject(new Error(error));
        this.pendingExecutions.delete(executionId);
      }
    }

    this.emit('execution:failed', {
      executionId,
      error,
      willRetry: shouldRetry,
    });

    console.log(`[TaskResultCollector] Recorded failure for ${executionId}: ${error}`);
  }

  /**
   * Wait for a task execution to complete
   * Returns the task result or throws if timeout/error
   */
  async waitForCompletion(
    executionId: string,
    timeoutMs: number = 5 * 60 * 1000
  ): Promise<TaskResult> {
    const pending = this.pendingExecutions.get(executionId);

    if (!pending) {
      // Check if already completed in database
      const record = await this.getExecutionById(executionId);
      if (record && (record.status === 'completed' || record.status === 'failed')) {
        return {
          success: record.status === 'completed',
          output: record.output || undefined,
          error: record.error || undefined,
          filesModified: record.filesModified ? JSON.parse(record.filesModified) : undefined,
          questionsAsked: record.questionsAsked || 0,
          tokensUsed: record.tokensUsed || 0,
        };
      }

      throw new Error(`Execution ${executionId} not found or not tracked`);
    }

    // Set timeout
    const timeoutPromise = new Promise<TaskResult>((_, reject) => {
      pending.timeoutHandle = setTimeout(() => {
        this.pendingExecutions.delete(executionId);
        this.recordFailure(executionId, 'Execution timeout').catch(console.error);
        reject(new Error(`Execution ${executionId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race between completion and timeout
    return Promise.race([pending.promise, timeoutPromise]);
  }

  /**
   * Get execution status by ID
   */
  async getExecutionById(executionId: string): Promise<TaskExecutionRecord | null> {
    try {
      const record = await getOne<TaskExecutionRecord>(`
        SELECT * FROM task_executions WHERE id = ?
      `, [executionId]);

      return record || null;
    } catch (error) {
      console.error('[TaskResultCollector] Failed to get execution:', error);
      return null;
    }
  }

  /**
   * Get all executions for a task ID
   */
  async getExecutionsByTaskId(taskId: string): Promise<TaskExecutionRecord[]> {
    try {
      return await query<TaskExecutionRecord>(`
        SELECT * FROM task_executions
        WHERE task_id = ?
        ORDER BY started_at DESC
      `, [taskId]);
    } catch (error) {
      console.error('[TaskResultCollector] Failed to get executions:', error);
      return [];
    }
  }

  /**
   * Get all executions for a build
   */
  async getExecutionsByBuildId(buildId: string): Promise<TaskExecutionRecord[]> {
    try {
      return await query<TaskExecutionRecord>(`
        SELECT * FROM task_executions
        WHERE build_id = ?
        ORDER BY started_at DESC
      `, [buildId]);
    } catch (error) {
      console.error('[TaskResultCollector] Failed to get executions:', error);
      return [];
    }
  }

  /**
   * Get execution metrics
   */
  async getMetrics(buildId?: string): Promise<ExecutionMetrics> {
    try {
      const whereClause = buildId ? 'WHERE build_id = ?' : '';
      const params = buildId ? [buildId] : [];

      const metrics = await getOne<{
        total: number;
        completed: number;
        failed: number;
        in_progress: number;
        avg_duration: number | null;
        total_tokens: number;
        total_questions: number;
      }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as in_progress,
          AVG(
            CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN (julianday(completed_at) - julianday(started_at)) * 86400000
            ELSE NULL END
          ) as avg_duration,
          SUM(COALESCE(tokens_used, 0)) as total_tokens,
          SUM(COALESCE(questions_asked, 0)) as total_questions
        FROM task_executions
        ${whereClause}
      `, params);

      return {
        totalExecutions: metrics?.total || 0,
        completed: metrics?.completed || 0,
        failed: metrics?.failed || 0,
        inProgress: metrics?.in_progress || 0,
        avgDurationMs: metrics?.avg_duration || undefined,
        totalTokensUsed: metrics?.total_tokens || 0,
        totalQuestionsAsked: metrics?.total_questions || 0,
      };
    } catch (error) {
      console.error('[TaskResultCollector] Failed to get metrics:', error);
      return {
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        totalTokensUsed: 0,
        totalQuestionsAsked: 0,
      };
    }
  }

  /**
   * Cancel a pending execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const pending = this.pendingExecutions.get(executionId);

    if (pending) {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.reject(new Error('Execution cancelled'));
      this.pendingExecutions.delete(executionId);
    }

    // Update database
    try {
      await run(`
        UPDATE task_executions
        SET status = 'skipped', completed_at = datetime('now')
        WHERE id = ? AND status = 'running'
      `, [executionId]);
    } catch (error) {
      console.error('[TaskResultCollector] Failed to cancel execution:', error);
    }

    this.emit('execution:cancelled', { executionId });
  }

  /**
   * Get count of currently pending executions
   */
  getPendingCount(): number {
    return this.pendingExecutions.size;
  }

  /**
   * Clean up old completed executions (older than X days)
   */
  async cleanupOldExecutions(daysOld: number = 30): Promise<number> {
    try {
      const result = await run(`
        DELETE FROM task_executions
        WHERE status IN ('completed', 'failed', 'skipped')
        AND julianday('now') - julianday(completed_at) > ?
      `, [daysOld]);

      console.log(`[TaskResultCollector] Cleaned up ${result} old executions`);
      return result as any; // SQLite returns changes count
    } catch (error) {
      console.error('[TaskResultCollector] Failed to cleanup executions:', error);
      return 0;
    }
  }
}

// Singleton instance
let collectorInstance: TaskResultCollector | null = null;

/**
 * Get the singleton task result collector
 */
export function getTaskResultCollector(): TaskResultCollector {
  if (!collectorInstance) {
    collectorInstance = new TaskResultCollector();
  }
  return collectorInstance;
}

/**
 * Create a new task result collector (for testing)
 */
export function createTaskResultCollector(): TaskResultCollector {
  return new TaskResultCollector();
}
