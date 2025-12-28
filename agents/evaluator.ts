/**
 * Generalist Evaluator Agent
 * Evaluates ideas across all 30 criteria in 6 categories
 */
import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logDebug, logInfo } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import {
  EVALUATION_CRITERIA,
  ALL_CRITERIA,
  CATEGORIES,
  Category,
  formatAllCriteriaForPrompt,
  type CriterionDefinition
} from './config.js';
import {
  CriterionEvaluationSchema,
  EvaluationResponseSchema,
  type CriterionEvaluation,
  type EvaluationResponse,
  type ProfileContext
} from '../utils/schemas.js';

// Broadcaster type for WebSocket events
type Broadcaster = ReturnType<typeof import('../utils/broadcast.js').createBroadcaster>;

const EVALUATOR_SYSTEM_PROMPT = `You are the Idea Incubator Evaluator Agent.

Your job is to rigorously evaluate ideas across 30 criteria in 6 categories.
You must be objective, thorough, and evidence-based in your assessments.

## Evaluation Guidelines

1. **Be rigorous**: Don't give inflated scores. A score of 7+ means strong evidence.
2. **Cite evidence**: Reference specific parts of the idea that support your score.
3. **Identify gaps**: Note what information is missing that would change your assessment.
4. **Consider context**: Evaluate relative to the target user and market.
5. **First principles**: Reason from fundamentals, not assumptions.

## Scoring Scale (1-10)

- 10: Exceptional, overwhelming evidence
- 8-9: Strong, clear evidence
- 6-7: Moderate, some evidence
- 4-5: Weak, limited evidence
- 2-3: Poor, contradicting evidence
- 1: Completely unsupported

## Confidence Scale (0.0-1.0)

- 1.0: Complete certainty (rarely appropriate)
- 0.8-0.9: High confidence, strong evidence
- 0.6-0.7: Moderate confidence, some gaps
- 0.4-0.5: Low confidence, significant gaps
- 0.2-0.3: Very low confidence, mostly assumptions

## Criteria

${formatAllCriteriaForPrompt()}

Respond in JSON format as specified.`;

/**
 * Structured data from dynamic questioning system
 * Maps question answers to evaluation-relevant categories
 */
