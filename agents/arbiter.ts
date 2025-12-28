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

  const userContent = `Judge this debate exchange:

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
}`;

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 512,
    system: ARBITER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from arbiter');
  }

  // Track with request/response data for API logging
  costTracker.track(
    response.usage,
    'arbiter',
    {
      model: config.model,
      system: ARBITER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: 512,
    },
    {
      content: content.text,
      stop_reason: response.stop_reason,
    }
  );
  logDebug(`Arbiter judged ${challenge.id}`);

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
 * Judge multiple exchanges in a round (legacy - multiple API calls)
 * @deprecated Use judgeRound which now bundles all exchanges
 */
export async function judgeRoundLegacy(
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
 * Judge ALL exchanges in a round with a SINGLE API call
 * This is more efficient than judging each exchange separately
 */
export async function judgeRound(
  challenges: Challenge[],
  defenses: Defense[],
  roundNumber: number,
  previousRoundContext: string,
  costTracker: CostTracker
): Promise<RoundResult> {
  const config = getConfig();

  // Build all exchanges for bundled judgment
  const exchanges: Array<{ challenge: Challenge; defense: Defense }> = [];
  for (const challenge of challenges) {
    const defense = defenses.find(d => d.challengeId === challenge.id);
    if (defense) {
      exchanges.push({ challenge, defense });
    }
  }

  if (exchanges.length === 0) {
    return {
      round: roundNumber,
      verdicts: [],
      evaluatorPoints: 0,
      redTeamPoints: 0,
      runningScore: 0,
      tokensUsed: { input: 0, output: 0 }
    };
  }

  // Format all exchanges for the prompt
  const exchangesText = exchanges.map(({ challenge, defense }, i) => `
### Exchange ${i + 1}: ${challenge.id}

**Challenge from ${challenge.persona.toUpperCase()}**
Criterion: ${challenge.criterion.name}
Original Score: ${challenge.originalScore}/10
Challenge: ${challenge.challenge}
Severity: ${challenge.severity}

**Evaluator's Defense**
Defense: ${defense.defense}
Evidence Provided: ${defense.evidenceProvided.join(', ') || 'None cited'}
Concedes: ${defense.concedes ? 'Yes' : 'No'}
${defense.adjustedScore ? `Proposed New Score: ${defense.adjustedScore}` : ''}`).join('\n\n---\n');

  const userContent = `Judge ALL of these debate exchanges in Round ${roundNumber}:

## Context
${previousRoundContext || 'First round of debate.'}

## Exchanges to Judge
${exchangesText}

## Your Task
Provide a verdict for EACH exchange. Consider them holistically - how do they relate to each other? Do patterns emerge?

Respond in JSON with verdicts for ALL ${exchanges.length} exchanges:
{
  "verdicts": [
    {
      "challengeId": "the challenge id",
      "winner": "EVALUATOR" | "RED_TEAM" | "DRAW",
      "reasoning": "Clear explanation of your verdict",
      "firstPrinciplesBonus": true/false,
      "scoreAdjustment": -3 to +3,
      "confidenceImpact": -0.3 to +0.3,
      "keyInsight": "Optional key insight from this exchange"
    }
  ]
}`;

  const maxTokens = 1024 + (exchanges.length * 256);

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: ARBITER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new EvaluationParseError('Unexpected response from arbiter');
  }

  // Track with request/response data for API logging
  costTracker.track(
    response.usage,
    'arbiter-bundled',
    {
      model: config.model,
      system: ARBITER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: maxTokens,
    },
    {
      content: content.text,
      stop_reason: response.stop_reason,
    }
  );
  logDebug(`Arbiter judged ${exchanges.length} exchanges in round ${roundNumber}`);

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError('Could not parse arbiter verdicts');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawVerdicts = parsed.verdicts || [];

    // Map verdicts to challenge IDs and validate
    const verdicts: ArbiterVerdict[] = rawVerdicts.map((v: any, i: number) => {
      // Try to match by challengeId, fallback to index-based matching
      const matchedExchange = exchanges.find(e => e.challenge.id === v.challengeId) || exchanges[i];
      const challengeId = matchedExchange?.challenge.id || v.challengeId || `unknown-${i}`;

      return {
        challengeId,
        winner: validateWinner(v.winner),
        reasoning: v.reasoning || '',
        firstPrinciplesBonus: Boolean(v.firstPrinciplesBonus),
        scoreAdjustment: clamp(v.scoreAdjustment || 0, -3, 3),
        confidenceImpact: clamp(v.confidenceImpact || 0, -0.3, 0.3),
        keyInsight: v.keyInsight
      };
    });

    // Tally points
    let evaluatorPoints = 0;
    let redTeamPoints = 0;
    let totalScoreAdjustment = 0;

    for (const verdict of verdicts) {
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
        input: report.inputTokens,
        output: report.outputTokens
      }
    };
  } catch {
    throw new EvaluationParseError('Invalid JSON in arbiter verdicts');
  }
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
