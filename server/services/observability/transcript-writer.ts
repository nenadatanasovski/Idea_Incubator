/**
 * TranscriptWriter - Unified transcript writer for TypeScript agents
 *
 * Writes to SQLite database for observability tracking.
 * Mirrors Python TranscriptWriter API for consistency.
 *
 * OBS-110: Phase 3 TypeScript Observability Services
 */

import { v4 as uuidv4 } from "uuid";
import { run, getDb } from "../../../database/db.js";

export type TranscriptEntryType =
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "tool_use"
  | "skill_invoke"
  | "skill_complete"
  | "validation"
  | "assertion"
  | "discovery"
  | "error"
  | "checkpoint"
  | "lock_acquire"
  | "lock_release";

export type EntryCategory =
  | "lifecycle"
  | "action"
  | "validation"
  | "knowledge"
  | "coordination";

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  sequence: number;
  source: string;
  executionId: string;
  instanceId: string;
  taskId?: string;
  waveId?: string;
  waveNumber?: number;
  entryType: TranscriptEntryType;
  category: EntryCategory;
  summary: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

/**
 * TranscriptWriter for TypeScript agents
 */
export class TranscriptWriter {
  private executionId: string;
  private instanceId: string;
  private waveId?: string;
  private waveNumber?: number;
  private source: string;
  private sequence: number = 0;

  constructor(options: {
    executionId: string;
    instanceId: string;
    waveId?: string;
    waveNumber?: number;
    source?: string;
  }) {
    this.executionId = options.executionId;
    this.instanceId = options.instanceId;
    this.waveId = options.waveId;
    this.waveNumber = options.waveNumber;
    this.source = options.source || "agent";
  }

  /**
   * Write a transcript entry
   */
  async write(entry: {
    entryType: TranscriptEntryType;
    category: EntryCategory;
    summary: string;
    taskId?: string;
    details?: Record<string, unknown>;
    durationMs?: number;
  }): Promise<string> {
    const entryId = uuidv4();
    const timestamp = new Date().toISOString();
    this.sequence += 1;

    try {
      await run(
        `INSERT INTO transcript_entries (
          id, timestamp, sequence, source, execution_id, instance_id,
          task_id, wave_id, wave_number, entry_type, category,
          summary, details, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entryId,
          timestamp,
          this.sequence,
          this.source,
          this.executionId,
          this.instanceId,
          entry.taskId || null,
          this.waveId || null,
          this.waveNumber || null,
          entry.entryType,
          entry.category,
          entry.summary.slice(0, 200),
          entry.details ? JSON.stringify(entry.details) : null,
          entry.durationMs || null,
        ],
      );
    } catch (error) {
      console.error("Failed to write transcript entry:", error);
    }

    return entryId;
  }

  /**
   * Write a phase_start entry
   */
  async writePhaseStart(
    phaseName: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "phase_start",
      category: "lifecycle",
      summary: `Phase started: ${phaseName}`,
      details: { phase: phaseName, ...details },
    });
  }

  /**
   * Write a phase_end entry
   */
  async writePhaseEnd(
    phaseName: string,
    durationMs?: number,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "phase_end",
      category: "lifecycle",
      summary: `Phase completed: ${phaseName}`,
      durationMs,
      details: { phase: phaseName, ...details },
    });
  }

  /**
   * Write a task_start entry
   */
  async writeTaskStart(
    taskId: string,
    taskTitle: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "task_start",
      category: "lifecycle",
      taskId,
      summary: `Task started: ${taskTitle.slice(0, 100)}`,
      details: { taskId, title: taskTitle, ...details },
    });
  }

  /**
   * Write a task_end entry
   */
  async writeTaskEnd(
    taskId: string,
    status: string,
    durationMs?: number,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "task_end",
      category: "lifecycle",
      taskId,
      summary: `Task completed with status: ${status}`,
      durationMs,
      details: { taskId, status, ...details },
    });
  }

  /**
   * Write an error entry
   */
  async writeError(
    message: string,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "error",
      category: "lifecycle",
      taskId,
      summary: `Error: ${message.slice(0, 180)}`,
      details: { error: message, ...details },
    });
  }

  /**
   * Write a discovery entry
   */
  async writeDiscovery(
    discoveryType: string,
    content: string,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "discovery",
      category: "knowledge",
      taskId,
      summary: `Discovery (${discoveryType}): ${content.slice(0, 150)}`,
      details: { type: discoveryType, content, ...details },
    });
  }

  /**
   * Write a checkpoint entry
   */
  async writeCheckpoint(
    checkpointId: string,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.write({
      entryType: "checkpoint",
      category: "lifecycle",
      taskId,
      summary: `Checkpoint created: ${checkpointId}`,
      details: { checkpointId, ...details },
    });
  }

  /**
   * Get current sequence number
   */
  getSequence(): number {
    return this.sequence;
  }
}

export default TranscriptWriter;
