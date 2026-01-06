/**
 * Debate Orchestration
 * Manages the multi-round debate between Evaluator and Red Team
 */
import { CostTracker } from '../utils/cost-tracker.js';
import { logInfo, logDebug, logWarning } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { type CriterionDefinition, CATEGORIES, type Category } from './config.js';
import { type EvaluationResult } from './evaluator.js';
import {
  generateAllChallenges,
  generateDefense,
  formatChallenges,
  type Challenge,
  PERSONA_DEFINITIONS
} from './redteam.js';
import {
  judgeRound,
  summarizeDebate,
  formatDebateSummary,
  type RoundResult,
  type DebateSummary
} from './arbiter.js';

// Broadcaster type for WebSocket events
type Broadcaster = ReturnType<typeof import('../utils/broadcast.js').createBroadcaster>;

/**
 * Debounced budget broadcaster to prevent overwhelming WebSocket with updates
 * Only broadcasts if at least intervalMs has passed since last broadcast
 */
function createDebouncedBudgetBroadcast(broadcaster: Broadcaster, intervalMs: number = 500) {
  let lastBroadcast = 0;
  return async (costTracker: CostTracker) => {
    const now = Date.now();
    if (now - lastBroadcast >= intervalMs) {
      const report = costTracker.getReport();
      await broadcaster.budgetStatus(
        report.estimatedCost,
        report.budgetRemaining,
        report.estimatedCost + report.budgetRemaining,
        report.apiCalls
      );
      lastBroadcast = now;
    }
  };
}

export interface DebateConfig {
  challengesPerCriterion: number;
  roundsPerChallenge: number;
  maxRounds: number;
  maxDuration: number; // milliseconds
}

export interface CriterionDebate {
  criterion: CriterionDefinition;
  originalScore: number;
  originalReasoning: string;
  challenges: Challenge[];
  rounds: RoundResult[];
  summary: DebateSummary;
  finalScore: number;
  finalConfidence: number;
}

export interface FullDebateResult {
  ideaSlug: string;
  debates: CriterionDebate[];
  categoryResults: Record<Category, {
    originalAvg: number;
    finalAvg: number;
    delta: number;
  }>;
  overallOriginalScore: number;
  overallFinalScore: number;
  totalRounds: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  duration: number;
  timestamp: string;
}

/**
 * Run full debate for a single criterion
 */
