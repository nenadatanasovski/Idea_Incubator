/**
 * PRD Service Tests
 *
 * Unit tests for the PRD service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.3)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prdService } from "../../server/services/prd-service";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "PRD-TEST-";
const TEST_USER_ID = "test-user-prd-service";

// Helper to create test PRD with userId
async function createTestPRD(input: Parameters<typeof prdService.create>[0]) {
  return prdService.create(input, TEST_USER_ID);
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(`DELETE FROM prds WHERE title LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("PRDService", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("create", () => {
    it("should create a new PRD", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Test PRD`,
        problemStatement: "A test PRD problem statement",
      });

      expect(prd).toBeDefined();
      expect(prd.id).toBeDefined();
      expect(prd.title).toBe(`${TEST_PREFIX}Test PRD`);
      expect(prd.status).toBe("draft");
    });

    it("should create a child PRD with parent reference", async () => {
      const parent = await createTestPRD({
        title: `${TEST_PREFIX}Parent PRD`,
      });

      const child = await createTestPRD({
        title: `${TEST_PREFIX}Child PRD`,
        parentPrdId: parent.id,
      });

      expect(child.parentPrdId).toBe(parent.id);
    });
  });

  describe("getById", () => {
    it("should return a PRD by ID", async () => {
      const created = await createTestPRD({
        title: `${TEST_PREFIX}Get By ID Test`,
      });

      const found = await prdService.getById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe(`${TEST_PREFIX}Get By ID Test`);
    });

    it("should return null for non-existent ID", async () => {
      const found = await prdService.getById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("should return all PRDs", async () => {
      await createTestPRD({
        title: `${TEST_PREFIX}PRD 1`,
      });
      await createTestPRD({
        title: `${TEST_PREFIX}PRD 2`,
      });

      const prds = await prdService.list();

      expect(prds.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter by status", async () => {
      await createTestPRD({
        title: `${TEST_PREFIX}Draft PRD`,
      });
      const toApprove = await createTestPRD({
        title: `${TEST_PREFIX}Approved PRD`,
      });
      await prdService.approve(toApprove.id, TEST_USER_ID);

      const draftPrds = await prdService.list({ status: "draft" });
      const approvedPrds = await prdService.list({ status: "approved" });

      expect(draftPrds.some((p) => p.title === `${TEST_PREFIX}Draft PRD`)).toBe(
        true,
      );
      expect(
        approvedPrds.some((p) => p.title === `${TEST_PREFIX}Approved PRD`),
      ).toBe(true);
    });
  });

  describe("update", () => {
    it("should update PRD fields", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}Original Title`,
        problemStatement: "Original problem statement",
      });

      const updated = await prdService.update(prd.id, {
        title: `${TEST_PREFIX}Updated Title`,
        problemStatement: "Updated problem statement",
      });

      expect(updated.title).toBe(`${TEST_PREFIX}Updated Title`);
      expect(updated.problemStatement).toBe("Updated problem statement");
    });
  });

  describe("approve", () => {
    it("should approve a PRD", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}To Approve`,
      });

      const approved = await prdService.approve(prd.id, "test-approver");

      expect(approved.status).toBe("approved");
      expect(approved.approvedBy).toBe("test-approver");
      expect(approved.approvedAt).toBeDefined();
    });

    it("should throw when approving non-existent PRD", async () => {
      await expect(
        prdService.approve("non-existent-id", "test-user"),
      ).rejects.toThrow();
    });
  });

  describe("updateStatus", () => {
    it("should update PRD status", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}To Archive`,
      });

      const archived = await prdService.updateStatus(prd.id, "archived");

      expect(archived.status).toBe("archived");
    });
  });

  describe("getChildren", () => {
    it("should return child PRDs", async () => {
      const parent = await createTestPRD({
        title: `${TEST_PREFIX}Parent`,
      });

      await createTestPRD({
        title: `${TEST_PREFIX}Child 1`,
        parentPrdId: parent.id,
      });

      await createTestPRD({
        title: `${TEST_PREFIX}Child 2`,
        parentPrdId: parent.id,
      });

      const children = await prdService.getChildren(parent.id);

      expect(children.length).toBe(2);
    });
  });

  describe("delete", () => {
    it("should delete a PRD", async () => {
      const prd = await createTestPRD({
        title: `${TEST_PREFIX}To Delete`,
      });

      await prdService.delete(prd.id);

      const found = await prdService.getById(prd.id);
      expect(found).toBeNull();
    });
  });
});
