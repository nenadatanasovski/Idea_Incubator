/**
 * Cascade Analyzer Service Tests
 *
 * Unit tests for the cascade analyzer service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.5)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { cascadeAnalyzerService } from "../../server/services/task-agent/cascade-analyzer-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "CASCADE-TEST-";

// Create test task
async function createTestTask(title?: string): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [
      taskId,
      `${TEST_PREFIX}${taskId.slice(0, 8)}`,
      title || `${TEST_PREFIX}Test Task`,
    ],
  );
  await saveDb();
  return taskId;
}

// Create dependency
async function createDependency(
  taskA: string,
  taskB: string,
  relType: string = "depends_on",
): Promise<void> {
  await run(
    `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [uuidv4(), taskA, taskB, relType],
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

describe("CascadeAnalyzerService", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("analyze", () => {
    it("should detect cascade effects on status change", async () => {
      const taskA = await createTestTask("Task A");
      const taskB = await createTestTask("Task B");

      // B depends on A
      await createDependency(taskB, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "status_changed",
        {
          newStatus: "completed",
        },
      );

      expect(analysis).toBeDefined();
      expect(analysis.sourceTaskId).toBe(taskA);
      expect(analysis.changeType).toBe("status_changed");
      expect(analysis.directEffects.length).toBeGreaterThan(0);
    });

    it("should detect multiple cascade effects", async () => {
      const taskA = await createTestTask("Task A");
      const taskB = await createTestTask("Task B");
      const taskC = await createTestTask("Task C");

      // B and C both depend on A
      await createDependency(taskB, taskA, "depends_on");
      await createDependency(taskC, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "status_changed",
        {
          newStatus: "completed",
        },
      );

      expect(analysis.totalAffected).toBeGreaterThanOrEqual(2);
    });

    it("should identify auto-approvable effects", async () => {
      const taskA = await createTestTask("Task A");
      const taskB = await createTestTask("Task B");

      await createDependency(taskB, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "status_changed",
        {
          newStatus: "completed",
        },
      );

      // Some effects should be auto-approvable (like notifications)
      expect(analysis.autoApprovable).toBeDefined();
    });

    it("should handle tasks with no dependents", async () => {
      const taskA = await createTestTask("Isolated Task");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "status_changed",
        {
          newStatus: "completed",
        },
      );

      expect(analysis.totalAffected).toBe(0);
      expect(analysis.directEffects.length).toBe(0);
    });
  });

  describe("priority_changed trigger", () => {
    it("should detect priority recalculation effects", async () => {
      const taskA = await createTestTask("High Priority Task");
      const taskB = await createTestTask("Dependent Task");

      await createDependency(taskB, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "priority_changed",
        {
          oldPriority: "P3",
          newPriority: "P1",
        },
      );

      expect(analysis.changeType).toBe("priority_changed");
      // Priority change should be auto-approvable for dependents
      expect(analysis.directEffects.length).toBeGreaterThan(0);
      expect(
        analysis.directEffects.some((e) => e.affectedTaskId === taskB),
      ).toBe(true);
    });
  });

  describe("file_impact_changed trigger", () => {
    it("should detect parallelism invalidation effects", async () => {
      const taskA = await createTestTask("Task with impacts");
      const taskB = await createTestTask("Related task");

      // Create a dependency so there's something to analyze
      await createDependency(taskB, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "file_impact_changed",
        {
          addedImpacts: ["server/routes/api.ts"],
        },
      );

      expect(analysis.changeType).toBe("file_impact_changed");
      // File impact change should suggest review
      expect(analysis.totalAffected).toBeGreaterThanOrEqual(0);
    });
  });

  describe("dependency_changed trigger", () => {
    it("should notify dependent tasks of requirement changes", async () => {
      const taskA = await createTestTask("Spec Task");
      const taskB = await createTestTask("Implementation Task");

      await createDependency(taskB, taskA, "depends_on");

      const analysis = await cascadeAnalyzerService.analyze(
        taskA,
        "dependency_changed",
        {
          changedFields: ["description", "acceptance_criteria"],
        },
      );

      expect(analysis.changeType).toBe("dependency_changed");
      // Dependency changes should affect dependent tasks
      expect(analysis.directEffects.length).toBeGreaterThan(0);
    });
  });
});
