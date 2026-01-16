/**
 * Task Generator for Spec Agent
 *
 * Generates atomic, implementable tasks from analyzed requirements.
 * Each task targets one file with one action.
 */

import { AnalyzedRequirements } from "./prompts/tasks.js";
import { Gotcha } from "./context-loader.js";
import { ParsedBrief } from "./brief-parser.js";

export type Phase =
  | "database"
  | "types"
  | "queries"
  | "services"
  | "api"
  | "tests";
export type TaskAction = "CREATE" | "UPDATE" | "DELETE";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Phase ordering: database → types → queries → services → api → tests
 */
const PHASE_ORDER: Phase[] = [
  "database",
  "types",
  "queries",
  "services",
  "api",
  "tests",
];

export interface AtomicTask {
  id: string;
  phase: Phase;
  action: TaskAction;
  file: string;
  status: TaskStatus;
  requirements: string[];
  gotchas: string[];
  validation: {
    command: string;
    expected: string;
  };
  codeTemplate?: string;
  dependsOn: string[];
}

export interface TaskGeneratorOptions {
  gotchas: Gotcha[];
  migrationPrefix?: number;
  filePrefix?: string;
}

export interface GeneratedTasks {
  tasks: AtomicTask[];
  totalCount: number;
  byPhase: Record<Phase, number>;
  warnings: string[];
}

export class TaskGenerator {
  private gotchas: Gotcha[];
  private migrationCounter: number;
  private taskCounter: number = 0;

  constructor(options: TaskGeneratorOptions) {
    this.gotchas = options.gotchas;
    this.migrationCounter = options.migrationPrefix || 25;
  }

  /**
   * Generate tasks from analyzed requirements
   */
  generate(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
  ): GeneratedTasks {
    const tasks: AtomicTask[] = [];
    const warnings: string[] = [];

    // Reset counter
    this.taskCounter = 0;

    // Generate database tasks
    if (this.needsDatabaseTasks(brief, requirements)) {
      tasks.push(...this.generateDatabaseTasks(brief, requirements));
    }

    // Generate type tasks
    tasks.push(...this.generateTypeTasks(brief, requirements, tasks));

    // Generate query tasks
    tasks.push(...this.generateQueryTasks(brief, requirements, tasks));

    // Generate service tasks if needed
    if (brief.complexity !== "simple") {
      tasks.push(...this.generateServiceTasks(brief, requirements, tasks));
    }

    // Generate API tasks
    tasks.push(...this.generateApiTasks(brief, requirements, tasks));

    // Generate test tasks
    tasks.push(...this.generateTestTasks(brief, requirements, tasks));

    // Order by dependency
    const orderedTasks = this.orderByDependency(tasks, warnings);

    // Validate task count
    const expected = this.getExpectedTaskCount(brief.complexity);
    if (orderedTasks.length < expected.min) {
      warnings.push(
        `Task count ${orderedTasks.length} below minimum ${expected.min} for ${brief.complexity}`,
      );
    }
    if (orderedTasks.length > expected.max) {
      warnings.push(
        `Task count ${orderedTasks.length} above maximum ${expected.max} for ${brief.complexity}`,
      );
    }

    // Count by phase
    const byPhase: Record<Phase, number> = {
      database: 0,
      types: 0,
      queries: 0,
      services: 0,
      api: 0,
      tests: 0,
    };
    for (const task of orderedTasks) {
      byPhase[task.phase]++;
    }

    return {
      tasks: orderedTasks,
      totalCount: orderedTasks.length,
      byPhase,
      warnings,
    };
  }

  /**
   * Generate a unique task ID
   */
  private nextTaskId(): string {
    this.taskCounter++;
    return `T-${String(this.taskCounter).padStart(3, "0")}`;
  }

  /**
   * Check if database tasks are needed
   */
  private needsDatabaseTasks(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
  ): boolean {
    return !!(
      brief.databaseSchema ||
      brief.solution.toLowerCase().includes("database") ||
      brief.solution.toLowerCase().includes("table") ||
      requirements.functionalRequirements.some(
        (r) =>
          r.description.toLowerCase().includes("store") ||
          r.description.toLowerCase().includes("save") ||
          r.description.toLowerCase().includes("record"),
      )
    );
  }

  /**
   * Generate database migration tasks
   */
  private generateDatabaseTasks(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const migrationFile = `database/migrations/${this.migrationCounter}_${brief.id.replace(/-/g, "_")}.sql`;

    tasks.push({
      id: this.nextTaskId(),
      phase: "database",
      action: "CREATE",
      file: migrationFile,
      status: "pending",
      requirements: [
        "Create database migration file",
        ...this.extractDatabaseRequirements(requirements),
      ],
      gotchas: this.getRelevantGotchas("*.sql", "CREATE"),
      validation: this.generateValidation({
        phase: "database",
        file: migrationFile,
        action: "CREATE",
      }),
      codeTemplate:
        brief.databaseSchema || this.generateMigrationTemplate(brief),
      dependsOn: [],
    });

    return tasks;
  }

