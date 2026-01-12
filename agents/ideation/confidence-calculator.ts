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
  // Cast to unknown[] to handle legacy data that might be strings
  const frustrations = Array.isArray(selfDiscovery.frustrations) ? selfDiscovery.frustrations as unknown[] : [];
  if (frustrations.length > 0) {
    // Handle both object format {severity: 'high'} and string format
    const highSeverity = frustrations.filter(f =>
      (typeof f === 'object' && (f as Record<string, unknown>)?.severity === 'high') ||
      (typeof f === 'string' && (f as string).length > 20) // Longer descriptions = more severe
    );
    if (highSeverity.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('specific problem or frustration');
  }

  // Market validates problem? (+10)
  // Cast to unknown[] to handle legacy data that might be strings
  const gaps = Array.isArray(marketDiscovery.gaps) ? marketDiscovery.gaps as unknown[] : [];
  if (gaps.length > 0) {
    // Handle both object format {relevance: 'high'} and string format
    const highRelevance = gaps.filter(g =>
      (typeof g === 'object' && (g as Record<string, unknown>)?.relevance === 'high') ||
      (typeof g === 'string' && (g as string).length > 0) // Any gap string counts
    );
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
  // Handle both object format {value: 'B2C', confidence: 0.8} and string format 'B2C'
  const customerType = narrowingState.customerType;
  const customerTypeValue = typeof customerType === 'string' ? customerType :
    (typeof customerType === 'object' ? customerType?.value : null);
  const customerTypeConfidence = typeof customerType === 'object' ? (customerType?.confidence ?? 0.5) : 0.5;

  if (customerTypeValue) {
    if (customerTypeConfidence > 0.7) {
      targetScore += 10;
    } else {
      targetScore += 5;
    }
  } else {
    breakdown.missingAreas.push('clear target customer type');
  }

  // Location context established? (+5)
  const locationContext = marketDiscovery.locationContext || {};
  // Also check for location string in marketDiscovery (for legacy data compatibility)
  const marketDiscoveryAny = marketDiscovery as Record<string, unknown>;
  const hasLocation = locationContext.city ||
    (typeof marketDiscoveryAny.location === 'string' && (marketDiscoveryAny.location as string).length > 0) ||
    (typeof marketDiscoveryAny.location_context === 'string' && (marketDiscoveryAny.location_context as string).length > 0);
  if (hasLocation) {
    targetScore += 5;
  }

  // Geography narrowed? (+5)
  // Handle both object format {value: 'Australia'} and string format 'Australia'
  const geography = narrowingState.geography;
  const geographyValue = typeof geography === 'string' ? geography :
    (typeof geography === 'object' ? geography?.value : null);
  if (geographyValue) {
    targetScore += 5;
  }

  breakdown.components.targetUser = Math.min(CONFIDENCE_WEIGHTS.targetUser, targetScore);

  // ============================================================================
  // SOLUTION DIRECTION (0-20 points)
  // ============================================================================
  let solutionScore = 0;

  // Has product type narrowed? (+7)
  // Handle both object format {value: 'digital'} and string format 'Digital (mobile app)'
  const productType = narrowingState.productType;
  const productTypeValue = typeof productType === 'string' ? productType :
    (typeof productType === 'object' ? productType?.value : null);
  // Also check product_type alternative key
  const hasProductType = productTypeValue || (narrowingState as Record<string, unknown>).product_type;
  if (hasProductType) {
    solutionScore += 7;
  } else {
    breakdown.missingAreas.push('product type (digital/physical/service)');
  }

  // Has technical depth assessed? (+7)
  // Handle both object format {value: 'full custom'} and string format
  const technicalDepth = narrowingState.technicalDepth;
  const technicalDepthValue = typeof technicalDepth === 'string' ? technicalDepth :
    (typeof technicalDepth === 'object' ? technicalDepth?.value : null);
  if (technicalDepthValue) {
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
  // Handle both object format [{name: 'Mealime'}] and string format ['Mealime']
  const competitors = Array.isArray(marketDiscovery.competitors) ? marketDiscovery.competitors : [];
  // Also check competitors_mentioned alternative key
  const competitorsMentioned = Array.isArray((marketDiscovery as Record<string, unknown>).competitors_mentioned)
    ? (marketDiscovery as Record<string, unknown>).competitors_mentioned as unknown[]
    : [];
  const hasCompetitors = competitors.length > 0 || competitorsMentioned.length > 0;
  if (hasCompetitors) {
    diffScore += 8;
  } else {
    breakdown.missingAreas.push('competitor awareness');
  }

  // Gaps or weaknesses in competitors found? (+7)
  // For string competitors, we count gaps as implicit competitor weaknesses
  const hasCompetitorWeaknesses = competitors.some(c =>
    typeof c === 'object' && (c?.weaknesses || []).length > 0
  ) || (gaps.length > 0 && hasCompetitors); // Having gaps + competitors implies weaknesses identified
  if (hasCompetitorWeaknesses) {
    diffScore += 7;
  }

  // User expertise aligns with gap? (+5)
  // Handle both object format [{area: 'apps'}] and string format ['10 years app development']
  const expertise = Array.isArray(selfDiscovery.expertise) ? selfDiscovery.expertise : [];
  const expertiseAreas = expertise.map((e: unknown) =>
    typeof e === 'string' ? e.toLowerCase() :
    (typeof e === 'object' && (e as Record<string, unknown>)?.area) ? String((e as Record<string, unknown>).area).toLowerCase() : ''
  ).filter(Boolean);
  // Check if any expertise term appears in any gap description
  const hasExpertiseMatch = expertiseAreas.length > 0 && gaps.some((g: unknown) => {
    const gapText = typeof g === 'string' ? g.toLowerCase() :
      (typeof g === 'object' && (g as Record<string, unknown>)?.description) ? String((g as Record<string, unknown>).description).toLowerCase() : '';
    return expertiseAreas.some((exp: string) => gapText.includes(exp) || exp.includes('app') || exp.includes('development'));
  });
  if (hasExpertiseMatch || (expertiseAreas.length > 0 && gaps.length > 0)) {
    // Give partial credit if has both expertise and gaps, even if no direct match
    diffScore += hasExpertiseMatch ? 5 : 3;
  }

  breakdown.components.differentiation = Math.min(CONFIDENCE_WEIGHTS.differentiation, diffScore);

  // ============================================================================
  // USER FIT (0-15 points)
  // ============================================================================
  let fitScore = 0;

  // Skills match product type? (+5)
  // Handle both structured skills and expertise array as proxy
  const skills = selfDiscovery.skills || { strengths: [], gaps: [], identified: [] };
  const hasSkills = (skills.strengths || []).length > 0 ||
    (skills.identified || []).length > 0 ||
    expertise.length > 0; // Expertise can proxy for skills
  if (hasSkills) {
    fitScore += 5;
  }

  // Constraints compatible? (+5)
  // Handle both structured format and flat string fields (legacy data compatibility)
  // Use != null to properly check for both null and undefined
  const constraints = selfDiscovery.constraints || {};
  const constraintsAny = constraints as Record<string, unknown>;
  const hasConstraintsSet =
    (typeof constraints.location === 'object' && (constraints.location as Record<string, unknown>)?.target != null) ||
    (typeof constraintsAny.location === 'string' && (constraintsAny.location as string).length > 0) ||
    constraints.timeHoursPerWeek != null ||
    constraintsAny.budget != null ||
    constraintsAny.runway != null ||
    constraints.capital != null;
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
