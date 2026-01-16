/**
 * Soft Gates Agent
 *
 * Displays advisory information at key checkpoints and logs user decisions.
 * Provides viability and evaluation advisories.
 */

import chalk from "chalk";
import { v4 as uuid } from "uuid";
import { run, query } from "../database/db.js";
import { logInfo } from "../utils/logger.js";
import {
  ViabilityAdvisory,
  ViabilityRecommendation,
  EvaluationAdvisory,
  EvaluationRecommendation,
  WeakCriterion,
  GateType,
  GateDecision,
} from "../types/incubation.js";

// ============================================================================
// Viability Advisory
// ============================================================================

/**
 * Format viability advisory for display
 */
export function formatViabilityAdvisory(advisory: ViabilityAdvisory): string {
  const {
    criticalGaps,
    significantGaps,
    readinessScore,
    recommendation,
    reasoning,
  } = advisory;

  const width = 64;
  const border = "═".repeat(width - 2);
  const line = (text: string) => `║ ${text.padEnd(width - 4)} ║`;
  const empty = line("");

  // Color based on recommendation
  const recColor =
    recommendation === "proceed"
      ? chalk.green
      : recommendation === "pause"
        ? chalk.red
        : chalk.yellow;

  let output = `
╔${border}╗
${line(chalk.bold.white("VIABILITY ADVISORY"))}
╠${border}╣
${empty}`;

  // Critical gaps
  if (criticalGaps.length > 0) {
    output += `${line(chalk.red(`Critical gaps remaining: ${criticalGaps.length}`))}`;
    for (const gap of criticalGaps.slice(0, 3)) {
      const gapText =
        gap.text.length > 50 ? gap.text.substring(0, 47) + "..." : gap.text;
      output += `\n${line(`  • ${gapText}`)}`;
    }
    if (criticalGaps.length > 3) {
      output += `\n${line(`  ... and ${criticalGaps.length - 3} more`)}`;
    }
  } else {
    output += `${line(chalk.green("No critical gaps remaining"))}`;
  }

  output += `\n${empty}`;

  // Significant gaps
  if (significantGaps.length > 0) {
    output += `\n${line(chalk.yellow(`Significant gaps: ${significantGaps.length}`))}`;
  }

  output += `
${empty}
${line(`Readiness Score: ${formatReadinessBar(readinessScore)}`)}
${empty}
${line(recColor(`Recommendation: ${recommendation.toUpperCase()}`))}
${empty}`;

  // Reasoning
  const reasoningLines = wrapText(reasoning, width - 6);
  for (const rLine of reasoningLines) {
    output += `\n${line(rLine)}`;
  }

  output += `
${empty}
${line(chalk.dim("Options:"))}
${line("  [1] Continue to differentiation analysis")}
${line("  [2] Address critical gaps first")}
${line("  [3] Pause idea for now")}
${empty}
╚${border}╝`;

  return output;
}

/**
 * Format readiness bar
 */
function formatReadinessBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  const color =
    score >= 70 ? chalk.green : score >= 40 ? chalk.yellow : chalk.red;
  return (
    color("█".repeat(filled)) + chalk.gray("░".repeat(empty)) + ` ${score}%`
  );
}

/**
 * Wrap text to fit within a certain width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxWidth) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// ============================================================================
// Evaluation Advisory
// ============================================================================

/**
 * Generate evaluation advisory from evaluation results
 */
