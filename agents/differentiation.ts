/**
 * Differentiation Agent
 *
 * Analyzes market and identifies differentiation opportunities.
 * Only runs after viability gate passes (readiness >= 50).
 */

import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo, logWarning } from "../utils/logger.js";
import { getConfig } from "../config/index.js";
import { EvaluationParseError } from "../utils/errors.js";
import {
  GapAnalysis,
  ProfileContext,
  DifferentiationAnalysis,
  Opportunity,
  Strategy,
  Risk,
} from "../types/incubation.js";

const DIFFERENTIATION_SYSTEM_PROMPT = `You are a Differentiation Analysis Agent for idea incubation.

Your job is to analyze market positioning and identify differentiation opportunities using a comprehensive 5W+H framework:
- WHAT: Specific market opportunities and positioning strategies
- WHY: Strategic rationale, market dynamics, and value propositions
- HOW: Implementation approach, execution steps, and tactics
- WHEN: Timing considerations, market windows, and milestones
- WHERE: Geographic/segment focus, channels, and go-to-market
- HOW MUCH: Resource requirements, investment needs, expected ROI

You should:
1. Research the competitive landscape thoroughly
2. Identify market gaps where the idea could differentiate
3. Assess competitive risks (how incumbents might respond)
4. Recommend differentiation strategies ranked by fit with user profile
5. Provide actionable 5W+H guidance for each strategy

Be specific, actionable, and realistic. Include concrete numbers, timelines, and resource estimates where possible.

Output valid JSON only.`;

/**
 * Run differentiation analysis
 * Precondition: gapAnalysis.readinessScore >= 50
 */
