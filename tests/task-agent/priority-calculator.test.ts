/**
 * Priority Calculator Tests
 *
 * Unit tests for the priority calculator service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.8)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { priorityCalculator } from "../../server/services/task-agent/priority-calculator";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "PRIORITY-TEST-";

// Create test task
async function createTestTask(attrs: {
  priority?: string;
  effort?: string;
  status?: string;
  createdDaysAgo?: number;
}): Promise<string> {
  const taskId = uuidv4();
  const createdAt = attrs.createdDaysAgo
    ? new Date(
        Date.now() - attrs.createdDaysAgo * 24 * 60 * 60 * 1000,
      ).toISOString()
    : new Date().toISOString();

  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'feature', ?, ?, ?, ?)`,
    [
      taskId,
      `${TEST_PREFIX}${taskId.slice(0, 8)}`,
      `${TEST_PREFIX}Test Task`,
      attrs.status || "pending",
      attrs.priority || "P2",
      attrs.effort || "medium",
      createdAt,
      createdAt,
    ],
  );
  await saveDb();
  return taskId;
}

// Create dependency
async function createDependency(taskA: string, taskB: string): Promise<void> {
  await run(
    `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
     VALUES (?, ?, ?, 'depends_on', datetime('now'))`,
    [uuidv4(), taskA, taskB],
  );
  await saveDb();
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM task_relationships WHERE source_task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(
    `DELETE FROM task_relationships WHERE target_task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("PriorityCalculator", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("calculate", () => {
    it("should calculate priority score", async () => {
      const taskId = await createTestTask({ priority: "P2" });

      const result = await priorityCalculator.calculate(taskId);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(taskId);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should return higher score for P1 than P3", async () => {
      const p1Task = await createTestTask({ priority: "P1" });
      const p3Task = await createTestTask({ priority: "P3" });

      const p1Result = await priorityCalculator.calculate(p1Task);
      const p3Result = await priorityCalculator.calculate(p3Task);

      expect(p1Result.score).toBeGreaterThan(p3Result.score);
    });
  });

  describe("blocking boost", () => {
    it("should boost priority for tasks blocking others", async () => {
      const blockerTask = await createTestTask({ priority: "P2" });
      const dependentTask1 = await createTestTask({ priority: "P2" });
      const dependentTask2 = await createTestTask({ priority: "P2" });

      // Both dependent tasks depend on blocker
      await createDependency(dependentTask1, blockerTask);
      await createDependency(dependentTask2, blockerTask);

      const nonBlockerTask = await createTestTask({ priority: "P2" });

      const blockerResult = await priorityCalculator.calculate(blockerTask);
      const nonBlockerResult =
        await priorityCalculator.calculate(nonBlockerTask);

      expect(blockerResult.factors.blockingCount).toBe(2);
      expect(blockerResult.factors.blockingCount).toBeGreaterThan(0);
      expect(blockerResult.score).toBeGreaterThan(
        nonBlockerResult.score,
      );
    });
  });

  describe("effort discount", () => {
    it("should provide discount for small effort tasks", async () => {
      const smallTask = await createTestTask({
        effort: "small",
        priority: "P2",
      });
      const largeTask = await createTestTask({
        effort: "large",
        priority: "P2",
      });

      const smallResult = await priorityCalculator.calculate(smallTask);
      const largeResult = await priorityCalculator.calculate(largeTask);

      expect(smallResult.factors.effortScore).toBeGreaterThan(
        largeResult.factors.effortScore,
      );
    });
  });

  // NOTE: Priority calculator doesn't have a stale boost factor
  // Testing that priority calculation works for older tasks
  describe("age handling", () => {
    it("should calculate priority for tasks regardless of age", async () => {
      const freshTask = await createTestTask({ createdDaysAgo: 0 });
      const olderTask = await createTestTask({ createdDaysAgo: 7 });

      const freshResult = await priorityCalculator.calculate(freshTask);
      const olderResult = await priorityCalculator.calculate(olderTask);

      // Both should have valid scores
      expect(freshResult.score).toBeGreaterThan(0);
      expect(olderResult.score).toBeGreaterThan(0);
    });
  });

  describe("dependency tracking", () => {
    it("should track tasks with dependencies", async () => {
      const blockedTask = await createTestTask({ status: "pending" });
      const dependencyTask = await createTestTask({ status: "pending" });

      // blockedTask depends on dependencyTask
      await createDependency(blockedTask, dependencyTask);

      const unblockedTask = await createTestTask({ status: "pending" });

      const blockedResult = await priorityCalculator.calculate(blockedTask);
      const unblockedResult = await priorityCalculator.calculate(unblockedTask);

      // Blocked task should have higher dependency depth
      expect(blockedResult.factors.dependencyDepth).toBeGreaterThan(
        unblockedResult.factors.dependencyDepth,
      );
    });
  });

  describe("quick win detection", () => {
    it("should identify quick wins", async () => {
      // Quick win: small effort, no blockers, high priority
      const quickWinTask = await createTestTask({
        priority: "P1",
        effort: "small",
      });

      const result = await priorityCalculator.calculate(quickWinTask);

      expect(result.isQuickWin).toBe(true);
    });

    it("should not flag large tasks as quick wins", async () => {
      const largeTask = await createTestTask({
        priority: "P1",
        effort: "epic",
      });

      const result = await priorityCalculator.calculate(largeTask);

      expect(result.isQuickWin).toBe(false);
    });
  });

  describe("calculateForList", () => {
    it("should calculate priorities for all tasks in a list", async () => {
      // Create task list
      const taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, created_at, updated_at)
         VALUES (?, ?, datetime('now'), datetime('now'))`,
        [taskListId, `${TEST_PREFIX}List`],
      );

      // Create tasks in the list
      const task1 = await createTestTask({});
      const task2 = await createTestTask({});

      await run("UPDATE tasks SET task_list_id = ? WHERE id IN (?, ?)", [
        taskListId,
        task1,
        task2,
      ]);
      await saveDb();

      // calculateForList returns a Map<string, PriorityResult>
      const results =
        await priorityCalculator.calculateForList(taskListId);

      expect(results.size).toBe(2);
      expect([...results.values()].every((r) => r.score > 0)).toBe(true);
    });
  });

  describe("factors breakdown", () => {
    it("should provide complete factors breakdown", async () => {
      const taskId = await createTestTask({ priority: "P1", effort: "small" });

      const result = await priorityCalculator.calculate(taskId);

      expect(result.factors).toBeDefined();
      expect(result.factors.userPriority).toBeDefined();
      expect(result.factors.blockingCount).toBeDefined();
      expect(result.factors.effortScore).toBeDefined();
      expect(result.factors.quickWinBonus).toBeDefined();
      expect(result.factors.dependencyDepth).toBeDefined();
    });
  });
});
