/**
 * Atomicity Validator
 *
 * Validates that tasks are atomic enough for execution.
 * Part of: Task System V2 Implementation Plan (IMPL-4.3)
 */

import { query, getOne } from "../../../database/db.js";
import { Task } from "../../../types/task-agent.js";

/**
 * Atomicity rule result
 */
export interface RuleResult {
  rule: string;
  passed: boolean;
  score: number; // 0-100
  reason?: string;
}

/**
 * Overall atomicity result
 */
export interface AtomicityResult {
  isAtomic: boolean;
  score: number; // 0-100
  rules: RuleResult[];
  violations: RuleResult[]; // Rules that didn't pass
  suggestedSplits?: string[];
}

/**
 * Atomicity thresholds
 */
const THRESHOLDS = {
  maxFiles: 5,
  maxHours: 8,
  minScore: 70,
};

/**
 * Atomicity Validator class
 */
export class AtomicityValidator {
  /**
   * Validate a task for atomicity
   */
  async validate(task: Task): Promise<AtomicityResult> {
    const rules: RuleResult[] = [];

    // Check all six atomicity rules
    rules.push(await this.checkSingleConcern(task));
    rules.push(await this.checkBoundedFiles(task));
    rules.push(await this.checkTimeBounded(task));
    rules.push(await this.checkTestable(task));
    rules.push(await this.checkIndependent(task));
    rules.push(await this.checkClearCompletion(task));

    // Calculate overall score
    const totalScore = rules.reduce((sum, r) => sum + r.score, 0);
    const avgScore = Math.round(totalScore / rules.length);
    const isAtomic =
      avgScore >= THRESHOLDS.minScore && rules.every((r) => r.score >= 50);

    // Generate split suggestions if not atomic
    const suggestedSplits = isAtomic
      ? undefined
      : await this.suggestSplits(task, rules);

    // Filter to get violations (rules that didn't pass)
    const violations = rules.filter((r) => !r.passed);

    return {
      isAtomic,
      score: avgScore,
      rules,
      violations,
      suggestedSplits,
    };
  }

  /**
   * Validate a task by ID (fetches task first)
   */
  async validateById(taskId: string): Promise<AtomicityResult> {
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return this.validate(task);
  }

  /**
   * Validate multiple tasks
   */
  async validateAll(taskIds: string[]): Promise<Map<string, AtomicityResult>> {
    const results = new Map<string, AtomicityResult>();

    for (const taskId of taskIds) {
      const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
        taskId,
      ]);

