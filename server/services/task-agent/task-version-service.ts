/**
 * Task Version Service
 *
 * Manages task version history, checkpoints, and rollback.
 * Part of: Task System V2 Implementation Plan (IMPL-3.6)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskVersion,
  VersionDiff,
  CreateCheckpointInput,
  RestoreVersionInput,
  TaskVersionRow,
  mapTaskVersionRow,
} from "../../../types/task-version.js";
import { Task } from "../../../types/task-agent.js";

/**
 * Task Version Service class
 */
export class TaskVersionService {
  /**
   * Create a new version (called automatically on task changes)
   * Supports three signatures:
   * 1. createVersion(taskId, changedFields[], reason?, userId?)
   * 2. createVersion(taskId, { title?, description?, category?, changedBy, changeReason })
   * 3. createVersion(taskId, reason, userId) - for simple version creation
   */
  async createVersion(
    taskId: string,
    changedFieldsOrUpdateOrReason?: string[] | string | {
      title?: string;
      description?: string;
      category?: string;
      changedBy?: string;
      changeReason?: string;
    },
    reason?: string,
    userId: string = "system",
  ): Promise<TaskVersion> {
    // Detect which signature is being used
    const isUpdateObject =
      changedFieldsOrUpdateOrReason &&
      !Array.isArray(changedFieldsOrUpdateOrReason) &&
      typeof changedFieldsOrUpdateOrReason === 'object';

    const isSimpleString =
      typeof changedFieldsOrUpdateOrReason === 'string';

    let changedFields: string[] = [];
    let actualReason: string | null = reason || null;
    let actualUserId = userId;

    // Get current task state
    const task = await getOne<Record<string, unknown>>(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId],
    );

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (isUpdateObject) {
      // Signature 2: apply updates to task
      const updates = changedFieldsOrUpdateOrReason as {
        title?: string;
        description?: string;
        category?: string;
        changedBy?: string;
        changeReason?: string;
      };

      const updateFields: string[] = [];
      const updateValues: (string | null)[] = [];

      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(updates.title);
        changedFields.push('title');
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(updates.description);
        changedFields.push('description');
      }
      if (updates.category !== undefined) {
        updateFields.push('category = ?');
        updateValues.push(updates.category);
        changedFields.push('category');
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(taskId);
        await run(
          `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues,
        );
      }

      actualReason = updates.changeReason || null;
      actualUserId = updates.changedBy || 'system';
    } else if (isSimpleString) {
      // Signature 3: simple reason + userId
      actualReason = changedFieldsOrUpdateOrReason;
      actualUserId = reason || 'system'; // reason parameter becomes userId in this case
    } else if (Array.isArray(changedFieldsOrUpdateOrReason)) {
      // Signature 1: array of changed fields
      changedFields = changedFieldsOrUpdateOrReason;
    }

    // Get next version number
    const latestVersion = await this.getLatestVersion(taskId);
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Get updated task state for snapshot
    const updatedTask = await getOne<Record<string, unknown>>(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId],
    );

    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO task_versions (id, task_id, version, snapshot, changed_fields, change_reason, is_checkpoint, checkpoint_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        taskId,
        nextVersion,
        JSON.stringify(updatedTask || task),
        JSON.stringify(changedFields),
        actualReason,
        0, // not a checkpoint
        null,
        actualUserId,
        now,
      ],
    );

    await saveDb();

    const created = await getOne<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE id = ?",
      [id],
    );
    if (!created) {
      throw new Error("Failed to create task version");
    }
    return mapTaskVersionRow(created);
  }

  /**
   * Get all versions for a task
   */
  async getVersions(taskId: string): Promise<TaskVersion[]> {
    const rows = await query<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE task_id = ? ORDER BY version ASC",
      [taskId],
    );
    return rows.map(mapTaskVersionRow);
  }

  /**
   * Get a specific version
   */
  async getVersion(
    taskId: string,
    version: number,
  ): Promise<TaskVersion | null> {
    const row = await getOne<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE task_id = ? AND version = ?",
      [taskId, version],
    );
    return row ? mapTaskVersionRow(row) : null;
  }

  /**
   * Get latest version
   */
  async getLatestVersion(taskId: string): Promise<TaskVersion | null> {
    const row = await getOne<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE task_id = ? ORDER BY version DESC LIMIT 1",
      [taskId],
    );
    return row ? mapTaskVersionRow(row) : null;
  }

  /**
   * Compare two versions
   */
  async diff(
    taskId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionDiff> {
    const from = await this.getVersion(taskId, fromVersion);
    const to = await this.getVersion(taskId, toVersion);

    if (!from || !to) {
      throw new Error(`Version not found for task ${taskId}`);
    }

    // Build changes as array with field property
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
    const allFields = Array.from(new Set([
      ...Object.keys(from.snapshot),
      ...Object.keys(to.snapshot),
    ]));

    for (const field of allFields) {
      const fromValue = from.snapshot[field];
      const toValue = to.snapshot[field];

      if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        changes.push({ field, from: fromValue, to: toValue });
      }
    }

    return { fromVersion, toVersion, changes };
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    input: CreateCheckpointInput,
    userId: string,
  ): Promise<TaskVersion> {
    // Get current task state
    const task = await getOne<Record<string, unknown>>(
      "SELECT * FROM tasks WHERE id = ?",
      [input.taskId],
    );

    if (!task) {
      throw new Error(`Task ${input.taskId} not found`);
    }

    // Get next version number
    const latestVersion = await this.getLatestVersion(input.taskId);
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO task_versions (id, task_id, version, snapshot, changed_fields, change_reason, is_checkpoint, checkpoint_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.taskId,
        nextVersion,
        JSON.stringify(task),
        JSON.stringify([]),
        input.reason || null,
        1, // is a checkpoint
        input.name,
        userId,
        now,
      ],
    );

    await saveDb();

    const created = await getOne<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE id = ?",
      [id],
    );
    if (!created) {
      throw new Error("Failed to create checkpoint");
    }
    return mapTaskVersionRow(created);
  }

  /**
   * Get all checkpoints for a task
   */
  async getCheckpoints(taskId: string): Promise<TaskVersion[]> {
    const rows = await query<TaskVersionRow>(
      "SELECT * FROM task_versions WHERE task_id = ? AND is_checkpoint = 1 ORDER BY version DESC",
      [taskId],
    );
    return rows.map(mapTaskVersionRow);
  }

  /**
   * Restore a task to a previous version (creates new version)
   */
  async restore(input: RestoreVersionInput, userId: string): Promise<Task> {
    const targetVersion = await this.getVersion(
      input.taskId,
      input.targetVersion,
    );
    if (!targetVersion) {
      throw new Error(
        `Version ${input.targetVersion} not found for task ${input.taskId}`,
      );
    }

    const snapshot = targetVersion.snapshot;

    // Build update query from snapshot (excluding id, created_at)
    const excludeFields = ["id", "created_at", "display_id"];
    const updateFields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(snapshot)) {
      if (!excludeFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(value as string | number | null);
      }
    }

    values.push(new Date().toISOString());
    values.push(input.taskId);

    await run(
      `UPDATE tasks SET ${updateFields.join(", ")}, updated_at = ? WHERE id = ?`,
      values,
    );

    // Create a new version for the restore
    await this.createVersion(
      input.taskId,
      Object.keys(snapshot).filter((k) => !excludeFields.includes(k)),
      input.reason || `Restored to version ${input.targetVersion}`,
      userId,
    );

    await saveDb();

    // Return updated task
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      input.taskId,
    ]);
    if (!task) {
      throw new Error("Failed to restore task");
    }
    return task;
  }

  /**
   * Preview what would change if restoring to a version
   */
  async previewRestore(
    taskId: string,
    targetVersion: number,
  ): Promise<VersionDiff> {
    const latestVersion = await this.getLatestVersion(taskId);
    if (!latestVersion) {
      throw new Error(`No versions found for task ${taskId}`);
    }
    return this.diff(taskId, latestVersion.version, targetVersion);
  }

  /**
   * Compare two versions (alias for diff)
   */
  async compareVersions(
    taskId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionDiff> {
    return this.diff(taskId, fromVersion, toVersion);
  }

  /**
   * Rollback to a previous version (alias for restore)
   */
  async rollbackToVersion(
    taskId: string,
    targetVersion: number,
    reason?: string,
    userId: string = "system",
  ): Promise<Task> {
    return this.restore(
      { taskId, targetVersion, reason },
      userId,
    );
  }
}

// Export singleton instance
export const taskVersionService = new TaskVersionService();
export default taskVersionService;
