/**
 * Circular Dependency Prevention
 *
 * Prevents circular dependencies between tasks through:
 * - Proactive detection before creation
 * - Reactive detection of existing cycles
 * - AI-powered resolution recommendations
 *
 * Part of: PTE-077 to PTE-081
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import { TaskIdentity } from "../../../types/task-agent.js";

/**
 * Result of cycle detection
 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
  cycleDisplayIds?: string[];
  recommendation?: {
    action: "remove_dependency";
    sourceTaskId: string;
    targetTaskId: string;
    reason: string;
  };
}

/**
 * Near-cycle warning
 */
export interface NearCycleWarning {
  taskId: string;
  potentialCycleTaskId: string;
  stepsTowardsCycle: number;
  warningMessage: string;
}

/**
 * Check if adding a dependency would create a cycle
 *
 * @param sourceTaskId Task that will depend on target
 * @param targetTaskId Task that will be depended upon
 * @returns true if adding this dependency would create a cycle
 */
export async function wouldCreateCycle(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<CycleDetectionResult> {
  // A cycle would be created if target already (transitively) depends on source
  // i.e., if we can reach source from target following dependencies

  const cycleCheck = await getOne<{ cycle_path: string }>(
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

  if (!cycleCheck?.cycle_path) {
    return { hasCycle: false };
  }

  // Parse the cycle path
  const cyclePath = cycleCheck.cycle_path.split(" -> ");

  // Get display IDs for the cycle
  const displayIds = await query<{ id: string; display_id: string }>(
    `SELECT id, display_id FROM tasks WHERE id IN (${cyclePath.map(() => "?").join(", ")})`,
    cyclePath,
  );
  const idMap = new Map(displayIds.map((t) => [t.id, t.display_id]));
  const cycleDisplayIds = cyclePath.map((id) => idMap.get(id) || id);

  // Generate recommendation
  const recommendation = await generateResolution(cyclePath);

  return {
    hasCycle: true,
    cyclePath,
    cycleDisplayIds,
    recommendation,
  };
}

/**
 * Detect existing cycles in the dependency graph
 *
 * @param projectId Optional project filter
 * @returns List of cycles found
 */
export async function detectExistingCycles(
  projectId?: string,
): Promise<CycleDetectionResult[]> {
  // Get all tasks
  let tasksSql = "SELECT id FROM tasks WHERE 1=1";
  const params: string[] = [];

  if (projectId) {
    tasksSql += " AND project_id = ?";
    params.push(projectId);
  }

  const tasks = await query<{ id: string }>(tasksSql, params);
  const cycles: CycleDetectionResult[] = [];
  const visitedCycles = new Set<string>();

  for (const task of tasks) {
    // Check for cycle starting from this task
    const cycleCheck = await getOne<{ cycle_path: string }>(
      `WITH RECURSIVE path AS (
        SELECT
          tr.target_task_id AS current,
          ? || ' -> ' || tr.target_task_id AS path,
          1 AS depth
        FROM task_relationships tr
        WHERE tr.source_task_id = ?
          AND tr.relationship_type = 'depends_on'

        UNION ALL

        SELECT
          tr.target_task_id,
          p.path || ' -> ' || tr.target_task_id,
          p.depth + 1
        FROM task_relationships tr
        JOIN path p ON tr.source_task_id = p.current
        WHERE tr.relationship_type = 'depends_on'
          AND p.depth < 20
      )
      SELECT path AS cycle_path
      FROM path
      WHERE current = ?
      LIMIT 1`,
      [task.id, task.id, task.id],
    );

    if (cycleCheck?.cycle_path) {
      // Normalize cycle for deduplication
      const cyclePath = cycleCheck.cycle_path.split(" -> ");
      const normalizedCycle = normalizeCycle(cyclePath).join(",");

      if (!visitedCycles.has(normalizedCycle)) {
        visitedCycles.add(normalizedCycle);

        // Get display IDs
        const displayIds = await query<{ id: string; display_id: string }>(
          `SELECT id, display_id FROM tasks WHERE id IN (${cyclePath.map(() => "?").join(", ")})`,
          cyclePath,
        );
        const idMap = new Map(displayIds.map((t) => [t.id, t.display_id]));
        const cycleDisplayIds = cyclePath.map((id) => idMap.get(id) || id);

        // Generate recommendation
        const recommendation = await generateResolution(cyclePath);

        cycles.push({
          hasCycle: true,
          cyclePath,
          cycleDisplayIds,
          recommendation,
        });
      }
    }
  }

  return cycles;
}

/**
 * Normalize a cycle to its canonical form for deduplication
 */
function normalizeCycle(cyclePath: string[]): string[] {
  if (cyclePath.length <= 1) return cyclePath;

  // Remove the last element if it equals the first (closing the cycle)
  const path =
    cyclePath[cyclePath.length - 1] === cyclePath[0]
      ? cyclePath.slice(0, -1)
      : cyclePath;

  // Find the smallest element and rotate the array to start with it
  const minIndex = path.indexOf(path.slice().sort()[0]);
  return [...path.slice(minIndex), ...path.slice(0, minIndex)];
}

/**
 * Generate a resolution recommendation for a cycle
 *
 * Uses heuristics to suggest which dependency to remove:
 * 1. Prefer removing dependencies from newer tasks
 * 2. Prefer removing dependencies that have alternatives
 * 3. Consider task priority
 */
export async function generateResolution(cyclePath: string[]): Promise<{
  action: "remove_dependency";
  sourceTaskId: string;
  targetTaskId: string;
  reason: string;
}> {
  // Get task details for the cycle
  const tasks = await query<{
    id: string;
    display_id: string;
    title: string;
    created_at: string;
    priority: string;
  }>(
    `SELECT id, display_id, title, created_at, priority
     FROM tasks
     WHERE id IN (${cyclePath.map(() => "?").join(", ")})`,
    cyclePath,
  );

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Get dependencies in the cycle
  const dependencies: Array<{ source: string; target: string }> = [];
  for (let i = 0; i < cyclePath.length; i++) {
    const source = cyclePath[i];
    const target = cyclePath[(i + 1) % cyclePath.length];
    if (source !== target) {
      dependencies.push({ source, target });
    }
  }

  // Score each dependency for removal
  let bestCandidate = dependencies[0];
  let bestScore = -Infinity;

  for (const dep of dependencies) {
    const sourceTask = taskMap.get(dep.source);
    const targetTask = taskMap.get(dep.target);

    if (!sourceTask || !targetTask) continue;

    let score = 0;

    // Prefer removing from newer tasks (they're more likely to be mistaken)
    const sourceDate = new Date(sourceTask.created_at).getTime();
    const targetDate = new Date(targetTask.created_at).getTime();
    if (sourceDate > targetDate) {
      score += 2;
    }

    // Prefer removing from lower priority tasks
    const priorityScore: Record<string, number> = {
      P1: 0,
      P2: 1,
      P3: 2,
      P4: 3,
    };
    score += priorityScore[sourceTask.priority] || 0;

    // Check if source has other dependencies (less critical to remove)
    const otherDeps = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_relationships
       WHERE source_task_id = ?
         AND target_task_id != ?
         AND relationship_type = 'depends_on'`,
      [dep.source, dep.target],
    );
    if (otherDeps && otherDeps.count > 0) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = dep;
    }
  }

  const sourceTask = taskMap.get(bestCandidate.source);
  const targetTask = taskMap.get(bestCandidate.target);

  return {
    action: "remove_dependency",
    sourceTaskId: bestCandidate.source,
    targetTaskId: bestCandidate.target,
    reason: `Remove dependency from "${sourceTask?.display_id}" to "${targetTask?.display_id}" to break the cycle. This dependency appears to be the most recently added and least critical to the workflow.`,
  };
}

/**
 * Apply a resolution by removing a dependency
 */
export async function applyResolution(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<boolean> {
  await run(
    `DELETE FROM task_relationships
     WHERE source_task_id = ?
       AND target_task_id = ?
       AND relationship_type = 'depends_on'`,
    [sourceTaskId, targetTaskId],
  );

  await saveDb();

  return true;
}

/**
 * Check for near-cycles (tasks that are 1 step away from creating a cycle)
 *
 * @param taskId Task to check
 * @returns List of warnings about potential cycles
 */
export async function checkNearCycles(
  taskId: string,
): Promise<NearCycleWarning[]> {
  const warnings: NearCycleWarning[] = [];

  // Get tasks that depend on this task
  const dependentTasks = await query<{
    source_task_id: string;
    display_id: string;
  }>(
    `SELECT tr.source_task_id, t.display_id
     FROM task_relationships tr
     JOIN tasks t ON tr.source_task_id = t.id
     WHERE tr.target_task_id = ?
       AND tr.relationship_type = 'depends_on'`,
    [taskId],
  );

  // Get tasks this task depends on
  const dependencyTasks = await query<{
    target_task_id: string;
    display_id: string;
  }>(
    `SELECT tr.target_task_id, t.display_id
     FROM task_relationships tr
     JOIN tasks t ON tr.target_task_id = t.id
     WHERE tr.source_task_id = ?
       AND tr.relationship_type = 'depends_on'`,
    [taskId],
  );

  // Check if any dependent task is also a dependency (1-step cycle)
  for (const dep of dependentTasks) {
    if (dependencyTasks.some((d) => d.target_task_id === dep.source_task_id)) {
      warnings.push({
        taskId,
        potentialCycleTaskId: dep.source_task_id,
        stepsTowardsCycle: 1,
        warningMessage: `Task "${dep.display_id}" both depends on and is depended upon by this task. This is a direct cycle.`,
      });
    }
  }

  // Check for 2-step near-cycles
  for (const dep of dependentTasks) {
    // Get tasks that depend on the dependent task
    const secondLevel = await query<{ source_task_id: string }>(
      `SELECT source_task_id FROM task_relationships
       WHERE target_task_id = ?
         AND relationship_type = 'depends_on'`,
      [dep.source_task_id],
    );

    for (const second of secondLevel) {
      if (
        dependencyTasks.some((d) => d.target_task_id === second.source_task_id)
      ) {
        const secondTask = await getOne<{ display_id: string }>(
          "SELECT display_id FROM tasks WHERE id = ?",
          [second.source_task_id],
        );

        warnings.push({
          taskId,
          potentialCycleTaskId: second.source_task_id,
          stepsTowardsCycle: 2,
          warningMessage: `Adding a dependency from "${secondTask?.display_id}" to this task would create a cycle.`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Safely add a dependency with cycle check
 *
 * @returns true if dependency was added, false if it would create a cycle
 */
export async function safeAddDependency(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<{ added: boolean; cycleDetected?: CycleDetectionResult }> {
  // Check for cycle
  const cycleResult = await wouldCreateCycle(sourceTaskId, targetTaskId);

  if (cycleResult.hasCycle) {
    return { added: false, cycleDetected: cycleResult };
  }

  // Add the dependency
  await run(
    `INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
     VALUES (?, ?, ?, 'depends_on')`,
    [uuidv4(), sourceTaskId, targetTaskId],
  );

  await saveDb();

  return { added: true };
}

/**
 * Get all dependencies for a task (for visualization)
 */
export async function getTaskDependencies(taskId: string): Promise<{
  dependsOn: TaskIdentity[];
  blockedBy: TaskIdentity[];
  transitiveDependencies: TaskIdentity[];
}> {
  // Direct dependencies (tasks this task depends on)
  const dependsOn = await query<{ id: string; display_id: string }>(
    `SELECT t.id, t.display_id
     FROM tasks t
     JOIN task_relationships tr ON t.id = tr.target_task_id
     WHERE tr.source_task_id = ?
       AND tr.relationship_type = 'depends_on'`,
    [taskId],
  );

  // Tasks blocked by this task (tasks that depend on this task)
  const blockedBy = await query<{ id: string; display_id: string }>(
    `SELECT t.id, t.display_id
     FROM tasks t
     JOIN task_relationships tr ON t.id = tr.source_task_id
     WHERE tr.target_task_id = ?
       AND tr.relationship_type = 'depends_on'`,
    [taskId],
  );

  // Transitive dependencies
  const transitive = await query<{ id: string; display_id: string }>(
    `WITH RECURSIVE dep_chain AS (
      SELECT target_task_id AS task_id
      FROM task_relationships
      WHERE source_task_id = ?
        AND relationship_type = 'depends_on'

      UNION ALL

      SELECT tr.target_task_id
      FROM task_relationships tr
      JOIN dep_chain dc ON tr.source_task_id = dc.task_id
      WHERE tr.relationship_type = 'depends_on'
    )
    SELECT DISTINCT t.id, t.display_id
    FROM tasks t
    JOIN dep_chain dc ON t.id = dc.task_id
    WHERE t.id NOT IN (${dependsOn.map(() => "?").join(", ") || "''"})`,
    [taskId, ...dependsOn.map((d) => d.id)],
  );

  return {
    dependsOn: dependsOn.map((d) => ({ id: d.id, displayId: d.display_id })),
    blockedBy: blockedBy.map((d) => ({ id: d.id, displayId: d.display_id })),
    transitiveDependencies: transitive.map((d) => ({
      id: d.id,
      displayId: d.display_id,
    })),
  };
}

export default {
  wouldCreateCycle,
  detectExistingCycles,
  generateResolution,
  applyResolution,
  checkNearCycles,
  safeAddDependency,
  getTaskDependencies,
};
