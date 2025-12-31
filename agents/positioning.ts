/**
 * Positioning Agent
 *
 * Enhanced version of the differentiation agent that:
 * - Takes strategic approach as input
 * - Uses approach-specific prompts
 * - Incorporates financial allocation context
 * - Generates enhanced strategies with financial viability data
 */

import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { logInfo, logWarning } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { EvaluationParseError } from '../utils/errors.js';
import {
  GapAnalysis,
  ProfileContext,
  StrategicApproach,
  PositioningAnalysis,
  EnhancedStrategy,
  StrategicSummary,
  ValidatedOpportunity,
  Risk,
  MarketTiming,
  IdeaFinancialAllocation,
  RevenueEstimate,
  GoalAlignment,
} from '../types/incubation.js';
import {
  buildPositioningPrompt,
  buildFinancialContext,
  buildProfileContext,
} from './positioning-prompts.js';

// Re-export the legacy function for backward compatibility
export { runDifferentiationAnalysis, formatDifferentiationAnalysis } from './differentiation.js';

interface PositioningInput {
  ideaTitle: string;
  ideaSummary: string;
  ideaContent: string;
  approach: StrategicApproach;
  gapAnalysis: GapAnalysis;
  answers: Record<string, string>;
  profile?: ProfileContext;
  allocation?: IdeaFinancialAllocation;
}

/**
 * Run positioning analysis with strategic approach awareness
 */
export async function runPositioningAnalysis(
  input: PositioningInput,
  costTracker: CostTracker
): Promise<PositioningAnalysis> {
  const config = getConfig();
  const { ideaTitle, ideaSummary, ideaContent, approach, gapAnalysis, answers, profile, allocation } = input;

  // Precondition check
  if (gapAnalysis.readinessScore < 50) {
    throw new Error(`Viability gate must pass first (readiness: ${gapAnalysis.readinessScore}%, required: 50%)`);
  }

  logInfo(`Running positioning analysis with ${approach} approach...`);

  // Build context strings
  const answersText = Object.entries(answers).length > 0
    ? `\n\nAnswered Questions:\n${Object.entries(answers)
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n\n')}`
    : '';

  const fullContent = `${ideaContent}${answersText}`;
  const profileContextStr = profile ? buildProfileContext(profile) : '';
  const allocationContextStr = allocation ? buildFinancialContext(allocation) : '';

  // Build approach-specific prompt
  const { systemPrompt, userPrompt } = buildPositioningPrompt({
    approach,
    ideaTitle,
    ideaSummary,
    ideaContent: fullContent,
    profileContext: profileContextStr,
    allocationContext: allocationContextStr,
  });

  // Add gap analysis context to user prompt
  const gapSummary = `
## Gap Analysis Context
- Readiness Score: ${gapAnalysis.readinessScore}%
- Critical Gaps: ${gapAnalysis.criticalGapsCount}
- Significant Gaps: ${gapAnalysis.significantGapsCount}
- Key Assumptions: ${gapAnalysis.assumptions.slice(0, 5).map(a => a.text).join('; ')}`;

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 6000, // Larger for detailed analysis
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `${userPrompt}\n\n${gapSummary}`
    }]
  });

  costTracker.track(response.usage, 'positioning-analysis');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type from positioning agent');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse positioning response');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError('Invalid JSON in positioning response');
  }

  // Transform and validate response
  const result = transformPositioningResponse(parsed, approach);

  logInfo(`Positioning analysis complete: ${result.strategies.length} strategies generated`);

  return result;
}

/**
 * Transform raw API response to typed PositioningAnalysis
 */
