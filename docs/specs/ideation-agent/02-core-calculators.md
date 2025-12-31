# Spec 2: Core Calculators (Confidence & Viability)

## Overview

This specification covers the dual metering system algorithms:
- **Confidence Calculator**: Measures how well-defined an idea is (0-100)
- **Viability Calculator**: Measures how realistic/achievable an idea is (0-100)

## Dependencies

- Spec 1: Database & Data Models (types/ideation.ts)

---

## 1. Confidence Calculator

Create file: `agents/ideation/confidence-calculator.ts`

```typescript
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

  // ============================================================================
  // PROBLEM DEFINITION (0-25 points)
  // ============================================================================
  let problemScore = 0;

  // Has frustration with specifics? (+10)
  if (input.selfDiscovery.frustrations.length > 0) {
    const highSeverity = input.selfDiscovery.frustrations.filter(f => f.severity === 'high');
    if (highSeverity.length > 0) {
      problemScore += 10;
    } else {
      problemScore += 5;
    }
  } else {
    breakdown.missingAreas.push('specific problem or frustration');
  }

  // Market validates problem? (+10)
  if (input.marketDiscovery.gaps.length > 0) {
    const highRelevance = input.marketDiscovery.gaps.filter(g => g.relevance === 'high');
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
  if (input.narrowingState.customerType.value) {
    if (input.narrowingState.customerType.confidence > 0.7) {
      targetScore += 10;
    } else {
      targetScore += 5;
    }
  } else {
    breakdown.missingAreas.push('clear target customer type');
  }

  // Location context established? (+5)
  if (input.marketDiscovery.locationContext.city) {
    targetScore += 5;
  }

  // Geography narrowed? (+5)
  if (input.narrowingState.geography.value) {
    targetScore += 5;
  }

  breakdown.components.targetUser = Math.min(CONFIDENCE_WEIGHTS.targetUser, targetScore);

  // ============================================================================
  // SOLUTION DIRECTION (0-20 points)
  // ============================================================================
  let solutionScore = 0;

  // Has product type narrowed? (+7)
  if (input.narrowingState.productType.value) {
    solutionScore += 7;
  } else {
    breakdown.missingAreas.push('product type (digital/physical/service)');
  }

  // Has technical depth assessed? (+7)
  if (input.narrowingState.technicalDepth.value) {
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
  if (input.marketDiscovery.competitors.length > 0) {
    diffScore += 8;
  } else {
    breakdown.missingAreas.push('competitor awareness');
  }

  // Gaps or weaknesses in competitors found? (+7)
  const hasCompetitorWeaknesses = input.marketDiscovery.competitors.some(c => c.weaknesses.length > 0);
  if (hasCompetitorWeaknesses) {
    diffScore += 7;
  }

  // User expertise aligns with gap? (+5)
  const expertiseAreas = input.selfDiscovery.expertise.map(e => e.area.toLowerCase());
  const hasExpertiseMatch = input.marketDiscovery.gaps.some(g =>
    expertiseAreas.some(e => g.description.toLowerCase().includes(e))
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
  if (input.selfDiscovery.skills.strengths.length > 0) {
    fitScore += 5;
  }

  // Constraints compatible? (+5)
  const hasConstraintsSet =
    input.selfDiscovery.constraints.location.target !== null ||
    input.selfDiscovery.constraints.timeHoursPerWeek !== null;
  if (hasConstraintsSet) {
    fitScore += 5;
  }

  // User confirmed resonance? (+5)
  if (input.userConfirmations > 0) {
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
```

---

## 2. Viability Calculator

Create file: `agents/ideation/viability-calculator.ts`

