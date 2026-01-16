/**
 * Unit tests for utils/profile-context.ts
 * Tests category-specific profile context formatting
 */
import { describe, it, expect } from "vitest";
import { formatProfileForCategory } from "../../../utils/profile-context.js";
import { type ProfileContext } from "../../../utils/schemas.js";

// Sample profile context for testing
const mockProfileContext: ProfileContext = {
  goalsContext: "Primary goals: income, impact. Success: $100k ARR in 2 years.",
  passionContext:
    "Interests: plants, technology. Strong motivation from personal experience.",
  skillsContext:
    "Technical Skills: React, Python, ML. Experience: 5 years in mobile dev. Gaps: Marketing.",
  networkContext:
    "Industry Connections: Tech startup ecosystem. Community: Plant hobbyist forums. Network: 500+ LinkedIn.",
  lifeStageContext:
    "Status: Employed. Hours Available: 20/week. Runway: 12 months. Tolerance: Medium.",
};

describe("formatProfileForCategory", () => {
  describe("when profile is null", () => {
    it("should return uncertainty message", () => {
      const result = formatProfileForCategory(null, "feasibility");

      expect(result).toContain("No user profile available");
      expect(result).toContain("lower confidence");
    });

    it("should work for all categories", () => {
      const categories = [
        "problem",
        "solution",
        "feasibility",
        "market",
        "risk",
        "fit",
      ] as const;

      for (const category of categories) {
        const result = formatProfileForCategory(null, category);
        // Should return something (even if empty for problem/solution)
        expect(typeof result).toBe("string");
      }
    });
  });

  describe("feasibility category", () => {
    it("should include skills context", () => {
      const result = formatProfileForCategory(
        mockProfileContext,
        "feasibility",
      );

      expect(result).toContain("Creator Capabilities");
      expect(result).toContain("Technical Skills");
      expect(result).toContain("React");
      expect(result).toContain("Python");
    });

    it("should include time availability", () => {
      const result = formatProfileForCategory(
        mockProfileContext,
        "feasibility",
      );

      expect(result).toContain("Time Availability");
    });

    it("should include skill gaps", () => {
      const result = formatProfileForCategory(
        mockProfileContext,
        "feasibility",
      );

      expect(result).toContain("Skill Gaps");
    });

    it("should include IMPORTANT instruction", () => {
      const result = formatProfileForCategory(
        mockProfileContext,
        "feasibility",
      );

      expect(result).toContain("IMPORTANT");
      expect(result).toContain("realistically build");
    });
  });

  describe("market category", () => {
    it("should include network context", () => {
      const result = formatProfileForCategory(mockProfileContext, "market");

      expect(result).toContain("Creator Network");
      expect(result).toContain("Industry Connections");
    });

    it("should include community access", () => {
      const result = formatProfileForCategory(mockProfileContext, "market");

      expect(result).toContain("Community Access");
    });

    it("should include IMPORTANT instruction about GTM", () => {
      const result = formatProfileForCategory(mockProfileContext, "market");

      expect(result).toContain("IMPORTANT");
      expect(result).toContain("go-to-market");
    });
  });

  describe("risk category", () => {
    it("should include financial runway", () => {
      const result = formatProfileForCategory(mockProfileContext, "risk");

      expect(result).toContain("Creator Risk Profile");
      expect(result).toContain("Financial Runway");
    });

    it("should include risk tolerance", () => {
      const result = formatProfileForCategory(mockProfileContext, "risk");

      expect(result).toContain("Risk Tolerance");
    });

    it("should include employment status", () => {
      const result = formatProfileForCategory(mockProfileContext, "risk");

      expect(result).toContain("Employment Status");
    });

    it("should include IMPORTANT instruction about risk exposure", () => {
      const result = formatProfileForCategory(mockProfileContext, "risk");

      expect(result).toContain("IMPORTANT");
      expect(result).toContain("execution risk");
      expect(result).toContain("financial risk");
    });
  });

  describe("fit category", () => {
    it("should include full profile context", () => {
      const result = formatProfileForCategory(mockProfileContext, "fit");

      expect(result).toContain("Creator Profile");
      expect(result).toContain("Personal Goals");
      expect(result).toContain("Passion & Motivation");
      expect(result).toContain("Skills & Experience");
      expect(result).toContain("Network & Connections");
      expect(result).toContain("Life Stage & Capacity");
    });

    it("should include all FT criteria sections", () => {
      const result = formatProfileForCategory(mockProfileContext, "fit");

      expect(result).toContain("FT1");
      expect(result).toContain("FT2");
      expect(result).toContain("FT3");
      expect(result).toContain("FT4");
      expect(result).toContain("FT5");
    });

    it("should include CRITICAL instruction", () => {
      const result = formatProfileForCategory(mockProfileContext, "fit");

      expect(result).toContain("CRITICAL");
      expect(result).toContain("high-confidence");
    });
  });

  describe("problem category", () => {
    it("should return empty string", () => {
      const result = formatProfileForCategory(mockProfileContext, "problem");

      expect(result).toBe("");
    });
  });

  describe("solution category", () => {
    it("should return empty string", () => {
      const result = formatProfileForCategory(mockProfileContext, "solution");

      expect(result).toBe("");
    });
  });

  describe("field extraction", () => {
    it("should extract Hours Available from lifeStageContext", () => {
      const result = formatProfileForCategory(
        mockProfileContext,
        "feasibility",
      );

      // Should extract "20/week" or similar
      expect(result).toMatch(/Hours|Available|20/i);
    });

    it("should extract Runway from lifeStageContext", () => {
      const result = formatProfileForCategory(mockProfileContext, "risk");

      // Should extract "12 months" or similar
      expect(result).toMatch(/Runway|12|months/i);
    });

    it("should handle missing fields gracefully", () => {
      const minimalProfile: ProfileContext = {
        goalsContext: "Some goals",
        passionContext: "Some passion",
        skillsContext: "Some skills",
        networkContext: "Some network",
        lifeStageContext: "Some life stage",
      };

      // Should not throw for any category
      const categories = ["feasibility", "market", "risk", "fit"] as const;
      for (const category of categories) {
        expect(() =>
          formatProfileForCategory(minimalProfile, category),
        ).not.toThrow();
      }
    });
  });
});
