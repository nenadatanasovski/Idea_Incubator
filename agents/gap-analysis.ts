/**
 * Gap Analysis Agent
 *
 * Analyzes idea content and Q&A to identify untested assumptions.
 * Generates viability advisories based on gap analysis.
 */

import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo } from "../utils/logger.js";
import { getConfig } from "../config/index.js";
import { EvaluationParseError } from "../utils/errors.js";
import { v4 as uuid } from "uuid";
import {
  Assumption,
  AssumptionCategory,
  AssumptionImpact,
  AssumptionConfidence,
  GapAnalysis,
  ViabilityAdvisory,
  ViabilityRecommendation,
  ProfileContext,
  IMPACT_WEIGHTS,
  CONFIDENCE_WEIGHTS,
} from "../types/incubation.js";

const GAP_ANALYSIS_SYSTEM_PROMPT = `You are a Gap Analysis Agent for idea incubation.

Your job is to identify untested assumptions in business ideas. For each assumption, you must determine:

1. **Category**: problem, solution, market, user, technical, or execution
2. **Impact**: critical (idea fails without this), significant (major setback), or minor (nice to know)
3. **Confidence**: low (pure assumption), medium (some evidence), or high (well-validated)

Focus on assumptions that could invalidate the idea if proven wrong. Be specific and actionable.

Output valid JSON only.`;

interface AnalysisInput {
  ideaContent: string;
  answers?: Record<string, string>;
  profile?: ProfileContext;
}

/**
 * Analyze idea content and Q&A to identify assumptions
 */
export async function analyzeAssumptions(
  input: AnalysisInput,
  costTracker: CostTracker,
): Promise<GapAnalysis> {
  const config = getConfig();

  const { ideaContent, answers = {}, profile } = input;

  const answersText =
    Object.entries(answers).length > 0
      ? `\n\nAnswered Questions:\n${Object.entries(answers)
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join("\n\n")}`
      : "";

  const profileText = profile
    ? `\n\nUser Profile Context:\n${JSON.stringify(profile, null, 2)}`
    : "";

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: GAP_ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this idea and identify key assumptions that need validation:

IDEA:
${ideaContent}
${answersText}
${profileText}

Identify 5-10 key assumptions. For each, determine category, impact, and confidence level.

Respond in JSON:
{
  "assumptions": [
    {
      "text": "Assumption statement",
      "category": "problem|solution|market|user|technical|execution",
      "impact": "critical|significant|minor",
      "confidence": "low|medium|high",
      "evidence": "What evidence supports/refutes this assumption (if any)"
    }
  ]
}`,
      },
    ],
  });

  costTracker.track(response.usage, "gap-analysis");

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError(
      "Unexpected response type from gap analysis agent",
    );
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError("Could not parse gap analysis response");
  }

  let parsed: {
    assumptions: Array<{
      text: string;
      category: string;
      impact: string;
      confidence: string;
      evidence?: string;
    }>;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError("Invalid JSON in gap analysis response");
  }

  // Transform to typed assumptions
  const assumptions: Assumption[] = parsed.assumptions.map((a) => ({
    id: uuid(),
    text: a.text,
    category: a.category as AssumptionCategory,
    impact: a.impact as AssumptionImpact,
    confidence: a.confidence as AssumptionConfidence,
    evidence: a.evidence,
    addressed: false,
  }));

  // Calculate gap counts and readiness score
  const criticalGapsCount = assumptions.filter(
    (a) => a.impact === "critical" && a.confidence === "low",
  ).length;

  const significantGapsCount = assumptions.filter(
    (a) => a.impact === "significant" && a.confidence === "low",
  ).length;

  // Calculate readiness score (0-100)
  // Start at 100, deduct based on gaps
  let readinessScore = 100;
  for (const assumption of assumptions) {
    if (assumption.confidence === "low") {
      const impactWeight = IMPACT_WEIGHTS[assumption.impact];
      readinessScore -= impactWeight * 10;
    } else if (assumption.confidence === "medium") {
      const impactWeight = IMPACT_WEIGHTS[assumption.impact];
      readinessScore -= impactWeight * 3;
    }
  }
  readinessScore = Math.max(0, Math.min(100, readinessScore));

  logInfo(
    `Gap analysis complete: ${assumptions.length} assumptions identified, readiness: ${readinessScore}%`,
  );

  return {
    assumptions,
    criticalGapsCount,
    significantGapsCount,
    readinessScore,
  };
}

/**
 * Prioritize assumptions by urgency
 * Higher priority = more urgent to address
 */
export function prioritizeAssumptions(assumptions: Assumption[]): Assumption[] {
  return [...assumptions].sort((a, b) => {
    const scoreA = IMPACT_WEIGHTS[a.impact] * CONFIDENCE_WEIGHTS[a.confidence];
    const scoreB = IMPACT_WEIGHTS[b.impact] * CONFIDENCE_WEIGHTS[b.confidence];
    return scoreB - scoreA; // Higher score = higher priority = first
  });
}

/**
 * Get critical gaps (critical impact + low confidence)
 */
export function getCriticalGaps(assumptions: Assumption[]): Assumption[] {
  return assumptions.filter(
    (a) => a.impact === "critical" && a.confidence === "low",
  );
}

/**
 * Generate viability advisory based on gap analysis
 */
export function generateViabilityAdvisory(
  gapAnalysis: GapAnalysis,
): ViabilityAdvisory {
  const {
    assumptions,
    criticalGapsCount,
    significantGapsCount,
    readinessScore,
  } = gapAnalysis;

  // Get gaps for display
  const criticalGaps = assumptions.filter(
    (a) => a.impact === "critical" && a.confidence === "low",
  );
  const significantGaps = assumptions.filter(
    (a) => a.impact === "significant" && a.confidence === "low",
  );

  // Determine recommendation
  let recommendation: ViabilityRecommendation;
  let reasoning: string;

  if (criticalGapsCount >= 2) {
    recommendation = "research_more";
    reasoning = `Found ${criticalGapsCount} critical assumptions with low confidence. These could invalidate the idea if proven wrong. Recommend addressing these gaps before proceeding.`;
  } else if (criticalGapsCount === 1) {
    recommendation = "research_more";
    reasoning = `Found 1 critical assumption with low confidence. This is a key risk that should be addressed before evaluation.`;
  } else if (readinessScore < 50) {
    recommendation = "pause";
    reasoning = `Overall readiness score is ${readinessScore}%. Too many unvalidated assumptions to proceed effectively. Consider pausing to gather more information.`;
  } else if (significantGapsCount >= 3) {
    recommendation = "research_more";
    reasoning = `Found ${significantGapsCount} significant gaps. While not critical, addressing these will improve evaluation accuracy.`;
  } else {
    recommendation = "proceed";
    reasoning = `Readiness score is ${readinessScore}%. Key assumptions are reasonably validated. Ready to proceed with differentiation analysis.`;
  }

  return {
    criticalGaps,
    significantGaps,
    readinessScore,
    recommendation,
    reasoning,
  };
}

/**
 * Calculate priority score for an assumption
 */
export function calculatePriorityScore(assumption: Assumption): number {
  return (
    IMPACT_WEIGHTS[assumption.impact] *
    CONFIDENCE_WEIGHTS[assumption.confidence]
  );
}
