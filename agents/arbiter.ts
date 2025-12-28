/**
 * Arbiter Agent
 * Judges debate rounds between Evaluator and Red Team
 * Awards points, detects first-principles arguments
 */
import { client } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { EvaluationParseError } from '../utils/errors.js';
import { logDebug } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { type Challenge, type Defense } from './redteam.js';

export type VerdictWinner = 'EVALUATOR' | 'RED_TEAM' | 'DRAW';

export interface ArbiterVerdict {
  challengeId: string;
  winner: VerdictWinner;
  reasoning: string;
  firstPrinciplesBonus: boolean;
  scoreAdjustment: number; // -3 to +3
  confidenceImpact: number; // -0.3 to +0.3
  keyInsight?: string;
}

export interface RoundResult {
  round: number;
  verdicts: ArbiterVerdict[];
  evaluatorPoints: number;
  redTeamPoints: number;
  runningScore: number;
  tokensUsed: {
    input: number;
    output: number;
  };
}

const ARBITER_SYSTEM_PROMPT = `You are the impartial Arbiter in an idea evaluation debate.

Your role is to judge each exchange between the Evaluator and Red Team:

## Judging Criteria

1. **Evidence Quality**: Who provided better evidence?
2. **Logical Rigor**: Whose argument is more logically sound?
3. **Relevance**: Who addressed the actual point at issue?
4. **Intellectual Honesty**: Did either side dodge or misrepresent?

## Verdicts

- **EVALUATOR**: The evaluator successfully defended their position
- **RED_TEAM**: The red team challenge stands; evaluator couldn't refute it
- **DRAW**: Both sides made valid points; no clear winner

## First Principles Bonus

Award a first-principles bonus (+0.5 points) when an argument:
- Derives from fundamental truths rather than analogy
- Questions assumptions others take for granted
- Provides novel insight that reframes the issue

## Score Adjustments

Recommend score adjustment based on debate outcome:
- -3 to -1: Red team revealed significant flaw
- 0: No change warranted
- +1 to +3: Evaluator's defense strengthened the case

Be fair but decisive. Debates need clear outcomes.`;

/**
 * Judge a single debate exchange
 */
export async function judgeExchange(
  challenge: Challenge,
  defense: Defense,
  previousContext: string,
  costTracker: CostTracker
): Promise<ArbiterVerdict> {
  const config = getConfig();

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 512,
    system: ARBITER_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Judge this debate exchange:

## Context
${previousContext || 'First round of debate.'}

## Challenge from ${challenge.persona.toUpperCase()}
Criterion: ${challenge.criterion.name}
Original Score: ${challenge.originalScore}/10
Challenge: ${challenge.challenge}
Severity: ${challenge.severity}

## Evaluator's Defense
Defense: ${defense.defense}
Evidence Provided: ${defense.evidenceProvided.join(', ') || 'None cited'}
Concedes: ${defense.concedes ? 'Yes' : 'No'}
${defense.adjustedScore ? `Proposed New Score: ${defense.adjustedScore}` : ''}

## Your Verdict

Respond in JSON:
{
  "winner": "EVALUATOR" | "RED_TEAM" | "DRAW",
  "reasoning": "Clear explanation of your verdict",
  "firstPrinciplesBonus": true/false,
  "scoreAdjustment": -3 to +3,
  "confidenceImpact": -0.3 to +0.3,
  "keyInsight": "Optional key insight from this exchange"
}`
    }]
  });

  costTracker.track(response.usage, 'arbiter');
  logDebug(`Arbiter judged ${challenge.id}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from arbiter');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse arbiter verdict');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      challengeId: challenge.id,
      winner: validateWinner(parsed.winner),
      reasoning: parsed.reasoning || '',
      firstPrinciplesBonus: Boolean(parsed.firstPrinciplesBonus),
      scoreAdjustment: clamp(parsed.scoreAdjustment || 0, -3, 3),
      confidenceImpact: clamp(parsed.confidenceImpact || 0, -0.3, 0.3),
      keyInsight: parsed.keyInsight
    };
  } catch {
    throw new EvaluationParseError('Invalid JSON in arbiter verdict');
  }
}

/**
 * Validate winner value
 */
function validateWinner(winner: string): VerdictWinner {
  const valid: VerdictWinner[] = ['EVALUATOR', 'RED_TEAM', 'DRAW'];
  const normalized = winner?.toUpperCase();
  return valid.includes(normalized as VerdictWinner) ? normalized as VerdictWinner : 'DRAW';
}

/**
 * Clamp number to range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Judge multiple exchanges in a round
 */
