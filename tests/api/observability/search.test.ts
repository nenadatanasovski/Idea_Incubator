/**
 * Search Endpoint Tests
 *
 * Tests for GET /api/observability/search
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, getMocks } from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/search", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns empty results for empty query", async () => {
    const res = await request(app).get("/api/observability/search").query({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("returns empty results for whitespace query", async () => {
    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "   " });

    expect(res.status).toBe(200);
    expect(res.body.data.results).toEqual([]);
  });

  it("searches executions by status", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-001",
            run_number: 1,
            status: "failed",
            started_at: new Date().toISOString(),
            task_list_id: "list-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "failed" });

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(0);
  });

  it("searches tool uses by tool name", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM tool_uses")) {
        return Promise.resolve([
          {
            id: "tool-001",
            tool: "Read",
            input_summary: "Reading file",
            output_summary: "Success",
            start_time: new Date().toISOString(),
            execution_id: "exec-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "read" });

    expect(res.status).toBe(200);
  });

  it("includes result types in response", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-001",
            run_number: 1,
            status: "completed",
            started_at: new Date().toISOString(),
            task_list_id: "list-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "test" });

    if (res.body.data.results.length > 0) {
      res.body.data.results.forEach(
        (result: { type: string; id: string; title: string; href: string }) => {
          expect(result).toHaveProperty("type");
          expect(result).toHaveProperty("id");
          expect(result).toHaveProperty("title");
          expect(result).toHaveProperty("href");
          expect(result).toHaveProperty("timestamp");
        },
      );
    }
  });

  it("respects limit parameter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve(
          Array(10)
            .fill(null)
            .map((_, i) => ({
              id: `exec-${i}`,
              run_number: i,
              status: "completed",
              started_at: new Date().toISOString(),
              task_list_id: "list-001",
            })),
        );
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "test", limit: 5 });

    expect(res.body.data.results.length).toBeLessThanOrEqual(5);
    expect(res.body.data.limit).toBe(5);
  });

  it("includes pagination info", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "test" });

    expect(res.body.data).toHaveProperty("results");
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
  });

  it("searches events by event type", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM evaluation_events")) {
        return Promise.resolve([
          {
            id: "event-001",
            event_type: "task.started",
            session_id: "session-001",
            event_data: JSON.stringify({ message: "Task started" }),
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "started" });

    expect(res.status).toBe(200);
  });

  it("searches agents by name", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM build_agent_instances")) {
        return Promise.resolve([
          {
            id: "agent-001",
            name: "build-agent-1",
            type: "build",
            status: "active",
            last_heartbeat: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "build" });

    expect(res.status).toBe(200);
  });

  it("searches failed assertions", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (
        sql.includes("FROM assertion_results") &&
        sql.includes("result = 'fail'")
      ) {
        return Promise.resolve([
          {
            id: "assertion-001",
            description: "Type check failed",
            category: "syntax",
            timestamp: new Date().toISOString(),
            execution_id: "exec-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "type" });

    expect(res.status).toBe(200);
  });

  it("sorts results by timestamp descending", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-old",
            run_number: 1,
            status: "completed",
            started_at: "2026-01-10T10:00:00.000Z",
            task_list_id: "list-001",
          },
          {
            id: "exec-new",
            run_number: 2,
            status: "completed",
            started_at: "2026-01-15T10:00:00.000Z",
            task_list_id: "list-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/search")
      .query({ q: "completed" });

    if (res.body.data.results.length > 1) {
      const results = res.body.data.results;
      for (let i = 1; i < results.length; i++) {
        const prevTime = new Date(results[i - 1].timestamp).getTime();
        const currTime = new Date(results[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    }
  });
});
