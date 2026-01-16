/**
 * Approach Recommendation Engine
 *
 * Analyzes user profile and financial allocation to recommend
 * the most suitable strategic approaches for an idea.
 */

import type {
  StrategicApproach,
  IdeaFinancialAllocation,
  UserProfileSummary,
} from "../types";
import { strategicApproachMeta } from "../types";

export interface ApproachRecommendation {
  approach: StrategicApproach;
  score: number;
  reasons: string[];
  concerns: string[];
}

export interface RecommendationInput {
  allocation?: IdeaFinancialAllocation | null;
  profile?: UserProfileSummary | null;
}

const APPROACHES: StrategicApproach[] = [
  "create",
  "copy_improve",
  "combine",
  "localize",
  "specialize",
  "time",
];

/**
 * Analyze runway constraints and adjust scores accordingly
 */
function analyzeRunway(
  approach: StrategicApproach,
  runwayMonths: number,
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (approach === "create") {
    if (runwayMonths >= 18) {
      result.score += 15;
      result.reasons.push(
        "Your 18+ month runway supports long development cycles",
      );
    } else if (runwayMonths < 12) {
      result.score -= 20;
      result.concerns.push(
        "Short runway may not support new category creation",
      );
    }
  } else if (approach === "copy_improve" || approach === "localize") {
    if (runwayMonths <= 8) {
      result.score += 10;
      result.reasons.push("Faster time-to-revenue fits your runway");
    }
  }
}

/**
 * Analyze income type and exit intent
 */
function analyzeIncomeType(
  approach: StrategicApproach,
  allocation: IdeaFinancialAllocation,
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (allocation.incomeType === "full_replacement") {
    if (["copy_improve", "localize", "specialize"].includes(approach)) {
      result.score += 15;
      result.reasons.push("Proven models provide more predictable income");
    } else if (approach === "create") {
      result.score -= 10;
      result.concerns.push(
        "New category creation has unpredictable income timeline",
      );
    }
  } else if (
    allocation.incomeType === "wealth_building" &&
    allocation.exitIntent
  ) {
    if (approach === "create") {
      result.score += 20;
      result.reasons.push("Novel solutions have higher exit multiples");
    }
  }
}

/**
 * Analyze risk tolerance
 */
function analyzeRiskTolerance(
  approach: StrategicApproach,
  riskTolerance: string | undefined,
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (riskTolerance === "high" || riskTolerance === "very_high") {
    if (approach === "create" || approach === "time") {
      result.score += 10;
      result.reasons.push("Your high risk tolerance allows for bolder bets");
    }
  } else if (riskTolerance === "low") {
    if (approach === "copy_improve" || approach === "localize") {
      result.score += 15;
      result.reasons.push(
        "Lower risk approaches match your conservative preference",
      );
    } else if (approach === "create") {
      result.score -= 15;
      result.concerns.push("High-risk approach may not match your preferences");
    }
  }
}

/**
 * Analyze budget constraints
 */
function analyzeBudget(
  approach: StrategicApproach,
  budget: number,
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (budget < 10000) {
    if (approach === "create") {
      result.score -= 10;
      result.concerns.push("Limited budget may constrain category creation");
    } else if (approach === "specialize" || approach === "localize") {
      result.score += 10;
      result.reasons.push("Can be executed with modest budget");
    }
  }
}

/**
 * Analyze profile goals
 */
function analyzeProfileGoals(
  approach: StrategicApproach,
  goals: string[],
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (goals.includes("income")) {
    if (approach === "copy_improve" || approach === "localize") {
      result.score += 10;
      result.reasons.push("Income goal favors proven revenue models");
    }
  }
  if (goals.includes("exit")) {
    if (approach === "create") {
      result.score += 15;
      result.reasons.push("Exit goal aligns with differentiated offerings");
    }
  }
  if (goals.includes("learning")) {
    if (approach === "create" || approach === "combine") {
      result.score += 5;
      result.reasons.push("Creative approaches maximize learning");
    }
  }
}

/**
 * Analyze domain expertise
 */
function analyzeDomainExpertise(
  approach: StrategicApproach,
  profile: UserProfileSummary,
  result: { score: number; reasons: string[]; concerns: string[] },
): void {
  if (profile.domain_expertise) {
    if (approach === "specialize") {
      result.score += 15;
      result.reasons.push("Your domain expertise supports niche positioning");
    }
  }

  // Location analysis for localize approach
  const profileAny = profile as any;
  if (profileAny.city || profileAny.country) {
    if (approach === "localize") {
      result.score += 10;
      result.reasons.push(
        `Your knowledge of ${profileAny.city || profileAny.country} is an advantage`,
      );
    }
  }
}

/**
 * Generate approach recommendations based on profile and allocation data.
 * Returns a sorted array of recommendations with scores and rationale.
 */
export function generateApproachRecommendations(
  input: RecommendationInput,
): ApproachRecommendation[] {
  const { allocation, profile } = input;
  const results: ApproachRecommendation[] = [];

  for (const approach of APPROACHES) {
    const result = {
      approach,
      score: 50, // Base score
      reasons: [] as string[],
      concerns: [] as string[],
    };

    // Analyze based on allocation
    if (allocation) {
      const runway = allocation.allocatedRunwayMonths || 0;
      analyzeRunway(approach, runway, result);
      analyzeIncomeType(approach, allocation, result);

      const risk =
        allocation.ideaRiskTolerance || profile?.risk_tolerance || undefined;
      analyzeRiskTolerance(approach, risk, result);

      const budget = allocation.allocatedBudget || 0;
      analyzeBudget(approach, budget, result);

      // Target income analysis
      const targetIncome = allocation.targetIncomeFromIdea || 0;
      if (targetIncome > 100000 && approach === "specialize") {
        result.score += 5;
        result.reasons.push("Niche expertise commands premium pricing");
      }
    }

    // Profile-based analysis
    if (profile) {
      let goals: string[] = [];
      try {
        goals = JSON.parse(profile.primary_goals || "[]");
      } catch {
        goals = [];
      }

      analyzeProfileGoals(approach, goals, result);
      analyzeDomainExpertise(approach, profile, result);
    }

    // Clamp score
    result.score = Math.max(0, Math.min(100, result.score));
    results.push(result);
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Get the top recommended approach
 */
export function getTopRecommendation(
  input: RecommendationInput,
): ApproachRecommendation | null {
  const recommendations = generateApproachRecommendations(input);
  return recommendations.length > 0 ? recommendations[0] : null;
}

/**
 * Check if an approach is recommended (score >= 60)
 */
export function isApproachRecommended(
  approach: StrategicApproach,
  input: RecommendationInput,
): boolean {
  const recommendations = generateApproachRecommendations(input);
  const rec = recommendations.find((r) => r.approach === approach);
  return rec ? rec.score >= 60 : false;
}

/**
 * Get approach metadata with recommendation context
 */
export function getApproachWithContext(
  approach: StrategicApproach,
  input: RecommendationInput,
): ApproachRecommendation & {
  meta: (typeof strategicApproachMeta)[StrategicApproach];
} {
  const recommendations = generateApproachRecommendations(input);
  const rec = recommendations.find((r) => r.approach === approach) || {
    approach,
    score: 50,
    reasons: [],
    concerns: [],
  };

  return {
    ...rec,
    meta: strategicApproachMeta[approach],
  };
}

export default {
  generateApproachRecommendations,
  getTopRecommendation,
  isApproachRecommended,
  getApproachWithContext,
};
