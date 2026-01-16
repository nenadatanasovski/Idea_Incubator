/**
 * Task Decomposer
 *
 * Breaks down large tasks into atomic subtasks.
 * Part of: Task System V2 Implementation Plan (IMPL-4.4)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  Task,
  TaskCategory,
  CreateTaskInput,
} from "../../../types/task-agent.js";
import { CreateTaskImpactInput } from "../../../types/task-impact.js";
import { atomicityValidator } from "./atomicity-validator.js";

/**
 * Split suggestion for decomposition
 */
export interface SplitSuggestion {
  title: string;
  description: string;
  category: TaskCategory;
  estimatedEffort: string;
  dependencies: string[]; // References to other splits (by index)
  impacts: CreateTaskImpactInput[];
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  originalTaskId: string;
  suggestedTasks: SplitSuggestion[];
  totalEstimatedEffort: string;
  decompositionReason: string;
}

/**
 * Task Decomposer class
 */
export class TaskDecomposer {
  /**
   * Decompose a task into atomic subtasks
   */
  async decompose(taskId: string): Promise<DecompositionResult> {
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate atomicity first
    const atomicity = await atomicityValidator.validate(task);

    if (atomicity.isAtomic) {
      return {
        originalTaskId: taskId,
        suggestedTasks: [],
        totalEstimatedEffort: task.effort,
        decompositionReason: "Task is already atomic",
      };
    }

    // Generate splits based on failed rules
    const splits = await this.suggestSplits(task);

    // Calculate total effort
    const effortValues: Record<string, number> = {
      trivial: 1,
      small: 2,
      medium: 4,
      large: 8,
      epic: 16,
    };

    const totalEffort = splits.reduce(
      (sum, s) => sum + (effortValues[s.estimatedEffort] || 4),
      0,
    );

    const totalEffortLabel =
      totalEffort <= 1
        ? "trivial"
        : totalEffort <= 2
          ? "small"
          : totalEffort <= 4
            ? "medium"
            : totalEffort <= 8
              ? "large"
              : "epic";

    return {
      originalTaskId: taskId,
      suggestedTasks: splits,
      totalEstimatedEffort: totalEffortLabel,
      decompositionReason:
        atomicity.suggestedSplits?.join("; ") || "Task not atomic",
    };
  }

  /**
   * Generate split suggestions for a task
   */
  async suggestSplits(task: Task): Promise<SplitSuggestion[]> {
    const splits: SplitSuggestion[] = [];
    const description = task.description || "";

    // Get file impacts
    const impacts = await query<{
      target_path: string;
      operation: string;
      impact_type: string;
    }>(
      "SELECT target_path, operation, impact_type FROM task_impacts WHERE task_id = ?",
      [task.id],
    );

    // Strategy 1: Split by component type
    const componentGroups = this.groupByComponent(impacts);
    if (Object.keys(componentGroups).length > 1) {
      for (const [component, componentImpacts] of Object.entries(
        componentGroups,
      )) {
        splits.push({
          title: `${task.title} - ${component} changes`,
          description: `${component} portion of: ${description}`,
          category: this.getCategoryForComponent(component),
          estimatedEffort: this.estimateEffort(componentImpacts.length),
          dependencies: [],
          impacts: componentImpacts.map((i) => ({
            taskId: "", // Will be set on execution
            impactType: i.impact_type as any,
            operation: i.operation as any,
            targetPath: i.target_path,
          })),
        });
      }
    }

    // Strategy 2: Split if task has multiple "and" clauses
    if (splits.length === 0) {
      const andParts = this.splitByConjunction(task.title, description);
      if (andParts.length > 1) {
        for (const part of andParts) {
          splits.push({
            title: part,
            description: `Part of: ${description}`,
            category: task.category,
            estimatedEffort: "small",
            dependencies: [],
            impacts: [],
          });
        }
      }
    }

    // Strategy 3: Default split by phase
    if (
      (splits.length === 0 && task.effort === "large") ||
      task.effort === "epic"
    ) {
      splits.push(
        {
          title: `${task.title} - Design`,
          description: `Design phase: ${description}`,
          category: "research",
          estimatedEffort: "small",
          dependencies: [],
          impacts: [],
        },
        {
          title: `${task.title} - Implementation`,
          description: `Implementation phase: ${description}`,
          category: task.category,
          estimatedEffort: "medium",
          dependencies: ["0"],
          impacts: impacts.map((i) => ({
            taskId: "",
            impactType: i.impact_type as any,
            operation: i.operation as any,
            targetPath: i.target_path,
          })),
        },
        {
          title: `${task.title} - Testing`,
          description: `Testing phase: ${description}`,
          category: "test",
          estimatedEffort: "small",
          dependencies: ["1"],
          impacts: [],
        },
      );
    }

    return splits;
  }

