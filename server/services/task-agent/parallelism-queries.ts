/**
 * Parallelism SQL Queries
 *
 * Pre-defined SQL queries for parallelism analysis and management.
 * These queries are optimized for the SQLite database and use
 * recursive CTEs for dependency chain analysis.
 *
 * Part of: PTE-058 to PTE-061
 */

import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskIdentity,
  FileOperation,
} from "../../../types/task-agent.js";

/**
 * Result of finding parallel opportunities
 */
export interface ParallelOpportunity {
  taskAId: string;
  taskADisplayId: string;
  taskBId: string;
  taskBDisplayId: string;
  canParallel: boolean;
  conflictFile?: string;
}

/**
 * Find all task pairs that can run in parallel within a task list
 *
 * This is the main query for identifying parallelism opportunities.
 */
export async function findParallelOpportunities(
  taskListId: string,
): Promise<ParallelOpportunity[]> {
  const results = await query<{
    task_a_id: string;
    task_a_display_id: string;
    task_b_id: string;
    task_b_display_id: string;
    can_parallel: number;
    conflict_file: string | null;
  }>(
    `WITH task_pairs AS (
      SELECT
        t1.id AS task_a_id,
        t1.display_id AS task_a_display_id,
        t2.id AS task_b_id,
        t2.display_id AS task_b_display_id
      FROM tasks t1
      CROSS JOIN tasks t2
      WHERE t1.id < t2.id
        AND t1.task_list_id = ?
        AND t2.task_list_id = ?
        AND t1.status IN ('pending', 'evaluating')
        AND t2.status IN ('pending', 'evaluating')
    ),
    dependency_conflicts AS (
      SELECT DISTINCT
        tp.task_a_id,
        tp.task_b_id
      FROM task_pairs tp
      WHERE EXISTS (
        SELECT 1 FROM task_relationships tr
        WHERE (tr.source_task_id = tp.task_a_id AND tr.target_task_id = tp.task_b_id)
           OR (tr.source_task_id = tp.task_b_id AND tr.target_task_id = tp.task_a_id)
        AND tr.relationship_type = 'depends_on'
      )
    ),
    file_conflicts AS (
      SELECT DISTINCT
        fi1.task_id AS task_a_id,
        fi2.task_id AS task_b_id,
        fi1.file_path AS conflict_file
      FROM task_file_impacts fi1
      JOIN task_file_impacts fi2
        ON fi1.file_path = fi2.file_path
        AND fi1.task_id < fi2.task_id
      WHERE
        (fi1.operation IN ('CREATE', 'UPDATE', 'DELETE')
         AND fi2.operation IN ('CREATE', 'UPDATE', 'DELETE'))
        OR (fi1.operation = 'DELETE' AND fi2.operation = 'READ')
        OR (fi1.operation = 'READ' AND fi2.operation = 'DELETE')
    )
    SELECT
      tp.task_a_id,
      tp.task_a_display_id,
      tp.task_b_id,
      tp.task_b_display_id,
      CASE
        WHEN dc.task_a_id IS NOT NULL THEN 0
        WHEN fc.task_a_id IS NOT NULL THEN 0
        ELSE 1
      END AS can_parallel,
      fc.conflict_file
    FROM task_pairs tp
    LEFT JOIN dependency_conflicts dc
      ON tp.task_a_id = dc.task_a_id AND tp.task_b_id = dc.task_b_id
    LEFT JOIN file_conflicts fc
      ON tp.task_a_id = fc.task_a_id AND tp.task_b_id = fc.task_b_id`,
    [taskListId, taskListId],
  );

  return results.map((r) => ({
    taskAId: r.task_a_id,
    taskADisplayId: r.task_a_display_id,
    taskBId: r.task_b_id,
    taskBDisplayId: r.task_b_display_id,
    canParallel: r.can_parallel === 1,
    conflictFile: r.conflict_file || undefined,
  }));
}

/**
 * Get detailed file conflicts between two tasks
 */
export async function getFileConflictsForPair(
  taskAId: string,
  taskBId: string,
): Promise<
  Array<{
    filePath: string;
    operationA: FileOperation;
    operationB: FileOperation;
    confidenceA: number;
    confidenceB: number;
    conflictType: string;
  }>
