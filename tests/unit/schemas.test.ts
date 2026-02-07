import { describe, it, expect } from "vitest";
import {
  IdeaFrontmatterSchema,
  CriterionEvaluationSchema,
  ArbiterVerdictSchema,
  SynthesisOutputSchema,
  LifecycleStageSchema,
  parseAgentResponse,
  EvaluationResponseSchema,
} from "../../utils/schemas.js";
import { EvaluationParseError } from "../../utils/errors.js";

describe("IdeaFrontmatterSchema", () => {
  it("should validate a complete frontmatter", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Idea",
      type: "technical",
      stage: "SPARK",
      created: "2025-12-21",
      tags: ["ai", "automation"],
      related: ["other-idea"],
    };

    const result = IdeaFrontmatterSchema.parse(data);
    expect(result.title).toBe("Test Idea");
    expect(result.tags).toEqual(["ai", "automation"]);
  });

  it("should set defaults for optional arrays", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Idea",
      type: "business",
      stage: "SPARK",
      created: "2025-12-21",
    };

    const result = IdeaFrontmatterSchema.parse(data);
    expect(result.tags).toEqual([]);
    expect(result.related).toEqual([]);
  });

  it("should reject invalid type", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test",
      type: "invalid",
      stage: "SPARK",
      created: "2025-12-21",
    };

    expect(() => IdeaFrontmatterSchema.parse(data)).toThrow();
  });

  it("should reject invalid stage", () => {
    const data = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test",
      type: "technical",
      stage: "INVALID",
      created: "2025-12-21",
    };

    expect(() => IdeaFrontmatterSchema.parse(data)).toThrow();
  });
});

describe("CriterionEvaluationSchema", () => {
  it("should validate a criterion evaluation", () => {
    const data = {
      criterion: "Problem Clarity",
      category: "problem",
      score: 8,
      confidence: 0.85,
      reasoning: "Well-defined problem statement",
    };

    const result = CriterionEvaluationSchema.parse(data);
    expect(result.score).toBe(8);
    expect(result.confidence).toBe(0.85);
  });

  it("should reject score out of range", () => {
    expect(() =>
      CriterionEvaluationSchema.parse({
        criterion: "Test",
        category: "problem",
        score: 0,
        confidence: 0.5,
        reasoning: "Test",
      }),
    ).toThrow();

    expect(() =>
      CriterionEvaluationSchema.parse({
        criterion: "Test",
        category: "problem",
        score: 11,
        confidence: 0.5,
        reasoning: "Test",
      }),
    ).toThrow();
  });

  it("should reject confidence out of range", () => {
    expect(() =>
      CriterionEvaluationSchema.parse({
        criterion: "Test",
        category: "problem",
        score: 5,
        confidence: -0.1,
        reasoning: "Test",
      }),
    ).toThrow();

    expect(() =>
      CriterionEvaluationSchema.parse({
        criterion: "Test",
        category: "problem",
        score: 5,
        confidence: 1.1,
        reasoning: "Test",
      }),
    ).toThrow();
  });
});

describe("ArbiterVerdictSchema", () => {
  it("should validate an arbiter verdict", () => {
    const data = {
      verdict: "EVALUATOR",
      reasoning: "Strong evidence provided",
      firstPrinciplesBonus: true,
      scoreAdjustment: 1,
    };

    const result = ArbiterVerdictSchema.parse(data);
    expect(result.verdict).toBe("EVALUATOR");
    expect(result.firstPrinciplesBonus).toBe(true);
  });

  it("should reject invalid verdict", () => {
    expect(() =>
      ArbiterVerdictSchema.parse({
        verdict: "WINNER",
        reasoning: "Test",
        firstPrinciplesBonus: false,
        scoreAdjustment: 0,
      }),
    ).toThrow();
  });

  it("should reject score adjustment out of range", () => {
    expect(() =>
      ArbiterVerdictSchema.parse({
        verdict: "RED_TEAM",
        reasoning: "Test",
        firstPrinciplesBonus: false,
        scoreAdjustment: 5,
      }),
    ).toThrow();
  });
});

describe("SynthesisOutputSchema", () => {
  it("should validate a synthesis output", () => {
    const data = {
      executiveSummary: "A promising idea",
      keyStrengths: ["Clear problem", "Feasible solution"],
      keyWeaknesses: ["Market risk"],
      criticalAssumptions: ["Users will pay"],
      unresolvedQuestions: ["What price?"],
      recommendation: "PURSUE",
      recommendationReasoning: "Worth investing time",
    };

    const result = SynthesisOutputSchema.parse(data);
    expect(result.recommendation).toBe("PURSUE");
    expect(result.keyStrengths).toHaveLength(2);
  });

  it("should reject invalid recommendation", () => {
    expect(() =>
      SynthesisOutputSchema.parse({
        executiveSummary: "Test",
        keyStrengths: [],
        keyWeaknesses: [],
        criticalAssumptions: [],
        unresolvedQuestions: [],
        recommendation: "MAYBE",
        recommendationReasoning: "Test",
      }),
    ).toThrow();
  });
});

describe("LifecycleStageSchema", () => {
  it("should accept all valid stages", () => {
    const stages = [
      "SPARK",
      "CLARIFY",
      "RESEARCH",
      "IDEATE",
      "EVALUATE",
      "VALIDATE",
      "DESIGN",
      "PROTOTYPE",
      "TEST",
      "REFINE",
      "BUILD",
      "LAUNCH",
      "GROW",
      "MAINTAIN",
      "PIVOT",
      "PAUSE",
      "SUNSET",
      "ARCHIVE",
      "ABANDONED",
    ];

    stages.forEach((stage) => {
      expect(() => LifecycleStageSchema.parse(stage)).not.toThrow();
    });
  });
});

describe("parseAgentResponse", () => {
  it("should parse valid JSON from text", () => {
    const text =
      'Here is the response: {"evaluations": [{"criterion": "Test", "category": "problem", "score": 8, "confidence": 0.8, "reasoning": "Good"}]}';

    const result = parseAgentResponse(
      text,
      EvaluationResponseSchema,
      "evaluation",
    );
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].score).toBe(8);
  });

  it("should throw on invalid JSON", () => {
    const text = "No JSON here";

    expect(() =>
      parseAgentResponse(text, EvaluationResponseSchema, "evaluation"),
    ).toThrow(EvaluationParseError);
  });

  it("should throw on valid JSON but invalid schema", () => {
    const text = '{"evaluations": [{"criterion": "Test"}]}'; // missing required fields

    expect(() =>
      parseAgentResponse(text, EvaluationResponseSchema, "evaluation"),
    ).toThrow(EvaluationParseError);
  });
});
