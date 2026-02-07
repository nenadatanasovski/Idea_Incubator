import { describe, test, expect } from "vitest";
import {
  generatePreAnsweredQuestions,
  generateDevelopmentHandoff,
  type IdeationSignals,
} from "../../agents/ideation/pre-answered-mapper.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createEmptySignals(): IdeationSignals {
  return {
    selfDiscovery: {},
    marketDiscovery: {},
    narrowingState: {},
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("PreAnsweredQuestionsMapper", () => {
  describe("generatePreAnsweredQuestions", () => {
    test("PASS: Maps high-severity frustrations to problem statement", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Finding doctors is too hard",
              source: "user",
              severity: "high",
            },
            {
              description: "Wait times are excessive",
              source: "user",
              severity: "high",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const problemQuestion = result.find(
        (q) => q.questionId === "DEV_PROBLEM_STATEMENT",
      );
      expect(problemQuestion).toBeDefined();
      expect(problemQuestion!.answer).toContain("Finding doctors");
      expect(problemQuestion!.confidence).toBeGreaterThanOrEqual(0.6);
    });

    test("PASS: Maps customer type to target user", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          customerType: { value: "B2B", confidence: 0.9 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const targetUser = result.find((q) => q.questionId === "DEV_TARGET_USER");
      expect(targetUser).toBeDefined();
      expect(targetUser!.answer).toBe("Businesses and organizations");
    });

    test("PASS: Maps B2C customer type correctly", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          customerType: { value: "B2C", confidence: 0.9 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const targetUser = result.find((q) => q.questionId === "DEV_TARGET_USER");
      expect(targetUser?.answer).toBe("Individual consumers");
    });

    test("PASS: Maps product type to solution type", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          productType: { value: "Digital", confidence: 0.8 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const solutionType = result.find(
        (q) => q.questionId === "DEV_SOLUTION_TYPE",
      );
      expect(solutionType).toBeDefined();
      expect(solutionType!.answer).toBe("Software/digital product");
    });

    test("PASS: Maps Physical product type correctly", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          productType: { value: "Physical", confidence: 0.8 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const solutionType = result.find(
        (q) => q.questionId === "DEV_SOLUTION_TYPE",
      );
      expect(solutionType?.answer).toBe("Physical product");
    });

    test("PASS: Maps competitors to competitor list", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {
          competitors: [
            {
              name: "Competitor A",
              description: "Market leader",
              strengths: [],
              weaknesses: [],
              source: "web",
            },
            {
              name: "Competitor B",
              description: "Fast growing",
              strengths: [],
              weaknesses: [],
              source: "web",
            },
          ],
        },
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const competitors = result.find(
        (q) => q.questionId === "DEV_COMPETITORS",
      );
      expect(competitors).toBeDefined();
      expect(competitors!.answer).toContain("Competitor A");
      expect(competitors!.answer).toContain("Competitor B");
    });

    test("PASS: Maps expertise to unfair advantage", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          expertise: [
            {
              area: "Healthcare IT",
              depth: "expert",
              evidence: "Worked 10 years",
            },
            {
              area: "Machine Learning",
              depth: "competent",
              evidence: "Self-taught",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const advantage = result.find(
        (q) => q.questionId === "DEV_UNFAIR_ADVANTAGE",
      );
      expect(advantage).toBeDefined();
      expect(advantage!.answer).toContain("Healthcare IT");
      expect(advantage!.answer).not.toContain("Machine Learning"); // Only expert level
    });

    test("PASS: Maps time constraints to commitment level - full time", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          constraints: {
            timeHoursPerWeek: 45,
          },
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const commitment = result.find(
        (q) => q.questionId === "DEV_TIME_COMMITMENT",
      );
      expect(commitment).toBeDefined();
      expect(commitment!.answer).toBe("Full-time (40+ hours/week)");
    });

    test("PASS: Maps time constraints to commitment level - side project", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          constraints: {
            timeHoursPerWeek: 15,
          },
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const commitment = result.find(
        (q) => q.questionId === "DEV_TIME_COMMITMENT",
      );
      expect(commitment).toBeDefined();
      expect(commitment!.answer).toBe("Side project (10-20 hours/week)");
    });

    test("PASS: Maps time constraints to commitment level - hobby", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          constraints: {
            timeHoursPerWeek: 5,
          },
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const commitment = result.find(
        (q) => q.questionId === "DEV_TIME_COMMITMENT",
      );
      expect(commitment).toBeDefined();
      expect(commitment!.answer).toBe("Hobby level (less than 10 hours/week)");
    });

    test("PASS: Skips questions below confidence threshold", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          customerType: { value: "B2B", confidence: 0.3 }, // Below 0.7 threshold
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const targetUser = result.find((q) => q.questionId === "DEV_TARGET_USER");
      expect(targetUser).toBeUndefined();
    });

    test("PASS: Returns empty array for empty signals", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      expect(result).toEqual([]);
    });

    test("PASS: Includes evidence quotes from frustrations", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Test frustration",
              source: "user",
              severity: "high",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const problemQuestion = result.find(
        (q) => q.questionId === "DEV_PROBLEM_STATEMENT",
      );
      expect(problemQuestion?.evidenceQuotes).toBeDefined();
      expect(problemQuestion?.evidenceQuotes.length).toBeGreaterThan(0);
    });

    test("PASS: Maps geography to geography question", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          geography: { value: "Local", confidence: 0.9 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const geography = result.find((q) => q.questionId === "DEV_GEOGRAPHY");
      expect(geography).toBeDefined();
      expect(geography!.answer).toBe("Local market (single city/region)");
    });

    test("PASS: Maps funding approach correctly", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          constraints: {
            capital: "bootstrap",
          },
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const funding = result.find(
        (q) => q.questionId === "DEV_FUNDING_APPROACH",
      );
      expect(funding).toBeDefined();
      expect(funding!.answer).toBe("Bootstrapped/self-funded");
    });

    test("PASS: Maps candidate summary to one-line pitch", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
        candidateSummary:
          "A platform that helps clinics find specialists quickly",
      };

      const result = generatePreAnsweredQuestions(signals);

      const pitch = result.find((q) => q.questionId === "DEV_ONE_LINE_PITCH");
      expect(pitch).toBeDefined();
      expect(pitch!.answer).toBe(
        "A platform that helps clinics find specialists quickly",
      );
    });
  });

  describe("generateDevelopmentHandoff", () => {
    test("PASS: Includes all metadata", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generateDevelopmentHandoff(
        signals,
        "session_123",
        75,
        80,
        [
          {
            riskType: "saturated_market",
            description: "Many competitors",
            severity: "medium",
          },
        ],
      );

      expect(result.ideationMetadata.sessionId).toBe("session_123");
      expect(result.ideationMetadata.confidenceAtCapture).toBe(75);
      expect(result.ideationMetadata.viabilityAtCapture).toBe(80);
      expect(result.ideationMetadata.viabilityRisks).toHaveLength(1);
    });

    test("PASS: Includes pre-answered questions", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Problem statement here",
              source: "user",
              severity: "high",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generateDevelopmentHandoff(
        signals,
        "session_123",
        75,
        80,
        [],
      );

      expect(result.preAnsweredQuestions.length).toBeGreaterThan(0);
    });

    test("PASS: Returns empty pre-answered questions for empty signals", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generateDevelopmentHandoff(
        signals,
        "session_123",
        50,
        60,
        [],
      );

      expect(result.preAnsweredQuestions).toEqual([]);
    });
  });
});