export async function runCriterionDebate(
  criterion: CriterionDefinition,
  evaluation: EvaluationResult,
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  debouncedBudgetBroadcast?: (costTracker: CostTracker) => Promise<void>
): Promise<CriterionDebate> {
  const config = getConfig();
  const debateConfig = config.debate;

  logInfo(`Starting debate for: ${criterion.name}`);

  // Broadcast criterion debate start with initial assessment
  if (broadcaster) {
    await broadcaster.criterionStart(
      criterion.name,
      criterion.category,
      evaluation.score,
      evaluation.reasoning
    );
  }

  // Generate challenges from all personas
  const challenges = await generateAllChallenges(
    criterion,
    evaluation.reasoning,
    evaluation.score,
    evaluation.reasoning,
    costTracker
  );

  // Broadcast budget status after generating challenges
  if (debouncedBudgetBroadcast) {
    await debouncedBudgetBroadcast(costTracker);
  }

  // Limit challenges if needed
  const activeChallenges = challenges.slice(0, debateConfig.challengesPerCriterion);

  // Note: Challenges are broadcast per-round below with round numbers

  if (activeChallenges.length === 0) {
    logWarning(`No challenges generated for ${criterion.name}`);
    return {
      criterion,
      originalScore: evaluation.score,
      originalReasoning: evaluation.reasoning,
      challenges: [],
      rounds: [],
      summary: {
        totalRounds: 0,
        evaluatorWins: 0,
        redTeamWins: 0,
        draws: 0,
        firstPrinciplesBonuses: 0,
        netScoreAdjustment: 0,
        netConfidenceImpact: 0,
        keyInsights: [],
        recommendedFinalScore: evaluation.score
      },
      finalScore: evaluation.score,
      finalConfidence: evaluation.confidence
    };
  }

  // Run debate rounds
  const rounds: RoundResult[] = [];
  let previousContext = '';

  for (let round = 1; round <= debateConfig.roundsPerChallenge; round++) {
    logDebug(`Round ${round} for ${criterion.name}`);

    // Broadcast round start
    if (broadcaster) {
      await broadcaster.roundStarted(criterion.name, criterion.category, round);
    }

    // Broadcast challenges for this round (with round number)
    if (broadcaster) {
      for (const challenge of activeChallenges) {
        const personaDef = PERSONA_DEFINITIONS[challenge.persona];
        await broadcaster.redteamChallenge(
          criterion.name,
          criterion.category,
          personaDef.name,
          challenge.challenge,
          round
        );
      }
    }

    // Generate defenses for active challenges
    const defenses = await generateDefense(activeChallenges, ideaContent, costTracker);

    // Broadcast budget status after generating defenses
    if (debouncedBudgetBroadcast) {
      await debouncedBudgetBroadcast(costTracker);
    }

    // Broadcast evaluator defenses (as DEFENSE, not initial assessment)
    if (broadcaster) {
      for (const defense of defenses) {
        await broadcaster.evaluatorDefense(
          criterion.name,
          criterion.category,
          defense.defense,
          defense.concedes,
          defense.adjustedScore
        );
      }
    }

    // Judge the round
    const roundResult = await judgeRound(
      activeChallenges,
      defenses,
      round,
      previousContext,
      costTracker
    );

    // Broadcast budget status after judging
    if (debouncedBudgetBroadcast) {
      await debouncedBudgetBroadcast(costTracker);
    }

    // Broadcast arbiter verdicts (with winner info)
    if (broadcaster) {
      for (const verdict of roundResult.verdicts) {
        await broadcaster.arbiterVerdict(
          criterion.name,
          criterion.category,
          verdict.reasoning,
          verdict.scoreAdjustment,
          verdict.winner
        );
      }
    }

    rounds.push(roundResult);

    // Build context for next round
    previousContext = rounds.map(r =>
      `Round ${r.round}: Evaluator ${r.evaluatorPoints} - Red Team ${r.redTeamPoints}`
    ).join('\n');

    // Check budget
    costTracker.checkBudget();
  }

  // Summarize debate
  const summary = summarizeDebate(rounds, evaluation.score);

  // Calculate final values
  const finalScore = Math.max(1, Math.min(10, summary.recommendedFinalScore));
  const finalConfidence = Math.max(0, Math.min(1,
    evaluation.confidence + summary.netConfidenceImpact
  ));

  // Broadcast criterion debate complete with original and final scores
  if (broadcaster) {
    await broadcaster.criterionComplete(
      criterion.name,
      criterion.category,
      evaluation.score,
      finalScore
    );
  }

  logInfo(`Debate complete for ${criterion.name}: ${evaluation.score} -> ${finalScore}`);

  return {
    criterion,
    originalScore: evaluation.score,
    originalReasoning: evaluation.reasoning,
    challenges: activeChallenges,
    rounds,
    summary,
    finalScore,
    finalConfidence
  };
}

/**
 * Run debate for all criteria in parallel (across ALL categories)
 * This ensures all categories get debated even with limited budget
 */
