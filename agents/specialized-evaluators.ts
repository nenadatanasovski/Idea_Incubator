/**
 * Specialized Evaluator Agents (Phase 7 / v2)
 * 6 category-specific evaluators that run in parallel
 */
import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logDebug, logInfo } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import {
  EVALUATION_CRITERIA,
  CATEGORIES,
  type Category
} from './config.js';
import { type EvaluationResult, type StructuredEvaluationContext, formatStructuredDataForPrompt } from './evaluator.js';
import { type ProfileContext } from '../utils/schemas.js';
import { formatProfileForCategory } from '../utils/profile-context.js';
import { type ResearchResult, formatResearchForCategory } from './research.js';

// Broadcaster type for WebSocket events
type Broadcaster = ReturnType<typeof import('../utils/broadcast.js').createBroadcaster>;

/**
 * Specialized evaluator definition
 */
export interface SpecializedEvaluator {
  id: string;
  name: string;
  category: Category;
  expertise: string;
  systemPrompt: string;
}

/**
 * 6 specialized evaluators - one per category
 */
export const SPECIALIZED_EVALUATORS: Record<Category, SpecializedEvaluator> = {
  problem: {
    id: 'evaluator-problem',
    name: 'Problem Expert',
    category: 'problem',
    expertise: 'Problem definition, user pain points, market validation',
    systemPrompt: `You are a Problem Analysis Expert evaluating ideas.

Your specialization:
- Deep understanding of problem-solution fit
- Experience validating customer pain points
- Expertise in identifying real vs imagined problems
- Skills in user research and problem validation

## Your Evaluation Focus

You evaluate the PROBLEM category - whether the idea addresses a real, significant, well-defined problem.

Key questions you explore:
1. Is the problem clearly articulated?
2. How severe is the pain for affected users?
3. Who exactly experiences this problem?
4. Has the problem been validated with real users?
5. Is this problem already well-served by existing solutions?

## Scoring Guidelines

- 10: Exceptional - Crystal clear problem with proven severe pain
- 8-9: Strong - Well-defined problem with clear evidence of pain
- 6-7: Moderate - Reasonable problem definition but gaps in validation
- 4-5: Weak - Vague problem or questionable severity
- 2-3: Poor - Problem seems manufactured or trivial
- 1: Nonexistent - No discernible problem

Be rigorous. Demand evidence. A score of 7+ means the problem has been validated, not assumed.`
  },

  solution: {
    id: 'evaluator-solution',
    name: 'Solution Architect',
    category: 'solution',
    expertise: 'Solution design, technical architecture, competitive differentiation',
    systemPrompt: `You are a Solution Architecture Expert evaluating ideas.

Your specialization:
- Deep understanding of solution design patterns
- Experience building and scaling products
- Expertise in competitive analysis
- Skills in technical architecture assessment

## Your Evaluation Focus

You evaluate the SOLUTION category - whether the proposed solution is clear, feasible, differentiated, and defensible.

Key questions you explore:
1. Is the solution clearly articulated with specifics?
2. Can this actually be built with available technology?
3. How is this different from existing alternatives?
4. Can this solution scale without proportional cost?
5. Can this be protected from competitors?

## Scoring Guidelines

- 10: Exceptional - Innovative, clearly specified, highly defensible
- 8-9: Strong - Well-designed with clear differentiation
- 6-7: Moderate - Reasonable approach but lacks uniqueness
- 4-5: Weak - Vague or easily replicated
- 2-3: Poor - Unclear or impractical
- 1: Nonexistent - No coherent solution proposed

Be rigorous. Challenge vaporware. A 7+ solution has concrete technical details and clear differentiation.`
  },

  feasibility: {
    id: 'evaluator-feasibility',
    name: 'Feasibility Analyst',
    category: 'feasibility',
    expertise: 'Resource planning, technical complexity, execution assessment',
    systemPrompt: `You are a Feasibility Analysis Expert evaluating ideas.

Your specialization:
- Deep understanding of project execution
- Experience estimating resources and timelines
- Expertise in technical complexity assessment
- Skills in dependency and risk analysis

## Your Evaluation Focus

You evaluate the FEASIBILITY category - whether this can actually be built given available resources.

Key questions you explore:
1. How technically complex is this to build?
2. What resources (time, money, people) are needed?
3. Do the builders have the required skills?
4. How long until first value is delivered?
5. What external dependencies could block progress?

## Scoring Guidelines

- 10: Exceptional - Trivial to build, minimal resources, no dependencies
- 8-9: Strong - Clearly achievable with reasonable resources
- 6-7: Moderate - Feasible but requires significant effort
- 4-5: Weak - Major challenges or resource gaps
- 2-3: Poor - Likely to fail in execution
- 1: Impossible - Cannot be built with current technology/resources

Be practical. Consider real-world constraints. A 7+ feasibility means a realistic path to completion exists.`
  },

  fit: {
    id: 'evaluator-fit',
    name: 'Strategic Fit Analyst',
    category: 'fit',
    expertise: 'Personal alignment, strategic positioning, opportunity cost',
    systemPrompt: `You are a Strategic Fit Expert evaluating ideas.

Your specialization:
- Deep understanding of personal/business alignment
- Experience in career and portfolio strategy
- Expertise in passion-skill-opportunity matching
- Skills in life stage and timing assessment

## Your Evaluation Focus

You evaluate the FIT category - whether this idea aligns with the creator's goals, skills, and circumstances.

Key questions you explore:
1. Does this align with personal/business goals?
2. Is there genuine passion for this problem?
3. Does this leverage existing skills and strengths?
4. Can existing network and relationships help?
5. Is this the right moment in life/career for this?

## Scoring Guidelines

- 10: Exceptional - Perfect alignment across all dimensions
- 8-9: Strong - Strong fit with minor gaps
- 6-7: Moderate - Reasonable fit but opportunity cost concerns
- 4-5: Weak - Significant misalignment in key areas
- 2-3: Poor - Wrong person or wrong time
- 1: Terrible - Complete mismatch

Be honest about fit. Passion without skill or timing is insufficient. A 7+ fit means genuine alignment.`
  },

  market: {
    id: 'evaluator-market',
    name: 'Market Analyst',
    category: 'market',
    expertise: 'Market sizing, competitive dynamics, timing analysis',
    systemPrompt: `You are a Market Analysis Expert evaluating ideas.

Your specialization:
- Deep understanding of market dynamics
- Experience in competitive analysis
- Expertise in market sizing (TAM/SAM/SOM)
- Skills in trend analysis and timing assessment

## Your Evaluation Focus

You evaluate the MARKET category - whether market conditions support this idea's success.

Key questions you explore:
1. How large is the addressable market?
2. Is the market growing or declining?
3. How intense is the competition?
4. How difficult is market entry?
5. Is the timing right for this market?

## Scoring Guidelines

- 10: Exceptional - Huge growing market, blue ocean, perfect timing
- 8-9: Strong - Large market with clear opportunity
- 6-7: Moderate - Reasonable market but competitive or timing concerns
- 4-5: Weak - Small market, crowded, or timing issues
- 2-3: Poor - Declining market or fortress competition
- 1: Dead - No viable market exists

Be realistic about market dynamics. A 7+ market score requires evidence of market size and timing.`
  },

  risk: {
    id: 'evaluator-risk',
    name: 'Risk Analyst',
    category: 'risk',
    expertise: 'Risk assessment, failure mode analysis, mitigation strategies',
    systemPrompt: `You are a Risk Analysis Expert evaluating ideas.

Your specialization:
- Deep understanding of startup and project risks
- Experience in failure mode analysis
- Expertise in risk quantification
- Skills in mitigation strategy development

## Your Evaluation Focus

You evaluate the RISK category - what could go wrong and how likely/severe are those risks.

Key questions you explore:
1. What is the execution risk (failing to build)?
2. What is the market risk (no one wants it)?
3. What is the technical risk (it doesn't work)?
4. What is the financial risk (running out of money)?
5. What is the regulatory risk (legal/compliance issues)?

## Scoring Guidelines (inverted - high score = low risk)

- 10: Exceptional - Minimal risk across all dimensions
- 8-9: Strong - Well-managed risks with clear mitigations
- 6-7: Moderate - Some risks but manageable
- 4-5: Weak - Significant risks without clear mitigation
- 2-3: Poor - High probability of failure
- 1: Fatal - Near-certain failure

Be thorough in risk identification. A 7+ risk score means risks are acknowledged and mitigated.`
  }
};

