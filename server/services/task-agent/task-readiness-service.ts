/**
 * Task Readiness Service
 *
 * Calculates task readiness based on 6 atomicity rules with weighted scoring.
 * Used by the Pipeline Dashboard to show readiness indicators and enforce hard gates.
 *
 * Rule Weights (per TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md):
 * - Single Concern: 15%
 * - Bounded Files: 15%
 * - Time Bounded: 10%
 * - Testable: 25% (highest - must have test_commands appendix)
 * - Independent: 10%
 * - Clear Completion: 25% (highest - must have acceptance_criteria appendix)
 *
 * Threshold: 70% readiness required for execution
 */

import { query, getOne } from "../../../database/db.js";
import { Task } from "../../../types/task-agent.js";

// ============================================
// Types
// ============================================

/**
 * Status for each rule check
 */
export type RuleStatus = "pass" | "fail" | "warning";

/**
 * Individual rule result
 */
export interface RuleResult {
  rule: string;
  score: number; // 0-100
  weight: number; // percentage (0-1)
  status: RuleStatus;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete readiness score for a task
 */
export interface ReadinessScore {
  taskId: string;
  overall: number; // 0-100
  rules: {
    singleConcern: RuleResult;
    boundedFiles: RuleResult;
    timeBounded: RuleResult;
    testable: RuleResult;
    independent: RuleResult;
    clearCompletion: RuleResult;
  };
  threshold: number; // 70
  isReady: boolean; // overall >= threshold
  missingItems: string[]; // Human-readable list of what's missing
  calculatedAt: string;
}

/**
 * Bulk readiness response
 */
export interface BulkReadinessResult {
  taskListId: string;
  tasks: Map<string, ReadinessScore>;
  summary: {
    total: number;
    ready: number;
    notReady: number;
    averageReadiness: number;
  };
  calculatedAt: string;
}

/**
 * Cache entry
 */
interface CacheEntry {
  score: ReadinessScore;
  timestamp: number;
}

// ============================================
// Rule Weights (per documentation)
// ============================================

const RULE_WEIGHTS = {
  singleConcern: 0.15, // 15%
  boundedFiles: 0.15, // 15%
  timeBounded: 0.1, // 10%
  testable: 0.25, // 25% - highest
  independent: 0.1, // 10%
  clearCompletion: 0.25, // 25% - highest
};

const READINESS_THRESHOLD = 70; // 70% required for execution

// ============================================
// Task Readiness Service
// ============================================

/**
 * Task Readiness Service class
 */
export class TaskReadinessService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 60000; // 1 minute

  /**
   * Calculate readiness for a single task
   */
  async calculateReadiness(taskId: string): Promise<ReadinessScore> {
    // Check cache first
    const cached = this.getCached(taskId);
    if (cached) {
      return cached;
    }

    // Get task
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Calculate all rules
    const [
      singleConcern,
      boundedFiles,
      timeBounded,
      testable,
      independent,
      clearCompletion,
    ] = await Promise.all([
      this.checkSingleConcern(task),
      this.checkBoundedFiles(task),
      this.checkTimeBounded(task),
      this.checkTestable(task),
      this.checkIndependent(task),
      this.checkClearCompletion(task),
    ]);

    // Calculate weighted overall score
    const overall = Math.round(
      singleConcern.score * RULE_WEIGHTS.singleConcern +
        boundedFiles.score * RULE_WEIGHTS.boundedFiles +
        timeBounded.score * RULE_WEIGHTS.timeBounded +
        testable.score * RULE_WEIGHTS.testable +
        independent.score * RULE_WEIGHTS.independent +
        clearCompletion.score * RULE_WEIGHTS.clearCompletion,
    );

    // Build missing items list
    const missingItems: string[] = [];
    if (singleConcern.status === "fail") {
      missingItems.push("Task may have multiple concerns - consider splitting");
    }
    if (boundedFiles.status === "fail") {
      missingItems.push(
        `Task impacts too many files (${boundedFiles.details?.fileCount ?? "?"} files, max 3 recommended)`,
      );
    }
    if (timeBounded.status === "fail") {
      missingItems.push(
        `Task effort (${task.effort}) may exceed 1 hour budget`,
      );
    }
    if (testable.status === "fail") {
      missingItems.push("Missing test commands - add test_commands appendix");
    }
    if (independent.status === "fail") {
      missingItems.push(
        `Task has ${independent.details?.depCount ?? "?"} incomplete dependencies`,
      );
    }
    if (clearCompletion.status === "fail") {
      missingItems.push(
        "Missing acceptance criteria - add acceptance_criteria appendix",
      );
    }

    const score: ReadinessScore = {
      taskId,
      overall,
      rules: {
        singleConcern,
        boundedFiles,
        timeBounded,
        testable,
        independent,
        clearCompletion,
      },
      threshold: READINESS_THRESHOLD,
      isReady: overall >= READINESS_THRESHOLD,
      missingItems,
      calculatedAt: new Date().toISOString(),
    };

    // Cache the result
    this.setCache(taskId, score);

    return score;
  }

