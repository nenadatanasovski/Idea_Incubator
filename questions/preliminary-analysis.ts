/**
 * Preliminary Analysis System
 *
 * Generates lightweight Red Team challenges and synthesis insights
 * based on idea content and development answers without requiring
 * a full expensive AI evaluation.
 *
 * First Principles Reasoning:
 * 1. Red Team challenges identify risks, assumptions, and weaknesses
 * 2. Synthesis summarizes strengths, weaknesses, and provides recommendations
 * 3. We can generate preliminary insights from:
 *    - Idea description and content
 *    - Development answers
 *    - Coverage gaps (unanswered critical questions)
 *    - Known patterns for idea categories
 */

import { getOne } from "../database/db.js";
import {
  getAnswersForIdea,
  calculateReadiness,
  calculateCriterionCoverage,
} from "./readiness";

// Types for preliminary analysis
export interface PreliminaryChallenge {
  id: string;
  persona: "skeptic" | "realist" | "first_principles";
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  criterion: string;
  challenge: string;
  source: "coverage_gap" | "answer_analysis" | "idea_pattern";
  addressed: boolean;
  resolution?: string;
}

export interface PreliminarySynthesis {
  recommendation: "PURSUE" | "REFINE" | "PAUSE" | "ABANDON";
  overall_score: number;
  confidence: number;
  executive_summary: string;
  key_strengths: string[];
  key_weaknesses: string[];
  critical_assumptions: string[];
  unresolved_questions: string[];
  recommendation_reasoning: string;
  is_preliminary: boolean;
}

interface IdeaData {
  id: string;
  title: string;
  summary: string | null;
  idea_type: string;
  lifecycle_stage: string;
  [key: string]: unknown;
}

// Challenge templates based on coverage gaps
const coverageGapChallenges: Record<
  string,
  (ideaTitle: string) => PreliminaryChallenge[]
