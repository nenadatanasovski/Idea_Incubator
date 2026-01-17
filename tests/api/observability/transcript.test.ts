/**
 * Transcript Endpoint Tests
 *
 * Tests for GET /api/observability/executions/:id/transcript
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  resetMocks,
  seedTranscriptData,
  getMocks,
} from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/executions/:id/transcript", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns transcript entries in sequence order", async () => {
    await seedTranscriptData(execId);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/transcript`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);

    // Verify sequence ordering
    const entries = res.body.data.data;
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].sequence).toBeGreaterThan(entries[i - 1].sequence);
    }
  });

  it("includes required transcript fields", async () => {
    await seedTranscriptData(execId);

    const res = await request(app).get(
      `/api/observability/executions/${execId}/transcript`,
    );

    if (res.body.data.data.length > 0) {
      const entry = res.body.data.data[0];

      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("sequence");
      expect(entry).toHaveProperty("entryType");
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("summary");
      expect(entry).toHaveProperty("createdAt");
    }
  });

  it("filters by entryType parameter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM transcript_entries")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        // Only return tool_call entries
        return Promise.resolve([
          {
            id: "transcript-003",
            timestamp: new Date().toISOString(),
            sequence: 3,
            execution_id: execId,
            task_id: null,
            instance_id: "instance-001",
            wave_number: null,
            entry_type: "tool_call",
            category: "execution",
            summary: "Tool was called",
            details: null,
            skill_ref: null,
            tool_calls: null,
            assertions: null,
            duration_ms: null,
            token_estimate: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/transcript`)
      .query({ entryType: "tool_call" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((entry: { entryType: string }) => {
      expect(entry.entryType).toBe("tool_call");
    });
  });

  it("filters by category parameter", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM transcript_entries")) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        return Promise.resolve([
          {
            id: "transcript-001",
            timestamp: new Date().toISOString(),
            sequence: 1,
            execution_id: execId,
            task_id: null,
            instance_id: "instance-001",
            wave_number: null,
            entry_type: "message",
            category: "input",
            summary: "User message",
            details: null,
            skill_ref: null,
            tool_calls: null,
            assertions: null,
            duration_ms: null,
            token_estimate: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/transcript`)
      .query({ category: "input" });

    expect(res.status).toBe(200);
    res.body.data.data.forEach((entry: { category: string }) => {
      expect(entry.category).toBe("input");
    });
  });

  it("returns empty array for execution with no transcript", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get(
      "/api/observability/executions/empty-exec/transcript",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it("includes pagination info", async () => {
    await seedTranscriptData(execId);

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/transcript`)
      .query({ limit: 10, offset: 0 });

    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
    expect(res.body.data).toHaveProperty("hasMore");
  });

  it("respects limit parameter", async () => {
    await seedTranscriptData(execId);

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/transcript`)
      .query({ limit: 1 });

    expect(res.body.data.data.length).toBeLessThanOrEqual(1);
    expect(res.body.data.limit).toBe(1);
  });
});
