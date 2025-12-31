/**
 * Iteration System
 *
 * Manages iteration cycles when user chooses to iterate after evaluation.
 * Generates focused questions targeting only weak criteria.
 */

import { v4 as uuid } from 'uuid';
import { run, query, getOne } from '../database/db.js';
import { logInfo } from '../utils/logger.js';
import { createVersionSnapshot } from '../utils/versioning.js';
import {
  IterationLog,
  IterationContext,
  WeakCriterion,
  CRITERIA_TO_QUESTION_CATEGORIES
} from '../types/incubation.js';

/**
 * Initiate a new iteration for an idea
 */
export async function initiateIteration(
  ideaId: string,
  triggerCriteria: WeakCriterion[],
  previousScore: number,
  userDirection: string
): Promise<void> {
  // Get current idea
  const idea = await getOne<{
    id: string;
    slug: string;
    iteration_number: number;
  }>(
    'SELECT id, slug, iteration_number FROM ideas WHERE id = ?',
    [ideaId]
  );

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const fromIteration = idea.iteration_number;
  const toIteration = fromIteration + 1;

  // Extract trigger criteria codes
  const triggerCodes = triggerCriteria.map(c => c.code);

  // Create iteration log
  const iterationId = uuid();

  await run(
    `INSERT INTO iteration_logs
     (id, idea_id, from_iteration, to_iteration, trigger_criteria, user_direction, previous_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [iterationId, ideaId, fromIteration, toIteration, JSON.stringify(triggerCodes), userDirection, previousScore]
  );

  // Update idea
  await run(
    `UPDATE ideas
     SET iteration_number = ?, incubation_phase = 'iterate', updated_at = datetime('now')
     WHERE id = ?`,
    [toIteration, ideaId]
  );

  // Create version snapshot marking iteration start
  await createVersionSnapshot(ideaId, 'iteration', `Iteration ${toIteration} started - focus: ${userDirection}`);

  logInfo(`Started iteration ${toIteration} for ${idea.slug} - focusing on: ${userDirection}`);
}

/**
 * Get iteration context for current iteration
 */
export async function getIterationContext(ideaId: string): Promise<IterationContext | null> {
  const row = await getOne<{
    to_iteration: number;
    trigger_criteria: string;
    user_direction: string;
    previous_score: number;
  }>(
    `SELECT to_iteration, trigger_criteria, user_direction, previous_score
     FROM iteration_logs WHERE idea_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [ideaId]
  );

  if (!row) return null;

  return {
    iterationNumber: row.to_iteration,
    previousScore: row.previous_score,
    triggerCriteria: JSON.parse(row.trigger_criteria),
    userDirection: row.user_direction
  };
}

/**
 * Get iteration history for an idea
 */
export async function getIterationHistory(ideaId: string): Promise<IterationLog[]> {
  const rows = await query<{
    id: string;
    idea_id: string;
    from_iteration: number;
    to_iteration: number;
    trigger_criteria: string;
    user_direction: string;
    previous_score: number;
    created_at: string;
  }>(
    'SELECT * FROM iteration_logs WHERE idea_id = ? ORDER BY created_at DESC',
    [ideaId]
  );

  return rows.map(row => ({
    id: row.id,
    ideaId: row.idea_id,
    fromIteration: row.from_iteration,
    toIteration: row.to_iteration,
    triggerCriteria: JSON.parse(row.trigger_criteria),
    userDirection: row.user_direction,
    previousScore: row.previous_score,
    createdAt: new Date(row.created_at)
  }));
}

/**
 * Get question categories relevant to weak criteria
 */
export function getRelevantQuestionCategories(triggerCriteria: string[]): string[] {
  const categories = new Set<string>();

  for (const criterion of triggerCriteria) {
    const relatedCategories = CRITERIA_TO_QUESTION_CATEGORIES[criterion] || [];
    for (const cat of relatedCategories) {
      categories.add(cat);
    }
  }

  return Array.from(categories);
}

/**
 * Check if an idea is in iteration mode
 */
export async function isInIteration(ideaId: string): Promise<boolean> {
  const idea = await getOne<{ iteration_number: number }>(
    'SELECT iteration_number FROM ideas WHERE id = ?',
    [ideaId]
  );

  return (idea?.iteration_number ?? 1) > 1;
}

/**
 * Get iteration number for an idea
 */
export async function getIterationNumber(ideaId: string): Promise<number> {
  const idea = await getOne<{ iteration_number: number }>(
    'SELECT iteration_number FROM ideas WHERE id = ?',
    [ideaId]
  );

  return idea?.iteration_number ?? 1;
}

