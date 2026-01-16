/**
 * Gotcha Injector for Spec Agent
 *
 * Injects relevant gotchas into tasks based on file patterns and action types.
 * V0.1 uses hardcoded gotchas; Knowledge Base integration comes in v0.2.
 */

import { AtomicTask } from "./task-generator.js";

export interface Gotcha {
  id: string;
  content: string;
  filePattern: string; // glob pattern
  actionType: "CREATE" | "UPDATE" | "BOTH";
  severity: "warning" | "critical";
  category: string;
}

/**
 * Hardcoded gotchas for v0.1
 * 20+ gotchas covering common issues across categories
 */
const HARDCODED_GOTCHAS: Gotcha[] = [
  // SQL/Database (SQL-*)
  {
    id: "SQL-001",
    content: "Always use parameterized queries to prevent SQL injection",
    filePattern: "*.sql",
    actionType: "BOTH",
    severity: "critical",
    category: "sql",
  },
  {
    id: "SQL-002",
    content: "Use TEXT type for timestamps in SQLite, not DATETIME",
    filePattern: "*.sql",
    actionType: "CREATE",
    severity: "warning",
    category: "sql",
  },
  {
    id: "SQL-003",
    content: "Add created_at and updated_at columns to all tables",
    filePattern: "database/migrations/*.sql",
    actionType: "CREATE",
    severity: "warning",
    category: "sql",
  },
  {
    id: "SQL-004",
    content:
      "Create indexes for foreign key columns and frequently queried fields",
    filePattern: "database/migrations/*.sql",
    actionType: "CREATE",
    severity: "warning",
    category: "sql",
  },
  {
    id: "SQL-005",
    content: "Use IF NOT EXISTS for CREATE TABLE to make migrations idempotent",
    filePattern: "database/migrations/*.sql",
    actionType: "CREATE",
    severity: "warning",
    category: "sql",
  },

  // TypeScript Types (TS-*)
  {
    id: "TS-001",
    content: "Export all interfaces and types for use by other modules",
    filePattern: "types/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "types",
  },
  {
    id: "TS-002",
    content: "Use readonly for properties that should not be modified",
    filePattern: "types/*.ts",
    actionType: "BOTH",
    severity: "warning",
    category: "types",
  },
  {
    id: "TS-003",
    content: "Prefer interfaces over type aliases for object shapes",
    filePattern: "types/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "types",
  },
  {
    id: "TS-004",
    content: "Use strict null checks - handle undefined/null explicitly",
    filePattern: "*.ts",
    actionType: "BOTH",
    severity: "warning",
    category: "types",
  },

  // API Routes (API-*)
  {
    id: "API-001",
    content: "Add input validation middleware before route handlers",
    filePattern: "server/routes/*",
    actionType: "CREATE",
    severity: "warning",
    category: "api",
  },
  {
    id: "API-002",
    content: "Use try-catch and proper error responses (400, 404, 500)",
    filePattern: "server/routes/*",
    actionType: "BOTH",
    severity: "critical",
    category: "api",
  },
  {
    id: "API-003",
    content: "Return consistent response shapes: { data, error, message }",
    filePattern: "server/routes/*",
    actionType: "BOTH",
    severity: "warning",
    category: "api",
  },
  {
    id: "API-004",
    content: "Mount routers in server/api.ts after creation",
    filePattern: "server/routes/*",
    actionType: "CREATE",
    severity: "critical",
    category: "api",
  },
  {
    id: "API-005",
    content: "Use async/await, not callbacks, for route handlers",
    filePattern: "server/routes/*",
    actionType: "BOTH",
    severity: "warning",
    category: "api",
  },

  // Database Queries (DB-*)
  {
    id: "DB-001",
    content: "Use db.prepare().run/get/all() pattern from better-sqlite3",
    filePattern: "database/*.ts",
    actionType: "BOTH",
    severity: "critical",
    category: "database",
  },
  {
    id: "DB-002",
    content: "Wrap multiple operations in transactions for consistency",
    filePattern: "database/*.ts",
    actionType: "BOTH",
    severity: "warning",
    category: "database",
  },
  {
    id: "DB-003",
    content: "Add JSDoc comments describing function purpose and parameters",
    filePattern: "database/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "database",
  },

  // Testing (TEST-*)
  {
    id: "TEST-001",
    content: "Use vitest describe/it/expect pattern for tests",
    filePattern: "tests/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "testing",
  },
  {
    id: "TEST-002",
    content: "Test both success cases and error/edge cases",
    filePattern: "tests/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "testing",
  },
  {
    id: "TEST-003",
    content: "Mock external dependencies (API calls, database) in unit tests",
    filePattern: "tests/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "testing",
  },
  {
    id: "TEST-004",
    content: "Use beforeEach/afterEach for test setup and cleanup",
    filePattern: "tests/*.ts",
    actionType: "CREATE",
    severity: "warning",
    category: "testing",
  },

  // Services (SVC-*)
  {
    id: "SVC-001",
    content: "Services should be stateless - pass dependencies via constructor",
    filePattern: "server/services/*",
    actionType: "CREATE",
    severity: "warning",
    category: "services",
  },
  {
    id: "SVC-002",
    content: "Validate inputs at service layer before database operations",
    filePattern: "server/services/*",
    actionType: "BOTH",
    severity: "warning",
    category: "services",
  },
  {
    id: "SVC-003",
    content:
      "Throw typed errors that route handlers can catch and map to HTTP status",
    filePattern: "server/services/*",
    actionType: "BOTH",
    severity: "warning",
    category: "services",
  },

  // General (GEN-*)
  {
    id: "GEN-001",
    content: "Use .js extension in imports for ESM compatibility",
    filePattern: "*.ts",
    actionType: "BOTH",
    severity: "critical",
    category: "general",
  },
  {
    id: "GEN-002",
    content: "Avoid circular imports - check dependency graph",
    filePattern: "*.ts",
    actionType: "CREATE",
    severity: "critical",
    category: "general",
  },
  {
    id: "GEN-003",
    content: "Log errors with context before re-throwing",
    filePattern: "*.ts",
    actionType: "BOTH",
    severity: "warning",
    category: "general",
  },
];

