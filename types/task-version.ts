/**
 * Task Version Types
 *
 * Types for version history, checkpoints, and rollback support.
 * Part of: Task System V2 Implementation Plan (IMPL-2.6)
 */

import { TaskStatus } from "./task-agent.js";

/**
 * Task version entity
 */
export interface TaskVersion {
  id: string;
  taskId: string;
  version: number;

  snapshot: Record<string, unknown>; // Full task state
  changedFields: string[];
  changeReason?: string;

  isCheckpoint: boolean;
  checkpointName?: string;

  createdBy: string;
  createdAt: string;

  // Computed: version this supersedes (version - 1 if version > 1)
  supersedesVersion?: number;
}

/**
 * Version diff between two versions
 */
export interface VersionDiff {
  fromVersion: number;
  toVersion: number;

  changes: Array<{ field: string; from: unknown; to: unknown }>;
}

/**
 * Input for creating a checkpoint
 */
export interface CreateCheckpointInput {
  taskId: string;
  name: string;
  reason?: string;
}

/**
 * Input for restoring a version
 */
export interface RestoreVersionInput {
  taskId: string;
  targetVersion: number;
  reason?: string;
}

/**
 * Database row representation for task versions
 */
export interface TaskVersionRow {
  id: string;
  task_id: string;
  version: number;
  snapshot: string; // JSON
  changed_fields: string; // JSON array
  change_reason: string | null;
  is_checkpoint: number;
  checkpoint_name: string | null;
  created_by: string;
  created_at: string;
}

/**
 * Map database row to TaskVersion object
 */
export function mapTaskVersionRow(row: TaskVersionRow): TaskVersion {
  return {
    id: row.id,
    taskId: row.task_id,
    version: row.version,
    snapshot: JSON.parse(row.snapshot),
    changedFields: JSON.parse(row.changed_fields),
    changeReason: row.change_reason || undefined,
    isCheckpoint: row.is_checkpoint === 1,
    checkpointName: row.checkpoint_name || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    supersedesVersion: row.version > 1 ? row.version - 1 : undefined,
  };
}

/**
 * State history entry
 */
export interface TaskStateHistoryEntry {
  id: string;
  taskId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedBy: string;
  actorType: "user" | "agent" | "system";
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Database row for state history
 */
export interface TaskStateHistoryRow {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  actor_type: string;
  reason: string | null;
  metadata: string | null; // JSON
  created_at: string;
}

/**
 * Map database row to TaskStateHistoryEntry
 */
export function mapTaskStateHistoryRow(
  row: TaskStateHistoryRow,
): TaskStateHistoryEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    fromStatus: row.from_status as TaskStatus | null,
    toStatus: row.to_status as TaskStatus,
    changedBy: row.changed_by,
    actorType: row.actor_type as "user" | "agent" | "system",
    reason: row.reason || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  };
}

/**
 * Time analytics for a task
 */
export interface TaskTimeAnalytics {
  taskId: string;
  timeInStatus: Record<TaskStatus, number>; // milliseconds per status
  totalTransitions: number;
  averageTimePerStatus: number;
  longestStatus: TaskStatus;
  shortestStatus: TaskStatus;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  taskId: string;
  fromVersion: TaskVersion;
  toVersion: TaskVersion;
  diff: VersionDiff;
  summary: string;
}
