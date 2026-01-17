/**
 * Task Auto-Populate Service
 *
 * Provides AI-powered suggestions for missing task fields.
 * Integrates with existing suggestion engine and file impact analyzer.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 4
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";

// Types
export interface Suggestion {
  id: string;
  content: string | string[] | Record<string, unknown>;
  confidence: number; // 0-1
  source: "ai" | "pattern" | "related_task" | "template";
  reasoning?: string;
}

export interface AutoPopulateResponse {
  taskId: string;
  field: AutoPopulateField;
  suggestions: Suggestion[];
  preview: string;
  generatedAt: string;
}

export interface ApplyResult {
  taskId: string;
  field: AutoPopulateField;
  applied: number;
  appendixId?: string;
}

export type AutoPopulateField =
  | "acceptance_criteria"
  | "file_impacts"
  | "test_commands"
  | "dependencies";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  effort: string;
  project_id: string | null;
}

/**
 * Task Auto-Populate Service
 */
export class TaskAutoPopulateService {
  /**
   * Generate suggestions for a specific field
   */
  async suggest(
    taskId: string,
    field: AutoPopulateField,
  ): Promise<AutoPopulateResponse> {
    const task = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let suggestions: Suggestion[];
    let preview: string;

    switch (field) {
      case "acceptance_criteria":
        suggestions = await this.suggestAcceptanceCriteria(task);
        preview = this.formatAcceptanceCriteriaPreview(suggestions);
        break;
      case "file_impacts":
        suggestions = await this.suggestFileImpacts(task);
        preview = this.formatFileImpactsPreview(suggestions);
        break;
      case "test_commands":
        suggestions = await this.suggestTestCommands(task);
        preview = this.formatTestCommandsPreview(suggestions);
        break;
      case "dependencies":
        suggestions = await this.suggestDependencies(task);
        preview = this.formatDependenciesPreview(suggestions);
        break;
      default:
        throw new Error(`Unknown field: ${field}`);
    }

    // Log suggestion request for analytics
    await this.logSuggestionRequest(taskId, field, suggestions.length);

    return {
      taskId,
      field,
      suggestions,
      preview,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Apply suggestions to a task
   */
  async apply(
    taskId: string,
    field: AutoPopulateField,
    suggestionIds: string[],
    suggestions: Suggestion[],
  ): Promise<ApplyResult> {
    // Filter to only selected suggestions
    const selectedSuggestions = suggestions.filter((s) =>
      suggestionIds.includes(s.id),
    );

    if (selectedSuggestions.length === 0) {
      return { taskId, field, applied: 0 };
    }

    let appendixId: string | undefined;

    switch (field) {
      case "acceptance_criteria":
        appendixId = await this.applyAcceptanceCriteria(
          taskId,
          selectedSuggestions,
        );
        break;
      case "file_impacts":
        await this.applyFileImpacts(taskId, selectedSuggestions);
        break;
      case "test_commands":
        appendixId = await this.applyTestCommands(taskId, selectedSuggestions);
        break;
      case "dependencies":
        await this.applyDependencies(taskId, selectedSuggestions);
        break;
    }

    // Log application for analytics
    await this.logSuggestionApplication(
      taskId,
      field,
      selectedSuggestions.length,
    );

    return {
      taskId,
      field,
      applied: selectedSuggestions.length,
      appendixId,
    };
  }

  // ============================================
  // Suggestion Generators
  // ============================================

  /**
   * Generate acceptance criteria suggestions from task description
   */
  private async suggestAcceptanceCriteria(
    task: TaskRow,
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const description = task.description || task.title;

    // Pattern-based suggestions from common task types
    if (task.category === "feature") {
      suggestions.push({
        id: uuidv4(),
        content: `The feature ${task.title.toLowerCase()} works as specified`,
        confidence: 0.7,
        source: "pattern",
        reasoning: "Standard feature completion criterion",
      });
    }

    if (task.category === "bug") {
      suggestions.push({
        id: uuidv4(),
        content: "The bug no longer reproduces",
        confidence: 0.9,
        source: "pattern",
        reasoning: "Standard bug fix criterion",
      });
      suggestions.push({
        id: uuidv4(),
        content: "No regression introduced",
        confidence: 0.8,
        source: "pattern",
        reasoning: "Regression prevention criterion",
      });
    }

    // Extract potential criteria from description keywords
    const actionKeywords = [
      "must",
      "should",
      "will",
      "can",
      "allow",
      "enable",
      "prevent",
    ];
    const words = description.toLowerCase().split(/\s+/);
    const hasActionKeyword = actionKeywords.some((k) => words.includes(k));

    if (hasActionKeyword) {
      suggestions.push({
        id: uuidv4(),
        content: description,
        confidence: 0.6,
        source: "ai",
        reasoning: "Extracted from task description",
      });
    }

    // Add testability criterion
    suggestions.push({
      id: uuidv4(),
      content: "All automated tests pass",
      confidence: 0.85,
      source: "template",
      reasoning: "Standard testability criterion",
    });

    return suggestions;
  }

  /**
   * Suggest file impacts based on task title and description
   */
  private async suggestFileImpacts(task: TaskRow): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const text = `${task.title} ${task.description || ""}`.toLowerCase();

    // Pattern matching for common file types
    const patterns = [
      {
        match: /database|migration|schema|table/,
        file: "database/migrations/*.sql",
        op: "CREATE",
      },
      { match: /api|route|endpoint/, file: "server/routes/*.ts", op: "UPDATE" },
      { match: /service/, file: "server/services/*.ts", op: "UPDATE" },
      {
        match: /component|ui|frontend/,
        file: "frontend/src/components/*.tsx",
        op: "UPDATE",
      },
      { match: /type|interface/, file: "types/*.ts", op: "UPDATE" },
      {
        match: /test|spec/,
        file: "tests/**/*.test.ts",
        op: "CREATE",
      },
    ];

    for (const pattern of patterns) {
      if (pattern.match.test(text)) {
        suggestions.push({
          id: uuidv4(),
          content: {
            filePath: pattern.file,
            operation: pattern.op,
          },
          confidence: 0.6,
          source: "pattern",
          reasoning: `Matched pattern: ${pattern.match.source}`,
        });
      }
    }

    // If no patterns matched, suggest based on category
    if (suggestions.length === 0) {
      const categoryFiles: Record<string, string> = {
        feature: "server/services/*.ts",
        bug: "server/**/*.ts",
        documentation: "docs/**/*.md",
        test: "tests/**/*.ts",
        infrastructure: "config/*.ts",
      };

      const suggestedFile = categoryFiles[task.category] || "src/**/*";
      suggestions.push({
        id: uuidv4(),
        content: { filePath: suggestedFile, operation: "UPDATE" },
        confidence: 0.4,
        source: "pattern",
        reasoning: `Based on task category: ${task.category}`,
      });
    }

    return suggestions;
  }

  /**
   * Suggest test commands based on existing file impacts
   */
  private async suggestTestCommands(task: TaskRow): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Get file impacts for this task
    const impacts = await query<{ file_path: string }>(
      "SELECT file_path FROM task_file_impacts WHERE task_id = ?",
      [task.id],
    );

    // Suggest tests based on file patterns
    const testPatterns = [
      { match: /frontend\/src\//, cmd: "npm run test:frontend" },
      { match: /server\//, cmd: "npm run test:server" },
      { match: /database\//, cmd: "npm run test:db" },
      { match: /tests\/e2e\//, cmd: "npm run test:e2e" },
    ];

    const suggestedCmds = new Set<string>();

    for (const impact of impacts) {
      for (const pattern of testPatterns) {
        if (pattern.match.test(impact.file_path)) {
          suggestedCmds.add(pattern.cmd);
        }
      }
    }

    // Always suggest basic type check
    suggestions.push({
      id: uuidv4(),
      content: "npx tsc --noEmit",
      confidence: 0.95,
      source: "template",
      reasoning: "TypeScript type checking",
    });

    // Add pattern-matched commands
    for (const cmd of suggestedCmds) {
      suggestions.push({
        id: uuidv4(),
        content: cmd,
        confidence: 0.7,
        source: "pattern",
        reasoning: "Matched file impact pattern",
      });
    }

    // Default test command if no specific ones found
    if (suggestedCmds.size === 0) {
      suggestions.push({
        id: uuidv4(),
        content: "npm test -- --passWithNoTests",
        confidence: 0.6,
        source: "template",
        reasoning: "Default test command",
      });
    }

    return suggestions;
  }

  /**
   * Suggest dependencies from related tasks
   */
  private async suggestDependencies(task: TaskRow): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Find tasks with similar titles or in the same project
    const relatedTasks = await query<{
      id: string;
      display_id: string;
      title: string;
      status: string;
    }>(
      `SELECT id, display_id, title, status FROM tasks
       WHERE project_id = ? AND id != ? AND status NOT IN ('completed', 'skipped')
       LIMIT 10`,
      [task.project_id, task.id],
    );

    // Simple keyword matching for potential dependencies
    const taskKeywords = new Set(task.title.toLowerCase().split(/\s+/));

    for (const related of relatedTasks) {
      const relatedKeywords = new Set(related.title.toLowerCase().split(/\s+/));
      const overlap = [...taskKeywords].filter((k) => relatedKeywords.has(k));

      if (overlap.length >= 2) {
        suggestions.push({
          id: uuidv4(),
          content: {
            targetTaskId: related.id,
            displayId: related.display_id,
            title: related.title,
          },
          confidence: Math.min(0.4 + overlap.length * 0.1, 0.8),
          source: "related_task",
          reasoning: `Shares keywords: ${overlap.join(", ")}`,
        });
      }
    }

    return suggestions;
  }

  // ============================================
  // Apply Helpers
  // ============================================

  private async applyAcceptanceCriteria(
    taskId: string,
    suggestions: Suggestion[],
  ): Promise<string> {
    const criteria = suggestions.map((s) => s.content as string);
    const appendixId = uuidv4();

    await run(
      `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
       VALUES (?, ?, 'acceptance_criteria', 'inline', ?, 0, datetime('now'))`,
      [appendixId, taskId, JSON.stringify(criteria)],
    );

    await saveDb();
    return appendixId;
  }

  private async applyFileImpacts(
    taskId: string,
    suggestions: Suggestion[],
  ): Promise<void> {
    for (const s of suggestions) {
      const content = s.content as { filePath: string; operation: string };
      const id = uuidv4();

      await run(
        `INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source, created_at)
         VALUES (?, ?, ?, ?, ?, 'ai_estimate', datetime('now'))`,
        [id, taskId, content.filePath, content.operation, s.confidence],
      );
    }

    await saveDb();
  }

  private async applyTestCommands(
    taskId: string,
    suggestions: Suggestion[],
  ): Promise<string> {
    const commands = suggestions.map((s) => s.content as string);
    const appendixId = uuidv4();

    // Use 'test_context' as the appendix type (includes test commands)
    await run(
      `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
       VALUES (?, ?, 'test_context', 'inline', ?, 0, datetime('now'))`,
      [appendixId, taskId, JSON.stringify({ commands })],
    );

    await saveDb();
    return appendixId;
  }

  private async applyDependencies(
    taskId: string,
    suggestions: Suggestion[],
  ): Promise<void> {
    for (const s of suggestions) {
      const content = s.content as { targetTaskId: string };
      const id = uuidv4();

      // Check if relationship already exists
      const existing = await getOne(
        `SELECT id FROM task_relationships
         WHERE source_task_id = ? AND target_task_id = ? AND relationship_type = 'depends_on'`,
        [taskId, content.targetTaskId],
      );

      if (!existing) {
        await run(
          `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
           VALUES (?, ?, ?, 'depends_on', datetime('now'))`,
          [id, taskId, content.targetTaskId],
        );
      }
    }

    await saveDb();
  }

  // ============================================
  // Preview Formatters
  // ============================================

  private formatAcceptanceCriteriaPreview(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) return "No criteria suggestions available.";
    return suggestions
      .map(
        (s, i) => `${i + 1}. ${s.content} (${Math.round(s.confidence * 100)}%)`,
      )
      .join("\n");
  }

  private formatFileImpactsPreview(suggestions: Suggestion[]): string {
    if (suggestions.length === 0)
      return "No file impact suggestions available.";
    return suggestions
      .map((s) => {
        const content = s.content as { filePath: string; operation: string };
        return `• ${content.operation} ${content.filePath} (${Math.round(s.confidence * 100)}%)`;
      })
      .join("\n");
  }

  private formatTestCommandsPreview(suggestions: Suggestion[]): string {
    if (suggestions.length === 0)
      return "No test command suggestions available.";
    return suggestions
      .map((s) => `$ ${s.content} (${Math.round(s.confidence * 100)}%)`)
      .join("\n");
  }

  private formatDependenciesPreview(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) return "No dependency suggestions available.";
    return suggestions
      .map((s) => {
        const content = s.content as {
          displayId: string;
          title: string;
        };
        return `→ ${content.displayId}: ${content.title} (${Math.round(s.confidence * 100)}%)`;
      })
      .join("\n");
  }

  // ============================================
  // Analytics
  // ============================================

  private async logSuggestionRequest(
    taskId: string,
    field: AutoPopulateField,
    count: number,
  ): Promise<void> {
    try {
      await run(
        `INSERT INTO auto_populate_log (id, task_id, field, suggestion_count, action, created_at)
         VALUES (?, ?, ?, ?, 'request', datetime('now'))`,
        [uuidv4(), taskId, field, count],
      );
      await saveDb();
    } catch {
      // Log table might not exist, ignore
    }
  }

  private async logSuggestionApplication(
    taskId: string,
    field: AutoPopulateField,
    applied: number,
  ): Promise<void> {
    try {
      await run(
        `INSERT INTO auto_populate_log (id, task_id, field, applied_count, action, created_at)
         VALUES (?, ?, ?, ?, 'apply', datetime('now'))`,
        [uuidv4(), taskId, field, applied],
      );
      await saveDb();
    } catch {
      // Log table might not exist, ignore
    }
  }
}

// Export singleton instance
export const taskAutoPopulateService = new TaskAutoPopulateService();
export default taskAutoPopulateService;
