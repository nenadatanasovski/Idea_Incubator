/**
 * Task Impact Service Tests
 *
 * Unit tests for the task impact service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.1)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { taskImpactService } from "../../server/services/task-agent/task-impact-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "IMPACT-TEST-";

// Create test task
async function createTestTask(): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [taskId, `${TEST_PREFIX}${taskId.slice(0, 8)}`, `${TEST_PREFIX}Test Task`],
  );
  await saveDb();
  return taskId;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM task_impacts WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("TaskImpactService", () => {
  let testTaskId: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
    testTaskId = await createTestTask();
  });

  describe("addImpact", () => {
    it("should add a file impact", async () => {
      const impact = await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "server/routes/api.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      expect(impact).toBeDefined();
      expect(impact.id).toBeDefined();
      expect(impact.taskId).toBe(testTaskId);
      expect(impact.impactType).toBe("file");
      expect(impact.operation).toBe("UPDATE");
      expect(impact.target).toBe("server/routes/api.ts");
    });

    it("should add impacts of different types", async () => {
      const fileImpact = await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "CREATE",
        target: "server/routes/new.ts",
        confidence: 1.0,
        source: "user_declared",
      });

      const apiImpact = await taskImpactService.addImpact(testTaskId, {
        impactType: "api",
        operation: "CREATE",
        target: "GET /api/new",
        confidence: 0.8,
        source: "ai_estimated",
      });

      const dbImpact = await taskImpactService.addImpact(testTaskId, {
        impactType: "database",
        operation: "UPDATE",
        target: "users table",
        confidence: 0.7,
        source: "ai_estimated",
      });

      expect(fileImpact.impactType).toBe("file");
      expect(apiImpact.impactType).toBe("api");
      expect(dbImpact.impactType).toBe("database");
    });
  });

  describe("getImpacts", () => {
    it("should return all impacts for a task", async () => {
      await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "file1.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "CREATE",
        target: "file2.ts",
        confidence: 0.8,
        source: "ai_estimated",
      });

      const impacts = await taskImpactService.getImpacts(testTaskId);

      expect(impacts.length).toBe(2);
    });

    it("should filter impacts by type", async () => {
      await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "file.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      await taskImpactService.addImpact(testTaskId, {
        impactType: "api",
        operation: "CREATE",
        target: "GET /api/test",
        confidence: 0.8,
        source: "ai_estimated",
      });

      const fileImpacts = await taskImpactService.getImpactsByType(
        testTaskId,
        "file",
      );
      const apiImpacts = await taskImpactService.getImpactsByType(
        testTaskId,
        "api",
      );

      expect(fileImpacts.length).toBe(1);
      expect(apiImpacts.length).toBe(1);
    });
  });

  describe("removeImpact", () => {
    it("should remove an impact", async () => {
      const impact = await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "file.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      await taskImpactService.removeImpact(impact.id);

      const impacts = await taskImpactService.getImpacts(testTaskId);
      expect(impacts.length).toBe(0);
    });
  });

  describe("detectConflicts", () => {
    it("should detect conflicts between tasks with overlapping file impacts", async () => {
      // Create second task
      const taskId2 = await createTestTask();

      // Add overlapping impacts
      await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "shared-file.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      await taskImpactService.addImpact(taskId2, {
        impactType: "file",
        operation: "UPDATE",
        target: "shared-file.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      const conflicts = await taskImpactService.detectConflicts(testTaskId);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].target).toBe("shared-file.ts");
    });

    it("should not detect conflicts for non-overlapping impacts", async () => {
      // Create second task
      const taskId2 = await createTestTask();

      await taskImpactService.addImpact(testTaskId, {
        impactType: "file",
        operation: "UPDATE",
        target: "file1.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      await taskImpactService.addImpact(taskId2, {
        impactType: "file",
        operation: "UPDATE",
        target: "file2.ts",
        confidence: 0.9,
        source: "ai_estimated",
      });

      const conflicts = await taskImpactService.detectConflicts(testTaskId);

      expect(conflicts.length).toBe(0);
    });
  });
});
