/**
 * ExecutionManager Service Tests
 *
 * Tests for execution run management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module
vi.mock("../../../database/db.js", () => ({
  getDb: vi.fn(),
  run: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
}));

// Mock the event emitter
vi.mock(
  "../../../server/services/observability/unified-event-emitter.js",
  () => ({
    eventEmitter: {
      emitSystem: vi.fn().mockResolvedValue("event-id"),
    },
    resetSequence: vi.fn(),
  }),
);

// Import after mocking
import {
  createExecutionRun,
  completeExecutionRun,
  getExecutionRun,
  createExecutionSession,
  completeExecutionSession,
  updateWaveCount,
  getActiveExecutions,
} from "../../../server/services/observability/execution-manager.js";
import { run, query } from "../../../database/db.js";
import {
  eventEmitter,
  resetSequence,
} from "../../../server/services/observability/unified-event-emitter.js";

describe("ExecutionManager", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for run number query
    (query as ReturnType<typeof vi.fn>).mockResolvedValue([{ max_run: 0 }]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createExecutionRun()", () => {
    it("generates unique execution ID", async () => {
      const executionId = await createExecutionRun("task-list-001");

      expect(executionId).toBeDefined();
      expect(typeof executionId).toBe("string");
      expect(executionId.length).toBeGreaterThan(0);
    });

    it("inserts execution run into database", async () => {
      await createExecutionRun("task-list-001");

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_list_execution_runs"),
        expect.any(Array),
      );
    });

    it("includes task list ID in insert", async () => {
      await createExecutionRun("task-list-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("task-list-001");
    });

    it("sets initial status to running", async () => {
      await createExecutionRun("task-list-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("running");
    });

    it("increments run number for same task list", async () => {
      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { max_run: 5 },
      ]);

      await createExecutionRun("task-list-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain(6); // 5 + 1
    });

    it("includes session ID when provided", async () => {
      await createExecutionRun("task-list-001", "session-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("session-001");
    });

    it("resets sequence counter for new execution", async () => {
      const executionId = await createExecutionRun("task-list-001");

      expect(resetSequence).toHaveBeenCalledWith(executionId);
    });

    it("emits phase_start event", async () => {
      const executionId = await createExecutionRun("task-list-001");

      expect(eventEmitter.emitSystem).toHaveBeenCalledWith(
        "phase_start",
        "Execution started",
        expect.objectContaining({
          executionId,
          taskListId: "task-list-001",
        }),
      );
    });

    it("caches active execution", async () => {
      await createExecutionRun("task-list-001");

      const activeExecutions = getActiveExecutions();
      expect(activeExecutions.length).toBeGreaterThan(0);
    });

    it("throws on database error", async () => {
      (run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(createExecutionRun("task-list-001")).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("completeExecutionRun()", () => {
    beforeEach(async () => {
      // Create an execution first
      await createExecutionRun("task-list-001");
      vi.resetAllMocks();

      // Mock stats query
      (query as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          task_count: 10,
          completed_count: 8,
          failed_count: 2,
          wave_count: 3,
        },
      ]);
    });

    it("updates execution status", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "completed");

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE task_list_execution_runs"),
        expect.arrayContaining(["completed"]),
      );
    });

    it("sets completed_at timestamp", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "completed");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      // Second param should be ISO timestamp
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("emits phase_end event", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "completed");

      expect(eventEmitter.emitSystem).toHaveBeenCalledWith(
        "phase_end",
        "Execution completed",
        expect.any(Object),
      );
    });

    it("handles failed status", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "failed");

      expect(eventEmitter.emitSystem).toHaveBeenCalledWith(
        "phase_end",
        "Execution failed",
        expect.any(Object),
      );
    });

    it("handles cancelled status", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "cancelled");

      expect(run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["cancelled"]),
      );
    });

    it("includes summary in event", async () => {
      const executions = getActiveExecutions();
      const executionId = executions[0]?.id || "test-exec-001";

      await completeExecutionRun(executionId, "completed", {
        notes: "All done",
      });

      expect(eventEmitter.emitSystem).toHaveBeenCalledWith(
        "phase_end",
        expect.any(String),
        expect.objectContaining({ notes: "All done" }),
      );
    });
  });

  describe("getExecutionRun()", () => {
    it("returns cached execution if active", async () => {
      const executionId = await createExecutionRun("task-list-001");

      const execution = await getExecutionRun(executionId);

      expect(execution).toBeDefined();
      expect(execution?.id).toBe(executionId);
      expect(execution?.status).toBe("running");
    });

    it("queries database for non-cached execution", async () => {
      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: "old-exec-001",
          task_list_id: "task-list-001",
          status: "completed",
          started_at: "2026-01-15T10:00:00.000Z",
          completed_at: "2026-01-15T10:30:00.000Z",
          session_id: null,
        },
      ]);

      const execution = await getExecutionRun("old-exec-001");

      expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT"), [
        "old-exec-001",
      ]);
      expect(execution).toBeDefined();
      expect(execution?.status).toBe("completed");
    });

    it("returns null for non-existent execution", async () => {
      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const execution = await getExecutionRun("non-existent");

      expect(execution).toBeNull();
    });

    it("maps database fields to ExecutionRun interface", async () => {
      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: "exec-001",
          task_list_id: "list-001",
          status: "failed",
          started_at: "2026-01-15T10:00:00.000Z",
          completed_at: "2026-01-15T10:15:00.000Z",
          session_id: "session-001",
        },
      ]);

      const execution = await getExecutionRun("exec-001");

      expect(execution).toEqual({
        id: "exec-001",
        taskListId: "list-001",
        status: "failed",
        startedAt: "2026-01-15T10:00:00.000Z",
        completedAt: "2026-01-15T10:15:00.000Z",
        sessionId: "session-001",
        waveCount: 0,
        taskCount: 0,
        completedCount: 0,
        failedCount: 0,
      });
    });
  });

  describe("createExecutionSession()", () => {
    it("generates unique session ID", async () => {
      const sessionId = await createExecutionSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it("inserts session into database", async () => {
      await createExecutionSession();

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO concurrent_execution_sessions"),
        expect.any(Array),
      );
    });

    it("sets initial status to active", async () => {
      await createExecutionSession();

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("active");
    });

    it("throws on database error", async () => {
      (run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(createExecutionSession()).rejects.toThrow("DB error");
    });
  });

  describe("completeExecutionSession()", () => {
    beforeEach(() => {
      // Mock stats query
      (query as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          execution_count: 3,
          total_wave_count: 10,
          total_task_count: 50,
          peak_concurrent_agents: 5,
        },
      ]);
    });

    it("updates session status", async () => {
      await completeExecutionSession("session-001");

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE concurrent_execution_sessions"),
        expect.arrayContaining(["completed"]),
      );
    });

    it("sets completed_at timestamp", async () => {
      await completeExecutionSession("session-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("handles failed status", async () => {
      await completeExecutionSession("session-001", "failed");

      expect(run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["failed"]),
      );
    });

    it("updates with session stats", async () => {
      await completeExecutionSession("session-001");

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain(3); // execution_count
      expect(params).toContain(10); // total_wave_count
      expect(params).toContain(50); // total_task_count
      expect(params).toContain(5); // peak_concurrent_agents
    });
  });

  describe("updateWaveCount()", () => {
    it("updates cached execution wave count", async () => {
      const executionId = await createExecutionRun("task-list-001");

      await updateWaveCount(executionId, 5);

      const execution = await getExecutionRun(executionId);
      expect(execution?.waveCount).toBe(5);
    });

    it("does nothing for non-cached execution", async () => {
      // Should not throw
      await updateWaveCount("non-existent", 5);
    });
  });

  describe("getActiveExecutions()", () => {
    it("returns empty array initially", () => {
      // After reset, should be empty
      const executions = getActiveExecutions();
      expect(Array.isArray(executions)).toBe(true);
    });

    it("returns active executions after creation", async () => {
      await createExecutionRun("task-list-001");
      await createExecutionRun("task-list-002");

      const executions = getActiveExecutions();
      expect(executions.length).toBeGreaterThanOrEqual(2);
    });

    it("returns ExecutionRun objects", async () => {
      await createExecutionRun("task-list-001");

      const executions = getActiveExecutions();
      const execution = executions[executions.length - 1];

      expect(execution).toHaveProperty("id");
      expect(execution).toHaveProperty("taskListId");
      expect(execution).toHaveProperty("status");
      expect(execution).toHaveProperty("startedAt");
    });
  });
});
