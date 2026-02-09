/**
 * Task List Converter
 *
 * Converts approved specs into task lists for the Task Agent.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-008-A, SPEC-008-E)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import type { Spec, SpecSection } from "../../../types/spec.js";

export interface TaskListCreationResult {
  success: boolean;
  taskListId?: string;
  taskListName?: string;
  taskCount?: number;
  error?: string;
}

export interface TaskFromSpec {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  sourceSection: string;
}

/**
 * Convert a spec into a task list
 */
export async function convertSpecToTaskList(
  spec: Spec,
  options: {
    generateTasks?: boolean;
    projectId?: string;
  } = {},
): Promise<TaskListCreationResult> {
  const { generateTasks = true, projectId } = options;

  try {
    // Generate task list ID and name
    const taskListId = `tl_${uuidv4()}`;
    const taskListName = `${spec.title} - Tasks`;

    // Create the task list linked to the spec
    await createTaskList({
      id: taskListId,
      name: taskListName,
      description: `Task list generated from spec: ${spec.title}`,
      sourceSpecId: spec.id,
      projectId,
    });

    let taskCount = 0;

    // Optionally generate initial tasks from spec
    if (generateTasks) {
      const tasks = await generateInitialTasks(spec, taskListId);
      taskCount = tasks.length;
    }

    return {
      success: true,
      taskListId,
      taskListName,
      taskCount,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create task list",
    };
  }
}

/**
 * Create a task list in the database
 */
