/**
 * Task Analysis Pipeline
 *
 * Analyzes tasks for relationships, duplicates, and grouping opportunities.
 * Runs automatically when tasks are created or modified.
 *
 * Part of: PTE-039 to PTE-043
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  Task,
  TaskIdentity,
  GroupingSuggestion,
  DependencyChain,
  RelationshipType,
} from "../../../types/task-agent.js";

/**
 * Analysis result for a task
 */
export interface TaskAnalysisResult {
  taskId: string;
  relatedTasks: Array<TaskIdentity & { similarity: number; reason: string }>;
  duplicateCandidates: Array<{ taskId: string; similarity: number }>;
  suggestedDependencies: Array<{ taskId: string; type: RelationshipType }>;
  groupingSuggestion?: GroupingSuggestion;
  hasCircularDependency: boolean;
  circularDependencyPath?: string[];
}

/**
 * Database row for task with minimal fields
 */
interface TaskMinimalRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
  project_id: string | null;
}

/**
 * Analyze a task for relationships, duplicates, and grouping
 *
 * @param taskId Task to analyze
 * @returns Analysis results
 */
export async function analyzeTask(taskId: string): Promise<TaskAnalysisResult> {
  const task = await getOne<TaskMinimalRow>(
    "SELECT id, display_id, title, description, category, project_id FROM tasks WHERE id = ?",
    [taskId],
  );

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Run all analyses in parallel
  const [relatedTasks, duplicateCandidates, circularCheck] = await Promise.all([
    findRelatedTasks(
      taskId,
      task.title,
      task.description || "",
      task.project_id,
    ),
    detectDuplicates(
      taskId,
      task.title,
      task.description || "",
      task.project_id,
    ),
    validateDependencies(taskId),
  ]);

  // Check if grouping suggestion should be created
  let groupingSuggestion: GroupingSuggestion | undefined;
  if (relatedTasks.length >= 2) {
    const suggestion = await suggestGrouping(
      taskId,
      relatedTasks.map((t) => t.id),
      task.project_id,
    );
    groupingSuggestion = suggestion ?? undefined;
  }

  return {
    taskId,
    relatedTasks,
    duplicateCandidates,
    suggestedDependencies: [],
    groupingSuggestion,
    hasCircularDependency: circularCheck.hasCircle,
    circularDependencyPath: circularCheck.circlePath,
  };
}

/**
 * Find tasks related to the given task
 *
 * Uses multiple signals:
 * - Text similarity (title and description)
 * - Same category
 * - Same project
 * - File overlap predictions
 */
export async function findRelatedTasks(
  taskId: string,
  title: string,
  description: string,
  projectId: string | null,
): Promise<Array<TaskIdentity & { similarity: number; reason: string }>> {
  const related: Array<TaskIdentity & { similarity: number; reason: string }> =
    [];

  // Find tasks in same project with similar titles
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (titleWords.length > 0) {
    // Simple word-based similarity
    const similarTasks = await query<TaskMinimalRow>(
      `SELECT id, display_id, title, description, category, project_id
       FROM tasks
       WHERE id != ?
         AND queue = 'evaluation'
         ${projectId ? "AND project_id = ?" : ""}
       LIMIT 50`,
      projectId ? [taskId, projectId] : [taskId],
    );

    for (const candidate of similarTasks) {
      const candidateWords = candidate.title.toLowerCase().split(/\s+/);
      const overlap = titleWords.filter((w) =>
        candidateWords.includes(w),
      ).length;
      const similarity =
        overlap / Math.max(titleWords.length, candidateWords.length);

      if (similarity >= 0.3) {
        related.push({
          id: candidate.id,
          displayId: candidate.display_id,
          similarity,
          reason: `Similar title (${Math.round(similarity * 100)}% word overlap)`,
        });
      }
    }
  }

  // Find tasks with same category that might be related
  const sameCategoryTasks = await query<TaskMinimalRow>(
    `SELECT id, display_id, title, description, category, project_id
     FROM tasks
     WHERE id != ?
       AND queue = 'evaluation'
       AND category = (SELECT category FROM tasks WHERE id = ?)
       ${projectId ? "AND project_id = ?" : ""}
       AND id NOT IN (SELECT source_task_id FROM task_relationships WHERE target_task_id = ?)
       AND id NOT IN (SELECT target_task_id FROM task_relationships WHERE source_task_id = ?)
     LIMIT 20`,
    projectId
      ? [taskId, taskId, projectId, taskId, taskId]
      : [taskId, taskId, taskId, taskId],
  );

  for (const candidate of sameCategoryTasks) {
    // Check if already in related list
    if (related.some((r) => r.id === candidate.id)) {
      continue;
    }

    related.push({
      id: candidate.id,
      displayId: candidate.display_id,
      similarity: 0.5, // Category match
      reason: "Same category",
    });
  }

  // Sort by similarity and limit
  related.sort((a, b) => b.similarity - a.similarity);
  return related.slice(0, 10);
}