```typescript
import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  IdeaCandidate,
  ViabilityRisk,
  RiskType,
  RiskSeverity,
  WebSearchResult,
} from '../../types/ideation.js';
import { v4 as uuidv4 } from 'uuid';

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
    marketExists: number;           // 0-25 points
    technicalFeasibility: number;   // 0-20 points
    competitiveSpace: number;       // 0-20 points
    resourceReality: number;        // 0-20 points
    clarityScore: number;           // 0-15 points
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
  'does not exist',
  'impossible',
  'no solution',
  'years away',
  'not technically feasible',
  'cannot be done',
  'no way to',
  'decades of research',
];

// Keywords that indicate high capital requirements
const HIGH_CAPITAL_KEYWORDS = [
  'million',
  'funding required',
  'venture capital',
  'significant investment',
  'series a',
  'series b',
  'raised $',
];

export function calculateViability(input: ViabilityInput): ViabilityBreakdown {
  const breakdown: ViabilityBreakdown = {
    total: 100,  // Start at 100, subtract for issues
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

  const candidateId = input.candidate?.id || '';

  // ============================================================================
  // MARKET EXISTS (0-25 points, start at 25)
  // ============================================================================

  // No market data found? (-15)
  if (input.marketDiscovery.competitors.length === 0 &&
      input.marketDiscovery.gaps.length === 0) {
    breakdown.components.marketExists -= 15;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'too_vague',
      description: 'No market data found - market may not exist or idea is too vague',
      evidenceText: 'Web search returned no relevant competitors or market gaps',
      severity: 'high',
    }));
  }

  // Failed attempts with no clear differentiation? (-10)
  const hasFailedAttempts = input.marketDiscovery.failedAttempts.length > 0;
  const hasClearDifferentiation = input.marketDiscovery.gaps.some(g => g.relevance === 'high');
  if (hasFailedAttempts && !hasClearDifferentiation) {
    breakdown.components.marketExists -= 10;
    const failedAttempt = input.marketDiscovery.failedAttempts[0];
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'wrong_timing',
      description: `Similar attempts have failed: ${failedAttempt.what}`,
      evidenceUrl: failedAttempt.source,
      evidenceText: failedAttempt.why,
      severity: 'medium',
    }));
  }

  // ============================================================================
  // TECHNICAL FEASIBILITY (0-20 points, start at 20)
  // ============================================================================

  // Check for impossible technology requirements
  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (IMPOSSIBLE_KEYWORDS.some(kw => snippetLower.includes(kw))) {
      breakdown.components.technicalFeasibility -= 15;
      breakdown.risks.push(createRisk({
        candidateId,
        riskType: 'impossible',
        description: 'Technology may not exist or be feasible',
        evidenceUrl: result.url,
        evidenceText: result.snippet,
        severity: 'critical',
      }));
      break;
    }
  }

  // Skills gap detected? (-10)
  if (input.selfDiscovery.skills.gaps.length > 2) {
    breakdown.components.technicalFeasibility -= 10;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'resource_mismatch',
      description: `Multiple skill gaps identified: ${input.selfDiscovery.skills.gaps.join(', ')}`,
      evidenceText: 'Based on skill assessment during conversation',
      severity: 'medium',
    }));
  }

  // ============================================================================
  // COMPETITIVE SPACE (0-20 points, start at 20)
  // ============================================================================

  const competitorCount = input.marketDiscovery.competitors.length;

  // More than 10 well-funded competitors? (-15)
  if (competitorCount > 10) {
    breakdown.components.competitiveSpace -= 15;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'saturated_market',
      description: `Highly competitive market with ${competitorCount}+ competitors`,
      evidenceText: `Competitors include: ${input.marketDiscovery.competitors.slice(0, 5).map(c => c.name).join(', ')}`,
      severity: 'high',
    }));
  }
  // 5-10 competitors without clear gap? (-10)
  else if (competitorCount > 5 &&
           input.marketDiscovery.gaps.filter(g => g.relevance === 'high').length === 0) {
    breakdown.components.competitiveSpace -= 10;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'saturated_market',
      description: `Competitive market with ${competitorCount} competitors and no clear differentiation`,
      evidenceText: 'No high-relevance market gaps identified',
      severity: 'medium',
    }));
  }

  // ============================================================================
  // RESOURCE REALITY (0-20 points, start at 20)
  // ============================================================================

  // Check for resource requirements in search results
  for (const result of input.webSearchResults) {
    const snippetLower = result.snippet.toLowerCase();
    if (HIGH_CAPITAL_KEYWORDS.some(kw => snippetLower.includes(kw))) {
      if (input.selfDiscovery.constraints.capital === 'bootstrap') {
        breakdown.components.resourceReality -= 15;
        breakdown.risks.push(createRisk({
          candidateId,
          riskType: 'unrealistic',
          description: 'Market typically requires significant capital investment',
          evidenceUrl: result.url,
          evidenceText: result.snippet,
          severity: 'high',
        }));
        break;
      }
    }
  }

  // Time constraints vs complexity mismatch? (-10)
  const timeHours = input.selfDiscovery.constraints.timeHoursPerWeek;
  const technicalDepth = input.narrowingState.technicalDepth.value;
  if (timeHours !== null && timeHours < 10 && technicalDepth === 'full_custom') {
    breakdown.components.resourceReality -= 10;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'resource_mismatch',
      description: 'Limited time availability vs complex technical requirements',
      evidenceText: `${timeHours} hours/week for custom development`,
      severity: 'medium',
    }));
  }

  // ============================================================================
  // CLARITY SCORE (0-15 points, start at 15)
  // ============================================================================

  // Can't define target user? (-10)
  if (!input.narrowingState.customerType.value) {
    breakdown.components.clarityScore -= 10;
    breakdown.risks.push(createRisk({
      candidateId,
      riskType: 'too_vague',
      description: 'Target customer not clearly defined',
      evidenceText: 'Cannot validate market without clear target user',
      severity: 'medium',
    }));
  }

  // Can't define solution direction? (-5)
  if (!input.narrowingState.productType.value) {
    breakdown.components.clarityScore -= 5;
  }

  // ============================================================================
  // CLAMP COMPONENTS & CALCULATE TOTAL
  // ============================================================================

  breakdown.components.marketExists = Math.max(0, breakdown.components.marketExists);
  breakdown.components.technicalFeasibility = Math.max(0, breakdown.components.technicalFeasibility);
  breakdown.components.competitiveSpace = Math.max(0, breakdown.components.competitiveSpace);
  breakdown.components.resourceReality = Math.max(0, breakdown.components.resourceReality);
  breakdown.components.clarityScore = Math.max(0, breakdown.components.clarityScore);

  breakdown.total =
    breakdown.components.marketExists +
    breakdown.components.technicalFeasibility +
    breakdown.components.competitiveSpace +
    breakdown.components.resourceReality +
    breakdown.components.clarityScore;

  // Intervention required if any critical risk OR total < 50
  breakdown.requiresIntervention =
    breakdown.total < VIABILITY_THRESHOLDS.caution ||
    breakdown.risks.some(r => r.severity === 'critical');

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
export function getViabilityStatus(viability: number): 'healthy' | 'caution' | 'warning' | 'critical' {
  if (viability >= VIABILITY_THRESHOLDS.healthy) return 'healthy';
  if (viability >= VIABILITY_THRESHOLDS.caution) return 'caution';
  if (viability >= VIABILITY_THRESHOLDS.warning) return 'warning';
  return 'critical';
}

// Helper to check if intervention is needed
export function needsIntervention(viability: number, risks: ViabilityRisk[]): boolean {
  return viability < VIABILITY_THRESHOLDS.caution || risks.some(r => r.severity === 'critical');
}
```

---

## 3. Token Counter

Create file: `agents/ideation/token-counter.ts`