export interface InjectorOptions {
  maxGotchasPerTask?: number;
  includeComments?: boolean;
}

const DEFAULT_MAX_GOTCHAS = 5;

export class GotchaInjector {
  private gotchas: Gotcha[];
  private maxGotchasPerTask: number;
  private includeComments: boolean;

  constructor(options: InjectorOptions = {}) {
    this.gotchas = HARDCODED_GOTCHAS;
    this.maxGotchasPerTask = options.maxGotchasPerTask || DEFAULT_MAX_GOTCHAS;
    this.includeComments = options.includeComments ?? true;
  }

  /**
   * Inject relevant gotchas into a list of tasks
   */
  inject(tasks: AtomicTask[]): AtomicTask[] {
    return tasks.map((task) => this.injectIntoTask(task));
  }

  /**
   * Inject gotchas into a single task
   */
  private injectIntoTask(task: AtomicTask): AtomicTask {
    const matchedGotchas = this.matchGotchas(task);

    // Merge existing gotchas with new ones, avoiding duplicates
    const existingContent = new Set(task.gotchas);
    const newGotchas = matchedGotchas
      .map((g) => g.content)
      .filter((content) => !existingContent.has(content));

    const combinedGotchas = [...task.gotchas, ...newGotchas].slice(
      0,
      this.maxGotchasPerTask,
    );

    // Optionally add gotcha comments to code template
    let codeTemplate = task.codeTemplate;
    if (this.includeComments && codeTemplate && matchedGotchas.length > 0) {
      codeTemplate = this.addGotchaComments(
        codeTemplate,
        matchedGotchas,
        task.file,
      );
    }

    return {
      ...task,
      gotchas: combinedGotchas,
      codeTemplate,
    };
  }

  /**
   * Find gotchas that match a task's file pattern and action
   */
  private matchGotchas(task: AtomicTask): Gotcha[] {
    const matches: Array<{ gotcha: Gotcha; score: number }> = [];

    for (const gotcha of this.gotchas) {
      // Check action type match
      if (!this.actionMatches(gotcha.actionType, task.action)) {
        continue;
      }

      // Check file pattern match
      const patternScore = this.getPatternMatchScore(
        gotcha.filePattern,
        task.file,
      );
      if (patternScore === 0) {
        continue;
      }

      // Calculate relevance score
      const severityBonus = gotcha.severity === "critical" ? 10 : 0;
      const score = patternScore + severityBonus;

      matches.push({ gotcha, score });
    }

    // Sort by score (highest first) and take top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxGotchasPerTask)
      .map((m) => m.gotcha);
  }

