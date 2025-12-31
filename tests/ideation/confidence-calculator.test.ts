import { describe, test, expect } from 'vitest';
import {
  calculateConfidence,
  shouldDisplayCandidate,
  isIdeaReady,
  isCaptureEnabled,
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

  describe('isCaptureEnabled', () => {
    test('PASS: Returns true for confidence >= 60', () => {
      expect(isCaptureEnabled(60)).toBe(true);
      expect(isCaptureEnabled(75)).toBe(true);
      expect(isCaptureEnabled(100)).toBe(true);
    });

    test('PASS: Returns false for confidence < 60', () => {
      expect(isCaptureEnabled(0)).toBe(false);
      expect(isCaptureEnabled(30)).toBe(false);
      expect(isCaptureEnabled(59)).toBe(false);
    });
  });
});
