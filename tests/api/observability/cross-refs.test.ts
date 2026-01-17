/**
 * Cross References Endpoint Tests
 *
 * Tests for GET /api/observability/cross-refs/:entityType/:entityId
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, getMocks } from "../__utils__/test-server";
import type { Express } from "express";

describe("GET /api/observability/cross-refs/:entityType/:entityId", () => {
  let app: Express;

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns cross references for tool_use entity", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM tool_uses WHERE id = ?")) {
        return Promise.resolve([
          {
            transcript_entry_id: "transcript-001",
            task_id: "task-001",
            within_skill: null,
            execution_id: "exec-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/tool-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("entityType", "tool_use");
    expect(res.body.data).toHaveProperty("entityId", "tool-001");
    expect(res.body.data).toHaveProperty("relatedTo");
    expect(Array.isArray(res.body.data.relatedTo)).toBe(true);
  });

  it("returns cross references for assertion entity", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM assertion_results WHERE id = ?")) {
        return Promise.resolve([
          {
            task_id: "task-001",
            execution_id: "exec-001",
            chain_id: "chain-001",
            transcript_entry_id: null,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/assertion/assertion-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.entityType).toBe("assertion");
    expect(res.body.data.relatedTo.length).toBeGreaterThan(0);
  });

  it("returns cross references for skill_trace entity", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM skill_traces WHERE id = ?")) {
        return Promise.resolve([
          {
            execution_id: "exec-001",
            task_id: "task-001",
            tool_calls: JSON.stringify(["tool-001", "tool-002"]),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/skill_trace/skill-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.entityType).toBe("skill_trace");
    expect(res.body.data.relatedTo.length).toBeGreaterThan(0);
    // Should include tool use references from tool_calls
    const toolRefs = res.body.data.relatedTo.filter(
      (r: { type: string }) => r.type === "tool_use",
    );
    expect(toolRefs.length).toBeGreaterThan(0);
  });

  it("returns cross references for transcript entity", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM transcript_entries WHERE id = ?")) {
        return Promise.resolve([
          {
            execution_id: "exec-001",
            task_id: "task-001",
            skill_ref: null,
            tool_calls: JSON.stringify([{ toolUseId: "tool-001" }]),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/transcript/transcript-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.entityType).toBe("transcript");
  });

  it("returns 400 for unknown entity type", async () => {
    const res = await request(app).get(
      "/api/observability/cross-refs/unknown_type/some-id",
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Unknown entity type");
  });

  it("returns empty relatedTo for non-existent entity", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockResolvedValue([]);

    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/nonexistent",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.relatedTo).toEqual([]);
  });

  it("related items have type and id", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM tool_uses WHERE id = ?")) {
        return Promise.resolve([
          {
            transcript_entry_id: "transcript-001",
            task_id: "task-001",
            within_skill: "skill-001",
            execution_id: "exec-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/tool-001",
    );

    res.body.data.relatedTo.forEach((related: { type: string; id: string }) => {
      expect(related).toHaveProperty("type");
      expect(related).toHaveProperty("id");
      expect(typeof related.type).toBe("string");
      expect(typeof related.id).toBe("string");
    });
  });

  it("includes execution reference in all entity types", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM tool_uses WHERE id = ?")) {
        return Promise.resolve([
          {
            transcript_entry_id: "transcript-001",
            task_id: null,
            within_skill: null,
            execution_id: "exec-001",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/tool-001",
    );

    const execRef = res.body.data.relatedTo.find(
      (r: { type: string }) => r.type === "execution",
    );
    expect(execRef).toBeDefined();
    expect(execRef.id).toBe("exec-001");
  });
});