/**
 * Run a single specialized evaluator
 */
export async function runSpecializedEvaluator(
  category: Category,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  _roundNumber?: number,
  profileContext?: ProfileContext | null,
  structuredContext?: StructuredEvaluationContext | null,
  research?: ResearchResult | null
): Promise<EvaluationResult[]> {
  const config = getConfig();
  const evaluator = SPECIALIZED_EVALUATORS[category];
  const criteria = EVALUATION_CRITERIA[category];

  const criteriaPrompt = criteria.map(c =>
    `${c.id}. ${c.name}
    Question: ${c.question}
    10 = ${c.highScoreDescription}
    1 = ${c.lowScoreDescription}`
  ).join('\n\n');

  // Add category-relevant profile context (not just for fit)
  const profileSection = formatProfileForCategory(profileContext ?? null, category);

  // Add structured answers context (from dynamic questioning)
  const structuredSection = formatStructuredDataForPrompt(structuredContext ?? null, category);

  // Add research context (for market and solution categories)
  const researchSection = formatResearchForCategory(research ?? null, category);

  logDebug(`Running specialized evaluator: ${evaluator.name}`);

  // Note: We don't broadcast roundStarted at category level - only per criterion via evaluatorSpeaking

  // Build request for API call logging
  const systemPrompt = evaluator.systemPrompt + `

## Response Format

Respond in JSON format:
{
  "evaluations": [
    {
      "criterion": "Criterion Name",
      "score": 1-10,
      "confidence": 0.0-1.0,
      "reasoning": "Detailed reasoning citing specific evidence",
      "evidenceCited": ["Quote or reference from idea"],
      "gapsIdentified": ["Missing information"]
    }
  ]
}`;

  const userContent = `Evaluate this idea for all ${category.toUpperCase()} criteria:

${researchSection}
${structuredSection}
## Idea Content

${ideaContent}

${profileSection}

## Criteria to Evaluate

${criteriaPrompt}

Provide a thorough evaluation for each of the ${criteria.length} criteria.`;

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError(`Unexpected response type from ${evaluator.name}`);
  }

  // Track with request/response data for API logging
  costTracker.track(
    response.usage,
    evaluator.id,
    {
      model: config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 2048,
    },
    {
      content: content.text,
      stop_reason: response.stop_reason,
    }
  );
  logDebug(`${evaluator.name} completed evaluation`);

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError(`Could not parse ${evaluator.name} response`);
  }

  // Try to repair common JSON issues from LLM output
  const repairJson = (json: string): string => {
    let repaired = json;

    // Remove trailing commas before ] or }
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Fix missing commas between array elements (common LLM error)
    // Look for }" followed by { without a comma
    repaired = repaired.replace(/\}\s*\{/g, '}, {');
    repaired = repaired.replace(/\]\s*\[/g, '], [');
    repaired = repaired.replace(/"\s*\{/g, '", {');
    repaired = repaired.replace(/\}\s*"/g, '}, "');

    // Try to escape unescaped newlines in strings
    repaired = repaired.replace(/:\s*"([^"]*?)(\n)([^"]*?)"/g, (_, pre, _nl, post) =>
      `: "${pre}\\n${post}"`
    );

    // Escape unescaped quotes inside strings (rough heuristic)
    // This is tricky - try to find strings with unescaped internal quotes
    repaired = repaired.replace(/"([^"]*)":\s*"([^"]*)(?<!\\)"([^"]*)"(?=\s*[,}\]])/g,
      (_match, key, pre, post) => `"${key}": "${pre}\\"${post}"`
    );

    return repaired;
  };

  // Extract evaluations even from partially valid JSON
  const extractEvaluations = (text: string): any[] => {
    const evaluations: any[] = [];

    // Try to find individual evaluation objects
    const evalPattern = /\{\s*"criterion"\s*:\s*"([^"]+)"\s*,\s*"score"\s*:\s*(\d+)\s*,\s*"confidence"\s*:\s*([\d.]+)\s*,\s*"reasoning"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g;

    let match;
    while ((match = evalPattern.exec(text)) !== null) {
      evaluations.push({
        criterion: match[1],
        score: parseInt(match[2]),
        confidence: parseFloat(match[3]),
        reasoning: match[4].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        evidenceCited: [],
        gapsIdentified: []
      });
    }

    return evaluations;
  };

  try {
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (firstError) {
      // Try with repairs
      try {
        const repaired = repairJson(jsonMatch[0]);
        parsed = JSON.parse(repaired);
      } catch {
        // Last resort: try to extract evaluations manually
        const extracted = extractEvaluations(jsonMatch[0]);
        if (extracted.length > 0) {
          parsed = { evaluations: extracted };
          logDebug(`Recovered ${extracted.length} evaluations from malformed JSON`);
        } else {
          throw firstError;
        }
      }
    }

    const results = parsed.evaluations.map((eval_: any) => {
      // Normalize criterion name - handle formats like "R1. Execution Risk" or just "Execution Risk"
      const criterionStr = String(eval_.criterion || '').trim();
      const criterion = criteria.find(c =>
        c.name === criterionStr ||
        c.id === criterionStr ||
        criterionStr.includes(c.name) ||
        criterionStr.endsWith(c.name)
      );

      if (!criterion) {
        throw new EvaluationParseError(`Unknown criterion: ${eval_.criterion}`);
      }

      return {
        criterion,
        score: Math.min(10, Math.max(1, eval_.score)),
        confidence: Math.min(1, Math.max(0, eval_.confidence)),
        reasoning: eval_.reasoning || '',
        evidenceCited: eval_.evidenceCited || [],
        gapsIdentified: eval_.gapsIdentified || []
      };
    });

    // Broadcast each evaluation result as INITIAL assessment (before debate)
    if (broadcaster) {
      for (const result of results) {
        await broadcaster.evaluatorInitial(
          result.criterion.name,
          result.criterion.category,
          result.reasoning,
          result.score
        );
      }
      // Note: Category-level roundComplete is not broadcast here
      // Individual criterion roundComplete events are broadcast from debate.ts after each debate concludes
    }

    return results;
  } catch (error) {
    if (error instanceof EvaluationParseError) throw error;
    throw new EvaluationParseError(`Invalid JSON from ${evaluator.name}: ${error}`);
  }
}

