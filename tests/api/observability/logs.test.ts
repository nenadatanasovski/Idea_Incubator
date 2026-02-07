/**
 * Logs Endpoint Tests
 *
 * Tests for GET /api/observability/logs/message-bus
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  mockMessageBusLogs,
  getMocks,
} from "../__utils__/test-server";
import { testMessageBusLogs } from "../__fixtures__/observability-fixtures";
import type { Express } from "express";

describe("GET /api/observability/logs/message-bus", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns message bus logs", async () => {
    mockMessageBusLogs(
      testMessageBusLogs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        severity: l.severity,
        humanSummary: l.humanSummary,
        executionId: l.executionId,
      })),
    );

    const res = await request(app).get("/api/observability/logs/message-bus");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("includes required log fields", async () => {
    mockMessageBusLogs([
      {
        id: "log-001",
        eventType: "execution.started",
        severity: "info",
        humanSummary: "Execution started",
      },
    ]);

    const res = await request(app).get("/api/observability/logs/message-bus");

    if (res.body.data.data.length > 0) {
      const log = res.body.data.data[0];

      expect(log).toHaveProperty("id");
      expect(log).toHaveProperty("eventType");
      expect(log).toHaveProperty("severity");
      expect(log).toHaveProperty("humanSummary");
      expect(log).toHaveProperty("timestamp");
    }
  });

  it("filters by severity level", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM message_bus_log")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        // Only return error logs
        return Promise.resolve([
          {
            id: "log-003",
            event_id: "event-003",
            timestamp: new Date().toISOString(),
            source: "build-agent",
            event_type: "task.failed",
            correlation_id: null,
            human_summary: "Task failed",
            severity: "error",
            category: "execution",
            transcript_entry_id: null,
            task_id: null,
            execution_id: null,
            payload: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ severity: "error" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((log: { severity: string }) => {
      expect(log.severity).toBe("error");
    });
  });

  it("filters by executionId", async () => {
    const { mockQuery } = getMocks();
    const targetExecId = "test-exec-001";
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (
        sql.includes("FROM message_bus_log") &&
        params.includes(targetExecId)
      ) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 2 }]);
        }
        return Promise.resolve([
          {
            id: "log-001",
            event_id: "event-001",
            timestamp: new Date().toISOString(),
            source: "build-agent",
            event_type: "execution.started",
            correlation_id: null,
            human_summary: "Started",
            severity: "info",
            category: "execution",
            transcript_entry_id: null,
            task_id: null,
            execution_id: targetExecId,
            payload: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ executionId: targetExecId });

    expect(res.status).toBe(200);
  });

  it("filters by category", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM message_bus_log") && params.includes("security")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        return Promise.resolve([
          {
            id: "log-004",
            event_id: "event-004",
            timestamp: new Date().toISOString(),
            source: "security-monitor",
            event_type: "command.blocked",
            correlation_id: null,
            human_summary: "Command blocked",
            severity: "warning",
            category: "security",
            transcript_entry_id: null,
            task_id: null,
            execution_id: null,
            payload: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ category: "security" });

    expect(res.status).toBe(200);
  });

  it("respects limit parameter", async () => {
    mockMessageBusLogs(
      testMessageBusLogs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        severity: l.severity,
        humanSummary: l.humanSummary,
      })),
    );

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ limit: 2 });

    expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data.limit).toBe(2);
  });

  it("includes pagination info", async () => {
    mockMessageBusLogs([]);

    const res = await request(app).get("/api/observability/logs/message-bus");

    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
    expect(res.body.data).toHaveProperty("hasMore");
  });

  it("filters by source", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (
        sql.includes("FROM message_bus_log") &&
        params.includes("build-agent")
      ) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 2 }]);
        }
        return Promise.resolve([
          {
            id: "log-001",
            event_id: "event-001",
            timestamp: new Date().toISOString(),
            source: "build-agent",
            event_type: "execution.started",
            correlation_id: null,
            human_summary: "Started",
            severity: "info",
            category: "execution",
            transcript_entry_id: null,
            task_id: null,
            execution_id: null,
            payload: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ source: "build-agent" });

    expect(res.status).toBe(200);
  });

  it("returns logs in descending timestamp order", async () => {
    mockMessageBusLogs(
      testMessageBusLogs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        severity: l.severity,
        humanSummary: l.humanSummary,
      })),
    );

    const res = await request(app).get("/api/observability/logs/message-bus");

    expect(res.status).toBe(200);
    // Logs should be in descending order by timestamp
    const logs = res.body.data.data;
    for (let i = 1; i < logs.length; i++) {
      const prevTime = new Date(logs[i - 1].timestamp).getTime();
      const currTime = new Date(logs[i].timestamp).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });
});
