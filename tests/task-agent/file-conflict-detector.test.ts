/**
 * File Conflict Detector Tests
 *
 * Unit tests for the file conflict detector service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.1)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import fileConflictDetector from "../../server/services/task-agent/file-conflict-detector";
import { taskImpactService } from "../../server/services/task-agent/task-impact-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "CONFLICT-TEST-";

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

describe("FileConflictDetector", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("detectConflicts", () => {
    it("should detect write-write conflict on same file", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Both tasks UPDATE same file
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/routes/api.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/routes/api.ts",
      });

      const conflicts = await fileConflictDetector.detectConflicts(
        taskA,
        taskB,
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe("write-write");
    });

    it("should detect write-delete conflict", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Task A updates, Task B deletes same file
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/services/old.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "DELETE",
        targetPath: "server/services/old.ts",
      });

      const conflicts = await fileConflictDetector.detectConflicts(
        taskA,
        taskB,
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe("write-delete");
    });

    it("should not detect conflict for read-read operations", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Both tasks READ same file
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "READ",
        targetPath: "server/config.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "READ",
        targetPath: "server/config.ts",
      });

      const conflicts = await fileConflictDetector.detectConflicts(
        taskA,
        taskB,
      );

      expect(conflicts.length).toBe(0);
    });

    it("should not detect conflict for different files", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Tasks modify different files
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/routes/a.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "server/routes/b.ts",
      });

      const conflicts = await fileConflictDetector.detectConflicts(
        taskA,
        taskB,
      );

      expect(conflicts.length).toBe(0);
    });
  });

  describe("canRunParallel", () => {
    it("should return true for non-conflicting tasks", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Different files
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "CREATE",
        targetPath: "server/services/serviceA.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "CREATE",
        targetPath: "server/services/serviceB.ts",
      });

      const canParallel = await fileConflictDetector.canRunParallel(
        taskA,
        taskB,
      );

      expect(canParallel).toBe(true);
    });

    it("should return false for conflicting tasks", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();

      // Same file CREATE conflict
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "CREATE",
        targetPath: "server/services/shared.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "CREATE",
        targetPath: "server/services/shared.ts",
      });

      const canParallel = await fileConflictDetector.canRunParallel(
        taskA,
        taskB,
      );

      expect(canParallel).toBe(false);
    });
  });

  describe("getConflictType", () => {
    it("should return blocking for write-write", () => {
      const result = fileConflictDetector.getConflictType("UPDATE", "UPDATE");
      expect(result).toBe("blocking");
    });

    it("should return blocking for create-create", () => {
      const result = fileConflictDetector.getConflictType("CREATE", "CREATE");
      expect(result).toBe("blocking");
    });

    it("should return blocking for delete-delete", () => {
      const result = fileConflictDetector.getConflictType("DELETE", "DELETE");
      expect(result).toBe("blocking");
    });

    it("should return null for read-read", () => {
      const result = fileConflictDetector.getConflictType("READ", "READ");
      expect(result).toBeNull();
    });

    it("should return warning for read-update", () => {
      const result = fileConflictDetector.getConflictType("READ", "UPDATE");
      expect(result).toBe("warning");
    });
  });

  describe("getConflictingTasks", () => {
    it("should return all tasks with conflicts", async () => {
      const taskA = await createTestTask();
      const taskB = await createTestTask();
      const taskC = await createTestTask();

      // A and B conflict
      await taskImpactService.create({
        taskId: taskA,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "shared.ts",
      });
      await taskImpactService.create({
        taskId: taskB,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "shared.ts",
      });

      // C has no conflict
      await taskImpactService.create({
        taskId: taskC,
        impactType: "file",
        operation: "UPDATE",
        targetPath: "different.ts",
      });

      const conflicting = await fileConflictDetector.getConflictingTasks(taskA);

      expect(conflicting.length).toBe(1);
      expect(conflicting[0].id).toBe(taskB);
    });
  });
});
