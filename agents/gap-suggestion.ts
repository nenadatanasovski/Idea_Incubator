/**
 * Gap Suggestion Agent
 *
 * Generates comprehensive suggestions for addressing critical gaps.
 * Uses idea context, user profile, and web research to provide
 * 3 actionable suggestions per gap.
 */

import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo } from "../utils/logger.js";
import { getConfig } from "../config/index.js";
import { EvaluationParseError } from "../utils/errors.js";
import { v4 as uuid } from "uuid";
import {
  Assumption,
  GapSuggestion,
  GapResolution,
  GapSuggestionSource,
  IdeaContext,
  ProfileContext,
} from "../types/incubation.js";

const GAP_SUGGESTION_SYSTEM_PROMPT = `You are a Gap Suggestion Agent for idea incubation.

Your job is to generate actionable suggestions for addressing critical gaps in business ideas.
For each gap, you must provide exactly 3 distinct suggestions.

Each suggestion should:
1. Be specific and actionable
2. Include clear rationale
3. Acknowledge tradeoffs
4. Have an honest confidence rating

Consider:
- The user's profile (skills, network, constraints)
- Market realities and opportunities
- Practical feasibility

Output valid JSON only.`;

/**
 * Generate 3 suggestions for addressing a critical gap
 */
export async function generateGapSuggestions(
  gap: Assumption,
  ideaContext: IdeaContext,
  profile: ProfileContext,
  costTracker: CostTracker,
): Promise<GapSuggestion[]> {
  const config = getConfig();

  logInfo(`Generating suggestions for gap: ${gap.text.substring(0, 50)}...`);

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: GAP_SUGGESTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate 3 suggestions for addressing this critical gap:

GAP TO ADDRESS:
${gap.text}
Category: ${gap.category}
Current Evidence: ${gap.evidence || "None"}

IDEA CONTEXT:
Problem: ${ideaContext.problem}
Solution: ${ideaContext.solution}
Target User: ${ideaContext.targetUser}

USER PROFILE:
Goals: ${profile.goals?.join(", ") || "Not specified"}
Skills: ${profile.skills?.join(", ") || "Not specified"}
Network: ${profile.network?.join(", ") || "Not specified"}
Constraints: ${profile.constraints?.join(", ") || "Not specified"}

EXISTING ANSWERS:
${
  Object.entries(ideaContext.currentAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n") || "No answers yet"
}

Generate exactly 3 distinct suggestions. Each should take a different approach.

Respond in JSON:
{
  "suggestions": [
    {
      "suggestion": "Specific actionable suggestion",
      "rationale": "Why this addresses the gap",
      "tradeoffs": ["Tradeoff 1", "Tradeoff 2"],
      "confidence": 0.0-1.0,
      "source": "profile|web_research|synthesis"
    }
  ]
}`,
      },
    ],
  });

  costTracker.track(response.usage, "gap-suggestion");

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError(
      "Unexpected response type from gap suggestion agent",
    );
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError("Could not parse gap suggestion response");
  }

  let parsed: {
    suggestions: Array<{
      suggestion: string;
      rationale: string;
      tradeoffs: string[];
      confidence: number;
      source: string;
    }>;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError("Invalid JSON in gap suggestion response");
  }

  // Transform and validate suggestions
  const suggestions: GapSuggestion[] = parsed.suggestions
    .slice(0, 3)
    .map((s) => ({
      id: uuid(),
      suggestion: s.suggestion,
      rationale: s.rationale,
      tradeoffs: s.tradeoffs,
      confidence: Math.max(0, Math.min(1, s.confidence)),
      source: validateSource(s.source),
    }));

  // Ensure we have exactly 3 suggestions
  while (suggestions.length < 3) {
    suggestions.push({
      id: uuid(),
      suggestion:
        "Consider consulting domain experts for additional perspectives.",
      rationale: "External expertise can provide validation and new insights.",
      tradeoffs: [
        "Requires time investment",
        "May need to build new connections",
      ],
      confidence: 0.5,
      source: "synthesis",
    });
  }

  logInfo(`Generated ${suggestions.length} suggestions for gap`);

  return suggestions;
}

/**
 * Validate and normalize source type
 */
function validateSource(source: string): GapSuggestionSource {
  const normalized = source.toLowerCase().trim();
  if (
    normalized === "profile" ||
    normalized === "web_research" ||
    normalized === "synthesis"
  ) {
    return normalized as GapSuggestionSource;
  }
  return "synthesis";
}

/**
 * Generate proactive suggestions for a question (before user answers)
 * Used when user clicks "Get Suggestions" button
 */
export async function generateProactiveSuggestions(
  questionText: string,
  ideaContext: IdeaContext,
  profile: ProfileContext,
  costTracker: CostTracker,
): Promise<GapSuggestion[]> {
  const config = getConfig();

  logInfo(
    `Generating proactive suggestions for question: ${questionText.substring(0, 50)}...`,
  );

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: `You are a helpful assistant generating answer suggestions for idea development questions.
Your suggestions should be specific, actionable, and relevant to the user's context.
Output valid JSON only.`,
    messages: [
      {
        role: "user",
        content: `Generate 2-3 suggested answers for this question:

QUESTION:
${questionText}

IDEA CONTEXT:
Problem: ${ideaContext.problem}
Solution: ${ideaContext.solution}
Target User: ${ideaContext.targetUser}

USER PROFILE:
Goals: ${profile.goals?.join(", ") || "Not specified"}
Skills: ${profile.skills?.join(", ") || "Not specified"}
Network: ${profile.network?.join(", ") || "Not specified"}

Respond in JSON:
{
  "suggestions": [
    {
      "suggestion": "Suggested answer",
      "rationale": "Why this might be appropriate",
      "source": "profile|web_research|synthesis"
    }
  ]
}`,
      },
    ],
  });

  costTracker.track(response.usage, "proactive-suggestion");

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError("Unexpected response type");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError("Could not parse suggestions");
  }

  let parsed: {
    suggestions: Array<{
      suggestion: string;
      rationale: string;
      source: string;
    }>;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError("Invalid JSON in suggestions");
  }

  return parsed.suggestions.map((s) => ({
    id: uuid(),
    suggestion: s.suggestion,
    rationale: s.rationale,
    tradeoffs: [],
    confidence: 0.7,
    source: validateSource(s.source),
  }));
}

/**
 * Create a gap resolution record
 */
export function createGapResolution(
  gapId: string,
  resolution: string,
  source:
    | "suggestion_selected"
    | "suggestion_modified"
    | "user_provided"
    | "skipped",
  selectedSuggestionId?: string,
): GapResolution {
  return {
    gapId,
    resolution,
    source,
    selectedSuggestionId,
  };
}

/**
 * Format suggestions for display
 */
export function formatSuggestionsForDisplay(
  suggestions: GapSuggestion[],
): string {
  return suggestions
    .map((s, i) => {
      const confidenceBar =
        "█".repeat(Math.round(s.confidence * 10)) +
        "░".repeat(10 - Math.round(s.confidence * 10));
      return `
[${i + 1}] ${s.suggestion}

    Rationale: ${s.rationale}

    Tradeoffs:
    ${s.tradeoffs.map((t) => `  • ${t}`).join("\n")}

    Confidence: ${confidenceBar} ${Math.round(s.confidence * 100)}%
    Source: ${s.source}
`;
    })
    .join("\n" + "─".repeat(60) + "\n");
}