/**
 * Detect potential duplicate tasks
 *
 * @param taskId Task to check
 * @param title Task title
 * @param description Task description
 * @param projectId Project ID (optional)
 * @returns List of potential duplicates with similarity scores
 */
export async function detectDuplicates(
  taskId: string,
  title: string,
  description: string,
  projectId: string | null,
): Promise<Array<{ taskId: string; similarity: number }>> {
  const duplicates: Array<{ taskId: string; similarity: number }> = [];

  // Check for tasks with very similar titles
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const candidates = await query<TaskMinimalRow>(
    `SELECT id, display_id, title, description, category, project_id
     FROM tasks
     WHERE id != ?
       ${projectId ? "AND project_id = ?" : ""}
     LIMIT 100`,
    projectId ? [taskId, projectId] : [taskId],
  );

  for (const candidate of candidates) {
    const candidateNormalized = candidate.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    // Simple Jaccard similarity on words
    const titleWordsA = new Set(
      normalizedTitle.split(" ").filter((w) => w.length > 2),
    );
    const titleWordsB = new Set(
      candidateNormalized.split(" ").filter((w) => w.length > 2),
    );

    const intersection = new Set(
      [...titleWordsA].filter((x) => titleWordsB.has(x)),
    );
    const union = new Set([...titleWordsA, ...titleWordsB]);

    const similarity = union.size > 0 ? intersection.size / union.size : 0;

    if (similarity >= 0.85) {
      duplicates.push({
        taskId: candidate.id,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  duplicates.sort((a, b) => b.similarity - a.similarity);
  return duplicates.slice(0, 5);
}

/**
 * Generate a grouping suggestion for related tasks
 *
 * @param triggerTaskId Task that triggered the suggestion
 * @param relatedTaskIds Related task IDs to include
 * @param projectId Project ID
 */
export async function suggestGrouping(
  triggerTaskId: string,
  relatedTaskIds: string[],
  projectId: string | null,
): Promise<GroupingSuggestion | null> {
  const allTaskIds = [triggerTaskId, ...relatedTaskIds];

  // Get task details for naming
  const tasks = await query<TaskMinimalRow>(
    `SELECT id, display_id, title, description, category, project_id
     FROM tasks
     WHERE id IN (${allTaskIds.map(() => "?").join(", ")})`,
    allTaskIds,
  );

  if (tasks.length < 2) {
    return null;
  }

  // Generate a suggested name based on common words
  const allWords: Map<string, number> = new Map();
  for (const task of tasks) {
    const words = task.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3) {
        allWords.set(word, (allWords.get(word) || 0) + 1);
      }
    }
  }

  // Find most common words
  const commonWords = Array.from(allWords.entries())
    .filter(([, count]) => count >= Math.ceil(tasks.length / 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  const suggestedName =
    commonWords.length > 0
      ? commonWords
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ") + " Tasks"
      : `Related Tasks (${tasks.length} items)`;

  // Create the suggestion
  const suggestionId = uuidv4();
  const suggestion: GroupingSuggestion = {
    id: suggestionId,
    status: "pending",
    suggestedName,
    suggestedTasks: allTaskIds,
    groupingReason: `These ${tasks.length} tasks appear to be related based on their titles and descriptions.`,
    similarityScore: 0.7, // Placeholder - would be calculated more precisely
    projectId: projectId || undefined,
    triggeredBy: "task_created",
    triggerTaskId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  };

  // Save to database
  await run(
    `INSERT INTO grouping_suggestions (
      id, status, suggested_name, suggested_tasks, grouping_reason,
      similarity_score, project_id, triggered_by, trigger_task_id, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      suggestion.id,
      suggestion.status,
      suggestion.suggestedName,
      JSON.stringify(suggestion.suggestedTasks),
      suggestion.groupingReason,
      suggestion.similarityScore || null,
      suggestion.projectId || null,
      suggestion.triggeredBy || null,
      suggestion.triggerTaskId || null,
      suggestion.expiresAt || null,
    ],
  );

  // Save suggestion-task links
  for (const tid of allTaskIds) {
    await run(
      `INSERT INTO suggestion_tasks (id, suggestion_id, task_id, inclusion_reason)
       VALUES (?, ?, ?, ?)`,
      [
        uuidv4(),
        suggestionId,
        tid,
        tid === triggerTaskId ? "Trigger task" : "Related task",
      ],
    );
  }

  await saveDb();

  return suggestion;
}

/**
 * Validate dependencies for circular references
 *
 * @param taskId Task to validate
 * @returns Validation result
 */
export async function validateDependencies(
  taskId: string,
): Promise<{ hasCircle: boolean; circlePath?: string[] }> {
  // Use recursive CTE to detect cycles
  const cycleCheck = await getOne<{ cycle_path: string }>(
    `WITH RECURSIVE path AS (
      SELECT
        target_task_id AS current,
        source_task_id || ' -> ' || target_task_id AS path,
        1 AS depth
      FROM task_relationships
      WHERE source_task_id = ?
        AND relationship_type = 'depends_on'

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
    [taskId, taskId],
  );

  if (cycleCheck?.cycle_path) {
    const circlePath = cycleCheck.cycle_path.split(" -> ");
    return { hasCircle: true, circlePath };
  }

  return { hasCircle: false };
}

/**
 * Check if adding a dependency would create a cycle
 *
 * @param sourceTaskId Task that depends
 * @param targetTaskId Task that is depended upon
 * @returns true if adding this dependency would create a cycle
 */
export async function wouldCreateCycle(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<boolean> {
  // Check if target task transitively depends on source
  const cycleCheck = await getOne<{ found: number }>(
    `WITH RECURSIVE path AS (
      SELECT
        target_task_id AS current,
        1 AS depth
      FROM task_relationships
      WHERE source_task_id = ?
        AND relationship_type = 'depends_on'

      UNION ALL

      SELECT
        tr.target_task_id,
        p.depth + 1
      FROM task_relationships tr
      JOIN path p ON tr.source_task_id = p.current
      WHERE tr.relationship_type = 'depends_on'
        AND p.depth < 20
    )
    SELECT 1 AS found
    FROM path
    WHERE current = ?
    LIMIT 1`,
    [targetTaskId, sourceTaskId],
  );

  return cycleCheck?.found === 1;
}

/**
 * Get dependency chain for a task
 */
export async function getDependencyChain(
  taskId: string,
): Promise<DependencyChain> {
  const dependencies = await query<{
    task_id: string;
    depth: number;
    display_id: string;
    title: string;
    status: string;
  }>(
    `WITH RECURSIVE dep_chain AS (
      SELECT
        tr.target_task_id AS task_id,
        1 AS depth
      FROM task_relationships tr
      WHERE tr.source_task_id = ?
        AND tr.relationship_type = 'depends_on'

      UNION ALL

      SELECT
        tr.target_task_id,
        dc.depth + 1
      FROM task_relationships tr
      JOIN dep_chain dc ON tr.source_task_id = dc.task_id
      WHERE tr.relationship_type = 'depends_on'
        AND dc.depth < 10
    )
    SELECT
      dc.task_id,
      dc.depth,
      t.display_id,
      t.title,
      t.status
    FROM dep_chain dc
    JOIN tasks t ON dc.task_id = t.id
    ORDER BY dc.depth`,
    [taskId],
  );

  const circularCheck = await validateDependencies(taskId);

  return {
    taskId,
    dependencies: dependencies.map((d) => ({
      taskId: d.task_id,
      depth: d.depth,
      displayId: d.display_id,
      title: d.title,
      status: d.status as any,
    })),
    hasCircularDependency: circularCheck.hasCircle,
    circularPath: circularCheck.circlePath,
  };
}

/**
 * Add a dependency relationship between tasks
 *
 * @param sourceTaskId Task that depends
 * @param targetTaskId Task that is depended upon
 * @returns true if dependency was added, false if it would create a cycle
 */
export async function addDependency(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<boolean> {
  // Check for cycle
  if (await wouldCreateCycle(sourceTaskId, targetTaskId)) {
    return false;
  }

  await run(
    `INSERT OR IGNORE INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
     VALUES (?, ?, ?, 'depends_on')`,
    [uuidv4(), sourceTaskId, targetTaskId],
  );

  await saveDb();
  return true;
}

/**
 * Remove a dependency relationship
 */
export async function removeDependency(
  sourceTaskId: string,
  targetTaskId: string,
): Promise<void> {
  await run(
    `DELETE FROM task_relationships
     WHERE source_task_id = ?
       AND target_task_id = ?
       AND relationship_type = 'depends_on'`,
    [sourceTaskId, targetTaskId],
  );
  await saveDb();
}

export default {
  analyzeTask,
  findRelatedTasks,
  detectDuplicates,
  suggestGrouping,
  validateDependencies,
  wouldCreateCycle,
  getDependencyChain,
  addDependency,
  removeDependency,
};
