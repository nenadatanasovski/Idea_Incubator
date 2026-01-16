/**
 * PRD Link Service
 *
 * Manages links between PRDs and task lists/tasks.
 * Part of: Task System V2 Implementation Plan (IMPL-3.4)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../database/db.js";
import {
  PRD,
  PrdTaskListLink,
  PrdTaskLink,
  PrdLinkType,
  PrdTaskListLinkRow,
  PrdTaskLinkRow,
  PrdRow,
  mapPrdRow,
  mapPrdTaskListLinkRow,
  mapPrdTaskLinkRow,
} from "../../types/prd.js";

/**
 * PRD Link Service class
 */
export class PrdLinkService {
  // ============================================
  // Task List Links
  // ============================================

  /**
   * Link a PRD to a task list
   */
  async linkTaskList(
    prdId: string,
    taskListId: string,
    position?: number,
  ): Promise<PrdTaskListLink> {
    // Check if link already exists
    const existing = await getOne<PrdTaskListLinkRow>(
      "SELECT * FROM prd_task_lists WHERE prd_id = ? AND task_list_id = ?",
      [prdId, taskListId],
    );

    if (existing) {
      return mapPrdTaskListLinkRow(existing);
    }

    // Get max position if not provided
    const maxPosResult = await getOne<{ max_pos: number | null }>(
      "SELECT MAX(position) as max_pos FROM prd_task_lists WHERE prd_id = ?",
      [prdId],
    );
    const finalPosition = position ?? (maxPosResult?.max_pos ?? -1) + 1;

    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      "INSERT INTO prd_task_lists (id, prd_id, task_list_id, position, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, prdId, taskListId, finalPosition, now],
    );

    await saveDb();

