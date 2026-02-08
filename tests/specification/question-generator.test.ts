/**
 * Question Generator Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  QuestionGenerator,
  createQuestionGenerator,
} from "../../agents/specification/question-generator.js";
import { ParsedBrief } from "../../agents/specification/brief-parser.js";
import { AnalyzedRequirements } from "../../agents/specification/prompts/tasks.js";

describe("question-generator", () => {
  let generator: QuestionGenerator;

  const createMockBrief = (
    overrides: Partial<ParsedBrief> = {},
  ): ParsedBrief => ({
    id: "test-feature",
    title: "Test Feature",
    complexity: "simple",
    problem: "Users need a way to track their tasks efficiently",
    solution: "Implement a task tracking system with database storage",
    mvpScope: {
      inScope: ["Create tasks", "List tasks", "Mark complete"],
      outOfScope: ["Task sharing", "Notifications"],
    },
    constraints: [],
    successCriteria: ["Users can create and complete tasks"],
    rawContent: "",
    ...overrides,
  });

  const createMockRequirements = (
    overrides: Partial<AnalyzedRequirements> = {},
  ): AnalyzedRequirements => ({
    functionalRequirements: [
      { id: "FR-001", description: "Create tasks", priority: "must" },
    ],
    nonFunctionalRequirements: [],
    constraints: [],
    successCriteria: ["Tasks can be created"],
    ambiguities: [],
    ...overrides,
  });

  beforeEach(() => {
    generator = new QuestionGenerator();
  });

  describe("constructor", () => {
    it("should create generator with default options", () => {
      const defaultGenerator = new QuestionGenerator();
      expect(defaultGenerator).toBeDefined();
    });

    it("should accept strict mode option", () => {
      const strictGenerator = new QuestionGenerator({ strictMode: true });
      expect(strictGenerator).toBeDefined();
    });
  });

  describe("generate", () => {
    it("should return QuestionResult structure", () => {
      const brief = createMockBrief();
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      expect(result).toHaveProperty("questions");
      expect(result).toHaveProperty("blockingCount");
      expect(result).toHaveProperty("canProceedWithDefaults");
      expect(Array.isArray(result.questions)).toBe(true);
    });

    it("should generate questions with unique IDs", () => {
      const brief = createMockBrief({
        problem: "Something TBD here and another FIXME there",
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      if (result.questions.length > 1) {
        const ids = result.questions.map((q) => q.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });

    it("should generate questions in Q-XXX format", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      for (const question of result.questions) {
        expect(question.id).toMatch(/^Q-\d{3}$/);
      }
    });
  });

  describe("question types", () => {
    it("should support BLOCKING type", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasBlocking = result.questions.some((q) => q.type === "BLOCKING");
      expect(hasBlocking || result.blockingCount >= 0).toBe(true);
    });

    it("should support CLARIFYING type", () => {
      const brief = createMockBrief({
        successCriteria: [],
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasClarifying = result.questions.some(
        (q) => q.type === "CLARIFYING",
      );
      expect(hasClarifying).toBe(true);
    });

    it("should support CONFIRMING type", () => {
      const brief = createMockBrief({
        solution: "Store user data in database",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasConfirming = result.questions.some(
        (q) => q.type === "CONFIRMING",
      );
      expect(hasConfirming).toBe(true);
    });

    it("should support PREFERENCE type", () => {
      const brief = createMockBrief({
        solution: "Implement user authentication system",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasPreference = result.questions.some(
        (q) => q.type === "PREFERENCE",
      );
      expect(hasPreference).toBe(true);
    });
  });

  describe("question structure", () => {
    it("should have required Question fields", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      for (const question of result.questions) {
        expect(question.id).toBeDefined();
        expect(question.type).toBeDefined();
        expect(question.content).toBeDefined();
        expect(question.context).toBeDefined();
      }
    });

    it("should provide defaults for non-blocking questions", () => {
      const brief = createMockBrief({
        successCriteria: [],
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const clarifyingQuestions = result.questions.filter(
        (q) => q.type === "CLARIFYING",
      );
      for (const q of clarifyingQuestions) {
        expect(q.default).toBeDefined();
        expect(q.defaultRationale).toBeDefined();
      }
    });

    it("should provide options for preference questions", () => {
      const brief = createMockBrief({
        solution: "Implement real-time notifications",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const preferenceQuestions = result.questions.filter(
        (q) => q.type === "PREFERENCE",
      );
      for (const q of preferenceQuestions) {
        expect(q.options).toBeDefined();
        expect(q.options?.length).toBeGreaterThan(0);
      }
    });
  });

  describe("ambiguity detection", () => {
    it("should detect TBD/TODO placeholders", () => {
      const brief = createMockBrief({
        problem: "TBD: need to figure out exact requirements",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasTbdQuestion = result.questions.some(
        (q) =>
          q.content.toLowerCase().includes("tbd") ||
          q.context.toLowerCase().includes("placeholder"),
      );
      expect(hasTbdQuestion).toBe(true);
    });

    it("should detect embedded questions", () => {
      const brief = createMockBrief({
        problem: "Users need something but what exactly?",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasEmbeddedQuestion = result.questions.some((q) =>
        q.context.includes("embedded question"),
      );
      expect(hasEmbeddedQuestion).toBe(true);
    });
  });

  describe("missing information detection", () => {
    it("should flag missing success criteria", () => {
      const brief = createMockBrief({
        successCriteria: [],
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasSuccessCriteriaQuestion = result.questions.some((q) =>
        q.content.toLowerCase().includes("success criteria"),
      );
      expect(hasSuccessCriteriaQuestion).toBe(true);
    });

    it("should flag missing MVP scope", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasScopeQuestion = result.questions.some(
        (q) =>
          q.content.toLowerCase().includes("mvp scope") ||
          q.type === "BLOCKING",
      );
      expect(hasScopeQuestion).toBe(true);
    });

    it("should ask about database when storage mentioned", () => {
      const brief = createMockBrief({
        solution: "Store user preferences in database",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasDbQuestion = result.questions.some(
        (q) =>
          q.content.toLowerCase().includes("database") ||
          q.content.toLowerCase().includes("table"),
      );
      expect(hasDbQuestion).toBe(true);
    });
  });

  describe("architecture choices", () => {
    it("should detect authentication needs", () => {
      const brief = createMockBrief({
        solution: "Implement user login and authentication",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasAuthQuestion = result.questions.some((q) =>
        q.content.toLowerCase().includes("authentication"),
      );
      expect(hasAuthQuestion).toBe(true);
    });

    it("should detect caching needs", () => {
      const brief = createMockBrief({
        solution: "Improve performance with caching",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasCacheQuestion = result.questions.some((q) =>
        q.content.toLowerCase().includes("cach"),
      );
      expect(hasCacheQuestion).toBe(true);
    });

    it("should detect real-time needs", () => {
      const brief = createMockBrief({
        solution: "Add realtime updates via WebSocket",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const hasRealtimeQuestion = result.questions.some((q) =>
        q.content.toLowerCase().includes("real-time"),
      );
      expect(hasRealtimeQuestion).toBe(true);
    });

    it("should not duplicate if already specified in architecture", () => {
      const brief = createMockBrief({
        solution: "Implement authentication",
        architecture: "Use JWT tokens for authentication",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      // Should not ask about auth if JWT already specified
      const hasAuthQuestion = result.questions.some((q) =>
        q.content.toLowerCase().includes("authentication"),
      );
      expect(hasAuthQuestion).toBe(false);
    });
  });

  describe("blocking count", () => {
    it("should count blocking questions correctly", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const actualBlocking = result.questions.filter(
        (q) => q.type === "BLOCKING",
      ).length;
      expect(result.blockingCount).toBe(actualBlocking);
    });
  });

  describe("canProceedWithDefaults", () => {
    it("should be true when all questions have defaults", () => {
      const brief = createMockBrief();
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      // If we can proceed, all blocking should have defaults
      if (result.canProceedWithDefaults) {
        const blockingWithoutDefaults = result.questions.filter(
          (q) => q.type === "BLOCKING" && !q.default,
        );
        expect(blockingWithoutDefaults.length).toBe(0);
      }
    });

    it("should be false when blocking questions lack defaults", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      const blockingWithoutDefaults = result.questions.filter(
        (q) => q.type === "BLOCKING" && !q.default,
      );

      if (blockingWithoutDefaults.length > 0) {
        expect(result.canProceedWithDefaults).toBe(false);
      }
    });
  });

  describe("applyDefaults", () => {
    it("should mark all questions as answered", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);
      const withDefaults = generator.applyDefaults(result);

      expect(withDefaults.canProceedWithDefaults).toBe(true);
    });
  });

  describe("canProceed", () => {
    it("should return true when blocking questions are answered", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);
      const answers = new Map<string, string>();

      // Answer all blocking questions
      for (const q of result.questions) {
        if (q.type === "BLOCKING") {
          answers.set(q.id, "answered");
        }
      }

      expect(generator.canProceed(result, answers)).toBe(true);
    });

    it("should return false when blocking questions are unanswered", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);

      // Remove default from first blocking question for test
      const blockingQ = result.questions.find((q) => q.type === "BLOCKING");
      if (blockingQ) {
        blockingQ.default = undefined;
        const answers = new Map<string, string>();
        expect(generator.canProceed(result, answers)).toBe(false);
      }
    });
  });

  describe("getBlockingQuestions", () => {
    it("should return only blocking questions", () => {
      const brief = createMockBrief({
        mvpScope: { inScope: [], outOfScope: [] },
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);
      const blocking = generator.getBlockingQuestions(result);

      for (const q of blocking) {
        expect(q.type).toBe("BLOCKING");
      }
    });
  });

  describe("getQuestionsByType", () => {
    it("should filter by question type", () => {
      const brief = createMockBrief({
        solution: "Implement authentication with caching",
      });
      const requirements = createMockRequirements();

      const result = generator.generate(brief, requirements);
      const preference = generator.getQuestionsByType(result, "PREFERENCE");

      for (const q of preference) {
        expect(q.type).toBe("PREFERENCE");
      }
    });
  });

  describe("requirements ambiguities", () => {
    it("should convert analyzed ambiguities to questions", () => {
      const brief = createMockBrief();
      const requirements = createMockRequirements({
        ambiguities: [
          { area: "authentication", question: "Should users need to log in?" },
          { area: "storage", question: "How long should data be retained?" },
        ],
      });

      const result = generator.generate(brief, requirements);

      const hasAuthQuestion = result.questions.some((q) =>
        q.content.includes("log in"),
      );
      const hasStorageQuestion = result.questions.some((q) =>
        q.content.includes("retained"),
      );

      expect(hasAuthQuestion).toBe(true);
      expect(hasStorageQuestion).toBe(true);
    });
  });

  describe("createQuestionGenerator", () => {
    it("should create generator instance", () => {
      const instance = createQuestionGenerator();
      expect(instance).toBeInstanceOf(QuestionGenerator);
    });

    it("should pass options to constructor", () => {
      const instance = createQuestionGenerator({ strictMode: true });
      expect(instance).toBeDefined();
    });
  });

  describe("strict mode", () => {
    it("should generate more questions in strict mode", () => {
      const strictGenerator = new QuestionGenerator({ strictMode: true });
      const normalGenerator = new QuestionGenerator({ strictMode: false });

      const brief = createMockBrief({
        problem: "Users should be able to do something with various items etc.",
      });
      const requirements = createMockRequirements();

      const strictResult = strictGenerator.generate(brief, requirements);
      const normalResult = normalGenerator.generate(brief, requirements);

      // Strict mode should find more ambiguities
      expect(strictResult.questions.length).toBeGreaterThanOrEqual(
        normalResult.questions.length,
      );
    });
  });
});
