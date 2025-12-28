/**
 * Orchestrator Agent
 * Routes inputs and manages flow between agents
 */
import { client } from '../utils/anthropic-client.js';
import { query } from '../database/db.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logInfo, logDebug } from '../utils/logger.js';
import { getConfig } from '../config/index.js';

export type IdeaClassification = 'NEW' | 'EXISTING' | 'AMBIGUOUS';

export interface ClassificationResult {
  type: IdeaClassification;
  matchedSlug?: string;
  candidates?: Array<{ slug: string; title: string; similarity: number }>;
  reasoning: string;
}

export interface WorkflowAction {
  action: 'CREATE_NEW' | 'LINK_EXISTING' | 'ASK_USER' | 'UPDATE_EXISTING';
  ideaSlug?: string;
  message?: string;
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Idea Incubator orchestrator.

Your job is to determine if user input is:
1. A NEW idea (never seen before)
2. Related to an EXISTING idea (should be linked or merged)
3. AMBIGUOUS (could be either - need to ask user)

You have access to the list of existing ideas. Compare the user's input against them.

Consider:
- Same problem domain = likely related
- Same target user = likely related
- Same solution approach = definitely related
- Minor variations = same idea, different iteration

Respond in JSON:
{
  "type": "NEW" | "EXISTING" | "AMBIGUOUS",
  "matchedSlug": "slug-if-existing",
  "candidates": [{"slug": "...", "title": "...", "similarity": 0.0-1.0}],
  "reasoning": "Why this classification"
}`;

/**
 * Classify user input as new, existing, or ambiguous
 */
export async function classifyInput(
  userInput: string,
  costTracker: CostTracker
): Promise<ClassificationResult> {
  const config = getConfig();

  // Get existing ideas from database
  const existingIdeas = await query<{
    slug: string;
    title: string;
    summary: string | null;
  }>('SELECT slug, title, summary FROM ideas ORDER BY updated_at DESC LIMIT 50');

  const existingList = existingIdeas
    .map(i => `- ${i.slug}: "${i.title}" - ${i.summary || 'No summary'}`)
    .join('\n');

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 512,
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `User input: "${userInput}"

Existing ideas:
${existingList || '(none)'}

Classify this input.`
    }]
  });

  costTracker.track(response.usage, 'orchestrator-classify');
  logDebug('Input classified by orchestrator');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response type from orchestrator');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse orchestrator JSON');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError('Invalid JSON from orchestrator');
  }
}

/**
 * Route classification to appropriate workflow
 */
export function routeToWorkflow(
  classification: ClassificationResult,
  userInput: string
): WorkflowAction {
  switch (classification.type) {
    case 'NEW':
      logInfo('Creating new idea...');
      return { action: 'CREATE_NEW' };

    case 'EXISTING':
      logInfo(`Linking to existing idea: ${classification.matchedSlug}`);
      return {
        action: 'UPDATE_EXISTING',
        ideaSlug: classification.matchedSlug,
        message: `This appears to be related to "${classification.matchedSlug}". ${classification.reasoning}`
      };

    case 'AMBIGUOUS':
      logInfo('Need user clarification...');
      return {
        action: 'ASK_USER',
        message: formatAmbiguousChoices(classification)
      };

    default:
      throw new Error(`Unknown classification type: ${classification.type}`);
  }
}

/**
 * Format ambiguous choices for user display
 */
function formatAmbiguousChoices(classification: ClassificationResult): string {
  const lines: string[] = [
    'Related ideas found:\n'
  ];

  if (classification.candidates) {
    classification.candidates.forEach((c, i) => {
      const pct = (c.similarity * 100).toFixed(0);
      lines.push(`${i + 1}. [${pct}% match] ${c.slug} - "${c.title}"`);
    });
  }

  lines.push(`${(classification.candidates?.length || 0) + 1}. [New idea] Create as standalone idea`);
  lines.push('\nSelect an option:');

  return lines.join('\n');
}

/**
 * Determine the next action in evaluation flow
 */
export interface EvaluationFlowState {
  ideaSlug: string;
  ideaId: string;
  currentPhase: 'preflight' | 'initial' | 'debate' | 'synthesis' | 'complete';
  hasExistingEvaluation: boolean;
  isStale: boolean;
  lastEvaluatedAt?: string;
}

export async function determineEvaluationFlow(
  ideaSlug: string
): Promise<EvaluationFlowState> {
  // Get idea details
  const idea = await query<{
    id: string;
    slug: string;
    lifecycle_stage: string;
    content_hash: string | null;
  }>('SELECT id, slug, lifecycle_stage, content_hash FROM ideas WHERE slug = ?', [ideaSlug]);

  if (idea.length === 0) {
    throw new Error(`Idea not found: ${ideaSlug}`);
  }

  const ideaData = idea[0];

  // Check for existing evaluations
  const existingEval = await query<{
    created_at: string;
    content_hash: string | null;
  }>(
    `SELECT created_at, content_hash FROM evaluation_sessions
     WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`,
    [ideaData.id]
  );

  const hasExisting = existingEval.length > 0;
  const isStale = hasExisting && existingEval[0].content_hash !== ideaData.content_hash;

  return {
    ideaSlug,
    ideaId: ideaData.id,
    currentPhase: hasExisting ? (isStale ? 'preflight' : 'complete') : 'preflight',
    hasExistingEvaluation: hasExisting,
    isStale,
    lastEvaluatedAt: existingEval[0]?.created_at
  };
}

/**
 * Estimate cost for evaluation
 */
export interface CostEstimate {
  initialEvaluation: number;
  redTeam: number;
  debate: number;
  synthesis: number;
  total: number;
  confidence: 'low' | 'medium' | 'high';
}

export function estimateEvaluationCost(): CostEstimate {
  const config = getConfig();

  // Based on typical token usage patterns
  const TOKENS_PER_CATEGORY = 2000; // input + output
  const TOKENS_PER_CHALLENGE = 1500;
  const TOKENS_PER_DEBATE_ROUND = 1000;
  const TOKENS_SYNTHESIS = 3000;

  const categories = 6;
  const challengesPerCriterion = config.debate.challengesPerCriterion;
  const roundsPerChallenge = config.debate.roundsPerChallenge;
  const criteria = 30;

  // Using Opus 4.5 pricing: $15/1M input, $75/1M output (assume 40/60 split)
  const costPerToken = (15 * 0.4 + 75 * 0.6) / 1_000_000;

  const initialTokens = categories * TOKENS_PER_CATEGORY;
  const redTeamTokens = criteria * challengesPerCriterion * TOKENS_PER_CHALLENGE;
  const debateTokens = criteria * challengesPerCriterion * roundsPerChallenge * TOKENS_PER_DEBATE_ROUND;

  return {
    initialEvaluation: initialTokens * costPerToken,
    redTeam: redTeamTokens * costPerToken,
    debate: debateTokens * costPerToken,
    synthesis: TOKENS_SYNTHESIS * costPerToken,
    total: (initialTokens + redTeamTokens + debateTokens + TOKENS_SYNTHESIS) * costPerToken,
    confidence: 'medium'
  };
}

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  return `Estimated Cost Breakdown:
- Initial evaluation: $${estimate.initialEvaluation.toFixed(2)}
- Red team challenges: $${estimate.redTeam.toFixed(2)}
- Debate rounds: $${estimate.debate.toFixed(2)}
- Synthesis: $${estimate.synthesis.toFixed(2)}
- **Total: $${estimate.total.toFixed(2)}** (${estimate.confidence} confidence)`;
}
