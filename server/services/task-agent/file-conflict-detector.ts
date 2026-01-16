/**
 * File Conflict Detector
 *
 * Detects file conflicts between tasks to determine which can run in parallel.
 *
 * Conflict Matrix:
 * | Task A Op | Task B Op | Conflict? | Reason |
 * |-----------|-----------|-----------|--------|
 * | CREATE | CREATE | YES | Same file cannot be created twice |
 * | CREATE | UPDATE | NO | Different files typically |
 * | CREATE | DELETE | YES | Race condition |
 * | CREATE | READ | NO | Safe |
 * | UPDATE | UPDATE | YES | Concurrent modification |
 * | UPDATE | DELETE | YES | File may not exist |
 * | UPDATE | READ | NO | Safe (read before write) |
 * | DELETE | DELETE | YES | Double delete |
 * | DELETE | READ | YES | File may not exist |
 * | READ | READ | NO | Safe |
 *
 * Part of: PTE-049 to PTE-052
 */

import { query, getOne } from "../../../database/db.js";
import {
  FileConflict,
  FileOperation,
  ConflictType,
  TaskIdentity,
} from "../../../types/task-agent.js";

/**
 * Determine conflict type between two operations
 */
export function getConflictType(
  operationA: FileOperation,
  operationB: FileOperation,
): ConflictType {
  // Both just reading - no conflict
  if (operationA === "READ" && operationB === "READ") {
    return "no_conflict";
  }

  // One reads while other creates/updates - safe
  if (
    (operationA === "READ" &&
      (operationB === "CREATE" || operationB === "UPDATE")) ||
    (operationB === "READ" &&
      (operationA === "CREATE" || operationA === "UPDATE"))
  ) {
    return "no_conflict";
  }

  // Both create same file
  if (operationA === "CREATE" && operationB === "CREATE") {
    return "create_create";
  }

  // Both write (update or delete)
  if (
    (operationA === "UPDATE" || operationA === "DELETE") &&
    (operationB === "UPDATE" || operationB === "DELETE")
  ) {
    return "write_write";
  }

  // Create and delete - race condition
  if (
    (operationA === "CREATE" && operationB === "DELETE") ||
    (operationA === "DELETE" && operationB === "CREATE")
  ) {
    return "create_delete";
  }

  // Read and delete - file may not exist
  if (
    (operationA === "READ" && operationB === "DELETE") ||
    (operationA === "DELETE" && operationB === "READ")
  ) {
    return "read_delete";
  }

  return "no_conflict";
}

/**
 * Check if a conflict type represents an actual conflict
 */
export function isConflict(conflictType: ConflictType): boolean {
  return conflictType !== "no_conflict";
}

/**
 * Detect all file conflicts between two tasks
 *
 * @param taskAId First task ID
 * @param taskBId Second task ID
 * @returns List of file conflicts
 */
export async function detectConflicts(
  taskAId: string,
  taskBId: string,
): Promise<FileConflict[]> {
  const conflicts = await query<{
    file_path: string;
    operation_a: string;
    operation_b: string;
    confidence_a: number;
    confidence_b: number;
  }>(
    `SELECT
      fi1.file_path,
      fi1.operation AS operation_a,
      fi2.operation AS operation_b,
      fi1.confidence AS confidence_a,
      fi2.confidence AS confidence_b
    FROM task_file_impacts fi1
    JOIN task_file_impacts fi2 ON fi1.file_path = fi2.file_path
    WHERE fi1.task_id = ?
      AND fi2.task_id = ?`,
    [taskAId, taskBId],
  );

  const result: FileConflict[] = [];

  for (const row of conflicts) {
    const conflictType = getConflictType(
      row.operation_a as FileOperation,
      row.operation_b as FileOperation,
    );

    if (isConflict(conflictType)) {
      result.push({
        filePath: row.file_path,
        taskAId,
        taskBId,
        operationA: row.operation_a as FileOperation,
        operationB: row.operation_b as FileOperation,
        conflictType,
        confidenceA: row.confidence_a,
        confidenceB: row.confidence_b,
      });
    }
  }

  return result;
}

/**
 * Check if two tasks can run in parallel
 *
 * @param taskAId First task ID
 * @param taskBId Second task ID
 * @returns true if tasks can run in parallel
 */
export async function canRunParallel(
  taskAId: string,
  taskBId: string,
): Promise<boolean> {
  // Check for dependency relationship
  const hasDependency = await getOne<{ found: number }>(
    `SELECT 1 AS found
     FROM task_relationships
     WHERE ((source_task_id = ? AND target_task_id = ?)
        OR (source_task_id = ? AND target_task_id = ?))
       AND relationship_type = 'depends_on'
     LIMIT 1`,
    [taskAId, taskBId, taskBId, taskAId],
  );

  if (hasDependency?.found) {
    return false; // Dependencies prevent parallel execution
  }

  // Check for file conflicts
  const conflicts = await detectConflicts(taskAId, taskBId);

  // Only consider high-confidence conflicts
  const significantConflicts = conflicts.filter(
    (c) => c.confidenceA >= 0.6 && c.confidenceB >= 0.6,
  );

  return significantConflicts.length === 0;
}

/**
 * Get detailed conflict information between two tasks
 */