export interface StructuredAnswerData {
  problem?: {
    core_problem?: string;      // From P1_CORE
    problem_scope?: string;     // From P1_SCOPE
    problem_triggers?: string;  // From P1_WHEN
    target_user?: string;       // From P3_WHO
    user_segment?: string;      // From P3_SEGMENT
    user_size?: string;         // From P3_SIZE
    user_access?: string;       // From P3_ACCESS
    pain_severity?: string;     // From P2_PAIN
    pain_cost?: string;         // From P2_COST
    pain_frequency?: string;    // From P2_FREQUENCY
    current_workarounds?: string; // From P2_ALTERNATIVES
    validation?: string;        // From P4_EVIDENCE
    user_conversations?: string; // From P4_CONVERSATIONS
    willingness_to_pay?: string; // From P4_WILLINGNESS
    existing_solutions?: string; // From P5_EXISTING
    solution_gaps?: string;     // From P5_GAP
    unique_angle?: string;      // From P5_ANGLE
  };
  solution?: {
    description?: string;       // From S1_WHAT
    value_proposition?: string; // From S1_VALUE_PROP
    user_flow?: string;         // From S1_HOW
    technology?: string;        // From S2_TECH
    proven_approach?: string;   // From S2_PROVEN
    hard_parts?: string;        // From S2_HARD
    differentiation?: string;   // From S3_DIFF
    why_better?: string;        // From S3_WHY_BETTER
    secret_insight?: string;    // From S3_SECRET
    scale_bottlenecks?: string; // From S4_SCALE
    marginal_costs?: string;    // From S4_MARGINAL
    moat?: string;              // From S5_MOAT
    ip_protection?: string;     // From S5_PROTECTION
    network_effects?: string;   // From S5_NETWORK
  };
  feasibility?: {
    mvp?: string;               // From F1_MVP
    components?: string;        // From F1_COMPONENTS
    unknowns?: string;          // From F1_UNKNOWNS
    cost_estimate?: string;     // From F2_COST
    team_requirements?: string; // From F2_TEAM
    tools_needed?: string;      // From F2_TOOLS
    skill_gaps?: string;        // From F3_GAP
    skill_acquisition?: string; // From F3_ACQUIRE
    time_to_feedback?: string;  // From F4_FIRST_VALUE
    time_to_revenue?: string;   // From F4_FIRST_REVENUE
    dependencies?: string;      // From F5_DEPS
    dependency_control?: string; // From F5_CONTROL
  };
  market?: {
    tam?: string;               // From M1_TAM
    sam?: string;               // From M1_SAM
    som?: string;               // From M1_SOM
    trends?: string;            // From M2_TREND
    trend_drivers?: string;     // From M2_DRIVERS
    competitors?: string;       // From M3_COMPETITORS
    competitive_landscape?: string; // From M3_LANDSCAPE
    competitor_weaknesses?: string; // From M3_COMP_WEAKNESS
    barriers?: string;          // From M4_BARRIERS
    barrier_strategy?: string;  // From M4_OVERCOME
    timing?: string;            // From M5_WHY_NOW
    timing_catalyst?: string;   // From M5_CATALYST
  };
  risk?: {
    biggest_risk?: string;      // From R_BIGGEST
    mitigation?: string;        // From R_MITIGATION
    execution_risk?: string;    // From R_EXECUTION
    market_risk?: string;       // From R_MARKET
    technical_risk?: string;    // From R_TECHNICAL
    financial_risk?: string;    // From R_FINANCIAL
    regulatory_risk?: string;   // From R_REGULATORY
    kill_conditions?: string;   // From R_KILL
    premortem?: string;         // From R_PREMORTEM
  };
  business_model?: {
    revenue_model?: string;     // From BM_MODEL
    pricing?: string;           // From BM_PRICE
    cac?: string;               // From BM_CAC
    ltv?: string;               // From BM_LTV
    gtm?: string;               // From BM_GTM
    revenue_projection?: string; // From BM_REVENUE
  };
  fit?: {
    goal_alignment?: string;    // From FT1_GOALS
    why_this_idea?: string;     // From FT1_WHY_THIS
    success_definition?: string; // From FT1_SUCCESS
    passion?: string;           // From FT2_PASSION
    personal_experience?: string; // From FT2_EXPERIENCE
    long_term_interest?: string; // From FT2_LONG_TERM
    skills?: string;            // From FT3_SKILLS
    unique_advantage?: string;  // From FT3_UNIQUE
    skills_to_learn?: string;   // From FT3_LEARN
    network?: string;           // From FT4_NETWORK
    customer_access?: string;   // From FT4_ACCESS
    community?: string;         // From FT4_COMMUNITY
    life_timing?: string;       // From FT5_TIMING
    time_capacity?: string;     // From FT5_CAPACITY
    financial_runway?: string;  // From FT5_RUNWAY
    risk_tolerance?: string;    // From FT5_RISK
  };
}

/**
 * Coverage information for structured data
 */
export interface StructuredDataCoverage {
  overall: number;
  byCategory: Record<string, number>;
  byCriterion: Record<string, number>;
}

/**
 * Full structured context for evaluation
 */
export interface StructuredEvaluationContext {
  answers: StructuredAnswerData;
  coverage: StructuredDataCoverage;
}

/**
 * Single criterion evaluation result
 */
export interface EvaluationResult {
  criterion: CriterionDefinition;
  score: number;
  confidence: number;
  reasoning: string;
  evidenceCited: string[];
  gapsIdentified: string[];
}

/**
 * Full evaluation result
 */
export interface FullEvaluationResult {
  ideaSlug: string;
  ideaId: string;
  evaluations: EvaluationResult[];
  categoryScores: Record<Category, number>;
  overallScore: number;
  overallConfidence: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  timestamp: string;
}

/**
 * Generate profile context section for evaluator prompt
 */
