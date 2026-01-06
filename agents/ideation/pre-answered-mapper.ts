// =============================================================================
// FILE: agents/ideation/pre-answered-mapper.ts
// =============================================================================

import type { SelfDiscoveryState, MarketDiscoveryState, NarrowingState } from '../../types/ideation.js';

export interface PreAnsweredQuestion {
  questionId: string;
  answer: string;
  source: 'ideation_agent';
  confidence: number;  // 0.0-1.0
  evidenceQuotes: string[];
}

export interface IdeationSignals {
  selfDiscovery: Partial<SelfDiscoveryState>;
  marketDiscovery: Partial<MarketDiscoveryState>;
  narrowingState: Partial<NarrowingState>;
  candidateTitle?: string;
  candidateSummary?: string;
  [key: string]: unknown;
}

// Development question IDs mapped to signal extraction logic
const QUESTION_MAPPINGS: Array<{
  questionId: string;
  signalPath: string;
  transformer: (value: unknown, signals: IdeationSignals) => string | null;
  minConfidence: number;
}> = [
  // Problem-related questions
  {
    questionId: 'DEV_PROBLEM_STATEMENT',
    signalPath: 'selfDiscovery.frustrations',
    transformer: (frustrations: unknown) => {
      if (!Array.isArray(frustrations) || frustrations.length === 0) return null;
      const highSeverity = frustrations.filter((f: { severity: string }) => f.severity === 'high');
      if (highSeverity.length > 0) {
        return highSeverity.map((f: { description: string }) => f.description).join('. ');
      }
      return frustrations.slice(0, 2).map((f: { description: string }) => f.description).join('. ');
    },
    minConfidence: 0.6,
  },
  {
    questionId: 'DEV_TARGET_USER',
    signalPath: 'narrowingState.customerType',
    transformer: (customerType: unknown) => {
      if (!customerType || typeof customerType !== 'object') return null;
      const ct = customerType as { value: string | null; confidence: number };
      if (!ct.value) return null;
      const mapping: Record<string, string> = {
        'B2B': 'Businesses and organizations',
        'B2C': 'Individual consumers',
        'B2B2C': 'Businesses that serve consumers',
        'Marketplace': 'Two-sided marketplace participants',
      };
      return mapping[ct.value] || ct.value;
    },
    minConfidence: 0.7,
  },
  {
    questionId: 'DEV_TARGET_USER_DETAIL',
    signalPath: 'selfDiscovery.expertise',
    transformer: (expertise: unknown, signals: IdeationSignals) => {
      const customerType = signals.narrowingState?.customerType?.value;
      if (!customerType) return null;

      const expertiseAreas = expertise as Array<{ area: string; depth: string }> | undefined;
      if (!expertiseAreas || expertiseAreas.length === 0) return null;

      const primaryExpertise = expertiseAreas[0].area;
      return `${customerType === 'B2B' ? 'Organizations' : 'People'} in the ${primaryExpertise} space`;
    },
    minConfidence: 0.5,
  },
  // Solution-related questions
  {
    questionId: 'DEV_SOLUTION_TYPE',
    signalPath: 'narrowingState.productType',
    transformer: (productType: unknown) => {
      if (!productType || typeof productType !== 'object') return null;
      const pt = productType as { value: string | null };
      const mapping: Record<string, string> = {
        'Digital': 'Software/digital product',
        'Physical': 'Physical product',
        'Hybrid': 'Combination of digital and physical',
        'Service': 'Service-based business',
      };
      return pt.value ? (mapping[pt.value] || pt.value) : null;
    },
    minConfidence: 0.7,
  },
  {
    questionId: 'DEV_TECHNICAL_APPROACH',
    signalPath: 'narrowingState.technicalDepth',
    transformer: (technicalDepth: unknown) => {
      if (!technicalDepth || typeof technicalDepth !== 'object') return null;
      const td = technicalDepth as { value: string | null };
      const mapping: Record<string, string> = {
        'no_code': 'No-code tools (Bubble, Webflow, etc.)',
        'low_code': 'Low-code platforms with some custom development',
        'full_custom': 'Fully custom development',
      };
      return td.value ? (mapping[td.value] || td.value) : null;
    },
    minConfidence: 0.6,
  },
  // Market-related questions
  {
    questionId: 'DEV_GEOGRAPHY',
    signalPath: 'narrowingState.geography',
    transformer: (geography: unknown) => {
      if (!geography || typeof geography !== 'object') return null;
      const geo = geography as { value: string | null };
      const mapping: Record<string, string> = {
        'Local': 'Local market (single city/region)',
        'National': 'National market',
        'Global': 'Global/international market',
      };
      return geo.value ? (mapping[geo.value] || geo.value) : null;
    },
    minConfidence: 0.8,
  },
  {
    questionId: 'DEV_COMPETITORS',
    signalPath: 'marketDiscovery.competitors',
    transformer: (competitors: unknown) => {
      if (!Array.isArray(competitors) || competitors.length === 0) return null;
      return competitors
        .slice(0, 5)
        .map((c: { name: string; description?: string }) =>
          c.description ? `${c.name}: ${c.description}` : c.name
        )
        .join('\n');
    },
    minConfidence: 0.7,
  },
  {
    questionId: 'DEV_MARKET_GAP',
    signalPath: 'marketDiscovery.gaps',
    transformer: (gaps: unknown) => {
      if (!Array.isArray(gaps) || gaps.length === 0) return null;
      const highRelevance = gaps.filter((g: { relevance: string }) => g.relevance === 'high');
      if (highRelevance.length > 0) {
        return highRelevance.map((g: { description: string }) => g.description).join('. ');
      }
      return gaps.slice(0, 2).map((g: { description: string }) => g.description).join('. ');
    },
    minConfidence: 0.6,
  },
  // Personal fit questions
  {
    questionId: 'DEV_UNFAIR_ADVANTAGE',
    signalPath: 'selfDiscovery.expertise',
    transformer: (expertise: unknown) => {
      const expertiseAreas = expertise as Array<{ area: string; depth: string }> | undefined;
      if (!expertiseAreas) return null;

      const expertLevel = expertiseAreas.filter((e) => e.depth === 'expert');
      if (expertLevel.length === 0) return null;

      const areas = expertLevel.map(e => e.area).join(', ');
      return `Expert-level knowledge in: ${areas}`;
    },
    minConfidence: 0.7,
  },
  {
    questionId: 'DEV_TIME_COMMITMENT',
    signalPath: 'selfDiscovery.constraints',
    transformer: (constraints: unknown) => {
      if (!constraints || typeof constraints !== 'object') return null;
      const c = constraints as { timeHoursPerWeek?: number };
      if (c.timeHoursPerWeek === undefined || c.timeHoursPerWeek === null) return null;

      if (c.timeHoursPerWeek >= 40) return 'Full-time (40+ hours/week)';
      if (c.timeHoursPerWeek >= 20) return 'Part-time (20-40 hours/week)';
      if (c.timeHoursPerWeek >= 10) return 'Side project (10-20 hours/week)';
      return 'Hobby level (less than 10 hours/week)';
    },
    minConfidence: 0.9,
  },
  {
    questionId: 'DEV_FUNDING_APPROACH',
    signalPath: 'selfDiscovery.constraints',
    transformer: (constraints: unknown) => {
      if (!constraints || typeof constraints !== 'object') return null;
      const c = constraints as { capital?: string };
      if (!c.capital) return null;

      const mapping: Record<string, string> = {
        'bootstrap': 'Bootstrapped/self-funded',
        'seeking_funding': 'Seeking external investment',
        'have_funding': 'Already have funding secured',
      };
      return mapping[c.capital] || c.capital;
    },
    minConfidence: 0.9,
  },
  // Idea summary
  {
    questionId: 'DEV_ONE_LINE_PITCH',
    signalPath: 'candidateSummary',
    transformer: (summary: unknown) => {
      if (typeof summary !== 'string' || summary.length === 0) return null;
      return summary;
    },
    minConfidence: 0.8,
  },
];