  /**
   * Execute decomposition - create subtasks and mark original as superseded
   */
  async executeDecomposition(
    taskId: string,
    splits: SplitSuggestion[],
  ): Promise<Task[]> {
    const originalTask = await getOne<Task>(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId],
    );

    if (!originalTask) {
      throw new Error(`Task ${taskId} not found`);
    }

    const createdTasks: Task[] = [];
    const idMapping = new Map<string, string>();

    // Create subtasks
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const newId = uuidv4();
      const now = new Date().toISOString();

      await run(
        `INSERT INTO tasks (id, title, description, category, status, queue, task_list_id, project_id, priority, effort, phase, position, owner, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          split.title,
          split.description,
          split.category,
          "pending",
          originalTask.queue,
          originalTask.taskListId || null,
          originalTask.projectId || null,
          originalTask.priority,
          split.estimatedEffort,
          i + 1,
          i,
          "build_agent",
          now,
          now,
        ],
      );

      idMapping.set(i.toString(), newId);

      // Create impacts
      for (const impact of split.impacts) {
        await run(
          `INSERT INTO task_impacts (id, task_id, impact_type, operation, target_path, confidence, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            newId,
            impact.impactType,
            impact.operation,
            impact.targetPath,
            0.8,
            "user",
            now,
            now,
          ],
        );
      }

      const createdTask = await getOne<Task>(
        "SELECT * FROM tasks WHERE id = ?",
        [newId],
      );
      if (createdTask) {
        createdTasks.push(createdTask);
      }
    }

    // Create dependencies between subtasks
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const sourceId = idMapping.get(i.toString());

      for (const depRef of split.dependencies) {
        const targetId = idMapping.get(depRef);
        if (sourceId && targetId) {
          await run(
            `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              sourceId,
              targetId,
              "depends_on",
              new Date().toISOString(),
            ],
          );
        }
      }
    }

    // Create parent-child relationships
    for (const createdTask of createdTasks) {
      await run(
        `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          createdTask.id,
          taskId,
          "child_of",
          new Date().toISOString(),
        ],
      );
    }

    // Mark original task as superseded (change status to skipped)
    await run(
      `UPDATE tasks SET status = 'skipped', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), taskId],
    );

    await saveDb();

    return createdTasks;
  }

  /**
   * Determine if a task should be decomposed
   */
  async shouldDecompose(
    task: Task,
  ): Promise<{ should: boolean; reasons: string[] }> {
    const atomicity = await atomicityValidator.validate(task);

    return {
      should: !atomicity.isAtomic,
      reasons: atomicity.suggestedSplits || [],
    };
  }

  /**
   * Group impacts by component type
   */
  private groupByComponent(
    impacts: { target_path: string; operation: string; impact_type: string }[],
  ): Record<string, typeof impacts> {
    const groups: Record<string, typeof impacts> = {};

    for (const impact of impacts) {
      const component = this.getComponentFromPath(impact.target_path);
      if (!groups[component]) {
        groups[component] = [];
      }
      groups[component].push(impact);
    }

    return groups;
  }

  /**
   * Get component type from file path
   */
  private getComponentFromPath(path: string): string {
    if (
      path.includes("database") ||
      path.includes("migration") ||
      path.endsWith(".sql")
    ) {
      return "database";
    }
    if (path.includes("types/") || path.includes(".d.ts")) {
      return "types";
    }
    if (path.includes("routes/") || path.includes("api/")) {
      return "api";
    }
    if (path.includes("services/")) {
      return "service";
    }
    if (
      path.includes("components/") ||
      path.includes(".tsx") ||
      path.includes(".jsx")
    ) {
      return "ui";
    }
    if (path.includes("test") || path.includes("spec")) {
      return "test";
    }
    return "other";
  }

  /**
   * Get category for component type
   */
  private getCategoryForComponent(component: string): TaskCategory {
    const mapping: Record<string, TaskCategory> = {
      database: "infrastructure",
      types: "task",
      api: "feature",
      service: "feature",
      ui: "design",
      test: "test",
      other: "task",
    };
    return mapping[component] || "task";
  }

  /**
   * Estimate effort based on impact count
   */
  private estimateEffort(impactCount: number): string {
    if (impactCount <= 1) return "trivial";
    if (impactCount <= 3) return "small";
    if (impactCount <= 5) return "medium";
    return "large";
  }

  /**
   * Split text by conjunction words
   */
  private splitByConjunction(title: string, description: string): string[] {
    const text = `${title}`;
    const parts = text.split(/\s+and\s+|\s*,\s*(?=and\s+|\w)/i);
    return parts.map((p) => p.trim()).filter((p) => p.length > 5);
  }
}

// Export singleton instance
export const taskDecomposer = new TaskDecomposer();
export default taskDecomposer;