```typescript
import { IdeationMessage } from '../../types/ideation.js';

/**
 * TOKEN COUNTING & HANDOFF
 *
 * Context limit: 100,000 tokens
 * Handoff trigger: 80,000 tokens (80%)
 */

export const CONTEXT_LIMIT = 100_000;
export const HANDOFF_THRESHOLD = 80_000;
export const SYSTEM_PROMPT_ESTIMATE = 5_000;
export const PROFILE_ESTIMATE = 2_000;
export const MEMORY_FILES_ESTIMATE = 10_000;

export interface TokenUsage {
  systemPrompt: number;
  profile: number;
  memoryFiles: number;
  conversation: number;
  currentMessage: number;
  total: number;
  percentUsed: number;
  shouldHandoff: boolean;
}

/**
 * Estimate token count from text.
 * Simple estimation: ~4 characters per token for English text.
 * This is a rough approximation; actual tokenization varies by model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total token usage for a session.
 */
export function calculateTokenUsage(
  conversationHistory: IdeationMessage[],
  currentMessage: string
): TokenUsage {
  const conversationTokens = conversationHistory.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const currentMessageTokens = estimateTokens(currentMessage);

  const total =
    SYSTEM_PROMPT_ESTIMATE +
    PROFILE_ESTIMATE +
    MEMORY_FILES_ESTIMATE +
    conversationTokens +
    currentMessageTokens;

  return {
    systemPrompt: SYSTEM_PROMPT_ESTIMATE,
    profile: PROFILE_ESTIMATE,
    memoryFiles: MEMORY_FILES_ESTIMATE,
    conversation: conversationTokens,
    currentMessage: currentMessageTokens,
    total,
    percentUsed: (total / CONTEXT_LIMIT) * 100,
    shouldHandoff: total >= HANDOFF_THRESHOLD,
  };
}

/**
 * Get remaining tokens available in context.
 */
export function getRemainingTokens(usage: TokenUsage): number {
  return Math.max(0, CONTEXT_LIMIT - usage.total);
}

/**
 * Check if we should trigger a handoff soon (within 5% of threshold).
 */
export function isApproachingHandoff(usage: TokenUsage): boolean {
  const threshold = HANDOFF_THRESHOLD * 0.95; // 95% of handoff threshold
  return usage.total >= threshold && !usage.shouldHandoff;
}
```

---

## 4. Test Plan

### 4.1 Confidence Calculator Tests

