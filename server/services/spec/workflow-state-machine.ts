/**
 * Workflow State Machine for Spec Lifecycle
 *
 * Manages spec workflow transitions: draft → review → approved → archived
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-007-A)
 */

import { query, run, getOne, saveDb } from "../../../database/db.js";
import { broadcastToSession } from "../../websocket.js";
import { emitWorkflowTransition } from "./spec-event-emitter.js";
import type {
  SpecWorkflowState,
  Spec,
  SpecHistory,
} from "../../../types/spec.js";

// Database row type for prds table
interface PrdRow {
  id: string;
  title: string;
  workflow_state: string;
  readiness_score: number | null;
  source_session_id: string | null;
  created_at: string;
  updated_at: string;
}

// Database row type for spec_history table
interface SpecHistoryRow {
  id: string;
  spec_id: string;
  version: number;
  changes_json: string;
  snapshot_json: string;
  created_at: string;
  created_by: string;
}

// Valid workflow transitions
const VALID_TRANSITIONS: Record<SpecWorkflowState, SpecWorkflowState[]> = {
  draft: ["review", "archived"],
  review: ["approved", "draft", "archived"],
  approved: ["archived"],
  archived: [], // Terminal state - no transitions allowed
};

// Human-readable transition names
const TRANSITION_NAMES: Record<string, string> = {
  "draft:review": "Submit for Review",
  "review:approved": "Approve",
  "review:draft": "Request Changes",
  "approved:archived": "Archive",
  "draft:archived": "Archive",
  "review:archived": "Archive",
};

export interface WorkflowTransitionResult {
  success: boolean;
  spec?: Spec;
  error?: string;
  fromState?: SpecWorkflowState;
  toState?: SpecWorkflowState;
}

