/**
 * Synthesis Agent
 * Creates final evaluation document from debate results
 */
import { client } from '../utils/anthropic-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logInfo, logDebug } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { CATEGORIES, interpretScore, type Category } from './config.js';
import { type FullDebateResult } from './debate.js';
import { calculateOverallMetrics, formatConvergenceMetrics } from './convergence.js';

export type Recommendation = 'PURSUE' | 'REFINE' | 'PAUSE' | 'ABANDON';

export interface SynthesisOutput {
  executiveSummary: string;
  keyStrengths: string[];
  keyWeaknesses: string[];
  criticalAssumptions: string[];
  unresolvedQuestions: string[];
  recommendation: Recommendation;
  recommendationReasoning: string;
  nextSteps: string[];
  confidenceStatement: string;
}

export interface FinalEvaluation {
  ideaSlug: string;
  ideaTitle: string;
  overallScore: number;
  recommendation: Recommendation;
  synthesis: SynthesisOutput;
  categoryScores: Record<Category, number>;
  debateHighlights: string[];
  convergenceMetrics: ReturnType<typeof calculateOverallMetrics>;
  timestamp: string;
  locked: boolean;
}

const SYNTHESIS_SYSTEM_PROMPT = `You are the Synthesis Agent for the Idea Incubator.

Your job is to create a comprehensive, actionable summary of the evaluation process.

## Your Role
- Synthesize all debate outcomes into a coherent narrative
- Make a clear, decisive recommendation
- Identify the most important insights
- Be honest about uncertainty

## Recommendation Guidelines
- PURSUE: Score 7.0+ with high confidence, clear path forward
- REFINE: Score 5.0-6.9 or high score with significant gaps
- PAUSE: Score 4.0-4.9 or major blockers identified
- ABANDON: Score <4.0 or fundamental flaws revealed

## Output Quality
- Be specific, not generic
- Cite evidence from the debate
- Prioritize actionable insights
- Acknowledge what we don't know

Respond in JSON format as specified.`;

/**
 * Generate synthesis from debate results
 */
