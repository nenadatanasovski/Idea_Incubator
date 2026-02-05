/**
 * Task Test Service Tests
 *
 * Unit tests for the task test service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.6)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { taskTestService } from "../../server/services/task-agent/task-test-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "TEST-SVC-";

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
  // Note: test configs are stored in-memory, not in DB
  await run(
    `DELETE FROM task_test_results WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("TaskTestService", () => {
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

  describe("setTestConfig", () => {
    it("should set test configuration for a task", async () => {
      const configs = [
        {
          level: "syntax" as const,
          command: "npx tsc --noEmit",
          timeout: 30000,
          requiredForPass: true,
        },
        {
          level: "unit" as const,
          command: "npm test",
          timeout: 60000,
          requiredForPass: true,
        },
        {
          level: "e2e" as const,
          command: "npm run e2e",
          timeout: 120000,
          requiredForPass: false,
        },
      ];

      await taskTestService.setTestConfig(testTaskId, configs);

      const retrievedConfig = await taskTestService.getTestConfig(testTaskId);

      expect(retrievedConfig.length).toBe(3);
      expect(retrievedConfig.find((c) => c.level === "syntax")?.command).toBe(
        "npx tsc --noEmit",
      );
    });
  });

  describe("getTestConfig", () => {
    it("should return default configs for task without custom config", async () => {
      // Create a fresh task with no custom config
      const freshTaskId = uuidv4();
      await run(
        `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
        [freshTaskId, `${TEST_PREFIX}fresh-${freshTaskId.slice(0, 8)}`, `${TEST_PREFIX}Fresh Task`],
      );
      await saveDb();

      const config = await taskTestService.getTestConfig(freshTaskId);
      // Returns default configs for levels 1, 2, 3 when no custom config is set
      expect(config.length).toBe(3);
      expect(config.map(c => c.level)).toEqual([1, 2, 3]);
    });
  });

  describe.skip("recordResult", () => {
    it("should record test result", async () => {
      const result = await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: true,
        totalDuration: 5000,
        levels: [
          { level: "syntax", passed: true, duration: 2000 },
          { level: "unit", passed: true, duration: 3000 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.overallPassed).toBe(true);
    });

    it("should record failed test result", async () => {
      const result = await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: false,
        totalDuration: 1000,
        levels: [
          {
            level: "syntax",
            passed: false,
            duration: 1000,
            errorMessage: "Type error in line 42",
          },
        ],
      });

      expect(result.overallPassed).toBe(false);
      expect(result.levels[0].errorMessage).toContain("Type error");
    });
  });

  describe.skip("getResults", () => {
    it("should return all results for a task", async () => {
      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: false,
        totalDuration: 1000,
        levels: [{ level: "syntax", passed: false, duration: 1000 }],
      });

      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: true,
        totalDuration: 2000,
        levels: [{ level: "syntax", passed: true, duration: 2000 }],
      });

      const results = await taskTestService.getResults(testTaskId);

      expect(results.length).toBe(2);
    });
  });

  describe.skip("getLatestResults", () => {
    it("should return the most recent result", async () => {
      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: false,
        totalDuration: 1000,
        levels: [{ level: "syntax", passed: false, duration: 1000 }],
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: true,
        totalDuration: 2000,
        levels: [{ level: "syntax", passed: true, duration: 2000 }],
      });

      const latest = await taskTestService.getLatestResults(testTaskId);

      expect(latest?.overallPassed).toBe(true);
      expect(latest?.totalDuration).toBe(2000);
    });

    it("should return null for task without results", async () => {
      const latest = await taskTestService.getLatestResults(testTaskId);
      expect(latest).toBeNull();
    });
  });

  describe.skip("checkAcceptanceCriteria", () => {
    it("should check if acceptance criteria are met", async () => {
      // Set test config
      await taskTestService.setTestConfig(testTaskId, [
        {
          level: "syntax",
          command: "tsc",
          timeout: 30000,
          requiredForPass: true,
        },
        {
          level: "unit",
          command: "jest",
          timeout: 60000,
          requiredForPass: true,
        },
      ]);

      // Record passing result
      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: true,
        totalDuration: 5000,
        levels: [
          { level: "syntax", passed: true, duration: 2000 },
          { level: "unit", passed: true, duration: 3000 },
        ],
      });

      const check = await taskTestService.checkAcceptanceCriteria(testTaskId);

      expect(check.allPassing).toBe(true);
      expect(check.missingLevels).toEqual([]);
    });

    it("should report missing required levels", async () => {
      // Set test config requiring all 3 levels
      await taskTestService.setTestConfig(testTaskId, [
        {
          level: "syntax",
          command: "tsc",
          timeout: 30000,
          requiredForPass: true,
        },
        {
          level: "unit",
          command: "jest",
          timeout: 60000,
          requiredForPass: true,
        },
        {
          level: "e2e",
          command: "cypress",
          timeout: 120000,
          requiredForPass: true,
        },
      ]);

      // Record result missing e2e
      await taskTestService.recordResult({
        taskId: testTaskId,
        overallPassed: false,
        totalDuration: 5000,
        levels: [
          { level: "syntax", passed: true, duration: 2000 },
          { level: "unit", passed: true, duration: 3000 },
          // e2e missing
        ],
      });

      const check = await taskTestService.checkAcceptanceCriteria(testTaskId);

      expect(check.allPassing).toBe(false);
      expect(check.missingLevels).toContain("e2e");
    });
  });
});