export interface WorkflowTransitionOptions {
  specId: string;
  toState: SpecWorkflowState;
  changedBy?: string;
  comment?: string;
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(
  fromState: SpecWorkflowState,
  toState: SpecWorkflowState,
): boolean {
  const validTargets = VALID_TRANSITIONS[fromState];
  return validTargets.includes(toState);
}

/**
 * Get allowed transitions from a state
 */
export function getAllowedTransitions(
  currentState: SpecWorkflowState,
): SpecWorkflowState[] {
  return VALID_TRANSITIONS[currentState] || [];
}

/**
 * Get human-readable name for a transition
 */
export function getTransitionName(
  fromState: SpecWorkflowState,
  toState: SpecWorkflowState,
): string {
  return (
    TRANSITION_NAMES[`${fromState}:${toState}`] || `${fromState} → ${toState}`
  );
}

/**
 * Map database row to Spec object
 */
function mapPrdRowToSpec(row: PrdRow): Spec {
  return {
    id: row.id,
    title: row.title,
    workflowState: row.workflow_state as SpecWorkflowState,
    readinessScore: row.readiness_score ?? undefined,
    sourceSessionId: row.source_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Spec;
}

/**
 * Execute a workflow transition
 */
export async function transitionWorkflow(
  options: WorkflowTransitionOptions,
): Promise<WorkflowTransitionResult> {
  const { specId, toState, changedBy, comment } = options;

  try {
    // Get current spec state
    const specRow = await getOne<PrdRow>(`SELECT * FROM prds WHERE id = ?`, [
      specId,
    ]);

    if (!specRow) {
      return { success: false, error: "Spec not found" };
    }

    const spec = mapPrdRowToSpec(specRow);
    const fromState = spec.workflowState;

    // Validate transition
    if (!isValidTransition(fromState, toState)) {
      return {
        success: false,
        error: `Invalid transition: cannot go from ${fromState} to ${toState}`,
        fromState,
        toState,
      };
    }

    // Update spec workflow state
    const now = new Date().toISOString();
    await run(
      `UPDATE prds SET workflow_state = ?, updated_at = ? WHERE id = ?`,
      [toState, now, specId],
    );
    await saveDb();

    // Record history
    await recordWorkflowHistory({
      specId,
      fromState,
      toState,
      changedBy,
      comment,
      timestamp: now,
      spec,
    });

    // Emit WebSocket event
    emitWorkflowEvent({
      specId,
      fromState,
      toState,
      changedBy,
      changedAt: now,
      sessionId: spec.sourceSessionId,
    });

    // Get updated spec
    const updatedSpecRow = await getOne<PrdRow>(
      `SELECT * FROM prds WHERE id = ?`,
      [specId],
    );

    if (!updatedSpecRow) {
      return {
        success: true,
        fromState,
        toState,
        error: "Transition succeeded but failed to fetch updated spec",
      };
    }

    return {
      success: true,
      spec: mapPrdRowToSpec(updatedSpecRow),
      fromState,
      toState,
    };
  } catch (err) {
    return {
      success: false,
      error: `Database error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Record workflow history entry
 */
async function recordWorkflowHistory(data: {
  specId: string;
  fromState: SpecWorkflowState;
  toState: SpecWorkflowState;
  changedBy?: string;
  comment?: string;
  timestamp: string;
  spec: Spec;
}): Promise<void> {
  const { specId, fromState, toState, changedBy, comment, timestamp, spec } =
    data;

  try {
    // Get current version number
    const result = await getOne<{ maxVersion: number }>(
      `SELECT COALESCE(MAX(version), 0) as maxVersion FROM spec_history WHERE spec_id = ?`,
      [specId],
    );

    const newVersion = (result?.maxVersion || 0) + 1;

    // Create changes JSON
    const changesJson = JSON.stringify({
      type: "workflow_transition",
      fromState,
      toState,
      transitionName: getTransitionName(fromState, toState),
      comment,
      changedBy,
    });

    // Create snapshot JSON
    const snapshotJson = JSON.stringify({
      title: spec.title,
      workflowState: toState,
      readinessScore: spec.readinessScore,
    });

    await run(
      `INSERT INTO spec_history (id, spec_id, version, changes_json, snapshot_json, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `sh_${specId}_${newVersion}`,
        specId,
        newVersion,
        changesJson,
        snapshotJson,
        timestamp,
        changedBy || "system",
      ],
    );
    await saveDb();
  } catch (err) {
    console.error("Failed to record workflow history:", err);
  }
}

/**
 * Emit WebSocket event for workflow change
 */
function emitWorkflowEvent(data: {
  specId: string;
  fromState: SpecWorkflowState;
  toState: SpecWorkflowState;
  changedBy?: string;
  changedAt: string;
  sessionId?: string;
}): void {
  const { specId, fromState, toState, changedBy, changedAt, sessionId } = data;

  const event = {
    type: "spec:workflow:changed",
    payload: {
      specId,
      fromState,
      toState,
      changedBy,
      changedAt,
      transitionName: getTransitionName(fromState, toState),
    },
  };

  // Broadcast to session if available
  if (sessionId) {
    broadcastToSession(sessionId, event);
  }

  // Emit observability event
  emitWorkflowTransition(specId, fromState, toState, changedBy).catch((err) => {
    console.error(
      "[WorkflowStateMachine] Failed to emit observability event:",
      err,
    );
  });
}

/**
 * Submit spec for review (draft → review)
 */
export async function submitForReview(
  specId: string,
  changedBy?: string,
): Promise<WorkflowTransitionResult> {
  return transitionWorkflow({
    specId,
    toState: "review",
    changedBy,
    comment: "Submitted for review",
  });
}

/**
 * Approve spec (review → approved)
 */
export async function approveSpec(
  specId: string,
  changedBy?: string,
): Promise<WorkflowTransitionResult> {
  return transitionWorkflow({
    specId,
    toState: "approved",
    changedBy,
    comment: "Approved",
  });
}

/**
 * Request changes (review → draft)
 */
export async function requestChanges(
  specId: string,
  changedBy?: string,
  comment?: string,
): Promise<WorkflowTransitionResult> {
  return transitionWorkflow({
    specId,
    toState: "draft",
    changedBy,
    comment: comment || "Changes requested",
  });
}

/**
 * Archive spec (any → archived)
 */
export async function archiveSpec(
  specId: string,
  changedBy?: string,
): Promise<WorkflowTransitionResult> {
  return transitionWorkflow({
    specId,
    toState: "archived",
    changedBy,
    comment: "Archived",
  });
}

/**
 * Get workflow history for a spec
 */
export async function getWorkflowHistory(
  specId: string,
): Promise<SpecHistory[]> {
  const rows = await query<SpecHistoryRow>(
    `SELECT * FROM spec_history WHERE spec_id = ? ORDER BY version DESC`,
    [specId],
  );

  return rows.map((row) => ({
    id: row.id,
    specId: row.spec_id,
    version: row.version,
    changesJson: row.changes_json,
    snapshotJson: row.snapshot_json,
    createdAt: row.created_at,
    createdBy: row.created_by,
  })) as SpecHistory[];
}

export default {
  isValidTransition,
  getAllowedTransitions,
  getTransitionName,
  transitionWorkflow,
  submitForReview,
  approveSpec,
  requestChanges,
  archiveSpec,
  getWorkflowHistory,
};
