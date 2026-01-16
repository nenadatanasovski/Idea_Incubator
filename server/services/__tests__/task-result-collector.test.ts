/**
 * Task Result Collector Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTaskResultCollector,
  TaskResultCollector,
} from "../task-result-collector.js";
import { ParsedTask } from "../task-loader.js";
import * as db from "../../../database/db.js";

// Mock database functions
vi.mock("../../../database/db.js", () => ({
  query: vi.fn(),
  run: vi.fn(),
  getOne: vi.fn(),
}));

describe("TaskResultCollector", () => {
  let collector: TaskResultCollector;
  const mockTask: ParsedTask = {
    lineNumber: 1,
    id: "TEST-001",
    description: "Test task",
    status: "pending",
    priority: "P1",
    section: "Test Section",
  };

  beforeEach(() => {
    collector = createTaskResultCollector();
    vi.clearAllMocks();
  });

  describe("startExecution", () => {
    it("should create an execution ID and record in database", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      expect(executionId).toMatch(/^exec-\d+-TEST-001$/);
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_executions"),
        expect.arrayContaining([
          executionId,
          "TEST-001",
          "build-123",
          "/path/to/tasks.md",
          "test-agent",
        ]),
      );
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(db.run).mockRejectedValueOnce(new Error("DB error"));

      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      // Should still return an execution ID even if DB fails
      expect(executionId).toMatch(/^exec-\d+-TEST-001$/);
    });

    it("should emit execution:started event", async () => {
      const listener = vi.fn();
      collector.on("execution:started", listener);

      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      expect(listener).toHaveBeenCalledWith({
        executionId,
        taskId: "TEST-001",
        assignedAgent: "test-agent",
      });
    });
  });

  describe("recordCompletion", () => {
    it("should update database with success result", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      await collector.recordCompletion(executionId, {
        success: true,
        output: "Task completed successfully",
        filesModified: ["file1.ts", "file2.ts"],
        questionsAsked: 2,
        tokensUsed: 1500,
      });

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE task_executions"),
        expect.arrayContaining([
          "completed",
          expect.any(String), // completedAt
          "Task completed successfully",
          null, // error
          JSON.stringify(["file1.ts", "file2.ts"]),
          2,
          1500,
          executionId,
        ]),
      );
    });

    it("should emit execution:completed event", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      const listener = vi.fn();
      collector.on("execution:completed", listener);

      await collector.recordCompletion(executionId, {
        success: true,
        output: "Done",
      });

      expect(listener).toHaveBeenCalledWith({
        executionId,
        success: true,
        output: "Done",
      });
    });
  });

  describe("recordFailure", () => {
    it("should update database with failure", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      await collector.recordFailure(
        executionId,
        "Task failed due to error",
        false,
      );

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE task_executions"),
        expect.arrayContaining([
          "failed",
          expect.any(String), // completedAt
          "Task failed due to error",
          executionId,
        ]),
      );
    });

    it("should emit execution:failed event", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      const listener = vi.fn();
      collector.on("execution:failed", listener);

      await collector.recordFailure(executionId, "Error occurred", false);

      expect(listener).toHaveBeenCalledWith({
        executionId,
        error: "Error occurred",
        willRetry: false,
      });
    });
  });

  describe("waitForCompletion", () => {
    it("should resolve when task completes successfully", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      const waitPromise = collector.waitForCompletion(executionId, 1000);

      // Simulate completion
      setTimeout(() => {
        collector.recordCompletion(executionId, {
          success: true,
          output: "Done",
        });
      }, 100);

      const result = await waitPromise;

      expect(result.success).toBe(true);
      expect(result.output).toBe("Done");
    });

    it("should reject when task fails", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      const waitPromise = collector.waitForCompletion(executionId, 1000);

      // Simulate failure
      setTimeout(() => {
        collector.recordFailure(executionId, "Failed", false);
      }, 100);

      await expect(waitPromise).rejects.toThrow("Failed");
    });

    it("should timeout if task does not complete", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      await expect(
        collector.waitForCompletion(executionId, 100),
      ).rejects.toThrow(/timed out/);
    });
  });

  describe("getMetrics", () => {
    it("should calculate execution metrics", async () => {
      vi.mocked(db.getOne).mockResolvedValueOnce({
        total: 10,
        completed: 7,
        failed: 2,
        in_progress: 1,
        avg_duration: 5000,
        total_tokens: 15000,
        total_questions: 5,
      });

      const metrics = await collector.getMetrics("build-123");

      expect(metrics).toEqual({
        totalExecutions: 10,
        completed: 7,
        failed: 2,
        inProgress: 1,
        avgDurationMs: 5000,
        totalTokensUsed: 15000,
        totalQuestionsAsked: 5,
      });
    });
  });

  describe("cancelExecution", () => {
    it("should cancel a pending execution", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      await collector.cancelExecution(executionId);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'skipped'"),
        expect.arrayContaining([executionId]),
      );
    });

    it("should emit execution:cancelled event", async () => {
      const executionId = await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "test-agent",
      );

      const listener = vi.fn();
      collector.on("execution:cancelled", listener);

      await collector.cancelExecution(executionId);

      expect(listener).toHaveBeenCalledWith({ executionId });
    });
  });

  describe("getPendingCount", () => {
    it("should return count of pending executions", async () => {
      expect(collector.getPendingCount()).toBe(0);

      await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "agent1",
      );
      expect(collector.getPendingCount()).toBe(1);

      await collector.startExecution(
        mockTask,
        "/path/to/tasks.md",
        "build-123",
        "agent2",
      );
      expect(collector.getPendingCount()).toBe(2);
    });
  });
});