async function createTaskList(data: {
  id: string;
  name: string;
  description: string;
  sourceSpecId: string;
  projectId?: string;
}): Promise<void> {
  const { id, name, description, sourceSpecId, projectId } = data;
  const now = new Date().toISOString();

  await run(
    `INSERT INTO task_lists_v2 (id, name, description, status, source_spec_id, project_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    [id, name, description, sourceSpecId, projectId || null, now, now],
  );
  await saveDb();
}

// Database row type for spec_sections
interface SpecSectionRow {
  id: string;
  spec_id: string;
  section_type: string;
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Generate initial tasks from a spec's success criteria
 */
export async function generateInitialTasks(
  spec: Spec,
  taskListId: string,
): Promise<TaskFromSpec[]> {
  const tasks: TaskFromSpec[] = [];

  // Get spec sections
  const sections = await getSpecSections(spec.id);

  // Generate tasks from success criteria
  const successCriteriaSection = sections.find(
    (s) => s.sectionType === "success_criteria",
  );

  if (successCriteriaSection) {
    const criteria = successCriteriaSection.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i].replace(/^[-*•]\s*/, ""); // Remove bullet points

      if (criterion.length > 5) {
        // Only meaningful criteria
        const task = createTaskFromCriterion(criterion, taskListId, i + 1);
        tasks.push(task);

        // Insert task into database
        await insertTask(task, taskListId);
      }
    }
  }

  // Generate tasks from functional requirements if no success criteria
  if (tasks.length === 0) {
    const funcDescSection = sections.find(
      (s) => s.sectionType === "functional_desc",
    );

    if (funcDescSection) {
      // Extract features from functional description
      const features = extractFeatures(funcDescSection.content);

      for (let i = 0; i < features.length; i++) {
        const task = createTaskFromFeature(features[i], taskListId, i + 1);
        tasks.push(task);
        await insertTask(task, taskListId);
      }
    }
  }

  return tasks;
}

/**
 * Get spec sections from database
 */
async function getSpecSections(specId: string): Promise<SpecSection[]> {
  const rows = await query<SpecSectionRow>(
    `SELECT * FROM spec_sections WHERE spec_id = ?`,
    [specId],
  );

  return (rows || []).map((row) => ({
    id: row.id,
    specId: row.spec_id,
    sectionType: row.section_type,
    content: row.content,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) as SpecSection[];
}

/**
 * Create a task from a success criterion
 */
function createTaskFromCriterion(
  criterion: string,
  _taskListId: string,
  index: number,
): TaskFromSpec {
  // Infer category from criterion content
  const category = inferCategory(criterion);

  return {
    id: `task_${uuidv4()}`,
    title: truncate(criterion, 100),
    description: `Implement: ${criterion}`,
    category,
    priority: calculatePriority(criterion, index),
    sourceSection: "success_criteria",
  };
}

/**
 * Create a task from a feature description
 */
function createTaskFromFeature(
  feature: string,
  _taskListId: string,
  index: number,
): TaskFromSpec {
  const category = inferCategory(feature);

  return {
    id: `task_${uuidv4()}`,
    title: truncate(feature, 100),
    description: `Implement feature: ${feature}`,
    category,
    priority: calculatePriority(feature, index),
    sourceSection: "functional_desc",
  };
}

/**
 * Extract features from a functional description
 */
function extractFeatures(content: string): string[] {
  const lines = content.split("\n");
  const features: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for list items or sentences that describe features
    if (
      trimmed.match(/^[-*•]\s+/) ||
      trimmed.match(/^\d+\.\s+/) ||
      (trimmed.length > 20 && trimmed.includes("should"))
    ) {
      const feature = trimmed.replace(/^[-*•\d.]\s*/, "").trim();
      if (feature.length > 5) {
        features.push(feature);
      }
    }
  }

  // Limit to reasonable number of initial tasks
  return features.slice(0, 10);
}

/**
 * Infer task category from content
 */
function inferCategory(content: string): string {
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes("test") ||
    lowerContent.includes("verify") ||
    lowerContent.includes("validate")
  ) {
    return "test";
  }
  if (
    lowerContent.includes("api") ||
    lowerContent.includes("endpoint") ||
    lowerContent.includes("route")
  ) {
    return "api";
  }
  if (
    lowerContent.includes("database") ||
    lowerContent.includes("schema") ||
    lowerContent.includes("migration")
  ) {
    return "database";
  }
  if (
    lowerContent.includes("ui") ||
    lowerContent.includes("component") ||
    lowerContent.includes("page") ||
    lowerContent.includes("display")
  ) {
    return "ui";
  }
  if (
    lowerContent.includes("fix") ||
    lowerContent.includes("bug") ||
    lowerContent.includes("error")
  ) {
    return "bug";
  }
  if (lowerContent.includes("document") || lowerContent.includes("readme")) {
    return "documentation";
  }

  return "feature";
}

/**
 * Calculate priority based on content and position
 */
function calculatePriority(content: string, index: number): number {
  let priority = 50; // Default medium priority

  const lowerContent = content.toLowerCase();

  // Higher priority keywords
  if (
    lowerContent.includes("critical") ||
    lowerContent.includes("must") ||
    lowerContent.includes("required")
  ) {
    priority += 30;
  }

  // Lower priority keywords
  if (
    lowerContent.includes("nice to have") ||
    lowerContent.includes("optional") ||
    lowerContent.includes("should")
  ) {
    priority -= 20;
  }

  // Earlier items slightly higher priority
  priority -= Math.min(index * 2, 20);

  return Math.max(10, Math.min(100, priority));
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Insert a task into the database
 */
async function insertTask(
  task: TaskFromSpec,
  taskListId: string,
): Promise<void> {
  const now = new Date().toISOString();

  try {
    await run(
      `INSERT INTO tasks (id, title, description, category, priority, status, task_list_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.category,
        task.priority,
        taskListId,
        now,
        now,
      ],
    );
    await saveDb();
  } catch (err) {
    console.error("Failed to insert task:", err);
    // Don't throw - task list creation should succeed even if some tasks fail
  }
}

// Database row type for task_lists_v2
interface TaskListRow {
  id: string;
  name: string;
}

/**
 * Get task list by source spec ID
 */
export async function getTaskListBySpec(
  specId: string,
): Promise<{ id: string; name: string } | null> {
  const row = await getOne<TaskListRow>(
    `SELECT id, name FROM task_lists_v2 WHERE source_spec_id = ?`,
    [specId],
  );
  return row || null;
}

export default {
  convertSpecToTaskList,
  generateInitialTasks,
  getTaskListBySpec,
};
