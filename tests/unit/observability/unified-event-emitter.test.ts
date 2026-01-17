/**
 * UnifiedEventEmitter Service Tests
 *
 * Tests for the unified event emission system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module
vi.mock("../../../database/db.js", () => ({
  getDb: vi.fn(),
  run: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
}));

// Import after mocking
import UnifiedEventEmitter, {
  eventEmitter,
  resetSequence,
  type EventContext,
  type EventPayload,
  type AgentContext,
  type TelegramContext,
  type ScriptContext,
  type UserContext,
  type IdeationContext,
} from "../../../server/services/observability/unified-event-emitter.js";
import { run } from "../../../database/db.js";

describe("UnifiedEventEmitter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset sequence counters between tests
    resetSequence("test-exec-001");
    resetSequence("test-exec-002");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("emit()", () => {
    it("generates unique entry ID", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Task started",
      };

      const entryId = await eventEmitter.emit(context, payload);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe("string");
      expect(entryId.length).toBeGreaterThan(0);
    });

    it("inserts entry into database", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Task started",
      };

      await eventEmitter.emit(context, payload);

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO transcript_entries"),
        expect.any(Array),
      );
    });

    it("includes correct entry type in insert", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "tool_use",
        category: "action",
        summary: "Tool invoked",
      };

      await eventEmitter.emit(context, payload);

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("tool_use");
    });

    it("includes summary in insert", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "decision",
        category: "knowledge",
        summary: "Made important decision",
      };

      await eventEmitter.emit(context, payload);

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("Made important decision");
    });

    it("truncates long summaries to 200 characters", async () => {
      const longSummary = "A".repeat(300);
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "decision",
        category: "knowledge",
        summary: longSummary,
      };

      await eventEmitter.emit(context, payload);

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      const summaryParam = params.find(
        (p: unknown) =>
          typeof p === "string" && p.length <= 200 && p.length > 100,
      );
      expect(summaryParam?.length).toBe(200);
    });

    it("stringifies details JSON", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "tool_use",
        category: "action",
        summary: "Read file",
        details: { tool: "Read", file: "/path/to/file.ts" },
      };

      await eventEmitter.emit(context, payload);

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      const detailsParam = params.find(
        (p: unknown) =>
          typeof p === "string" && p.includes("tool") && p.includes("Read"),
      );
      expect(detailsParam).toBeDefined();
      expect(JSON.parse(detailsParam)).toEqual({
        tool: "Read",
        file: "/path/to/file.ts",
      });
    });
  });

  describe("Sequence tracking", () => {
    it("increments sequence for same execution", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Event",
      };

      await eventEmitter.emit(context, payload);
      await eventEmitter.emit(context, payload);
      await eventEmitter.emit(context, payload);

      const calls = (run as ReturnType<typeof vi.fn>).mock.calls;
      const sequences = calls.map((call) => call[1][2]); // sequence is at index 2

      expect(sequences).toEqual([1, 2, 3]);
    });

    it("maintains separate sequences for different executions", async () => {
      const context1: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const context2: EventContext = {
        source: "agent",
        executionId: "test-exec-002",
        instanceId: "agent-002",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Event",
      };

      await eventEmitter.emit(context1, payload);
      await eventEmitter.emit(context2, payload);
      await eventEmitter.emit(context1, payload);

      const calls = (run as ReturnType<typeof vi.fn>).mock.calls;

      // First execution: sequence 1 and 2
      // Second execution: sequence 1
      expect(calls[0][1][2]).toBe(1); // exec1, seq 1
      expect(calls[1][1][2]).toBe(1); // exec2, seq 1
      expect(calls[2][1][2]).toBe(2); // exec1, seq 2
    });
  });

  describe("Context handling", () => {
    describe("Agent context", () => {
      it("extracts agent-specific fields", async () => {
        const context: EventContext = {
          source: "agent",
          executionId: "test-exec-001",
          instanceId: "agent-001",
          taskId: "task-001",
          waveId: "wave-001",
          waveNumber: 1,
        };
        const payload: EventPayload = {
          entryType: "task_start",
          category: "lifecycle",
          summary: "Task started",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params).toContain("test-exec-001");
        expect(params).toContain("agent-001");
        expect(params).toContain("task-001");
        expect(params).toContain("wave-001");
        expect(params).toContain(1);
      });
    });

    describe("Telegram context", () => {
      it("extracts telegram-specific fields", async () => {
        const context: EventContext = {
          source: "telegram",
          chatId: "chat-123",
          telegramUserId: "user-456",
          messageId: "msg-789",
        };
        const payload: EventPayload = {
          entryType: "message_received",
          category: "communication",
          summary: "Message received",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params).toContain("chat-123");
        expect(params).toContain("user-456");
        expect(params).toContain("msg-789");
      });

      it("uses telegram execution ID format", async () => {
        const context: EventContext = {
          source: "telegram",
          chatId: "chat-123",
        };
        const payload: EventPayload = {
          entryType: "message_received",
          category: "communication",
          summary: "Message",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params).toContain("telegram-chat-123");
      });
    });

    describe("Script context", () => {
      it("extracts script-specific fields", async () => {
        const context: EventContext = {
          source: "script",
          scriptName: "cleanup.ts",
          scriptArgs: ["--force", "--dry-run"],
        };
        const payload: EventPayload = {
          entryType: "script_started",
          category: "lifecycle",
          summary: "Script started",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params).toContain("cleanup.ts");
        expect(params).toContain(JSON.stringify(["--force", "--dry-run"]));
      });
    });

    describe("User context", () => {
      it("extracts user-specific fields", async () => {
        const context: EventContext = {
          source: "user",
          userId: "user-001",
          sessionId: "session-001",
          pageUrl: "/dashboard",
        };
        const payload: EventPayload = {
          entryType: "page_viewed",
          category: "user_interaction",
          summary: "Page viewed",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params).toContain("user-001");
        expect(params).toContain("session-001");
        expect(params).toContain("/dashboard");
      });
    });

    describe("System context", () => {
      it("uses sequence 0 for system events", async () => {
        const context: EventContext = {
          source: "system",
        };
        const payload: EventPayload = {
          entryType: "server_started",
          category: "system",
          summary: "Server started",
        };

        await eventEmitter.emit(context, payload);

        const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(params[2]).toBe(0); // sequence at index 2
      });
    });
  });

  describe("emitSystem()", () => {
    it("emits system events with correct source", async () => {
      await eventEmitter.emitSystem("server_started", "Server started", {
        port: 3001,
      });

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("system");
      expect(params).toContain("server_started");
      expect(params).toContain("Server started");
    });

    it("includes correlation ID when provided", async () => {
      await eventEmitter.emitSystem(
        "config_changed",
        "Config updated",
        { key: "debug" },
        "correlation-123",
      );

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("correlation-123");
    });
  });

  describe("emitWaveEvent()", () => {
    it("emits wave start event", async () => {
      await eventEmitter.emitWaveEvent("exec-001", "wave_start", 1, {
        taskCount: 5,
      });

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("wave_start");
      expect(params).toContain("lifecycle");
    });

    it("emits wave complete event", async () => {
      await eventEmitter.emitWaveEvent("exec-001", "wave_complete", 2, {
        completedTasks: 5,
      });

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(params).toContain("wave_complete");
    });

    it("includes wave number in summary", async () => {
      await eventEmitter.emitWaveEvent("exec-001", "wave_start", 3, {});

      const [, params] = (run as ReturnType<typeof vi.fn>).mock.calls[0];
      const summary = params.find(
        (p: unknown) => typeof p === "string" && p.includes("wave 3"),
      );
      expect(summary).toBeDefined();
    });
  });

  describe("resetSequence()", () => {
    it("resets sequence counter", async () => {
      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Event",
      };

      await eventEmitter.emit(context, payload);
      await eventEmitter.emit(context, payload);

      resetSequence("test-exec-001");

      await eventEmitter.emit(context, payload);

      const calls = (run as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][1][2]).toBe(1);
      expect(calls[1][1][2]).toBe(2);
      expect(calls[2][1][2]).toBe(1); // Reset, starts from 1 again
    });
  });

  describe("Error handling", () => {
    it("catches and logs database errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB error"),
      );

      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Event",
      };

      // Should not throw
      await eventEmitter.emit(context, payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to emit transcript entry:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("still returns entry ID on database error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      (run as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB error"),
      );

      const context: EventContext = {
        source: "agent",
        executionId: "test-exec-001",
        instanceId: "agent-001",
      };
      const payload: EventPayload = {
        entryType: "task_start",
        category: "lifecycle",
        summary: "Event",
      };

      const entryId = await eventEmitter.emit(context, payload);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe("string");
    });
  });
});
