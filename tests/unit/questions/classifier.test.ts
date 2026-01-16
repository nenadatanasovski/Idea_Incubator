/**
 * Unit tests for questions/classifier.ts
 * Tests question classification to YAML IDs
 */
import { describe, it, expect } from "vitest";
import {
  classifyQuestionToId,
  classifyQuestion,
  getQuestionIdsByCategory,
  getCategoryForQuestionId,
} from "../../../questions/classifier.js";

describe("classifyQuestionToId", () => {
  describe("Problem category questions", () => {
    it("should classify core problem questions to P1_CORE", () => {
      const questions = [
        "What is the core problem you are solving?",
        "What is the main problem?",
        "What problem are you solving?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("P1_CORE");
      }
    });

    it("should classify pain severity questions to P2_PAIN", () => {
      // Test the clearest case
      expect(
        classifyQuestionToId("How painful is this problem for users?"),
      ).toBe("P2_PAIN");
      expect(classifyQuestionToId("What is the severity of the pain?")).toBe(
        "P2_PAIN",
      );
    });

    it("should classify target user questions to P3_WHO", () => {
      const questions = [
        "Who is your target user?",
        "Who experiences this problem?",
        "Who is your ideal customer?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("P3_WHO");
      }
    });

    it("should classify validation questions to P4_EVIDENCE", () => {
      // Test the clearest case
      expect(
        classifyQuestionToId("What evidence do you have to support this?"),
      ).toBe("P4_EVIDENCE");
    });
  });

  describe("Solution category questions", () => {
    it("should classify solution description questions to S1_WHAT", () => {
      const questions = [
        "What is your solution?",
        "How does your solution work?",
        "Describe your product",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("S1_WHAT");
      }
    });

    it("should classify technology questions to S2_TECH", () => {
      const questions = [
        "What technology will you use?",
        "What is your tech stack?",
        "What technical architecture will you use?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("S2_TECH");
      }
    });

    it("should classify differentiation questions to S3_DIFF", () => {
      // Test the clearest case
      expect(
        classifyQuestionToId(
          "What makes this different from existing products?",
        ),
      ).toBe("S3_DIFF");
    });
  });

  describe("Market category questions", () => {
    it("should classify market size questions to M1_TAM", () => {
      const questions = [
        "What is the market size?",
        "How big is the total addressable market?",
        "What is the TAM?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("M1_TAM");
      }
    });

    it("should classify competitor questions to M3_COMPETITORS", () => {
      // Test the clearest cases
      expect(classifyQuestionToId("Who are your competitors?")).toBe(
        "M3_COMPETITORS",
      );
      expect(classifyQuestionToId("What is the competitive landscape?")).toBe(
        "M3_COMPETITORS",
      );
    });

    it("should classify timing questions to M5_WHY_NOW", () => {
      const questions = [
        "Why is the timing right?",
        "Why now?",
        "Is this the right time for this?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("M5_WHY_NOW");
      }
    });
  });

  describe("Risk category questions", () => {
    it("should classify biggest risk questions to R_BIGGEST", () => {
      const questions = [
        "What is the biggest risk?",
        "What is the main risk?",
        "What are the risks?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("R_BIGGEST");
      }
    });

    it("should classify mitigation questions to R_MITIGATION", () => {
      const questions = [
        "How will you mitigate risks?",
        "How will you handle this risk?",
        "How can you reduce this risk?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("R_MITIGATION");
      }
    });
  });

  describe("Fit category questions", () => {
    it("should classify goal questions to FT1_GOALS", () => {
      const questions = [
        "What are your goals?",
        "Why are you pursuing this idea?",
        "What is your motivation?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("FT1_GOALS");
      }
    });

    it("should classify passion questions to FT2_PASSION", () => {
      const questions = [
        "What is your passion here?",
        "What interests you about this?",
        "Are you excited about this problem?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("FT2_PASSION");
      }
    });

    it("should classify skill questions to FT3_SKILLS", () => {
      const questions = [
        "What skills do you have?",
        "What is your experience in this area?",
        "What is your background?",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBe("FT3_SKILLS");
      }
    });
  });

  describe("Edge cases", () => {
    it("should return null for unclassifiable questions", () => {
      const questions = [
        "What color is the sky?",
        "How many roads must a man walk down?",
        "Random text that matches no pattern",
      ];

      for (const q of questions) {
        expect(classifyQuestionToId(q)).toBeNull();
      }
    });

    it("should be case insensitive", () => {
      expect(classifyQuestionToId("WHAT IS THE CORE PROBLEM?")).toBe("P1_CORE");
      expect(classifyQuestionToId("what is the core problem?")).toBe("P1_CORE");
      expect(classifyQuestionToId("What Is The Core Problem?")).toBe("P1_CORE");
    });
  });
});

describe("classifyQuestion", () => {
  it("should return detailed classification result", () => {
    const result = classifyQuestion(
      "What is the core problem you are solving?",
    );

    expect(result.originalQuestion).toBe(
      "What is the core problem you are solving?",
    );
    expect(result.questionId).toBe("P1_CORE");
    expect(result.category).toBe("problem");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("should return null values for unclassifiable questions", () => {
    const result = classifyQuestion("What color is the sky?");

    expect(result.questionId).toBeNull();
    expect(result.category).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

describe("getQuestionIdsByCategory", () => {
  it("should return question IDs grouped by category", () => {
    const byCategory = getQuestionIdsByCategory();

    expect(byCategory).toHaveProperty("problem");
    expect(byCategory).toHaveProperty("solution");
    expect(byCategory).toHaveProperty("market");
    expect(byCategory).toHaveProperty("feasibility");
    expect(byCategory).toHaveProperty("risk");
    expect(byCategory).toHaveProperty("fit");

    // Each category should have at least one question ID
    expect(byCategory.problem.length).toBeGreaterThan(0);
    expect(byCategory.solution.length).toBeGreaterThan(0);
  });
});

describe("getCategoryForQuestionId", () => {
  it("should return correct category for question IDs", () => {
    expect(getCategoryForQuestionId("P1_CORE")).toBe("problem");
    expect(getCategoryForQuestionId("S2_TECH")).toBe("solution");
    expect(getCategoryForQuestionId("M1_TAM")).toBe("market");
    expect(getCategoryForQuestionId("F1_MVP")).toBe("feasibility");
    expect(getCategoryForQuestionId("R_BIGGEST")).toBe("risk");
    expect(getCategoryForQuestionId("FT1_GOALS")).toBe("fit");
  });

  it("should return null for unknown question IDs", () => {
    expect(getCategoryForQuestionId("UNKNOWN_ID")).toBeNull();
    expect(getCategoryForQuestionId("")).toBeNull();
  });
});
