import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  IdeaCandidate,
  ViabilityRisk,
  RiskType,
  RiskSeverity,
  WebSearchResult,
} from "../../types/ideation.js";
import { v4 as uuidv4 } from "uuid";

/**
 * VIABILITY CALCULATION
 *
 * Viability measures whether the idea is realistic and achievable.
 * Based on HARD EVIDENCE from web search.
 * Range: 0-100
 * Healthy: 75-100%
 * Caution: 50-74%
 * Warning: 25-49%
 * Critical: 0-24%
 */

export interface ViabilityInput {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  webSearchResults: WebSearchResult[];
  candidate: Partial<IdeaCandidate> | null;
}

export interface ViabilityBreakdown {
  total: number;
  components: {
    marketExists: number; // 0-25 points
    technicalFeasibility: number; // 0-20 points
    competitiveSpace: number; // 0-20 points
    resourceReality: number; // 0-20 points
    clarityScore: number; // 0-15 points
  };
  risks: ViabilityRisk[];
  requiresIntervention: boolean;
}

// Component maximums for reference
export const VIABILITY_WEIGHTS = {
  marketExists: 25,
  technicalFeasibility: 20,
  competitiveSpace: 20,
  resourceReality: 20,
  clarityScore: 15,
} as const;

// Viability thresholds
export const VIABILITY_THRESHOLDS = {
  healthy: 75,
  caution: 50,
  warning: 25,
  critical: 0,
} as const;

// Keywords that indicate impossible/unfeasible technology
const IMPOSSIBLE_KEYWORDS = [
  "does not exist",
  "impossible",
  "no solution",
  "years away",
  "not technically feasible",
  "cannot be done",
  "no way to",
  "decades of research",
];

// Keywords that indicate high capital requirements
const HIGH_CAPITAL_KEYWORDS = [
  "million",
  "funding required",
  "venture capital",
  "significant investment",
  "series a",
  "series b",
  "raised $",
];