function transformPositioningResponse(parsed: any, approach: StrategicApproach): PositioningAnalysis {
  // Strategic Summary
  const strategicSummary: StrategicSummary = parsed.strategicSummary ? {
    recommendedStrategy: {
      id: parsed.strategicSummary.recommendedStrategy?.id || 'recommended-1',
      name: parsed.strategicSummary.recommendedStrategy?.name || 'Unknown',
      fitScore: parsed.strategicSummary.recommendedStrategy?.fitScore || 5,
      reason: parsed.strategicSummary.recommendedStrategy?.reason || '',
    },
    primaryOpportunity: {
      id: parsed.strategicSummary.primaryOpportunity?.id || 'opp-1',
      segment: parsed.strategicSummary.primaryOpportunity?.segment || 'Unknown',
      fit: normalizeLevel(parsed.strategicSummary.primaryOpportunity?.fit || 'medium'),
    },
    criticalRisk: {
      id: parsed.strategicSummary.criticalRisk?.id || 'risk-1',
      description: parsed.strategicSummary.criticalRisk?.description || 'None identified',
      severity: normalizeLevel(parsed.strategicSummary.criticalRisk?.severity || 'medium'),
      mitigation: parsed.strategicSummary.criticalRisk?.mitigation || '',
    },
    timingAssessment: {
      urgency: normalizeLevel(parsed.strategicSummary.timingAssessment?.urgency || 'medium'),
      window: parsed.strategicSummary.timingAssessment?.window || 'Not specified',
    },
    overallConfidence: parsed.strategicSummary.overallConfidence || 0.5,
  } : {
    recommendedStrategy: { id: 'none', name: 'None', fitScore: 0, reason: 'No analysis available' },
    primaryOpportunity: { id: 'none', segment: 'Unknown', fit: 'low' },
    criticalRisk: { id: 'none', description: 'None identified', severity: 'low', mitigation: '' },
    timingAssessment: { urgency: 'low', window: 'Not specified' },
    overallConfidence: 0,
  };

  // Market Opportunities
  const marketOpportunities: ValidatedOpportunity[] = (parsed.marketOpportunities || []).map((o: any, i: number) => ({
    id: o.id || `opp-${i + 1}`,
    description: o.description || '',
    targetSegment: o.targetSegment || 'Unknown',
    potentialImpact: normalizeLevel(o.potentialImpact || 'medium'),
    feasibility: normalizeLevel(o.feasibility || 'medium'),
    why: o.why,
    marketSize: o.marketSize,
    timing: o.timing,
    validationConfidence: o.validationConfidence || 0.5,
    validationWarnings: o.validationWarnings || [],
    contradictions: o.contradictions,
  }));

  // Competitive Risks
  const competitiveRisks: Risk[] = (parsed.competitiveRisks || []).map((r: any, i: number) => ({
    id: r.id || `risk-${i + 1}`,
    description: r.description || '',
    likelihood: normalizeLevel(r.likelihood || 'medium'),
    severity: normalizeLevel(r.severity || 'medium'),
    mitigation: r.mitigation,
    competitors: r.competitors,
    timeframe: r.timeframe,
  }));

  // Enhanced Strategies
  const strategies: EnhancedStrategy[] = (parsed.strategies || []).map((s: any, i: number) => {
    const strategy: EnhancedStrategy = {
      id: s.id || `strategy-${i + 1}`,
      name: s.name || `Strategy ${i + 1}`,
      description: s.description || '',
      differentiators: s.differentiators || [],
      tradeoffs: s.tradeoffs || [],
      fitWithProfile: Math.max(1, Math.min(10, s.fitWithProfile || 5)),
      fiveWH: s.fiveWH,
      addressesOpportunities: s.addressesOpportunities || [],
      mitigatesRisks: s.mitigatesRisks || [],
      timingAlignment: normalizeTimingAlignment(s.timingAlignment),
    };

    // Add financial analysis if available
    if (s.revenueEstimates) {
      strategy.revenueEstimates = transformRevenueEstimates(s.revenueEstimates);
    }

    if (s.goalAlignment) {
      strategy.goalAlignment = transformGoalAlignment(s.goalAlignment);
    }

    if (s.profileFitBreakdown) {
      strategy.profileFitBreakdown = {
        score: s.profileFitBreakdown.score || s.fitWithProfile || 5,
        strengths: s.profileFitBreakdown.strengths || [],
        gaps: s.profileFitBreakdown.gaps || [],
        suggestions: s.profileFitBreakdown.suggestions || [],
      };
    }

    return strategy;
  }).sort((a: EnhancedStrategy, b: EnhancedStrategy) => b.fitWithProfile - a.fitWithProfile);

  // Market Timing
  const marketTiming: MarketTiming | undefined = parsed.marketTiming ? {
    currentWindow: parsed.marketTiming.currentWindow || '',
    urgency: normalizeLevel(parsed.marketTiming.urgency || 'medium'),
    keyTrends: parsed.marketTiming.keyTrends || [],
    recommendation: parsed.marketTiming.recommendation || '',
  } : undefined;

  return {
    strategicApproach: approach,
    strategicSummary,
    marketOpportunities,
    competitiveRisks,
    strategies,
    marketTiming,
    summary: parsed.summary || '',
    overallConfidence: strategicSummary.overallConfidence,
  };
}

/**
 * Transform revenue estimates from raw response
 */
function transformRevenueEstimates(raw: any): RevenueEstimate {
  return {
    year1: {
      low: raw.year1?.low || 0,
      mid: raw.year1?.mid || 0,
      high: raw.year1?.high || 0,
    },
    year3: {
      low: raw.year3?.low || 0,
      mid: raw.year3?.mid || 0,
      high: raw.year3?.high || 0,
    },
    assumptions: raw.assumptions || [],
  };
}

/**
 * Transform goal alignment from raw response
 */
