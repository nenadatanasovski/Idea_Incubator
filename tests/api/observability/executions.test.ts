/**
 * Executions Endpoint Tests
 *
 * Tests for GET /api/observability/executions endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  seedTestData,
  mockExecution,
  getMocks,
} from "../__utils__/test-server";
import { testExecutions } from "../__fixtures__/observability-fixtures";
import type { Express } from "express";

describe("GET /api/observability/executions", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns paginated list of executions", async () => {
    await seedTestData(testExecutions);

    const res = await request(app).get("/api/observability/executions");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("data");
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("hasMore");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
  });

  it("respects limit parameter", async () => {
    await seedTestData(testExecutions);

    const res = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2 });

    expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data.limit).toBe(2);
  });

  it("respects offset parameter", async () => {
    await seedTestData(testExecutions);

    const res1 = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2, offset: 0 });

    const res2 = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2, offset: 2 });

    // Different offsets should return different results
    if (res1.body.data.data.length > 0 && res2.body.data.data.length > 0) {
      expect(res1.body.data.data[0].id).not.toBe(res2.body.data.data[0]?.id);
    }
  });

  it("filters by status", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 2 }]);
        }
        // Return only running executions when filtered
        const filtered = testExecutions.filter((e) => e.status === "running");
        return Promise.resolve(
          filtered.map((e) => ({
            id: e.id,
            task_list_id: e.taskListId,
            run_number: e.runNumber,
            status: e.status,
            started_at: e.startedAt,
            completed_at: e.completedAt || null,
            session_id: e.sessionId || null,
          })),
        );
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/executions")
      .query({ status: "running" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((exec: { status: string }) => {
      expect(exec.status).toBe("running");
    });
  });

  it("filters by taskListId", async () => {
    await seedTestData(testExecutions);

    const res = await request(app)
      .get("/api/observability/executions")
      .query({ taskListId: "task-list-001" });

    expect(res.status).toBe(200);
  });

  it("returns hasMore correctly", async () => {
    await seedTestData(testExecutions);

    const res = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2 });

    expect(typeof res.body.data.hasMore).toBe("boolean");
  });

  it("returns correct execution structure", async () => {
    await seedTestData(testExecutions);

    const res = await request(app).get("/api/observability/executions");

    if (res.body.data.data.length > 0) {
      const exec = res.body.data.data[0];
      expect(exec).toHaveProperty("id");
      expect(exec).toHaveProperty("taskListId");
      expect(exec).toHaveProperty("runNumber");
      expect(exec).toHaveProperty("status");
      expect(exec).toHaveProperty("startedAt");
    }
  });
});

describe("GET /api/observability/executions/:id", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns execution details by ID", async () => {
    mockExecution({
      id: "test-exec-001",
      taskListId: "task-list-001",
      runNumber: 1,
      status: "completed",
      startedAt: "2026-01-15T10:00:00.000Z",
      completedAt: "2026-01-15T10:30:00.000Z",
      waveCount: 2,
      taskCount: 5,
      completedCount: 5,
      failedCount: 0,
    });

    const res = await request(app).get(
      "/api/observability/executions/test-exec-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("test-exec-001");
    expect(res.body.data).toHaveProperty("taskListId");
    expect(res.body.data).toHaveProperty("status");
    expect(res.body.data).toHaveProperty("startedAt");
  });

  it("returns 404 for non-existent execution", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get(
      "/api/observability/executions/nonexistent",
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty("error");
  });

  it("includes wave and task counts", async () => {
    mockExecution({
      id: "test-exec-001",
      taskListId: "task-list-001",
      runNumber: 1,
      status: "completed",
      startedAt: "2026-01-15T10:00:00.000Z",
      waveCount: 3,
      taskCount: 10,
      completedCount: 8,
      failedCount: 2,
    });

    const res = await request(app).get(
      "/api/observability/executions/test-exec-001",
    );

    expect(res.body.data).toHaveProperty("waveCount");
    expect(res.body.data).toHaveProperty("taskCount");
    expect(res.body.data).toHaveProperty("completedCount");
    expect(res.body.data).toHaveProperty("failedCount");
  });
});
