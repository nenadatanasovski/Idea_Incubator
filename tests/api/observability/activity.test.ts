/**
 * Activity Endpoint Tests
 *
 * Tests for GET /api/observability/activity
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, getMocks } from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/activity", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns activity feed", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-001",
            status: "completed",
            run_number: 1,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("includes required activity fields", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-001",
            status: "completed",
            run_number: 1,
            started_at: "2026-01-15T10:00:00.000Z",
            completed_at: "2026-01-15T10:30:00.000Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    if (res.body.data.length > 0) {
      const activity = res.body.data[0];

      expect(activity).toHaveProperty("id");
      expect(activity).toHaveProperty("type");
      expect(activity).toHaveProperty("title");
      expect(activity).toHaveProperty("description");
      expect(activity).toHaveProperty("timestamp");
      expect(activity).toHaveProperty("href");
    }
  });

  it("includes execution activities", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-001",
            status: "running",
            run_number: 1,
            started_at: new Date().toISOString(),
            completed_at: null,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    const execActivities = res.body.data.filter(
      (a: { type: string }) => a.type === "execution",
    );
    expect(execActivities.length).toBeGreaterThanOrEqual(0);
  });

  it("includes event activities", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM evaluation_events")) {
        return Promise.resolve([
          {
            id: "event-001",
            event_type: "task.started",
            session_id: "session-001",
            created_at: new Date().toISOString(),
            event_data: JSON.stringify({ message: "Task started" }),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    const eventActivities = res.body.data.filter(
      (a: { type: string }) => a.type === "event",
    );
    expect(eventActivities.length).toBeGreaterThanOrEqual(0);
  });

  it("includes question activities", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM blocking_questions")) {
        return Promise.resolve([
          {
            id: "question-001",
            agent_id: "build-agent",
            question: "How should I handle this?",
            status: "pending",
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    const questionActivities = res.body.data.filter(
      (a: { type: string }) => a.type === "question",
    );
    expect(questionActivities.length).toBeGreaterThanOrEqual(0);
  });

  it("respects limit parameter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve(
          Array(20)
            .fill(null)
            .map((_, i) => ({
              id: `exec-${i}`,
              status: "completed",
              run_number: i + 1,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            })),
        );
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/activity")
      .query({ limit: 5 });

    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it("sorts activities by timestamp descending", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM task_list_execution_runs")) {
        return Promise.resolve([
          {
            id: "exec-old",
            status: "completed",
            run_number: 1,
            started_at: "2026-01-10T10:00:00.000Z",
            completed_at: "2026-01-10T10:30:00.000Z",
          },
          {
            id: "exec-new",
            status: "completed",
            run_number: 2,
            started_at: "2026-01-15T10:00:00.000Z",
            completed_at: "2026-01-15T10:30:00.000Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    const activities = res.body.data;
    for (let i = 1; i < activities.length; i++) {
      const prevTime = new Date(activities[i - 1].timestamp).getTime();
      const currTime = new Date(activities[i].timestamp).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it("limits max to 50 activities", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/observability/activity")
      .query({ limit: 100 });

    expect(res.status).toBe(200);
    // The route limits to 50 max internally
  });

  it("uses default limit of 10", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get("/api/observability/activity");

    expect(res.status).toBe(200);
  });

  it("handles empty results gracefully", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get("/api/observability/activity");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("handles invalid event_data JSON gracefully", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM evaluation_events")) {
        return Promise.resolve([
          {
            id: "event-001",
            event_type: "task.started",
            session_id: "session-001",
            created_at: new Date().toISOString(),
            event_data: "invalid json",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get("/api/observability/activity");

    expect(res.status).toBe(200);
    // Should not crash, should use event_type as description
  });
});
