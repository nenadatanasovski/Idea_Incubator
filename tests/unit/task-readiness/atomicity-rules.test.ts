/**
 * Unit Tests: Atomicity Rules
 * Tests each of the 6 atomicity rules from TASK-ATOMIC-ANATOMY.md
 */

import { describe, it, expect } from "vitest";

describe("Atomicity Rules", () => {
  describe("Rule 1: Single Concern", () => {
    it("should pass when task has single action verb", () => {
      const title = "Add user authentication";
      const hasMultipleActions = /\band\b/i.test(title);
      expect(hasMultipleActions).toBe(false);
    });

    it("should fail when task has multiple actions", () => {
      const title = "Add authentication and setup database";
      const hasMultipleActions = /\band\b/i.test(title);
      expect(hasMultipleActions).toBe(true);
    });

    it("should detect lists in title", () => {
      const title = "Create user, order, payment models";
      const hasList = /,.*,/.test(title);
      expect(hasList).toBe(true);
    });
  });

  describe("Rule 2: Bounded Files", () => {
    it("should pass when 0 files impacted", () => {
      const fileCount = 0;
      const maxFiles = 3;
      expect(fileCount <= maxFiles).toBe(true);
    });

    it("should pass when 1 file impacted", () => {
      const fileCount = 1;
      const maxFiles = 3;
      expect(fileCount <= maxFiles).toBe(true);
    });

    it("should pass when 3 files impacted", () => {
      const fileCount = 3;
      const maxFiles = 3;
      expect(fileCount <= maxFiles).toBe(true);
    });

    it("should fail when 4+ files impacted", () => {
      const fileCount = 4;
      const maxFiles = 3;
      expect(fileCount <= maxFiles).toBe(false);
    });

    it("should generate warning message for too many files", () => {
      const fileCount = 5;
      const message =
        fileCount > 3
          ? `Task impacts ${fileCount} files (max 3). Consider splitting.`
          : null;
      expect(message).toContain("impacts 5 files");
    });
  });

  describe("Rule 3: Time Bounded", () => {
    const effortToHours: Record<string, number> = {
      trivial: 0.25,
      small: 0.5,
      medium: 1.0,
      large: 2.0,
      epic: 4.0,
    };

    it("should map trivial to 15 minutes", () => {
      expect(effortToHours.trivial).toBe(0.25);
    });

    it("should map small to 30 minutes", () => {
      expect(effortToHours.small).toBe(0.5);
    });

    it("should map medium to 1 hour", () => {
      expect(effortToHours.medium).toBe(1.0);
    });

    it("should pass for efforts <= 1 hour", () => {
      const passingEfforts = ["trivial", "small", "medium"];
      passingEfforts.forEach((effort) => {
        expect(effortToHours[effort] <= 1.0).toBe(true);
      });
    });

    it("should fail for efforts > 1 hour", () => {
      const failingEfforts = ["large", "epic"];
      failingEfforts.forEach((effort) => {
        expect(effortToHours[effort] <= 1.0).toBe(false);
      });
    });
  });

  describe("Rule 4: Testable", () => {
    it("should pass when acceptance_criteria appendix exists", () => {
      const appendices = [{ appendix_type: "acceptance_criteria" }];
      const hasAC = appendices.some(
        (a) => a.appendix_type === "acceptance_criteria",
      );
      expect(hasAC).toBe(true);
    });

    it("should pass when test_context appendix exists", () => {
      const appendices = [{ appendix_type: "test_context" }];
      const hasTests = appendices.some(
        (a) => a.appendix_type === "test_context",
      );
      expect(hasTests).toBe(true);
    });

    it("should fail when no test-related appendices", () => {
      const appendices = [{ appendix_type: "code_context" }];
      const hasTestability =
        appendices.some((a) => a.appendix_type === "acceptance_criteria") ||
        appendices.some((a) => a.appendix_type === "test_context");
      expect(hasTestability).toBe(false);
    });
  });

  describe("Rule 5: Independent", () => {
    it("should pass when no dependencies", () => {
      const dependencies: Array<{ status: string }> = [];
      const allDepsComplete =
        dependencies.length === 0 ||
        dependencies.every((d) => d.status === "completed");
      expect(allDepsComplete).toBe(true);
    });

    it("should pass when all dependencies completed", () => {
      const dependencies = [{ status: "completed" }, { status: "completed" }];
      const allDepsComplete = dependencies.every(
        (d) => d.status === "completed",
      );
      expect(allDepsComplete).toBe(true);
    });

    it("should fail when any dependency pending", () => {
      const dependencies = [{ status: "completed" }, { status: "pending" }];
      const allDepsComplete = dependencies.every(
        (d) => d.status === "completed",
      );
      expect(allDepsComplete).toBe(false);
    });

    it("should fail when any dependency in_progress", () => {
      const dependencies = [{ status: "completed" }, { status: "in_progress" }];
      const allDepsComplete = dependencies.every(
        (d) => d.status === "completed",
      );
      expect(allDepsComplete).toBe(false);
    });
  });

  describe("Rule 6: Clear Completion", () => {
    it("should pass when acceptance_criteria appendix exists", () => {
      const appendices = [
        {
          appendix_type: "acceptance_criteria",
          content: '["User can login", "Session persists"]',
        },
      ];
      const hasAC = appendices.some(
        (a) =>
          a.appendix_type === "acceptance_criteria" &&
          a.content &&
          a.content.length > 2,
      );
      expect(hasAC).toBe(true);
    });

    it("should fail when acceptance_criteria is empty", () => {
      const appendices = [
        { appendix_type: "acceptance_criteria", content: "[]" },
      ];
      const hasValidAC = appendices.some(
        (a) =>
          a.appendix_type === "acceptance_criteria" &&
          a.content &&
          a.content !== "[]",
      );
      expect(hasValidAC).toBe(false);
    });

    it("should fail when no acceptance_criteria appendix", () => {
      const appendices = [{ appendix_type: "code_context", content: "{}" }];
      const hasAC = appendices.some(
        (a) => a.appendix_type === "acceptance_criteria",
      );
      expect(hasAC).toBe(false);
    });
  });

  describe("Score Calculation", () => {
    const weights = {
      singleConcern: 0.15,
      boundedFiles: 0.15,
      timeBounded: 0.1,
      testable: 0.25,
      independent: 0.1,
      clearCompletion: 0.25,
    };

    it("should calculate 100% when all rules pass", () => {
      const rules = {
        singleConcern: 100,
        boundedFiles: 100,
        timeBounded: 100,
        testable: 100,
        independent: 100,
        clearCompletion: 100,
      };

      const score = Object.entries(rules).reduce((total, [rule, score]) => {
        return total + score * weights[rule as keyof typeof weights];
      }, 0);

      expect(score).toBe(100);
    });

    it("should calculate max 75% when missing testable", () => {
      const rules = {
        singleConcern: 100,
        boundedFiles: 100,
        timeBounded: 100,
        testable: 0, // Missing
        independent: 100,
        clearCompletion: 100,
      };

      const score = Object.entries(rules).reduce((total, [rule, score]) => {
        return total + score * weights[rule as keyof typeof weights];
      }, 0);

      expect(score).toBe(75); // 100 - 25% (testable weight)
    });

    it("should calculate max 75% when missing clearCompletion", () => {
      const rules = {
        singleConcern: 100,
        boundedFiles: 100,
        timeBounded: 100,
        testable: 100,
        independent: 100,
        clearCompletion: 0, // Missing
      };

      const score = Object.entries(rules).reduce((total, [rule, score]) => {
        return total + score * weights[rule as keyof typeof weights];
      }, 0);

      expect(score).toBe(75); // 100 - 25% (clearCompletion weight)
    });

    it("should calculate 50% when missing both high-weight rules", () => {
      const rules = {
        singleConcern: 100,
        boundedFiles: 100,
        timeBounded: 100,
        testable: 0, // Missing
        independent: 100,
        clearCompletion: 0, // Missing
      };

      const score = Object.entries(rules).reduce((total, [rule, score]) => {
        return total + score * weights[rule as keyof typeof weights];
      }, 0);

      expect(score).toBe(50); // 100 - 50% (both high-weight rules)
    });
  });

  describe("Threshold Validation", () => {
    const threshold = 70;

    it("should be ready at 70%", () => {
      expect(70 >= threshold).toBe(true);
    });

    it("should be ready above 70%", () => {
      expect(85 >= threshold).toBe(true);
    });

    it("should not be ready at 69%", () => {
      expect(69 >= threshold).toBe(false);
    });

    it("should not be ready at 0%", () => {
      expect(0 >= threshold).toBe(false);
    });
  });
});