export function calculateViability(input: ViabilityInput): ViabilityBreakdown {
  const breakdown: ViabilityBreakdown = {
    total: 100, // Start at 100, subtract for issues
    components: {
      marketExists: VIABILITY_WEIGHTS.marketExists,
      technicalFeasibility: VIABILITY_WEIGHTS.technicalFeasibility,
      competitiveSpace: VIABILITY_WEIGHTS.competitiveSpace,
      resourceReality: VIABILITY_WEIGHTS.resourceReality,
      clarityScore: VIABILITY_WEIGHTS.clarityScore,
    },
    risks: [],
    requiresIntervention: false,
  };

  const candidateId = input.candidate?.id || "";

  // ============================================================================
  // MARKET EXISTS (0-25 points, start at 25)
  // ============================================================================

  // No market data found? (-15)
  if (
    input.marketDiscovery.competitors.length === 0 &&
    input.marketDiscovery.gaps.length === 0
  ) {
    breakdown.components.marketExists -= 15;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "too_vague",
        description:
          "No market data found - market may not exist or idea is too vague",
        evidenceText:
          "Web search returned no relevant competitors or market gaps",
        severity: "high",
      }),
    );
  }

  // Failed attempts with no clear differentiation? (-10)
  const hasFailedAttempts = input.marketDiscovery.failedAttempts.length > 0;
  const hasClearDifferentiation = input.marketDiscovery.gaps.some(
    (g) => g.relevance === "high",
  );
  if (hasFailedAttempts && !hasClearDifferentiation) {
    breakdown.components.marketExists -= 10;
    const failedAttempt = input.marketDiscovery.failedAttempts[0];
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "wrong_timing",
        description: `Similar attempts have failed: ${failedAttempt.what}`,
        evidenceUrl: failedAttempt.source,
        evidenceText: failedAttempt.why,
        severity: "medium",
      }),
    );
  }

  // ============================================================================
  // TECHNICAL FEASIBILITY (0-20 points, start at 20)
  // ============================================================================

  // Check for impossible technology requirements
  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (IMPOSSIBLE_KEYWORDS.some((kw) => snippetLower.includes(kw))) {
      breakdown.components.technicalFeasibility -= 15;
      breakdown.risks.push(
        createRisk({
          candidateId,
          riskType: "impossible",
          description: "Technology may not exist or be feasible",
          evidenceUrl: result.url,
          evidenceText: result.snippet,
          severity: "critical",
        }),
      );
      break;
    }
  }

  // Skills gap detected? (-10)
  const skillGaps = input.selfDiscovery?.skills?.gaps || [];
  if (skillGaps.length > 2) {
    breakdown.components.technicalFeasibility -= 10;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "resource_mismatch",
        description: `Multiple skill gaps identified: ${skillGaps.join(", ")}`,
        evidenceText: "Based on skill assessment during conversation",
        severity: "medium",
      }),
    );
  }

  // ============================================================================
  // COMPETITIVE SPACE (0-20 points, start at 20)
  // ============================================================================

  const competitorCount = input.marketDiscovery.competitors.length;

  // More than 10 well-funded competitors? (-15)
  if (competitorCount > 10) {
    breakdown.components.competitiveSpace -= 15;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "saturated_market",
        description: `Highly competitive market with ${competitorCount}+ competitors`,
        evidenceText: `Competitors include: ${input.marketDiscovery.competitors
          .slice(0, 5)
          .map((c) => c.name)
          .join(", ")}`,
        severity: "high",
      }),
    );
  }
  // 5-10 competitors without clear gap? (-10)
  else if (
    competitorCount > 5 &&
    input.marketDiscovery.gaps.filter((g) => g.relevance === "high").length ===
      0
  ) {
    breakdown.components.competitiveSpace -= 10;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "saturated_market",
        description: `Competitive market with ${competitorCount} competitors and no clear differentiation`,
        evidenceText: "No high-relevance market gaps identified",
        severity: "medium",
      }),
    );
  }

  // ============================================================================
  // RESOURCE REALITY (0-20 points, start at 20)
  // ============================================================================

  // Check for resource requirements in search results
  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (HIGH_CAPITAL_KEYWORDS.some((kw) => snippetLower.includes(kw))) {
      if (input.selfDiscovery.constraints.capital === "bootstrap") {
        breakdown.components.resourceReality -= 15;
        breakdown.risks.push(
          createRisk({
            candidateId,
            riskType: "unrealistic",
            description:
              "Market typically requires significant capital investment",
            evidenceUrl: result.url,
            evidenceText: result.snippet,
            severity: "high",
          }),
        );
        break;
      }
    }
  }

  // Time constraints vs complexity mismatch? (-10)
  const timeHours = input.selfDiscovery.constraints.timeHoursPerWeek;
  const technicalDepth = input.narrowingState.technicalDepth.value;
  if (
    timeHours !== null &&
    timeHours < 10 &&
    technicalDepth === "full_custom"
  ) {
    breakdown.components.resourceReality -= 10;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "resource_mismatch",
        description:
          "Limited time availability vs complex technical requirements",
        evidenceText: `${timeHours} hours/week for custom development`,
        severity: "medium",
      }),
    );
  }

  // ============================================================================
  // CLARITY SCORE (0-15 points, start at 15)
  // ============================================================================

  // Can't define target user? (-10)
  if (!input.narrowingState.customerType.value) {
    breakdown.components.clarityScore -= 10;
    breakdown.risks.push(
      createRisk({
        candidateId,
        riskType: "too_vague",
        description: "Target customer not clearly defined",
        evidenceText: "Cannot validate market without clear target user",
        severity: "medium",
      }),
    );
  }

  // Can't define solution direction? (-5)
  if (!input.narrowingState.productType.value) {
    breakdown.components.clarityScore -= 5;
  }

  // ============================================================================
  // CLAMP COMPONENTS & CALCULATE TOTAL
  // ============================================================================

  breakdown.components.marketExists = Math.max(
    0,
    breakdown.components.marketExists,
  );
  breakdown.components.technicalFeasibility = Math.max(
    0,
    breakdown.components.technicalFeasibility,
  );
  breakdown.components.competitiveSpace = Math.max(
    0,
    breakdown.components.competitiveSpace,
  );
  breakdown.components.resourceReality = Math.max(
    0,
    breakdown.components.resourceReality,
  );
  breakdown.components.clarityScore = Math.max(
    0,
    breakdown.components.clarityScore,
  );

  breakdown.total =
    breakdown.components.marketExists +
    breakdown.components.technicalFeasibility +
    breakdown.components.competitiveSpace +
    breakdown.components.resourceReality +
    breakdown.components.clarityScore;

  // Intervention required if any critical risk OR total < 50
  breakdown.requiresIntervention =
    breakdown.total < VIABILITY_THRESHOLDS.caution ||
    breakdown.risks.some((r) => r.severity === "critical");

  return breakdown;
}

// Helper to create a risk with defaults
function createRisk(params: {
  candidateId: string;
  riskType: RiskType;
  description: string;
  evidenceUrl?: string;
  evidenceText?: string;
  severity: RiskSeverity;
}): ViabilityRisk {
  return {
    id: uuidv4(),
    candidateId: params.candidateId,
    riskType: params.riskType,
    description: params.description,
    evidenceUrl: params.evidenceUrl || null,
    evidenceText: params.evidenceText || null,
    severity: params.severity,
    userAcknowledged: false,
    userResponse: null,
    createdAt: new Date(),
  };
}

// Helper to get viability status label
export function getViabilityStatus(
  viability: number,
): "healthy" | "caution" | "warning" | "critical" {
  if (viability >= VIABILITY_THRESHOLDS.healthy) return "healthy";
  if (viability >= VIABILITY_THRESHOLDS.caution) return "caution";
  if (viability >= VIABILITY_THRESHOLDS.warning) return "warning";
  return "critical";
}

// Helper to check if intervention is needed
export function needsIntervention(
  viability: number,
  risks: ViabilityRisk[],
): boolean {
  return (
    viability < VIABILITY_THRESHOLDS.caution ||
    risks.some((r) => r.severity === "critical")
  );
}
