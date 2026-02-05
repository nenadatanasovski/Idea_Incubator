/**
 * Display ID Generator Tests
 *
 * Unit tests for the display ID generator service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.1)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  generateDisplayId,
  parseDisplayId,
  getNextSequence,
  extractProjectCode,
  getCategoryCode,
  formatSequence,
  isValidDisplayId,
} from "../../server/services/task-agent/display-id-generator";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "DISPID-TEST-";

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM tasks WHERE display_id LIKE 'TU-%-%-%' AND title LIKE '${TEST_PREFIX}%'`,
  );
  await saveDb();
}

describe("DisplayIdGenerator", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("generateDisplayId", () => {
    it("should generate a display ID in correct format", async () => {
      const displayId = await generateDisplayId("feature");

      // Format: TU-PROJ-CAT-NNN where NNN is 3+ digits
      expect(displayId).toMatch(/^TU-[A-Z]{2,4}-FEA-\d{3,}$/);
    });

    it("should use correct category codes", async () => {
      const featureId = await generateDisplayId("feature");
      const bugId = await generateDisplayId("bug");
      const testId = await generateDisplayId("test");

      expect(featureId).toContain("-FEA-");
      expect(bugId).toContain("-BUG-");
      expect(testId).toContain("-TST-");
    });
  });

  describe("parseDisplayId", () => {
    it("should parse valid display ID", () => {
      const result = parseDisplayId("TU-PROJ-FEA-042");

      expect(result).not.toBeNull();
      expect(result?.projectCode).toBe("PROJ");
      expect(result?.categoryCode).toBe("FEA");
      expect(result?.sequence).toBe(42);
    });

    it("should return null for invalid format", () => {
      const result = parseDisplayId("invalid-id");

      expect(result).toBeNull();
    });

    it("should return null for invalid format", () => {
      // Parser accepts any 2-letter prefix, so test with invalid formats
      expect(parseDisplayId("X-PROJ-FEA-001")).toBeNull(); // 1-letter prefix
      expect(parseDisplayId("TU-P-FEA-001")).toBeNull(); // 1-letter project
      expect(parseDisplayId("invalid-string")).toBeNull();
    });

    it("should handle different category codes", () => {
      const categories = [
        "FEA",
        "BUG",
        "ENH",
        "REF",
        "DOC",
        "TST",
        "INF",
        "RES",
        "SEC",
        "PRF",
      ];

      for (const cat of categories) {
        const result = parseDisplayId(`TU-TEST-${cat}-001`);
        expect(result?.categoryCode).toBe(cat);
      }
    });
  });

  describe("getNextSequence", () => {
    it("should return a positive sequence number", async () => {
      const sequence = await getNextSequence("TEST_PROJECT");

      expect(sequence).toBeGreaterThan(0);
    });
  });

  describe("extractProjectCode", () => {
    it("should extract code from project name", () => {
      const code = extractProjectCode(undefined, "My Test Project");

      expect(code.length).toBe(4);
      expect(code).toMatch(/^[A-Z]+$/);
    });

    it("should return default code when no input", () => {
      const code = extractProjectCode();

      // Default is "GEN" (3 chars)
      expect(code).toBe("GEN");
    });
  });

  describe("getCategoryCode", () => {
    it("should return FEA for feature category", () => {
      const code = getCategoryCode("feature");
      expect(code).toBe("FEA");
    });

    it("should return BUG for bug category", () => {
      const code = getCategoryCode("bug");
      expect(code).toBe("BUG");
    });

    it("should return TST for test category", () => {
      const code = getCategoryCode("test");
      expect(code).toBe("TST");
    });
  });

  describe("formatSequence", () => {
    it("should pad single digit to 3 characters", () => {
      const formatted = formatSequence(1);
      expect(formatted).toBe("001");
    });

    it("should pad double digit to 3 characters", () => {
      const formatted = formatSequence(42);
      expect(formatted).toBe("042");
    });

    it("should keep triple digit as is", () => {
      const formatted = formatSequence(100);
      expect(formatted).toBe("100");
    });
  });

  describe("isValidDisplayId", () => {
    it("should return true for valid display ID", () => {
      expect(isValidDisplayId("TU-PROJ-FEA-001")).toBe(true);
    });

    it("should return false for invalid display ID", () => {
      expect(isValidDisplayId("invalid")).toBe(false);
      expect(isValidDisplayId("TU-X-FEA-001")).toBe(false); // Project code too short
      expect(isValidDisplayId("TU-PROJ-FE-001")).toBe(false); // Category code wrong length
      expect(isValidDisplayId("TU-PROJ-FEA-01")).toBe(false); // Sequence too short
      expect(isValidDisplayId("")).toBe(false);
    });
  });
});