export async function judgeRound(
  challenges: Challenge[],
  defenses: Defense[],
  roundNumber: number,
  previousRoundContext: string,
  costTracker: CostTracker
): Promise<RoundResult> {
  const verdicts: ArbiterVerdict[] = [];
  let evaluatorPoints = 0;
  let redTeamPoints = 0;
  let totalScoreAdjustment = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const challenge of challenges) {
    const defense = defenses.find(d => d.challengeId === challenge.id);
    if (!defense) continue;

    // Build context from previous verdicts in this round
    const roundContext = verdicts.length > 0
      ? `Previous verdicts this round:\n${verdicts.map(v => `- ${v.challengeId}: ${v.winner}`).join('\n')}`
      : previousRoundContext;

    const verdict = await judgeExchange(challenge, defense, roundContext, costTracker);
    verdicts.push(verdict);

    // Tally points
    if (verdict.winner === 'EVALUATOR') {
      evaluatorPoints += 1 + (verdict.firstPrinciplesBonus ? 0.5 : 0);
    } else if (verdict.winner === 'RED_TEAM') {
      redTeamPoints += 1 + (verdict.firstPrinciplesBonus ? 0.5 : 0);
    } else {
      evaluatorPoints += 0.5;
      redTeamPoints += 0.5;
    }

    totalScoreAdjustment += verdict.scoreAdjustment;
  }

  const report = costTracker.getReport();

  return {
    round: roundNumber,
    verdicts,
    evaluatorPoints,
    redTeamPoints,
    runningScore: totalScoreAdjustment,
    tokensUsed: {
      input: report.inputTokens - totalInputTokens,
      output: report.outputTokens - totalOutputTokens
    }
  };
}

/**
 * Aggregate verdicts for final score adjustment
 */
export interface DebateSummary {
  totalRounds: number;
  evaluatorWins: number;
  redTeamWins: number;
  draws: number;
  firstPrinciplesBonuses: number;
  netScoreAdjustment: number;
  netConfidenceImpact: number;
  keyInsights: string[];
  recommendedFinalScore: number;
}

export function summarizeDebate(
  allRounds: RoundResult[],
  originalScore: number
): DebateSummary {
  let evaluatorWins = 0;
  let redTeamWins = 0;
  let draws = 0;
  let firstPrinciplesBonuses = 0;
  let netScoreAdjustment = 0;
  let netConfidenceImpact = 0;
  const keyInsights: string[] = [];

  for (const round of allRounds) {
    for (const verdict of round.verdicts) {
      if (verdict.winner === 'EVALUATOR') evaluatorWins++;
      else if (verdict.winner === 'RED_TEAM') redTeamWins++;
      else draws++;

      if (verdict.firstPrinciplesBonus) firstPrinciplesBonuses++;
      netScoreAdjustment += verdict.scoreAdjustment;
      netConfidenceImpact += verdict.confidenceImpact;

      if (verdict.keyInsight) {
        keyInsights.push(verdict.keyInsight);
      }
    }
  }

  // Cap adjustments
  netScoreAdjustment = clamp(netScoreAdjustment, -5, 5);
  netConfidenceImpact = clamp(netConfidenceImpact, -0.5, 0.5);

  const recommendedFinalScore = clamp(originalScore + netScoreAdjustment, 1, 10);

  return {
    totalRounds: allRounds.length,
    evaluatorWins,
    redTeamWins,
    draws,
    firstPrinciplesBonuses,
    netScoreAdjustment,
    netConfidenceImpact,
    keyInsights,
    recommendedFinalScore
  };
}

/**
 * Format debate summary for display
 */
export function formatDebateSummary(
  summary: DebateSummary,
  criterionName: string,
  originalScore: number
): string {
  const lines: string[] = [
    `## Debate Summary: ${criterionName}\n`,
    `Original Score: ${originalScore}/10`,
    `Final Score: ${summary.recommendedFinalScore}/10 (${summary.netScoreAdjustment >= 0 ? '+' : ''}${summary.netScoreAdjustment})\n`,
    `### Results`,
    `- Evaluator Wins: ${summary.evaluatorWins}`,
    `- Red Team Wins: ${summary.redTeamWins}`,
    `- Draws: ${summary.draws}`,
    `- First Principles Bonuses: ${summary.firstPrinciplesBonuses}\n`
  ];

  if (summary.keyInsights.length > 0) {
    lines.push('### Key Insights');
    summary.keyInsights.forEach(insight => lines.push(`- ${insight}`));
  }

  return lines.join('\n');
}
