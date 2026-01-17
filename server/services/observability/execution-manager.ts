/**
 * Execution Run Management - Creates and manages task list execution runs
 *
 * Provides functions to create, track, and complete execution runs
 * for observability tracking.
 */

import { v4 as uuidv4 } from "uuid";
import { run, query } from "../../../database/db.js";
import { eventEmitter, resetSequence } from "./unified-event-emitter.js";

// Execution status types
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// Execution run record
export interface ExecutionRun {
  id: string;
  taskListId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  sessionId: string | null;
  waveCount: number;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

// Active executions cache for quick lookup
const activeExecutions: Map<string, ExecutionRun> = new Map();

/**
 * Create a new execution run for a task list
 *
 * @param taskListId - ID of the task list being executed
 * @param sessionId - Optional concurrent execution session ID
 * @returns execution_id
 */
export async function createExecutionRun(
  taskListId: string,
  sessionId?: string,
): Promise<string> {
  const executionId = uuidv4();
  const startedAt = new Date().toISOString();

  // Reset sequence counter for this execution
  resetSequence(executionId);

  try {
    // Get next run_number for this task list
    const lastRun = await query<{ max_run: number }>(
      `SELECT COALESCE(MAX(run_number), 0) as max_run
       FROM task_list_execution_runs
       WHERE task_list_id = ?`,
      [taskListId],
    );
    const runNumber = (lastRun[0]?.max_run || 0) + 1;

    await run(
      `INSERT INTO task_list_execution_runs (
        id, task_list_id, run_number, status, started_at, session_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        executionId,
        taskListId,
        runNumber,
        "running",
        startedAt,
        sessionId || null,
      ],
    );

    // Cache the execution
    const execution: ExecutionRun = {
      id: executionId,
      taskListId,
      status: "running",
      startedAt,
      completedAt: null,
      sessionId: sessionId || null,
      waveCount: 0,
      taskCount: 0,
      completedCount: 0,
      failedCount: 0,
    };
    activeExecutions.set(executionId, execution);

    // Emit system event
    await eventEmitter.emitSystem("phase_start", "Execution started", {
      executionId,
      taskListId,
      sessionId,
    });
  } catch (error) {
    console.error("Failed to create execution run:", error);
    throw error;
  }

  return executionId;
}

/**
 * Complete an execution run
 *
 * @param executionId - ID of the execution to complete
 * @param status - Final status (completed, failed, cancelled)
 * @param summary - Optional summary of the execution
 */
export async function completeExecutionRun(
  executionId: string,
  status: "completed" | "failed" | "cancelled",
  summary?: Record<string, unknown>,
): Promise<void> {
  const completedAt = new Date().toISOString();

  try {
    // Get execution stats
    const stats = await query<{
      task_count: number;
      completed_count: number;
      failed_count: number;
      wave_count: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM wave_task_assignments wta
         JOIN parallel_execution_waves pew ON pew.id = wta.wave_id
         WHERE pew.execution_run_id = ?) as task_count,
        (SELECT COUNT(*) FROM wave_task_assignments wta
         JOIN parallel_execution_waves pew ON pew.id = wta.wave_id
         JOIN tasks t ON t.id = wta.task_id
         WHERE pew.execution_run_id = ? AND t.status = 'complete') as completed_count,
        (SELECT COUNT(*) FROM wave_task_assignments wta
         JOIN parallel_execution_waves pew ON pew.id = wta.wave_id
         JOIN tasks t ON t.id = wta.task_id
         WHERE pew.execution_run_id = ? AND t.status = 'failed') as failed_count,
        (SELECT COUNT(*) FROM parallel_execution_waves
         WHERE execution_run_id = ?) as wave_count`,
      [executionId, executionId, executionId, executionId],
    );

    const execStats = stats[0] || {
      task_count: 0,
      completed_count: 0,
      failed_count: 0,
      wave_count: 0,
    };

    await run(
      `UPDATE task_list_execution_runs SET
        status = ?,
        completed_at = ?
       WHERE id = ?`,
      [status, completedAt, executionId],
    );

    // Remove from active cache
    activeExecutions.delete(executionId);

    // Emit system event
    await eventEmitter.emitSystem("phase_end", `Execution ${status}`, {
      executionId,
      status,
      ...execStats,
      ...summary,
    });
  } catch (error) {
    console.error("Failed to complete execution run:", error);
    throw error;
  }
}

/**
 * Get an active execution run
 *
 * @param executionId - ID of the execution
 * @returns ExecutionRun or null if not found
 */
export async function getExecutionRun(
  executionId: string,
): Promise<ExecutionRun | null> {
  // Check cache first
  if (activeExecutions.has(executionId)) {
    return activeExecutions.get(executionId)!;
  }

  // Query database
  const results = await query<{
    id: string;
    task_list_id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    session_id: string | null;
  }>(
    `SELECT id, task_list_id, status, started_at, completed_at, session_id
     FROM task_list_execution_runs
     WHERE id = ?`,
    [executionId],
  );

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    id: row.id,
    taskListId: row.task_list_id,
    status: row.status as ExecutionStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    sessionId: row.session_id,
    waveCount: 0,
    taskCount: 0,
    completedCount: 0,
    failedCount: 0,
  };
}