export async function runDifferentiationAnalysis(
  ideaContent: string,
  gapAnalysis: GapAnalysis,
  answers: Record<string, string>,
  profile: ProfileContext,
  costTracker: CostTracker,
): Promise<DifferentiationAnalysis> {
  const config = getConfig();

  // Precondition check
  if (gapAnalysis.readinessScore < 50) {
    throw new Error(
      `Viability gate must pass first (readiness: ${gapAnalysis.readinessScore}%, required: 50%)`,
    );
  }

  logInfo("Running differentiation analysis...");

  const answersText =
    Object.entries(answers).length > 0
      ? `\n\nAnswered Questions:\n${Object.entries(answers)
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join("\n\n")}`
      : "";

  const profileText = `
User Profile:
- Goals: ${profile.goals?.join(", ") || "Not specified"}
- Skills: ${profile.skills?.join(", ") || "Not specified"}
- Network: ${profile.network?.join(", ") || "Not specified"}
- Constraints: ${profile.constraints?.join(", ") || "Not specified"}
- Interests: ${profile.interests?.join(", ") || "Not specified"}`;

  const gapSummary = `
Gap Analysis Summary:
- Readiness Score: ${gapAnalysis.readinessScore}%
- Critical Gaps: ${gapAnalysis.criticalGapsCount}
- Significant Gaps: ${gapAnalysis.significantGapsCount}
- Key Assumptions: ${gapAnalysis.assumptions
    .slice(0, 5)
    .map((a) => a.text)
    .join("; ")}`;

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4500,
    system: DIFFERENTIATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze market positioning and differentiation opportunities for this idea:

IDEA:
${ideaContent}
${answersText}
${profileText}
${gapSummary}

Provide comprehensive analysis using the 5W+H framework:
1. 3-5 market opportunities where this idea could differentiate
2. 3-5 competitive risks (how incumbents might respond)
3. 3-5 differentiation strategies with full 5W+H breakdown, ranked by fit with user profile

Respond in JSON:
{
  "marketOpportunities": [
    {
      "description": "Detailed market opportunity description",
      "targetSegment": "Specific user segment this targets",
      "potentialImpact": "high|medium|low",
      "feasibility": "high|medium|low",
      "why": "Why this opportunity exists and why it matters",
      "marketSize": "Estimated market size or number of potential users",
      "timing": "Why now is a good time to pursue this"
    }
  ],
  "competitiveRisks": [
    {
      "description": "Risk description",
      "likelihood": "high|medium|low",
      "severity": "high|medium|low",
      "mitigation": "Specific actions to mitigate this risk",
      "competitors": ["Names of competitors who pose this risk"],
      "timeframe": "When this risk might materialize"
    }
  ],
  "differentiationStrategies": [
    {
      "name": "Strategy name",
      "description": "What this strategy entails",
      "differentiators": ["Key differentiator 1", "Key differentiator 2"],
      "tradeoffs": ["Tradeoff 1", "Tradeoff 2"],
      "fitWithProfile": 1-10,
      "fiveWH": {
        "what": "Exactly what you would do/build/offer",
        "why": "Strategic rationale and value proposition",
        "how": "Step-by-step implementation approach",
        "when": "Timeline with key milestones (e.g., 'Month 1-2: MVP, Month 3-6: Launch')",
        "where": "Target markets, channels, and go-to-market approach",
        "howMuch": "Resource estimate (time, money, team) and expected ROI"
      }
    }
  ],
  "marketTiming": {
    "currentWindow": "Description of current market opportunity window",
    "urgency": "high|medium|low",
    "keyTrends": ["Trend 1", "Trend 2"],
    "recommendation": "When to enter and why"
  },
  "summary": "Executive summary of differentiation analysis"
}`,
      },
    ],
  });

  costTracker.track(response.usage, "differentiation-analysis");

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError(
      "Unexpected response type from differentiation agent",
    );
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError("Could not parse differentiation response");
  }

  let parsed: {
    marketOpportunities: Array<{
      description: string;
      targetSegment: string;
      potentialImpact: string;
      feasibility: string;
      why?: string;
      marketSize?: string;
      timing?: string;
    }>;
    competitiveRisks: Array<{
      description: string;
      likelihood: string;
      severity: string;
      mitigation?: string;
      competitors?: string[];
      timeframe?: string;
    }>;
    differentiationStrategies: Array<{
      name: string;
      description: string;
      differentiators: string[];
      tradeoffs: string[];
      fitWithProfile: number;
      fiveWH?: {
        what?: string;
        why?: string;
        how?: string;
        when?: string;
        where?: string;
        howMuch?: string;
      };
    }>;
    marketTiming?: {
      currentWindow: string;
      urgency: string;
      keyTrends: string[];
      recommendation: string;
    };
    summary: string;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError("Invalid JSON in differentiation response");
  }

  // Transform to typed structures with extended fields
  const marketOpportunities: Opportunity[] = parsed.marketOpportunities.map(
    (o) => ({
      description: o.description,
      targetSegment: o.targetSegment,
      potentialImpact: normalizeLevel(o.potentialImpact),
      feasibility: normalizeLevel(o.feasibility),
      why: o.why,
      marketSize: o.marketSize,
      timing: o.timing,
    }),
  );

  const competitiveRisks: Risk[] = parsed.competitiveRisks.map((r) => ({
    description: r.description,
    likelihood: normalizeLevel(r.likelihood),
    severity: normalizeLevel(r.severity),
    mitigation: r.mitigation,
    competitors: r.competitors,
    timeframe: r.timeframe,
  }));

  const differentiationStrategies: Strategy[] = parsed.differentiationStrategies
    .map((s) => ({
      name: s.name,
      description: s.description,
      differentiators: s.differentiators,
      tradeoffs: s.tradeoffs,
      fitWithProfile: Math.max(1, Math.min(10, s.fitWithProfile)),
      fiveWH: s.fiveWH,
    }))
    .sort((a, b) => b.fitWithProfile - a.fitWithProfile); // Sort by fit

  logInfo(
    `Differentiation analysis complete: ${marketOpportunities.length} opportunities, ${differentiationStrategies.length} strategies`,
  );

  return {
    marketOpportunities,
    competitiveRisks,
    differentiationStrategies,
    summary: parsed.summary,
    marketTiming: parsed.marketTiming
      ? {
          ...parsed.marketTiming,
          urgency: normalizeLevel(parsed.marketTiming.urgency),
        }
      : undefined,
  };
}

/**
 * Normalize level string to typed enum
 */
function normalizeLevel(level: string): "high" | "medium" | "low" {
  const normalized = level.toLowerCase().trim();
  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  logWarning(`Unknown level "${level}", defaulting to medium`);
  return "medium";
}

/**
 * Format differentiation analysis for display
 */
export function formatDifferentiationAnalysis(
  analysis: DifferentiationAnalysis,
): string {
  let output = `
## Differentiation Analysis

### Summary
${analysis.summary}

### Market Opportunities
`;

  for (const opp of analysis.marketOpportunities) {
    output += `
**${opp.targetSegment}**
${opp.description}
- Impact: ${opp.potentialImpact.toUpperCase()}
- Feasibility: ${opp.feasibility.toUpperCase()}
`;
  }

  output += `
### Competitive Risks
`;

  for (const risk of analysis.competitiveRisks) {
    output += `
- ${risk.description}
  Likelihood: ${risk.likelihood.toUpperCase()} | Severity: ${risk.severity.toUpperCase()}
  ${risk.mitigation ? `Mitigation: ${risk.mitigation}` : ""}
`;
  }

  output += `
### Recommended Strategies
`;

  for (let i = 0; i < analysis.differentiationStrategies.length; i++) {
    const strat = analysis.differentiationStrategies[i];
    output += `
**${i + 1}. ${strat.name}** (Fit Score: ${strat.fitWithProfile}/10)
${strat.description}

Differentiators:
${strat.differentiators.map((d) => `- ${d}`).join("\n")}

Tradeoffs:
${strat.tradeoffs.map((t) => `- ${t}`).join("\n")}
`;
  }

  return output;
}
