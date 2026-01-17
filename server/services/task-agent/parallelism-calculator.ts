/**
 * Parallelism Calculator
 *
 * Analyzes task lists to determine which tasks can run in parallel
 * and groups them into execution waves.
 *
 * Part of: PTE-053 to PTE-057
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  ParallelismAnalysis,
  ExecutionWave,
  TaskListParallelism,
  TaskIdentity,
} from "../../../types/task-agent.js";
import {
  canRunParallel,
  getConflictDetails,
} from "./file-conflict-detector.js";

/**
 * Database row for parallelism analysis
 */
interface ParallelismAnalysisRow {
  id: string;
  task_a_id: string;
  task_b_id: string;
  can_parallel: number;
  conflict_type: string | null;
  conflict_details: string | null;
  analyzed_at: string;
  invalidated_at: string | null;
}

/**
 * Map database row to ParallelismAnalysis object
 */
function mapAnalysisRow(row: ParallelismAnalysisRow): ParallelismAnalysis {
  return {
    id: row.id,
    taskAId: row.task_a_id,
    taskBId: row.task_b_id,
    canParallel: row.can_parallel === 1,
    conflictType: row.conflict_type as ParallelismAnalysis["conflictType"],
    conflictDetails: row.conflict_details
      ? JSON.parse(row.conflict_details)
      : undefined,
    analyzedAt: row.analyzed_at,
    invalidatedAt: row.invalidated_at || undefined,
  };
}

/**
 * Analyze parallelism for all task pairs in a task list
 *
 * @param taskListId Task list to analyze
 * @param forceReanalyze Force re-analysis even if cached
 */
export async function analyzeParallelism(
  taskListId: string,
  forceReanalyze = false,
): Promise<ParallelismAnalysis[]> {
  // Get all pending tasks in the list
  const tasks = await query<{ id: string; display_id: string }>(
    `SELECT id, display_id
     FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')
     ORDER BY position`,
    [taskListId],
  );

  const analyses: ParallelismAnalysis[] = [];

  // Analyze each pair
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const taskAId = tasks[i].id;
      const taskBId = tasks[j].id;

      // Check cache unless forcing re-analysis
      if (!forceReanalyze) {
        const cached = await getOne<ParallelismAnalysisRow>(
          `SELECT * FROM parallelism_analysis
           WHERE task_a_id = ? AND task_b_id = ?
             AND invalidated_at IS NULL`,
          [taskAId, taskBId],
        );

        if (cached) {
          analyses.push(mapAnalysisRow(cached));
          continue;
        }
      }

      // Perform analysis
      const analysis = await analyzeTaskPair(taskAId, taskBId);
      analyses.push(analysis);
    }
  }

  return analyses;
}

/**
 * Analyze parallelism between two specific tasks
 */
export async function analyzeTaskPair(
  taskAId: string,
  taskBId: string,
): Promise<ParallelismAnalysis> {
  // Ensure consistent ordering
  const [orderedA, orderedB] =
    taskAId < taskBId ? [taskAId, taskBId] : [taskBId, taskAId];

  // Get conflict details
  const details = await getConflictDetails(orderedA, orderedB);

  // Create analysis record
  const id = uuidv4();
  const analysis: ParallelismAnalysis = {
    id,
    taskAId: orderedA,
    taskBId: orderedB,
    canParallel: details.canRunParallel,
    conflictType: details.hasDependency
      ? "dependency"
      : details.fileConflicts.length > 0
        ? "file_conflict"
        : undefined,
    conflictDetails: details.hasDependency
      ? { dependencyChain: [details.dependencyDirection || ""] }
      : details.fileConflicts.length > 0
        ? { conflictingFiles: details.fileConflicts }
        : undefined,
    analyzedAt: new Date().toISOString(),
  };

  // Save to database (upsert)
  await run(
    `INSERT INTO parallelism_analysis (id, task_a_id, task_b_id, can_parallel, conflict_type, conflict_details, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_a_id, task_b_id) DO UPDATE SET
       can_parallel = excluded.can_parallel,
       conflict_type = excluded.conflict_type,
       conflict_details = excluded.conflict_details,
       analyzed_at = excluded.analyzed_at,
       invalidated_at = NULL`,
    [
      analysis.id,
      analysis.taskAId,
      analysis.taskBId,
      analysis.canParallel ? 1 : 0,
      analysis.conflictType || null,
      analysis.conflictDetails
        ? JSON.stringify(analysis.conflictDetails)
        : null,
      analysis.analyzedAt,
    ],
  );

  await saveDb();

  return analysis;
}

