/**
 * OBS-611: ObservabilityStreamService Unit Tests
 *
 * Tests for the WebSocket streaming service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ObservabilityStreamService,
  observabilityStream,
} from "../../../server/services/observability/observability-stream.js";
import type {
  TranscriptEntry,
  AssertionResultEntry,
  MessageBusLogEntry,
} from "../../../server/types/observability.js";

describe("ObservabilityStreamService", () => {
  beforeEach(() => {
    // Reset instance state
    ObservabilityStreamService.resetInstance();
  });

  afterEach(() => {
    observabilityStream.removeAllListeners();
  });

  describe("singleton instance", () => {
    it("returns the same instance", () => {
      const instance1 = ObservabilityStreamService.getInstance();
      const instance2 = ObservabilityStreamService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("emitTranscriptEntry", () => {
    it("emits transcript:entry event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      const mockEntry: TranscriptEntry = {
        id: "entry-1",
        timestamp: new Date().toISOString(),
        sequence: 1,
        executionId,
        taskId: null,
        instanceId: "inst-1",
        waveNumber: 1,
        entryType: "task_start",
        category: "lifecycle",
        summary: "Task started",
        details: null,
        skillRef: null,
        toolCalls: null,
        assertions: null,
        durationMs: null,
        tokenEstimate: null,
        createdAt: new Date().toISOString(),
      };

      observabilityStream.emitTranscriptEntry(executionId, mockEntry, true);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("transcript:entry");
      expect(event.executionId).toBe(executionId);
      expect(event.entry).toEqual(mockEntry);
      expect(event.isLatest).toBe(true);
    });
  });

  describe("emitToolStart", () => {
    it("emits tool:start event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitToolStart(
        executionId,
        "tool-1",
        "Read",
        "Reading file.ts",
        "task-1",
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("tool:start");
      expect(event.toolUseId).toBe("tool-1");
      expect(event.tool).toBe("Read");
      expect(event.inputSummary).toBe("Reading file.ts");
      expect(event.taskId).toBe("task-1");
    });
  });

  describe("emitToolEnd", () => {
    it("emits tool:end event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitToolEnd(
        executionId,
        "tool-1",
        "done",
        150,
        "File content...",
        false,
        false,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("tool:end");
      expect(event.toolUseId).toBe("tool-1");
      expect(event.resultStatus).toBe("done");
      expect(event.durationMs).toBe(150);
    });
  });

  describe("emitAssertionResult", () => {
    it("emits assertion:result event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      const mockAssertion: AssertionResultEntry = {
        id: "assert-1",
        taskId: "task-1",
        executionId,
        category: "file_created",
        description: "File exists",
        result: "pass",
        evidence: {},
        chainId: null,
        chainPosition: 0,
        timestamp: new Date().toISOString(),
        durationMs: null,
        transcriptEntryId: null,
        createdAt: new Date().toISOString(),
      };

      observabilityStream.emitAssertionResult(
        executionId,
        "task-1",
        mockAssertion,
        1.0,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("assertion:result");
      expect(event.taskId).toBe("task-1");
      expect(event.runningPassRate).toBe(1.0);
    });
  });

  describe("emitSkillStart", () => {
    it("emits skill:start event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitSkillStart(
        executionId,
        "skill-1",
        "test-skill",
        "skills/test.md",
        10,
        "task-1",
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("skill:start");
      expect(event.skillTraceId).toBe("skill-1");
      expect(event.skillName).toBe("test-skill");
      expect(event.skillFile).toBe("skills/test.md");
      expect(event.lineNumber).toBe(10);
    });
  });

  describe("emitSkillEnd", () => {
    it("emits skill:end event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitSkillEnd(
        executionId,
        "skill-1",
        "test-skill",
        "success",
        500,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("skill:end");
      expect(event.skillTraceId).toBe("skill-1");
      expect(event.status).toBe("success");
      expect(event.durationMs).toBe(500);
    });
  });

  describe("emitMessageBusEvent", () => {
    it("emits messagebus:event event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      const mockEntry: MessageBusLogEntry = {
        id: "msg-1",
        eventId: "event-1",
        timestamp: new Date().toISOString(),
        source: "test",
        eventType: "test_event",
        correlationId: null,
        humanSummary: "Test event",
        severity: "info",
        category: "lifecycle",
        transcriptEntryId: null,
        taskId: null,
        executionId,
        payload: null,
        createdAt: new Date().toISOString(),
      };

      observabilityStream.emitMessageBusEvent(mockEntry, false);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("messagebus:event");
      expect(event.entry).toEqual(mockEntry);
      expect(event.requiresAction).toBe(false);
    });
  });

  describe("emitWaveStatus", () => {
    it("emits wave:status event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitWaveStatus(executionId, 1, "running", 5, 2, 0);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("wave:status");
      expect(event.waveNumber).toBe(1);
      expect(event.status).toBe("running");
      expect(event.taskCount).toBe(5);
      expect(event.completedCount).toBe(2);
      expect(event.failedCount).toBe(0);
    });
  });

  describe("emitAgentHeartbeat", () => {
    it("emits agent:heartbeat event", () => {
      const listener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, listener);

      observabilityStream.emitAgentHeartbeat(
        executionId,
        "instance-1",
        "working",
        "task-1",
        { cpuUsage: 50 },
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("agent:heartbeat");
      expect(event.instanceId).toBe("instance-1");
      expect(event.status).toBe("working");
      expect(event.currentTaskId).toBe("task-1");
      expect(event.metrics).toEqual({ cpuUsage: 50 });
    });
  });

  describe("emitExecutionStatus", () => {
    it("emits execution:status event to execution-specific and global listeners", () => {
      const executionListener = vi.fn();
      const globalListener = vi.fn();
      const executionId = "exec-123";

      observabilityStream.on(`observability:${executionId}`, executionListener);
      observabilityStream.on("observability:all", globalListener);

      observabilityStream.emitExecutionStatus(
        executionId,
        "started",
        "Starting execution",
      );

      // Check execution-specific listener
      expect(executionListener).toHaveBeenCalled();

      // Check global listener (receives events for all executions + explicit global broadcast)
      expect(globalListener).toHaveBeenCalled();
    });
  });

  describe("event buffering", () => {
    it("buffers events for replay", () => {
      const executionId = "exec-123";

      observabilityStream.emitWaveStatus(executionId, 1, "pending", 5, 0, 0);
      observabilityStream.emitWaveStatus(executionId, 1, "running", 5, 1, 0);

      const buffered = observabilityStream.getBufferedEvents(executionId);
      expect(buffered.length).toBe(2);
      expect(buffered[0].type).toBe("wave:status");
      expect(buffered[1].type).toBe("wave:status");
    });

    it("clears buffer when requested", () => {
      const executionId = "exec-123";

      observabilityStream.emitWaveStatus(executionId, 1, "pending", 5, 0, 0);
      observabilityStream.clearBuffer(executionId);

      const buffered = observabilityStream.getBufferedEvents(executionId);
      expect(buffered.length).toBe(0);
    });
  });

  describe("listener counts", () => {
    it("tracks listener count for executions", () => {
      const executionId = "exec-123";
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      expect(observabilityStream.getListenerCount(executionId)).toBe(0);

      observabilityStream.on(`observability:${executionId}`, listener1);
      expect(observabilityStream.getListenerCount(executionId)).toBe(1);

      observabilityStream.on(`observability:${executionId}`, listener2);
      expect(observabilityStream.getListenerCount(executionId)).toBe(2);
    });

    it("tracks global listener count", () => {
      const listener = vi.fn();

      expect(observabilityStream.getGlobalListenerCount()).toBe(0);

      observabilityStream.on("observability:all", listener);
      expect(observabilityStream.getGlobalListenerCount()).toBe(1);
    });
  });
});
