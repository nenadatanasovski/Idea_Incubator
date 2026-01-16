/**
 * Convergence Detection
 * Determines when debate has reached stable conclusions
 */
import { getConfig } from "../config/index.js";
// Logger imports removed - using getConfig for debug settings
import { type FullDebateResult, type CriterionDebate } from "./debate.js";

export type ConvergenceReason =
  | "SCORE_STABILITY"
  | "MAX_ROUNDS"
  | "TIMEOUT"
  | "BUDGET_EXCEEDED"
  | "UNANIMOUS_VERDICT";

export interface ConvergenceState {
  round: number;
  scores: Map<string, number[]>; // criterion ID -> history of scores
  confidence: Map<string, number[]>; // criterion ID -> history of confidence
  challengeStats: {
    total: number;
    defended: number;
    critical: number;
    criticalResolved: number;
  };
  insights: string[];
  hasConverged: boolean;
  reason?: ConvergenceReason;
}

export interface ConvergenceResult {
  converged: boolean;
  reason?: ConvergenceReason;
  blockers: string[];
  metrics: {
    scoreStability: boolean;
    confidenceMet: boolean;
    challengesResolved: boolean;
    informationSaturated: boolean;
  };
  readyForSynthesis: boolean;
}

/**
 * Initialize convergence state
 */
export function initConvergenceState(): ConvergenceState {
  return {
    round: 0,
    scores: new Map(),
    confidence: new Map(),
    challengeStats: {
      total: 0,
      defended: 0,
      critical: 0,
      criticalResolved: 0,
    },
    insights: [],
    hasConverged: false,
  };
}

/**
 * Update convergence state after a debate round
 */
export function updateConvergenceState(
  state: ConvergenceState,
  debate: CriterionDebate,
): ConvergenceState {
  const criterionId = debate.criterion.id;

  // Update score history
  if (!state.scores.has(criterionId)) {
    state.scores.set(criterionId, []);
  }
  state.scores.get(criterionId)!.push(debate.finalScore);

  // Update confidence history
  if (!state.confidence.has(criterionId)) {
    state.confidence.set(criterionId, []);
  }
  state.confidence.get(criterionId)!.push(debate.finalConfidence);

  // Update challenge stats
  for (const challenge of debate.challenges) {
    state.challengeStats.total++;
    if (challenge.severity === "critical") {
      state.challengeStats.critical++;
    }
  }

  // Count defended challenges (evaluator wins)
  for (const round of debate.rounds) {
    for (const verdict of round.verdicts) {
      if (verdict.winner === "EVALUATOR") {
        state.challengeStats.defended++;
      }
    }
  }

  // Collect insights
  state.insights.push(...debate.summary.keyInsights);

  state.round++;
  return state;
}

/**
 * Check if debate has converged
 */
export function checkConvergence(state: ConvergenceState): ConvergenceResult {
  const config = getConfig();
  const criteria = config.convergence;
  const blockers: string[] = [];

  // 1. Check score stability
  let scoreStable = true;
  for (const [criterionId, history] of state.scores) {
    if (history.length >= criteria.scoreStability.consecutiveRounds) {
      const recent = history.slice(-criteria.scoreStability.consecutiveRounds);
      const delta = Math.max(...recent) - Math.min(...recent);
      if (delta > criteria.scoreStability.maxDelta) {
        scoreStable = false;
        blockers.push(
          `Score for "${criterionId}" still volatile (Δ=${delta.toFixed(2)})`,
        );
      }
    }
  }

  // 2. Check confidence threshold
  let confidenceMet = true;
  for (const [criterionId, history] of state.confidence) {
    const latest = history[history.length - 1];
    if (latest < criteria.confidenceThreshold.minimum) {
      confidenceMet = false;
      blockers.push(
        `Confidence for "${criterionId}" below threshold (${(latest * 100).toFixed(0)}%)`,
      );
    }
  }

  // 3. Check critical challenges resolved
  const criticalResolutionRate =
    state.challengeStats.critical > 0
      ? state.challengeStats.criticalResolved / state.challengeStats.critical
      : 1.0;
  const challengesResolved = criticalResolutionRate >= 0.8;

  if (!challengesResolved && state.challengeStats.critical > 0) {
    const unresolved =
      state.challengeStats.critical - state.challengeStats.criticalResolved;
    blockers.push(`${unresolved} critical challenges unresolved`);
  }

  // 4. Check information saturation (no new insights in last round)
  const informationSaturated =
    state.round > 1 &&
    state.insights.length === state.insights.slice(0, -1).length;

  // Determine convergence
  const converged = scoreStable && confidenceMet && challengesResolved;

  let reason: ConvergenceReason | undefined;
  if (converged) {
    reason = "SCORE_STABILITY";
  }

  return {
    converged,
    reason,
    blockers,
    metrics: {
      scoreStability: scoreStable,
      confidenceMet,
      challengesResolved,
      informationSaturated,
    },
    readyForSynthesis: converged || informationSaturated,
  };
}

/**
 * Force convergence with reason
 */
export function forceConvergence(
  state: ConvergenceState,
  reason: ConvergenceReason,
): ConvergenceState {
  return {
    ...state,
    hasConverged: true,
    reason,
  };
}

/**
 * Check if debate should continue or stop
 */
