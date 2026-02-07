import { describe, it, expect } from "vitest";
import { getQuestionBank } from "../../agents/development.js";
import { mockDevelopmentResponse } from "../mocks/anthropic.js";

describe("Development Agent", () => {
  describe("Question Bank", () => {
    it("should have questions for all categories", () => {
      const bank = getQuestionBank();

      expect(bank.user).toBeDefined();
      expect(bank.problem).toBeDefined();
      expect(bank.solution).toBeDefined();
      expect(bank.market).toBeDefined();
      expect(bank.execution).toBeDefined();
    });

    it("should have multiple questions per category", () => {
      const bank = getQuestionBank();

      expect(bank.user.length).toBeGreaterThan(3);
      expect(bank.problem.length).toBeGreaterThan(3);
      expect(bank.solution.length).toBeGreaterThan(3);
      expect(bank.market.length).toBeGreaterThan(3);
      expect(bank.execution.length).toBeGreaterThan(3);
    });

    it("should have questions ending with question marks", () => {
      const bank = getQuestionBank();

      Object.values(bank)
        .flat()
        .forEach((question) => {
          expect(question.endsWith("?")).toBe(true);
        });
    });
  });

  describe("Mock Development Response", () => {
    it("should return valid development response structure", () => {
      const response = mockDevelopmentResponse();

      expect(response.content[0].type).toBe("text");
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.questions).toBeDefined();
      expect(parsed.gaps).toBeDefined();
      expect(parsed.suggestions).toBeDefined();
    });

    it("should return questions with required fields", () => {
      const response = mockDevelopmentResponse();
      const parsed = JSON.parse(response.content[0].text);

      parsed.questions.forEach((q: any) => {
        expect(q.category).toBeDefined();
        expect(q.question).toBeDefined();
        expect(q.priority).toBeDefined();
      });
    });

    it("should include valid categories", () => {
      const response = mockDevelopmentResponse();
      const parsed = JSON.parse(response.content[0].text);
      const validCategories = [
        "user",
        "problem",
        "solution",
        "market",
        "execution",
      ];

      parsed.questions.forEach((q: any) => {
        expect(validCategories).toContain(q.category);
      });
    });

    it("should include valid priorities", () => {
      const response = mockDevelopmentResponse();
      const parsed = JSON.parse(response.content[0].text);
      const validPriorities = ["critical", "important", "nice-to-have"];

      parsed.questions.forEach((q: any) => {
        expect(validPriorities).toContain(q.priority);
      });
    });
  });
});