function formatProfileContextForPrompt(profileContext: ProfileContext | null, category: Category): string {
  if (!profileContext) {
    return `## Creator Profile
No user profile available. Evaluate Personal Fit criteria (FT1-FT5) with low confidence and neutral scores (5/10) while noting what information would be needed for accurate assessment.`;
  }

  // For non-fit categories, include brief profile summary
  if (category !== 'fit') {
    return `## Creator Profile Summary
The creator has provided their profile for context. Key points:
- Goals: ${profileContext.goalsContext}
- Skills: ${profileContext.skillsContext.split('\n')[0]}

Use this context when relevant to your assessment.`;
  }

  // For fit category, include full detailed context
  return `## Creator Profile (REQUIRED for Personal Fit Evaluation)

### Personal Goals (FT1 - Personal Fit)
${profileContext.goalsContext}

### Passion & Motivation (FT2 - Passion Alignment)
${profileContext.passionContext}

### Skills & Experience (FT3 - Skill Match)
${profileContext.skillsContext}

### Network & Connections (FT4 - Network Leverage)
${profileContext.networkContext}

### Life Stage & Capacity (FT5 - Life Stage Fit)
${profileContext.lifeStageContext}

**IMPORTANT**: Use this detailed profile information to provide accurate, high-confidence assessments for all Personal Fit criteria (FT1-FT5). Reference specific profile details in your reasoning.`;
}

/**
 * Format structured answer data for evaluator prompt
 */