      if (task) {
        results.set(taskId, await this.validate(task));
      }
    }

    return results;
  }

  /**
   * Rule 1: Single Concern - One logical change only
   */
  async checkSingleConcern(task: Task): Promise<RuleResult> {
    const description = task.description || "";
    const title = task.title || "";
    const text = `${title} ${description}`.toLowerCase();

    // Look for indicators of multiple concerns
    const multipleIndicators = [
      /\band\b.*\band\b/i, // Multiple "and"s
      /\balso\b/i,
      /\badditionally\b/i,
      /\bfurthermore\b/i,
      /\bplus\b/i,
      /\d+\.\s+.*\d+\./, // Numbered lists
    ];

    const hasMultiple = multipleIndicators.some((re) => re.test(text));

    // Check for multiple component types mentioned
    const componentIndicators = [
      "database",
      "api",
      "ui",
      "frontend",
      "backend",
      "test",
    ];
    const mentionedComponents = componentIndicators.filter((c) =>
      text.includes(c),
    );

    const score = hasMultiple || mentionedComponents.length > 2 ? 40 : 100;

    return {
      rule: "single_concern",
      passed: score >= 70,
      score,
      reason: hasMultiple
        ? "Task description suggests multiple concerns"
        : mentionedComponents.length > 2
          ? `Task mentions ${mentionedComponents.length} different components`
          : undefined,
    };
  }

  /**
   * Rule 2: Bounded Files - Limited file impact
   */
  async checkBoundedFiles(
    task: Task,
    maxFiles: number = THRESHOLDS.maxFiles,
  ): Promise<RuleResult> {
    // Get predicted file impacts
    const impacts = await query<{ target_path: string }>(
      "SELECT DISTINCT target_path FROM task_impacts WHERE task_id = ? AND impact_type = ?",
      [task.id, "file"],
    );

    const fileCount = impacts.length;
    let score: number;

    if (fileCount <= maxFiles) {
      score = 100;
    } else if (fileCount <= maxFiles * 2) {
      score = 60;
    } else {
      score = Math.max(20, 100 - (fileCount - maxFiles) * 10);
    }

    return {
      rule: "bounded_files",
      passed: fileCount <= maxFiles,
      score,
      reason:
        fileCount > maxFiles
          ? `Task impacts ${fileCount} files (max recommended: ${maxFiles})`
          : undefined,
    };
  }

  /**
   * Rule 3: Time Bounded - Completable in reasonable time
   */
  async checkTimeBounded(
    task: Task,
    maxHours: number = THRESHOLDS.maxHours,
  ): Promise<RuleResult> {
    // Map effort to estimated hours
    const effortHours: Record<string, number> = {
      trivial: 0.5,
      small: 2,
      medium: 4,
      large: 8,
      epic: 16,
    };

    const estimatedHours = effortHours[task.effort] || 4;
    const score =
      estimatedHours <= maxHours
        ? 100
        : Math.max(20, 100 - (estimatedHours - maxHours) * 10);

    return {
      rule: "time_bounded",
      passed: estimatedHours <= maxHours,
      score,
      reason:
        estimatedHours > maxHours
          ? `Task effort (${task.effort}) suggests ${estimatedHours}h (max: ${maxHours}h)`
          : undefined,
    };
  }

  /**
   * Rule 4: Testable - Has clear validation criteria
   */
  async checkTestable(task: Task): Promise<RuleResult> {
    // Check if task has acceptance criteria appendix
    const hasAcceptanceCriteria = await getOne<{ id: string }>(
      `SELECT id FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'acceptance_criteria'`,
      [task.id],
    );

    // Check if task has test config or test context
    const hasTestContext = await getOne<{ id: string }>(
      `SELECT id FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'test_context'`,
      [task.id],
    );

    // Check description for testable language
    const description = task.description || "";
    const testableIndicators = [
      /should\s+\w+/i,
      /must\s+\w+/i,
      /verify\s+that/i,
      /ensure\s+that/i,
      /when\s+.*then/i,
      /given\s+.*when/i,
    ];
    const hasTestableLanguage = testableIndicators.some((re) =>
      re.test(description),
    );

    let score = 50; // Base score
    if (hasAcceptanceCriteria) score += 30;
    if (hasTestContext) score += 10;
    if (hasTestableLanguage) score += 10;

    return {
      rule: "testable",
      passed: score >= 70,
      score: Math.min(100, score),
      reason:
        score < 70
          ? "Task lacks clear acceptance criteria or test context"
          : undefined,
    };
  }

  /**
   * Rule 5: Independent - Minimal dependencies
   */
  async checkIndependent(task: Task): Promise<RuleResult> {
    // Count dependencies
    const dependencies = await query<{ id: string }>(
      `SELECT id FROM task_relationships
       WHERE source_task_id = ? AND relationship_type = 'depends_on'`,
      [task.id],
    );

    const depCount = dependencies.length;
    let score: number;

    if (depCount === 0) {
      score = 100;
    } else if (depCount <= 2) {
      score = 80;
    } else if (depCount <= 4) {
      score = 60;
    } else {
      score = Math.max(20, 80 - depCount * 10);
    }

    return {
      rule: "independent",
      passed: depCount <= 2,
      score,
      reason:
        depCount > 2
          ? `Task has ${depCount} dependencies (recommended: ≤2)`
          : undefined,
    };
  }

  /**
   * Rule 6: Clear Completion - Unambiguous done state
   */
  async checkClearCompletion(task: Task): Promise<RuleResult> {
    const description = task.description || "";
    const title = task.title || "";
    const text = `${title} ${description}`.toLowerCase();

    // Look for clear completion indicators
    const clearIndicators = [
      /add\s+\w+/i,
      /create\s+\w+/i,
      /implement\s+\w+/i,
      /fix\s+\w+/i,
      /update\s+\w+/i,
      /remove\s+\w+/i,
      /delete\s+\w+/i,
      /refactor\s+\w+/i,
    ];

    // Look for vague completion indicators
    const vagueIndicators = [
      /improve/i,
      /optimize/i,
      /enhance/i,
      /better/i,
      /as needed/i,
      /when appropriate/i,
      /various/i,
      /etc/i,
    ];

    const hasClear = clearIndicators.some((re) => re.test(text));
    const hasVague = vagueIndicators.some((re) => re.test(text));

    let score = 70; // Base score
    if (hasClear) score += 20;
    if (hasVague) score -= 30;

    return {
      rule: "clear_completion",
      passed: score >= 70,
      score: Math.max(0, Math.min(100, score)),
      reason: score < 70 ? "Task has vague completion criteria" : undefined,
    };
  }

  /**
   * Suggest splits for non-atomic task
   */
  private async suggestSplits(
    task: Task,
    rules: RuleResult[],
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const failedRules = rules.filter((r) => !r.passed);

    for (const rule of failedRules) {
      switch (rule.rule) {
        case "single_concern":
          suggestions.push(
            "Split into separate tasks for each component/concern",
          );
          break;
        case "bounded_files":
          suggestions.push("Split by file/module boundaries");
          break;
        case "time_bounded":
          suggestions.push("Break into smaller incremental changes");
          break;
        case "testable":
          suggestions.push(
            "Add explicit acceptance criteria before proceeding",
          );
          break;
        case "independent":
          suggestions.push("Consider completing blocking dependencies first");
          break;
        case "clear_completion":
          suggestions.push("Define specific, measurable completion criteria");
          break;
      }
    }

    return [...new Set(suggestions)];
  }
}

// Export singleton instance
export const atomicityValidator = new AtomicityValidator();
export default atomicityValidator;