/**
 * Run all 6 specialized evaluators in parallel
 */
export async function runAllSpecializedEvaluators(
  ideaSlug: string,
  _ideaId: string,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  profileContext?: ProfileContext | null,
  structuredContext?: StructuredEvaluationContext | null,
  research?: ResearchResult | null
): Promise<{
  evaluations: EvaluationResult[];
  categoryScores: Record<Category, number>;
  overallScore: number;
  overallConfidence: number;
  tokensUsed: { input: number; output: number };
  timestamp: string;
}> {
  const config = getConfig();
  logInfo(`Starting parallel evaluation for idea: ${ideaSlug}`);

  if (profileContext) {
    logInfo('User profile context will be used for Fit evaluation');
  }

  if (structuredContext && structuredContext.coverage.overall > 0) {
    logInfo(`Structured answers will be used - Coverage: ${Math.round(structuredContext.coverage.overall * 100)}%`);
  }

  // Run all 6 evaluators in parallel
  const evaluationPromises = CATEGORIES.map((category, index) =>
    runSpecializedEvaluator(category, ideaContent, costTracker, broadcaster, index + 1, profileContext, structuredContext, research)
  );

  const results = await Promise.all(evaluationPromises);
  const allEvaluations = results.flat();

  // Calculate category scores
  const categoryScores: Record<Category, number> = {
    problem: 0,
    solution: 0,
    feasibility: 0,
    fit: 0,
    market: 0,
    risk: 0
  };

  for (const category of CATEGORIES) {
    const categoryEvals = allEvaluations.filter(e => e.criterion.category === category);
    categoryScores[category] = categoryEvals.reduce((sum, e) => sum + e.score, 0) / categoryEvals.length;
  }

  // Calculate weighted overall score
  const weights = config.categoryWeights;
  const overallScore =
    categoryScores.problem * weights.problem +
    categoryScores.solution * weights.solution +
    categoryScores.feasibility * weights.feasibility +
    categoryScores.fit * weights.fit +
    categoryScores.market * weights.market +
    categoryScores.risk * weights.risk;

  // Calculate overall confidence
  const overallConfidence = allEvaluations.reduce((sum, e) => sum + e.confidence, 0) / allEvaluations.length;

  const report = costTracker.getReport();

  logInfo(`Parallel evaluation complete for ${ideaSlug}: Overall score ${overallScore.toFixed(2)}`);

  return {
    evaluations: allEvaluations,
    categoryScores,
    overallScore,
    overallConfidence,
    tokensUsed: {
      input: report.inputTokens,
      output: report.outputTokens
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Get specialized evaluator by category
 */
export function getSpecializedEvaluator(category: Category): SpecializedEvaluator {
  return SPECIALIZED_EVALUATORS[category];
}

/**
 * List all specialized evaluators
 */
export function listSpecializedEvaluators(): SpecializedEvaluator[] {
  return Object.values(SPECIALIZED_EVALUATORS);
}