  /**
   * Generate TypeScript type tasks
   */
  private generateTypeTasks(
    brief: ParsedBrief,
    _requirements: AnalyzedRequirements,
    existingTasks: AtomicTask[],
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const typeFile = `types/${brief.id.replace(/-/g, "-")}.ts`;

    const dbTaskId = existingTasks.find((t) => t.phase === "database")?.id;

    tasks.push({
      id: this.nextTaskId(),
      phase: "types",
      action: "CREATE",
      file: typeFile,
      status: "pending",
      requirements: [
        "Define TypeScript interfaces",
        "Export types for use by other modules",
      ],
      gotchas: this.getRelevantGotchas("types/*.ts", "CREATE"),
      validation: this.generateValidation({
        phase: "types",
        file: typeFile,
        action: "CREATE",
      }),
      dependsOn: dbTaskId ? [dbTaskId] : [],
    });

    return tasks;
  }

  /**
   * Generate database query tasks
   */
  private generateQueryTasks(
    _brief: ParsedBrief,
    _requirements: AnalyzedRequirements,
    existingTasks: AtomicTask[],
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];

    const typeTaskId = existingTasks.find((t) => t.phase === "types")?.id;
    const dbTaskId = existingTasks.find((t) => t.phase === "database")?.id;
    const dependsOn = [typeTaskId, dbTaskId].filter(Boolean) as string[];

    tasks.push({
      id: this.nextTaskId(),
      phase: "queries",
      action: "UPDATE",
      file: "database/db.ts",
      status: "pending",
      requirements: [
        "Add CRUD query functions",
        "Use parameterized queries",
        "Follow existing patterns in file",
      ],
      gotchas: this.getRelevantGotchas("database/*.ts", "UPDATE"),
      validation: this.generateValidation({
        phase: "queries",
        file: "database/db.ts",
        action: "UPDATE",
      }),
      dependsOn,
    });

