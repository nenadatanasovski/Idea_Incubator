/**
 * Stats Endpoint Tests
 *
 * Tests for GET /api/observability/stats
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, mockStats } from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/stats", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns 200 with valid stats object", async () => {
    mockStats({
      activeExecutions: 2,
      blockedAgents: 0,
      pendingQuestions: 1,
      requestCount: 150,
    });

    const res = await request(app).get("/api/observability/stats");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("activeExecutions");
    expect(res.body.data).toHaveProperty("errorRate");
    expect(res.body.data).toHaveProperty("blockedAgents");
    expect(res.body.data).toHaveProperty("pendingQuestions");
    expect(res.body.data).toHaveProperty("requestCount");
    expect(res.body.data).toHaveProperty("lastUpdated");
  });

  it("stats values are non-negative numbers", async () => {
    mockStats({
      activeExecutions: 5,
      blockedAgents: 2,
      pendingQuestions: 3,
    });

    const res = await request(app).get("/api/observability/stats");

    expect(res.body.data.activeExecutions).toBeGreaterThanOrEqual(0);
    expect(res.body.data.blockedAgents).toBeGreaterThanOrEqual(0);
    expect(res.body.data.pendingQuestions).toBeGreaterThanOrEqual(0);
  });

  it("returns correct content-type", async () => {
    mockStats({});

    const res = await request(app).get("/api/observability/stats");

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("error rate is a formatted percentage string", async () => {
    mockStats({ activeExecutions: 1 });

    const res = await request(app).get("/api/observability/stats");

    expect(typeof res.body.data.errorRate).toBe("string");
    expect(res.body.data.errorRate).toMatch(/^\d+(\.\d+)?%$/);
  });

  it("lastUpdated is a valid ISO timestamp", async () => {
    mockStats({});

    const res = await request(app).get("/api/observability/stats");

    expect(res.body.data.lastUpdated).toBeDefined();
    expect(new Date(res.body.data.lastUpdated).getTime()).not.toBeNaN();
  });

  it("handles empty database gracefully", async () => {
    // Default mock returns empty arrays
    resetMocks();

    const res = await request(app).get("/api/observability/stats");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeExecutions).toBe(0);
    expect(res.body.data.blockedAgents).toBe(0);
    expect(res.body.data.pendingQuestions).toBe(0);
  });
});