/**
 * Create or get a concurrent execution session
 *
 * @returns session_id
 */
export async function createExecutionSession(): Promise<string> {
  const sessionId = uuidv4();
  const startedAt = new Date().toISOString();

  try {
    await run(
      `INSERT INTO concurrent_execution_sessions (
        id, started_at, status
      ) VALUES (?, ?, ?)`,
      [sessionId, startedAt, "active"],
    );
  } catch (error) {
    console.error("Failed to create execution session:", error);
    throw error;
  }

  return sessionId;
}

/**
 * Complete a concurrent execution session
 *
 * @param sessionId - ID of the session to complete
 * @param status - Final status
 */
export async function completeExecutionSession(
  sessionId: string,
  status: "completed" | "failed" = "completed",
): Promise<void> {
  const completedAt = new Date().toISOString();

  try {
    // Get session stats
    const stats = await query<{
      execution_count: number;
      total_wave_count: number;
      total_task_count: number;
      peak_concurrent_agents: number;
    }>(
      `SELECT
        COUNT(DISTINCT tler.id) as execution_count,
        COUNT(DISTINCT pew.id) as total_wave_count,
        COUNT(DISTINCT wta.task_id) as total_task_count,
        (SELECT MAX(agent_count) FROM (
          SELECT COUNT(*) as agent_count
          FROM build_agent_instances bai
          WHERE bai.wave_id IN (
            SELECT pew2.id FROM parallel_execution_waves pew2
            JOIN task_list_execution_runs tler2 ON tler2.id = pew2.execution_run_id
            WHERE tler2.session_id = ?
          )
          GROUP BY bai.spawned_at
        )) as peak_concurrent_agents
       FROM task_list_execution_runs tler
       LEFT JOIN parallel_execution_waves pew ON pew.execution_run_id = tler.id
       LEFT JOIN wave_task_assignments wta ON wta.wave_id = pew.id
       WHERE tler.session_id = ?`,
      [sessionId, sessionId],
    );

    const sessionStats = stats[0] || {
      execution_count: 0,
      total_wave_count: 0,
      total_task_count: 0,
      peak_concurrent_agents: 0,
    };

    await run(
      `UPDATE concurrent_execution_sessions SET
        status = ?,
        completed_at = ?,
        execution_count = ?,
        total_wave_count = ?,
        total_task_count = ?,
        peak_concurrent_agents = ?
       WHERE id = ?`,
      [
        status,
        completedAt,
        sessionStats.execution_count,
        sessionStats.total_wave_count,
        sessionStats.total_task_count,
        sessionStats.peak_concurrent_agents || 0,
        sessionId,
      ],
    );
  } catch (error) {
    console.error("Failed to complete execution session:", error);
    throw error;
  }
}

/**
 * Update execution wave count
 *
 * @param executionId - ID of the execution
 * @param waveNumber - Current wave number
 */
export async function updateWaveCount(
  executionId: string,
  waveNumber: number,
): Promise<void> {
  const cached = activeExecutions.get(executionId);
  if (cached) {
    cached.waveCount = waveNumber;
  }
}

/**
 * Get all active executions
 */
export function getActiveExecutions(): ExecutionRun[] {
  return Array.from(activeExecutions.values());
}
