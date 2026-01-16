/**
 * Task Creation Service
 *
 * Service for creating tasks - either directly in a task list or as
 * listless tasks in the Evaluation Queue.
 *
 * Part of: PTE-034 to PTE-038
 */

import { v4 as uuidv4 } from "uuid";
import { run, getOne, saveDb } from "../../../database/db.js";
import {
  Task,
  CreateTaskInput,
  CreateTaskResponse,
  TaskCategory,
  TaskStatus,
} from "../../../types/task-agent.js";
import { generateDisplayId } from "./display-id-generator.js";
import { addToQueue } from "./evaluation-queue-manager.js";

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
 * Create a listless task in the Evaluation Queue
 *
 * This creates a task without a task list assignment, placing it in the
 * Evaluation Queue for analysis and eventual grouping.
 *
 * @param input Task creation input
 * @returns Created task and analysis info
 */
export async function createListlessTask(
  input: CreateTaskInput,
): Promise<CreateTaskResponse> {
  const id = uuidv4();
  const category = input.category || "task";

  // Generate display ID
  const displayId = await generateDisplayId(
    category as TaskCategory,
    input.projectId,
  );

  // Insert the task
  await run(
    `INSERT INTO tasks (
      id, display_id, title, description, category,
      status, queue, task_list_id, project_id,
      priority, effort, phase, position, owner
    ) VALUES (
      ?, ?, ?, ?, ?,
      'evaluating', 'evaluation', NULL, ?,
      ?, ?, ?, 0, 'build_agent'
    )`,
    [
      id,
      displayId,
      input.title,
      input.description || null,
      category,
      input.projectId || null,
      input.priority || "P2",
      input.effort || "medium",
      input.phase || 1,
    ],
  );

  await saveDb();

  // Get the created task
  const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!row) {
    throw new Error("Failed to create task");
  }

  const task = mapTaskRow(row);

  // Analysis will be triggered separately by the analysis pipeline
  return {
    task,
    inEvaluationQueue: true,
    analysisTriggered: true,
  };
}

/**
 * Create a task directly in a task list
 *
 * @param input Task creation input (must include taskListId)
 * @returns Created task
 */
export async function createTaskInList(
  input: CreateTaskInput & { taskListId: string },
): Promise<CreateTaskResponse> {
  const id = uuidv4();
  const category = input.category || "task";

  // Generate display ID
  const displayId = await generateDisplayId(
    category as TaskCategory,
    input.projectId,
  );

  // Get position for new task
  const maxPos = await getOne<{ max_pos: number | null }>(
    "SELECT MAX(position) as max_pos FROM tasks WHERE task_list_id = ?",
    [input.taskListId],
  );
  const position = (maxPos?.max_pos || 0) + 1;

  // Insert the task
  await run(
    `INSERT INTO tasks (
      id, display_id, title, description, category,
      status, queue, task_list_id, project_id,
      priority, effort, phase, position, owner
    ) VALUES (
      ?, ?, ?, ?, ?,
      'pending', NULL, ?, ?,
      ?, ?, ?, ?, 'build_agent'
    )`,
    [
      id,
      displayId,
      input.title,
      input.description || null,
      category,
      input.taskListId,
      input.projectId || null,
      input.priority || "P2",
      input.effort || "medium",
      input.phase || 1,
      position,
    ],
  );

  // Update task list stats
  await run(
    `UPDATE task_lists_v2
     SET total_tasks = total_tasks + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [input.taskListId],
  );

  await saveDb();

  // Get the created task
  const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!row) {
    throw new Error("Failed to create task");
  }

  const task = mapTaskRow(row);

  return {
    task,
    inEvaluationQueue: false,
    analysisTriggered: false, // Analysis not needed for tasks already in a list
  };
}

/**
 * Create a task (routes to appropriate method based on taskListId)
 *
 * @param input Task creation input
 * @returns Created task and analysis info
 */
export async function createTask(
  input: CreateTaskInput,
): Promise<CreateTaskResponse> {
  if (input.taskListId) {
    return createTaskInList({ ...input, taskListId: input.taskListId });
  }
  return createListlessTask(input);
}

/**
 * Get a task by ID
 */
export async function getTaskById(taskId: string): Promise<Task | null> {
  const row = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
    taskId,
  ]);
  if (!row) {
    return null;
  }
  return mapTaskRow(row);
}

/**
 * Get a task by display ID
 */
export async function getTaskByDisplayId(
  displayId: string,
): Promise<Task | null> {
  const row = await getOne<TaskRow>(
    "SELECT * FROM tasks WHERE display_id = ?",
    [displayId],
  );
  if (!row) {
    return null;
  }
  return mapTaskRow(row);
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  const task = await getTaskById(taskId);
  if (!task) {
    return false;
  }

  // If task was in a list, update the list stats
  if (task.taskListId) {
    await run(
      `UPDATE task_lists_v2
       SET total_tasks = total_tasks - 1,
           updated_at = datetime('now')
       WHERE id = ?`,
      [task.taskListId],
    );
  }

  // Delete related records first (cascades should handle most)
  await run(
    "DELETE FROM task_relationships WHERE source_task_id = ? OR target_task_id = ?",
    [taskId, taskId],
  );
  await run("DELETE FROM task_file_impacts WHERE task_id = ?", [taskId]);
  await run("DELETE FROM task_components WHERE task_id = ?", [taskId]);
  await run("DELETE FROM task_embeddings WHERE task_id = ?", [taskId]);

  // Delete the task
  await run("DELETE FROM tasks WHERE id = ?", [taskId]);
  await saveDb();

  return true;
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Task | null> {
  const task = await getTaskById(taskId);
  if (!task) {
    return null;
  }

  const updates: string[] = ["status = ?", "updated_at = datetime('now')"];
  const params: (string | null)[] = [status];

  // Set timestamps based on status
  if (status === "in_progress" && !task.startedAt) {
    updates.push("started_at = datetime('now')");
  }
  if (status === "completed" || status === "failed" || status === "skipped") {
    updates.push("completed_at = datetime('now')");
  }

  params.push(taskId);

  await run(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`, params);

  // Update task list stats if applicable
  if (task.taskListId && (status === "completed" || status === "failed")) {
    const column = status === "completed" ? "completed_tasks" : "failed_tasks";
    await run(
      `UPDATE task_lists_v2
       SET ${column} = ${column} + 1,
           updated_at = datetime('now')
       WHERE id = ?`,
      [task.taskListId],
    );
  }

  await saveDb();

  return getTaskById(taskId);
}

/**
 * Bulk create tasks from a list of inputs
 */
export async function bulkCreateTasks(
  inputs: CreateTaskInput[],
): Promise<CreateTaskResponse[]> {
  const results: CreateTaskResponse[] = [];

  for (const input of inputs) {
    try {
      const result = await createTask(input);
      results.push(result);
    } catch (error) {
      console.error(`Failed to create task "${input.title}":`, error);
      // Continue with remaining tasks
    }
  }

  return results;
}

export default {
  createListlessTask,
  createTaskInList,
  createTask,
  getTaskById,
  getTaskByDisplayId,
  deleteTask,
  updateTaskStatus,
  bulkCreateTasks,
};