function transformGoalAlignment(raw: any): GoalAlignment {
  return {
    meetsIncomeTarget: raw.meetsIncomeTarget || false,
    gapToTarget: raw.gapToTarget || null,
    timelineAlignment: normalizeTimelineAlignment(raw.timelineAlignment),
    runwaySufficient: raw.runwaySufficient || false,
    investmentFeasible: raw.investmentFeasible || false,
  };
}

/**
 * Normalize level string to typed enum
 */
function normalizeLevel(level: string): 'high' | 'medium' | 'low' {
  const normalized = (level || 'medium').toLowerCase().trim();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  logWarning(`Unknown level "${level}", defaulting to medium`);
  return 'medium';
}

/**
 * Normalize timing alignment
 */
function normalizeTimingAlignment(value: string | undefined): 'favorable' | 'neutral' | 'challenging' {
  const normalized = (value || 'neutral').toLowerCase().trim();
  if (normalized === 'favorable' || normalized === 'neutral' || normalized === 'challenging') {
    return normalized;
  }
  return 'neutral';
}

/**
 * Normalize timeline alignment
 */
function normalizeTimelineAlignment(value: string | undefined): 'faster' | 'aligned' | 'slower' | 'unlikely' {
  const normalized = (value || 'aligned').toLowerCase().trim();
  if (normalized === 'faster' || normalized === 'aligned' || normalized === 'slower' || normalized === 'unlikely') {
    return normalized;
  }
  return 'aligned';
}

/**
 * Format positioning analysis for display
 */
export function formatPositioningAnalysis(analysis: PositioningAnalysis): string {
  let output = `
## Positioning Analysis (${analysis.strategicApproach.toUpperCase()} Approach)

### Strategic Summary
- **Recommended Strategy:** ${analysis.strategicSummary.recommendedStrategy.name} (${analysis.strategicSummary.recommendedStrategy.fitScore}/10)
  ${analysis.strategicSummary.recommendedStrategy.reason}
- **Primary Opportunity:** ${analysis.strategicSummary.primaryOpportunity.segment} (${analysis.strategicSummary.primaryOpportunity.fit} fit)
- **Critical Risk:** ${analysis.strategicSummary.criticalRisk.description} (${analysis.strategicSummary.criticalRisk.severity})
- **Timing:** ${analysis.strategicSummary.timingAssessment.urgency} urgency - ${analysis.strategicSummary.timingAssessment.window}
- **Confidence:** ${Math.round(analysis.overallConfidence * 100)}%

### Summary
${analysis.summary}

### Market Opportunities
`;

  for (const opp of analysis.marketOpportunities) {
    output += `
**${opp.targetSegment}**
${opp.description}
- Impact: ${opp.potentialImpact.toUpperCase()} | Feasibility: ${opp.feasibility.toUpperCase()}
${opp.why ? `- Why: ${opp.why}` : ''}
`;
  }

  output += `
### Competitive Risks
`;

  for (const risk of analysis.competitiveRisks) {
    output += `
- **${risk.description}**
  Likelihood: ${risk.likelihood.toUpperCase()} | Severity: ${risk.severity.toUpperCase()}
  ${risk.mitigation ? `Mitigation: ${risk.mitigation}` : ''}
`;
  }

  output += `
### Recommended Strategies
`;

  for (let i = 0; i < analysis.strategies.length; i++) {
    const strat = analysis.strategies[i];
    output += `
**${i + 1}. ${strat.name}** (Fit Score: ${strat.fitWithProfile}/10)
${strat.description}

Differentiators:
${strat.differentiators.map(d => `- ${d}`).join('\n')}

Tradeoffs:
${strat.tradeoffs.map(t => `- ${t}`).join('\n')}
`;

    if (strat.fiveWH) {
      output += `
5W+H Breakdown:
${strat.fiveWH.what ? `- What: ${strat.fiveWH.what}` : ''}
${strat.fiveWH.why ? `- Why: ${strat.fiveWH.why}` : ''}
${strat.fiveWH.how ? `- How: ${strat.fiveWH.how}` : ''}
${strat.fiveWH.when ? `- When: ${strat.fiveWH.when}` : ''}
${strat.fiveWH.where ? `- Where: ${strat.fiveWH.where}` : ''}
${strat.fiveWH.howMuch ? `- How Much: ${strat.fiveWH.howMuch}` : ''}
`;
    }
  }

  if (analysis.marketTiming) {
    output += `
### Market Timing
- **Current Window:** ${analysis.marketTiming.currentWindow}
- **Urgency:** ${analysis.marketTiming.urgency.toUpperCase()}
- **Key Trends:** ${analysis.marketTiming.keyTrends.join(', ')}
- **Recommendation:** ${analysis.marketTiming.recommendation}
`;
  }

  return output;
}
