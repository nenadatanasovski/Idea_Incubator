/**
 * Evaluation Queue Manager
 *
 * Manages the Evaluation Queue - a staging area for listless tasks
 * that haven't been assigned to a task list yet.
 *
 * Part of: PTE-029 to PTE-033
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  Task,
  EvaluationQueueTask,
  EvaluationQueueStats,
  TaskIdentity,
  UpdateTaskInput,
} from "../../../types/task-agent.js";
import { generateDisplayId } from "./display-id-generator.js";

/**
 * Database row type for tasks
 */
interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  queue: string | null;
  task_list_id: string | null;
  project_id: string | null;
  priority: string;
  effort: string;
  phase: number;
  position: number;
  owner: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Map database row to Task object
 */
function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    displayId: row.display_id,
    title: row.title,
    description: row.description || undefined,
    category: row.category as Task["category"],
    status: row.status as Task["status"],
    queue: row.queue as Task["queue"],
    taskListId: row.task_list_id || undefined,
    projectId: row.project_id || undefined,
    priority: row.priority as Task["priority"],
    effort: row.effort as Task["effort"],
    phase: row.phase,
    position: row.position,
    owner: row.owner as Task["owner"],
    assignedAgentId: row.assigned_agent_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Add a task to the Evaluation Queue
 *
 * @param taskId Task ID to add to queue
 */