/**
 * Generates pre-answered questions based on ideation signals
 */
export function generatePreAnsweredQuestions(
  signals: IdeationSignals
): PreAnsweredQuestion[] {
  const results: PreAnsweredQuestion[] = [];

  for (const mapping of QUESTION_MAPPINGS) {
    const value = getNestedValue(signals, mapping.signalPath);
    if (value === undefined) continue;

    const answer = mapping.transformer(value, signals);
    if (answer === null) continue;

    const confidence = calculateAnswerConfidence(signals, mapping.signalPath, mapping.minConfidence);
    if (confidence < mapping.minConfidence) continue;

    results.push({
      questionId: mapping.questionId,
      answer,
      source: 'ideation_agent',
      confidence,
      evidenceQuotes: extractEvidenceQuotes(signals, mapping.signalPath),
    });
  }

  return results;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function calculateAnswerConfidence(
  signals: IdeationSignals,
  signalPath: string,
  minRequired: number
): number {
  // Check if the signal has its own confidence value
  const value = getNestedValue(signals, signalPath);

  if (value && typeof value === 'object' && 'confidence' in value) {
    return (value as { confidence: number }).confidence;
  }

  // For arrays, confidence based on count
  if (Array.isArray(value)) {
    return Math.min(value.length * 0.2 + 0.4, 1);
  }

  // Default confidence for simple values
  return value ? minRequired + 0.1 : 0;
}

function extractEvidenceQuotes(signals: IdeationSignals, signalPath: string): string[] {
  const value = getNestedValue(signals, signalPath);

  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return (obj.quote as string) || (obj.description as string) || JSON.stringify(item);
      }
      return String(item);
    });
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.value) return [String(obj.value)];
  }

  return [];
}

/**
 * Generates the handoff data structure for Development phase
 */
export function generateDevelopmentHandoff(
  signals: IdeationSignals,
  sessionId: string,
  candidateConfidence: number,
  candidateViability: number,
  viabilityRisks: Array<{ riskType: string; description: string; severity: string }>
): {
  preAnsweredQuestions: PreAnsweredQuestion[];
  ideationMetadata: {
    sessionId: string;
    confidenceAtCapture: number;
    viabilityAtCapture: number;
    viabilityRisks: typeof viabilityRisks;
    userSuggestedIdea: boolean;
  };
} {
  return {
    preAnsweredQuestions: generatePreAnsweredQuestions(signals),
    ideationMetadata: {
      sessionId,
      confidenceAtCapture: candidateConfidence,
      viabilityAtCapture: candidateViability,
      viabilityRisks,
      userSuggestedIdea: false, // Set based on candidate.userSuggested
    },
  };
}
