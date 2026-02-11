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
      const impact = await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/routes/api.ts",
        confidence: 0.9,
        source: "ai",
      });

      expect(impact).toBeDefined();
      expect(impact.id).toBeDefined();
      expect(impact.taskId).toBe(testTaskId);
      expect(impact.impactType).toBe("file");
      expect(impact.operation).toBe("UPDATE");
      expect(impact.targetPath).toBe("server/routes/api.ts");
    });

    it("should add impacts of different types", async () => {
      const fileImpact = await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "CREATE",
        targetPath: "server/routes/new.ts",
        confidence: 1.0,
        source: "user",
      });

      const apiImpact = await taskImpactService.create({
        taskId: testTaskId,
        impactType: "api",
        operation: "CREATE",
        targetPath: "GET /api/new",
        confidence: 0.8,
        source: "ai",
      });

      const dbImpact = await taskImpactService.create({
        taskId: testTaskId,
        impactType: "database",
        operation: "UPDATE",
        targetPath: "users table",
        confidence: 0.7,
        source: "ai",
      });

      expect(fileImpact.impactType).toBe("file");
      expect(apiImpact.impactType).toBe("api");
      expect(dbImpact.impactType).toBe("database");
    });
  });

  describe("getImpacts", () => {
    it("should return all impacts for a task", async () => {
      await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "file1.ts",
        confidence: 0.9,
        source: "ai",
      });

      await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "CREATE",
        targetPath: "file2.ts",
        confidence: 0.8,
        source: "ai",
      });

      const impacts = await taskImpactService.getByTaskId(testTaskId);

      expect(impacts.length).toBe(2);
    });

    it("should filter impacts by type", async () => {
      await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "file.ts",
        confidence: 0.9,
        source: "ai",
      });

      await taskImpactService.create({
        taskId: testTaskId,
        impactType: "api",
        operation: "CREATE",
        targetPath: "GET /api/test",
        confidence: 0.8,
        source: "ai",
      });

      // Get all impacts and filter manually (no getByTaskIdByType method)
      const allImpacts = await taskImpactService.getByTaskId(testTaskId);
      const fileImpacts = allImpacts.filter((i) => i.impactType === "file");
      const apiImpacts = allImpacts.filter((i) => i.impactType === "api");

      expect(fileImpacts.length).toBe(1);
      expect(apiImpacts.length).toBe(1);
    });
  });

  describe("removeImpact", () => {
    it("should remove an impact", async () => {
      const impact = await taskImpactService.create({
        taskId: testTaskId,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "file.ts",
        confidence: 0.9,
        source: "ai",
      });

      await taskImpactService.delete(impact.id);

      const impacts = await taskImpactService.getByTaskId(testTaskId);
      expect(impacts.length).toBe(0);
    });
  });

  // NOTE: detectConflicts functionality is in file-conflict-detector service, not task-impact-service
  describe.skip("detectConflicts", () => {
    it("should detect conflicts between tasks with overlapping file impacts", async () => {
      // This functionality exists in file-conflict-detector.ts
    });

    it("should not detect conflicts for non-overlapping impacts", async () => {
      // This functionality exists in file-conflict-detector.ts
    });
  });
});