> = {
  problem: (title) => [
    {
      id: `prelim-skeptic-problem-1`,
      persona: "skeptic",
      severity: "high",
      category: "problem",
      criterion: "P1",
      challenge: `Has "${title}" validated that the problem actually exists at the scale claimed? What evidence beyond assumptions supports this?`,
      source: "coverage_gap",
      addressed: false,
    },
    {
      id: `prelim-realist-problem-1`,
      persona: "realist",
      severity: "medium",
      category: "problem",
      criterion: "P2",
      challenge: `How severe is this problem really? Are users actively seeking solutions, or is this a "nice to have" rather than a must-have?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  solution: (title) => [
    {
      id: `prelim-first_principles-solution-1`,
      persona: "first_principles",
      severity: "high",
      category: "solution",
      criterion: "S1",
      challenge: `Why is a new solution needed? What fundamental constraint or technology change makes this the right time for "${title}"?`,
      source: "coverage_gap",
      addressed: false,
    },
    {
      id: `prelim-skeptic-solution-1`,
      persona: "skeptic",
      severity: "medium",
      category: "solution",
      criterion: "S3",
      challenge: `What makes this solution defensible? If it works, what prevents well-resourced competitors from copying it?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  feasibility: (title) => [
    {
      id: `prelim-realist-feasibility-1`,
      persona: "realist",
      severity: "critical",
      category: "feasibility",
      criterion: "F1",
      challenge: `What is the minimum viable version of "${title}" that could be built in 2-4 weeks to test core assumptions?`,
      source: "coverage_gap",
      addressed: false,
    },
    {
      id: `prelim-first_principles-feasibility-1`,
      persona: "first_principles",
      severity: "high",
      category: "feasibility",
      criterion: "F3",
      challenge: `What skills are genuinely required vs. assumed? Can this be built with existing capabilities or does it require hiring/learning?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  market: (title) => [
    {
      id: `prelim-skeptic-market-1`,
      persona: "skeptic",
      severity: "high",
      category: "market",
      criterion: "M3",
      challenge: `Who are the existing competitors or substitutes? Why haven't they already won this market?`,
      source: "coverage_gap",
      addressed: false,
    },
    {
      id: `prelim-realist-market-1`,
      persona: "realist",
      severity: "medium",
      category: "market",
      criterion: "M5",
      challenge: `Is the timing right? What macro trends support or threaten the success of "${title}" in the next 2-3 years?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  risk: (_title) => [
    {
      id: `prelim-first_principles-risk-1`,
      persona: "first_principles",
      severity: "critical",
      category: "risk",
      criterion: "R1",
      challenge: `What is the single biggest execution risk? If this fails, what is the most likely cause?`,
      source: "coverage_gap",
      addressed: false,
    },
    {
      id: `prelim-skeptic-risk-1`,
      persona: "skeptic",
      severity: "high",
      category: "risk",
      criterion: "R3",
      challenge: `What technical risks are being underestimated? Are there hard problems disguised as easy ones?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  fit: (title) => [
    {
      id: `prelim-realist-fit-1`,
      persona: "realist",
      severity: "medium",
      category: "fit",
      criterion: "FT1",
      challenge: `Does building "${title}" align with personal goals? What does success look like and is that actually desirable?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
  business_model: (_title) => [
    {
      id: `prelim-skeptic-bm-1`,
      persona: "skeptic",
      severity: "high",
      category: "business_model",
      criterion: "B1",
      challenge: `What is the realistic revenue potential? Are customers actually willing to pay, and how much?`,
      source: "coverage_gap",
      addressed: false,
    },
  ],
};

// Generate score and recommendation based on readiness
function generateRecommendation(readinessPercent: number): {
  recommendation: PreliminarySynthesis["recommendation"];
  reasoning: string;
} {
  if (readinessPercent >= 80) {
    return {
      recommendation: "PURSUE",
      reasoning:
        "The idea has strong coverage across evaluation criteria. Core assumptions have been documented and the foundation is solid for moving to validation.",
    };
  } else if (readinessPercent >= 50) {
    return {
      recommendation: "REFINE",
      reasoning:
        "The idea shows promise but has gaps in critical areas. More development work is needed to address unanswered questions before committing significant resources.",
    };
  } else if (readinessPercent >= 25) {
    return {
      recommendation: "PAUSE",
      reasoning:
        "The idea is still too early-stage for meaningful evaluation. Significant work is needed to clarify the problem, solution, and market assumptions.",
    };
  } else {
    return {
      recommendation: "ABANDON",
      reasoning:
        "The idea lacks sufficient development to evaluate. Consider whether this is worth pursuing or if there are fundamental issues to address first.",
    };
  }
}

/**
 * Generate preliminary Red Team challenges based on coverage gaps
 */
export async function generatePreliminaryChallenges(
  ideaId: string,
): Promise<PreliminaryChallenge[]> {
  const idea = await getOne<IdeaData>(
    `
    SELECT id, title, summary, idea_type, lifecycle_stage
    FROM ideas WHERE id = ?
  `,
    [ideaId],
  );

  if (!idea) return [];

  // Get coverage data
  const coverage = await calculateCriterionCoverage(ideaId);
  const categoryCoverage = coverage.reduce(
    (acc, c) => {
      if (!acc[c.category]) {
        acc[c.category] = { answered: 0, total: 0 };
      }
      acc[c.category].answered += c.answered;
      acc[c.category].total += c.total;
      return acc;
    },
    {} as Record<string, { answered: number; total: number }>,
  );

  const challenges: PreliminaryChallenge[] = [];

  // Generate challenges for categories with low coverage
  for (const [category, data] of Object.entries(categoryCoverage)) {
    const coveragePercent =
      data.total > 0 ? (data.answered / data.total) * 100 : 0;

    // Add challenges for categories with less than 50% coverage
    if (coveragePercent < 50 && coverageGapChallenges[category]) {
      const categoryChalls = coverageGapChallenges[category](idea.title);
      challenges.push(...categoryChalls);
    }
  }

  // Add general challenges based on lifecycle stage
  if (idea.lifecycle_stage === "spark" || idea.lifecycle_stage === "clarify") {
    challenges.push({
      id: "prelim-first_principles-early-1",
      persona: "first_principles",
      severity: "high",
      category: "problem",
      criterion: "P4",
      challenge:
        "At this early stage, validation is critical. What is the cheapest, fastest experiment to test the core assumption?",
      source: "idea_pattern",
      addressed: false,
    });
  }

  return challenges;
}

/**
 * Generate preliminary synthesis based on idea content and answers
 */
export async function generatePreliminarySynthesis(
  ideaId: string,
): Promise<PreliminarySynthesis | null> {
  const idea = await getOne<IdeaData>(
    `
    SELECT id, title, summary, idea_type, lifecycle_stage
    FROM ideas WHERE id = ?
  `,
    [ideaId],
  );

  if (!idea) return null;

  // Get readiness data
  const readiness = await calculateReadiness(ideaId);
  const answers = await getAnswersForIdea(ideaId);
  const coverage = await calculateCriterionCoverage(ideaId);

  // Calculate category coverage
  const categoryCoverage = coverage.reduce(
    (acc, c) => {
      if (!acc[c.category]) {
        acc[c.category] = { answered: 0, total: 0 };
      }
      acc[c.category].answered += c.answered;
      acc[c.category].total += c.total;
      return acc;
    },
    {} as Record<string, { answered: number; total: number }>,
  );

  // Identify strengths (categories with good coverage)
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [category, data] of Object.entries(categoryCoverage)) {
    const percent = data.total > 0 ? (data.answered / data.total) * 100 : 0;
    const categoryName = category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (percent >= 70) {
      strengths.push(
        `${categoryName} is well-documented with ${Math.round(percent)}% of questions answered`,
      );
    } else if (percent < 30) {
      weaknesses.push(
        `${categoryName} needs more development - only ${Math.round(percent)}% of questions answered`,
      );
    }
  }

  // Add summary-based insights if available
  if (idea.summary && idea.summary.length > 100) {
    strengths.push("Idea has a clear summary which aids evaluation");
  } else if (!idea.summary || idea.summary.length < 30) {
    weaknesses.push("Limited idea summary makes thorough evaluation difficult");
  }

  // Handle NaN readiness (use 'overall' property from ReadinessScore)
  const readinessPercent = isNaN(readiness.overall) ? 0 : readiness.overall;

  // Generate recommendation
  const { recommendation, reasoning } =
    generateRecommendation(readinessPercent);

  // Identify critical assumptions
  const assumptions: string[] = [
    "Users will adopt this solution over existing alternatives",
    "The technical approach is feasible within resource constraints",
    "Market conditions will remain favorable",
  ];

  // Low-coverage categories become critical assumptions
  for (const [category, data] of Object.entries(categoryCoverage)) {
    const percent = data.total > 0 ? (data.answered / data.total) * 100 : 0;
    if (percent < 20) {
      assumptions.push(
        `${category.replace(/_/g, " ")} aspects are assumed but unvalidated`,
      );
    }
  }

  // Generate unresolved questions from blocking gaps
  const unresolvedQuestions = (readiness.blockingGaps || []).slice(0, 5);

  // Calculate preliminary score (based on readiness)
  const preliminaryScore = Math.min(10, Math.max(1, readinessPercent / 10));
  const confidenceScore = Math.min(0.4, readinessPercent / 200);

  return {
    recommendation,
    overall_score: preliminaryScore,
    confidence: confidenceScore,
    executive_summary: `"${idea.title}" is at the ${idea.lifecycle_stage.toUpperCase()} stage with ${Math.round(readinessPercent)}% evaluation readiness. ${answers.length} development questions have been answered. ${recommendation === "PURSUE" ? "The idea shows promise and is ready for deeper evaluation." : recommendation === "REFINE" ? "More development work is recommended before full evaluation." : "The idea needs significant clarification before evaluation."}`,
    key_strengths:
      strengths.length > 0
        ? strengths
        : ["Idea has been captured and is being developed"],
    key_weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : ["Full evaluation has not been completed"],
    critical_assumptions: assumptions,
    unresolved_questions:
      unresolvedQuestions.length > 0
        ? unresolvedQuestions
        : [
            "What problem does this solve?",
            "Who is the target user?",
            "How will this be built?",
          ],
    recommendation_reasoning: reasoning,
    is_preliminary: true,
  };
}

/**
 * Check if an idea has full evaluation data or only preliminary
 */
export async function hasFullEvaluation(ideaId: string): Promise<boolean> {
  const result = await getOne<{ count: number }>(
    `
    SELECT COUNT(*) as count FROM evaluations WHERE idea_id = ?
  `,
    [ideaId],
  );

  return (result?.count || 0) > 0;
}