> {
  const results = await query<{
    file_path: string;
    task_a_operation: string;
    task_b_operation: string;
    task_a_confidence: number;
    task_b_confidence: number;
    conflict_type: string;
  }>(
    `SELECT
      fi1.file_path,
      fi1.operation AS task_a_operation,
      fi2.operation AS task_b_operation,
      fi1.confidence AS task_a_confidence,
      fi2.confidence AS task_b_confidence,
      CASE
        WHEN fi1.operation = 'CREATE' AND fi2.operation = 'CREATE' THEN 'create_create'
        WHEN fi1.operation IN ('UPDATE', 'DELETE') AND fi2.operation IN ('UPDATE', 'DELETE') THEN 'write_write'
        WHEN fi1.operation = 'DELETE' OR fi2.operation = 'DELETE' THEN 'delete_conflict'
        ELSE 'unknown'
      END AS conflict_type
    FROM task_file_impacts fi1
    JOIN task_file_impacts fi2
      ON fi1.file_path = fi2.file_path
    WHERE fi1.task_id = ?
      AND fi2.task_id = ?
      AND fi1.operation != 'READ'
      AND fi2.operation != 'READ'`,
    [taskAId, taskBId],
  );

  return results.map((r) => ({
    filePath: r.file_path,
    operationA: r.task_a_operation as FileOperation,
    operationB: r.task_b_operation as FileOperation,
    confidenceA: r.task_a_confidence,
    confidenceB: r.task_b_confidence,
    conflictType: r.conflict_type,
  }));
}

/**
 * Get transitive dependencies for a task using recursive CTE
 */
export async function getDependencyChain(
  taskId: string,
): Promise<Array<{ taskId: string; depth: number }>> {
  const results = await query<{
    target_task_id: string;
    depth: number;
  }>(
    `WITH RECURSIVE dep_chain AS (
      SELECT
        source_task_id,
        target_task_id,
        1 AS depth
      FROM task_relationships
      WHERE source_task_id = ?
        AND relationship_type = 'depends_on'

      UNION ALL

      SELECT
        tr.source_task_id,
        tr.target_task_id,
        dc.depth + 1
      FROM task_relationships tr
      JOIN dep_chain dc ON tr.source_task_id = dc.target_task_id
      WHERE tr.relationship_type = 'depends_on'
        AND dc.depth < 10
    )
    SELECT DISTINCT target_task_id, depth
    FROM dep_chain
    ORDER BY depth`,
    [taskId],
  );

  return results.map((r) => ({
    taskId: r.target_task_id,
    depth: r.depth,
  }));
}

/**
 * Detect if adding a dependency would create a cycle
 */
