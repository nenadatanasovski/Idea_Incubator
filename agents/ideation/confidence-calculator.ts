import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  IdeaCandidate,
} from '../../types/ideation.js';

/**
 * CONFIDENCE CALCULATION
 *
 * Confidence measures how well-defined the idea is, not how good it is.
 * Range: 0-100
 * Threshold for display: 30%
 * Threshold for "ready": 75%
 */

export interface ConfidenceInput {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  candidate: Partial<IdeaCandidate> | null;
  userConfirmations: number;  // Times user expressed resonance
}

export interface ConfidenceBreakdown {
  total: number;
  components: {
    problemDefinition: number;   // 0-25 points
    targetUser: number;          // 0-20 points
    solutionDirection: number;   // 0-20 points
    differentiation: number;     // 0-20 points
    userFit: number;             // 0-15 points
  };
  missingAreas: string[];
}

// Component maximums for reference
export const CONFIDENCE_WEIGHTS = {
  problemDefinition: 25,
  targetUser: 20,
  solutionDirection: 20,
  differentiation: 20,
  userFit: 15,
} as const;

export function calculateConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const breakdown: ConfidenceBreakdown = {
    total: 0,
    components: {
      problemDefinition: 0,
      targetUser: 0,
      solutionDirection: 0,
      differentiation: 0,
      userFit: 0,
    },
    missingAreas: [],
  };

  // Safe access helpers
  const selfDiscovery = input.selfDiscovery || {} as SelfDiscoveryState;
  const marketDiscovery = input.marketDiscovery || {} as MarketDiscoveryState;
  const narrowingState = input.narrowingState || {} as NarrowingState;

  // ============================================================================
  // PROBLEM DEFINITION (0-25 points)
  // ============================================================================
  let problemScore = 0;

  // Has frustration with specifics? (+10)
  const frustrations = Array.isArray(selfDiscovery.frustrations) ? selfDiscovery.frustrations : [];
  if (frustrations.length > 0) {
    const highSeverity = frustrations.filter(f => f?.severity === 'high');
    if (highSeverity.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('specific problem or frustration');
  }

  // Market validates problem? (+10)
  const gaps = Array.isArray(marketDiscovery.gaps) ? marketDiscovery.gaps : [];
  if (gaps.length > 0) {
    const highRelevance = gaps.filter(g => g?.relevance === 'high');
    if (highRelevance.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('market-validated problem');
  }

  // Clear problem statement in candidate? (+5)
  if (input.candidate?.summary && input.candidate.summary.length > 50) {
    problemScore += 5;
  }

  breakdown.components.problemDefinition = Math.min(CONFIDENCE_WEIGHTS.problemDefinition, problemScore);

  // ============================================================================
  // TARGET USER (0-20 points)
  // ============================================================================
  let targetScore = 0;

  // Has narrowed customer type? (+10)
  const customerType = narrowingState.customerType || { value: null, confidence: 0 };
  if (customerType.value) {
    if ((customerType.confidence ?? 0) > 0.7) {
      targetScore += 10;
    } else {
      targetScore += 5;
    }
  } else {
    breakdown.missingAreas.push('clear target customer type');
  }

  // Location context established? (+5)
  const locationContext = marketDiscovery.locationContext || {};
  if (locationContext.city) {
    targetScore += 5;
  }

  // Geography narrowed? (+5)
  const geography = narrowingState.geography || { value: null };
  if (geography.value) {
    targetScore += 5;
  }

  breakdown.components.targetUser = Math.min(CONFIDENCE_WEIGHTS.targetUser, targetScore);

  // ============================================================================
  // SOLUTION DIRECTION (0-20 points)
  // ============================================================================
  let solutionScore = 0;

  // Has product type narrowed? (+7)
  const productType = narrowingState.productType || { value: null };
  if (productType.value) {
    solutionScore += 7;
  } else {
    breakdown.missingAreas.push('product type (digital/physical/service)');
  }

  // Has technical depth assessed? (+7)
  const technicalDepth = narrowingState.technicalDepth || { value: null };
  if (technicalDepth.value) {
    solutionScore += 7;
  }

  // Has title (indicates concrete direction)? (+6)
  if (input.candidate?.title && input.candidate.title.length > 5) {
    solutionScore += 6;
  } else {
    breakdown.missingAreas.push('concrete solution direction');
  }

  breakdown.components.solutionDirection = Math.min(CONFIDENCE_WEIGHTS.solutionDirection, solutionScore);

  // ============================================================================
  // DIFFERENTIATION (0-20 points)
  // ============================================================================
  let diffScore = 0;

  // Competitors identified? (+8)
  const competitors = Array.isArray(marketDiscovery.competitors) ? marketDiscovery.competitors : [];
  if (competitors.length > 0) {
    diffScore += 8;
  } else {
    breakdown.missingAreas.push('competitor awareness');
  }

  // Gaps or weaknesses in competitors found? (+7)
  const hasCompetitorWeaknesses = competitors.some(c => (c?.weaknesses || []).length > 0);
  if (hasCompetitorWeaknesses) {
    diffScore += 7;
  }

  // User expertise aligns with gap? (+5)
  const expertise = Array.isArray(selfDiscovery.expertise) ? selfDiscovery.expertise : [];
  const expertiseAreas = expertise
    .filter((e: { area?: string }) => e?.area)
    .map((e: { area: string }) => e.area.toLowerCase());
  const hasExpertiseMatch = gaps.some((g: { description?: string }) =>
    g?.description && expertiseAreas.some((e: string) => g.description!.toLowerCase().includes(e))
  );
  if (hasExpertiseMatch) {
    diffScore += 5;
  }

  breakdown.components.differentiation = Math.min(CONFIDENCE_WEIGHTS.differentiation, diffScore);

  // ============================================================================
  // USER FIT (0-15 points)
  // ============================================================================
  let fitScore = 0;

  // Skills match product type? (+5)
  const skills = selfDiscovery.skills || { strengths: [], gaps: [], identified: [] };
  if ((skills.strengths || []).length > 0) {
    fitScore += 5;
  }

  // Constraints compatible? (+5)
  const constraints = selfDiscovery.constraints || { location: {}, timeHoursPerWeek: null };
  const location = constraints.location || {};
  const hasConstraintsSet =
    location.target !== null ||
    constraints.timeHoursPerWeek !== null;
  if (hasConstraintsSet) {
    fitScore += 5;
  }

  // User confirmed resonance? (+5)
  if ((input.userConfirmations ?? 0) > 0) {
    fitScore += Math.min(5, input.userConfirmations * 2);
  }

  breakdown.components.userFit = Math.min(CONFIDENCE_WEIGHTS.userFit, fitScore);

  // ============================================================================
  // TOTAL
  // ============================================================================
  breakdown.total =
    breakdown.components.problemDefinition +
    breakdown.components.targetUser +
    breakdown.components.solutionDirection +
    breakdown.components.differentiation +
    breakdown.components.userFit;

  return breakdown;
}

// Helper to check if confidence threshold is met for display
export function shouldDisplayCandidate(confidence: number): boolean {
  return confidence >= 30;
}

// Helper to check if idea is "ready"
export function isIdeaReady(confidence: number): boolean {
  return confidence >= 75;
}

// Helper to check if capture is enabled
export function isCaptureEnabled(confidence: number): boolean {
  return confidence >= 60;
}
