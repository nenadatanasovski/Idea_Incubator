import { IdeationMessage } from '../../types/ideation.js';

/**
 * TOKEN COUNTING & HANDOFF
 *
 * Context limit: 100,000 tokens
 * Handoff trigger: 80,000 tokens (80%)
 */

export const CONTEXT_LIMIT = 100_000;
export const HANDOFF_THRESHOLD = 80_000;
export const SYSTEM_PROMPT_ESTIMATE = 5_000;
export const PROFILE_ESTIMATE = 2_000;
export const MEMORY_FILES_ESTIMATE = 10_000;

export interface TokenUsage {
  systemPrompt: number;
  profile: number;
  memoryFiles: number;
  conversation: number;
  currentMessage: number;
  total: number;
  percentUsed: number;
  shouldHandoff: boolean;
}

/**
 * Estimate token count from text.
 * Simple estimation: ~4 characters per token for English text.
 * This is a rough approximation; actual tokenization varies by model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total token usage for a session.
 */
export function calculateTokenUsage(
  conversationHistory: IdeationMessage[],
  currentMessage: string
): TokenUsage {
  const conversationTokens = conversationHistory.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const currentMessageTokens = estimateTokens(currentMessage);

  const total =
    SYSTEM_PROMPT_ESTIMATE +
    PROFILE_ESTIMATE +
    MEMORY_FILES_ESTIMATE +
    conversationTokens +
    currentMessageTokens;

  return {
    systemPrompt: SYSTEM_PROMPT_ESTIMATE,
    profile: PROFILE_ESTIMATE,
    memoryFiles: MEMORY_FILES_ESTIMATE,
    conversation: conversationTokens,
    currentMessage: currentMessageTokens,
    total,
    percentUsed: (total / CONTEXT_LIMIT) * 100,
    shouldHandoff: total >= HANDOFF_THRESHOLD,
  };
}

/**
 * Get remaining tokens available in context.
 */
export function getRemainingTokens(usage: TokenUsage): number {
  return Math.max(0, CONTEXT_LIMIT - usage.total);
}

/**
 * Check if we should trigger a handoff soon (within 5% of threshold).
 */
export function isApproachingHandoff(usage: TokenUsage): boolean {
  const threshold = HANDOFF_THRESHOLD * 0.95; // 95% of handoff threshold
  return usage.total >= threshold && !usage.shouldHandoff;
}
