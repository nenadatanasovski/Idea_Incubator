/**
 * Differentiation Validator Agent
 *
 * Validates differentiation suggestions before presenting to user.
 * Checks for logical consistency, feasibility, and contradictions.
 */

import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { logInfo, logWarning } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { EvaluationParseError } from '../utils/errors.js';
import {
  DifferentiationAnalysis,
  ValidatedDifferentiationAnalysis,
  ValidatedOpportunity,
  ValidatedStrategy,
  IdeaContext,
  ProfileContext
} from '../types/incubation.js';

const VALIDATION_SYSTEM_PROMPT = `You are a Validation Agent for differentiation analysis.

Your job is to critically review differentiation suggestions and validate them against:
1. Logical consistency - Do the suggestions make sense?
2. Idea alignment - Do they fit the actual idea context?
3. Profile fit - Are they realistic given the user's capabilities?
4. Internal contradictions - Do they conflict with earlier findings?

Be skeptical but fair. Flag issues clearly but acknowledge when suggestions are solid.

Output valid JSON only.`;

/**
 * Validate differentiation analysis
 */
export async function validateDifferentiationAnalysis(
  analysis: DifferentiationAnalysis,
  ideaContext: IdeaContext,
  profile: ProfileContext,
  costTracker: CostTracker
): Promise<ValidatedDifferentiationAnalysis> {
  const config = getConfig();

  logInfo('Validating differentiation analysis...');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2500,
    system: VALIDATION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Validate this differentiation analysis:

DIFFERENTIATION ANALYSIS:
${JSON.stringify(analysis, null, 2)}

IDEA CONTEXT:
Problem: ${ideaContext.problem}
Solution: ${ideaContext.solution}
Target User: ${ideaContext.targetUser}

USER PROFILE:
Goals: ${profile.goals?.join(', ') || 'Not specified'}
Skills: ${profile.skills?.join(', ') || 'Not specified'}
Network: ${profile.network?.join(', ') || 'Not specified'}
Constraints: ${profile.constraints?.join(', ') || 'Not specified'}

For each opportunity and strategy, provide:
1. Confidence rating (0-1)
2. Any warnings or issues
3. Any contradictions with earlier findings
4. For strategies: feasibility check against user profile

Respond in JSON:
{
  "validatedOpportunities": [
    {
      "description": "Original description",
      "targetSegment": "Original segment",
      "potentialImpact": "high|medium|low",
      "feasibility": "high|medium|low",
      "validationConfidence": 0.0-1.0,
      "validationWarnings": ["Warning 1"],
      "contradictions": ["Contradiction if any"]
    }
  ],
  "validatedStrategies": [
    {
      "name": "Strategy name",
      "description": "Description",
      "differentiators": ["..."],
      "tradeoffs": ["..."],
      "fitWithProfile": 1-10,
      "validationConfidence": 0.0-1.0,
      "validationWarnings": ["Warning 1"],
      "feasibilityCheck": {
        "alignsWithSkills": true/false,
        "alignsWithResources": true/false,
        "alignsWithGoals": true/false,
        "issues": ["Issue 1"]
      }
    }
  ],
  "validationSummary": "Overall validation notes",
  "overallConfidence": 0.0-1.0
}`
    }]
  });

  costTracker.track(response.usage, 'differentiation-validation');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type from validation agent');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse validation response');
  }

  let parsed: {
    validatedOpportunities: Array<{
      description: string;
      targetSegment: string;
      potentialImpact: string;
      feasibility: string;
      validationConfidence: number;
      validationWarnings: string[];
      contradictions?: string[];
    }>;
    validatedStrategies: Array<{
      name: string;
      description: string;
      differentiators: string[];
      tradeoffs: string[];
      fitWithProfile: number;
      validationConfidence: number;
      validationWarnings: string[];
      feasibilityCheck: {
        alignsWithSkills: boolean;
        alignsWithResources: boolean;
        alignsWithGoals: boolean;
        issues: string[];
      };
    }>;
    validationSummary: string;
    overallConfidence: number;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError('Invalid JSON in validation response');
  }

  // Transform to typed structures
  const marketOpportunities: ValidatedOpportunity[] = parsed.validatedOpportunities.map(o => ({
    description: o.description,
    targetSegment: o.targetSegment,
    potentialImpact: normalizeLevel(o.potentialImpact),
    feasibility: normalizeLevel(o.feasibility),
    validationConfidence: Math.max(0, Math.min(1, o.validationConfidence)),
    validationWarnings: o.validationWarnings || [],
    contradictions: o.contradictions || []
  }));

  const differentiationStrategies: ValidatedStrategy[] = parsed.validatedStrategies.map(s => ({
    name: s.name,
    description: s.description,
    differentiators: s.differentiators,
    tradeoffs: s.tradeoffs,
    fitWithProfile: Math.max(1, Math.min(10, s.fitWithProfile)),
    validationConfidence: Math.max(0, Math.min(1, s.validationConfidence)),
    validationWarnings: s.validationWarnings || [],
    feasibilityCheck: {
      alignsWithSkills: s.feasibilityCheck?.alignsWithSkills ?? true,
      alignsWithResources: s.feasibilityCheck?.alignsWithResources ?? true,
      alignsWithGoals: s.feasibilityCheck?.alignsWithGoals ?? true,
      issues: s.feasibilityCheck?.issues || []
    }
  }));

  logInfo(`Validation complete. Overall confidence: ${Math.round(parsed.overallConfidence * 100)}%`);

  return {
    marketOpportunities,
    competitiveRisks: analysis.competitiveRisks, // Risks pass through unvalidated
    differentiationStrategies,
    summary: analysis.summary,
    validationSummary: parsed.validationSummary,
    overallConfidence: Math.max(0, Math.min(1, parsed.overallConfidence))
  };
}

/**
 * Filter validated suggestions by confidence threshold
 */
export function filterValidatedSuggestions(
  validated: ValidatedDifferentiationAnalysis,
  minConfidence: number = 0.3
): ValidatedDifferentiationAnalysis {
  // Filter opportunities
  const filteredOpportunities = validated.marketOpportunities
    .filter(o => o.validationConfidence >= minConfidence)
    .sort((a, b) => b.validationConfidence - a.validationConfidence);

  // Filter strategies
  const filteredStrategies = validated.differentiationStrategies
    .filter(s => s.validationConfidence >= minConfidence)
    .sort((a, b) => b.validationConfidence - a.validationConfidence);

  const removedOpps = validated.marketOpportunities.length - filteredOpportunities.length;
  const removedStrats = validated.differentiationStrategies.length - filteredStrategies.length;

  if (removedOpps > 0 || removedStrats > 0) {
    logWarning(`Filtered out ${removedOpps} opportunities and ${removedStrats} strategies with low confidence`);
  }

  // Recalculate overall confidence
  const allConfidences = [
    ...filteredOpportunities.map(o => o.validationConfidence),
    ...filteredStrategies.map(s => s.validationConfidence)
  ];
  const overallConfidence = allConfidences.length > 0
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    : 0;

  return {
    ...validated,
    marketOpportunities: filteredOpportunities,
    differentiationStrategies: filteredStrategies,
    overallConfidence
  };
}

/**
 * Normalize level string to typed enum
 */
function normalizeLevel(level: string): 'high' | 'medium' | 'low' {
  const normalized = level.toLowerCase().trim();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'medium';
}

/**
 * Format validated analysis for display with confidence ratings
 */
export function formatValidatedAnalysis(validated: ValidatedDifferentiationAnalysis): string {
  let output = `
## Validated Differentiation Analysis
${validated.validationSummary}
Overall Confidence: ${formatConfidenceBar(validated.overallConfidence)}

### Market Opportunities
`;

  for (const opp of validated.marketOpportunities) {
    const confidenceIcon = opp.validationConfidence >= 0.7 ? '✓' : opp.validationConfidence >= 0.5 ? '~' : '!';
    output += `
${confidenceIcon} **${opp.targetSegment}** (${Math.round(opp.validationConfidence * 100)}% confidence)
${opp.description}
- Impact: ${opp.potentialImpact.toUpperCase()} | Feasibility: ${opp.feasibility.toUpperCase()}
`;
    if (opp.validationWarnings.length > 0) {
      output += `⚠️ Warnings: ${opp.validationWarnings.join('; ')}\n`;
    }
    if (opp.contradictions && opp.contradictions.length > 0) {
      output += `⚡ Contradictions: ${opp.contradictions.join('; ')}\n`;
    }
  }

  output += `
### Recommended Strategies
`;

  for (let i = 0; i < validated.differentiationStrategies.length; i++) {
    const strat = validated.differentiationStrategies[i];
    const confidenceIcon = strat.validationConfidence >= 0.7 ? '✓' : strat.validationConfidence >= 0.5 ? '~' : '!';

    output += `
${confidenceIcon} **${i + 1}. ${strat.name}** (Fit: ${strat.fitWithProfile}/10 | Confidence: ${Math.round(strat.validationConfidence * 100)}%)
${strat.description}

Feasibility Check:
- Skills: ${strat.feasibilityCheck.alignsWithSkills ? '✓' : '✗'}
- Resources: ${strat.feasibilityCheck.alignsWithResources ? '✓' : '✗'}
- Goals: ${strat.feasibilityCheck.alignsWithGoals ? '✓' : '✗'}
`;
    if (strat.feasibilityCheck.issues.length > 0) {
      output += `Issues: ${strat.feasibilityCheck.issues.join('; ')}\n`;
    }
    if (strat.validationWarnings.length > 0) {
      output += `⚠️ Warnings: ${strat.validationWarnings.join('; ')}\n`;
    }
  }

  return output;
}

/**
 * Format confidence bar
 */
function formatConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(confidence * 100)}%`;
}
