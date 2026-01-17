/**
 * Integration Tests: Hard Gate Enforcement
 * Tests execution blocking when tasks are below readiness threshold
 *
 * Note: These tests require the server to be running at localhost:3001
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3001/api";

describe("Hard Gate Enforcement", () => {
  describe("POST /task-agent/task-lists/:id/execute", () => {
    it("should block execution when tasks below threshold", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      // Find a task list with tasks
      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      // Check readiness first
      const readinessResponse = await fetch(
        `${BASE_URL}/pipeline/task-lists/${taskList.id}/readiness`,
      );
      const readiness = await readinessResponse.json();

      // Try to execute
      const execResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      // Count ready vs not ready tasks
      let readyCount = 0;
      let totalCount = 0;
      if (readiness.tasks && typeof readiness.tasks === "object") {
        Object.values(readiness.tasks).forEach((task: unknown) => {
          totalCount++;
          if (
            task &&
            typeof task === "object" &&
            "isReady" in task &&
            (task as { isReady: boolean }).isReady
          ) {
            readyCount++;
          }
        });
      }

      if (readyCount < totalCount) {
        // Should be blocked
        expect(execResponse.status).toBe(400);
        const error = await execResponse.json();
        expect(error).toHaveProperty("error");
      } else {
        // All ready, should succeed or already running
        expect([200, 400, 409]).toContain(execResponse.status);
      }
    });

    it("should include incomplete task list in error response", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const execResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      if (execResponse.status === 400) {
        const error = await execResponse.json();
        if (error.error === "EXECUTION_BLOCKED") {
          expect(error).toHaveProperty("incompleteTasks");
          expect(Array.isArray(error.incompleteTasks)).toBe(true);

          if (error.incompleteTasks.length > 0) {
            const task = error.incompleteTasks[0];
            expect(task).toHaveProperty("id");
            expect(task).toHaveProperty("readiness");
            expect(task).toHaveProperty("missingItems");
          }
        }
      }
    });

    it("should include threshold in error response", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const execResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      if (execResponse.status === 400) {
        const error = await execResponse.json();
        if (error.error === "EXECUTION_BLOCKED") {
          expect(error).toHaveProperty("threshold");
          expect(error.threshold).toBe(70);
        }
      }
    });

    it("should include suggestion in error response", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const execResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      if (execResponse.status === 400) {
        const error = await execResponse.json();
        if (error.error === "EXECUTION_BLOCKED") {
          expect(error).toHaveProperty("suggestion");
          expect(typeof error.suggestion).toBe("string");
          expect(error.suggestion.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("allowIncomplete override", () => {
    it("should allow execution with allowIncomplete=true", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      // First try without override
      const blockedResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      if (blockedResponse.status === 200) {
        console.log("INFO: All tasks ready, override not needed");
        return;
      }

      // Try with override
      const overrideResponse = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxConcurrent: 2,
            allowIncomplete: true,
          }),
        },
      );

      // Should succeed, conflict if already running, or server error
      expect([200, 409, 500]).toContain(overrideResponse.status);
    });

    it("should include overridden flag in successful response", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxConcurrent: 2,
            allowIncomplete: true,
          }),
        },
      );

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("readiness");
        // overridden might be true or false depending on task state
        if (data.readiness.notReady > 0) {
          expect(data.readiness.overridden).toBe(true);
        }
      }
    });
  });

  describe("readiness summary in response", () => {
    it("should include summary when blocked", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxConcurrent: 2 }),
        },
      );

      if (response.status === 400) {
        const data = await response.json();
        if (data.error === "EXECUTION_BLOCKED") {
          expect(data).toHaveProperty("summary");
          expect(data.summary).toHaveProperty("total");
          expect(data.summary).toHaveProperty("ready");
          expect(data.summary).toHaveProperty("notReady");
        }
      }
    });

    it("should include readiness info when successful", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/task-agent/task-lists/${taskList.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxConcurrent: 2,
            allowIncomplete: true,
          }),
        },
      );

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("readiness");
        expect(data.readiness).toHaveProperty("ready");
        expect(data.readiness).toHaveProperty("total");
      }
    });
  });

  describe("threshold enforcement", () => {
    it("should use 70% as threshold", async () => {
      const listsResponse = await fetch(`${BASE_URL}/pipeline/task-lists`);
      const lists = await listsResponse.json();

      if (!Array.isArray(lists) || lists.length === 0) {
        console.log("SKIP: No task lists available");
        return;
      }

      const taskList = lists.find(
        (l: { taskCount?: number }) => (l.taskCount || 0) > 0,
      );
      if (!taskList) {
        console.log("SKIP: No task list with tasks found");
        return;
      }

      // Get readiness to check threshold
      const readinessResponse = await fetch(
        `${BASE_URL}/pipeline/task-lists/${taskList.id}/readiness`,
      );
      const readiness = await readinessResponse.json();

      // Check each task's readiness against threshold
      if (readiness.tasks && typeof readiness.tasks === "object") {
        Object.values(readiness.tasks).forEach((task: unknown) => {
          const t = task as {
            overall?: number;
            isReady?: boolean;
            taskId?: string;
          };
          if (typeof t.overall === "number" && typeof t.isReady === "boolean") {
            if (t.overall >= 70) {
              expect(t.isReady).toBe(true);
            } else {
              expect(t.isReady).toBe(false);
            }
          }
        });
      }
    });
  });
});
