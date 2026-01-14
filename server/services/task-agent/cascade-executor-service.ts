/**
 * Cascade Executor Service
 *
 * Executes cascade effects on related tasks.
 * Part of: Task System V2 Implementation Plan (IMPL-3.9)
 */

import { run, saveDb, getOne } from '../../../database/db.js';
import {
  CascadeAnalysis,
  CascadeExecutionResult,
  CascadeEffect,
} from '../../../types/cascade.js';

/**
 * Cascade Executor Service class
 */
export class CascadeExecutorService {
  /**
   * Execute all cascade effects
   */
  async execute(
    analysis: CascadeAnalysis,
    approveAll: boolean = false
  ): Promise<CascadeExecutionResult> {
    const result: CascadeExecutionResult = {
      sourceTaskId: analysis.sourceTaskId,
      applied: [],
      flaggedForReview: [],
      failed: [],
    };

    // Process all effects
    const allEffects = [...analysis.directEffects, ...analysis.transitiveEffects];

    for (const effect of allEffects) {
      try {
        const shouldApply = approveAll ||
          analysis.taskListAutoApprove ||
          effect.autoApprovable;

        if (shouldApply) {
          await this.applyEffect(effect);
          result.applied.push({
            taskId: effect.affectedTaskId,
            action: effect.suggestedAction,
            success: true,
          });
        } else {
          await this.flagForReview(effect.affectedTaskId, effect.reason);
          result.flaggedForReview.push(effect.affectedTaskId);
        }
      } catch (error) {
        result.failed.push({
          taskId: effect.affectedTaskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Execute only selected effects
   */
  async executeSelected(
    analysis: CascadeAnalysis,
    selectedTaskIds: string[]
  ): Promise<CascadeExecutionResult> {
    const result: CascadeExecutionResult = {
      sourceTaskId: analysis.sourceTaskId,
      applied: [],
      flaggedForReview: [],
      failed: [],
    };

    const selectedSet = new Set(selectedTaskIds);
    const allEffects = [...analysis.directEffects, ...analysis.transitiveEffects];

    for (const effect of allEffects) {
      if (selectedSet.has(effect.affectedTaskId)) {
        try {
          await this.applyEffect(effect);
          result.applied.push({
            taskId: effect.affectedTaskId,
            action: effect.suggestedAction,
            success: true,
          });
        } catch (error) {
          result.failed.push({
            taskId: effect.affectedTaskId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        // Not selected - flag for review
        await this.flagForReview(effect.affectedTaskId, 'Not selected for auto-apply');
        result.flaggedForReview.push(effect.affectedTaskId);
      }
    }

    return result;
  }

  /**
   * Flag a task for review
   */
  async flagForReview(taskId: string, reason: string): Promise<void> {
    // Add a note to the task's metadata or create a notification
    // For now, we'll update the task's status to 'blocked' if it's pending
    const task = await getOne<{ status: string }>(
      'SELECT status FROM tasks WHERE id = ?',
      [taskId]
    );

    if (task && task.status === 'pending') {
      await run(
        `UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), taskId]
      );
      await saveDb();
    }

    // Create a notification for review
    try {
      await run(
        `INSERT INTO notifications (id, type, title, message, context, priority, status, target_type, target_id, created_at)
         VALUES (?, 'cascade_review', 'Task requires review', ?, ?, 'high', 'pending', 'task', ?, ?)`,
        [
          crypto.randomUUID(),
          `Task requires review due to cascade: ${reason}`,
          JSON.stringify({ reason }),
          taskId,
          new Date().toISOString(),
        ]
      );
      await saveDb();
    } catch {
      // Notification table might not exist, ignore
    }
  }

  /**
   * Clear review flag for a task
   */
  async clearReviewFlag(taskId: string): Promise<void> {
    const task = await getOne<{ status: string }>(
      'SELECT status FROM tasks WHERE id = ?',
      [taskId]
    );

    if (task && task.status === 'blocked') {
      await run(
        `UPDATE tasks SET status = 'pending', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), taskId]
      );
      await saveDb();
    }

    // Clear related notifications
    try {
      await run(
        `UPDATE notifications SET status = 'resolved' WHERE target_id = ? AND type = 'cascade_review'`,
        [taskId]
      );
      await saveDb();
    } catch {
      // Ignore if notifications table doesn't exist
    }
  }

  /**
   * Notify affected tasks about cascade
   */
  async notifyAffectedTasks(analysis: CascadeAnalysis): Promise<void> {
    const allEffects = [...analysis.directEffects, ...analysis.transitiveEffects];

    for (const effect of allEffects) {
      try {
        await run(
          `INSERT INTO notifications (id, type, title, message, context, priority, status, target_type, target_id, created_at)
           VALUES (?, 'cascade_notification', 'Task affected by cascade', ?, ?, 'medium', 'pending', 'task', ?, ?)`,
          [
            crypto.randomUUID(),
            `Task affected by changes to ${analysis.sourceTaskId}: ${effect.reason}`,
            JSON.stringify({
              sourceTaskId: analysis.sourceTaskId,
              changeType: analysis.changeType,
              depth: effect.depth,
            }),
            effect.affectedTaskId,
            new Date().toISOString(),
          ]
        );
      } catch {
        // Ignore notification errors
      }
    }
    await saveDb();
  }

  /**
   * Apply a cascade effect to a task
   */
  private async applyEffect(effect: CascadeEffect): Promise<void> {
    const now = new Date().toISOString();

    switch (effect.suggestedAction) {
      case 'auto_update':
        // Just mark as updated
        await run(
          'UPDATE tasks SET updated_at = ? WHERE id = ?',
          [now, effect.affectedTaskId]
        );
        break;

      case 'notify':
        // Create a notification
        try {
          await run(
            `INSERT INTO notifications (id, type, title, message, priority, status, target_type, target_id, created_at)
             VALUES (?, 'cascade_update', 'Task updated by cascade', ?, 'low', 'pending', 'task', ?, ?)`,
            [
              crypto.randomUUID(),
              effect.reason,
              effect.affectedTaskId,
              now,
            ]
          );
        } catch {
          // Ignore
        }
        break;

      case 'block':
        await run(
          `UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?`,
          [now, effect.affectedTaskId]
        );
        break;

      case 'review':
        // Flag for review
        await this.flagForReview(effect.affectedTaskId, effect.reason);
        break;
    }

    await saveDb();
  }
}

// Export singleton instance
export const cascadeExecutorService = new CascadeExecutorService();
export default cascadeExecutorService;