export async function wouldCreateCycle(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<{ wouldCreateCycle: boolean; cyclePath?: string }> {
  const result = await getOne<{ cycle_path: string }>(
    `WITH RECURSIVE path AS (
      SELECT
        ? AS current,
        ? AS path,
        1 AS depth

      UNION ALL

      SELECT
        tr.target_task_id,
        p.path || ' -> ' || tr.target_task_id,
        p.depth + 1
      FROM task_relationships tr
      JOIN path p ON tr.source_task_id = p.current
      WHERE tr.relationship_type = 'depends_on'
        AND p.depth < 20
        AND tr.target_task_id != ?
    )
    SELECT path || ' -> ' || ? AS cycle_path
    FROM path
    WHERE current = ?
    LIMIT 1`,
    [targetTaskId, targetTaskId, targetTaskId, sourceTaskId, sourceTaskId],
  );

  if (result?.cycle_path) {
    return {
      wouldCreateCycle: true,
      cyclePath: result.cycle_path,
    };
  }

  return { wouldCreateCycle: false };
}

/**
 * Invalidate stale parallelism analyses for a changed task
 */
export async function invalidateStaleAnalyses(
  changedTaskId: string,
): Promise<number> {
  const countResult = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM parallelism_analysis
     WHERE (task_a_id = ? OR task_b_id = ?)
       AND invalidated_at IS NULL`,
    [changedTaskId, changedTaskId],
  );

  await run(
    `UPDATE parallelism_analysis
     SET invalidated_at = datetime('now')
     WHERE (task_a_id = ? OR task_b_id = ?)
       AND invalidated_at IS NULL`,
    [changedTaskId, changedTaskId],
  );

  await saveDb();

  return countResult?.count || 0;
}

/**
 * Get Evaluation Queue statistics
 */
export async function getEvaluationQueueStats(projectId?: string): Promise<{
  totalQueued: number;
  staleCount: number;
  newToday: number;
  avgDaysInQueue: number;
}> {
  let sql = `
    SELECT
      COUNT(*) AS total_queued,
      COUNT(CASE WHEN created_at < datetime('now', '-3 days') THEN 1 END) AS stale_count,
      COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) AS new_today,
      AVG(julianday('now') - julianday(created_at)) AS avg_days_in_queue
    FROM tasks
    WHERE queue = 'evaluation'
  `;
  const params: string[] = [];

  if (projectId) {
    sql += " AND project_id = ?";
    params.push(projectId);
  }

  const result = await getOne<{
    total_queued: number;
    stale_count: number;
    new_today: number;
    avg_days_in_queue: number;
  }>(sql, params);

  return {
    totalQueued: result?.total_queued || 0,
    staleCount: result?.stale_count || 0,
    newToday: result?.new_today || 0,
    avgDaysInQueue: result?.avg_days_in_queue || 0,
  };
}

/**
 * Get tasks that are ready to execute (no unmet dependencies)
 */
export async function getReadyTasks(
  taskListId: string,
): Promise<TaskIdentity[]> {
  const results = await query<{
    id: string;
    display_id: string;
  }>(
    `SELECT t.id, t.display_id
     FROM tasks t
     WHERE t.task_list_id = ?
       AND t.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM task_relationships tr
         JOIN tasks dep ON tr.target_task_id = dep.id
         WHERE tr.source_task_id = t.id
           AND tr.relationship_type = 'depends_on'
           AND dep.status NOT IN ('completed', 'skipped')
       )
     ORDER BY t.position`,
    [taskListId],
  );

  return results.map((r) => ({
    id: r.id,
    displayId: r.display_id,
  }));
}

/**
 * Get tasks that are blocked by a specific task
 */
export async function getBlockedTasks(
  blockerTaskId: string,
): Promise<TaskIdentity[]> {
  const results = await query<{
    id: string;
    display_id: string;
  }>(
    `SELECT t.id, t.display_id
     FROM tasks t
     JOIN task_relationships tr ON t.id = tr.source_task_id
     WHERE tr.target_task_id = ?
       AND tr.relationship_type = 'depends_on'
       AND t.status IN ('pending', 'blocked')
     ORDER BY t.position`,
    [blockerTaskId],
  );

  return results.map((r) => ({
    id: r.id,
    displayId: r.display_id,
  }));
}

/**
 * Calculate execution wave numbers for all tasks in a list
 * using a recursive approach
 */
export async function calculateWaveNumbers(
  taskListId: string,
): Promise<Map<string, number>> {
  // This uses a simpler iterative approach rather than a pure SQL recursive CTE
  // because we also need to consider file conflicts

  const tasks = await query<{
    id: string;
    display_id: string;
  }>(
    `SELECT id, display_id
     FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')
     ORDER BY position`,
    [taskListId],
  );

  const waveMap = new Map<string, number>();
  const assignedTasks = new Set<string>();
  let waveNumber = 0;

  while (assignedTasks.size < tasks.length) {
    waveNumber++;
    let addedAny = false;

    for (const task of tasks) {
      if (assignedTasks.has(task.id)) {
        continue;
      }

      // Check if all dependencies are satisfied
      const deps = await getDependencyChain(task.id);
      const unsatisfiedDeps = deps.filter((d) => !assignedTasks.has(d.taskId));

      if (unsatisfiedDeps.length === 0) {
        waveMap.set(task.id, waveNumber);
        assignedTasks.add(task.id);
        addedAny = true;
      }
    }

    // Prevent infinite loop
    if (!addedAny) {
      // Assign remaining tasks to next wave (likely have circular deps)
      for (const task of tasks) {
        if (!assignedTasks.has(task.id)) {
          waveMap.set(task.id, waveNumber + 1);
          assignedTasks.add(task.id);
        }
      }
      break;
    }
  }

  return waveMap;
}

export default {
  findParallelOpportunities,
  getFileConflictsForPair,
  getDependencyChain,
  wouldCreateCycle,
  invalidateStaleAnalyses,
  getEvaluationQueueStats,
  getReadyTasks,
  getBlockedTasks,
  calculateWaveNumbers,
};