export function generateEvaluationAdvisory(
  overallScore: number,
  confidence: number,
  criteriaScores: Array<{
    code: string;
    name: string;
    score: number;
    confidence: number;
  }>,
): EvaluationAdvisory {
  // Identify weak criteria (score < 6 OR confidence < 0.6)
  const weakCriteria: WeakCriterion[] = criteriaScores
    .filter((c) => c.score < 6 || c.confidence < 0.6)
    .map((c) => ({
      code: c.code,
      name: c.name,
      score: c.score,
      confidence: c.confidence,
      addressable: isAddressable(c.code),
      suggestedAction: getSuggestedAction(c.code),
    }))
    .sort((a, b) => a.score - b.score);

  // Determine recommendation
  let recommendation: EvaluationRecommendation;
  let reasoning: string;

  const hasAddressableWeaknesses = weakCriteria.some((c) => c.addressable);

  if (overallScore >= 7.5) {
    recommendation = "pursue";
    reasoning = `Strong overall score of ${overallScore.toFixed(1)}/10. This idea shows good potential across key criteria. Ready to move forward with development.`;
  } else if (overallScore >= 5.0 && hasAddressableWeaknesses) {
    recommendation = "iterate";
    reasoning = `Score of ${overallScore.toFixed(1)}/10 with ${weakCriteria.length} weak areas that can be improved. Iteration recommended to address: ${weakCriteria
      .slice(0, 3)
      .map((c) => c.name)
      .join(", ")}.`;
  } else if (overallScore >= 5.0 && !hasAddressableWeaknesses) {
    recommendation = "branch";
    reasoning = `Score of ${overallScore.toFixed(1)}/10 but weak areas may require fundamental changes. Consider branching to explore a different approach.`;
  } else if (overallScore >= 3.0) {
    recommendation = "pause";
    reasoning = `Score of ${overallScore.toFixed(1)}/10 indicates significant gaps. Consider pausing to gather more information or revisit the core concept.`;
  } else {
    recommendation = "abandon";
    reasoning = `Score of ${overallScore.toFixed(1)}/10 suggests fundamental issues. The idea may not be viable in its current form.`;
  }

  return {
    overallScore,
    confidence,
    weakCriteria,
    recommendation,
    reasoning,
  };
}

/**
 * Check if a criterion is addressable through iteration
 */
function isAddressable(criterionCode: string): boolean {
  // Most criteria are addressable except some market/external ones
  const hardToAddress = ["M1", "M2", "M5", "R5"]; // Market size, growth, timing, regulatory
  return !hardToAddress.includes(criterionCode);
}

/**
 * Get suggested action for a weak criterion
 */
function getSuggestedAction(criterionCode: string): string {
  const actions: Record<string, string> = {
    P1: "Clarify the problem statement with specific examples",
    P2: "Quantify the problem severity with data",
    P3: "Define target user persona more precisely",
    P4: "Conduct user interviews for validation",
    P5: "Research existing solutions and differentiation",
    S1: "Detail the solution mechanism step by step",
    S2: "Create a technical feasibility analysis",
    S3: "Identify unique value propositions",
    S4: "Map out scaling strategy",
    S5: "Identify defensible moats",
    F1: "Break down technical implementation",
    F2: "Create detailed resource budget",
    F3: "Identify skill gaps and solutions",
    F4: "Create milestone timeline",
    F5: "Map critical dependencies",
    FT1: "Reflect on personal alignment",
    FT2: "Consider passion sustainability",
    FT3: "Assess skill fit honestly",
    FT4: "Map network relevance",
    FT5: "Evaluate life stage fit",
    M1: "Conduct market size research",
    M2: "Analyze market trends",
    M3: "Complete competitive analysis",
    M4: "Assess entry barriers",
    M5: "Evaluate market timing",
    R1: "Create execution risk mitigation plan",
    R2: "Validate market demand",
    R3: "Address technical unknowns",
    R4: "Develop financial contingencies",
    R5: "Research regulatory requirements",
  };

  return (
    actions[criterionCode] || "Address this criterion with focused research"
  );
}

/**
 * Format evaluation advisory for display
 */
