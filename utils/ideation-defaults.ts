import { SelfDiscoveryState, MarketDiscoveryState, NarrowingState } from '../types/ideation.js';

export function createDefaultSelfDiscoveryState(): SelfDiscoveryState {
  return {
    impactVision: {
      level: null,
      description: null,
      confidence: 0,
    },
    frustrations: [],
    expertise: [],
    interests: [],
    skills: {
      identified: [],
      gaps: [],
      strengths: [],
    },
    constraints: {
      location: { fixed: false, target: null },
      timeHoursPerWeek: null,
      capital: null,
      riskTolerance: null,
    },
  };
}

export function createDefaultMarketDiscoveryState(): MarketDiscoveryState {
  return {
    competitors: [],
    gaps: [],
    timingSignals: [],
    failedAttempts: [],
    locationContext: {
      city: null,
      jobMarketTrends: null,
      localOpportunities: [],
      marketPresence: null,
    },
  };
}

export function createDefaultNarrowingState(): NarrowingState {
  return {
    productType: { value: null, confidence: 0 },
    customerType: { value: null, confidence: 0 },
    geography: { value: null, confidence: 0 },
    scale: { value: null, confidence: 0 },
    technicalDepth: { value: null, confidence: 0 },
    hypotheses: [],
    questionsNeeded: [],
  };
}