export async function runFullDebate(
  ideaSlug: string,
  evaluations: EvaluationResult[],
  ideaContent: string,
  costTracker: CostTracker,
  broadcaster?: Broadcaster
): Promise<FullDebateResult> {
  const startTime = Date.now();
  const config = getConfig();

  logInfo(`Starting full debate for: ${ideaSlug}`);
  logInfo(`Debating ${evaluations.length} criteria across all categories in parallel...`);

  // Emit budget status at start of debate phase
  const initialReport = costTracker.getReport();
  if (broadcaster) {
    await broadcaster.budgetStatus(
      initialReport.estimatedCost,
      initialReport.budgetRemaining,
      initialReport.estimatedCost + initialReport.budgetRemaining,
      initialReport.apiCalls
    );
  }

  // Create debounced budget broadcaster for periodic updates during debates
  const debouncedBudgetBroadcast = broadcaster
    ? createDebouncedBudgetBroadcast(broadcaster, 500)
    : undefined;

  // Run ALL criteria debates in parallel (not sequentially by category)
  // This ensures all 6 categories get equal chance at budget
  const debatePromises = evaluations.map(eval_ =>
    runCriterionDebate(eval_.criterion, eval_, ideaContent, costTracker, broadcaster, debouncedBudgetBroadcast)
      .catch(error => {
        const isBudgetError = error.message?.includes('budget') || error.name === 'BudgetExceededError';
        logWarning(`Debate failed for ${eval_.criterion.name}: ${error.message}`);
        // Emit completion with original score on failure
        if (broadcaster) {
          broadcaster.criterionComplete(
            eval_.criterion.name,
            eval_.criterion.category,
            eval_.score,
            eval_.score // Use original score on failure
          );
        }
        // Return a fallback result instead of throwing
        return {
          criterion: eval_.criterion,
          originalScore: eval_.score,
          originalReasoning: eval_.reasoning,
          challenges: [],
          rounds: [],
          summary: {
            totalRounds: 0,
            evaluatorWins: 0,
            redTeamWins: 0,
            draws: 0,
            firstPrinciplesBonuses: 0,
            netScoreAdjustment: 0,
            netConfidenceImpact: 0,
            keyInsights: [isBudgetError ? 'Debate skipped: budget exceeded' : `Debate skipped: ${error.message}`],
            recommendedFinalScore: eval_.score
          },
          finalScore: eval_.score,
          finalConfidence: eval_.confidence
        } as CriterionDebate;
      })
  );

  const allDebates = await Promise.all(debatePromises);

  // Log completion status
  const completedDebates = allDebates.filter(d => d.rounds.length > 0);
  const skippedDebates = allDebates.filter(d => d.rounds.length === 0);
  if (skippedDebates.length > 0) {
    logWarning(`${skippedDebates.length} criteria skipped due to budget/errors`);
    // Emit skipped events for transparency
    if (broadcaster) {
      for (const skipped of skippedDebates) {
        const reason = skipped.summary.keyInsights[0] || 'Unknown reason';
        await broadcaster.criterionSkipped(
          skipped.criterion.name,
          skipped.criterion.category,
          reason,
          skipped.originalScore
        );
      }
    }
  }
  logInfo(`Completed ${completedDebates.length}/${allDebates.length} criterion debates`);

  // Emit final budget status
  const finalReport = costTracker.getReport();
  if (broadcaster) {
    await broadcaster.budgetStatus(
      finalReport.estimatedCost,
      finalReport.budgetRemaining,
      finalReport.estimatedCost + finalReport.budgetRemaining,
      finalReport.apiCalls
    );
  }

  // Calculate category results
  const categoryResults: Record<Category, { originalAvg: number; finalAvg: number; delta: number }> = {
    problem: { originalAvg: 0, finalAvg: 0, delta: 0 },
    solution: { originalAvg: 0, finalAvg: 0, delta: 0 },
    feasibility: { originalAvg: 0, finalAvg: 0, delta: 0 },
    fit: { originalAvg: 0, finalAvg: 0, delta: 0 },
    market: { originalAvg: 0, finalAvg: 0, delta: 0 },
    risk: { originalAvg: 0, finalAvg: 0, delta: 0 }
  };

  for (const category of CATEGORIES) {
    const categoryDebates = allDebates.filter(d => d.criterion.category === category);
    if (categoryDebates.length > 0) {
      const originalAvg = categoryDebates.reduce((sum, d) => sum + d.originalScore, 0) / categoryDebates.length;
      const finalAvg = categoryDebates.reduce((sum, d) => sum + d.finalScore, 0) / categoryDebates.length;
      categoryResults[category] = {
        originalAvg,
        finalAvg,
        delta: finalAvg - originalAvg
      };
    }
  }

  // Calculate overall scores
  const weights = config.categoryWeights;
  const overallOriginalScore = CATEGORIES.reduce((sum, cat) =>
    sum + categoryResults[cat].originalAvg * weights[cat], 0
  );
  const overallFinalScore = CATEGORIES.reduce((sum, cat) =>
    sum + categoryResults[cat].finalAvg * weights[cat], 0
  );

  const totalRounds = allDebates.reduce((sum, d) => sum + d.rounds.length, 0);
  const report = costTracker.getReport();
  const duration = Date.now() - startTime;

  logInfo(`Full debate complete in ${(duration / 1000).toFixed(1)}s`);
  logInfo(`Overall score: ${overallOriginalScore.toFixed(2)} -> ${overallFinalScore.toFixed(2)}`);

  return {
    ideaSlug,
    debates: allDebates,
    categoryResults,
    overallOriginalScore,
    overallFinalScore,
    totalRounds,
    tokensUsed: {
      input: report.inputTokens,
      output: report.outputTokens
    },
    duration,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format full debate results for display
 */
export function formatDebateResults(result: FullDebateResult): string {
  const lines: string[] = [
    `# Debate Results: ${result.ideaSlug}\n`,
    `Duration: ${(result.duration / 1000).toFixed(1)}s`,
    `Total Rounds: ${result.totalRounds}`,
    `Overall Score: ${result.overallOriginalScore.toFixed(2)} -> **${result.overallFinalScore.toFixed(2)}**`,
    `(Change: ${result.overallFinalScore >= result.overallOriginalScore ? '+' : ''}${(result.overallFinalScore - result.overallOriginalScore).toFixed(2)})\n`,
    '## Category Summary\n',
    '| Category | Original | Final | Change |',
    '|----------|----------|-------|--------|'
  ];

  for (const category of CATEGORIES) {
    const cat = result.categoryResults[category];
    const change = cat.delta >= 0 ? `+${cat.delta.toFixed(1)}` : cat.delta.toFixed(1);
    lines.push(`| ${category} | ${cat.originalAvg.toFixed(1)} | ${cat.finalAvg.toFixed(1)} | ${change} |`);
  }

  lines.push('\n## Significant Score Changes\n');

  const significantChanges = result.debates
    .filter(d => Math.abs(d.finalScore - d.originalScore) >= 1)
    .sort((a, b) => Math.abs(b.finalScore - b.originalScore) - Math.abs(a.finalScore - a.originalScore));

  if (significantChanges.length === 0) {
    lines.push('No significant score changes from debate.');
  } else {
    for (const debate of significantChanges) {
      const change = debate.finalScore - debate.originalScore;
      const direction = change > 0 ? '📈' : '📉';
      lines.push(`${direction} **${debate.criterion.name}**: ${debate.originalScore} -> ${debate.finalScore} (${change >= 0 ? '+' : ''}${change.toFixed(1)})`);

      if (debate.summary.keyInsights.length > 0) {
        lines.push(`  _${debate.summary.keyInsights[0]}_`);
      }
    }
  }

  lines.push('\n## Key Insights\n');
  const allInsights = result.debates
    .flatMap(d => d.summary.keyInsights)
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe

  if (allInsights.length === 0) {
    lines.push('No key insights recorded.');
  } else {
    allInsights.slice(0, 10).forEach(insight => lines.push(`- ${insight}`));
  }

  return lines.join('\n');
}

/**
 * Get transcript for a specific criterion debate
 */
export function getDebateTranscript(debate: CriterionDebate): string {
  const lines: string[] = [
    `# Debate Transcript: ${debate.criterion.name}\n`,
    `Original Score: ${debate.originalScore}/10\n`,
    '## Challenges\n',
    formatChallenges(debate.challenges),
    '\n## Rounds\n'
  ];

  for (const round of debate.rounds) {
    lines.push(`### Round ${round.round}\n`);
    lines.push(`Evaluator Points: ${round.evaluatorPoints} | Red Team Points: ${round.redTeamPoints}\n`);

    for (const verdict of round.verdicts) {
      lines.push(`**${verdict.challengeId}**: ${verdict.winner}`);
      lines.push(`> ${verdict.reasoning}`);
      if (verdict.keyInsight) {
        lines.push(`_Insight: ${verdict.keyInsight}_`);
      }
      lines.push('');
    }
  }

  lines.push(formatDebateSummary(debate.summary, debate.criterion.name, debate.originalScore));

  return lines.join('\n');
}
