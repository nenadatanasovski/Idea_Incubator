/**
 * Task State History Service
 *
 * Records and queries task state transitions.
 * Part of: Task System V2 Implementation Plan (IMPL-3.7)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskStateHistoryEntry,
  TaskStateHistoryRow,
  mapTaskStateHistoryRow,
} from "../../../types/task-version.js";
import { TaskStatus } from "../../../types/task-agent.js";

/**
 * Task State History Service class
 */
export class TaskStateHistoryService {
  /**
   * Record a state transition
   */
  async record(
    taskId: string,
    fromStatus: TaskStatus | null,
    toStatus: TaskStatus,
    changedBy: string,
    actorType: "user" | "agent" | "system",
    reason?: string,
    metadata?: Record<string, unknown>,
  ): Promise<TaskStateHistoryEntry> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO task_state_history (id, task_id, from_status, to_status, changed_by, actor_type, reason, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        taskId,
        fromStatus,
        toStatus,
        changedBy,
        actorType,
        reason || null,
        metadata ? JSON.stringify(metadata) : null,
        now,
      ],
    );

    await saveDb();

    const created = await getOne<TaskStateHistoryRow>(
      "SELECT * FROM task_state_history WHERE id = ?",
      [id],
    );
    if (!created) {
      throw new Error("Failed to record state history");
    }
    return mapTaskStateHistoryRow(created);
  }

  /**
   * Get full history for a task
   */
  async getHistory(taskId: string): Promise<TaskStateHistoryEntry[]> {
    const rows = await query<TaskStateHistoryRow>(
      "SELECT * FROM task_state_history WHERE task_id = ? ORDER BY created_at ASC",
      [taskId],
    );
    return rows.map(mapTaskStateHistoryRow);
  }

  /**
   * Get history within a time range
   */
  async getHistoryInRange(
    taskId: string,
    from: Date,
    to: Date,
  ): Promise<TaskStateHistoryEntry[]> {
    const rows = await query<TaskStateHistoryRow>(
      `SELECT * FROM task_state_history
       WHERE task_id = ? AND created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC`,
      [taskId, from.toISOString(), to.toISOString()],
    );
    return rows.map(mapTaskStateHistoryRow);
  }

  /**
   * Get the last transition for a task
   */
  async getLastTransition(
    taskId: string,
  ): Promise<TaskStateHistoryEntry | null> {
    const row = await getOne<TaskStateHistoryRow>(
      "SELECT * FROM task_state_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
      [taskId],
    );
    return row ? mapTaskStateHistoryRow(row) : null;
  }

  /**
   * Calculate time spent in a status
   */
  async getTimeInStatus(taskId: string, status: TaskStatus): Promise<number> {
    const history = await this.getHistory(taskId);

    if (history.length === 0) {
      return 0;
    }

    // Sort by time ascending
    const sortedHistory = [...history].reverse();

    let totalTime = 0;
    let statusEntryTime: Date | null = null;

    for (const entry of sortedHistory) {
      if (entry.toStatus === status) {
        // Entered this status
        statusEntryTime = new Date(entry.createdAt);
      } else if (statusEntryTime && entry.fromStatus === status) {
        // Left this status
        const exitTime = new Date(entry.createdAt);
        totalTime += exitTime.getTime() - statusEntryTime.getTime();
        statusEntryTime = null;
      }
    }

    // If still in this status, count time until now
    if (statusEntryTime) {
      totalTime += Date.now() - statusEntryTime.getTime();
    }

    return totalTime;
  }

  /**
   * Get transition count for a task
   */
  async getTransitionCount(taskId: string): Promise<number> {
    const result = await getOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM task_state_history WHERE task_id = ?",
      [taskId],
    );
    return result?.count || 0;
  }

  /**
   * Get average time to complete for a task list
   */
  async getAverageTimeToComplete(taskListId: string): Promise<number> {
    // Get all completed tasks in the list
    const completedTasks = await query<{ id: string }>(
      `SELECT id FROM tasks WHERE task_list_id = ? AND status = 'completed'`,
      [taskListId],
    );

    if (completedTasks.length === 0) {
      return 0;
    }

    let totalTime = 0;
    let count = 0;

    for (const task of completedTasks) {
      // Get first 'in_progress' and last 'completed' transitions
      const startEntry = await getOne<TaskStateHistoryRow>(
        `SELECT * FROM task_state_history
         WHERE task_id = ? AND to_status = 'in_progress'
         ORDER BY created_at ASC LIMIT 1`,
        [task.id],
      );

      const endEntry = await getOne<TaskStateHistoryRow>(
        `SELECT * FROM task_state_history
         WHERE task_id = ? AND to_status = 'completed'
         ORDER BY created_at DESC LIMIT 1`,
        [task.id],
      );

      if (startEntry && endEntry) {
        const startTime = new Date(startEntry.created_at).getTime();
        const endTime = new Date(endEntry.created_at).getTime();
        totalTime += endTime - startTime;
        count++;
      }
    }

    return count > 0 ? Math.round(totalTime / count) : 0;
  }

  /**
   * Get history by actor
   */
  async getHistoryByActor(
    taskId: string,
    actorType: "user" | "agent" | "system",
  ): Promise<TaskStateHistoryEntry[]> {
    const rows = await query<TaskStateHistoryRow>(
      "SELECT * FROM task_state_history WHERE task_id = ? AND actor_type = ? ORDER BY created_at DESC",
      [taskId, actorType],
    );
    return rows.map(mapTaskStateHistoryRow);
  }

  /**
   * Get recent transitions across all tasks
   */
  async getRecentTransitions(
    limit: number = 20,
  ): Promise<TaskStateHistoryEntry[]> {
    const rows = await query<TaskStateHistoryRow>(
      "SELECT * FROM task_state_history ORDER BY created_at DESC LIMIT ?",
      [limit],
    );
    return rows.map(mapTaskStateHistoryRow);
  }
}

// Export singleton instance
export const taskStateHistoryService = new TaskStateHistoryService();
export default taskStateHistoryService;
