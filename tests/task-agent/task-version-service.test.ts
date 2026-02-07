/**
 * Task Version Service Tests
 *
 * Unit tests for the task version service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.4)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { taskVersionService } from "../../server/services/task-agent/task-version-service";
import { run, saveDb, getOne } from "../../database/db";

const TEST_PREFIX = "VERSION-TEST-";

// Helper to call createVersion with simple parameters
async function createVersionHelper(
  taskId: string,
  changeReason: string,
  changedBy: string,
) {
  return taskVersionService.createVersion(taskId, {
    changeReason,
    changedBy,
  });
}

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
    `DELETE FROM task_versions WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("TaskVersionService", () => {
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

  describe("createVersion", () => {
    it("should create initial version (v1)", async () => {
      const version = await createVersionHelper(
        testTaskId,
        "Initial creation",
        "system",
      );

      expect(version).toBeDefined();
      expect(version.version).toBe(1);
      expect(version.taskId).toBe(testTaskId);
      expect(version.changeReason).toBe("Initial creation");
      expect(version.createdBy).toBe("system");
    });

    it("should increment version numbers", async () => {
      await createVersionHelper(testTaskId, "v1", "user1");
      await createVersionHelper(testTaskId, "v2", "user2");
      const v3 = await taskVersionService.createVersion(
        testTaskId,
        "v3",
        "user3",
      );

      expect(v3.version).toBe(3);
    });

    it("should capture task snapshot", async () => {
      const version = await taskVersionService.createVersion(
        testTaskId,
        "Snapshot test",
        "system",
      );

      expect(version.snapshot).toBeDefined();
      expect(version.snapshot.title).toBe(`${TEST_PREFIX}Test Task`);
      expect(version.snapshot.status).toBe("pending");
    });
  });

  describe("getVersions", () => {
    it("should return all versions for a task", async () => {
      // Create versions with actual changes to trigger versioning
      await taskVersionService.createVersion(testTaskId, { 
        title: "Title v1", 
        changeReason: "v1", 
        changedBy: "system" 
      });
      await taskVersionService.createVersion(testTaskId, { 
        title: "Title v2", 
        changeReason: "v2", 
        changedBy: "system" 
      });
      await taskVersionService.createVersion(testTaskId, { 
        title: "Title v3", 
        changeReason: "v3", 
        changedBy: "system" 
      });

      const versions = await taskVersionService.getVersions(testTaskId);

      expect(versions.length).toBeGreaterThanOrEqual(1);
      // Verify we have versions
      expect(versions[0].version).toBeGreaterThan(0);
    });
  });

  describe("getVersion", () => {
    it("should return a specific version", async () => {
      await createVersionHelper(testTaskId, "v1", "system");
      await createVersionHelper(testTaskId, "v2", "system");

      const v1 = await taskVersionService.getVersion(testTaskId, 1);
      const v2 = await taskVersionService.getVersion(testTaskId, 2);

      expect(v1?.version).toBe(1);
      expect(v2?.version).toBe(2);
    });

    it("should return null for non-existent version", async () => {
      const version = await taskVersionService.getVersion(testTaskId, 999);
      expect(version).toBeNull();
    });
  });

  describe("createCheckpoint", () => {
    it("should create a named checkpoint", async () => {
      // Create initial version
      await createVersionHelper(testTaskId, "Initial", "system");

      const checkpoint = await taskVersionService.createCheckpoint(
        {
          taskId: testTaskId,
          name: "Before Refactor",
          reason: "Saving state before major changes",
        },
        "developer",
      );

      expect(checkpoint.isCheckpoint).toBe(true);
      expect(checkpoint.checkpointName).toBe("Before Refactor");
    });
  });

  describe("getCheckpoints", () => {
    it("should return only checkpoint versions", async () => {
      await createVersionHelper(testTaskId, "v1", "system");
      await taskVersionService.createCheckpoint(
        { taskId: testTaskId, name: "CP1" },
        "user",
      );
      await createVersionHelper(testTaskId, "v3", "system");
      await taskVersionService.createCheckpoint(
        { taskId: testTaskId, name: "CP2" },
        "user",
      );

      const checkpoints = await taskVersionService.getCheckpoints(testTaskId);

      expect(checkpoints.length).toBe(2);
      expect(checkpoints.every((cp) => cp.isCheckpoint)).toBe(true);
    });
  });

  describe("diff", () => {
    it("should calculate diff between versions", async () => {
      await createVersionHelper(testTaskId, "v1", "system");

      // Update task
      await run("UPDATE tasks SET title = ?, priority = ? WHERE id = ?", [
        `${TEST_PREFIX}Updated Title`,
        "P1",
        testTaskId,
      ]);
      await saveDb();

      await createVersionHelper(testTaskId, "v2", "system");

      const diff = await taskVersionService.diff(testTaskId, 1, 2);

      expect(diff.changes).toBeDefined();
      expect(diff.changes.title).toBeDefined();
      expect(diff.changes.priority).toBeDefined();
    });
  });

  describe("restore", () => {
    it("should restore task to a previous version", async () => {
      await createVersionHelper(testTaskId, "v1", "system");

      // Update task
      await run("UPDATE tasks SET title = ? WHERE id = ?", [
        `${TEST_PREFIX}Changed Title`,
        testTaskId,
      ]);
      await saveDb();

      await createVersionHelper(testTaskId, "v2", "system");

      // Restore to v1
      await taskVersionService.restore(
        { taskId: testTaskId, targetVersion: 1 },
        "user",
      );

      // Check task was restored
      const task = await getOne<{ title: string }>(
        "SELECT title FROM tasks WHERE id = ?",
        [testTaskId],
      );
      expect(task?.title).toBe(`${TEST_PREFIX}Test Task`);

      // Check new version was created
      const versions = await taskVersionService.getVersions(testTaskId);
      expect(versions.length).toBe(3);
      expect(versions[versions.length - 1].changeReason).toContain("Restored");
    });
  });

  describe("previewRestore", () => {
    it("should show what would change on restore", async () => {
      await createVersionHelper(testTaskId, "v1", "system");

      await run("UPDATE tasks SET title = ?, status = ? WHERE id = ?", [
        `${TEST_PREFIX}Modified`,
        "in_progress",
        testTaskId,
      ]);
      await saveDb();

      await createVersionHelper(testTaskId, "v2", "system");

      const preview = await taskVersionService.previewRestore(testTaskId, 1);

      expect(preview.changes).toBeDefined();
      expect(Object.keys(preview.changes).length).toBeGreaterThan(0);
    });
  });
});
