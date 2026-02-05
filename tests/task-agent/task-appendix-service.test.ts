/**
 * Task Appendix Service Tests
 *
 * Unit tests for the task appendix service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.2)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { taskAppendixService } from "../../server/services/task-agent/task-appendix-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "APPENDIX-TEST-";

// Create test task
async function createTestTask(): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [taskId, `${TEST_PREFIX}${taskId.slice(0, 8)}`, `${TEST_PREFIX}Test Task`],
  );
  await saveDb();
  return taskId;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM task_appendices WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`,
  );
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("TaskAppendixService", () => {
  let testTaskId: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
    testTaskId = await createTestTask();
  });

  describe("create", () => {
    it("should add an appendix with inline content", async () => {
      const appendix = await taskAppendixService.create({
        taskId: testTaskId,
        appendixType: "code_context",
        content: 'router.get("/api/test", async (req, res) => { ... })',
      });

      expect(appendix).toBeDefined();
      expect(appendix.id).toBeDefined();
      expect(appendix.taskId).toBe(testTaskId);
      expect(appendix.appendixType).toBe("code_context");
      expect(appendix.content).toBeDefined();
    });

    it("should add an appendix with reference content", async () => {
      const appendix = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "references",
        referenceId: "docs/api.md#authentication",
      });

      expect(appendix.referenceId).toBe("docs/api.md#authentication");
    });

    it("should add appendices of all 11 types", async () => {
      const types = [
        "code_context",
        "research_notes",
        "gotcha",
        "rollback_plan",
        "related_tasks",
        "references",
        "decision_log",
        "discovery",
        "config",
        "snippet",
        "test_data",
      ];

      for (const type of types) {
        const appendix = await taskAppendixService.create({ taskId: testTaskId,
          appendixType: type as any,
          content: `Content for ${type}`,
        });

        expect(appendix.appendixType).toBe(type);
      }

      const appendices = await taskAppendixService.getByTaskId(testTaskId);
      expect(appendices.length).toBe(11);
    });
  });

  describe("getByTaskId", () => {
    it("should return appendices in sort order", async () => {
      await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "gotcha",
        content: "Content 1",
      });

      await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "gotcha",
        content: "Content 2",
      });

      const appendices = await taskAppendixService.getByTaskId(testTaskId);

      expect(appendices.length).toBe(2);
      expect(appendices[0].sortOrder).toBeLessThan(appendices[1].sortOrder);
    });
  });

  describe("updateAppendix", () => {
    it("should update appendix content", async () => {
      const appendix = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "research_notes",
        content: "Original content",
      });

      const updated = await taskAppendixService.updateAppendix(appendix.id, {
        content: "Updated content",
      });

      expect(updated.metadata?.title).toBe("Updated Title");
      expect(updated.content).toBe("Updated content");
    });
  });

  describe("removeAppendix", () => {
    it("should remove an appendix", async () => {
      const appendix = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "discovery",
        content: "Will be deleted",
      });

      await taskAppendixService.removeAppendix(appendix.id);

      const appendices = await taskAppendixService.getByTaskId(testTaskId);
      expect(appendices.length).toBe(0);
    });
  });

  describe("reorderAppendices", () => {
    it("should reorder appendices", async () => {
      const a1 = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "gotcha",
        content: "Content 1",
      });

      const a2 = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "gotcha",
        content: "Content 2",
      });

      await taskAppendixService.reorderAppendices(testTaskId, [a2.id, a1.id]);

      const appendices = await taskAppendixService.getByTaskId(testTaskId);

      expect(appendices[0].id).toBe(a2.id);
      expect(appendices[1].id).toBe(a1.id);
    });
  });

  describe("resolve", () => {
    it("should resolve inline content directly", async () => {
      const appendix = await taskAppendixService.create({ taskId: testTaskId,
        appendixType: "snippet",
        content: "const x = 1;",
      });

      const resolved = await taskAppendixService.resolve(appendix.id);

      expect(resolved.content).toBe("const x = 1;");
      expect(resolved.resolvedAt).toBeDefined();
    });
  });
});
