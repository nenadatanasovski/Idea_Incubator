/**
 * Introspection Relevance Scoring
 *
 * Calculates relevance scores for agent sessions based on:
 * 1. Task signature match (0.5 weight) - hash-based similarity
 * 2. Recency (0.3 weight) - recent sessions score higher
 * 3. Success rate (0.2 weight) - completed sessions score higher
 */

import crypto from 'crypto';
import type { AgentSession } from '../db/sessions.js';

export interface TaskSignature {
  hash: string;
  title: string;
  category?: string;
  filePatterns?: string[];
}

/**
 * Generate a deterministic task signature hash from task characteristics.
 * Used for matching similar tasks across sessions.
 */
export function generateTaskSignature(task: {
  title: string;
  category?: string;
  filePatterns?: string[];
}): TaskSignature {
  const titleNorm = task.title.toLowerCase().trim();
  const category = task.category || 'general';
  const patterns = (task.filePatterns || []).sort().join(',');

  const hashInput = `${titleNorm}|${category}|${patterns}`;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  return { hash, title: titleNorm, category, filePatterns: task.filePatterns };
}

/**
 * Calculate relevance score (0.0-1.0) for a session relative to current context.
 *
 * Scoring weights:
 * - Task signature match: 0.5 (exact) or 0.3 (partial prefix match)
 * - Recency: 0.3 * e^(-0.1 * ageDays) exponential decay
 * - Success: 0.2 (completed), 0.1 (running/paused), 0.0 (failed)
 */
export function calculateRelevance(
  session: AgentSession,
  context: {
    taskSignature?: string;
    currentTime: number;
  }
): number {
  let score = 0.0;

  // 1. Task signature match (0.5 weight)
  if (context.taskSignature && session.metadata) {
    try {
      const metadata = JSON.parse(session.metadata);
      const sessionSignature = metadata.task_signature;

      if (sessionSignature === context.taskSignature) {
        score += 0.5; // Exact match
      } else if (sessionSignature && taskSignaturesSimilar(sessionSignature, context.taskSignature)) {
        score += 0.3; // Partial match (first 8 chars)
      }
    } catch {
      // Invalid metadata JSON - skip signature scoring
    }
  }

  // 2. Recency (0.3 weight) - exponential decay over days
  const sessionTime = new Date(session.started_at).getTime();
  const ageMs = context.currentTime - sessionTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyScore = 0.3 * Math.exp(-0.1 * ageDays);
  score += recencyScore;

  // 3. Success rate (0.2 weight)
  if (session.status === 'completed') {
    score += 0.2;
  } else if (session.status === 'running' || session.status === 'paused') {
    score += 0.1;
  }
  // failed/terminated get 0.0

  // Normalize to 0.0-1.0
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Check if two task signatures share a common prefix (first 8 hex chars).
 * This indicates related but not identical tasks.
 */
function taskSignaturesSimilar(sig1: string, sig2: string): boolean {
  return sig1.length >= 8 && sig2.length >= 8 && sig1.substring(0, 8) === sig2.substring(0, 8);
}

export default {
  generateTaskSignature,
  calculateRelevance,
};