export async function getConflictDetails(
  taskAId: string,
  taskBId: string,
): Promise<{
  canRunParallel: boolean;
  hasDependency: boolean;
  dependencyDirection?: "a_depends_on_b" | "b_depends_on_a";
  fileConflicts: FileConflict[];
  conflictSummary: string;
}> {
  // Check for dependency
  const dependencyCheck = await getOne<{
    source_task_id: string;
    target_task_id: string;
  }>(
    `SELECT source_task_id, target_task_id
     FROM task_relationships
     WHERE ((source_task_id = ? AND target_task_id = ?)
        OR (source_task_id = ? AND target_task_id = ?))
       AND relationship_type = 'depends_on'
     LIMIT 1`,
    [taskAId, taskBId, taskBId, taskAId],
  );

  const hasDependency = !!dependencyCheck;
  let dependencyDirection: "a_depends_on_b" | "b_depends_on_a" | undefined;
  if (dependencyCheck) {
    dependencyDirection =
      dependencyCheck.source_task_id === taskAId
        ? "a_depends_on_b"
        : "b_depends_on_a";
  }

  // Get file conflicts
  const fileConflicts = await detectConflicts(taskAId, taskBId);

  // Generate summary
  let conflictSummary = "";
  if (hasDependency) {
    conflictSummary =
      dependencyDirection === "a_depends_on_b"
        ? "Task A depends on Task B - must run sequentially"
        : "Task B depends on Task A - must run sequentially";
  } else if (fileConflicts.length > 0) {
    const highConfidenceCount = fileConflicts.filter(
      (c) => c.confidenceA >= 0.6 && c.confidenceB >= 0.6,
    ).length;
    if (highConfidenceCount > 0) {
      conflictSummary = `${highConfidenceCount} file conflict(s) detected - recommend sequential execution`;
    } else {
      conflictSummary = `${fileConflicts.length} potential file conflict(s) with low confidence - parallel may be possible`;
    }
  } else {
    conflictSummary = "No conflicts detected - safe to run in parallel";
  }

  // Determine if can run parallel
  const significantConflicts = fileConflicts.filter(
    (c) => c.confidenceA >= 0.6 && c.confidenceB >= 0.6,
  );
  const canRun = !hasDependency && significantConflicts.length === 0;

  return {
    canRunParallel: canRun,
    hasDependency,
    dependencyDirection,
    fileConflicts,
    conflictSummary,
  };
}

/**
 * Find all potential conflicts within a task list
 *
 * @param taskListId Task list ID
 * @returns List of task pairs with conflicts
 */
export async function findConflictsInTaskList(taskListId: string): Promise<
  Array<{
    taskAId: string;
    taskADisplayId: string;
    taskBId: string;
    taskBDisplayId: string;
    conflicts: FileConflict[];
  }>
> {
  // Get all pending tasks in the list
  const tasks = await query<{ id: string; display_id: string }>(
    `SELECT id, display_id
     FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')
     ORDER BY position`,
    [taskListId],
  );

  const results: Array<{
    taskAId: string;
    taskADisplayId: string;
    taskBId: string;
    taskBDisplayId: string;
    conflicts: FileConflict[];
  }> = [];

  // Check each pair
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const conflicts = await detectConflicts(tasks[i].id, tasks[j].id);
      if (conflicts.length > 0) {
        results.push({
          taskAId: tasks[i].id,
          taskADisplayId: tasks[i].display_id,
          taskBId: tasks[j].id,
          taskBDisplayId: tasks[j].display_id,
          conflicts,
        });
      }
    }
  }

  return results;
}

/**
 * Get tasks that conflict with a specific task
 */
export async function getConflictingTasks(
  taskId: string,
): Promise<Array<TaskIdentity & { conflicts: FileConflict[] }>> {
  // Get task's task list
  const task = await getOne<{ task_list_id: string | null }>(
    "SELECT task_list_id FROM tasks WHERE id = ?",
    [taskId],
  );

  if (!task?.task_list_id) {
    return [];
  }

  // Get other tasks in same list
  const otherTasks = await query<{ id: string; display_id: string }>(
    `SELECT id, display_id
     FROM tasks
     WHERE task_list_id = ?
       AND id != ?
       AND status IN ('pending', 'evaluating')`,
    [task.task_list_id, taskId],
  );

  const results: Array<TaskIdentity & { conflicts: FileConflict[] }> = [];

  for (const otherTask of otherTasks) {
    const conflicts = await detectConflicts(taskId, otherTask.id);
    if (conflicts.length > 0) {
      results.push({
        id: otherTask.id,
        displayId: otherTask.display_id,
        conflicts,
      });
    }
  }

  return results;
}

/**
 * Calculate a conflict severity score (0-1)
 */
export function calculateConflictSeverity(conflicts: FileConflict[]): number {
  if (conflicts.length === 0) {
    return 0;
  }

  // Weight by conflict type and confidence
  const severityWeights: Record<ConflictType, number> = {
    create_create: 1.0,
    write_write: 0.9,
    create_delete: 0.95,
    read_delete: 0.7,
    no_conflict: 0,
  };

  let totalSeverity = 0;
  for (const conflict of conflicts) {
    const baseWeight = severityWeights[conflict.conflictType];
    const confidenceWeight = Math.min(
      conflict.confidenceA,
      conflict.confidenceB,
    );
    totalSeverity += baseWeight * confidenceWeight;
  }

  // Normalize to 0-1 range (cap at 1)
  return Math.min(1, totalSeverity / conflicts.length);
}

export default {
  getConflictType,
  isConflict,
  detectConflicts,
  canRunParallel,
  getConflictDetails,
  findConflictsInTaskList,
  getConflictingTasks,
  calculateConflictSeverity,
};
