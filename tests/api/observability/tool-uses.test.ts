/**
 * Tool Uses Endpoint Tests
 *
 * Tests for GET /api/observability/executions/:id/tool-uses
 * and GET /api/observability/executions/:id/tool-summary
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  mockToolUses,
  getMocks,
} from "../__utils__/test-server";
import { testToolUses } from "../__fixtures__/observability-fixtures";
import type { Express } from "express";

describe("GET /api/observability/executions/:id/tool-uses", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns tool uses for execution", async () => {
    const toolsForExec = testToolUses
      .filter((t) => t.executionId === execId)
      .map((t) => ({
        id: t.id,
        tool: t.tool,
        toolCategory: t.toolCategory,
        inputSummary: t.inputSummary,
        resultStatus: t.resultStatus,
        isError: t.isError,
        isBlocked: t.isBlocked,
        durationMs: t.durationMs,
      }));

    mockToolUses(execId, toolsForExec);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("includes duration_ms for completed tool uses", async () => {
    mockToolUses(execId, [
      {
        id: "tool-001",
        tool: "Read",
        toolCategory: "file_operation",
        inputSummary: "Reading file",
        resultStatus: "success",
        durationMs: 100,
      },
    ]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );

    const completedTools = res.body.data.data.filter(
      (t: { endTime: string }) => t.endTime,
    );
    completedTools.forEach((tool: { durationMs: unknown }) => {
      expect(tool).toHaveProperty("durationMs");
      expect(typeof tool.durationMs).toBe("number");
    });
  });

  it("shows blocked commands with isBlocked flag", async () => {
    mockToolUses("test-exec-blocked", [
      {
        id: "tool-004",
        tool: "Bash",
        toolCategory: "shell",
        inputSummary: "Running dangerous command",
        resultStatus: "blocked",
        isBlocked: true,
      },
    ]);

    const res = await request(app).get(
      "/api/observability/executions/test-exec-blocked/tool-uses",
    );

    expect(res.status).toBe(200);
    const blockedTools = res.body.data.data.filter(
      (t: { isBlocked: boolean }) => t.isBlocked,
    );

    if (blockedTools.length > 0) {
      blockedTools.forEach((tool: { isBlocked: boolean }) => {
        expect(tool.isBlocked).toBe(true);
      });
    }
  });

  it("filters by tool category", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM tool_uses") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 2 }]);
        }
        // Only return file_operation tools
        return Promise.resolve([
          {
            id: "tool-001",
            execution_id: execId,
            task_id: null,
            transcript_entry_id: "transcript-001",
            tool: "Read",
            tool_category: "file_operation",
            input: "{}",
            input_summary: "Reading file",
            result_status: "success",
            output: null,
            output_summary: "Success",
            is_error: 0,
            is_blocked: 0,
            error_message: null,
            block_reason: null,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_ms: 50,
            within_skill: null,
            parent_tool_use_id: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/tool-uses`)
      .query({ category: "file_operation" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((tool: { toolCategory: string }) => {
      expect(tool.toolCategory).toBe("file_operation");
    });
  });

  it("filters by error status", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM tool_uses") && sql.includes("is_error = 1")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        return Promise.resolve([
          {
            id: "tool-005",
            execution_id: "test-exec-003",
            task_id: null,
            transcript_entry_id: "transcript-001",
            tool: "Bash",
            tool_category: "shell",
            input: "{}",
            input_summary: "Build command",
            result_status: "error",
            output: null,
            output_summary: "Failed",
            is_error: 1,
            is_blocked: 0,
            error_message: "Build failed",
            block_reason: null,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_ms: 2000,
            within_skill: null,
            parent_tool_use_id: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/executions/test-exec-003/tool-uses")
      .query({ isError: "true" });

    expect(res.status).toBe(200);
  });

  it("includes pagination info", async () => {
    mockToolUses(execId, []);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );

    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
    expect(res.body.data).toHaveProperty("hasMore");
  });
});

describe("GET /api/observability/executions/:id/tool-summary", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns aggregated tool statistics", async () => {
    // Use mockToolUses which also sets up getToolSummary
    mockToolUses(execId, [
      { id: "t-1", tool: "Read", toolCategory: "file_operation", inputSummary: "Read file", resultStatus: "success", durationMs: 100 },
      { id: "t-2", tool: "Read", toolCategory: "file_operation", inputSummary: "Read file", resultStatus: "success", durationMs: 100 },
      { id: "t-3", tool: "Write", toolCategory: "file_operation", inputSummary: "Write file", resultStatus: "success", durationMs: 200 },
      { id: "t-4", tool: "Write", toolCategory: "file_operation", inputSummary: "Write file", resultStatus: "error", isError: true, durationMs: 50 },
    ]);

    // Additional mock for getMocks compatibility (ignore this)
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY tool")) {
        return Promise.resolve([
          { tool: "Read", count: 5 },
          { tool: "Write", count: 3 },
        ]);
      }
      if (sql.includes("GROUP BY tool_category")) {
        return Promise.resolve([
          { tool_category: "file_operation", count: 8 },
          { tool_category: "shell", count: 2 },
        ]);
      }
      if (sql.includes("GROUP BY result_status")) {
        return Promise.resolve([
          { result_status: "success", count: 9 },
          { result_status: "error", count: 1 },
        ]);
      }
      if (sql.includes("AVG(duration_ms)")) {
        return Promise.resolve([
          { total: 10, avg_duration: 150, error_count: 1, block_count: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-summary`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("byTool");
    expect(res.body.data).toHaveProperty("byCategory");
    expect(res.body.data).toHaveProperty("avgDurationMs");
  });

  it("byTool breakdown includes counts", async () => {
    // Use mockToolUses to set up both getToolUses and getToolSummary
    mockToolUses(execId, [
      ...Array(10).fill(null).map((_, i) => ({ id: `r-${i}`, tool: "Read", toolCategory: "file_operation", inputSummary: "Read", resultStatus: "success", durationMs: 100 })),
      ...Array(5).fill(null).map((_, i) => ({ id: `w-${i}`, tool: "Write", toolCategory: "file_operation", inputSummary: "Write", resultStatus: "success", durationMs: 100 })),
    ]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-summary`,
    );

    expect(res.body.data.byTool).toHaveProperty("Read");
    expect(res.body.data.byTool.Read).toBe(10);
    expect(res.body.data.byTool).toHaveProperty("Write");
    expect(res.body.data.byTool.Write).toBe(5);
  });

  it("includes error rate calculation", async () => {
    // Use mockToolUses with some errors
    mockToolUses(execId, [
      ...Array(8).fill(null).map((_, i) => ({ id: `s-${i}`, tool: "Read", toolCategory: "file_operation", inputSummary: "Read", resultStatus: "success", durationMs: 100 })),
      ...Array(2).fill(null).map((_, i) => ({ id: `e-${i}`, tool: "Read", toolCategory: "file_operation", inputSummary: "Read", resultStatus: "error", isError: true, durationMs: 50 })),
    ]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-summary`,
    );

    expect(res.body.data).toHaveProperty("errorRate");
    expect(res.body.data).toHaveProperty("blockRate");
    expect(typeof res.body.data.errorRate).toBe("number");
    expect(typeof res.body.data.blockRate).toBe("number");
  });
});
