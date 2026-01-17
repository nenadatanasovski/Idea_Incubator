/**
 * Health Endpoint Tests
 *
 * Tests for GET /api/observability/health
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  mockHealth,
} from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/health", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns 200 with health status", async () => {
    mockHealth({
      failedRecent: 0,
      blockedAgents: 0,
      staleQuestions: 0,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("status");
    expect(["healthy", "degraded", "critical"]).toContain(res.body.data.status);
  });

  it("returns healthy status when no issues", async () => {
    mockHealth({
      failedRecent: 0,
      blockedAgents: 0,
      staleQuestions: 0,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data.status).toBe("healthy");
    expect(res.body.data.issues).toEqual([]);
  });

  it("returns degraded status with minor issues", async () => {
    mockHealth({
      failedRecent: 1,
      blockedAgents: 1,
      staleQuestions: 1,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data.status).toBe("degraded");
    expect(res.body.data.issues.length).toBeGreaterThan(0);
  });

  it("returns critical status with major issues", async () => {
    mockHealth({
      failedRecent: 5,
      blockedAgents: 4,
      staleQuestions: 10,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data.status).toBe("critical");
    expect(res.body.data.issues.length).toBeGreaterThan(0);
  });

  it("includes metrics object", async () => {
    mockHealth({
      failedRecent: 2,
      blockedAgents: 1,
      staleQuestions: 3,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data).toHaveProperty("metrics");
    expect(res.body.data.metrics).toHaveProperty("failedExecutionsLastHour");
    expect(res.body.data.metrics).toHaveProperty("blockedAgents");
    expect(res.body.data.metrics).toHaveProperty("staleQuestions");
  });

  it("includes timestamp", async () => {
    mockHealth({});

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data).toHaveProperty("lastUpdated");
    expect(new Date(res.body.data.lastUpdated).getTime()).not.toBeNaN();
  });

  it("issues array contains descriptive messages", async () => {
    mockHealth({
      failedRecent: 3,
      blockedAgents: 0,
      staleQuestions: 0,
    });

    const res = await request(app).get("/api/observability/health");

    expect(res.body.data.issues.length).toBeGreaterThan(0);
    expect(typeof res.body.data.issues[0]).toBe("string");
    expect(res.body.data.issues[0]).toContain("failed");
  });
});