    return tasks;
  }

  /**
   * Generate service layer tasks
   */
  private generateServiceTasks(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
    existingTasks: AtomicTask[],
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const serviceFile = `server/services/${brief.id.replace(/-/g, "-")}-service.ts`;

    const queryTaskId = existingTasks.find((t) => t.phase === "queries")?.id;
    const dependsOn = queryTaskId ? [queryTaskId] : [];

    tasks.push({
      id: this.nextTaskId(),
      phase: "services",
      action: "CREATE",
      file: serviceFile,
      status: "pending",
      requirements: [
        "Implement business logic",
        "Wrap database queries with validation",
        "Follow existing service patterns",
      ],
      gotchas: this.getRelevantGotchas("services/*.ts", "CREATE"),
      validation: this.generateValidation({
        phase: "services",
        file: serviceFile,
        action: "CREATE",
      }),
      dependsOn,
    });

    return tasks;
  }

  /**
   * Generate API route tasks
   */
  private generateApiTasks(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
    existingTasks: AtomicTask[],
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const routeFile = `server/routes/${brief.id.replace(/-/g, "-")}.ts`;

    // Depend on services or queries
    const serviceTaskId = existingTasks.find((t) => t.phase === "services")?.id;
    const queryTaskId = existingTasks.find((t) => t.phase === "queries")?.id;
    const dependsOn = serviceTaskId
      ? [serviceTaskId]
      : queryTaskId
        ? [queryTaskId]
        : [];

    // Create route file
    tasks.push({
      id: this.nextTaskId(),
      phase: "api",
      action: "CREATE",
      file: routeFile,
      status: "pending",
      requirements: [
        "Create Express router",
        "Implement CRUD endpoints",
        "Add input validation",
        "Return appropriate status codes",
      ],
      gotchas: this.getRelevantGotchas("routes/*.ts", "CREATE"),
      validation: this.generateValidation({
        phase: "api",
        file: routeFile,
        action: "CREATE",
      }),
      dependsOn,
    });

    // Mount routes in api.ts
    const routeTaskId = tasks[tasks.length - 1].id;
    tasks.push({
      id: this.nextTaskId(),
      phase: "api",
      action: "UPDATE",
      file: "server/api.ts",
      status: "pending",
      requirements: ["Import new router", "Mount at appropriate path"],
      gotchas: this.getRelevantGotchas("api.ts", "UPDATE"),
      validation: this.generateValidation({
        phase: "api",
        file: "server/api.ts",
        action: "UPDATE",
      }),
      dependsOn: [routeTaskId],
    });

    return tasks;
  }

  /**
   * Generate test tasks
   */
  private generateTestTasks(
    brief: ParsedBrief,
    _requirements: AnalyzedRequirements,
    existingTasks: AtomicTask[],
  ): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const testFile = `tests/${brief.id.replace(/-/g, "-")}.test.ts`;

    // Depend on the main implementation
    const apiTaskIds = existingTasks
      .filter((t) => t.phase === "api")
      .map((t) => t.id);
    const dependsOn = apiTaskIds.length > 0 ? [apiTaskIds[0]] : [];

    tasks.push({
      id: this.nextTaskId(),
      phase: "tests",
      action: "CREATE",
      file: testFile,
      status: "pending",
      requirements: [
        "Test CRUD operations",
        "Test error cases",
        "Follow vitest patterns",
      ],
      gotchas: this.getRelevantGotchas("tests/*.ts", "CREATE"),
      validation: this.generateValidation({
        phase: "tests",
        file: testFile,
        action: "CREATE",
      }),
      dependsOn,
    });

    return tasks;
  }

  /**
   * Order tasks by dependency (topological sort)
   */
  private orderByDependency(
    tasks: AtomicTask[],
    warnings: string[],
  ): AtomicTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: AtomicTask[] = [];

    const visit = (taskId: string): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        warnings.push(`Circular dependency detected involving ${taskId}`);
        return;
      }

      visiting.add(taskId);
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependsOn) {
          visit(depId);
        }
        visiting.delete(taskId);
        visited.add(taskId);
        result.push(task);
      }
    };

    // Sort by phase order first, then visit
    const sortedByPhase = [...tasks].sort(
      (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
    );

    for (const task of sortedByPhase) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Generate validation command for a task
   */
  private generateValidation(params: {
    phase: Phase;
    file: string;
    action: TaskAction;
  }): { command: string; expected: string } {
    const { phase, file, action } = params;

    switch (phase) {
      case "database":
        return {
          command: `sqlite3 :memory: < ${file} && echo 'OK'`,
          expected: "OK",
        };

      case "types":
      case "queries":
      case "services":
      case "api":
        return {
          command: "npx tsc --noEmit",
          expected: "exit code 0",
        };

      case "tests":
        return {
          command: `npm test -- --grep "${file.replace("tests/", "").replace(".test.ts", "")}"`,
          expected: "all tests pass",
        };

      default:
        return {
          command: "npx tsc --noEmit",
          expected: "exit code 0",
        };
    }
  }

  /**
   * Get gotchas relevant to file pattern and action
   */
  private getRelevantGotchas(filePattern: string, action: string): string[] {
    return this.gotchas
      .filter((g) => {
        const patternMatch = this.matchPattern(filePattern, g.filePattern);
        const actionMatch = g.actionType === action || g.actionType === "*";
        return patternMatch || actionMatch;
      })
      .map((g) => g.content)
      .slice(0, 3); // Limit to 3 most relevant
  }

  /**
   * Simple pattern matching
   */
  private matchPattern(target: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    return new RegExp(regexPattern).test(target);
  }

  /**
   * Extract database requirements from analyzed requirements
   */
  private extractDatabaseRequirements(
    requirements: AnalyzedRequirements,
  ): string[] {
    return requirements.functionalRequirements
      .filter(
        (r) =>
          r.description.toLowerCase().includes("store") ||
          r.description.toLowerCase().includes("record") ||
          r.description.toLowerCase().includes("save") ||
          r.description.toLowerCase().includes("track"),
      )
      .map((r) => r.description);
  }

  /**
   * Generate migration template
   */
  private generateMigrationTemplate(brief: ParsedBrief): string {
    const tableName = brief.id.replace(/-/g, "_");
    return `-- Migration ${this.migrationCounter}: ${brief.title}
-- Created: ${new Date().toISOString().split("T")[0]}
-- Purpose: ${brief.solution.substring(0, 100)}

CREATE TABLE IF NOT EXISTS ${tableName} (
    id TEXT PRIMARY KEY,
    -- Add columns here
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at);`;
  }

  /**
   * Get expected task count for complexity
   */
  private getExpectedTaskCount(complexity: "simple" | "medium" | "complex"): {
    min: number;
    max: number;
  } {
    switch (complexity) {
      case "simple":
        return { min: 5, max: 8 };
      case "medium":
        return { min: 10, max: 15 };
      case "complex":
        return { min: 20, max: 30 };
    }
  }
}
