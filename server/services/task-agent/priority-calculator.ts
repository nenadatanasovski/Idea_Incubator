/**
 * Priority Calculator
 *
 * Calculates and adjusts task priorities based on multiple factors.
 * Part of: Task System V2 Implementation Plan (IMPL-4.8)
 */

import { query, getOne } from "../../../database/db.js";
import { Task, TaskPriority } from "../../../types/task-agent.js";

/**
 * Priority calculation result
 */
export interface PriorityResult {
  taskId: string;
  score: number; // 0-100
  factors: {
    blockingCount: number;
    dependencyDepth: number;
    effortScore: number;
    quickWinBonus: number;
    userPriority: number;
  };
  isQuickWin: boolean;
  suggestedPriority: TaskPriority;
}

/**
 * Priority factors weights
 */
const WEIGHTS = {
  blocking: 10,
  dependencyDepth: 5,
  effort: 1,
  quickWin: 15,
  userPriority: 2,
};

/**
 * Effort to score mapping
 */
const EFFORT_SCORES: Record<string, number> = {
  trivial: 10,
  small: 8,
  medium: 5,
  large: 2,
  epic: 0,
};

/**
 * User priority to score mapping
 */
const PRIORITY_SCORES: Record<TaskPriority, number> = {
  P1: 10,
  P2: 7,
  P3: 4,
  P4: 1,
};

/**
 * Priority Calculator class
 */
export class PriorityCalculator {
  /**
   * Calculate priority for a single task
   */
  async calculate(taskId: string): Promise<PriorityResult> {
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Calculate factors
    const blockingCount = await this.getBlockingCount(taskId);
    const dependencyDepth = await this.getDependencyDepth(taskId);
    const effortScore = await this.getEffortScore(task);
    const quickWinScore = await this.getQuickWinScore(task);
    const userPriority = PRIORITY_SCORES[task.priority];

    // Calculate total score using formula:
    // score = (blockingCount * 10) + (1/dependencyDepth * 5) + effortScore + quickWinBonus + (userPriority * 2)
    const depthFactor =
      dependencyDepth > 0
        ? (1 / dependencyDepth) * WEIGHTS.dependencyDepth
        : WEIGHTS.dependencyDepth;
    const quickWinBonus = quickWinScore > 7 ? WEIGHTS.quickWin : 0;

    const score = Math.min(
      100,
      Math.round(
        blockingCount * WEIGHTS.blocking +
          depthFactor +
          effortScore +
          quickWinBonus +
          userPriority * WEIGHTS.userPriority,
      ),
    );

    // Determine if this is a quick win
    const isQuickWin = quickWinScore > 7;

    // Suggest priority based on score
    const suggestedPriority = this.scoreToSuggestedPriority(score);

    return {
      taskId,
      score,
      factors: {
        blockingCount,
        dependencyDepth,
        effortScore,
        quickWinBonus,
        userPriority,
      },
      isQuickWin,
      suggestedPriority,
    };
  }

  /**
   * Calculate priorities for all tasks in a list
   */
  async calculateForList(
    taskListId: string,
  ): Promise<Map<string, PriorityResult>> {
    const tasks = await query<{ id: string }>(
      "SELECT id FROM tasks WHERE task_list_id = ?",
      [taskListId],
    );

    const results = new Map<string, PriorityResult>();

    for (const task of tasks) {
      results.set(task.id, await this.calculate(task.id));
    }

    return results;
  }

  /**
   * Get number of tasks that this task blocks
   */
  async getBlockingCount(taskId: string): Promise<number> {
    const result = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_relationships
       WHERE target_task_id = ? AND relationship_type = 'depends_on'`,
      [taskId],
    );
    return result?.count || 0;
  }

  /**
   * Get dependency depth (how many levels of dependencies)
   */
  async getDependencyDepth(taskId: string): Promise<number> {
    let depth = 0;
    let currentLevel = [taskId];
    const visited = new Set<string>();

    while (currentLevel.length > 0 && depth < 10) {
      const nextLevel: string[] = [];

      for (const id of currentLevel) {
        if (visited.has(id)) continue;
        visited.add(id);

        const deps = await query<{ target_task_id: string }>(
          `SELECT target_task_id FROM task_relationships
           WHERE source_task_id = ? AND relationship_type = 'depends_on'`,
          [id],
        );

        for (const dep of deps) {
          if (!visited.has(dep.target_task_id)) {
            nextLevel.push(dep.target_task_id);
          }
        }
      }

      if (nextLevel.length > 0) {
        depth++;
        currentLevel = nextLevel;
      } else {
        break;
      }
    }

    return depth;
  }

  /**
   * Get effort score for a task
   */
  async getEffortScore(task: Task): Promise<number> {
    return EFFORT_SCORES[task.effort] ?? 5;
  }

  /**
   * Get quick win score (high value, low effort)
   */
  async getQuickWinScore(task: Task): Promise<number> {
    // Quick win = trivial/small effort + high priority
    const effortBonus =
      task.effort === "trivial" ? 5 : task.effort === "small" ? 3 : 0;
    const priorityBonus =
      task.priority === "P1" ? 5 : task.priority === "P2" ? 3 : 0;

    return effortBonus + priorityBonus;
  }

  /**
   * Sort task IDs by priority
   */
  async sortByPriority(taskIds: string[]): Promise<string[]> {
    const results: Array<{ id: string; score: number }> = [];

    for (const id of taskIds) {
      try {
        const result = await this.calculate(id);
        results.push({ id, score: result.score });
      } catch {
        results.push({ id, score: 0 });
      }
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.id);
  }

  /**
   * Convert score to suggested priority
   */
  private scoreToSuggestedPriority(score: number): TaskPriority {
    if (score >= 70) return "P1";
    if (score >= 50) return "P2";
    if (score >= 30) return "P3";
    return "P4";
  }

  /**
   * Recalculate priorities for a task list after changes
   */
  async recalculateList(taskListId: string): Promise<void> {
    const priorities = await this.calculateForList(taskListId);

    // Get tasks that should be reordered
    const tasks = await query<{ id: string; position: number }>(
      "SELECT id, position FROM tasks WHERE task_list_id = ? ORDER BY position",
      [taskListId],
    );

    // Sort by calculated priority
    const sortedIds = [...priorities.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id]) => id);

    // This could update positions if needed
    // For now, just return the calculation
  }

  /**
   * Get priority statistics for a task list
   */
  async getListStats(taskListId: string): Promise<{
    total: number;
    byPriority: Record<TaskPriority, number>;
    quickWins: number;
    avgScore: number;
  }> {
    const priorities = await this.calculateForList(taskListId);
    const byPriority: Record<TaskPriority, number> = {
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };
    let quickWins = 0;
    let totalScore = 0;

    for (const result of priorities.values()) {
      byPriority[result.suggestedPriority]++;
      if (result.isQuickWin) quickWins++;
      totalScore += result.score;
    }

    return {
      total: priorities.size,
      byPriority,
      quickWins,
      avgScore:
        priorities.size > 0 ? Math.round(totalScore / priorities.size) : 0,
    };
  }
}

// Export singleton instance
export const priorityCalculator = new PriorityCalculator();
export default priorityCalculator;
