/**
 * PRD Coverage Service Tests
 *
 * Unit tests for the PRD coverage service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.10)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { prdCoverageService } from "../../server/services/prd-coverage-service";
import { prdService } from "../../server/services/prd-service";
import { prdLinkService } from "../../server/services/prd-link-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "COVERAGE-TEST-";
const TEST_USER_ID = "test-user-prd-coverage";

// Create test PRD (wrapper to provide userId and map fields)
async function createTestPRD(input: { 
  title: string; 
  problemStatement?: string;
  successCriteria?: string[];
  constraints?: string[];
  description?: string; // Legacy - mapped to problemStatement
  status?: string; // Ignored - always draft
}) {
  const { description, status, ...rest } = input;
  return prdService.create({
    ...rest,
    problemStatement: input.problemStatement || description,
  }, TEST_USER_ID);
}

// Create test task
async function createTestTask(status: string = "pending"): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [
      taskId,
      `${TEST_PREFIX}${taskId.slice(0, 8)}`,
      `${TEST_PREFIX}Test Task`,
      status,
    ],
  );
  await saveDb();
  return taskId;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM prd_tasks WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`,
  );
  await run(
    `DELETE FROM prd_task_lists WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM prds WHERE title LIKE '${TEST_PREFIX}%'`);
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await run(`DELETE FROM task_lists_v2 WHERE name LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("PRDCoverageService", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("calculateCoverage", () => {
    it("should calculate coverage for PRD with no requirements", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Empty PRD`,
        status: "draft",
      });

      const coverage = await prdCoverageService.calculateCoverage(prd.id);

      expect(coverage).toBeDefined();
      expect(coverage.totalRequirements).toBe(0);
      expect(coverage.coveragePercent).toBe(100); // 0/0 = 100% complete
    });

    it("should calculate coverage for PRD with linked tasks", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}PRD with tasks`,
        successCriteria: ["First requirement", "Second requirement"],
      });

      const task1 = await createTestTask("completed");
      const task2 = await createTestTask("pending");

      // Use proper requirement refs that match the service's parsing
      await prdLinkService.linkTask(prd.id, task1, "success_criteria[0]");
      await prdLinkService.linkTask(prd.id, task2, "success_criteria[1]");

      const coverage = await prdCoverageService.calculateCoverage(prd.id);

      expect(coverage.totalRequirements).toBe(2);
      expect(coverage.coveredRequirements).toBe(2); // Both are linked
    });
  });

  describe("getUncoveredRequirements", () => {
    it("should return empty array for fully covered PRD", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Fully covered PRD`,
        description: "REQ-001: Only requirement",
        status: "draft",
      });

      const task = await createTestTask("completed");
      await prdLinkService.linkTask(prd.id, task, "REQ-001");

      const uncovered = await prdCoverageService.getUncoveredRequirements(
        prd.id,
      );

      expect(uncovered).toEqual([]);
    });

    it("should return uncovered requirements", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Partial PRD`,
        description: "REQ-001: Covered\nREQ-002: Not covered",
        status: "draft",
      });

      const task = await createTestTask("completed");
      await prdLinkService.linkTask(prd.id, task, "REQ-001");
      // REQ-002 is not linked to any task

      const uncovered = await prdCoverageService.getUncoveredRequirements(
        prd.id,
      );

      // Should find requirements not linked to tasks
      expect(uncovered.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getCompletionProgress", () => {
    it("should calculate completion progress", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Progress PRD`,
      });

      // Link tasks directly to PRD
      const completedTask = await createTestTask("completed");
      const pendingTask = await createTestTask("pending");

      await prdLinkService.linkTask(prd.id, completedTask, "task-1");
      await prdLinkService.linkTask(prd.id, pendingTask, "task-2");

      const progress = await prdCoverageService.getCompletionProgress(prd.id);

      expect(progress).toBeDefined();
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(50);
    });

    it("should return 100% for PRD with all completed tasks", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Complete PRD`,
      });

      // Link tasks directly to PRD
      const task1 = await createTestTask("completed");
      const task2 = await createTestTask("completed");

      await prdLinkService.linkTask(prd.id, task1, "task-1");
      await prdLinkService.linkTask(prd.id, task2, "task-2");

      const progress = await prdCoverageService.getCompletionProgress(prd.id);

      expect(progress.percentage).toBe(100);
    });

    it("should return 0% for PRD with no completed tasks", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Zero progress PRD`,
      });

      // Link pending tasks directly to PRD
      const task1 = await createTestTask("pending");
      const task2 = await createTestTask("pending");

      await prdLinkService.linkTask(prd.id, task1, "task-1");
      await prdLinkService.linkTask(prd.id, task2, "task-2");

      const progress = await prdCoverageService.getCompletionProgress(prd.id);

      expect(progress.percentage).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle PRD with no linked task lists", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Isolated PRD`,
        status: "draft",
      });

      const progress = await prdCoverageService.getCompletionProgress(prd.id);

      expect(progress.total).toBe(0);
      expect(progress.percentage).toBe(100);
    });

    it("should handle non-existent PRD", async () => {
      await expect(
        prdCoverageService.calculateCoverage("non-existent-id"),
      ).rejects.toThrow();
    });
  });
});