  /**
   * Calculate readiness for all tasks in a task list (bulk)
   */
  async calculateBulkReadiness(
    taskListId: string,
  ): Promise<BulkReadinessResult> {
    // Get all tasks in the task list
    const tasks = await query<{ id: string }>(
      "SELECT id FROM tasks WHERE task_list_id = ?",
      [taskListId],
    );

    const taskScores = new Map<string, ReadinessScore>();
    let totalReadiness = 0;
    let readyCount = 0;

    // Calculate readiness for each task in parallel batches
    const batchSize = 10;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const scores = await Promise.all(
        batch.map((t) => this.calculateReadiness(t.id)),
      );

      for (const score of scores) {
        taskScores.set(score.taskId, score);
        totalReadiness += score.overall;
        if (score.isReady) readyCount++;
      }
    }

    return {
      taskListId,
      tasks: taskScores,
      summary: {
        total: tasks.length,
        ready: readyCount,
        notReady: tasks.length - readyCount,
        averageReadiness:
          tasks.length > 0 ? Math.round(totalReadiness / tasks.length) : 0,
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Invalidate cache for a task
   */
  async invalidateCache(taskId: string): Promise<void> {
    this.cache.delete(taskId);
  }

  /**
   * Invalidate all cache entries for a task list
   */
  async invalidateTaskListCache(taskListId: string): Promise<void> {
    const tasks = await query<{ id: string }>(
      "SELECT id FROM tasks WHERE task_list_id = ?",
      [taskListId],
    );

    for (const task of tasks) {
      this.cache.delete(task.id);
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================
  // Rule Check Methods
  // ============================================

  /**
   * Rule 1: Single Concern - One logical change only (15%)
   */
  private async checkSingleConcern(task: Task): Promise<RuleResult> {
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

    let score: number;
    let status: RuleStatus;
    let reason: string | undefined;

    if (hasMultiple || mentionedComponents.length > 2) {
      score = 40;
      status = "fail";
      reason = hasMultiple
        ? "Task description suggests multiple concerns"
        : `Task mentions ${mentionedComponents.length} different components`;
    } else if (mentionedComponents.length === 2) {
      score = 70;
      status = "warning";
      reason = "Task mentions 2 components - consider if they can be split";
    } else {
      score = 100;
      status = "pass";
    }

    return {
      rule: "single_concern",
      score,
      weight: RULE_WEIGHTS.singleConcern,
      status,
      reason,
      details: { mentionedComponents },
    };
  }

  /**
   * Rule 2: Bounded Files - Limited file impact (15%)
   * Per documentation: ≤3 files recommended
   */
  private async checkBoundedFiles(task: Task): Promise<RuleResult> {
    const maxFiles = 3; // Per documentation

    // Get predicted file impacts
    const impacts = await query<{ target_path: string }>(
      `SELECT DISTINCT file_path as target_path FROM task_file_impacts WHERE task_id = ?`,
      [task.id],
    );

    const fileCount = impacts.length;
    let score: number;
    let status: RuleStatus;

    if (fileCount === 0) {
      // No file impacts defined - warning but not failing
      score = 70;
      status = "warning";
    } else if (fileCount <= maxFiles) {
      score = 100;
      status = "pass";
    } else if (fileCount <= maxFiles * 2) {
      score = 50;
      status = "warning";
    } else {
      score = Math.max(20, 100 - (fileCount - maxFiles) * 15);
      status = "fail";
    }

    return {
      rule: "bounded_files",
      score,
      weight: RULE_WEIGHTS.boundedFiles,
      status,
      reason:
        fileCount > maxFiles
          ? `Task impacts ${fileCount} files (max recommended: ${maxFiles})`
          : fileCount === 0
            ? "No file impacts defined"
            : undefined,
      details: { fileCount, maxFiles },
    };
  }

  /**
   * Rule 3: Time Bounded - Completable in ≤1 hour (10%)
   * Per documentation: effort ∈ {trivial, small, medium}
   */
  private async checkTimeBounded(task: Task): Promise<RuleResult> {
    // Map effort to estimated hours and if they pass the 1-hour threshold
    const effortConfig: Record<string, { hours: number; passes: boolean }> = {
      trivial: { hours: 0.25, passes: true },
      small: { hours: 0.5, passes: true },
      medium: { hours: 1, passes: true },
      large: { hours: 4, passes: false },
      epic: { hours: 8, passes: false },
    };

    const config = effortConfig[task.effort] || { hours: 4, passes: false };
    let score: number;
    let status: RuleStatus;

    if (config.passes) {
      score = 100;
      status = "pass";
    } else if (task.effort === "large") {
      score = 50;
      status = "warning";
    } else {
      score = 20;
      status = "fail";
    }

    return {
      rule: "time_bounded",
      score,
      weight: RULE_WEIGHTS.timeBounded,
      status,
      reason: !config.passes
        ? `Task effort (${task.effort}) suggests ${config.hours}h - exceeds 1h budget`
        : undefined,
      details: { effort: task.effort, estimatedHours: config.hours },
    };
  }

  /**
   * Rule 4: Testable - Has test_context appendix (25%)
   * This is one of the highest weighted rules
   */
  private async checkTestable(task: Task): Promise<RuleResult> {
    // Check for test_context appendix (the valid appendix type for test commands)
    const hasTestContext = await getOne<{ id: string }>(
      `SELECT id FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'test_context'`,
      [task.id],
    );

    let score: number;
    let status: RuleStatus;
    let reason: string | undefined;

    if (hasTestContext) {
      // Full pass - has test context with commands
      score = 100;
      status = "pass";
    } else {
      // Fail - no test configuration
      score = 0;
      status = "fail";
      reason = "Missing test_context appendix - required for execution";
    }

    return {
      rule: "testable",
      score,
      weight: RULE_WEIGHTS.testable,
      status,
      reason,
      details: {
        hasTestContext: !!hasTestContext,
      },
    };
  }

  /**
   * Rule 5: Independent - All dependencies completed (10%)
   */
  private async checkIndependent(task: Task): Promise<RuleResult> {
    // Count incomplete dependencies (depends_on relationships where target is not completed)
    const incompleteDeps = await query<{ id: string; status: string }>(
      `SELECT t.id, t.status FROM task_relationships tr
       JOIN tasks t ON tr.target_task_id = t.id
       WHERE tr.source_task_id = ?
         AND tr.relationship_type = 'depends_on'
         AND t.status NOT IN ('completed', 'skipped')`,
      [task.id],
    );

    const depCount = incompleteDeps.length;
    let score: number;
    let status: RuleStatus;

    if (depCount === 0) {
      score = 100;
      status = "pass";
    } else if (depCount <= 2) {
      score = 60;
      status = "warning";
    } else {
      score = Math.max(20, 100 - depCount * 20);
      status = "fail";
    }

    return {
      rule: "independent",
      score,
      weight: RULE_WEIGHTS.independent,
      status,
      reason:
        depCount > 0 ? `${depCount} dependencies not yet completed` : undefined,
      details: {
        depCount,
        incompleteDeps: incompleteDeps.map((d) => ({
          id: d.id,
          status: d.status,
        })),
      },
    };
  }

  /**
   * Rule 6: Clear Completion - Has acceptance_criteria appendix (25%)
   * This is one of the highest weighted rules
   */
  private async checkClearCompletion(task: Task): Promise<RuleResult> {
    // Check for acceptance_criteria appendix (primary requirement)
    const hasAcceptanceCriteria = await getOne<{ id: string; content: string }>(
      `SELECT id, content FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'acceptance_criteria'`,
      [task.id],
    );

    let score: number;
    let status: RuleStatus;
    let reason: string | undefined;
    let criteriaCount = 0;

    if (hasAcceptanceCriteria) {
      // Parse criteria count if possible
      try {
        const content = hasAcceptanceCriteria.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            criteriaCount = parsed.length;
          } else if (parsed.criteria && Array.isArray(parsed.criteria)) {
            criteriaCount = parsed.criteria.length;
          }
        }
      } catch {
        // Content might not be JSON, count lines
        criteriaCount = (
          hasAcceptanceCriteria.content?.split("\n") || []
        ).filter((l) => l.trim().length > 0).length;
      }

      if (criteriaCount >= 1) {
        score = 100;
        status = "pass";
      } else {
        score = 70;
        status = "warning";
        reason = "Acceptance criteria appendix exists but appears empty";
      }
    } else {
      // Fail - no acceptance criteria
      score = 0;
      status = "fail";
      reason = "Missing acceptance_criteria appendix - required for execution";
    }

    return {
      rule: "clear_completion",
      score,
      weight: RULE_WEIGHTS.clearCompletion,
      status,
      reason,
      details: {
        hasAcceptanceCriteria: !!hasAcceptanceCriteria,
        criteriaCount,
      },
    };
  }

  // ============================================
  // Cache Management
  // ============================================

  private getCached(taskId: string): ReadinessScore | null {
    const entry = this.cache.get(taskId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(taskId);
      return null;
    }

    return entry.score;
  }

  private setCache(taskId: string, score: ReadinessScore): void {
    this.cache.set(taskId, {
      score,
      timestamp: Date.now(),
    });
  }
}

// Export singleton instance
export const taskReadinessService = new TaskReadinessService();
export default taskReadinessService;