Create file: `tests/ideation/confidence-calculator.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import {
  calculateConfidence,
  shouldDisplayCandidate,
  isIdeaReady,
  ConfidenceInput,
  CONFIDENCE_WEIGHTS,
} from '../../agents/ideation/confidence-calculator.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBaseInput(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    selfDiscovery: createDefaultSelfDiscoveryState(),
    marketDiscovery: createDefaultMarketDiscoveryState(),
    narrowingState: createDefaultNarrowingState(),
    candidate: null,
    userConfirmations: 0,
    ...overrides,
  };
}

function createEmptyInput(): ConfidenceInput {
  return createBaseInput();
}

function createFullInput(): ConfidenceInput {
  const selfDiscovery = createDefaultSelfDiscoveryState();
  selfDiscovery.frustrations = [
    { description: 'Specific problem', source: 'user', severity: 'high' }
  ];
  selfDiscovery.expertise = [
    { area: 'healthcare', depth: 'expert', evidence: 'worked 10 years' }
  ];
  selfDiscovery.skills.strengths = ['programming', 'design'];
  selfDiscovery.constraints.timeHoursPerWeek = 20;
  selfDiscovery.constraints.location.target = 'Sydney';

  const marketDiscovery = createDefaultMarketDiscoveryState();
  marketDiscovery.gaps = [
    { description: 'healthcare gap', evidence: 'research', relevance: 'high' }
  ];
  marketDiscovery.competitors = [
    { name: 'Competitor A', description: 'desc', strengths: ['s1'], weaknesses: ['w1'], source: 'url' }
  ];
  marketDiscovery.locationContext.city = 'Sydney';

  const narrowingState = createDefaultNarrowingState();
  narrowingState.customerType = { value: 'B2B', confidence: 0.9 };
  narrowingState.productType = { value: 'Digital', confidence: 0.8 };
  narrowingState.geography = { value: 'Australia', confidence: 0.9 };
  narrowingState.technicalDepth = { value: 'low_code', confidence: 0.7 };

  return {
    selfDiscovery,
    marketDiscovery,
    narrowingState,
    candidate: { id: 'cand1', title: 'Healthcare Platform Solution', summary: 'A comprehensive platform that solves the data interoperability problem in emergency departments.' },
    userConfirmations: 2,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ConfidenceCalculator', () => {
  describe('calculateConfidence', () => {

    // =========================================================================
    // PROBLEM DEFINITION COMPONENT (0-25 points)
    // =========================================================================

    test('PASS: High-severity frustration adds 10 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [{ description: 'X', source: 'user', severity: 'high' }];

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(10);
    });

    test('PASS: Medium-severity frustration adds only 5 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [{ description: 'X', source: 'user', severity: 'medium' }];

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.problemDefinition).toBeLessThan(10);
      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(5);
    });

    test('PASS: Low-severity frustration adds only 5 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [{ description: 'X', source: 'user', severity: 'low' }];

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(5);
      expect(result.components.problemDefinition).toBeLessThan(10);
    });

    test('PASS: No frustrations = 0 for that sub-component, flags missing area', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);

      expect(result.missingAreas).toContain('specific problem or frustration');
    });

    test('PASS: High-relevance market gap adds 10 points', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.gaps = [{ description: 'Gap', evidence: 'url', relevance: 'high' }];

      const input = createBaseInput({ marketDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(10);
    });

    test('PASS: Candidate summary > 50 chars adds 5 points', () => {
      const candidate = { id: 'c1', summary: 'This is a summary that is longer than fifty characters to trigger the bonus.' };

      const input = createBaseInput({ candidate });
      const result = calculateConfidence(input);

      // At least 5 from summary (other components may be 0)
      expect(result.components.problemDefinition).toBeGreaterThanOrEqual(5);
    });

    // =========================================================================
    // TARGET USER COMPONENT (0-20 points)
    // =========================================================================

    test('PASS: Narrowed customer type with high confidence adds 10 points', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: 'B2B', confidence: 0.8 };

      const input = createBaseInput({ narrowingState });
      const result = calculateConfidence(input);

      expect(result.components.targetUser).toBeGreaterThanOrEqual(10);
    });

    test('PASS: Narrowed customer type with low confidence adds 5 points', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: 'B2B', confidence: 0.5 };

      const input = createBaseInput({ narrowingState });
      const result = calculateConfidence(input);

      expect(result.components.targetUser).toBeGreaterThanOrEqual(5);
      expect(result.components.targetUser).toBeLessThan(10);
    });

    test('PASS: No customer type = missing area flagged', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);

      expect(result.missingAreas).toContain('clear target customer type');
    });

    test('PASS: Location context adds 5 points', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.locationContext.city = 'Sydney';

      const input = createBaseInput({ marketDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.targetUser).toBeGreaterThanOrEqual(5);
    });

    test('PASS: Geography narrowed adds 5 points', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.geography = { value: 'Australia', confidence: 0.9 };

      const input = createBaseInput({ narrowingState });
      const result = calculateConfidence(input);

      expect(result.components.targetUser).toBeGreaterThanOrEqual(5);
    });

    // =========================================================================
    // SOLUTION DIRECTION COMPONENT (0-20 points)
    // =========================================================================

    test('PASS: Product type adds 7 points', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.productType = { value: 'Digital', confidence: 0.8 };

      const input = createBaseInput({ narrowingState });
      const result = calculateConfidence(input);

      expect(result.components.solutionDirection).toBeGreaterThanOrEqual(7);
    });

    test('PASS: No product type = missing area flagged', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);

      expect(result.missingAreas).toContain('product type (digital/physical/service)');
    });

    test('PASS: Technical depth adds 7 points', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.technicalDepth = { value: 'no_code', confidence: 0.7 };

      const input = createBaseInput({ narrowingState });
      const result = calculateConfidence(input);

      expect(result.components.solutionDirection).toBeGreaterThanOrEqual(7);
    });

    test('PASS: Candidate title > 5 chars adds 6 points', () => {
      const candidate = { id: 'c1', title: 'My Awesome Idea' };

      const input = createBaseInput({ candidate });
      const result = calculateConfidence(input);

      expect(result.components.solutionDirection).toBeGreaterThanOrEqual(6);
    });

    // =========================================================================
    // DIFFERENTIATION COMPONENT (0-20 points)
    // =========================================================================

    test('PASS: Competitors identified adds 8 points', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = [
        { name: 'CompA', description: 'd', strengths: [], weaknesses: [], source: 'url' }
      ];

      const input = createBaseInput({ marketDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.differentiation).toBeGreaterThanOrEqual(8);
    });

    test('PASS: No competitors = missing area flagged', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);

      expect(result.missingAreas).toContain('competitor awareness');
    });

    test('PASS: Competitor weaknesses adds 7 points', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = [
        { name: 'CompA', description: 'd', strengths: [], weaknesses: ['slow', 'expensive'], source: 'url' }
      ];

      const input = createBaseInput({ marketDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.differentiation).toBeGreaterThanOrEqual(15); // 8 + 7
    });

    test('PASS: Expertise matching gap adds 5 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.expertise = [{ area: 'healthcare', depth: 'expert', evidence: 'test' }];

      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.gaps = [{ description: 'Gap in healthcare data', evidence: 'url', relevance: 'medium' }];

      const input = createBaseInput({ selfDiscovery, marketDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.differentiation).toBeGreaterThanOrEqual(5);
    });

    // =========================================================================
    // USER FIT COMPONENT (0-15 points)
    // =========================================================================

    test('PASS: Skills strengths adds 5 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.skills.strengths = ['programming'];

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.userFit).toBeGreaterThanOrEqual(5);
    });

    test('PASS: Constraints set adds 5 points', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.timeHoursPerWeek = 20;

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.components.userFit).toBeGreaterThanOrEqual(5);
    });

    test('PASS: User confirmations add up to 5 points (2 per confirmation)', () => {
      const input = createBaseInput({ userConfirmations: 3 });
      const result = calculateConfidence(input);

      // 3 confirmations * 2 = 6, capped at 5
      expect(result.components.userFit).toBeGreaterThanOrEqual(5);
    });

    test('PASS: Single confirmation adds 2 points', () => {
      const input = createBaseInput({ userConfirmations: 1 });
      const result = calculateConfidence(input);

      expect(result.components.userFit).toBeGreaterThanOrEqual(2);
    });

    // =========================================================================
    // TOTAL SCORE
    // =========================================================================

    test('PASS: Empty input returns 0 total', () => {
      const input = createEmptyInput();
      const result = calculateConfidence(input);

      expect(result.total).toBe(0);
    });

    test('PASS: Full input returns near-100 total', () => {
      const input = createFullInput();
      const result = calculateConfidence(input);

      expect(result.total).toBeGreaterThanOrEqual(90);
    });

    test('PASS: Total never exceeds 100', () => {
      const input = createFullInput();
      // Add extra data that might overflow
      input.userConfirmations = 100;

      const result = calculateConfidence(input);

      expect(result.total).toBeLessThanOrEqual(100);
    });

    test('PASS: Components are correctly capped at their maximums', () => {
      const input = createFullInput();
      const result = calculateConfidence(input);

      expect(result.components.problemDefinition).toBeLessThanOrEqual(CONFIDENCE_WEIGHTS.problemDefinition);
      expect(result.components.targetUser).toBeLessThanOrEqual(CONFIDENCE_WEIGHTS.targetUser);
      expect(result.components.solutionDirection).toBeLessThanOrEqual(CONFIDENCE_WEIGHTS.solutionDirection);
      expect(result.components.differentiation).toBeLessThanOrEqual(CONFIDENCE_WEIGHTS.differentiation);
      expect(result.components.userFit).toBeLessThanOrEqual(CONFIDENCE_WEIGHTS.userFit);
    });

    test('PASS: Missing areas correctly identified for partial input', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [{ description: 'test', source: 'user', severity: 'high' }];

      const input = createBaseInput({ selfDiscovery });
      const result = calculateConfidence(input);

      expect(result.missingAreas.length).toBeGreaterThan(0);
      expect(result.missingAreas).toContain('clear target customer type');
      expect(result.missingAreas).toContain('competitor awareness');
    });
  });

  describe('shouldDisplayCandidate', () => {
    test('PASS: Returns true for confidence >= 30', () => {
      expect(shouldDisplayCandidate(30)).toBe(true);
      expect(shouldDisplayCandidate(50)).toBe(true);
      expect(shouldDisplayCandidate(100)).toBe(true);
    });

    test('PASS: Returns false for confidence < 30', () => {
      expect(shouldDisplayCandidate(0)).toBe(false);
      expect(shouldDisplayCandidate(15)).toBe(false);
      expect(shouldDisplayCandidate(29)).toBe(false);
    });
  });

  describe('isIdeaReady', () => {
    test('PASS: Returns true for confidence >= 75', () => {
      expect(isIdeaReady(75)).toBe(true);
      expect(isIdeaReady(90)).toBe(true);
      expect(isIdeaReady(100)).toBe(true);
    });

    test('PASS: Returns false for confidence < 75', () => {
      expect(isIdeaReady(0)).toBe(false);
      expect(isIdeaReady(50)).toBe(false);
      expect(isIdeaReady(74)).toBe(false);
    });
  });
});
```