export function formatStructuredDataForPrompt(
  structuredContext: StructuredEvaluationContext | null,
  category: Category
): string {
  if (!structuredContext || !structuredContext.answers) {
    return '';
  }

  const { answers, coverage } = structuredContext;
  const categoryCoverage = coverage.byCategory[category] ?? 0;

  let structuredSection = `## Structured Answers (High Confidence Data)

**Information Completeness for ${category}:** ${Math.round(categoryCoverage * 100)}%

`;

  // Format answers based on category
  switch (category) {
    case 'problem':
      if (answers.problem) {
        const p = answers.problem;
        if (p.core_problem) structuredSection += `**Core Problem:** ${p.core_problem}\n\n`;
        if (p.problem_scope) structuredSection += `**Problem Scope:** ${p.problem_scope}\n\n`;
        if (p.problem_triggers) structuredSection += `**Problem Triggers:** ${p.problem_triggers}\n\n`;
        if (p.target_user) structuredSection += `**Target User:** ${p.target_user}\n\n`;
        if (p.user_segment) structuredSection += `**User Segment:** ${p.user_segment}\n\n`;
        if (p.user_size) structuredSection += `**Market Size (Users):** ${p.user_size}\n\n`;
        if (p.user_access) structuredSection += `**User Access Channels:** ${p.user_access}\n\n`;
        if (p.pain_severity) structuredSection += `**Pain Severity:** ${p.pain_severity}\n\n`;
        if (p.pain_cost) structuredSection += `**Pain Cost:** ${p.pain_cost}\n\n`;
        if (p.pain_frequency) structuredSection += `**Pain Frequency:** ${p.pain_frequency}\n\n`;
        if (p.current_workarounds) structuredSection += `**Current Workarounds:** ${p.current_workarounds}\n\n`;
        if (p.validation) structuredSection += `**Problem Validation:** ${p.validation}\n\n`;
        if (p.user_conversations) structuredSection += `**User Conversations:** ${p.user_conversations}\n\n`;
        if (p.willingness_to_pay) structuredSection += `**Willingness to Pay:** ${p.willingness_to_pay}\n\n`;
        if (p.existing_solutions) structuredSection += `**Existing Solutions:** ${p.existing_solutions}\n\n`;
        if (p.solution_gaps) structuredSection += `**Solution Gaps:** ${p.solution_gaps}\n\n`;
        if (p.unique_angle) structuredSection += `**Unique Angle:** ${p.unique_angle}\n\n`;
      }
      break;

    case 'solution':
      if (answers.solution) {
        const s = answers.solution;
        if (s.description) structuredSection += `**Solution Description:** ${s.description}\n\n`;
        if (s.value_proposition) structuredSection += `**Value Proposition:** ${s.value_proposition}\n\n`;
        if (s.user_flow) structuredSection += `**User Flow:** ${s.user_flow}\n\n`;
        if (s.technology) structuredSection += `**Technology Stack:** ${s.technology}\n\n`;
        if (s.proven_approach) structuredSection += `**Proven Approach:** ${s.proven_approach}\n\n`;
        if (s.hard_parts) structuredSection += `**Technical Challenges:** ${s.hard_parts}\n\n`;
        if (s.differentiation) structuredSection += `**Differentiation:** ${s.differentiation}\n\n`;
        if (s.why_better) structuredSection += `**Why Better:** ${s.why_better}\n\n`;
        if (s.secret_insight) structuredSection += `**Secret Insight:** ${s.secret_insight}\n\n`;
        if (s.scale_bottlenecks) structuredSection += `**Scale Bottlenecks:** ${s.scale_bottlenecks}\n\n`;
        if (s.marginal_costs) structuredSection += `**Marginal Costs:** ${s.marginal_costs}\n\n`;
        if (s.moat) structuredSection += `**Competitive Moat:** ${s.moat}\n\n`;
        if (s.ip_protection) structuredSection += `**IP Protection:** ${s.ip_protection}\n\n`;
        if (s.network_effects) structuredSection += `**Network Effects:** ${s.network_effects}\n\n`;
      }
      break;

    case 'feasibility':
      if (answers.feasibility) {
        const f = answers.feasibility;
        if (f.mvp) structuredSection += `**MVP Approach:** ${f.mvp}\n\n`;
        if (f.components) structuredSection += `**Technical Components:** ${f.components}\n\n`;
        if (f.unknowns) structuredSection += `**Technical Unknowns:** ${f.unknowns}\n\n`;
        if (f.cost_estimate) structuredSection += `**Cost Estimate:** ${f.cost_estimate}\n\n`;
        if (f.team_requirements) structuredSection += `**Team Requirements:** ${f.team_requirements}\n\n`;
        if (f.tools_needed) structuredSection += `**Tools Needed:** ${f.tools_needed}\n\n`;
        if (f.skill_gaps) structuredSection += `**Skill Gaps:** ${f.skill_gaps}\n\n`;
        if (f.skill_acquisition) structuredSection += `**Skill Acquisition Plan:** ${f.skill_acquisition}\n\n`;
        if (f.time_to_feedback) structuredSection += `**Time to First Feedback:** ${f.time_to_feedback}\n\n`;
        if (f.time_to_revenue) structuredSection += `**Time to First Revenue:** ${f.time_to_revenue}\n\n`;
        if (f.dependencies) structuredSection += `**External Dependencies:** ${f.dependencies}\n\n`;
        if (f.dependency_control) structuredSection += `**Dependency Control:** ${f.dependency_control}\n\n`;
      }
      break;

    case 'market':
      if (answers.market) {
        const m = answers.market;
        if (m.tam) structuredSection += `**Total Addressable Market:** ${m.tam}\n\n`;
        if (m.sam) structuredSection += `**Serviceable Addressable Market:** ${m.sam}\n\n`;
        if (m.som) structuredSection += `**Serviceable Obtainable Market:** ${m.som}\n\n`;
        if (m.trends) structuredSection += `**Market Trends:** ${m.trends}\n\n`;
        if (m.trend_drivers) structuredSection += `**Trend Drivers:** ${m.trend_drivers}\n\n`;
        if (m.competitors) structuredSection += `**Competitors:** ${m.competitors}\n\n`;
        if (m.competitive_landscape) structuredSection += `**Competitive Landscape:** ${m.competitive_landscape}\n\n`;
        if (m.competitor_weaknesses) structuredSection += `**Competitor Weaknesses:** ${m.competitor_weaknesses}\n\n`;
        if (m.barriers) structuredSection += `**Entry Barriers:** ${m.barriers}\n\n`;
        if (m.barrier_strategy) structuredSection += `**Barrier Strategy:** ${m.barrier_strategy}\n\n`;
        if (m.timing) structuredSection += `**Why Now (Timing):** ${m.timing}\n\n`;
        if (m.timing_catalyst) structuredSection += `**Timing Catalyst:** ${m.timing_catalyst}\n\n`;
      }
      break;

    case 'risk':
      if (answers.risk) {
        const r = answers.risk;
        if (r.biggest_risk) structuredSection += `**Biggest Risk:** ${r.biggest_risk}\n\n`;
        if (r.mitigation) structuredSection += `**Risk Mitigation:** ${r.mitigation}\n\n`;
        if (r.execution_risk) structuredSection += `**Execution Risk:** ${r.execution_risk}\n\n`;
        if (r.market_risk) structuredSection += `**Market Risk:** ${r.market_risk}\n\n`;
        if (r.technical_risk) structuredSection += `**Technical Risk:** ${r.technical_risk}\n\n`;
        if (r.financial_risk) structuredSection += `**Financial Risk:** ${r.financial_risk}\n\n`;
        if (r.regulatory_risk) structuredSection += `**Regulatory Risk:** ${r.regulatory_risk}\n\n`;
        if (r.kill_conditions) structuredSection += `**Kill Conditions:** ${r.kill_conditions}\n\n`;
        if (r.premortem) structuredSection += `**Pre-mortem Analysis:** ${r.premortem}\n\n`;
      }
      break;

    case 'fit':
      // Fit uses both profile data (handled separately) and structured fit answers
      if (answers.fit) {
        const f = answers.fit;
        // FT1: Goal Alignment
        if (f.goal_alignment) structuredSection += `**Goal Alignment:** ${f.goal_alignment}\n\n`;
        if (f.why_this_idea) structuredSection += `**Why This Idea:** ${f.why_this_idea}\n\n`;
        if (f.success_definition) structuredSection += `**Success Definition:** ${f.success_definition}\n\n`;
        // FT2: Passion
        if (f.passion) structuredSection += `**Passion & Connection:** ${f.passion}\n\n`;
        if (f.personal_experience) structuredSection += `**Personal Experience:** ${f.personal_experience}\n\n`;
        if (f.long_term_interest) structuredSection += `**Long-term Interest:** ${f.long_term_interest}\n\n`;
        // FT3: Skills
        if (f.skills) structuredSection += `**Relevant Skills:** ${f.skills}\n\n`;
        if (f.unique_advantage) structuredSection += `**Unique Advantage:** ${f.unique_advantage}\n\n`;
        if (f.skills_to_learn) structuredSection += `**Skills to Learn:** ${f.skills_to_learn}\n\n`;
        // FT4: Network
        if (f.network) structuredSection += `**Network & Connections:** ${f.network}\n\n`;
        if (f.customer_access) structuredSection += `**Customer Access:** ${f.customer_access}\n\n`;
        if (f.community) structuredSection += `**Community Involvement:** ${f.community}\n\n`;
        // FT5: Life Stage
        if (f.life_timing) structuredSection += `**Life Timing:** ${f.life_timing}\n\n`;
        if (f.time_capacity) structuredSection += `**Time Capacity:** ${f.time_capacity}\n\n`;
        if (f.financial_runway) structuredSection += `**Financial Runway:** ${f.financial_runway}\n\n`;
        if (f.risk_tolerance) structuredSection += `**Risk Tolerance:** ${f.risk_tolerance}\n\n`;
      }
      break;

    default:
      break;
  }

  // Also include business model data for relevant categories
  if (answers.business_model && (category === 'market' || category === 'solution')) {
    const bm = answers.business_model;
    if (category === 'solution') {
      if (bm.revenue_model) structuredSection += `**Revenue Model:** ${bm.revenue_model}\n\n`;
      if (bm.pricing) structuredSection += `**Pricing Strategy:** ${bm.pricing}\n\n`;
    }
    if (category === 'market') {
      if (bm.cac) structuredSection += `**Customer Acquisition Cost:** ${bm.cac}\n\n`;
      if (bm.ltv) structuredSection += `**Customer Lifetime Value:** ${bm.ltv}\n\n`;
      if (bm.gtm) structuredSection += `**Go-to-Market Strategy:** ${bm.gtm}\n\n`;
      if (bm.revenue_projection) structuredSection += `**Revenue Projections:** ${bm.revenue_projection}\n\n`;
    }
  }

  // Add guidance on using structured data
  if (structuredSection.length > 100) {
    structuredSection += `
**IMPORTANT**: Prioritize the structured answers above over inferred information from the content.
- When structured data exists, use it as primary evidence for your assessment.
- When structured data is missing, note this affects confidence.
- Do NOT penalize the idea for missing information - adjust confidence instead.
`;
  } else {
    structuredSection = `## Structured Answers

No structured answers available for the ${category} category. Base your assessment on the idea content below. Apply lower confidence to scores where key information is missing.
`;
  }

  return structuredSection;
}