export interface ContinueDecision {
  continue: boolean;
  reason: string;
  suggestedAction?: "more_rounds" | "synthesis" | "abort";
}

export function shouldContinueDebate(
  state: ConvergenceState,
  elapsedMs: number,
  currentCost: number,
): ContinueDecision {
  const config = getConfig();

  // Check timeout
  if (elapsedMs >= config.debate.maxDuration) {
    return {
      continue: false,
      reason: `Timeout reached (${(elapsedMs / 1000).toFixed(0)}s)`,
      suggestedAction: "synthesis",
    };
  }

  // Check max rounds
  if (state.round >= config.debate.maxRounds) {
    return {
      continue: false,
      reason: `Max rounds reached (${state.round})`,
      suggestedAction: "synthesis",
    };
  }

  // Check budget
  if (currentCost >= config.budget.default * 0.9) {
    return {
      continue: false,
      reason: `Budget nearly exhausted ($${currentCost.toFixed(2)})`,
      suggestedAction: "synthesis",
    };
  }

  // Check convergence
  const convergence = checkConvergence(state);
  if (convergence.converged) {
    return {
      continue: false,
      reason: "Debate has converged",
      suggestedAction: "synthesis",
    };
  }

  // Continue if not converged but making progress
  return {
    continue: true,
    reason: `Round ${state.round + 1} needed: ${convergence.blockers.join(", ")}`,
    suggestedAction: "more_rounds",
  };
}

/**
 * Calculate overall convergence metrics from full debate
 */
export interface OverallConvergenceMetrics {
  totalCriteria: number;
  stableCriteria: number;
  highConfidenceCriteria: number;
  totalChallenges: number;
  defendedChallenges: number;
  defenseRate: number;
  criticalChallenges: number;
  criticalResolved: number;
  uniqueInsights: number;
  overallConvergence: number; // 0-1 score
}

export function calculateOverallMetrics(
  result: FullDebateResult,
): OverallConvergenceMetrics {
  const config = getConfig();
  let stableCriteria = 0;
  let highConfidenceCriteria = 0;
  let totalChallenges = 0;
  let defendedChallenges = 0;
  let criticalChallenges = 0;
  let criticalResolved = 0;
  const insights = new Set<string>();

  for (const debate of result.debates) {
    // Check stability
    const scoreDelta = Math.abs(debate.finalScore - debate.originalScore);
    if (scoreDelta <= config.convergence.scoreStability.maxDelta) {
      stableCriteria++;
    }

    // Check confidence
    if (
      debate.finalConfidence >= config.convergence.confidenceThreshold.minimum
    ) {
      highConfidenceCriteria++;
    }

    // Count challenges
    totalChallenges += debate.challenges.length;
    criticalChallenges += debate.challenges.filter(
      (c) => c.severity === "critical",
    ).length;

    // Count defenses (from rounds)
    for (const round of debate.rounds) {
      for (const verdict of round.verdicts) {
        if (verdict.winner === "EVALUATOR") {
          defendedChallenges++;
        }
      }
    }

    // Collect unique insights
    debate.summary.keyInsights.forEach((i) => insights.add(i));
  }

  const totalCriteria = result.debates.length;
  const defenseRate =
    totalChallenges > 0 ? defendedChallenges / totalChallenges : 1.0;

  // Calculate overall convergence score
  const stabilityScore =
    totalCriteria > 0 ? stableCriteria / totalCriteria : 1.0;
  const confidenceScore =
    totalCriteria > 0 ? highConfidenceCriteria / totalCriteria : 1.0;
  const overallConvergence =
    (stabilityScore + confidenceScore + defenseRate) / 3;

  return {
    totalCriteria,
    stableCriteria,
    highConfidenceCriteria,
    totalChallenges,
    defendedChallenges,
    defenseRate,
    criticalChallenges,
    criticalResolved,
    uniqueInsights: insights.size,
    overallConvergence,
  };
}

/**
 * Format convergence metrics for display
 */
export function formatConvergenceMetrics(
  metrics: OverallConvergenceMetrics,
): string {
  const lines: string[] = [
    "## Convergence Metrics\n",
    `- Criteria Stability: ${metrics.stableCriteria}/${metrics.totalCriteria} (${((metrics.stableCriteria / metrics.totalCriteria) * 100).toFixed(0)}%)`,
    `- High Confidence: ${metrics.highConfidenceCriteria}/${metrics.totalCriteria} (${((metrics.highConfidenceCriteria / metrics.totalCriteria) * 100).toFixed(0)}%)`,
    `- Defense Rate: ${(metrics.defenseRate * 100).toFixed(0)}%`,
    `- Critical Challenges: ${metrics.criticalChallenges} (${metrics.criticalResolved} resolved)`,
    `- Unique Insights: ${metrics.uniqueInsights}`,
    `\n**Overall Convergence: ${(metrics.overallConvergence * 100).toFixed(0)}%**`,
  ];

  if (metrics.overallConvergence >= 0.8) {
    lines.push("_Status: Strong convergence achieved_");
  } else if (metrics.overallConvergence >= 0.6) {
    lines.push("_Status: Moderate convergence - synthesis recommended_");
  } else {
    lines.push(
      "_Status: Weak convergence - further debate may improve results_",
    );
  }

  return lines.join("\n");
}
