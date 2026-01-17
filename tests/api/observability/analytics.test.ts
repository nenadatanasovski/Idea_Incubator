/**
 * Analytics Endpoints Tests
 *
 * Tests for GET /api/observability/analytics/* endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, getMocks } from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/analytics/tool-usage", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns aggregated tool usage data", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY tool")) {
        return Promise.resolve([
          { tool: "Read", count: 100, errors: 2, avg_duration: 50 },
          { tool: "Write", count: 50, errors: 1, avg_duration: 100 },
        ]);
      }
      if (sql.includes("COUNT(*)") && sql.includes("tool_uses")) {
        return Promise.resolve([{ total: 150, errors: 3, blocked: 1 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/tool-usage",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("tools");
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data).toHaveProperty("range");
  });

  it("includes tool breakdown with counts", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY tool")) {
        return Promise.resolve([
          { tool: "Read", count: 100, errors: 0, avg_duration: 50 },
        ]);
      }
      return Promise.resolve([{ total: 100, errors: 0, blocked: 0 }]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/tool-usage",
    );

    expect(Array.isArray(res.body.data.tools)).toBe(true);
    if (res.body.data.tools.length > 0) {
      const tool = res.body.data.tools[0];
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("count");
      expect(tool).toHaveProperty("errors");
      expect(tool).toHaveProperty("avgDurationMs");
    }
  });

  it("includes summary statistics", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY tool")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([{ total: 100, errors: 5, blocked: 2 }]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/tool-usage",
    );

    expect(res.body.data.summary).toHaveProperty("total");
    expect(res.body.data.summary).toHaveProperty("errors");
    expect(res.body.data.summary).toHaveProperty("blocked");
    expect(res.body.data.summary).toHaveProperty("errorRate");
  });

  it("supports time range filter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/observability/analytics/tool-usage")
      .query({ range: "1h" });

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe("1h");
  });

  it("defaults to 24h range", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get(
      "/api/observability/analytics/tool-usage",
    );

    expect(res.body.data.range).toBe("24h");
  });
});

describe("GET /api/observability/analytics/assertions", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns assertion trends data", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SUM(CASE WHEN result")) {
        return Promise.resolve([
          { total: 100, passed: 80, failed: 15, skipped: 5, warned: 0 },
        ]);
      }
      if (sql.includes("GROUP BY category")) {
        return Promise.resolve([
          { category: "syntax", total: 50, passed: 48 },
          { category: "unit_test", total: 30, passed: 25 },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/assertions",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data).toHaveProperty("byCategory");
    expect(res.body.data).toHaveProperty("range");
  });

  it("includes pass rate in summary", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SUM(CASE WHEN result")) {
        return Promise.resolve([
          { total: 100, passed: 80, failed: 15, skipped: 5, warned: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/assertions",
    );

    expect(res.body.data.summary).toHaveProperty("total");
    expect(res.body.data.summary).toHaveProperty("passed");
    expect(res.body.data.summary).toHaveProperty("failed");
    expect(res.body.data.summary).toHaveProperty("passRate");
    expect(res.body.data.summary.passRate).toMatch(/^\d+(\.\d+)?%$/);
  });

  it("includes category breakdown", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SUM(CASE WHEN result")) {
        return Promise.resolve([
          { total: 100, passed: 80, failed: 15, skipped: 5, warned: 0 },
        ]);
      }
      if (sql.includes("GROUP BY category")) {
        return Promise.resolve([{ category: "syntax", total: 50, passed: 45 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/assertions",
    );

    expect(Array.isArray(res.body.data.byCategory)).toBe(true);
    if (res.body.data.byCategory.length > 0) {
      const cat = res.body.data.byCategory[0];
      expect(cat).toHaveProperty("category");
      expect(cat).toHaveProperty("total");
      expect(cat).toHaveProperty("passed");
      expect(cat).toHaveProperty("passRate");
    }
  });

  it("supports time range filter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/observability/analytics/assertions")
      .query({ range: "7d" });

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe("7d");
  });
});

describe("GET /api/observability/analytics/durations", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns execution duration statistics", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("AVG(julianday")) {
        return Promise.resolve([
          { avg_duration: 300, min_duration: 60, max_duration: 900, count: 10 },
        ]);
      }
      if (
        sql.includes("SELECT") &&
        sql.includes("duration") &&
        sql.includes("LIMIT")
      ) {
        return Promise.resolve([
          {
            id: "exec-001",
            duration: 120,
            status: "completed",
            started_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/durations",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data).toHaveProperty("trend");
    expect(res.body.data).toHaveProperty("range");
  });

  it("includes duration statistics", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("AVG(julianday")) {
        return Promise.resolve([
          { avg_duration: 300, min_duration: 60, max_duration: 900, count: 10 },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/durations",
    );

    expect(res.body.data.summary).toHaveProperty("avgSeconds");
    expect(res.body.data.summary).toHaveProperty("minSeconds");
    expect(res.body.data.summary).toHaveProperty("maxSeconds");
    expect(res.body.data.summary).toHaveProperty("totalExecutions");
  });

  it("includes trend data", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("AVG(julianday")) {
        return Promise.resolve([
          { avg_duration: 300, min_duration: 60, max_duration: 900, count: 2 },
        ]);
      }
      if (sql.includes("LIMIT 50")) {
        return Promise.resolve([
          {
            id: "exec-001",
            duration: 120,
            status: "completed",
            started_at: "2026-01-15T10:00:00.000Z",
          },
          {
            id: "exec-002",
            duration: 150,
            status: "completed",
            started_at: "2026-01-15T11:00:00.000Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/analytics/durations",
    );

    expect(Array.isArray(res.body.data.trend)).toBe(true);
    if (res.body.data.trend.length > 0) {
      const point = res.body.data.trend[0];
      expect(point).toHaveProperty("id");
      expect(point).toHaveProperty("durationSeconds");
      expect(point).toHaveProperty("status");
      expect(point).toHaveProperty("startedAt");
    }
  });
});

describe("GET /api/observability/analytics/errors", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns error hotspots", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("is_error = 1") && sql.includes("GROUP BY tool")) {
        return Promise.resolve([
          { tool: "Bash", count: 5, sample_error: "Command failed" },
        ]);
      }
      if (
        sql.includes("result = 'fail'") &&
        sql.includes("GROUP BY category")
      ) {
        return Promise.resolve([
          { category: "syntax", count: 3, sample_description: "Type error" },
        ]);
      }
      if (
        sql.includes("status = 'failed'") &&
        sql.includes("FROM task_list_execution_runs")
      ) {
        return Promise.resolve([
          {
            id: "exec-003",
            started_at: new Date().toISOString(),
            run_number: 1,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/analytics/errors");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("toolErrors");
    expect(res.body.data).toHaveProperty("assertionFailures");
    expect(res.body.data).toHaveProperty("failedExecutions");
    expect(res.body.data).toHaveProperty("range");
  });

  it("includes tool errors breakdown", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("is_error = 1") && sql.includes("GROUP BY tool")) {
        return Promise.resolve([
          { tool: "Bash", count: 5, sample_error: "Build failed" },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/analytics/errors");

    expect(Array.isArray(res.body.data.toolErrors)).toBe(true);
    if (res.body.data.toolErrors.length > 0) {
      const err = res.body.data.toolErrors[0];
      expect(err).toHaveProperty("tool");
      expect(err).toHaveProperty("count");
      expect(err).toHaveProperty("sampleError");
    }
  });

  it("includes assertion failures breakdown", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (
        sql.includes("result = 'fail'") &&
        sql.includes("GROUP BY category")
      ) {
        return Promise.resolve([
          {
            category: "unit_test",
            count: 2,
            sample_description: "Test failed",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/analytics/errors");

    expect(Array.isArray(res.body.data.assertionFailures)).toBe(true);
    if (res.body.data.assertionFailures.length > 0) {
      const failure = res.body.data.assertionFailures[0];
      expect(failure).toHaveProperty("category");
      expect(failure).toHaveProperty("count");
      expect(failure).toHaveProperty("sampleDescription");
    }
  });

  it("includes failed executions list", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (
        sql.includes("status = 'failed'") &&
        sql.includes("FROM task_list_execution_runs")
      ) {
        return Promise.resolve([
          {
            id: "exec-003",
            started_at: "2026-01-16T09:00:00.000Z",
            run_number: 3,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/analytics/errors");

    expect(Array.isArray(res.body.data.failedExecutions)).toBe(true);
    if (res.body.data.failedExecutions.length > 0) {
      const exec = res.body.data.failedExecutions[0];
      expect(exec).toHaveProperty("id");
      expect(exec).toHaveProperty("runNumber");
      expect(exec).toHaveProperty("startedAt");
    }
  });

  it("supports time range filter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/observability/analytics/errors")
      .query({ range: "6h" });

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe("6h");
  });
});