/**
 * Evaluate a single category
 */
export async function evaluateCategory(
  category: Category,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  roundNumber?: number,
  profileContext?: ProfileContext | null,
  structuredContext?: StructuredEvaluationContext | null
): Promise<EvaluationResult[]> {
  const config = getConfig();
  const criteria = EVALUATION_CRITERIA[category];

  const criteriaPrompt = criteria.map(c =>
    `${c.id}. ${c.name}
    Question: ${c.question}
    10 = ${c.highScoreDescription}
    1 = ${c.lowScoreDescription}`
  ).join('\n\n');

  // Generate profile context section (especially important for 'fit' category)
  const profileSection = formatProfileContextForPrompt(profileContext ?? null, category);

  // Generate structured data section from dynamic questioning
  const structuredSection = formatStructuredDataForPrompt(structuredContext ?? null, category);

  // Note: We don't broadcast roundStarted at category level - only per criterion via evaluatorSpeaking

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: EVALUATOR_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Evaluate this idea for the **${category.toUpperCase()}** category:

${structuredSection}

## Idea Content

${ideaContent}

${profileSection}

## Criteria to Evaluate

${criteriaPrompt}

Respond in JSON:
{
  "evaluations": [
    {
      "criterion": "Criterion Name",
      "category": "${category}",
      "score": 1-10,
      "confidence": 0.0-1.0,
      "reasoning": "Detailed reasoning citing specific evidence",
      "evidenceCited": ["Quote or reference from idea"],
      "gapsIdentified": ["Missing information"]
    }
  ]
}

Evaluate all ${criteria.length} criteria in the ${category} category.`
    }]
  });

  costTracker.track(response.usage, `evaluator-${category}`);
  logDebug(`Evaluated ${category} category`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type from evaluator');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError(`Could not parse ${category} evaluation response`);
  }

  // Try to repair common JSON issues
  const repairJson = (json: string): string => {
    let repaired = json;
    // Remove trailing commas before ] or }
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');
    // Try to escape unescaped newlines in strings (rough heuristic)
    repaired = repaired.replace(/:\s*"([^"]*?)(\n)([^"]*?)"/g, (_, pre, nl, post) =>
      `: "${pre}\\n${post}"`
    );
    return repaired;
  };

  try {
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Try with repairs
      const repaired = repairJson(jsonMatch[0]);
      parsed = JSON.parse(repaired);
    }

    // Map parsed evaluations to full results with criterion definitions
    const results = parsed.evaluations.map((eval_: any) => {
      // Normalize criterion name - handle formats like "P1. Problem Clarity" or just "Problem Clarity"
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

    // Broadcast each evaluation result
    if (broadcaster) {
      for (const result of results) {
        await broadcaster.evaluatorSpeaking(
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
    throw new EvaluationParseError(`Invalid JSON in ${category} evaluation: ${error}`);
  }
}

/**
 * Evaluate all 30 criteria across 6 categories
 */
export async function evaluateIdea(
  ideaSlug: string,
  ideaId: string,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  profileContext?: ProfileContext | null,
  structuredContext?: StructuredEvaluationContext | null
): Promise<FullEvaluationResult> {
  const config = getConfig();
  logInfo(`Starting evaluation for idea: ${ideaSlug}`);

  if (profileContext) {
    logInfo('Using user profile for Personal Fit evaluation');
  } else {
    logInfo('No user profile provided - Personal Fit scores will have low confidence');
  }

  if (structuredContext) {
    logInfo(`Using structured answers - Overall coverage: ${Math.round(structuredContext.coverage.overall * 100)}%`);
  } else {
    logInfo('No structured answers available - evaluation will rely on idea content only');
  }

  const allEvaluations: EvaluationResult[] = [];
  const categoryScores: Record<Category, number> = {
    problem: 0,
    solution: 0,
    feasibility: 0,
    fit: 0,
    market: 0,
    risk: 0
  };

  // Evaluate each category sequentially (v1 approach)
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    logDebug(`Evaluating category: ${category}`);
    const categoryEvals = await evaluateCategory(category, ideaContent, costTracker, broadcaster, i + 1, profileContext, structuredContext);
    allEvaluations.push(...categoryEvals);

    // Calculate category average
    const categoryAvg = categoryEvals.reduce((sum, e) => sum + e.score, 0) / categoryEvals.length;
    categoryScores[category] = categoryAvg;

    // Check budget after each category
    costTracker.checkBudget();
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

  // Calculate overall confidence (average of all confidences)
  const overallConfidence = allEvaluations.reduce((sum, e) => sum + e.confidence, 0) / allEvaluations.length;

  const report = costTracker.getReport();

  logInfo(`Evaluation complete for ${ideaSlug}: Overall score ${overallScore.toFixed(2)}`);

  return {
    ideaSlug,
    ideaId,
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
 * Re-evaluate specific criteria (after debate adjustments)
 */
export async function reEvaluateCriteria(
  criteriaIds: string[],
  ideaContent: string,
  previousScores: Map<string, number>,
  debateContext: string,
  costTracker: CostTracker
): Promise<EvaluationResult[]> {
  const config = getConfig();

  const criteria = criteriaIds.map(id => {
    const criterion = ALL_CRITERIA.find(c => c.id === id);
    if (!criterion) throw new EvaluationParseError(`Unknown criterion ID: ${id}`);
    return criterion;
  });

  const criteriaPrompt = criteria.map(c => {
    const prevScore = previousScores.get(c.id);
    return `${c.id}. ${c.name} (previous score: ${prevScore || 'N/A'})
    Question: ${c.question}`;
  }).join('\n\n');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: EVALUATOR_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Re-evaluate these criteria considering the debate context:

## Idea Content
${ideaContent}

## Debate Context
${debateContext}

## Criteria to Re-evaluate
${criteriaPrompt}

Consider the debate points and adjust scores if warranted.

Respond in JSON:
{
  "evaluations": [
    {
      "criterion": "Criterion ID",
      "category": "category",
      "score": 1-10,
      "confidence": 0.0-1.0,
      "reasoning": "Updated reasoning based on debate",
      "scoreChanged": true/false,
      "changeReason": "Why score changed or stayed same"
    }
  ]
}`
    }]
  });

  costTracker.track(response.usage, 'evaluator-reevaluation');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse re-evaluation response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.evaluations.map((eval_: any) => {
      const criterion = criteria.find(c => c.id === eval_.criterion || c.name === eval_.criterion);
      if (!criterion) {
        throw new EvaluationParseError(`Unknown criterion in response: ${eval_.criterion}`);
      }
      return {
        criterion,
        score: Math.min(10, Math.max(1, eval_.score)),
        confidence: Math.min(1, Math.max(0, eval_.confidence)),
        reasoning: eval_.reasoning || '',
        evidenceCited: [],
        gapsIdentified: []
      };
    });
  } catch (error) {
    if (error instanceof EvaluationParseError) throw error;
    throw new EvaluationParseError(`Invalid JSON in re-evaluation: ${error}`);
  }
}

