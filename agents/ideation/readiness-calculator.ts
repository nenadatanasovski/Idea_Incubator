/**
 * Readiness Calculator
 *
 * Calculates spec generation readiness based on ideation session content.
 * Uses Claude to analyze conversation for completeness across 4 dimensions.
 *
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-003)
 */

import { client as anthropicClient } from "../../utils/anthropic-client.js";
import type { IdeationMessage } from "../../types/ideation.js";
import type { ReadinessScore } from "../../types/spec.js";

// Readiness threshold for auto-suggesting spec generation
const READINESS_THRESHOLD = 75;

// Maximum score per dimension
const MAX_DIMENSION_SCORE = 25;

/**
 * Dimension definitions with scoring criteria
 */
const DIMENSION_DEFINITIONS = {
  problemClarity: {
    name: "Problem Clarity",
    description: "How well the problem being solved is defined",
    criteria: [
      "Problem statement is explicitly stated",
      "Pain points are identified",
      "Current situation vs desired state is clear",
      "Scope of the problem is bounded",
    ],
  },
  solutionDefinition: {
    name: "Solution Definition",
    description: "How well the proposed solution is articulated",
    criteria: [
      "Solution approach is described",
      "Key features or capabilities are identified",
      "Value proposition is clear",
      "Differentiation from alternatives mentioned",
    ],
  },
  userUnderstanding: {
    name: "User Understanding",
    description: "How well the target users are identified",
    criteria: [
      "Target user segment is defined",
      "User needs are understood",
      "User context (when/where/why) is considered",
      "User priorities or constraints are known",
    ],
  },
  scopeBoundaries: {
    name: "Scope Boundaries",
    description: "How well the scope is bounded",
    criteria: [
      "MVP or initial scope is discussed",
      "Out-of-scope items are identified",
      "Constraints are acknowledged",
      "Success criteria or goals mentioned",
    ],
  },
};

/**
 * Build the analysis prompt for Claude
 */
function buildReadinessPrompt(messages: IdeationMessage[]): string {
  // Format conversation for analysis
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `Analyze this ideation conversation and score readiness for generating a product specification.

## Conversation
${conversationText}

## Scoring Instructions

Score each dimension from 0-25 based on how well the conversation covers the criteria:

1. **Problem Clarity** (0-25)
   - Problem statement is explicitly stated
   - Pain points are identified
   - Current vs desired state is clear
   - Scope of the problem is bounded

2. **Solution Definition** (0-25)
   - Solution approach is described
   - Key features or capabilities identified
   - Value proposition is clear
   - Differentiation from alternatives mentioned

3. **User Understanding** (0-25)
   - Target user segment is defined
   - User needs are understood
   - User context (when/where/why) is considered
   - User priorities or constraints are known

4. **Scope Boundaries** (0-25)
   - MVP or initial scope is discussed
   - Out-of-scope items are identified
   - Constraints are acknowledged
   - Success criteria or goals mentioned

## Response Format

Respond ONLY with a JSON object in this exact format:
{
  "problemClarity": { "score": <0-25>, "evidence": "<brief evidence>" },
  "solutionDefinition": { "score": <0-25>, "evidence": "<brief evidence>" },
  "userUnderstanding": { "score": <0-25>, "evidence": "<brief evidence>" },
  "scopeBoundaries": { "score": <0-25>, "evidence": "<brief evidence>" }
}`;
}

/**
 * Parse Claude's response into ReadinessScore
 */
function parseReadinessResponse(response: string): ReadinessScore | null {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ReadinessCalculator] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build dimensions
    const dimensions: ReadinessScore["dimensions"] = {
      problemClarity: {
        name: DIMENSION_DEFINITIONS.problemClarity.name,
        score: Math.min(
          MAX_DIMENSION_SCORE,
          Math.max(0, parsed.problemClarity?.score ?? 0),
        ),
        description: parsed.problemClarity?.evidence ?? "",
      },
      solutionDefinition: {
        name: DIMENSION_DEFINITIONS.solutionDefinition.name,
        score: Math.min(
          MAX_DIMENSION_SCORE,
          Math.max(0, parsed.solutionDefinition?.score ?? 0),
        ),
        description: parsed.solutionDefinition?.evidence ?? "",
      },
      userUnderstanding: {
        name: DIMENSION_DEFINITIONS.userUnderstanding.name,
        score: Math.min(
          MAX_DIMENSION_SCORE,
          Math.max(0, parsed.userUnderstanding?.score ?? 0),
        ),
        description: parsed.userUnderstanding?.evidence ?? "",
      },
      scopeBoundaries: {
        name: DIMENSION_DEFINITIONS.scopeBoundaries.name,
        score: Math.min(
          MAX_DIMENSION_SCORE,
          Math.max(0, parsed.scopeBoundaries?.score ?? 0),
        ),
        description: parsed.scopeBoundaries?.evidence ?? "",
      },
    };

    // Calculate total
    const total =
      dimensions.problemClarity.score +
      dimensions.solutionDefinition.score +
      dimensions.userUnderstanding.score +
      dimensions.scopeBoundaries.score;

    return {
      total,
      isReady: total >= READINESS_THRESHOLD,
      dimensions,
    };
  } catch (error) {
    console.error("[ReadinessCalculator] Failed to parse response:", error);
    return null;
  }
}

