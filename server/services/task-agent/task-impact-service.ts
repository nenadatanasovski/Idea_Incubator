/**
 * Task Impact Service
 *
 * CRUD operations for task impacts (file, api, function, database, type).
 * Part of: Task System V2 Implementation Plan (IMPL-3.1)
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, getOne, saveDb } from '../../../database/db.js';
import {
  TaskImpact,
  CreateTaskImpactInput,
  UpdateTaskImpactInput,
  ImpactType,
  ImpactSource,
  TaskImpactRow,
  mapTaskImpactRow,
} from '../../../types/task-impact.js';

/**
 * Task Impact Service class
 */
export class TaskImpactService {
  /**
   * Create a new task impact
   */
  async create(input: CreateTaskImpactInput): Promise<TaskImpact> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO task_impacts (id, task_id, impact_type, operation, target_path, target_name, target_signature, confidence, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.taskId,
        input.impactType,
        input.operation,
        input.targetPath,
        input.targetName || null,
        input.targetSignature || null,
        input.confidence ?? 0.7,
        input.source ?? 'ai',
        now,
        now,
      ]
    );

    await saveDb();

    const created = await this.getById(id);
    if (!created) {
      throw new Error('Failed to create task impact');
    }
    return created;
  }

  /**
   * Get impact by ID
   */
  async getById(id: string): Promise<TaskImpact | null> {
    const row = await getOne<TaskImpactRow>(
      'SELECT * FROM task_impacts WHERE id = ?',
      [id]
    );
    return row ? mapTaskImpactRow(row) : null;
  }

  /**
   * Get all impacts for a task
   */
  async getByTaskId(taskId: string): Promise<TaskImpact[]> {
    const rows = await query<TaskImpactRow>(
      'SELECT * FROM task_impacts WHERE task_id = ? ORDER BY impact_type, target_path',
      [taskId]
    );
    return rows.map(mapTaskImpactRow);
  }

  /**
   * Update an impact
   */
  async update(id: string, updates: UpdateTaskImpactInput): Promise<TaskImpact> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Task impact ${id} not found`);
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.impactType !== undefined) {
      fields.push('impact_type = ?');
      values.push(updates.impactType);
    }
    if (updates.operation !== undefined) {
      fields.push('operation = ?');
      values.push(updates.operation);
    }
    if (updates.targetPath !== undefined) {
      fields.push('target_path = ?');
      values.push(updates.targetPath);
    }
    if (updates.targetName !== undefined) {
      fields.push('target_name = ?');
      values.push(updates.targetName);
    }
    if (updates.targetSignature !== undefined) {
      fields.push('target_signature = ?');
      values.push(updates.targetSignature);
    }
    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }
    if (updates.source !== undefined) {
      fields.push('source = ?');
      values.push(updates.source);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      await run(
        `UPDATE task_impacts SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      await saveDb();
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update task impact');
    }
    return updated;
  }

  /**
   * Delete an impact
   */
  async delete(id: string): Promise<void> {
    await run('DELETE FROM task_impacts WHERE id = ?', [id]);
    await saveDb();
  }

  /**
   * Delete all impacts for a task
   */
  async deleteByTaskId(taskId: string): Promise<void> {
    await run('DELETE FROM task_impacts WHERE task_id = ?', [taskId]);
    await saveDb();
  }

  /**
   * Create multiple impacts at once
   */
  async createBulk(taskId: string, impacts: Omit<CreateTaskImpactInput, 'taskId'>[]): Promise<TaskImpact[]> {
    const results: TaskImpact[] = [];
    for (const impact of impacts) {
      const created = await this.create({ ...impact, taskId });
      results.push(created);
    }
    return results;
  }

  /**
   * Replace all impacts for a task
   */
  async replaceAll(taskId: string, impacts: Omit<CreateTaskImpactInput, 'taskId'>[]): Promise<TaskImpact[]> {
    await this.deleteByTaskId(taskId);
    return this.createBulk(taskId, impacts);
  }

  /**
   * Get impacts by target path
   */
  async getByTargetPath(targetPath: string): Promise<TaskImpact[]> {
    const rows = await query<TaskImpactRow>(
      'SELECT * FROM task_impacts WHERE target_path = ? ORDER BY task_id',
      [targetPath]
    );
    return rows.map(mapTaskImpactRow);
  }

  /**
   * Get impacts by type
   */
  async getByImpactType(impactType: ImpactType): Promise<TaskImpact[]> {
    const rows = await query<TaskImpactRow>(
      'SELECT * FROM task_impacts WHERE impact_type = ? ORDER BY target_path',
      [impactType]
    );
    return rows.map(mapTaskImpactRow);
  }

  /**
   * Validate actual impact against predictions
   */
  async validateActualImpact(taskId: string, actualFiles: string[]): Promise<void> {
    const impacts = await this.getByTaskId(taskId);
    const actualSet = new Set(actualFiles);

    for (const impact of impacts) {
      if (impact.impactType === 'file') {
        const wasAccurate = actualSet.has(impact.targetPath);
        await this.updateConfidence(
          impact.id,
          wasAccurate ? Math.min(1, impact.confidence + 0.1) : Math.max(0, impact.confidence - 0.2),
          'validated'
        );
      }
    }
  }

  /**
   * Update confidence for an impact
   */
  async updateConfidence(id: string, newConfidence: number, source: ImpactSource): Promise<void> {
    await run(
      `UPDATE task_impacts SET confidence = ?, source = ?, updated_at = ? WHERE id = ?`,
      [newConfidence, source, new Date().toISOString(), id]
    );
    await saveDb();
  }
}

// Export singleton instance
export const taskImpactService = new TaskImpactService();
export default taskImpactService;