/**
 * Calculate execution waves for a task list
 *
 * Wave 1: Tasks with no unmet dependencies
 * Wave N: Tasks whose dependencies are all in waves 1 to N-1
 *
 * @param taskListId Task list ID
 */
export async function calculateWaves(
  taskListId: string,
): Promise<ExecutionWave[]> {
  // Get all pending tasks
  const tasks = await query<{
    id: string;
    display_id: string;
    position: number;
  }>(
    `SELECT id, display_id, position
     FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')
     ORDER BY position`,
    [taskListId],
  );

  if (tasks.length === 0) {
    return [];
  }

  // Get dependencies
  const dependencies = await query<{
    source_task_id: string;
    target_task_id: string;
  }>(
    `SELECT tr.source_task_id, tr.target_task_id
     FROM task_relationships tr
     JOIN tasks t1 ON tr.source_task_id = t1.id
     JOIN tasks t2 ON tr.target_task_id = t2.id
     WHERE t1.task_list_id = ?
       AND t2.task_list_id = ?
       AND tr.relationship_type = 'depends_on'
       AND t1.status IN ('pending', 'evaluating')
       AND t2.status NOT IN ('completed', 'skipped')`,
    [taskListId, taskListId],
  );

  // Build dependency map: taskId -> set of task IDs it depends on
  const dependsOn: Map<string, Set<string>> = new Map();
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const dep of dependencies) {
    if (taskIds.has(dep.source_task_id) && taskIds.has(dep.target_task_id)) {
      if (!dependsOn.has(dep.source_task_id)) {
        dependsOn.set(dep.source_task_id, new Set());
      }
      dependsOn.get(dep.source_task_id)!.add(dep.target_task_id);
    }
  }

  // Get parallelism analyses
  const analyses = await analyzeParallelism(taskListId);
  const canRunParallelMap: Map<string, boolean> = new Map();
  for (const analysis of analyses) {
    const key = `${analysis.taskAId}:${analysis.taskBId}`;
    canRunParallelMap.set(key, analysis.canParallel);
  }

  // Calculate waves
  const waves: ExecutionWave[] = [];
  const assignedTasks = new Set<string>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let waveNumber = 0;

  while (assignedTasks.size < tasks.length) {
    waveNumber++;
    const waveTaskIds: string[] = [];

    // Find tasks that can be in this wave
    for (const task of tasks) {
      if (assignedTasks.has(task.id)) {
        continue;
      }

      // Check if all dependencies are satisfied (in previous waves)
      const deps = dependsOn.get(task.id) || new Set();
      const unsatisfiedDeps = Array.from(deps).filter(
        (depId) => !assignedTasks.has(depId),
      );

      if (unsatisfiedDeps.length > 0) {
        continue;
      }

      // Check if this task conflicts with any other task in this wave
      let hasConflictInWave = false;
      for (const existingTaskId of waveTaskIds) {
        const key =
          task.id < existingTaskId
            ? `${task.id}:${existingTaskId}`
            : `${existingTaskId}:${task.id}`;
        const canParallel = canRunParallelMap.get(key);

        if (canParallel === false) {
          hasConflictInWave = true;
          break;
        }
      }

      if (!hasConflictInWave) {
        waveTaskIds.push(task.id);
      }
    }

    // If no tasks can be added, break (shouldn't happen unless there's a cycle)
    if (waveTaskIds.length === 0) {
      console.warn(
        "[ParallelismCalculator] No tasks could be added to wave - possible cycle",
      );
      break;
    }

    // Create wave
    const wave: ExecutionWave = {
      id: uuidv4(),
      taskListId,
      waveNumber,
      status: "pending",
      taskCount: waveTaskIds.length,
      completedCount: 0,
      failedCount: 0,
      tasks: waveTaskIds.map((id) => ({
        id,
        displayId: taskMap.get(id)!.display_id,
      })),
    };

    waves.push(wave);

    // Mark tasks as assigned
    for (const id of waveTaskIds) {
      assignedTasks.add(id);
    }
  }

  // Save waves to database
  for (const wave of waves) {
    await run(
      `INSERT INTO parallel_execution_waves (id, task_list_id, wave_number, status, task_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(task_list_id, wave_number) DO UPDATE SET
         task_count = excluded.task_count,
         status = 'pending'`,
      [wave.id, wave.taskListId, wave.waveNumber, wave.status, wave.taskCount],
    );

    // Save wave-task assignments
    for (let i = 0; i < wave.tasks.length; i++) {
      await run(
        `INSERT INTO wave_task_assignments (id, wave_id, task_id, position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(wave_id, task_id) DO UPDATE SET position = excluded.position`,
        [uuidv4(), wave.id, wave.tasks[i].id, i],
      );
    }
  }

  await saveDb();

  return waves;
}