  /**
   * Check if gotcha action type matches task action
   */
  private actionMatches(
    gotchaAction: "CREATE" | "UPDATE" | "BOTH",
    taskAction: string,
  ): boolean {
    if (gotchaAction === "BOTH") return true;
    return gotchaAction === taskAction;
  }

  /**
   * Get a score for how well a pattern matches a file path
   * Returns 0 for no match, higher scores for more specific matches
   */
  private getPatternMatchScore(pattern: string, filePath: string): number {
    // Exact match
    if (pattern === filePath) {
      return 100;
    }

    // Handle patterns like *.sql (match anywhere)
    if (pattern.startsWith("*.")) {
      const extension = pattern.slice(1); // Get '.sql' from '*.sql'
      if (filePath.endsWith(extension)) {
        return 5;
      }
    }

    // Handle patterns like 'database/*.ts' or 'server/routes/*'
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "<<GLOBSTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<GLOBSTAR>>/g, ".*");

    // For patterns without leading slash or **, allow matching anywhere
    const fullRegex = pattern.includes("/")
      ? new RegExp(`^${regexPattern}$`)
      : new RegExp(`(^|/)${regexPattern}$`);

    if (fullRegex.test(filePath)) {
      // More specific patterns get higher scores
      // Count non-wildcard characters as specificity
      const specificity = pattern.replace(/[*]/g, "").length;
      return 10 + specificity;
    }

    // Also try partial directory match for patterns like 'database/*'
    const patternDir = pattern.split("/")[0];
    if (
      patternDir &&
      !patternDir.includes("*") &&
      filePath.startsWith(patternDir + "/")
    ) {
      const extensionMatch =
        pattern.endsWith(".ts") && filePath.endsWith(".ts");
      const sqlMatch = pattern.endsWith(".sql") && filePath.endsWith(".sql");
      if (extensionMatch || sqlMatch || pattern.endsWith("/*")) {
        return 8;
      }
    }

    return 0;
  }

  /**
   * Add gotcha comments to code template
   */
  private addGotchaComments(
    template: string,
    gotchas: Gotcha[],
    filePath: string,
  ): string {
    const commentStyle = this.getCommentStyle(filePath);
    const criticalGotchas = gotchas.filter((g) => g.severity === "critical");

    if (criticalGotchas.length === 0) {
      return template;
    }

    const comments = criticalGotchas
      .map(
        (g) =>
          `${commentStyle.start} GOTCHA [${g.id}]: ${g.content} ${commentStyle.end}`,
      )
      .join("\n");

    return `${comments}\n\n${template}`;
  }

  /**
   * Get comment style based on file type
   */
  private getCommentStyle(filePath: string): { start: string; end: string } {
    if (filePath.endsWith(".sql")) {
      return { start: "--", end: "" };
    }
    if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
      return { start: "//", end: "" };
    }
    if (filePath.endsWith(".md")) {
      return { start: "<!--", end: "-->" };
    }
    return { start: "#", end: "" };
  }

  /**
   * Get all available gotchas
   */
  getGotchas(): Gotcha[] {
    return [...this.gotchas];
  }

  /**
   * Get gotchas by category
   */
  getGotchasByCategory(category: string): Gotcha[] {
    return this.gotchas.filter((g) => g.category === category);
  }

  /**
   * Get gotchas for a specific file pattern
   */
  getGotchasForPattern(filePattern: string): Gotcha[] {
    return this.gotchas.filter((g) => {
      const score = this.getPatternMatchScore(g.filePattern, filePattern);
      return score > 0;
    });
  }

  /**
   * Get gotcha count
   */
  getGotchaCount(): number {
    return this.gotchas.length;
  }

  /**
   * Add custom gotcha (for testing)
   */
  addGotcha(gotcha: Gotcha): void {
    this.gotchas.push(gotcha);
  }

  /**
   * Get categories
   */
  getCategories(): string[] {
    const categories = new Set(this.gotchas.map((g) => g.category));
    return [...categories];
  }
}

/**
 * Create a default gotcha injector instance
 */
export function createGotchaInjector(
  options?: InjectorOptions,
): GotchaInjector {
  return new GotchaInjector(options);
}

/**
 * Get all hardcoded gotchas
 */
export function getHardcodedGotchas(): Gotcha[] {
  return [...HARDCODED_GOTCHAS];
}
