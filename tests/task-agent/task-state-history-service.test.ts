/**
 * Task State History Service Tests
 *
 * Unit tests for the task state history service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.11)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { taskStateHistoryService } from "../../server/services/task-agent/task-state-history-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "HISTORY-TEST-";

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
    `DELETE FROM task_state_history WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("TaskStateHistoryService", () => {
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

  describe("recordTransition", () => {
    it("should record a state transition", async () => {
      const entry = await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        reason: "Starting work",
        triggeredBy: "user",
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.taskId).toBe(testTaskId);
      expect(entry.fromStatus).toBe("pending");
      expect(entry.toStatus).toBe("in_progress");
      expect(entry.reason).toBe("Starting work");
    });

    it("should record transition with agent ID", async () => {
      const agentId = uuidv4();
      const entry = await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "system",
        agentId,
      });

      expect(entry.agentId).toBe(agentId);
    });

    it("should record transition with metadata", async () => {
      const entry = await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "in_progress",
        toStatus: "failed",
        reason: "Build failed",
        triggeredBy: "system",
        metadata: { errorCode: "BUILD_FAIL", attempts: 3 },
      });

      expect(entry.metadata).toBeDefined();
      expect(entry.metadata?.errorCode).toBe("BUILD_FAIL");
    });
  });

  describe("getHistory", () => {
    it("should return all history for a task", async () => {
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "in_progress",
        toStatus: "completed",
        triggeredBy: "agent",
      });

      const history = await taskStateHistoryService.getHistory(testTaskId);

      expect(history.length).toBe(3);
      // Should be in reverse chronological order
      expect(history[0].toStatus).toBe("completed");
      expect(history[2].toStatus).toBe("pending");
    });
  });

  describe("getHistoryInRange", () => {
    it("should return history within date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      const history = await taskStateHistoryService.getHistoryInRange(
        testTaskId,
        yesterday,
        tomorrow,
      );

      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("getTransitionCount", () => {
    it("should count transitions for a task", async () => {
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      const count =
        await taskStateHistoryService.getTransitionCount(testTaskId);

      expect(count).toBe(2);
    });
  });

  describe("getLastTransition", () => {
    it("should return the most recent transition", async () => {
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      const last = await taskStateHistoryService.getLastTransition(testTaskId);

      expect(last?.toStatus).toBe("in_progress");
    });

    it("should return null for task with no history", async () => {
      const newTaskId = await createTestTask();
      const last = await taskStateHistoryService.getLastTransition(newTaskId);

      expect(last).toBeNull();
    });
  });

  describe("getTimeInStatus", () => {
    it("should calculate time spent in a status", async () => {
      // Record entering pending
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Record leaving pending
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      const timeInPending = await taskStateHistoryService.getTimeInStatus(
        testTaskId,
        "pending",
      );

      expect(timeInPending).toBeGreaterThan(0);
      expect(timeInPending).toBeLessThan(10000); // Less than 10 seconds
    });
  });

  describe("getRecentTransitions", () => {
    it("should return recent transitions across all tasks", async () => {
      const task2 = await createTestTask();

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      await taskStateHistoryService.recordTransition({
        taskId: task2,
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      const recent = await taskStateHistoryService.getRecentTransitions(10);

      expect(recent.length).toBeGreaterThanOrEqual(2);
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await taskStateHistoryService.recordTransition({
          taskId: testTaskId,
          toStatus: "pending",
          triggeredBy: "system",
        });
      }

      const recent = await taskStateHistoryService.getRecentTransitions(3);

      expect(recent.length).toBe(3);
    });
  });

  describe("hasBeenInStatus", () => {
    it("should return true if task has been in status", async () => {
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        triggeredBy: "user",
      });

      const hasBeen = await taskStateHistoryService.hasBeenInStatus(
        testTaskId,
        "pending",
      );

      expect(hasBeen).toBe(true);
    });

    it("should return false if task has never been in status", async () => {
      await taskStateHistoryService.recordTransition({
        taskId: testTaskId,
        toStatus: "pending",
        triggeredBy: "system",
      });

      const hasBeen = await taskStateHistoryService.hasBeenInStatus(
        testTaskId,
        "failed",
      );

      expect(hasBeen).toBe(false);
    });
  });
});
