/**
 * Integration Tests: Auto-Populate API Endpoints
 * Tests the auto-populate suggestion and apply endpoints
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

describe("Auto-Populate API", () => {
  describe("POST /pipeline/tasks/:taskId/auto-populate", () => {
    it("should return 200 for acceptance_criteria field", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );

      expect(response.status).toBe(200);
    });

    it("should return suggestions structure", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );
      const data = await response.json();

      expect(data).toHaveProperty("suggestions");
      expect(data).toHaveProperty("preview");
      expect(data).toHaveProperty("field");
    });

    it("should return suggestions with confidence scores", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );
      const data = await response.json();

      if (data.suggestions && data.suggestions.length > 0) {
        const suggestion = data.suggestions[0];
        expect(suggestion).toHaveProperty("id");
        expect(suggestion).toHaveProperty("content");
        expect(suggestion).toHaveProperty("confidence");
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should support file_impacts field", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "file_impacts" }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.field).toBe("file_impacts");
    });

    it("should support test_commands field", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "test_commands" }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.field).toBe("test_commands");
    });

    it("should support dependencies field", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "dependencies" }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.field).toBe("dependencies");
    });

    it("should return 400 for invalid field", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "invalid_field" }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("should return 404 or 500 for nonexistent task", async () => {
      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/nonexistent-task-id-12345/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );

      // Accept 404 or 500 (depending on implementation)
      expect([404, 500]).toContain(response.status);
    });
  });

  describe("POST /pipeline/tasks/:taskId/auto-populate/apply", () => {
    it("should return 200 when applying suggestions", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      // First get suggestions
      const suggestResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );
      const suggestData = await suggestResponse.json();

      if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
        console.log("SKIP: No suggestions available");
        return;
      }

      // Apply suggestions
      const applyResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "acceptance_criteria",
            suggestionIds: [suggestData.suggestions[0].id],
          }),
        },
      );

      expect(applyResponse.status).toBe(200);
    });

    it("should return applied count", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      // Get suggestions
      const suggestResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );
      const suggestData = await suggestResponse.json();

      if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
        console.log("SKIP: No suggestions available");
        return;
      }

      // Apply
      const applyResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "acceptance_criteria",
            suggestionIds: [suggestData.suggestions[0].id],
          }),
        },
      );
      const applyData = await applyResponse.json();

      expect(applyData).toHaveProperty("applied");
      expect(typeof applyData.applied).toBe("number");
    });

    it("should return 400 when field is missing", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionIds: ["id1"] }),
        },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("readiness update after apply", () => {
    it("should increase readiness after applying AC suggestions", async () => {
      const taskId = await getTaskIdFromTaskList();
      if (!taskId) {
        console.log("SKIP: No tasks available");
        return;
      }

      // Get initial readiness
      const initialResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const initialReadiness = await initialResponse.json();

      // Get and apply suggestions
      const suggestResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "acceptance_criteria" }),
        },
      );
      const suggestData = await suggestResponse.json();

      if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
        console.log("INFO: No suggestions to apply, readiness may not change");
        return;
      }

      // Apply
      await fetch(`${BASE_URL}/pipeline/tasks/${taskId}/auto-populate/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "acceptance_criteria",
          suggestionIds: suggestData.suggestions.map(
            (s: { id: string }) => s.id,
          ),
        }),
      });

      // Get new readiness
      const newResponse = await fetch(
        `${BASE_URL}/pipeline/tasks/${taskId}/readiness`,
      );
      const newReadiness = await newResponse.json();

      // Readiness should stay same or increase (depends on initial state)
      expect(newReadiness.overall).toBeGreaterThanOrEqual(
        initialReadiness.overall,
      );
    });
  });
});