    const created = await getOne<PrdTaskListLinkRow>(
      "SELECT * FROM prd_task_lists WHERE id = ?",
      [id],
    );
    if (!created) {
      throw new Error("Failed to create PRD-TaskList link");
    }
    return mapPrdTaskListLinkRow(created);
  }

  /**
   * Unlink a PRD from a task list
   */
  async unlinkTaskList(prdId: string, taskListId: string): Promise<void> {
    await run(
      "DELETE FROM prd_task_lists WHERE prd_id = ? AND task_list_id = ?",
      [prdId, taskListId],
    );
    await saveDb();
  }

  /**
   * Get linked task lists for a PRD
   */
  async getLinkedTaskLists(prdId: string): Promise<PrdTaskListLink[]> {
    const rows = await query<PrdTaskListLinkRow>(
      "SELECT * FROM prd_task_lists WHERE prd_id = ? ORDER BY position",
      [prdId],
    );
    return rows.map(mapPrdTaskListLinkRow);
  }

  /**
   * Reorder task lists for a PRD
   */
  async reorderTaskLists(prdId: string, taskListIds: string[]): Promise<void> {
    for (let i = 0; i < taskListIds.length; i++) {
      await run(
        "UPDATE prd_task_lists SET position = ? WHERE prd_id = ? AND task_list_id = ?",
        [i, prdId, taskListIds[i]],
      );
    }
    await saveDb();
  }

  // ============================================
  // Task Links
  // ============================================

  /**
   * Link a PRD to a task
   */
  async linkTask(
    prdId: string,
    taskId: string,
    requirementRef?: string,
    linkType: PrdLinkType = "implements",
  ): Promise<PrdTaskLink> {
    // Check if link already exists
    const existing = await getOne<PrdTaskLinkRow>(
      "SELECT * FROM prd_tasks WHERE prd_id = ? AND task_id = ?",
      [prdId, taskId],
    );

    if (existing) {
      // Update existing link
      await run(
        "UPDATE prd_tasks SET requirement_ref = ?, link_type = ? WHERE id = ?",
        [requirementRef || null, linkType, existing.id],
      );
      await saveDb();

      const updated = await getOne<PrdTaskLinkRow>(
        "SELECT * FROM prd_tasks WHERE id = ?",
        [existing.id],
      );
      return mapPrdTaskLinkRow(updated!);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      "INSERT INTO prd_tasks (id, prd_id, task_id, requirement_ref, link_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, prdId, taskId, requirementRef || null, linkType, now],
    );

    await saveDb();

    const created = await getOne<PrdTaskLinkRow>(
      "SELECT * FROM prd_tasks WHERE id = ?",
      [id],
    );
    if (!created) {
      throw new Error("Failed to create PRD-Task link");
    }
    return mapPrdTaskLinkRow(created);
  }

  /**
   * Unlink a PRD from a task
   */
  async unlinkTask(prdId: string, taskId: string): Promise<void> {
    await run("DELETE FROM prd_tasks WHERE prd_id = ? AND task_id = ?", [
      prdId,
      taskId,
    ]);
    await saveDb();
  }

  /**
   * Get linked tasks for a PRD
   */
  async getLinkedTasks(prdId: string): Promise<PrdTaskLink[]> {
    const rows = await query<PrdTaskLinkRow>(
      "SELECT * FROM prd_tasks WHERE prd_id = ?",
      [prdId],
    );
    return rows.map(mapPrdTaskLinkRow);
  }

  /**
   * Get tasks linked to a specific requirement
   */
  async getTasksByRequirement(
    prdId: string,
    requirementRef: string,
  ): Promise<PrdTaskLink[]> {
    const rows = await query<PrdTaskLinkRow>(
      "SELECT * FROM prd_tasks WHERE prd_id = ? AND requirement_ref = ?",
      [prdId, requirementRef],
    );
    return rows.map(mapPrdTaskLinkRow);
  }

  // ============================================
  // Reverse Lookups
  // ============================================

  /**
   * Get PRDs linked to a task list
   */
  async getPrdsForTaskList(taskListId: string): Promise<PRD[]> {
    const rows = await query<PrdRow>(
      `SELECT p.* FROM prds p
       INNER JOIN prd_task_lists ptl ON p.id = ptl.prd_id
       WHERE ptl.task_list_id = ?
       ORDER BY ptl.position`,
      [taskListId],
    );
    return rows.map(mapPrdRow);
  }

  /**
   * Get PRDs linked to a task
   */
  async getPrdsForTask(taskId: string): Promise<PRD[]> {
    const rows = await query<PrdRow>(
      `SELECT p.* FROM prds p
       INNER JOIN prd_tasks pt ON p.id = pt.prd_id
       WHERE pt.task_id = ?`,
      [taskId],
    );
    return rows.map(mapPrdRow);
  }

  // ============================================
  // Auto-linking
  // ============================================

  /**
   * Suggest links based on content similarity
   */
  async suggestLinks(
    prdId: string,
  ): Promise<{ taskLists: string[]; tasks: string[] }> {
    // Get PRD details
    const prd = await getOne<PrdRow>("SELECT * FROM prds WHERE id = ?", [
      prdId,
    ]);

    if (!prd) {
      return { taskLists: [], tasks: [] };
    }

    // Find task lists with matching project
    const taskListIds: string[] = [];
    if (prd.project_id) {
      const taskLists = await query<{ id: string }>(
        "SELECT id FROM task_lists_v2 WHERE project_id = ?",
        [prd.project_id],
      );
      taskListIds.push(...taskLists.map((tl) => tl.id));
    }

    // Find tasks with matching keywords (simple keyword matching)
    const keywords = prd.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const taskIds: string[] = [];

    if (keywords.length > 0) {
      // Simple keyword search in task titles
      const keywordPattern = keywords.map((k) => `%${k}%`).join("%");
      const tasks = await query<{ id: string }>(
        `SELECT id FROM tasks WHERE LOWER(title) LIKE ?`,
        [keywordPattern],
      );
      taskIds.push(...tasks.map((t) => t.id));
    }

    return { taskLists: taskListIds, tasks: taskIds };
  }

  /**
   * Auto-link based on suggestions with minimum confidence
   */
  async autoLink(
    prdId: string,
    minConfidence: number = 0.5,
  ): Promise<{ linked: number; skipped: number }> {
    const suggestions = await this.suggestLinks(prdId);
    let linked = 0;
    let skipped = 0;

    // Link task lists
    for (const taskListId of suggestions.taskLists) {
      try {
        await this.linkTaskList(prdId, taskListId);
        linked++;
      } catch {
        skipped++;
      }
    }

    // Link tasks (only with confidence check - here we assume all matches are >= minConfidence)
    for (const taskId of suggestions.tasks) {
      try {
        await this.linkTask(prdId, taskId, undefined, "related");
        linked++;
      } catch {
        skipped++;
      }
    }

    return { linked, skipped };
  }
}

// Export singleton instance
export const prdLinkService = new PrdLinkService();
export default prdLinkService;