export async function addToQueue(taskId: string): Promise<void> {
  await run(
    `UPDATE tasks
     SET queue = 'evaluation',
         task_list_id = NULL,
         status = 'evaluating',
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskId],
  );
  await saveDb();
}

/**
 * Get all tasks in the Evaluation Queue
 *
 * @param projectId Optional filter by project
 * @param limit Maximum number of tasks to return
 * @param offset Offset for pagination
 */
export async function getQueuedTasks(
  projectId?: string,
  limit = 50,
  offset = 0,
): Promise<EvaluationQueueTask[]> {
  let sql = `
    SELECT
      t.*,
      julianday('now') - julianday(t.created_at) AS days_in_queue
    FROM tasks t
    WHERE t.queue = 'evaluation'
  `;
  const params: (string | number)[] = [];

  if (projectId) {
    sql += " AND t.project_id = ?";
    params.push(projectId);
  }

  sql += " ORDER BY t.created_at ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await query<TaskRow & { days_in_queue: number }>(sql, params);

  return rows.map((row) => ({
    ...mapTaskRow(row),
    queue: "evaluation" as const,
    taskListId: undefined,
    daysInQueue: row.days_in_queue,
    isStale: row.days_in_queue > 3,
  }));
}

/**
 * Get a single task from the Evaluation Queue by ID
 */
export async function getQueuedTask(
  taskId: string,
): Promise<EvaluationQueueTask | null> {
  const row = await getOne<TaskRow & { days_in_queue: number }>(
    `SELECT
      t.*,
      julianday('now') - julianday(t.created_at) AS days_in_queue
    FROM tasks t
    WHERE t.id = ? AND t.queue = 'evaluation'`,
    [taskId],
  );

  if (!row) {
    return null;
  }

  return {
    ...mapTaskRow(row),
    queue: "evaluation" as const,
    taskListId: undefined,
    daysInQueue: row.days_in_queue,
    isStale: row.days_in_queue > 3,
  };
}

/**
 * Move a task from Evaluation Queue to a Task List
 *
 * @param taskId Task to move
 * @param taskListId Target task list
 * @param position Optional position within the list
 */
export async function moveToTaskList(
  taskId: string,
  taskListId: string,
  position?: number,
): Promise<Task> {
  // Get current max position in target list if not specified
  let targetPosition = position;
  if (targetPosition === undefined) {
    const maxPos = await getOne<{ max_pos: number | null }>(
      "SELECT MAX(position) as max_pos FROM tasks WHERE task_list_id = ?",
      [taskListId],
    );
    targetPosition = (maxPos?.max_pos || 0) + 1;
  }

  await run(
    `UPDATE tasks
     SET queue = NULL,
         task_list_id = ?,
         position = ?,
         status = 'pending',
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskListId, targetPosition, taskId],
  );

  // Update task list stats
  await run(
    `UPDATE task_lists_v2
     SET total_tasks = total_tasks + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskListId],
  );

  await saveDb();

  // Return updated task
  const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
    taskId,
  ]);

  if (!row) {
    throw new Error(`Task ${taskId} not found after move`);
  }

  return mapTaskRow(row);
}

/**
 * Get stale tasks (older than specified days)
 *
 * @param daysThreshold Days threshold (default: 3)
 * @param projectId Optional filter by project
 */
export async function getStaleQueuedTasks(
  daysThreshold = 3,
  projectId?: string,
): Promise<EvaluationQueueTask[]> {
  let sql = `
    SELECT
      t.*,
      julianday('now') - julianday(t.created_at) AS days_in_queue
    FROM tasks t
    WHERE t.queue = 'evaluation'
      AND julianday('now') - julianday(t.created_at) > ?
  `;
  const params: (string | number)[] = [daysThreshold];

  if (projectId) {
    sql += " AND t.project_id = ?";
    params.push(projectId);
  }

  sql += " ORDER BY t.created_at ASC";

  const rows = await query<TaskRow & { days_in_queue: number }>(sql, params);

  return rows.map((row) => ({
    ...mapTaskRow(row),
    queue: "evaluation" as const,
    taskListId: undefined,
    daysInQueue: row.days_in_queue,
    isStale: true,
  }));
}

/**
 * Get Evaluation Queue statistics
 */
export async function getQueueStats(
  projectId?: string,
): Promise<EvaluationQueueStats> {
  let sql = `
    SELECT
      COUNT(*) AS total_queued,
      SUM(CASE WHEN julianday('now') - julianday(created_at) > 3 THEN 1 ELSE 0 END) AS stale_count,
      SUM(CASE WHEN julianday('now') - julianday(created_at) < 1 THEN 1 ELSE 0 END) AS new_today,
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
 * Update a task in the Evaluation Queue
 *
 * @param taskId Task ID
 * @param updates Fields to update
 */
export async function updateTask(
  taskId: string,
  updates: UpdateTaskInput,
): Promise<Task> {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push("description = ?");
    params.push(updates.description);
  }
  if (updates.category !== undefined) {
    setClauses.push("category = ?");
    params.push(updates.category);
  }
  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    params.push(updates.status);
  }
  if (updates.priority !== undefined) {
    setClauses.push("priority = ?");
    params.push(updates.priority);
  }
  if (updates.effort !== undefined) {
    setClauses.push("effort = ?");
    params.push(updates.effort);
  }
  if (updates.phase !== undefined) {
    setClauses.push("phase = ?");
    params.push(updates.phase);
  }
  if (updates.position !== undefined) {
    setClauses.push("position = ?");
    params.push(updates.position);
  }
  if (updates.owner !== undefined) {
    setClauses.push("owner = ?");
    params.push(updates.owner);
  }
  if (updates.assignedAgentId !== undefined) {
    setClauses.push("assigned_agent_id = ?");
    params.push(updates.assignedAgentId);
  }

  if (setClauses.length === 0) {
    // No updates, just return current task
    const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);
    if (!row) {
      throw new Error(`Task ${taskId} not found`);
    }
    return mapTaskRow(row);
  }

  setClauses.push("updated_at = datetime('now')");
  params.push(taskId);

  await run(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`, params);

  await saveDb();

  const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
    taskId,
  ]);
  if (!row) {
    throw new Error(`Task ${taskId} not found after update`);
  }

  return mapTaskRow(row);
}

/**
 * Remove a task from the Evaluation Queue without moving to a list
 * (marks as draft, removes from queue)
 */
export async function removeFromQueue(taskId: string): Promise<void> {
  await run(
    `UPDATE tasks
     SET queue = NULL,
         status = 'draft',
         updated_at = datetime('now')
     WHERE id = ? AND queue = 'evaluation'`,
    [taskId],
  );
  await saveDb();
}

/**
 * Delete a task from the Evaluation Queue
 */
export async function deleteFromQueue(taskId: string): Promise<boolean> {
  // First verify it's in the queue
  const task = await getQueuedTask(taskId);
  if (!task) {
    return false;
  }

  await run("DELETE FROM tasks WHERE id = ?", [taskId]);
  await saveDb();
  return true;
}

/**
 * Get count of tasks in Evaluation Queue
 */
export async function getQueueCount(projectId?: string): Promise<number> {
  let sql = "SELECT COUNT(*) as count FROM tasks WHERE queue = 'evaluation'";
  const params: string[] = [];

  if (projectId) {
    sql += " AND project_id = ?";
    params.push(projectId);
  }

  const result = await getOne<{ count: number }>(sql, params);
  return result?.count || 0;
}

/**
 * Generate daily digest content for Telegram notification
 */
export async function generateDailyDigest(projectId?: string): Promise<{
  totalQueued: number;
  staleCount: number;
  newToday: number;
  staleTasks: Array<{ displayId: string; title: string; daysInQueue: number }>;
  needsAttention: boolean;
}> {
  const stats = await getQueueStats(projectId);
  const staleTasks = await getStaleQueuedTasks(3, projectId);

  return {
    totalQueued: stats.totalQueued,
    staleCount: stats.staleCount,
    newToday: stats.newToday,
    staleTasks: staleTasks.slice(0, 5).map((t) => ({
      displayId: t.displayId,
      title: t.title,
      daysInQueue: Math.floor(t.daysInQueue),
    })),
    needsAttention: stats.staleCount > 0 || stats.totalQueued > 10,
  };
}

export default {
  addToQueue,
  getQueuedTasks,
  getQueuedTask,
  moveToTaskList,
  getStaleQueuedTasks,
  getQueueStats,
  updateTask,
  removeFromQueue,
  deleteFromQueue,
  getQueueCount,
  generateDailyDigest,
};