/**
 * Calculate readiness score for an ideation session
 *
 * @param messages - Array of session messages
 * @returns ReadinessScore with total and dimension breakdown
 */
export async function calculateReadiness(
  messages: IdeationMessage[],
): Promise<ReadinessScore> {
  // Default low score if not enough messages
  if (messages.length < 3) {
    return {
      total: 0,
      isReady: false,
      dimensions: {
        problemClarity: {
          name: "Problem Clarity",
          score: 0,
          description: "Not enough conversation yet",
        },
        solutionDefinition: {
          name: "Solution Definition",
          score: 0,
          description: "Not enough conversation yet",
        },
        userUnderstanding: {
          name: "User Understanding",
          score: 0,
          description: "Not enough conversation yet",
        },
        scopeBoundaries: {
          name: "Scope Boundaries",
          score: 0,
          description: "Not enough conversation yet",
        },
      },
    };
  }

  try {
    const prompt = buildReadinessPrompt(messages);

    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const readiness = parseReadinessResponse(responseText);

    if (readiness) {
      console.log(
        `[ReadinessCalculator] Score: ${readiness.total}/100 (Ready: ${readiness.isReady})`,
      );
      return readiness;
    }

    // Fallback if parsing fails
    console.warn("[ReadinessCalculator] Falling back to heuristic scoring");
    return calculateHeuristicReadiness(messages);
  } catch (error) {
    console.error("[ReadinessCalculator] Claude call failed:", error);
    // Fallback to heuristic scoring
    return calculateHeuristicReadiness(messages);
  }
}

/**
 * Heuristic-based readiness calculation (fallback)
 * Uses simple text analysis when Claude is unavailable
 */
export function calculateHeuristicReadiness(
  messages: IdeationMessage[],
): ReadinessScore {
  const allText = messages.map((m) => m.content.toLowerCase()).join(" ");

  // Simple keyword-based scoring
  const problemKeywords = [
    "problem",
    "pain",
    "struggle",
    "difficult",
    "issue",
    "challenge",
  ];
  const solutionKeywords = [
    "solution",
    "feature",
    "build",
    "create",
    "develop",
    "product",
  ];
  const userKeywords = [
    "user",
    "customer",
    "audience",
    "people",
    "target",
    "who",
  ];
  const scopeKeywords = [
    "scope",
    "mvp",
    "first",
    "initial",
    "constraint",
    "success",
  ];

  const countKeywords = (keywords: string[]) =>
    keywords.reduce((count, kw) => count + (allText.includes(kw) ? 5 : 0), 0);

  const dimensions: ReadinessScore["dimensions"] = {
    problemClarity: {
      name: "Problem Clarity",
      score: Math.min(MAX_DIMENSION_SCORE, countKeywords(problemKeywords)),
      description: "Based on keyword analysis",
    },
    solutionDefinition: {
      name: "Solution Definition",
      score: Math.min(MAX_DIMENSION_SCORE, countKeywords(solutionKeywords)),
      description: "Based on keyword analysis",
    },
    userUnderstanding: {
      name: "User Understanding",
      score: Math.min(MAX_DIMENSION_SCORE, countKeywords(userKeywords)),
      description: "Based on keyword analysis",
    },
    scopeBoundaries: {
      name: "Scope Boundaries",
      score: Math.min(MAX_DIMENSION_SCORE, countKeywords(scopeKeywords)),
      description: "Based on keyword analysis",
    },
  };

  const total =
    dimensions.problemClarity.score +
    dimensions.solutionDefinition.score +
    dimensions.userUnderstanding.score +
    dimensions.scopeBoundaries.score;

  return {
    total,
    isReady: total >= READINESS_THRESHOLD,
    dimensions,
  };
}

/**
 * Check if session is ready for spec generation
 */
export function isReadyForSpec(readiness: ReadinessScore): boolean {
  return readiness.isReady;
}

/**
 * Get readiness summary for display
 */
export function getReadinessSummary(readiness: ReadinessScore): string {
  if (readiness.total >= 90) {
    return "Excellent! Ready to generate spec.";
  } else if (readiness.total >= 75) {
    return "Good coverage. Ready to generate spec.";
  } else if (readiness.total >= 50) {
    return "Making progress. A few more details needed.";
  } else if (readiness.total >= 25) {
    return "Early stage. Continue developing the idea.";
  } else {
    return "Just getting started. Keep exploring!";
  }
}

/**
 * Get suggestions for improving readiness
 */
export function getReadinessImprovements(readiness: ReadinessScore): string[] {
  const suggestions: string[] = [];

  if (readiness.dimensions.problemClarity.score < 20) {
    suggestions.push("Clarify the problem you're solving and the pain points");
  }
  if (readiness.dimensions.solutionDefinition.score < 20) {
    suggestions.push("Describe your solution approach and key features");
  }
  if (readiness.dimensions.userUnderstanding.score < 20) {
    suggestions.push("Define who your target users are and their needs");
  }
  if (readiness.dimensions.scopeBoundaries.score < 20) {
    suggestions.push(
      "Consider what's in scope for MVP and what's out of scope",
    );
  }

  return suggestions;
}

// Export constants for testing
export const READINESS_CONSTANTS = {
  THRESHOLD: READINESS_THRESHOLD,
  MAX_DIMENSION_SCORE,
  DIMENSION_DEFINITIONS,
};
