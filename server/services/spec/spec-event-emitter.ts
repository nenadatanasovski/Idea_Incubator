/**
 * Spec Event Emitter
 *
 * Emits observability events for spec generation and workflow transitions.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-010-B)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, saveDb } from "../../../database/db.js";

export type SpecEventType =
  | "spec:generate:start"
  | "spec:generate:complete"
  | "spec:generate:error"
  | "spec:workflow:transition"
  | "spec:section:update"
  | "spec:readiness:update"
  | "spec:tasklist:created";

export interface SpecEventData {
  sessionId?: string;
  specId?: string;
  userId?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Emit a spec observability event
 */
export async function emitSpecEvent(
  eventType: SpecEventType,
  data: SpecEventData = {},
): Promise<void> {
  const { sessionId, specId, userId, durationMs, metadata } = data;

  const id = `spe_${uuidv4()}`;
  const now = new Date().toISOString();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {
    await run(
      `INSERT INTO observability_event_log
       (id, timestamp, event_type, session_id, spec_id, user_id, duration_ms, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        now,
        eventType,
        sessionId || null,
        specId || null,
        userId || null,
        durationMs || null,
        metadataJson,
        now,
      ],
    );
    await saveDb();
  } catch (err) {
    console.error("[SpecEventEmitter] Failed to emit event:", err);
  }
}

/**
 * Emit spec generation start event
 */
export async function emitSpecGenerationStart(
  sessionId: string,
  userId?: string,
): Promise<void> {
  await emitSpecEvent("spec:generate:start", {
    sessionId,
    userId,
    metadata: { phase: "start" },
  });
}

/**
 * Emit spec generation complete event
 */
export async function emitSpecGenerationComplete(
  sessionId: string,
  specId: string,
  durationMs: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await emitSpecEvent("spec:generate:complete", {
    sessionId,
    specId,
    durationMs,
    metadata: {
      phase: "complete",
      ...metadata,
    },
  });
}

/**
 * Emit spec generation error event
 */
export async function emitSpecGenerationError(
  sessionId: string,
  error: string,
): Promise<void> {
  await emitSpecEvent("spec:generate:error", {
    sessionId,
    metadata: { error, phase: "error" },
  });
}

/**
 * Emit workflow transition event
 */
export async function emitWorkflowTransition(
  specId: string,
  fromState: string,
  toState: string,
  userId?: string,
): Promise<void> {
  await emitSpecEvent("spec:workflow:transition", {
    specId,
    userId,
    metadata: {
      fromState,
      toState,
      transitionAt: new Date().toISOString(),
    },
  });
}

/**
 * Emit task list creation event
 */
export async function emitTaskListCreated(
  specId: string,
  taskListId: string,
  taskCount: number,
): Promise<void> {
  await emitSpecEvent("spec:tasklist:created", {
    specId,
    metadata: {
      taskListId,
      taskCount,
    },
  });
}

interface EventCountRow {
  event_type: string;
  count: number;
}

/**
 * Get spec event counts by type
 */
export async function getSpecEventStats(): Promise<Record<string, number>> {
  try {
    const rows = await query<EventCountRow>(
      `SELECT event_type, COUNT(*) as count
       FROM observability_event_log
       WHERE event_type LIKE 'spec:%'
       GROUP BY event_type`,
      [],
    );

    const stats: Record<string, number> = {};
    for (const row of rows || []) {
      stats[row.event_type] = row.count;
    }
    return stats;
  } catch (err) {
    console.error("[SpecEventEmitter] Failed to get event stats:", err);
    return {};
  }
}

export default {
  emitSpecEvent,
  emitSpecGenerationStart,
  emitSpecGenerationComplete,
  emitSpecGenerationError,
  emitWorkflowTransition,
  emitTaskListCreated,
  getSpecEventStats,
};
