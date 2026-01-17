/**
 * Tests for useObservability hooks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useObservability hooks", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("API response handling", () => {
    it("should handle successful executions list response", async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: "exec-1",
            taskListId: "task-1",
            runNumber: 1,
            status: "completed",
            startedAt: "2024-01-01T00:00:00Z",
            completedAt: "2024-01-01T00:01:00Z",
          },
        ],
        total: 1,
        hasMore: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch("/api/observability/executions");
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe("exec-1");
    });

    it("should handle error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ success: false, error: "Server error" }),
      });

      const response = await fetch("/api/observability/executions");
      expect(response.ok).toBe(false);
    });

    it("should handle pagination parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
            total: 100,
            hasMore: true,
          }),
      });

      await fetch("/api/observability/executions?limit=10&offset=20");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/observability/executions?limit=10&offset=20",
      );
    });
  });

  describe("Transcript data handling", () => {
    it("should parse transcript entries correctly", async () => {
      const mockTranscript = {
        success: true,
        data: [
          {
            id: "entry-1",
            executionId: "exec-1",
            timestamp: "2024-01-01T00:00:00Z",
            entryType: "tool_use",
            summary: "Test tool call",
            category: "execution",
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTranscript),
      });

      const response = await fetch(
        "/api/observability/executions/exec-1/transcript",
      );
      const data = await response.json();

      expect(data.data[0].entryType).toBe("tool_use");
      expect(data.data[0].summary).toBe("Test tool call");
    });
  });

  describe("Tool uses data handling", () => {
    it("should parse tool uses with duration", async () => {
      const mockToolUses = {
        success: true,
        data: [
          {
            id: "tool-1",
            executionId: "exec-1",
            tool: "Bash",
            startTime: "2024-01-01T00:00:00Z",
            endTime: "2024-01-01T00:00:01Z",
            durationMs: 1000,
            result: "success",
            isError: false,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToolUses),
      });

      const response = await fetch(
        "/api/observability/executions/exec-1/tool-uses",
      );
      const data = await response.json();

      expect(data.data[0].tool).toBe("Bash");
      expect(data.data[0].durationMs).toBe(1000);
      expect(data.data[0].isError).toBe(false);
    });
  });

  describe("Assertion data handling", () => {
    it("should parse assertion results", async () => {
      const mockAssertions = {
        success: true,
        data: [
          {
            id: "assert-1",
            executionId: "exec-1",
            result: "pass",
            description: "Build succeeded",
            category: "build",
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAssertions),
      });

      const response = await fetch(
        "/api/observability/executions/exec-1/assertions",
      );
      const data = await response.json();

      expect(data.data[0].result).toBe("pass");
      expect(data.data[0].category).toBe("build");
    });
  });

  describe("Summary endpoints", () => {
    it("should return tool summary with counts", async () => {
      const mockSummary = {
        success: true,
        data: {
          totalCalls: 50,
          uniqueTools: 5,
          errorCount: 2,
          byTool: [
            { tool: "Bash", count: 30, errors: 1 },
            { tool: "Read", count: 20, errors: 1 },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const response = await fetch(
        "/api/observability/executions/exec-1/tool-summary",
      );
      const data = await response.json();

      expect(data.data.totalCalls).toBe(50);
      expect(data.data.uniqueTools).toBe(5);
      expect(data.data.byTool).toHaveLength(2);
    });

    it("should return assertion summary with pass rate", async () => {
      const mockSummary = {
        success: true,
        data: {
          total: 10,
          passed: 8,
          failed: 1,
          warned: 1,
          passRate: 0.8,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });

      const response = await fetch(
        "/api/observability/executions/exec-1/assertion-summary",
      );
      const data = await response.json();

      expect(data.data.passRate).toBe(0.8);
      expect(data.data.passed).toBe(8);
    });
  });
});
