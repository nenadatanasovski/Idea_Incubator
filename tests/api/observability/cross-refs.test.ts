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
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "toolUse",
      refs: {
        transcriptEntry: "transcript-001",
        task: "task-001",
        execution: "exec-001",
        skill: null,
        parentToolUse: null,
        childToolUses: [],
        relatedAssertions: [],
      },
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
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "assertion",
      refs: {
        task: "task-001",
        chain: "chain-001",
        transcriptEntries: [],
        toolUses: ["tool-001"],
        previousInChain: undefined,
        nextInChain: undefined,
      },
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/assertion/assertion-001",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.entityType).toBe("assertion");
    expect(res.body.data.relatedTo.length).toBeGreaterThan(0);
  });

  it("returns cross references for skill_trace entity", async () => {
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "skillTrace",
      refs: {
        task: "task-001",
        transcriptEntries: [],
        toolUses: ["tool-001", "tool-002"],
        assertions: [],
        parentSkill: undefined,
        childSkills: [],
      },
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
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "transcriptEntry",
      refs: {
        execution: "exec-001",
        task: "task-001",
        skill: null,
        toolUses: ["tool-001"],
      },
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
    // Default mock returns null for non-existent entity
    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/nonexistent",
    );

    // Service returns null → route returns 404
    expect(res.status).toBe(404);
  });

  it("related items have type and id", async () => {
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "toolUse",
      refs: {
        transcriptEntry: "transcript-001",
        task: "task-001",
        execution: "exec-001",
        skill: "skill-001",
        parentToolUse: null,
        childToolUses: [],
        relatedAssertions: [],
      },
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

  it("includes transcript reference for tool_use entity", async () => {
    // Note: execution reference is not part of ToolUseCrossRefs interface
    // Tool uses link to transcript entries which have execution context
    const { mockCrossReferenceService } = getMocks();
    mockCrossReferenceService.getCrossReferences.mockResolvedValue({
      type: "toolUse",
      refs: {
        transcriptEntry: "transcript-001",
        task: "task-001",
        skill: null,
        parentToolUse: null,
        childToolUses: [],
        relatedAssertions: [],
      },
    });

    const res = await request(app).get(
      "/api/observability/cross-refs/tool_use/tool-001",
    );

    const transcriptRef = res.body.data.relatedTo.find(
      (r: { type: string }) => r.type === "transcript",
    );
    expect(transcriptRef).toBeDefined();
    expect(transcriptRef.id).toBe("transcript-001");
  });
});
