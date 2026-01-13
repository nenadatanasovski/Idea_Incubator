/**
 * Auto-Grouping Engine
 *
 * Automatically suggests groupings for tasks based on:
 * - File overlap
 * - Dependencies
 * - Semantic similarity
 * - Category
 * - Component type
 *
 * Part of: PTE-072 to PTE-076
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, getOne, saveDb } from '../../../database/db.js';
import {
  GroupingSuggestion,
  GroupingSuggestionStatus,
  GroupingCriteriaWeights,
  GroupingTrigger,
  TaskIdentity,
  TaskCategory,
  CreateTaskListInput,
} from '../../../types/task-agent.js';

/**
 * Database row for grouping suggestion
 */
interface GroupingSuggestionRow {
  id: string;
  status: string;
  suggested_name: string;
  suggested_tasks: string;
  grouping_reason: string;
  similarity_score: number | null;
  project_id: string | null;
  triggered_by: string | null;
  trigger_task_id: string | null;
  created_task_list_id: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Map database row to GroupingSuggestion object
 */
function mapSuggestionRow(row: GroupingSuggestionRow): GroupingSuggestion {
  return {
    id: row.id,
    status: row.status as GroupingSuggestionStatus,
    suggestedName: row.suggested_name,
    suggestedTasks: JSON.parse(row.suggested_tasks),
    groupingReason: row.grouping_reason,
    similarityScore: row.similarity_score || undefined,
    projectId: row.project_id || undefined,
    triggeredBy: row.triggered_by as GroupingTrigger | undefined,
    triggerTaskId: row.trigger_task_id || undefined,
    createdTaskListId: row.created_task_list_id || undefined,
    resolvedBy: row.resolved_by as 'user' | 'system' | undefined,
    resolvedAt: row.resolved_at || undefined,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Default grouping criteria weights
 */
const DEFAULT_WEIGHTS: GroupingCriteriaWeights = {
  projectId: 'default',
  fileOverlapWeight: 0.25,
  dependencyWeight: 0.30,
  semanticWeight: 0.20,
  categoryWeight: 0.10,
  componentWeight: 0.15,
  minGroupSize: 2,
  maxGroupSize: 20,
  similarityThreshold: 0.6,
};

/**
 * Task info for scoring
 */
interface TaskInfo {
  id: string;
  displayId: string;
  title: string;
  description: string;
  category: TaskCategory;
  filePaths: string[];
  dependencies: string[];
  componentTypes: string[];
}

/**
 * Analyze all tasks in the Evaluation Queue for grouping opportunities
 *
 * @param projectId Optional project filter
 */
export async function analyzeTasks(
  projectId?: string
): Promise<GroupingSuggestion[]> {
  // Get ungrouped tasks
  const tasks = await query<{
    id: string;
    display_id: string;
    title: string;
    description: string | null;
    category: string;
    project_id: string | null;
  }>(
    `SELECT id, display_id, title, description, category, project_id
     FROM tasks
     WHERE queue = 'evaluation'
     ${projectId ? 'AND project_id = ?' : ''}
     ORDER BY created_at ASC`,
    projectId ? [projectId] : []
  );

  if (tasks.length < 2) {
    return []; // Not enough tasks to group
  }

  // Enrich tasks with additional data
  const enrichedTasks: TaskInfo[] = await Promise.all(
    tasks.map(async (task) => {
      const filePaths = await query<{ file_path: string }>(
        'SELECT file_path FROM task_file_impacts WHERE task_id = ?',
        [task.id]
      );

      const dependencies = await query<{ target_task_id: string }>(
        `SELECT target_task_id FROM task_relationships
         WHERE source_task_id = ? AND relationship_type = 'depends_on'`,
        [task.id]
      );

      const components = await query<{ component_type: string }>(
        'SELECT component_type FROM task_components WHERE task_id = ?',
        [task.id]
      );

      return {
        id: task.id,
        displayId: task.display_id,
        title: task.title,
        description: task.description || '',
        category: task.category as TaskCategory,
        filePaths: filePaths.map((f) => f.file_path),
        dependencies: dependencies.map((d) => d.target_task_id),
        componentTypes: components.map((c) => c.component_type),
      };
    })
  );

  // Get weights for project
  const weights = await getWeights(projectId || 'default');

  // Calculate pairwise similarity scores
  const pairs: Array<{
    task1: TaskInfo;
    task2: TaskInfo;
    score: number;
    reasons: string[];
  }> = [];

  for (let i = 0; i < enrichedTasks.length; i++) {
    for (let j = i + 1; j < enrichedTasks.length; j++) {
      const result = calculateGroupingScore(
        enrichedTasks[i],
        enrichedTasks[j],
        weights
      );
      if (result.score >= weights.similarityThreshold) {
        pairs.push({
          task1: enrichedTasks[i],
          task2: enrichedTasks[j],
          score: result.score,
          reasons: result.reasons,
        });
      }
    }
  }

  // Cluster high-scoring pairs into groups
  const suggestions = clusterIntoSuggestions(pairs, enrichedTasks, weights, projectId);

  return suggestions;
}

/**
 * Calculate grouping score between two tasks
 */
export function calculateGroupingScore(
  task1: TaskInfo,
  task2: TaskInfo,
  weights: GroupingCriteriaWeights
): { score: number; reasons: string[] } {
  let totalScore = 0;
  const reasons: string[] = [];

  // File overlap score
  const fileOverlap = calculateFileOverlap(task1.filePaths, task2.filePaths);
  if (fileOverlap > 0) {
    totalScore += fileOverlap * weights.fileOverlapWeight;
    reasons.push(`${Math.round(fileOverlap * 100)}% file overlap`);
  }

  // Dependency score
  const dependencyScore = calculateDependencyScore(task1, task2);
  if (dependencyScore > 0) {
    totalScore += dependencyScore * weights.dependencyWeight;
    reasons.push('Related by dependencies');
  }

  // Semantic similarity (simple word overlap for now)
  const semanticScore = calculateSemanticScore(task1, task2);
  if (semanticScore > 0.3) {
    totalScore += semanticScore * weights.semanticWeight;
    reasons.push(`${Math.round(semanticScore * 100)}% title similarity`);
  }

  // Category match
  if (task1.category === task2.category) {
    totalScore += weights.categoryWeight;
    reasons.push(`Same category (${task1.category})`);
  }

  // Component type overlap
  const componentOverlap = calculateComponentOverlap(
    task1.componentTypes,
    task2.componentTypes
  );
  if (componentOverlap > 0) {
    totalScore += componentOverlap * weights.componentWeight;
    reasons.push('Same component types');
  }

  return { score: totalScore, reasons };
}

/**
 * Calculate file path overlap between two tasks
 */
function calculateFileOverlap(paths1: string[], paths2: string[]): number {
  if (paths1.length === 0 || paths2.length === 0) {
    return 0;
  }

  // Normalize paths and find overlap
  const set1 = new Set(paths1.map(normalizeFilePath));
  const set2 = new Set(paths2.map(normalizeFilePath));

  let overlap = 0;
  for (const path of set1) {
    if (set2.has(path)) {
      overlap++;
    }
  }

  return overlap / Math.max(set1.size, set2.size);
}

/**
 * Normalize file path for comparison (remove wildcards, etc.)
 */
function normalizeFilePath(path: string): string {
  // Remove glob wildcards and get directory
  return path
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

/**
 * Calculate dependency score
 */
function calculateDependencyScore(task1: TaskInfo, task2: TaskInfo): number {
  // Check if either task depends on the other
  if (
    task1.dependencies.includes(task2.id) ||
    task2.dependencies.includes(task1.id)
  ) {
    return 1.0;
  }

  // Check for common dependencies
  const common = task1.dependencies.filter((d) =>
    task2.dependencies.includes(d)
  );
  if (common.length > 0) {
    return 0.7;
  }

  return 0;
}

/**
 * Calculate semantic similarity (simple word overlap)
 */
function calculateSemanticScore(task1: TaskInfo, task2: TaskInfo): number {
  const words1 = new Set(
    (task1.title + ' ' + task1.description)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const words2 = new Set(
    (task2.title + ' ' + task2.description)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate component type overlap
 */
function calculateComponentOverlap(types1: string[], types2: string[]): number {
  if (types1.length === 0 || types2.length === 0) {
    return 0;
  }

  const set1 = new Set(types1);
  const set2 = new Set(types2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  return intersection.size / Math.max(set1.size, set2.size);
}

/**
 * Cluster similar pairs into group suggestions
 */
function clusterIntoSuggestions(
  pairs: Array<{ task1: TaskInfo; task2: TaskInfo; score: number; reasons: string[] }>,
  allTasks: TaskInfo[],
  weights: GroupingCriteriaWeights,
  projectId?: string
): GroupingSuggestion[] {
  // Simple greedy clustering
  const taskGroups: Map<string, Set<string>> = new Map();
  const taskReasons: Map<string, Set<string>> = new Map();

  for (const pair of pairs) {
    const group1 = findGroupForTask(pair.task1.id, taskGroups);
    const group2 = findGroupForTask(pair.task2.id, taskGroups);

    if (group1 && group2 && group1 !== group2) {
      // Merge groups if combined size is within limit
      const combinedSize = taskGroups.get(group1)!.size + taskGroups.get(group2)!.size;
      if (combinedSize <= weights.maxGroupSize) {
        const merged = new Set([
          ...taskGroups.get(group1)!,
          ...taskGroups.get(group2)!,
        ]);
        taskGroups.delete(group2);
        taskGroups.set(group1, merged);

        // Merge reasons
        const mergedReasons = new Set([
          ...(taskReasons.get(group1) || []),
          ...(taskReasons.get(group2) || []),
        ]);
        taskReasons.set(group1, mergedReasons);
      }
    } else if (group1 && !group2) {
      if (taskGroups.get(group1)!.size < weights.maxGroupSize) {
        taskGroups.get(group1)!.add(pair.task2.id);
        for (const reason of pair.reasons) {
          if (!taskReasons.has(group1)) taskReasons.set(group1, new Set());
          taskReasons.get(group1)!.add(reason);
        }
      }
    } else if (!group1 && group2) {
      if (taskGroups.get(group2)!.size < weights.maxGroupSize) {
        taskGroups.get(group2)!.add(pair.task1.id);
        for (const reason of pair.reasons) {
          if (!taskReasons.has(group2)) taskReasons.set(group2, new Set());
          taskReasons.get(group2)!.add(reason);
        }
      }
    } else if (!group1 && !group2) {
      // Create new group
      const groupId = uuidv4();
      taskGroups.set(groupId, new Set([pair.task1.id, pair.task2.id]));
      taskReasons.set(groupId, new Set(pair.reasons));
    }
  }

  // Convert groups to suggestions
  const suggestions: GroupingSuggestion[] = [];
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  for (const [groupId, taskIds] of taskGroups) {
    if (taskIds.size < weights.minGroupSize) {
      continue;
    }

    const groupTasks = Array.from(taskIds).map((id) => taskMap.get(id)!);
    const reasons = Array.from(taskReasons.get(groupId) || []);

    // Generate name from common words
    const suggestedName = generateGroupName(groupTasks);

    suggestions.push({
      id: uuidv4(),
      status: 'pending',
      suggestedName,
      suggestedTasks: Array.from(taskIds),
      groupingReason: reasons.join('; '),
      similarityScore: 0.7, // Placeholder
      projectId,
      triggeredBy: 'task_created',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return suggestions;
}

/**
 * Find which group a task belongs to
 */
function findGroupForTask(
  taskId: string,
  groups: Map<string, Set<string>>
): string | null {
  for (const [groupId, members] of groups) {
    if (members.has(taskId)) {
      return groupId;
    }
  }
  return null;
}

/**
 * Generate a group name from common words in task titles
 */
function generateGroupName(tasks: TaskInfo[]): string {
  const wordCounts: Map<string, number> = new Map();

  for (const task of tasks) {
    const words = task.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  const commonWords = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= Math.ceil(tasks.length / 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  if (commonWords.length > 0) {
    return `${commonWords.join(' ')} Tasks`;
  }

  return `Related Tasks (${tasks.length} items)`;
}

/**
 * Generate a suggestion and save to database
 */
export async function generateSuggestion(
  taskIds: string[],
  reason: string,
  projectId?: string,
  triggerTaskId?: string
): Promise<GroupingSuggestion> {
  const tasks = await query<{ id: string; title: string }>(
    `SELECT id, title FROM tasks WHERE id IN (${taskIds.map(() => '?').join(', ')})`,
    taskIds
  );

  const taskInfos = tasks.map((t) => ({
    id: t.id,
    displayId: '',
    title: t.title,
    description: '',
    category: 'task' as TaskCategory,
    filePaths: [],
    dependencies: [],
    componentTypes: [],
  }));

  const suggestedName = generateGroupName(taskInfos);

  const suggestion: GroupingSuggestion = {
    id: uuidv4(),
    status: 'pending',
    suggestedName,
    suggestedTasks: taskIds,
    groupingReason: reason,
    projectId,
    triggeredBy: 'task_created',
    triggerTaskId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Save to database
  await run(
    `INSERT INTO grouping_suggestions (
      id, status, suggested_name, suggested_tasks, grouping_reason,
      project_id, triggered_by, trigger_task_id, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      suggestion.id,
      suggestion.status,
      suggestion.suggestedName,
      JSON.stringify(suggestion.suggestedTasks),
      suggestion.groupingReason,
      suggestion.projectId || null,
      suggestion.triggeredBy || null,
      suggestion.triggerTaskId || null,
      suggestion.expiresAt || null,
    ]
  );

  // Save suggestion-task links
  for (const taskId of taskIds) {
    await run(
      `INSERT INTO suggestion_tasks (id, suggestion_id, task_id)
       VALUES (?, ?, ?)`,
      [uuidv4(), suggestion.id, taskId]
    );
  }

  await saveDb();

  return suggestion;
}

/**
 * Handle trigger event (task creation or dependency change)
 */
export async function handleTrigger(
  trigger: GroupingTrigger,
  taskId: string,
  projectId?: string
): Promise<GroupingSuggestion | null> {
  // Run analysis
  const suggestions = await analyzeTasks(projectId);

  // Find suggestion containing the trigger task
  const relevantSuggestion = suggestions.find((s) =>
    s.suggestedTasks.includes(taskId)
  );

  if (relevantSuggestion) {
    // Save if not already saved
    const existing = await getOne<{ id: string }>(
      'SELECT id FROM grouping_suggestions WHERE id = ?',
      [relevantSuggestion.id]
    );

    if (!existing) {
      await run(
        `INSERT INTO grouping_suggestions (
          id, status, suggested_name, suggested_tasks, grouping_reason,
          similarity_score, project_id, triggered_by, trigger_task_id, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          relevantSuggestion.id,
          relevantSuggestion.status,
          relevantSuggestion.suggestedName,
          JSON.stringify(relevantSuggestion.suggestedTasks),
          relevantSuggestion.groupingReason,
          relevantSuggestion.similarityScore || null,
          relevantSuggestion.projectId || null,
          trigger,
          taskId,
          relevantSuggestion.expiresAt || null,
        ]
      );

      for (const tid of relevantSuggestion.suggestedTasks) {
        await run(
          `INSERT INTO suggestion_tasks (id, suggestion_id, task_id)
           VALUES (?, ?, ?)`,
          [uuidv4(), relevantSuggestion.id, tid]
        );
      }

      await saveDb();
    }
  }

  return relevantSuggestion || null;
}

/**
 * Get grouping weights for a project
 */
export async function getWeights(projectId: string): Promise<GroupingCriteriaWeights> {
  const row = await getOne<{
    project_id: string;
    file_overlap_weight: number;
    dependency_weight: number;
    semantic_weight: number;
    category_weight: number;
    component_weight: number;
    min_group_size: number;
    max_group_size: number;
    similarity_threshold: number;
  }>('SELECT * FROM grouping_criteria_weights WHERE project_id = ?', [projectId]);

  if (!row) {
    return DEFAULT_WEIGHTS;
  }

  return {
    projectId: row.project_id,
    fileOverlapWeight: row.file_overlap_weight,
    dependencyWeight: row.dependency_weight,
    semanticWeight: row.semantic_weight,
    categoryWeight: row.category_weight,
    componentWeight: row.component_weight,
    minGroupSize: row.min_group_size,
    maxGroupSize: row.max_group_size,
    similarityThreshold: row.similarity_threshold,
  };
}

/**
 * Update grouping weights for a project
 */
export async function updateWeights(
  projectId: string,
  weights: Partial<GroupingCriteriaWeights>
): Promise<GroupingCriteriaWeights> {
  const current = await getWeights(projectId);
  const updated = { ...current, ...weights, projectId };

  await run(
    `INSERT INTO grouping_criteria_weights (
      id, project_id, file_overlap_weight, dependency_weight, semantic_weight,
      category_weight, component_weight, min_group_size, max_group_size, similarity_threshold
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      file_overlap_weight = excluded.file_overlap_weight,
      dependency_weight = excluded.dependency_weight,
      semantic_weight = excluded.semantic_weight,
      category_weight = excluded.category_weight,
      component_weight = excluded.component_weight,
      min_group_size = excluded.min_group_size,
      max_group_size = excluded.max_group_size,
      similarity_threshold = excluded.similarity_threshold,
      updated_at = datetime('now')`,
    [
      uuidv4(),
      projectId,
      updated.fileOverlapWeight,
      updated.dependencyWeight,
      updated.semanticWeight,
      updated.categoryWeight,
      updated.componentWeight,
      updated.minGroupSize,
      updated.maxGroupSize,
      updated.similarityThreshold,
    ]
  );

  await saveDb();

  return updated;
}

/**
 * Expire old suggestions
 */
export async function expireOldSuggestions(): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM grouping_suggestions
     WHERE status = 'pending'
       AND expires_at IS NOT NULL
       AND expires_at < datetime('now')`,
  );

  await run(
    `UPDATE grouping_suggestions
     SET status = 'expired'
     WHERE status = 'pending'
       AND expires_at IS NOT NULL
       AND expires_at < datetime('now')`,
  );

  await saveDb();

  return result?.count || 0;
}

/**
 * Get pending suggestions
 */
export async function getPendingSuggestions(
  projectId?: string
): Promise<GroupingSuggestion[]> {
  let sql = `
    SELECT * FROM grouping_suggestions
    WHERE status = 'pending'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
  `;
  const params: string[] = [];

  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await query<GroupingSuggestionRow>(sql, params);
  return rows.map(mapSuggestionRow);
}

/**
 * Accept a suggestion and create a task list
 */
export async function acceptSuggestion(
  suggestionId: string,
  listName?: string
): Promise<{ taskListId: string; tasksMoved: number }> {
  const suggestion = await getOne<GroupingSuggestionRow>(
    'SELECT * FROM grouping_suggestions WHERE id = ?',
    [suggestionId]
  );

  if (!suggestion) {
    throw new Error(`Suggestion ${suggestionId} not found`);
  }

  const taskIds: string[] = JSON.parse(suggestion.suggested_tasks);
  const name = listName || suggestion.suggested_name;

  // Create task list
  const taskListId = uuidv4();
  await run(
    `INSERT INTO task_lists_v2 (id, name, project_id, status, total_tasks)
     VALUES (?, ?, ?, 'draft', ?)`,
    [taskListId, name, suggestion.project_id, taskIds.length]
  );

  // Move tasks to list
  let position = 0;
  for (const taskId of taskIds) {
    await run(
      `UPDATE tasks
       SET queue = NULL,
           task_list_id = ?,
           status = 'pending',
           position = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [taskListId, position++, taskId]
    );
  }

  // Update suggestion
  await run(
    `UPDATE grouping_suggestions
     SET status = 'accepted',
         created_task_list_id = ?,
         resolved_by = 'user',
         resolved_at = datetime('now')
     WHERE id = ?`,
    [taskListId, suggestionId]
  );

  await saveDb();

  return { taskListId, tasksMoved: taskIds.length };
}

/**
 * Reject a suggestion
 */
export async function rejectSuggestion(suggestionId: string): Promise<void> {
  await run(
    `UPDATE grouping_suggestions
     SET status = 'rejected',
         resolved_by = 'user',
         resolved_at = datetime('now')
     WHERE id = ?`,
    [suggestionId]
  );
  await saveDb();
}

export default {
  analyzeTasks,
  calculateGroupingScore,
  generateSuggestion,
  handleTrigger,
  getWeights,
  updateWeights,
  expireOldSuggestions,
  getPendingSuggestions,
  acceptSuggestion,
  rejectSuggestion,
};
