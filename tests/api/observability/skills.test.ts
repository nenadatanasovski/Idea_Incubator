/**
 * Skills Endpoint Tests
 *
 * Tests for GET /api/observability/executions/:id/skills
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, resetMocks, getMocks, mockSkillTraces } from "../__utils__/test-server";
import { testSkillTraces } from "../__fixtures__/observability-fixtures";
import type { Express } from "express";

describe("GET /api/observability/executions/:id/skills", () => {
  let app: Express;
  const execId = "test-exec-001";

  beforeEach(async () => {
    resetMocks();
    app = await createTestApp();
  });

  afterEach(() => {
    resetMocks();
  });

  it("returns skill traces for execution", async () => {
    const { mockQuery } = getMocks();
    const skillsForExec = testSkillTraces.filter(
      (s) => s.executionId === execId,
    );

    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM skill_traces") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: skillsForExec.length }]);
        }
        return Promise.resolve(
          skillsForExec.map((s) => ({
            id: s.id,
            execution_id: s.executionId,
            task_id: s.taskId,
            skill_name: s.skillName,
            skill_file: s.skillFile,
            line_number: s.lineNumber,
            section_title: s.sectionTitle,
            input_summary: s.inputSummary,
            output_summary: s.outputSummary,
            start_time: s.startTime,
            end_time: s.endTime,
            duration_ms: s.durationMs,
            token_estimate: s.tokenEstimate,
            status: s.status,
            error_message: s.errorMessage,
            tool_calls: null,
            sub_skills: null,
            created_at: s.startTime,
          })),
        );
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/skills`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("includes required skill trace fields", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM skill_traces") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 1 }]);
        }
        return Promise.resolve([
          {
            id: "skill-001",
            execution_id: execId,
            task_id: "task-001",
            skill_name: "code-generator",
            skill_file: "agents/skills/code-generator.ts",
            line_number: 42,
            section_title: "Generate Code",
            input_summary: "Generating implementation",
            output_summary: "Generated 50 lines",
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_ms: 1000,
            token_estimate: 500,
            status: "completed",
            error_message: null,
            tool_calls: null,
            sub_skills: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/skills`,
    );

    if (res.body.data.data.length > 0) {
      const skill = res.body.data.data[0];

      expect(skill).toHaveProperty("id");
      expect(skill).toHaveProperty("executionId");
      expect(skill).toHaveProperty("skillName");
      expect(skill).toHaveProperty("skillFile");
      expect(skill).toHaveProperty("status");
      expect(skill).toHaveProperty("startTime");
    }
  });

  it("returns skills in start_time order", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes("FROM skill_traces") && params.includes(execId)) {
        if (sql.includes("COUNT(*)")) {
          return Promise.resolve([{ count: 2 }]);
        }
        return Promise.resolve([
          {
            id: "skill-001",
            execution_id: execId,
            task_id: "task-001",
            skill_name: "first-skill",
            skill_file: "skills/first.ts",
            line_number: null,
            section_title: null,
            input_summary: null,
            output_summary: null,
            start_time: "2026-01-15T10:00:00.000Z",
            end_time: "2026-01-15T10:00:01.000Z",
            duration_ms: 1000,
            token_estimate: null,
            status: "completed",
            error_message: null,
            tool_calls: null,
            sub_skills: null,
            created_at: "2026-01-15T10:00:00.000Z",
          },
          {
            id: "skill-002",
            execution_id: execId,
            task_id: "task-001",
            skill_name: "second-skill",
            skill_file: "skills/second.ts",
            line_number: null,
            section_title: null,
            input_summary: null,
            output_summary: null,
            start_time: "2026-01-15T10:00:02.000Z",
            end_time: "2026-01-15T10:00:03.000Z",
            duration_ms: 1000,
            token_estimate: null,
            status: "completed",
            error_message: null,
            tool_calls: null,
            sub_skills: null,
            created_at: "2026-01-15T10:00:02.000Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/skills`,
    );

    expect(res.status).toBe(200);
    const skills = res.body.data.data;
    for (let i = 1; i < skills.length; i++) {
      const prevTime = new Date(skills[i - 1].startTime).getTime();
      const currTime = new Date(skills[i].startTime).getTime();
      expect(prevTime).toBeLessThanOrEqual(currTime);
    }
  });

  it("includes pagination info", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: 0 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      `/api/observability/executions/${execId}/skills`,
    );

    expect(res.body.data).toHaveProperty("total");
    expect(res.body.data).toHaveProperty("limit");
    expect(res.body.data).toHaveProperty("offset");
    expect(res.body.data).toHaveProperty("hasMore");
  });

  it("respects limit parameter", async () => {
    // Create 5 skill traces
    mockSkillTraces(execId, [
      { id: "s-1", skillName: "skill-1", status: "completed" },
      { id: "s-2", skillName: "skill-2", status: "completed" },
      { id: "s-3", skillName: "skill-3", status: "completed" },
      { id: "s-4", skillName: "skill-4", status: "completed" },
      { id: "s-5", skillName: "skill-5", status: "completed" },
    ]);

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/skills`)
      .query({ limit: 1 });

    expect(res.body.data.data.length).toBeLessThanOrEqual(1);
    expect(res.body.data.limit).toBe(1);
  });

  it("returns empty array for execution with no skills", async () => {
    const { mockQuery } = getMocks();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: 0 }]);
      }
      return Promise.resolve([]);
    });

    const res = await request(app).get(
      "/api/observability/executions/empty-exec/skills",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });
});