### 4.2 Viability Calculator Tests

Create file: `tests/ideation/viability-calculator.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import {
  calculateViability,
  getViabilityStatus,
  needsIntervention,
  ViabilityInput,
  VIABILITY_WEIGHTS,
  VIABILITY_THRESHOLDS,
} from '../../agents/ideation/viability-calculator.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';
import { WebSearchResult } from '../../types/ideation.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBaseViabilityInput(overrides: Partial<ViabilityInput> = {}): ViabilityInput {
  return {
    selfDiscovery: createDefaultSelfDiscoveryState(),
    marketDiscovery: createDefaultMarketDiscoveryState(),
    narrowingState: createDefaultNarrowingState(),
    webSearchResults: [],
    candidate: { id: 'test_candidate' },
    ...overrides,
  };
}

function createHealthyViabilityInput(): ViabilityInput {
  const marketDiscovery = createDefaultMarketDiscoveryState();
  marketDiscovery.competitors = [
    { name: 'Comp1', description: 'd', strengths: [], weaknesses: ['slow'], source: 'url' }
  ];
  marketDiscovery.gaps = [
    { description: 'Clear gap', evidence: 'research', relevance: 'high' }
  ];

  const narrowingState = createDefaultNarrowingState();
  narrowingState.customerType = { value: 'B2B', confidence: 0.9 };
  narrowingState.productType = { value: 'Digital', confidence: 0.8 };

  return createBaseViabilityInput({ marketDiscovery, narrowingState });
}

function createLowViabilityInput(): ViabilityInput {
  const selfDiscovery = createDefaultSelfDiscoveryState();
  selfDiscovery.skills.gaps = ['skill1', 'skill2', 'skill3'];
  selfDiscovery.constraints.capital = 'bootstrap';

  const webSearchResults: WebSearchResult[] = [
    {
      title: 'Industry Analysis',
      url: 'http://example.com',
      snippet: 'This technology is impossible with current methods and years away from reality.',
      source: 'TechSite',
    },
  ];

  return createBaseViabilityInput({ selfDiscovery, webSearchResults });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ViabilityCalculator', () => {
  describe('calculateViability', () => {

    // =========================================================================
    // MARKET EXISTS COMPONENT
    // =========================================================================

    test('PASS: No market data reduces score by 15', () => {
      const input = createBaseViabilityInput({
        marketDiscovery: createDefaultMarketDiscoveryState(), // empty
      });
      const result = calculateViability(input);

      expect(result.components.marketExists).toBe(VIABILITY_WEIGHTS.marketExists - 15);
    });

    test('PASS: No market data creates too_vague risk', () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'too_vague')).toBe(true);
    });

    test('PASS: Failed attempts without differentiation creates wrong_timing risk', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.failedAttempts = [
        { what: 'Similar startup', why: 'No market fit', lesson: 'Timing was wrong', source: 'postmortem.com' }
      ];
      marketDiscovery.gaps = []; // No differentiation

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'wrong_timing')).toBe(true);
    });

    test('PASS: Failed attempts WITH differentiation does not create risk', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.failedAttempts = [
        { what: 'Similar startup', why: 'No market fit', lesson: 'Timing was wrong', source: 'url' }
      ];
      marketDiscovery.gaps = [
        { description: 'Clear differentiation', evidence: 'research', relevance: 'high' }
      ];

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(result.risks.filter(r => r.riskType === 'wrong_timing').length).toBe(0);
    });

    // =========================================================================
    // TECHNICAL FEASIBILITY COMPONENT
    // =========================================================================

    test('PASS: "impossible" in search results triggers critical risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Analysis',
          url: 'http://example.com',
          snippet: 'This technology is impossible with current methods',
          source: 'Expert',
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'impossible')).toBe(true);
      expect(result.risks.some(r => r.severity === 'critical')).toBe(true);
    });

    test('PASS: "does not exist" triggers impossible risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Tech Review',
          url: 'http://example.com',
          snippet: 'The required technology does not exist yet',
          source: 'TechReview',
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'impossible')).toBe(true);
    });

    test('PASS: "years away" triggers impossible risk', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Future Tech',
          url: 'http://example.com',
          snippet: 'This capability is still years away from being practical',
          source: 'FutureTech',
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'impossible')).toBe(true);
    });

    test('PASS: Multiple skill gaps (>2) reduce feasibility and create risk', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.skills.gaps = ['gap1', 'gap2', 'gap3'];

      const input = createBaseViabilityInput({ selfDiscovery });
      const result = calculateViability(input);

      expect(result.components.technicalFeasibility).toBeLessThan(VIABILITY_WEIGHTS.technicalFeasibility);
      expect(result.risks.some(r => r.riskType === 'resource_mismatch')).toBe(true);
    });

    test('PASS: Two or fewer skill gaps does not reduce feasibility', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.skills.gaps = ['gap1', 'gap2'];

      const input = createBaseViabilityInput({ selfDiscovery });
      const result = calculateViability(input);

      // Should not have resource_mismatch from skills
      const skillRisks = result.risks.filter(
        r => r.riskType === 'resource_mismatch' && r.description.includes('skill gaps')
      );
      expect(skillRisks.length).toBe(0);
    });

    // =========================================================================
    // COMPETITIVE SPACE COMPONENT
    // =========================================================================

    test('PASS: 10+ competitors triggers saturated_market risk with high severity', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 12 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: 'Desc',
        strengths: [],
        weaknesses: [],
        source: 'url',
      }));

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'saturated_market' && r.severity === 'high')).toBe(true);
    });

    test('PASS: 5-10 competitors without gaps triggers medium severity risk', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 7 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: 'Desc',
        strengths: [],
        weaknesses: [],
        source: 'url',
      }));
      marketDiscovery.gaps = []; // No gaps

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'saturated_market' && r.severity === 'medium')).toBe(true);
    });

    test('PASS: 5-10 competitors WITH high-relevance gaps does not trigger risk', () => {
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = Array.from({ length: 7 }, (_, i) => ({
        name: `Competitor ${i}`,
        description: 'Desc',
        strengths: [],
        weaknesses: [],
        source: 'url',
      }));
      marketDiscovery.gaps = [
        { description: 'Clear differentiation', evidence: 'research', relevance: 'high' }
      ];

      const input = createBaseViabilityInput({ marketDiscovery });
      const result = calculateViability(input);

      // Should not have saturated_market risk
      expect(result.risks.filter(r => r.riskType === 'saturated_market').length).toBe(0);
    });

    // =========================================================================
    // RESOURCE REALITY COMPONENT
    // =========================================================================

    test('PASS: Bootstrap user with high capital requirements = unrealistic risk', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.capital = 'bootstrap';

      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Startup Guide',
          url: 'http://example.com',
          snippet: 'Typically requires $5 million in funding to compete',
          source: 'VentureBeat',
        },
      ];

      const input = createBaseViabilityInput({ selfDiscovery, webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.some(r => r.riskType === 'unrealistic')).toBe(true);
    });

    test('PASS: Seeking funding with high capital requirements does NOT trigger risk', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.capital = 'seeking_funding';

      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Startup Guide',
          url: 'http://example.com',
          snippet: 'Typically requires million dollar funding rounds',
          source: 'VentureBeat',
        },
      ];

      const input = createBaseViabilityInput({ selfDiscovery, webSearchResults });
      const result = calculateViability(input);

      expect(result.risks.filter(r => r.riskType === 'unrealistic').length).toBe(0);
    });

    test('PASS: Low time + high complexity = resource_mismatch', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.timeHoursPerWeek = 5;

      const narrowingState = createDefaultNarrowingState();
      narrowingState.technicalDepth = { value: 'full_custom', confidence: 0.9 };

      const input = createBaseViabilityInput({ selfDiscovery, narrowingState });
      const result = calculateViability(input);

      expect(result.risks.some(r =>
        r.riskType === 'resource_mismatch' && r.description.includes('time')
      )).toBe(true);
    });

    test('PASS: Adequate time + high complexity does NOT trigger time risk', () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.constraints.timeHoursPerWeek = 30;

      const narrowingState = createDefaultNarrowingState();
      narrowingState.technicalDepth = { value: 'full_custom', confidence: 0.9 };

      const input = createBaseViabilityInput({ selfDiscovery, narrowingState });
      const result = calculateViability(input);

      expect(result.risks.filter(r =>
        r.riskType === 'resource_mismatch' && r.description.includes('time')
      ).length).toBe(0);
    });

    // =========================================================================
    // CLARITY SCORE COMPONENT
    // =========================================================================

    test('PASS: No customer type reduces clarity and creates too_vague risk', () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      expect(result.components.clarityScore).toBeLessThan(VIABILITY_WEIGHTS.clarityScore);
      expect(result.risks.some(r =>
        r.riskType === 'too_vague' && r.description.includes('customer')
      )).toBe(true);
    });

    test('PASS: No product type reduces clarity by 5', () => {
      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: 'B2B', confidence: 0.8 }; // Set customer
      // productType still null

      const input = createBaseViabilityInput({ narrowingState });
      const result = calculateViability(input);

      expect(result.components.clarityScore).toBe(VIABILITY_WEIGHTS.clarityScore - 5);
    });

    // =========================================================================
    // INTERVENTION TRIGGERS
    // =========================================================================

    test('PASS: Viability < 50 requires intervention', () => {
      const input = createLowViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeLessThan(50);
      expect(result.requiresIntervention).toBe(true);
    });

    test('PASS: Critical risk requires intervention regardless of score', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Analysis',
          url: 'http://example.com',
          snippet: 'This is technically impossible today',
          source: 'Expert',
        },
      ];

      // Add some positive signals to boost score
      const marketDiscovery = createDefaultMarketDiscoveryState();
      marketDiscovery.competitors = [{ name: 'A', description: 'd', strengths: [], weaknesses: [], source: 'url' }];
      marketDiscovery.gaps = [{ description: 'gap', evidence: 'e', relevance: 'high' }];

      const narrowingState = createDefaultNarrowingState();
      narrowingState.customerType = { value: 'B2B', confidence: 0.9 };
      narrowingState.productType = { value: 'Digital', confidence: 0.8 };

      const input = createBaseViabilityInput({ webSearchResults, marketDiscovery, narrowingState });
      const result = calculateViability(input);

      expect(result.requiresIntervention).toBe(true);
    });

    test('PASS: Healthy viability (>=75) does not require intervention', () => {
      const input = createHealthyViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeGreaterThanOrEqual(75);
      expect(result.requiresIntervention).toBe(false);
    });

    // =========================================================================
    // TOTAL SCORE
    // =========================================================================

    test('PASS: Healthy input starts at 100 and stays high', () => {
      const input = createHealthyViabilityInput();
      const result = calculateViability(input);

      expect(result.total).toBeGreaterThanOrEqual(VIABILITY_THRESHOLDS.healthy);
    });

    test('PASS: Components never go below 0', () => {
      const input = createLowViabilityInput();
      const result = calculateViability(input);

      expect(result.components.marketExists).toBeGreaterThanOrEqual(0);
      expect(result.components.technicalFeasibility).toBeGreaterThanOrEqual(0);
      expect(result.components.competitiveSpace).toBeGreaterThanOrEqual(0);
      expect(result.components.resourceReality).toBeGreaterThanOrEqual(0);
      expect(result.components.clarityScore).toBeGreaterThanOrEqual(0);
    });

    test('PASS: Total is sum of all components', () => {
      const input = createBaseViabilityInput();
      const result = calculateViability(input);

      const sum =
        result.components.marketExists +
        result.components.technicalFeasibility +
        result.components.competitiveSpace +
        result.components.resourceReality +
        result.components.clarityScore;

      expect(result.total).toBe(sum);
    });

    test('PASS: Risks include evidence URLs when available', () => {
      const webSearchResults: WebSearchResult[] = [
        {
          title: 'Analysis',
          url: 'http://example.com/evidence',
          snippet: 'This is impossible',
          source: 'Expert',
        },
      ];

      const input = createBaseViabilityInput({ webSearchResults });
      const result = calculateViability(input);

      const riskWithUrl = result.risks.find(r => r.evidenceUrl !== null);
      expect(riskWithUrl).toBeDefined();
      expect(riskWithUrl?.evidenceUrl).toBe('http://example.com/evidence');
    });
  });

  describe('getViabilityStatus', () => {
    test('PASS: Returns healthy for >= 75', () => {
      expect(getViabilityStatus(75)).toBe('healthy');
      expect(getViabilityStatus(100)).toBe('healthy');
    });

    test('PASS: Returns caution for 50-74', () => {
      expect(getViabilityStatus(50)).toBe('caution');
      expect(getViabilityStatus(74)).toBe('caution');
    });

    test('PASS: Returns warning for 25-49', () => {
      expect(getViabilityStatus(25)).toBe('warning');
      expect(getViabilityStatus(49)).toBe('warning');
    });

    test('PASS: Returns critical for 0-24', () => {
      expect(getViabilityStatus(0)).toBe('critical');
      expect(getViabilityStatus(24)).toBe('critical');
    });
  });

  describe('needsIntervention', () => {
    test('PASS: Returns true for viability < 50', () => {
      expect(needsIntervention(49, [])).toBe(true);
      expect(needsIntervention(25, [])).toBe(true);
    });

    test('PASS: Returns true for critical risk', () => {
      const criticalRisk = {
        id: 'r1',
        candidateId: 'c1',
        riskType: 'impossible' as const,
        description: 'test',
        evidenceUrl: null,
        evidenceText: null,
        severity: 'critical' as const,
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date(),
      };

      expect(needsIntervention(80, [criticalRisk])).toBe(true);
    });

    test('PASS: Returns false for healthy viability with no critical risks', () => {
      const mediumRisk = {
        id: 'r1',
        candidateId: 'c1',
        riskType: 'too_vague' as const,
        description: 'test',
        evidenceUrl: null,
        evidenceText: null,
        severity: 'medium' as const,
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date(),
      };

      expect(needsIntervention(80, [mediumRisk])).toBe(false);
    });
  });
});
```

