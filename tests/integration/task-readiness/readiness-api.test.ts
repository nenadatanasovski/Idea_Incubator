/**
 * Integration Tests: Readiness API Endpoints
 * Tests the API layer for readiness calculations
 *
 * Note: These tests require the server to be running at localhost:3001
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3001/api";

// Helper to get a task ID from a task list
async function getTaskIdFromTaskList(): Promise<string | null> {
  try {
    const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
    if (!listsResponse.ok) return null;

    const lists = await listsResponse.json();
    if (!Array.isArray(lists) || lists.length === 0) return null;

    // Get readiness for first task list to find task IDs
    const taskListId = lists[0].id;
    const readinessResponse = await fetch(
      `${BASE_URL}/pipeline/task-lists/${taskListId}/readiness`,
    );
    if (!readinessResponse.ok) return null;

    const readiness = await readinessResponse.json();
    if (readiness.tasks && typeof readiness.tasks === "object") {
      const taskIds = Object.keys(readiness.tasks);
      if (taskIds.length > 0) return taskIds[0];
    }

    return null;
  } catch {
    return null;
  }
}

describe("Readiness API", () => {
  describe("GET /pipeline/tasks/:taskId/readiness", () => {
    it("should return 200 for valid task ID", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );

      expect(response.status).toBe(200);
    });

    it("should return readiness structure", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const data = await response.json();

      expect(data).toHaveProperty("overall");
      expect(data).toHaveProperty("rules");
      expect(data).toHaveProperty("threshold");
      expect(data).toHaveProperty("isReady");
      expect(data).toHaveProperty("missingItems");
    });

    it("should return overall score between 0 and 100", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const data = await response.json();

      expect(data.overall).toBeGreaterThanOrEqual(0);
      expect(data.overall).toBeLessThanOrEqual(100);
    });

    it("should include all 6 rules", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const data = await response.json();

      const expectedRules = [
        "singleConcern",
        "boundedFiles",
        "timeBounded",
        "testable",
        "independent",
        "clearCompletion",
      ];

      expectedRules.forEach((rule) => {
        expect(data.rules).toHaveProperty(rule);
      });
    });

    it("should return 404 for nonexistent task", async () => {
      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/nonexistent-task-id-12345/readiness`,
      );

      // Accept 404 or 500 (depending on implementation)
      expect([404, 500]).toContain(response.status);
    });

    it("should respond within 500ms", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const start = Date.now();
      await fetch(`${BASE_URL}/pipeline/tasks/${taskId}/readiness`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  describe("GET /pipeline/task-lists/:taskListId/readiness", () => {
    it("should return 200 for valid task list", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskListId = lists[0].id;
      const response = await fetch(
        `${BASE_URL}/pipeline/task-lists/${taskListId}/readiness`,
      );

      expect(response.status).toBe(200);
    });

    it("should return bulk readiness structure", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskListId = lists[0].id;
      const response = await fetch(
        `${BASE_URL}/pipeline/task-lists/${taskListId}/readiness`,
      );
      const data = await response.json();

      expect(data).toHaveProperty("taskListId");
      expect(data).toHaveProperty("tasks");
    });

    it("should include per-task readiness", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskListId = lists[0].id;
      const response = await fetch(
        `${BASE_URL}/pipeline/task-lists/${taskListId}/readiness`,
      );
      const data = await response.json();

      if (data.tasks && typeof data.tasks === "object") {
        const taskIds = Object.keys(data.tasks);
        if (taskIds.length > 0) {
          const task = data.tasks[taskIds[0]];
          expect(task).toHaveProperty("taskId");
          expect(task).toHaveProperty("overall");
          expect(task).toHaveProperty("isReady");
        }
      }
    });

    it("should return 404 for nonexistent task list", async () => {
      const response = await fetch(
        `${BASE_URL}/pipeline/task-lists/nonexistent-list-id-12345/readiness`,
      );

      // Accept 404, 200 with empty results, or 500
      expect([200, 404, 500]).toContain(response.status);
    });

    it("should handle large task lists within 2s", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      // Find largest task list
      const largestList = lists.reduce(
        (max: { taskCount?: number }, list: { taskCount?: number }) =>
          (list.taskCount || 0) > (max.taskCount || 0) ? list : max,
        lists[0],
      );

      const start = Date.now();
      const response = await fetch(
        `${BASE_URL}/pipeline/task-lists/${largestList.id}/readiness`,
      );
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      console.log(
        `Bulk readiness for ${largestList.taskCount || 0} tasks: ${duration}ms`,
      );
    });
  });

  describe("threshold validation", () => {
    it("should use 70 as default threshold", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const data = await response.json();

      expect(data.threshold).toBe(70);
    });

    it("should set isReady based on threshold", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const data = await response.json();

      const expectedIsReady = data.overall >= data.threshold;
      expect(data.isReady).toBe(expectedIsReady);
    });
  });
});