export function formatEvaluationAdvisory(advisory: EvaluationAdvisory): string {
  const { overallScore, confidence, weakCriteria, recommendation, reasoning } =
    advisory;

  const width = 64;
  const border = "═".repeat(width - 2);
  const line = (text: string) => `║ ${text.padEnd(width - 4)} ║`;
  const empty = line("");

  // Color based on recommendation
  const recColor =
    recommendation === "pursue"
      ? chalk.green
      : recommendation === "iterate"
        ? chalk.blue
        : recommendation === "branch"
          ? chalk.cyan
          : recommendation === "pause"
            ? chalk.yellow
            : chalk.red;

  let output = `
╔${border}╗
${line(chalk.bold.white("EVALUATION COMPLETE"))}
╠${border}╣
${empty}
${line(`Overall Score: ${formatScoreBar(overallScore)} ${overallScore.toFixed(1)}/10`)}
${line(`Confidence: ${Math.round(confidence * 100)}%`)}
${empty}`;

  // Weak criteria
  if (weakCriteria.length > 0) {
    output += `\n${line(chalk.yellow("Key Weaknesses:"))}`;
    for (const criterion of weakCriteria.slice(0, 4)) {
      const scoreText = `${criterion.score.toFixed(0)}/10`;
      output += `\n${line(`  • ${criterion.name} (${criterion.code}): ${scoreText}`)}`;
      const actionText =
        criterion.suggestedAction.length > 40
          ? criterion.suggestedAction.substring(0, 37) + "..."
          : criterion.suggestedAction;
      output += `\n${line(chalk.dim(`    → ${actionText}`))}`;
    }
    if (weakCriteria.length > 4) {
      output += `\n${line(`  ... and ${weakCriteria.length - 4} more`)}`;
    }
  }

  output += `
${empty}
${line(recColor(`Recommendation: ${recommendation.toUpperCase()}`))}
${empty}`;

  // Reasoning
  const reasoningLines = wrapText(reasoning, width - 6);
  for (const rLine of reasoningLines) {
    output += `\n${line(rLine)}`;
  }

  output += `
${empty}
${line(chalk.dim("What would you like to do?"))}
${line("  [1] Pursue - Move forward with this idea")}
${line("  [2] Iterate - Address weaknesses and re-evaluate")}
${line("  [3] Branch - Create a variant with different approach")}
${line("  [4] Pause - Set aside for now")}
${line("  [5] Abandon - This idea isn't viable")}
${empty}
╚${border}╝`;

  return output;
}

/**
 * Format score bar
 */
function formatScoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 10 - filled;
  const color =
    score >= 7 ? chalk.green : score >= 5 ? chalk.yellow : chalk.red;
  return color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

// ============================================================================
// Gate Decision Logging
// ============================================================================

/**
 * Log a gate decision to the database
 */
export async function logGateDecision(
  ideaId: string,
  gateType: GateType,
  recommendation: string,
  userChoice: string,
  context: Record<string, unknown>,
): Promise<void> {
  const id = uuid();

  await run(
    `INSERT INTO gate_decisions (id, idea_id, gate_type, recommendation, user_choice, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, ideaId, gateType, recommendation, userChoice, JSON.stringify(context)],
  );

  logInfo(
    `Gate decision logged: ${gateType} - ${recommendation} → ${userChoice}`,
  );
}

/**
 * Get gate decisions for an idea
 */
export async function getGateDecisions(
  ideaId: string,
): Promise<GateDecision[]> {
  const rows = await query<{
    id: string;
    idea_id: string;
    gate_type: string;
    recommendation: string;
    user_choice: string;
    context: string;
    created_at: string;
  }>(
    "SELECT * FROM gate_decisions WHERE idea_id = ? ORDER BY created_at DESC",
    [ideaId],
  );

  return rows.map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    gateType: row.gate_type as GateType,
    recommendation: row.recommendation,
    userChoice: row.user_choice,
    context: JSON.parse(row.context || "{}"),
    createdAt: new Date(row.created_at),
  }));
}

// ============================================================================
// Choice Mapping
// ============================================================================

/**
 * Map viability choice number to recommendation
 */
export function mapViabilityChoice(
  choice: number,
): ViabilityRecommendation | null {
  const map: Record<number, ViabilityRecommendation> = {
    1: "proceed",
    2: "research_more",
    3: "pause",
  };
  return map[choice] || null;
}

/**
 * Map evaluation choice number to recommendation
 */
export function mapEvaluationChoice(
  choice: number,
): EvaluationRecommendation | null {
  const map: Record<number, EvaluationRecommendation> = {
    1: "pursue",
    2: "iterate",
    3: "branch",
    4: "pause",
    5: "abandon",
  };
  return map[choice] || null;
}
