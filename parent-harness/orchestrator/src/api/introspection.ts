/**
 * Introspection API - Agent-facing endpoint for querying past sessions
 *
 * Allows agents to review their own session history with relevance scoring,
 * enabling learning from past work and avoiding repeated mistakes.
 *
 * Endpoint: GET /api/introspection/:agentId
 */

import { Router } from "express";
import * as sessions from "../db/sessions.js";
import { createEvent } from "../db/events.js";
import { calculateRelevance } from "../introspection/relevance.js";
import type { AgentSession } from "../db/sessions.js";

export const introspectionRouter = Router();

/**
 * GET /api/introspection/:agentId
 *
 * Query relevant past sessions for an agent.
 *
 * Query params:
 *   taskSignature  - Hash for task similarity matching
 *   limit          - Max sessions to return (default: 10)
 *   minRelevance   - Minimum relevance threshold 0.0-1.0 (default: 0.3)
 *   includeIterations - Include iteration logs (default: false)
 *   includeFailures   - Include failed/terminated sessions (default: false)
 */
introspectionRouter.get("/:agentId", (req, res) => {
  const { agentId } = req.params;
  const {
    taskSignature,
    limit = "10",
    minRelevance = "0.3",
    includeIterations = "false",
    includeFailures = "false",
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit as string, 10) || 10, 100);
  const parsedMinRelevance = parseFloat(minRelevance as string) || 0.3;
  const wantIterations = includeIterations === "true";
  const wantFailures = includeFailures === "true";

  // Get all sessions for this agent (pre-filter to 100 for scoring efficiency)
  const allSessions = sessions.getSessions({
    agentId,
    limit: 100,
  });

  // Filter by status (exclude failures unless requested)
  let filtered: AgentSession[];
  if (wantFailures) {
    filtered = allSessions;
  } else {
    filtered = allSessions.filter(
      (s) =>
        s.status === "completed" ||
        s.status === "running" ||
        s.status === "paused",
    );
  }

  // Calculate relevance scores
  const scored = filtered.map((session) => {
    const relevance = calculateRelevance(session, {
      taskSignature: taskSignature as string | undefined,
      currentTime: Date.now(),
    });
    return { session, relevance };
  });

  // Filter by minimum relevance and sort descending
  const relevant = scored
    .filter((s) => s.relevance >= parsedMinRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, parsedLimit);

  // Format response
  const results = relevant.map(({ session, relevance }) => {
    const base: Record<string, unknown> = {
      session_id: session.id,
      task_id: session.task_id,
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at,
      total_iterations: session.total_iterations,
      relevance_score: Math.round(relevance * 1000) / 1000,
      summary: extractSummary(session),
    };

    if (wantIterations) {
      base.iterations = sessions.getSessionIterations(session.id);
    }

    return base;
  });

  // Log the introspection query for observability
  try {
    createEvent({
      type: "introspection:query",
      message: `Introspection query by ${agentId}: ${results.length} results (min relevance: ${parsedMinRelevance})`,
      agentId,
      severity: "info",
      metadata: {
        taskSignature: taskSignature || null,
        limit: parsedLimit,
        minRelevance: parsedMinRelevance,
        resultsCount: results.length,
        totalSessions: allSessions.length,
      },
    });
  } catch {
    // Don't fail the request if event logging fails
  }

  res.json({
    agent_id: agentId,
    query: {
      taskSignature: taskSignature || null,
      limit: parsedLimit,
      minRelevance: parsedMinRelevance,
      includeIterations: wantIterations,
      includeFailures: wantFailures,
    },
    count: results.length,
    sessions: results,
  });
});

/**
 * GET /api/introspection/:agentId/summary
 *
 * Get a high-level performance summary for an agent.
 */
introspectionRouter.get("/:agentId/summary", (req, res) => {
  const { agentId } = req.params;

  const allSessions = sessions.getSessions({ agentId, limit: 200 });

  const completed = allSessions.filter((s) => s.status === "completed").length;
  const failed = allSessions.filter((s) => s.status === "failed").length;
  const terminated = allSessions.filter(
    (s) => s.status === "terminated",
  ).length;
  const total = allSessions.length;
  const successRate = total > 0 ? completed / total : 0;

  // Calculate average duration for completed sessions
  let totalDurationMs = 0;
  let durationCount = 0;
  for (const s of allSessions) {
    if (s.completed_at && s.started_at) {
      const duration =
        new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
      if (duration > 0) {
        totalDurationMs += duration;
        durationCount++;
      }
    }
  }
  const avgDurationMs =
    durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;

  res.json({
    agent_id: agentId,
    total_sessions: total,
    completed,
    failed,
    terminated,
    success_rate: Math.round(successRate * 1000) / 1000,
    avg_duration_ms: avgDurationMs,
  });
});

/**
 * Extract a concise summary from a session's output or metadata.
 */
function extractSummary(session: AgentSession): string {
  let output = session.output || "";

  // Try to extract from metadata if output is empty
  if (!output && session.metadata) {
    try {
      const meta = JSON.parse(session.metadata);
      output = meta.output || meta.result || "";
    } catch {
      // Invalid metadata JSON
    }
  }

  if (!output) return "";

  // Truncate to 200 chars
  if (output.length > 200) {
    return output.substring(0, 197) + "...";
  }
  return output;
}

export default introspectionRouter;
