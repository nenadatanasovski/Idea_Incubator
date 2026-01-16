/**
 * Broadcast events to WebSocket clients via the API server
 * Used by evaluation scripts running in separate processes
 */

import type { ApiRequestData, ApiResponseData } from "./cost-tracker.js";

const API_URL = process.env.API_URL || "http://localhost:3001";

export type BroadcastEventType =
  | "debate:started"
  | "debate:criterion:start" // Marks start of debate for a specific criterion
  | "debate:round:started"
  | "evaluator:initial" // Initial assessment (before debate)
  | "evaluator:speaking" // DEPRECATED: Use evaluator:initial or evaluator:defense
  | "evaluator:defense" // Defense against red team (during debate)
  | "redteam:challenge"
  | "arbiter:verdict"
  | "debate:round:complete"
  | "debate:criterion:complete" // Marks end of debate for a specific criterion
  | "debate:criterion:skipped" // Criterion debate skipped (budget/error)
  | "debate:complete"
  | "budget:status" // Budget update event
  | "api:call" // Individual API call log
  | "synthesis:started"
  | "synthesis:complete"
  | "error";

export interface BroadcastEventData {
  criterion?: string;
  category?: string;
  roundNumber?: number;
  persona?: string;
  content?: string;
  score?: number;
  adjustment?: number;
  verdict?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Emit a debate event to all connected WebSocket clients
 */
export async function broadcastEvent(
  type: BroadcastEventType,
  ideaSlug: string,
  runId: string,
  data: BroadcastEventData = {},
): Promise<void> {
  // Use AbortController for timeout (5 seconds max)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${API_URL}/api/internal/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ideaSlug, runId, data }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Failed to broadcast event: ${response.statusText}`);
    }
  } catch (error) {
    // Don't fail evaluation if broadcast fails - just log
    // AbortError means timeout, which is fine
    if ((error as Error).name !== "AbortError") {
      console.error("Failed to broadcast event:", error);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a broadcaster instance for a specific evaluation run
 */
export function createBroadcaster(ideaSlug: string, runId: string) {
  return {
    started: (message?: string) =>
      broadcastEvent("debate:started", ideaSlug, runId, { message }),

    // NEW: Mark start of debate for a specific criterion
    criterionStart: (
      criterion: string,
      category: string,
      originalScore: number,
      originalReasoning: string,
    ) =>
      broadcastEvent("debate:criterion:start", ideaSlug, runId, {
        criterion,
        category,
        score: originalScore,
        content: originalReasoning,
      }),

    roundStarted: (criterion: string, category: string, roundNumber: number) =>
      broadcastEvent("debate:round:started", ideaSlug, runId, {
        criterion,
        category,
        roundNumber,
      }),

    // NEW: Initial assessment (before debate)
    evaluatorInitial: (
      criterion: string,
      category: string,
      content: string,
      score: number,
    ) =>
      broadcastEvent("evaluator:initial", ideaSlug, runId, {
        criterion,
        category,
        content,
        score,
      }),

    // DEPRECATED: Use evaluatorInitial or evaluatorDefense instead
    evaluatorSpeaking: (
      criterion: string,
      category: string,
      content: string,
      score?: number,
    ) =>
      broadcastEvent("evaluator:speaking", ideaSlug, runId, {
        criterion,
        category,
        content,
        score,
      }),

    // NEW: Defense against red team (during debate)
    evaluatorDefense: (
      criterion: string,
      category: string,
      content: string,
      concedes: boolean,
      adjustedScore?: number,
    ) =>
      broadcastEvent("evaluator:defense", ideaSlug, runId, {
        criterion,
        category,
        content,
        score: adjustedScore,
        message: concedes
          ? "Evaluator concedes this point"
          : "Evaluator defends position",
      }),

    redteamChallenge: (
      criterion: string,
      category: string,
      persona: string,
      content: string,
      roundNumber?: number,
    ) =>
      broadcastEvent("redteam:challenge", ideaSlug, runId, {
        criterion,
        category,
        persona,
        content,
        roundNumber,
      }),

    arbiterVerdict: (
      criterion: string,
      category: string,
      verdict: string,
      adjustment: number,
      winner?: string,
    ) =>
      broadcastEvent("arbiter:verdict", ideaSlug, runId, {
        criterion,
        category,
        verdict,
        adjustment,
        message: winner,
      }),

    roundComplete: (criterion: string, category: string, score: number) =>
      broadcastEvent("debate:round:complete", ideaSlug, runId, {
        criterion,
        category,
        score,
      }),

    // NEW: Mark end of debate for a specific criterion
    criterionComplete: (
      criterion: string,
      category: string,
      originalScore: number,
      finalScore: number,
    ) =>
      broadcastEvent("debate:criterion:complete", ideaSlug, runId, {
        criterion,
        category,
        score: finalScore,
        adjustment: finalScore - originalScore,
        message: `${criterion}: ${originalScore} → ${finalScore}`,
      }),

    synthesisStarted: () =>
      broadcastEvent("synthesis:started", ideaSlug, runId, {}),

    synthesisComplete: (overallScore: number, recommendation: string) =>
      broadcastEvent("synthesis:complete", ideaSlug, runId, {
        score: overallScore,
        message: recommendation,
      }),

    complete: (overallScore: number) =>
      broadcastEvent("debate:complete", ideaSlug, runId, {
        score: overallScore,
        message: `Evaluation complete with score: ${overallScore.toFixed(1)}/10`,
      }),

    // Budget status update
    budgetStatus: (
      spent: number,
      remaining: number,
      total: number,
      apiCalls?: number,
    ) =>
      broadcastEvent("budget:status", ideaSlug, runId, {
        message: `Budget: $${spent.toFixed(2)} spent, $${remaining.toFixed(2)} remaining`,
        spent,
        remaining,
        total,
        apiCalls,
      }),

    // Individual API call log with full request/response data
    apiCall: (
      operation: string,
      inputTokens: number,
      outputTokens: number,
      cost: number,
      request?: ApiRequestData,
      response?: ApiResponseData,
    ) =>
      broadcastEvent("api:call", ideaSlug, runId, {
        message: operation,
        inputTokens,
        outputTokens,
        cost,
        request,
        response,
      }),

    // Criterion skipped (budget or error)
    criterionSkipped: (
      criterion: string,
      category: string,
      reason: string,
      originalScore: number,
    ) =>
      broadcastEvent("debate:criterion:skipped", ideaSlug, runId, {
        criterion,
        category,
        score: originalScore,
        message: reason,
      }),

    error: (error: string) =>
      broadcastEvent("error", ideaSlug, runId, { error }),
  };
}