/**
 * Complete current iteration (after re-evaluation)
 */
export async function completeIteration(
  ideaId: string,
  newScore: number
): Promise<{
  improvement: number;
  previousScore: number;
  newScore: number;
}> {
  // Get iteration context
  const context = await getIterationContext(ideaId);
  if (!context) {
    throw new Error('No active iteration found');
  }

  const improvement = newScore - context.previousScore;

  // Update phase back to evaluate
  await run(
    `UPDATE ideas SET incubation_phase = 'evaluate', updated_at = datetime('now') WHERE id = ?`,
    [ideaId]
  );

  logInfo(`Iteration ${context.iterationNumber} complete. Score: ${context.previousScore.toFixed(1)} → ${newScore.toFixed(1)} (${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)})`);

  return {
    improvement,
    previousScore: context.previousScore,
    newScore
  };
}

/**
 * Format iteration header for display
 */
export function formatIterationHeader(
  ideaSlug: string,
  iterationNumber: number,
  userDirection: string,
  triggerCriteria: string[]
): string {
  const border = '═'.repeat(60);

  return `
╔${border}╗
║  ITERATION ${iterationNumber} of ${ideaSlug.padEnd(42)}║
╠${border}╣
║                                                            ║
║  Focus: ${userDirection.substring(0, 50).padEnd(50)}║
║                                                            ║
║  Targeting weak criteria:                                  ║
${triggerCriteria.map(c => `║    • ${c.padEnd(54)}║`).join('\n')}
║                                                            ║
╚${border}╝
`;
}

/**
 * Format iteration history for display
 */
export function formatIterationHistory(history: IterationLog[]): string {
  if (history.length === 0) {
    return 'No iteration history.';
  }

  let output = '## Iteration History\n\n';

  for (const entry of history) {
    const date = entry.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    output += `### Iteration ${entry.toIteration} (${date})\n`;
    output += `- **Focus**: ${entry.userDirection}\n`;
    output += `- **Starting Score**: ${entry.previousScore.toFixed(1)}/10\n`;
    output += `- **Trigger Criteria**: ${entry.triggerCriteria.join(', ')}\n\n`;
  }

  return output;
}

/**
 * Get criteria details for display
 */
export function getCriteriaDetails(): Record<string, { name: string; category: string }> {
  return {
    'P1': { name: 'Problem Clarity', category: 'Problem' },
    'P2': { name: 'Problem Severity', category: 'Problem' },
    'P3': { name: 'Target User', category: 'Problem' },
    'P4': { name: 'Problem Validation', category: 'Problem' },
    'P5': { name: 'Problem Uniqueness', category: 'Problem' },
    'S1': { name: 'Solution Clarity', category: 'Solution' },
    'S2': { name: 'Solution Feasibility', category: 'Solution' },
    'S3': { name: 'Solution Uniqueness', category: 'Solution' },
    'S4': { name: 'Scalability', category: 'Solution' },
    'S5': { name: 'Defensibility', category: 'Solution' },
    'F1': { name: 'Technical Feasibility', category: 'Feasibility' },
    'F2': { name: 'Resource Requirements', category: 'Feasibility' },
    'F3': { name: 'Skills Match', category: 'Feasibility' },
    'F4': { name: 'Time to Value', category: 'Feasibility' },
    'F5': { name: 'Dependencies', category: 'Feasibility' },
    'FT1': { name: 'Personal Goals', category: 'Fit' },
    'FT2': { name: 'Passion', category: 'Fit' },
    'FT3': { name: 'Skills Fit', category: 'Fit' },
    'FT4': { name: 'Network Fit', category: 'Fit' },
    'FT5': { name: 'Life Stage Fit', category: 'Fit' },
    'M1': { name: 'Market Size', category: 'Market' },
    'M2': { name: 'Market Growth', category: 'Market' },
    'M3': { name: 'Competition', category: 'Market' },
    'M4': { name: 'Entry Barriers', category: 'Market' },
    'M5': { name: 'Market Timing', category: 'Market' },
    'R1': { name: 'Execution Risk', category: 'Risk' },
    'R2': { name: 'Market Risk', category: 'Risk' },
    'R3': { name: 'Technical Risk', category: 'Risk' },
    'R4': { name: 'Financial Risk', category: 'Risk' },
    'R5': { name: 'Regulatory Risk', category: 'Risk' }
  };
}
