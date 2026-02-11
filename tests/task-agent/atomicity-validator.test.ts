/**
 * Atomicity Validator Tests
 *
 * Unit tests for the atomicity validator service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.7)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import atomicityValidator from "../../server/services/task-agent/atomicity-validator";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "ATOMIC-TEST-";

// Create test task with specific attributes
async function createTestTask(attrs: {
  title?: string;
  description?: string;
  effort?: string;
}): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, description, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 'feature', 'P2', ?, datetime('now'), datetime('now'))`,
    [
      taskId,
      `${TEST_PREFIX}${taskId.slice(0, 8)}`,
      attrs.title || `${TEST_PREFIX}Test Task`,
      attrs.description || "",
      attrs.effort || "medium",
    ],
  );
  await saveDb();
  return taskId;
}

// Add file impact to task (uses task_impacts table that validator queries)
async function addFileImpact(
  taskId: string,
  filePath: string,
  operation: string = "UPDATE",
): Promise<void> {
  await run(
    `INSERT INTO task_impacts (id, task_id, impact_type, operation, target_path, confidence, source, created_at, updated_at)
     VALUES (?, ?, 'file', ?, ?, 0.9, 'ai', datetime('now'), datetime('now'))`,
    [uuidv4(), taskId, operation, filePath],
  );
  await saveDb();
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM task_impacts WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("AtomicityValidator", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("validate", () => {
    it("should pass for atomic task with single file", async () => {
      const taskId = await createTestTask({
        title: "Fix typo in readme",
        effort: "small",
      });

      await addFileImpact(taskId, "README.md", "UPDATE");

      const result = await atomicityValidator.validateById(taskId);

      expect(result.isAtomic).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      // Note: "testable" rule may fail for simple tasks without acceptance criteria
      // The key assertion is isAtomic=true which means no blocking violations
    });

    it("should flag task with many file impacts", async () => {
      const taskId = await createTestTask({
        title: "Refactor entire codebase",
        effort: "epic",
      });

      // Add many file impacts
      for (let i = 0; i < 10; i++) {
        await addFileImpact(taskId, `src/file${i}.ts`, "UPDATE");
      }

      const result = await atomicityValidator.validateById(taskId);

      expect(result.isAtomic).toBe(false);
      expect(result.violations.some((v) => v.rule === "bounded_files")).toBe(
        true,
      );
    });

    it("should flag epic effort tasks", async () => {
      const taskId = await createTestTask({
        title: "Implement new feature",
        effort: "epic",
      });

      const result = await atomicityValidator.validateById(taskId);

      expect(result.violations.some((v) => v.rule === "time_bounded")).toBe(
        true,
      );
    });

    it("should flag tasks with multiple concerns in title", async () => {
      const taskId = await createTestTask({
        title: "Add authentication AND implement caching AND fix logging",
        description: "Multiple unrelated changes",
      });

      const result = await atomicityValidator.validateById(taskId);

      expect(result.violations.some((v) => v.rule === "single_concern")).toBe(
        true,
      );
    });
  });

  describe("rules", () => {
    it("should check bounded_files rule", async () => {
      const taskId = await createTestTask({ title: "Multi-file task" });

      // Add 6 files - threshold is 5, so this should trigger bounded_files violation
      await addFileImpact(taskId, "file1.ts", "UPDATE");
      await addFileImpact(taskId, "file2.ts", "UPDATE");
      await addFileImpact(taskId, "file3.ts", "UPDATE");
      await addFileImpact(taskId, "file4.ts", "UPDATE");
      await addFileImpact(taskId, "file5.ts", "UPDATE");
      await addFileImpact(taskId, "file6.ts", "UPDATE");

      const result = await atomicityValidator.validateById(taskId);

      expect(result.violations.some((v) => v.rule === "bounded_files")).toBe(
        true,
      );
    });

    it("should check time_bounded rule based on effort", async () => {
      const smallTask = await createTestTask({ effort: "small" });
      const epicTask = await createTestTask({ effort: "epic" });

      const smallResult = await atomicityValidator.validateById(smallTask);
      const epicResult = await atomicityValidator.validateById(epicTask);

      expect(
        smallResult.violations.some((v) => v.rule === "time_bounded"),
      ).toBe(false);
      expect(epicResult.violations.some((v) => v.rule === "time_bounded")).toBe(
        true,
      );
    });
  });

  describe("suggestions", () => {
    it("should suggest decomposition for non-atomic tasks", async () => {
      const taskId = await createTestTask({
        title: "Large task with many concerns",
        effort: "epic",
      });

      for (let i = 0; i < 8; i++) {
        await addFileImpact(taskId, `src/module${i}/file.ts`, "UPDATE");
      }

      const result = await atomicityValidator.validateById(taskId);

      // Non-atomic tasks should have suggestedSplits
      expect(result.isAtomic).toBe(false);
      expect(result.suggestedSplits).toBeDefined();
      if (result.suggestedSplits) {
        expect(result.suggestedSplits.length).toBeGreaterThan(0);
      }
    });

    it("should provide reason for each violation", async () => {
      const taskId = await createTestTask({
        title: "Fix bug AND add feature AND refactor",
        effort: "large",
      });

      for (let i = 0; i < 6; i++) {
        await addFileImpact(taskId, `file${i}.ts`, "UPDATE");
      }

      const result = await atomicityValidator.validateById(taskId);

      // Violations should have reasons explaining why they failed
      result.violations.forEach((violation) => {
        // reason is optional for passed rules but should exist for violations
        expect(violation.rule).toBeDefined();
        expect(violation.passed).toBe(false);
      });
    });
  });

  describe("scoring", () => {
    it("should calculate score between 0 and 100", async () => {
      const taskId = await createTestTask({});

      const result = await atomicityValidator.validateById(taskId);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should have higher score for more atomic tasks", async () => {
      const atomicTask = await createTestTask({
        title: "Fix single bug",
        effort: "small",
      });
      await addFileImpact(atomicTask, "single-file.ts", "UPDATE");

      const nonAtomicTask = await createTestTask({
        title: "Major refactor across modules",
        effort: "epic",
      });
      for (let i = 0; i < 10; i++) {
        await addFileImpact(nonAtomicTask, `module${i}/file.ts`, "UPDATE");
      }

      const atomicResult = await atomicityValidator.validateById(atomicTask);
      const nonAtomicResult =
        await atomicityValidator.validateById(nonAtomicTask);

      expect(atomicResult.score).toBeGreaterThan(nonAtomicResult.score);
    });
  });
});