/**
 * Get maximum parallelism for a task list
 *
 * @param taskListId Task list ID
 * @returns Maximum number of tasks that can run at once
 */
export async function getMaxParallelism(taskListId: string): Promise<number> {
  const waves = await calculateWaves(taskListId);

  if (waves.length === 0) {
    return 0;
  }

  return Math.max(...waves.map((w) => w.taskCount));
}

/**
 * Invalidate parallelism analysis when tasks change
 *
 * @param taskId Task that changed
 */
export async function invalidateAnalysis(taskId: string): Promise<void> {
  await run(
    `UPDATE parallelism_analysis
     SET invalidated_at = datetime('now')
     WHERE (task_a_id = ? OR task_b_id = ?)
       AND invalidated_at IS NULL`,
    [taskId, taskId],
  );
  await saveDb();
}

/**
 * Get full parallelism analysis for a task list
 */
export async function getTaskListParallelism(
  taskListId: string,
): Promise<TaskListParallelism> {
  const waves = await calculateWaves(taskListId);

  // Count parallel opportunities
  const analyses = await analyzeParallelism(taskListId);
  const parallelOpportunities = analyses.filter((a) => a.canParallel).length;

  // Get task count
  const taskCount = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')`,
    [taskListId],
  );

  return {
    taskListId,
    totalTasks: taskCount?.count || 0,
    totalWaves: waves.length,
    maxWave: waves.length,
    parallelOpportunities,
    waves,
  };
}

/**
 * Get cached parallelism analysis for a task pair
 */
export async function getCachedAnalysis(
  taskAId: string,
  taskBId: string,
): Promise<ParallelismAnalysis | null> {
  const [orderedA, orderedB] =
    taskAId < taskBId ? [taskAId, taskBId] : [taskBId, taskAId];

  const row = await getOne<ParallelismAnalysisRow>(
    `SELECT * FROM parallelism_analysis
     WHERE task_a_id = ? AND task_b_id = ?
       AND invalidated_at IS NULL`,
    [orderedA, orderedB],
  );

  if (!row) {
    return null;
  }

  return mapAnalysisRow(row);
}

/**
 * Clean up stale parallelism analyses
 *
 * @param olderThanDays Delete analyses older than this many days
 */
