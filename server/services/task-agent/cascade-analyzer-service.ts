/**
 * Cascade Analyzer Service
 *
 * Analyzes cascade effects when tasks change.
 * Part of: Task System V2 Implementation Plan (IMPL-3.8)
 */

import { query, getOne } from "../../../database/db.js";
import {
  CascadeAnalysis,
  CascadeEffect,
  CascadeTrigger,
  CascadeSuggestedAction,
} from "../../../types/cascade.js";
import { TaskImpact, ImpactConflict } from "../../../types/task-impact.js";
import { TaskImpactRow } from "../../../types/task-impact.js";

/**
 * Cascade Analyzer Service class
 */
export class CascadeAnalyzerService {
  private maxDepth: number = 3;

  /**
   * Analyze cascade effects for a task change
   */
  async analyze(
    taskId: string,
    changeType: CascadeTrigger,
    changes: Record<string, unknown>,
  ): Promise<CascadeAnalysis> {
    // Find directly affected tasks
    const directEffects = await this.findDirectlyAffected(taskId, changeType);

    // Find transitively affected tasks
    const transitiveEffects = await this.findTransitivelyAffected(
      directEffects,
      this.maxDepth,
    );

    // Check if task list has auto-approve enabled
    const taskListAutoApprove = await this.checkAutoApprove(taskId);

    // Count tasks requiring review vs auto-approvable
    const requiresReview = [...directEffects, ...transitiveEffects].filter(
      (e) => !e.autoApprovable,
    ).length;
    const autoApprovable = [...directEffects, ...transitiveEffects].filter(
      (e) => e.autoApprovable,
    ).length;

    return {
      sourceTaskId: taskId,
      changeType,
      directEffects,
      transitiveEffects,
      totalAffected: directEffects.length + transitiveEffects.length,
      requiresReview,
      autoApprovable,
      taskListAutoApprove,
    };
  }

  /**
   * Find tasks directly affected by a change
   */
  async findDirectlyAffected(
    taskId: string,
    changeType: CascadeTrigger,
  ): Promise<CascadeEffect[]> {
    const effects: CascadeEffect[] = [];

    // Get the source task
    const sourceTask = await getOne<{
      task_list_id: string;
      display_id: string;
    }>("SELECT task_list_id, display_id FROM tasks WHERE id = ?", [taskId]);

    if (!sourceTask) {
      return effects;
    }

    // Find tasks that depend on this task
    const dependentTasks = await query<{
      source_task_id: string;
      display_id: string;
      title: string;
    }>(
      `SELECT t.id as source_task_id, t.display_id, t.title FROM tasks t
       INNER JOIN task_relationships tr ON t.id = tr.source_task_id
       WHERE tr.target_task_id = ? AND tr.relationship_type = 'depends_on'`,
      [taskId],
    );

    for (const task of dependentTasks) {
      effects.push({
        affectedTaskId: task.source_task_id,
        affectedTaskDisplayId: task.display_id || task.source_task_id,
        trigger: changeType,
        reason: `Depends on changed task`,
        impactType: "direct",
        depth: 1,
        suggestedAction: this.determineSuggestedAction(changeType),
        autoApprovable: this.isAutoApprovable(changeType),
      });
    }

    // For file impact changes, find tasks with overlapping file impacts
    if (changeType.includes("impact_changed")) {
      const sourceImpacts = await query<TaskImpactRow>(
        "SELECT * FROM task_impacts WHERE task_id = ?",
        [taskId],
      );

      const overlappingTasks = await this.findOverlappingTasks(
        taskId,
        sourceImpacts,
      );
      for (const task of overlappingTasks) {
        if (!effects.find((e) => e.affectedTaskId === task.taskId)) {
          effects.push({
            affectedTaskId: task.taskId,
            affectedTaskDisplayId: task.displayId,
            trigger: changeType,
            reason: `Has overlapping ${task.impactType} impacts on ${task.targetPath}`,
            impactType: "direct",
            depth: 1,
            suggestedAction: "review",
            autoApprovable: false,
          });
        }
      }
    }

    return effects;
  }

  /**
   * Find transitively affected tasks
   */
  async findTransitivelyAffected(
    directEffects: CascadeEffect[],
    maxDepth: number = 3,
  ): Promise<CascadeEffect[]> {
    const transitiveEffects: CascadeEffect[] = [];
    const visited = new Set<string>(directEffects.map((e) => e.affectedTaskId));
    let currentLevel = directEffects;
    let depth = 2;

    while (depth <= maxDepth && currentLevel.length > 0) {
      const nextLevel: CascadeEffect[] = [];

      for (const effect of currentLevel) {
        // Find tasks that depend on the affected task
        const dependentTasks = await query<{
          source_task_id: string;
          display_id: string;
        }>(
          `SELECT t.id as source_task_id, t.display_id FROM tasks t
           INNER JOIN task_relationships tr ON t.id = tr.source_task_id
           WHERE tr.target_task_id = ? AND tr.relationship_type = 'depends_on'`,
          [effect.affectedTaskId],
        );

        for (const task of dependentTasks) {
          if (!visited.has(task.source_task_id)) {
            visited.add(task.source_task_id);
            const newEffect: CascadeEffect = {
              affectedTaskId: task.source_task_id,
              affectedTaskDisplayId: task.display_id || task.source_task_id,
              trigger: effect.trigger,
              reason: `Transitively affected through ${effect.affectedTaskDisplayId}`,
              impactType: "transitive",
              depth,
              suggestedAction: "notify",
              autoApprovable: true,
            };
            nextLevel.push(newEffect);
            transitiveEffects.push(newEffect);
          }
        }
      }

      currentLevel = nextLevel;
      depth++;
    }

    return transitiveEffects;
  }