export async function generateSynthesis(
  debateResult: FullDebateResult,
  ideaContent: string,
  costTracker: CostTracker
): Promise<SynthesisOutput> {
  const config = getConfig();

  // Collect key insights and debate highlights
  const allInsights = debateResult.debates
    .flatMap(d => d.summary.keyInsights)
    .filter((v, i, a) => a.indexOf(v) === i);

  const significantChanges = debateResult.debates
    .filter(d => Math.abs(d.finalScore - d.originalScore) >= 1)
    .map(d => `${d.criterion.name}: ${d.originalScore} -> ${d.finalScore}`);

  const lowScoreCriteria = debateResult.debates
    .filter(d => d.finalScore <= 5)
    .map(d => `${d.criterion.name} (${d.finalScore}/10)`);

  const highScoreCriteria = debateResult.debates
    .filter(d => d.finalScore >= 8)
    .map(d => `${d.criterion.name} (${d.finalScore}/10)`);

  // Format debate summary for synthesis
  const debateSummary = `
Overall Score: ${debateResult.overallFinalScore.toFixed(2)}/10
Score Change: ${debateResult.overallOriginalScore.toFixed(2)} -> ${debateResult.overallFinalScore.toFixed(2)}

Category Scores:
${CATEGORIES.map(c => `- ${c}: ${debateResult.categoryResults[c].finalAvg.toFixed(1)}/10`).join('\n')}

Key Insights:
${allInsights.slice(0, 10).map(i => `- ${i}`).join('\n')}

Significant Score Changes:
${significantChanges.slice(0, 5).map(c => `- ${c}`).join('\n') || 'None'}

Low Scores (concern areas):
${lowScoreCriteria.join(', ') || 'None'}

High Scores (strengths):
${highScoreCriteria.join(', ') || 'None'}
`;

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Synthesize this idea evaluation:

## Idea Content
${ideaContent.substring(0, 2000)}...

## Debate Results
${debateSummary}

Create a comprehensive synthesis.

Respond in JSON:
{
  "executiveSummary": "2-3 paragraph summary of the idea and its evaluation",
  "keyStrengths": ["Top 3-5 strengths identified"],
  "keyWeaknesses": ["Top 3-5 weaknesses identified"],
  "criticalAssumptions": ["Assumptions that must be true for success"],
  "unresolvedQuestions": ["Questions that couldn't be answered"],
  "recommendation": "PURSUE | REFINE | PAUSE | ABANDON",
  "recommendationReasoning": "Why this recommendation",
  "nextSteps": ["Specific actionable next steps"],
  "confidenceStatement": "Statement about confidence level and why"
}`
    }]
  });

  costTracker.track(response.usage, 'synthesis');
  logInfo('Synthesis generated');

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from synthesis agent');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse synthesis response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      executiveSummary: parsed.executiveSummary || '',
      keyStrengths: parsed.keyStrengths || [],
      keyWeaknesses: parsed.keyWeaknesses || [],
      criticalAssumptions: parsed.criticalAssumptions || [],
      unresolvedQuestions: parsed.unresolvedQuestions || [],
      recommendation: validateRecommendation(parsed.recommendation),
      recommendationReasoning: parsed.recommendationReasoning || '',
      nextSteps: parsed.nextSteps || [],
      confidenceStatement: parsed.confidenceStatement || ''
    };
  } catch {
    throw new EvaluationParseError('Invalid JSON in synthesis response');
  }
}

/**
 * Validate recommendation value
 */
function validateRecommendation(rec: string): Recommendation {
  const valid: Recommendation[] = ['PURSUE', 'REFINE', 'PAUSE', 'ABANDON'];
  const normalized = rec?.toUpperCase();
  return valid.includes(normalized as Recommendation) ? normalized as Recommendation : 'REFINE';
}

/**
 * Create final evaluation document
 */
export async function createFinalEvaluation(
  ideaSlug: string,
  ideaTitle: string,
  debateResult: FullDebateResult,
  ideaContent: string,
  costTracker: CostTracker
): Promise<FinalEvaluation> {
  logInfo(`Creating final evaluation for: ${ideaSlug}`);

  // Generate synthesis
  const synthesis = await generateSynthesis(debateResult, ideaContent, costTracker);

  // Calculate convergence metrics
  const convergenceMetrics = calculateOverallMetrics(debateResult);

  // Collect debate highlights
  const debateHighlights = debateResult.debates
    .filter(d => d.summary.keyInsights.length > 0)
    .flatMap(d => d.summary.keyInsights)
    .slice(0, 10);

  return {
    ideaSlug,
    ideaTitle,
    overallScore: debateResult.overallFinalScore,
    recommendation: synthesis.recommendation,
    synthesis,
    categoryScores: Object.fromEntries(
      CATEGORIES.map(c => [c, debateResult.categoryResults[c].finalAvg])
    ) as Record<Category, number>,
    debateHighlights,
    convergenceMetrics,
    timestamp: new Date().toISOString(),
    locked: true
  };
}

/**
 * Format final evaluation as markdown
 */
export function formatFinalEvaluation(evaluation: FinalEvaluation): string {
  const interpretation = interpretScore(evaluation.overallScore);

  const lines: string[] = [
    `# Final Evaluation: ${evaluation.ideaTitle}`,
    '',
    `> **Overall Score: ${evaluation.overallScore.toFixed(2)}/10** | **Recommendation: ${evaluation.recommendation}**`,
    `> ${interpretation.description}`,
    '',
    `*Evaluated: ${evaluation.timestamp}*`,
    '*This evaluation is locked and immutable.*',
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    evaluation.synthesis.executiveSummary,
    '',
    '---',
    '',
    '## Scores by Category',
    '',
    '| Category | Score |',
    '|----------|-------|',
    ...CATEGORIES.map(c =>
      `| ${c.charAt(0).toUpperCase() + c.slice(1)} | ${evaluation.categoryScores[c].toFixed(1)}/10 |`
    ),
    '',
    '---',
    '',
    '## Key Strengths',
    '',
    ...evaluation.synthesis.keyStrengths.map(s => `- ${s}`),
    '',
    '## Key Weaknesses',
    '',
    ...evaluation.synthesis.keyWeaknesses.map(w => `- ${w}`),
    '',
    '## Critical Assumptions',
    '',
    ...evaluation.synthesis.criticalAssumptions.map(a => `- ${a}`),
    '',
    '## Unresolved Questions',
    '',
    ...evaluation.synthesis.unresolvedQuestions.map(q => `- ${q}`),
    '',
    '---',
    '',
    '## Recommendation: ' + evaluation.recommendation,
    '',
    evaluation.synthesis.recommendationReasoning,
    '',
    '## Next Steps',
    '',
    ...evaluation.synthesis.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    '',
    '---',
    '',
    '## Confidence Statement',
    '',
    evaluation.synthesis.confidenceStatement,
    '',
    '---',
    '',
    formatConvergenceMetrics(evaluation.convergenceMetrics),
    '',
    '---',
    '',
    '## Debate Highlights',
    '',
    ...evaluation.debateHighlights.map(h => `- ${h}`)
  ];

  return lines.join('\n');
}

/**
 * Save final evaluation to idea folder
 */
export async function saveFinalEvaluation(
  evaluation: FinalEvaluation,
  ideaFolderPath: string
): Promise<string> {
  const content = formatFinalEvaluation(evaluation);
  const filePath = path.join(ideaFolderPath, 'evaluation.md');

  fs.writeFileSync(filePath, content, 'utf-8');
  logInfo(`Final evaluation saved to: ${filePath}`);

  return filePath;
}

/**
 * Load existing final evaluation
 */
export function loadFinalEvaluation(ideaFolderPath: string): string | null {
  const filePath = path.join(ideaFolderPath, 'evaluation.md');

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Check if evaluation is locked (immutable)
 */
export function isEvaluationLocked(ideaFolderPath: string): boolean {
  const content = loadFinalEvaluation(ideaFolderPath);
  if (!content) return false;

  return content.includes('*This evaluation is locked and immutable.*');
}
