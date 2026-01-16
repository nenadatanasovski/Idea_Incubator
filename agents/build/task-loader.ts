/**
 * Task Loader for Build Agent
 *
 * Parses tasks.md files and extracts atomic tasks in dependency order.
 */

import * as fs from "fs";
import * as yaml from "yaml";
import {
  LoadedTask,
  TasksFileFrontmatter,
  ParseTasksResult,
  TaskDependency,
  CircularDependencyError,
} from "../../types/task-loader.js";

export interface TaskLoaderOptions {
  projectRoot?: string;
}

export class TaskLoader {
  private projectRoot: string;

  constructor(options: TaskLoaderOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Load and parse a tasks.md file
   */
  load(tasksPath: string): ParseTasksResult {
    try {
      const content = this.readFile(tasksPath);
      if (!content) {
        return {
          success: false,
          error: `Failed to read tasks file: ${tasksPath}`,
        };
      }

      const frontmatter = this.parseFrontmatter(content);
      if (!frontmatter) {
        return {
          success: false,
          error: "Failed to parse frontmatter",
        };
      }

      const tasks = this.extractTasks(content);
      if (tasks.length === 0) {
        return {
          success: false,
          error: "No tasks found in file",
        };
      }

      // Validate tasks
      const validationError = this.validateTasks(tasks);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      return {
        success: true,
        file: {
          frontmatter,
          tasks,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Parse YAML frontmatter from content
   */
  private parseFrontmatter(content: string): TasksFileFrontmatter | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return null;
    }

    try {
      const parsed = yaml.parse(match[1]);
      return {
        id: parsed.id || "unknown",
        complexity: parsed.complexity || "unknown",
        totalTasks: parsed.total_tasks || 0,
        phases: parsed.phases || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract all task YAML blocks from content
   */
  private extractTasks(content: string): LoadedTask[] {
    const tasks: LoadedTask[] = [];
    const regex = /```yaml\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = yaml.parse(match[1]);
        if (parsed && parsed.id && parsed.id.startsWith("T-")) {
          tasks.push(this.normalizeTask(parsed));
        }
      } catch {
        // Skip invalid YAML blocks
      }
    }

    return tasks;
  }

  /**
   * Normalize a parsed task to ensure consistent structure
   */
  private normalizeTask(parsed: Record<string, unknown>): LoadedTask {
    return {
      id: String(parsed.id || ""),
      phase: String(parsed.phase || "unknown"),
      action: this.normalizeAction(parsed.action),
      file: String(parsed.file || ""),
      status: String(parsed.status || "pending"),
      requirements: this.normalizeStringArray(parsed.requirements),
      gotchas: this.normalizeStringArray(parsed.gotchas),
      validation: this.normalizeValidation(parsed.validation),
      codeTemplate: parsed.code_template
        ? String(parsed.code_template)
        : undefined,
      dependsOn: this.normalizeStringArray(parsed.depends_on),
    };
  }

  /**
   * Normalize action to valid type
   */
  private normalizeAction(action: unknown): "CREATE" | "UPDATE" | "DELETE" {
    const normalized = String(action).toUpperCase();
    if (
      normalized === "CREATE" ||
      normalized === "UPDATE" ||
      normalized === "DELETE"
    ) {
      return normalized;
    }
    return "CREATE";
  }

  /**
   * Normalize an array of strings
   */
  private normalizeStringArray(arr: unknown): string[] {
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr.map((item) => String(item));
  }

  /**
   * Normalize validation object
   */
  private normalizeValidation(validation: unknown): {
    command: string;
    expected: string;
  } {
    if (typeof validation !== "object" || validation === null) {
      return { command: "", expected: "" };
    }
    const v = validation as Record<string, unknown>;
    return {
      command: String(v.command || ""),
      expected: String(v.expected || ""),
    };
  }

  /**
   * Validate tasks structure
   */
  private validateTasks(tasks: LoadedTask[]): string | null {
    const taskIds = new Set(tasks.map((t) => t.id));

    for (const task of tasks) {
      // Check for missing required fields
      if (!task.id) {
        return "Task missing required field: id";
      }
      if (!task.file) {
        return `Task ${task.id} missing required field: file`;
      }

      // Check for invalid dependencies
      for (const dep of task.dependsOn) {
        if (!taskIds.has(dep)) {
          return `Task ${task.id} has invalid dependency: ${dep}`;
        }
      }
    }

    // Check for circular dependencies
    const circularError = this.detectCircularDependencies(tasks);
    if (circularError) {
      return circularError.message;
    }

    return null;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(
    tasks: LoadedTask[],
  ): CircularDependencyError | null {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        for (const dep of task.dependsOn) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) {
              return true;
            }
          } else if (recursionStack.has(dep)) {
            path.push(dep);
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          return {
            cycle: path,
            message: `Circular dependency detected: ${path.join(" -> ")}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Order tasks by dependencies (topological sort)
   */
  orderByDependency(tasks: LoadedTask[]): LoadedTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const result: LoadedTask[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      // Visit dependencies first
      for (const depId of task.dependsOn) {
        visit(depId);
      }

      result.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Get tasks by phase
   */
  getTasksByPhase(tasks: LoadedTask[]): Map<string, LoadedTask[]> {
    const byPhase = new Map<string, LoadedTask[]>();

    for (const task of tasks) {
      const phaseTasks = byPhase.get(task.phase) || [];
      phaseTasks.push(task);
      byPhase.set(task.phase, phaseTasks);
    }

    return byPhase;
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(tasks: LoadedTask[], status: string): LoadedTask[] {
    return tasks.filter((t) => t.status === status);
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(tasks: LoadedTask[]): LoadedTask[] {
    return this.getTasksByStatus(tasks, "pending");
  }

  /**
   * Get task dependencies with depth
   */
  getTaskDependencies(tasks: LoadedTask[]): TaskDependency[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const depths = new Map<string, number>();

    const getDepth = (taskId: string): number => {
      if (depths.has(taskId)) {
        return depths.get(taskId)!;
      }

      const task = taskMap.get(taskId);
      if (!task || task.dependsOn.length === 0) {
        depths.set(taskId, 0);
        return 0;
      }

      const maxDepDepth = Math.max(
        ...task.dependsOn.map((dep) => getDepth(dep)),
      );
      const depth = maxDepDepth + 1;
      depths.set(taskId, depth);
      return depth;
    };

    return tasks.map((task) => ({
      taskId: task.id,
      dependsOn: task.dependsOn,
      depth: getDepth(task.id),
    }));
  }

  /**
   * Read file content
   */
  private readFile(filePath: string): string | null {
    try {
      const fullPath = filePath.startsWith("/")
        ? filePath
        : `${this.projectRoot}/${filePath}`;
      return fs.readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Set project root
   */
  setProjectRoot(projectRoot: string): void {
    this.projectRoot = projectRoot;
  }

  /**
   * Get project root
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }
}

/**
 * Create a task loader instance
 */
export function createTaskLoader(options?: TaskLoaderOptions): TaskLoader {
  return new TaskLoader(options);
}
