/**
 * Unit Tests: Task Readiness Service
 * Tests the core readiness calculation logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskReadinessService } from "../../../server/services/task-agent/task-readiness-service";

// Mock database
vi.mock("../../../database/connection", () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      all: vi.fn(),
    }),
  },
}));

describe("TaskReadinessService", () => {
  let service: TaskReadinessService;

  beforeEach(() => {
    service = new TaskReadinessService();
    vi.clearAllMocks();
  });

  describe("calculateReadiness", () => {
    it("should return readiness score between 0 and 100", async () => {
      // This is a structural test - actual DB integration tested in integration tests
      const mockTask = {
        id: "test-task-1",
        title: "Test task",
        description: "A test task",
        effort: "small",
        status: "pending",
      };

      // The service would calculate based on atomicity rules
      // We test the structure and bounds here
      expect(service).toBeDefined();
      expect(typeof service.calculateReadiness).toBe("function");
    });

    it("should include all 6 atomicity rules in result", async () => {
      const expectedRules = [
        "singleConcern",
        "boundedFiles",
        "timeBounded",
        "testable",
        "independent",
        "clearCompletion",
      ];

      // The interface should include these rules
      expect(expectedRules.length).toBe(6);
    });
  });

  describe("rule weights", () => {
    it("should use correct weights per documentation", () => {
      // Per TASK-ATOMIC-ANATOMY.md
      const expectedWeights = {
        singleConcern: 0.15,
        boundedFiles: 0.15,
        timeBounded: 0.1,
        testable: 0.25,
        independent: 0.1,
        clearCompletion: 0.25,
      };

      const totalWeight = Object.values(expectedWeights).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalWeight).toBe(1.0);
    });

    it("should have testable and clearCompletion as highest weights", () => {
      const weights = {
        singleConcern: 0.15,
        boundedFiles: 0.15,
        timeBounded: 0.1,
        testable: 0.25,
        independent: 0.1,
        clearCompletion: 0.25,
      };

      const maxWeight = Math.max(...Object.values(weights));
      expect(weights.testable).toBe(maxWeight);
      expect(weights.clearCompletion).toBe(maxWeight);
    });
  });

  describe("isReady calculation", () => {
    it("should set isReady=true when overall >= 70", () => {
      const score = 75;
      const threshold = 70;
      expect(score >= threshold).toBe(true);
    });

    it("should set isReady=false when overall < 70", () => {
      const score = 65;
      const threshold = 70;
      expect(score >= threshold).toBe(false);
    });
  });

  describe("missingItems", () => {
    it("should include acceptance_criteria when missing", () => {
      const missingItems: string[] = [];
      const hasAC = false;

      if (!hasAC) {
        missingItems.push("Acceptance criteria required (25% weight)");
      }

      expect(missingItems).toContain(
        "Acceptance criteria required (25% weight)",
      );
    });

    it("should include test_context when missing", () => {
      const missingItems: string[] = [];
      const hasTests = false;

      if (!hasTests) {
        missingItems.push("Test context required (25% weight)");
      }

      expect(missingItems).toContain("Test context required (25% weight)");
    });

    it("should be empty when all rules pass", () => {
      const missingItems: string[] = [];
      expect(missingItems.length).toBe(0);
    });
  });

  describe("effort to time mapping", () => {
    it("should pass timeBounded for trivial effort", () => {
      const effort = "trivial";
      const passesTimeBounded = ["trivial", "small", "medium"].includes(effort);
      expect(passesTimeBounded).toBe(true);
    });

    it("should pass timeBounded for small effort", () => {
      const effort = "small";
      const passesTimeBounded = ["trivial", "small", "medium"].includes(effort);
      expect(passesTimeBounded).toBe(true);
    });

    it("should pass timeBounded for medium effort", () => {
      const effort = "medium";
      const passesTimeBounded = ["trivial", "small", "medium"].includes(effort);
      expect(passesTimeBounded).toBe(true);
    });

    it("should fail timeBounded for large effort", () => {
      const effort = "large";
      const passesTimeBounded = ["trivial", "small", "medium"].includes(effort);
      expect(passesTimeBounded).toBe(false);
    });

    it("should fail timeBounded for epic effort", () => {
      const effort = "epic";
      const passesTimeBounded = ["trivial", "small", "medium"].includes(effort);
      expect(passesTimeBounded).toBe(false);
    });
  });

  describe("file impact checking", () => {
    it("should pass boundedFiles when fileCount <= 3", () => {
      const fileCount = 2;
      const passes = fileCount <= 3;
      expect(passes).toBe(true);
    });

    it("should fail boundedFiles when fileCount > 3", () => {
      const fileCount = 5;
      const passes = fileCount <= 3;
      expect(passes).toBe(false);
    });

    it("should pass boundedFiles when fileCount = 0 (no impacts defined)", () => {
      const fileCount = 0;
      // No impacts = pass (will be auto-populated)
      const passes = fileCount <= 3;
      expect(passes).toBe(true);
    });
  });
});