export async function cleanupStaleAnalyses(olderThanDays = 7): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM parallelism_analysis
     WHERE invalidated_at IS NOT NULL
       AND invalidated_at < datetime('now', '-' || ? || ' days')`,
    [olderThanDays],
  );

  await run(
    `DELETE FROM parallelism_analysis
     WHERE invalidated_at IS NOT NULL
       AND invalidated_at < datetime('now', '-' || ? || ' days')`,
    [olderThanDays],
  );

  await saveDb();

  return result?.count || 0;
}

/**
 * Resolution result for a single conflict
 */
interface ConflictResolution {
  taskAId: string;
  taskBId: string;
  resolution: "dependency_added" | "already_resolved" | "skipped";
  dependencyDirection?: "a_before_b" | "b_before_a";
  reason?: string;
}

/**
 * Auto-resolve file conflicts by adding dependencies
 *
 * For file conflicts, adds a depends_on relationship to enforce
 * sequential execution. The task with lower position runs first.
 */
export async function resolveConflicts(
  taskListId: string,
): Promise<ConflictResolution[]> {
  const analyses = await analyzeParallelism(taskListId, false);
  const fileConflicts = analyses.filter(
    (a) => !a.canParallel && a.conflictType === "file_conflict",
  );

  if (fileConflicts.length === 0) {
    return [];
  }

  const tasks = await query<{ id: string; position: number }>(
    `SELECT id, position FROM tasks WHERE task_list_id = ?`,
    [taskListId],
  );
  const positionMap = new Map(tasks.map((t) => [t.id, t.position]));

  const resolutions: ConflictResolution[] = [];

  for (const conflict of fileConflicts) {
    const posA = positionMap.get(conflict.taskAId) ?? 0;
    const posB = positionMap.get(conflict.taskBId) ?? 0;

    const existingDep = await getOne<{ id: string }>(
      `SELECT id FROM task_relationships
       WHERE ((source_task_id = ? AND target_task_id = ?)
          OR (source_task_id = ? AND target_task_id = ?))
         AND relationship_type = 'depends_on'`,
      [conflict.taskAId, conflict.taskBId, conflict.taskBId, conflict.taskAId],
    );

    if (existingDep) {
      resolutions.push({
        taskAId: conflict.taskAId,
        taskBId: conflict.taskBId,
        resolution: "already_resolved",
        reason: "Dependency already exists",
      });
      continue;
    }

    const [sourceId, targetId, direction] =
      posA < posB
        ? [conflict.taskBId, conflict.taskAId, "a_before_b" as const]
        : [conflict.taskAId, conflict.taskBId, "b_before_a" as const];

    const depId = uuidv4();
    await run(
      `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
       VALUES (?, ?, ?, 'depends_on', datetime('now'))`,
      [depId, sourceId, targetId],
    );

    await run(
      `UPDATE parallelism_analysis
       SET conflict_type = 'dependency',
           conflict_details = ?,
           can_parallel = 0
       WHERE task_a_id = ? AND task_b_id = ?`,
      [
        JSON.stringify({ dependencyChain: [direction], autoResolved: true }),
        conflict.taskAId,
        conflict.taskBId,
      ],
    );

    resolutions.push({
      taskAId: conflict.taskAId,
      taskBId: conflict.taskBId,
      resolution: "dependency_added",
      dependencyDirection: direction,
    });
  }

  await saveDb();
  return resolutions;
}

/**
 * Analyze and optionally auto-resolve conflicts
 */
export async function analyzeAndResolve(
  taskListId: string,
  autoResolve = true,
): Promise<{
  analyses: ParallelismAnalysis[];
  resolutions: ConflictResolution[];
  waves: ExecutionWave[];
}> {
  let analyses = await analyzeParallelism(taskListId, true);

  let resolutions: ConflictResolution[] = [];
  if (autoResolve) {
    resolutions = await resolveConflicts(taskListId);
    if (resolutions.some((r) => r.resolution === "dependency_added")) {
      analyses = await analyzeParallelism(taskListId, true);
    }
  }

  const waves = await calculateWaves(taskListId);

  return { analyses, resolutions, waves };
}

export default {
  analyzeParallelism,
  analyzeTaskPair,
  calculateWaves,
  getMaxParallelism,
  invalidateAnalysis,
  getTaskListParallelism,
  getCachedAnalysis,
  cleanupStaleAnalyses,
  resolveConflicts,
  analyzeAndResolve,
};
