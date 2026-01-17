/**
 * Assertions Endpoint Tests
 *
 * Tests for GET /api/observability/executions/:id/assertions
 * and GET /api/observability/executions/:id/assertion-summary
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  mockAssertions,
  getMocks,
} from "../__utils__/test-server";
import { testAssertions } from "../__fixtures__/observability-fixtures";
import type { Express } from "express";

describe("GET /api/observability/executions/:id/assertions", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns assertions for execution", async () => {
    const assertionsForExec = testAssertions
      .filter((a) => a.executionId === execId)
      .map((a) => ({
        id: a.id,
        taskId: a.taskId,
        category: a.category,
        description: a.description,
        result: a.result,
        evidence: a.evidence,
        chainId: a.chainId,
      }));

    mockAssertions(execId, assertionsForExec);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("includes required assertion fields", async () => {
    mockAssertions(execId, [
      {
        id: "assertion-001",
        taskId: "task-001",
        category: "syntax",
        description: "File compiles",
        result: "pass",
        evidence: { exitCode: 0 },
        chainId: "chain-001",
      },
    ]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );

    if (res.body.data.data.length > 0) {
      const assertion = res.body.data.data[0];

      expect(assertion).toHaveProperty("id");
      expect(assertion).toHaveProperty("taskId");
      expect(assertion).toHaveProperty("category");
      expect(assertion).toHaveProperty("description");
      expect(assertion).toHaveProperty("result");
      expect(assertion).toHaveProperty("evidence");
    }
  });

  it("filters by result", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM assertion_results") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        // Return only failed assertions
        return Promise.resolve([
          {
            id: "assertion-004",
            task_id: "task-003",
            execution_id: execId,
            category: "syntax",
            description: "File compiles",
            result: "fail",
            evidence: JSON.stringify({ exitCode: 1 }),
            chain_id: null,
            chain_position: null,
            timestamp: new Date().toISOString(),
            duration_ms: null,
            transcript_entry_id: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/assertions`)
      .query({ result: "fail" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((assertion: { result: string }) => {
      expect(assertion.result).toBe("fail");
    });
  });

  it("filters by category", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM assertion_results") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        return Promise.resolve([
          {
            id: "assertion-001",
            task_id: "task-001",
            execution_id: execId,
            category: "syntax",
            description: "File compiles",
            result: "pass",
            evidence: JSON.stringify({}),
            chain_id: null,
            chain_position: null,
            timestamp: new Date().toISOString(),
            duration_ms: null,
            transcript_entry_id: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/assertions`)
      .query({ category: "syntax" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((assertion: { category: string }) => {
      expect(assertion.category).toBe("syntax");
    });
  });

  it("evidence is parsed as object", async () => {
    mockAssertions(execId, [
      {
        id: "assertion-001",
        taskId: "task-001",
        category: "syntax",
        description: "File compiles",
        result: "pass",
        evidence: { command: "tsc", exitCode: 0 },
        chainId: "chain-001",
      },
    ]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );

    if (res.body.data.data.length > 0) {
      expect(typeof res.body.data.data[0].evidence).toBe("object");
    }
  });

  it("includes pagination info", async () => {
    mockAssertions(execId, []);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );

    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
    expect(res.body.data).toHaveProperty("hasMore");
  });
});

describe("GET /api/observability/executions/:id/assertion-summary", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns overall pass rate", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (
        sql.includes("FROM assertion_results") &&
        sql.includes("GROUP BY result")
      ) {
        return Promise.resolve([
          { result: "pass", count: 8 },
          { result: "fail", count: 2 },
        ]);
      }
      if (
        sql.includes("FROM assertion_results") &&
        sql.includes("GROUP BY category")
      ) {
        return Promise.resolve([{ category: "syntax", total: 10, passed: 8 }]);
      }
      if (
        sql.includes("FROM assertion_chains") &&
        sql.includes("GROUP BY overall_result")
      ) {
        return Promise.resolve([{ overall_result: "pass", count: 1 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("passed");
    expect(res.body.data).toHaveProperty("failed");
    expect(res.body.data).toHaveProperty("passRate");
    expect(res.body.data.passRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.passRate).toBeLessThanOrEqual(1);
  });

  it("includes breakdown by category", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY result")) {
        return Promise.resolve([
          { result: "pass", count: 5 },
          { result: "fail", count: 1 },
        ]);
      }
      if (sql.includes("GROUP BY category")) {
        return Promise.resolve([
          { category: "syntax", total: 3, passed: 3 },
          { category: "unit_test", total: 3, passed: 2 },
        ]);
      }
      if (sql.includes("GROUP BY overall_result")) {
        return Promise.resolve([{ overall_result: "pass", count: 1 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );

    expect(res.body.data).toHaveProperty("byCategory");
    expect(typeof res.body.data.byCategory).toBe("object");
  });

  it("includes chain statistics", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY result")) {
        return Promise.resolve([{ result: "pass", count: 5 }]);
      }
      if (sql.includes("GROUP BY category")) {
        return Promise.resolve([]);
      }
      if (sql.includes("GROUP BY overall_result")) {
        return Promise.resolve([
          { overall_result: "pass", count: 2 },
          { overall_result: "fail", count: 1 },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );

    expect(res.body.data).toHaveProperty("chains");
    expect(res.body.data.chains).toHaveProperty("total");
    expect(res.body.data.chains).toHaveProperty("passed");
    expect(res.body.data.chains).toHaveProperty("failed");
  });

  it("handles empty assertions gracefully", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.passRate).toBe(0);
  });
});