  /**
   * Detect file conflicts with new impacts
   */
  async detectFileConflicts(
    taskId: string,
    newImpacts: TaskImpact[],
  ): Promise<ImpactConflict[]> {
    const conflicts: ImpactConflict[] = [];

    for (const impact of newImpacts) {
      // Find other tasks with impacts on the same target
      const overlapping = await query<{
        task_id: string;
        operation: string;
        impact_type: string;
      }>(
        `SELECT task_id, operation, impact_type FROM task_impacts
         WHERE target_path = ? AND task_id != ?`,
        [impact.targetPath, taskId],
      );

      for (const other of overlapping) {
        const conflictType = this.getConflictType(
          impact.operation,
          other.operation as any,
        );
        if (conflictType) {
          conflicts.push({
            taskAId: taskId,
            taskBId: other.task_id,
            conflictType,
            targetPath: impact.targetPath,
            severity: conflictType === "delete-read" ? "blocking" : "warning",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if task list has auto-approve enabled
   */
  async checkAutoApprove(taskId: string): Promise<boolean> {
    const result = await getOne<{ auto_approve_reviews: number }>(
      `SELECT tl.auto_approve_reviews FROM task_lists_v2 tl
       INNER JOIN tasks t ON t.task_list_id = tl.id
       WHERE t.id = ?`,
      [taskId],
    );
    return result?.auto_approve_reviews === 1;
  }

  /**
   * Find tasks with overlapping impacts
   */
  private async findOverlappingTasks(
    taskId: string,
    sourceImpacts: TaskImpactRow[],
  ): Promise<
    {
      taskId: string;
      displayId: string;
      impactType: string;
      targetPath: string;
    }[]
  > {
    const overlapping: {
      taskId: string;
      displayId: string;
      impactType: string;
      targetPath: string;
    }[] = [];

    for (const impact of sourceImpacts) {
      const tasks = await query<{
        task_id: string;
        display_id: string;
        impact_type: string;
      }>(
        `SELECT DISTINCT ti.task_id, t.display_id, ti.impact_type
         FROM task_impacts ti
         INNER JOIN tasks t ON t.id = ti.task_id
         WHERE ti.target_path = ? AND ti.task_id != ?`,
        [impact.target_path, taskId],
      );

      for (const task of tasks) {
        if (!overlapping.find((o) => o.taskId === task.task_id)) {
          overlapping.push({
            taskId: task.task_id,
            displayId: task.display_id || task.task_id,
            impactType: task.impact_type,
            targetPath: impact.target_path,
          });
        }
      }
    }

    return overlapping;
  }

  /**
   * Determine the conflict type between two operations
   */
  private getConflictType(
    opA: string,
    opB: string,
  ): "write-write" | "write-delete" | "delete-delete" | "delete-read" | null {
    const writeOps = ["CREATE", "UPDATE"];
    const isWriteA = writeOps.includes(opA);
    const isWriteB = writeOps.includes(opB);

    if (opA === "DELETE" && opB === "DELETE") {
      return "delete-delete";
    }
    if (opA === "DELETE" && opB === "READ") {
      return "delete-read";
    }
    if (opB === "DELETE" && opA === "READ") {
      return "delete-read";
    }
    if ((opA === "DELETE" && isWriteB) || (opB === "DELETE" && isWriteA)) {
      return "write-delete";
    }
    if (isWriteA && isWriteB) {
      return "write-write";
    }

    return null;
  }

  /**
   * Determine suggested action based on trigger type
   */
  private determineSuggestedAction(
    trigger: CascadeTrigger,
  ): CascadeSuggestedAction {
    switch (trigger) {
      case "status_changed":
        return "notify";
      case "priority_changed":
        return "auto_update";
      case "dependency_changed":
        return "review";
      default:
        return "review";
    }
  }

  /**
   * Determine if change is auto-approvable
   */
  private isAutoApprovable(trigger: CascadeTrigger): boolean {
    return trigger === "status_changed" || trigger === "priority_changed";
  }
}

// Export singleton instance
export const cascadeAnalyzerService = new CascadeAnalyzerService();
export default cascadeAnalyzerService;