### 4.3 Token Counter Tests

Create file: `tests/ideation/token-counter.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import {
  estimateTokens,
  calculateTokenUsage,
  getRemainingTokens,
  isApproachingHandoff,
  CONTEXT_LIMIT,
  HANDOFF_THRESHOLD,
  SYSTEM_PROMPT_ESTIMATE,
  PROFILE_ESTIMATE,
  MEMORY_FILES_ESTIMATE,
} from '../../agents/ideation/token-counter.js';
import { IdeationMessage } from '../../types/ideation.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMessage(content: string, role: 'user' | 'assistant' = 'user'): IdeationMessage {
  return {
    id: `msg_${Date.now()}`,
    sessionId: 'session_1',
    role,
    content,
    buttonsShown: null,
    buttonClicked: null,
    formShown: null,
    formResponse: null,
    tokenCount: estimateTokens(content),
    createdAt: new Date(),
  };
}

function createLongConversationHistory(targetTokens: number): IdeationMessage[] {
  const messages: IdeationMessage[] = [];
  let currentTokens = 0;

  while (currentTokens < targetTokens) {
    // Create messages of ~1000 chars (~250 tokens each)
    const content = 'a'.repeat(1000);
    messages.push(createMessage(content));
    currentTokens += estimateTokens(content);
  }

  return messages;
}

// ============================================================================
// TESTS
// ============================================================================

describe('TokenCounter', () => {
  describe('estimateTokens', () => {
    test('PASS: Returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    test('PASS: Estimates ~4 chars per token', () => {
      const text = 'a'.repeat(400); // Should be ~100 tokens
      const tokens = estimateTokens(text);

      expect(tokens).toBeGreaterThanOrEqual(90);
      expect(tokens).toBeLessThanOrEqual(110);
    });

    test('PASS: Handles short strings', () => {
      expect(estimateTokens('Hi')).toBe(1);
      expect(estimateTokens('Hello')).toBe(2);
    });

    test('PASS: Rounds up partial tokens', () => {
      const text = 'abc'; // 3 chars, should round up to 1 token
      expect(estimateTokens(text)).toBe(1);
    });
  });

  describe('calculateTokenUsage', () => {
    test('PASS: Empty conversation returns baseline tokens', () => {
      const result = calculateTokenUsage([], '');

      expect(result.total).toBe(
        SYSTEM_PROMPT_ESTIMATE + PROFILE_ESTIMATE + MEMORY_FILES_ESTIMATE
      );
    });

    test('PASS: Includes conversation history tokens', () => {
      const messages = [
        createMessage('Hello there'),
        createMessage('How are you'),
      ];
      const result = calculateTokenUsage(messages, '');

      expect(result.conversation).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(
        SYSTEM_PROMPT_ESTIMATE + PROFILE_ESTIMATE + MEMORY_FILES_ESTIMATE
      );
    });

    test('PASS: Includes current message tokens', () => {
      const result = calculateTokenUsage([], 'This is a test message');

      expect(result.currentMessage).toBeGreaterThan(0);
    });

    test('PASS: percentUsed is calculated correctly', () => {
      const result = calculateTokenUsage([], '');

      const expectedPercent = (result.total / CONTEXT_LIMIT) * 100;
      expect(result.percentUsed).toBeCloseTo(expectedPercent, 1);
    });

    test('PASS: shouldHandoff is false below threshold', () => {
      const shortHistory = [createMessage('Hello')];
      const result = calculateTokenUsage(shortHistory, 'test');

      expect(result.shouldHandoff).toBe(false);
    });

    test('PASS: shouldHandoff is true at threshold', () => {
      // Create enough tokens to exceed threshold
      const tokensNeeded = HANDOFF_THRESHOLD - SYSTEM_PROMPT_ESTIMATE - PROFILE_ESTIMATE - MEMORY_FILES_ESTIMATE;
      const longHistory = createLongConversationHistory(tokensNeeded);

      const result = calculateTokenUsage(longHistory, 'new message');

      expect(result.shouldHandoff).toBe(true);
    });

    test('PASS: All component values are positive', () => {
      const result = calculateTokenUsage([createMessage('test')], 'test');

      expect(result.systemPrompt).toBeGreaterThan(0);
      expect(result.profile).toBeGreaterThan(0);
      expect(result.memoryFiles).toBeGreaterThan(0);
      expect(result.conversation).toBeGreaterThanOrEqual(0);
      expect(result.currentMessage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRemainingTokens', () => {
    test('PASS: Returns full capacity for empty usage', () => {
      const usage = calculateTokenUsage([], '');
      const remaining = getRemainingTokens(usage);

      expect(remaining).toBe(CONTEXT_LIMIT - usage.total);
    });

    test('PASS: Never returns negative', () => {
      const usage = {
        systemPrompt: SYSTEM_PROMPT_ESTIMATE,
        profile: PROFILE_ESTIMATE,
        memoryFiles: MEMORY_FILES_ESTIMATE,
        conversation: CONTEXT_LIMIT, // Way over limit
        currentMessage: 1000,
        total: CONTEXT_LIMIT + 20000,
        percentUsed: 120,
        shouldHandoff: true,
      };

      const remaining = getRemainingTokens(usage);
      expect(remaining).toBe(0);
    });
  });

  describe('isApproachingHandoff', () => {
    test('PASS: Returns false when well below threshold', () => {
      const usage = calculateTokenUsage([], '');
      expect(isApproachingHandoff(usage)).toBe(false);
    });

    test('PASS: Returns true when within 5% of threshold', () => {
      // Target ~95% of handoff threshold
      const targetTokens = HANDOFF_THRESHOLD * 0.96 - SYSTEM_PROMPT_ESTIMATE - PROFILE_ESTIMATE - MEMORY_FILES_ESTIMATE;
      const longHistory = createLongConversationHistory(targetTokens);

      const usage = calculateTokenUsage(longHistory, '');

      expect(usage.shouldHandoff).toBe(false); // Not yet at threshold
      expect(isApproachingHandoff(usage)).toBe(true);
    });

    test('PASS: Returns false when already past threshold', () => {
      const targetTokens = HANDOFF_THRESHOLD + 1000 - SYSTEM_PROMPT_ESTIMATE - PROFILE_ESTIMATE - MEMORY_FILES_ESTIMATE;
      const longHistory = createLongConversationHistory(targetTokens);

      const usage = calculateTokenUsage(longHistory, '');

      expect(usage.shouldHandoff).toBe(true);
      expect(isApproachingHandoff(usage)).toBe(false);
    });
  });
});
```

---
