import { vi } from "vitest";

export interface MockMessage {
  content: Array<{ type: "text"; text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "{}" }],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  };
}

export function mockEvaluationResponse(
  scores: Record<string, number>,
): MockMessage {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          evaluations: Object.entries(scores).map(([criterion, score]) => ({
            criterion,
            category: "test",
            score,
            confidence: 0.8,
            reasoning: "Test reasoning",
          })),
        }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 1000 },
  };
}

export function mockArbiterResponse(
  verdict: "EVALUATOR" | "RED_TEAM" | "DRAW",
): MockMessage {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          verdict,
          reasoning: "Test verdict reasoning",
          firstPrinciplesBonus: false,
          scoreAdjustment: verdict === "RED_TEAM" ? -1 : 0,
        }),
      },
    ],
    usage: { input_tokens: 200, output_tokens: 300 },
  };
}

export function mockChallengeResponse(
  persona: string,
  challenge: string,
): MockMessage {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          persona,
          criterion: "Test Criterion",
          challenge,
          severity: "MAJOR",
        }),
      },
    ],
    usage: { input_tokens: 150, output_tokens: 250 },
  };
}

export function mockDevelopmentResponse(): MockMessage {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          questions: [
            {
              category: "user",
              question: "Who is the target user?",
              priority: "critical",
            },
            {
              category: "problem",
              question: "What problem does this solve?",
              priority: "critical",
            },
            {
              category: "solution",
              question: "How is this different from alternatives?",
              priority: "important",
            },
          ],
          gaps: ["Missing target user definition", "No market validation"],
          suggestions: ["Conduct user interviews", "Research competitors"],
        }),
      },
    ],
    usage: { input_tokens: 300, output_tokens: 400 },
  };
}

export function mockSynthesisResponse(): MockMessage {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          executiveSummary:
            "This is a promising idea with strong problem-solution fit.",
          keyStrengths: ["Clear problem definition", "Feasible solution"],
          keyWeaknesses: ["Limited market validation", "High competition"],
          criticalAssumptions: ["Users will pay for this solution"],
          unresolvedQuestions: ["What is the optimal pricing model?"],
          recommendation: "REFINE",
          recommendationReasoning:
            "The idea shows promise but needs more market validation.",
        }),
      },
    ],
    usage: { input_tokens: 600, output_tokens: 800 },
  };
}