/**
 * Format evaluation results for display
 */
export function formatEvaluationResults(result: FullEvaluationResult): string {
  const lines: string[] = [];

  lines.push(`# Evaluation Results: ${result.ideaSlug}`);
  lines.push(`\nOverall Score: **${result.overallScore.toFixed(2)}/10** (Confidence: ${(result.overallConfidence * 100).toFixed(0)}%)`);
  lines.push(`\nEvaluated: ${result.timestamp}`);

  lines.push('\n## Category Scores\n');
  for (const category of CATEGORIES) {
    const score = result.categoryScores[category];
    lines.push(`- **${category.charAt(0).toUpperCase() + category.slice(1)}**: ${score.toFixed(2)}/10`);
  }

  lines.push('\n## Detailed Evaluations\n');
  for (const category of CATEGORIES) {
    const categoryEvals = result.evaluations.filter(e => e.criterion.category === category);
    lines.push(`### ${category.toUpperCase()}\n`);

    for (const eval_ of categoryEvals) {
      lines.push(`**${eval_.criterion.name}**: ${eval_.score}/10 (${(eval_.confidence * 100).toFixed(0)}% confidence)`);
      lines.push(`> ${eval_.reasoning}`);

      if (eval_.gapsIdentified.length > 0) {
        lines.push(`\n*Gaps:* ${eval_.gapsIdentified.join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
