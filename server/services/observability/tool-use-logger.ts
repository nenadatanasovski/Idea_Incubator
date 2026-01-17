/**
 * ToolUseLogger - Logs tool invocations with timing and results
 *
 * Tracks tool starts and ends, calculates duration, and records
 * to both transcript and tool_uses table.
 *
 * OBS-110: Phase 3 TypeScript Observability Services
 */

import { v4 as uuidv4 } from "uuid";
import { run, getDb } from "../../../database/db.js";
import { TranscriptWriter } from "./transcript-writer.js";

export type ToolCategory =
  | "file_read"
  | "file_write"
  | "shell"
  | "browser"
  | "network"
  | "agent"
  | "custom";

const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  Read: "file_read",
  Glob: "file_read",
  Grep: "file_read",
  LS: "file_read",
  Write: "file_write",
  Edit: "file_write",
  NotebookEdit: "file_write",
  Bash: "shell",
  WebFetch: "browser",
  WebSearch: "browser",
  Task: "agent",
};

interface PendingToolUse {
  id: string;
  tool: string;
  toolCategory: ToolCategory;
  input: Record<string, unknown>;
  inputSummary: string;
  transcriptEntryId: string;
  startTime: number;
  taskId?: string;
}

/**
 * ToolUseLogger for TypeScript agents
 */
export class ToolUseLogger {
  private transcript: TranscriptWriter;
  private pending: Map<string, PendingToolUse> = new Map();

  constructor(transcriptWriter: TranscriptWriter) {
    this.transcript = transcriptWriter;
  }

  /**
   * Get tool category from tool name
   */
  private categorize(toolName: string): ToolCategory {
    return TOOL_CATEGORY_MAP[toolName] || "custom";
  }

  /**
   * Create a summary of data, truncating if needed
   */
  private summarize(data: unknown, maxLength: number = 500): string {
    if (data === null || data === undefined) return "";
    const s = typeof data === "object" ? JSON.stringify(data) : String(data);
    return s.length > maxLength ? s.slice(0, maxLength - 3) + "..." : s;
  }

  /**
   * Log start of tool invocation
   */
  async logStart(
    toolName: string,
    toolInput: Record<string, unknown>,
    taskId?: string,
  ): Promise<string> {
    const toolId = uuidv4();
    const toolCategory = this.categorize(toolName);
    const inputSummary = this.summarize(toolInput);

    // Write transcript entry
    const transcriptId = await this.transcript.write({
      entryType: "tool_use",
      category: "action",
      taskId,
      summary: `Tool: ${toolName}`,
      details: {
        tool: toolName,
        inputSummary: inputSummary.slice(0, 200),
      },
    });

    // Store pending for later completion
    this.pending.set(toolId, {
      id: toolId,
      tool: toolName,
      toolCategory,
      input: toolInput,
      inputSummary,
      transcriptEntryId: transcriptId,
      startTime: Date.now(),
      taskId,
    });

    // Insert initial row with pending status
    try {
      await run(
        `INSERT INTO tool_uses (
          id, execution_id, task_id, transcript_entry_id,
          tool, tool_category, input, input_summary,
          result_status, output_summary, start_time, end_time,
          duration_ms, wave_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toolId,
          (this.transcript as any).executionId,
          taskId || null,
          transcriptId,
          toolName,
          toolCategory,
          JSON.stringify(toolInput),
          inputSummary.slice(0, 200),
          "pending",
          "",
          new Date().toISOString(),
          new Date().toISOString(),
          0,
          (this.transcript as any).waveId || null,
        ],
      );
    } catch (error) {
      console.error("Failed to log tool start:", error);
    }

    return toolId;
  }

  /**
   * Log completion of tool invocation
   */
  async logEnd(
    toolUseId: string,
    output: unknown,
    isError: boolean = false,
    errorMessage?: string,
  ): Promise<void> {
    const pending = this.pending.get(toolUseId);
    if (!pending) return;

    this.pending.delete(toolUseId);

    const endTime = Date.now();
    const durationMs = endTime - pending.startTime;
    const outputSummary = this.summarize(output);
    const status = isError ? "error" : "done";

    try {
      await run(
        `UPDATE tool_uses SET
          result_status = ?,
          output = ?,
          output_summary = ?,
          is_error = ?,
          error_message = ?,
          end_time = ?,
          duration_ms = ?
        WHERE id = ?`,
        [
          status,
          typeof output === "string" ? output : JSON.stringify(output),
          outputSummary.slice(0, 500),
          isError ? 1 : 0,
          errorMessage || null,
          new Date().toISOString(),
          durationMs,
          toolUseId,
        ],
      );
    } catch (error) {
      console.error("Failed to log tool end:", error);
    }
  }

  /**
   * Log security-blocked tool invocation
   */
  async logBlocked(toolUseId: string, reason: string): Promise<void> {
    const pending = this.pending.get(toolUseId);
    if (!pending) return;

    this.pending.delete(toolUseId);

    const endTime = Date.now();
    const durationMs = endTime - pending.startTime;

    try {
      await run(
        `UPDATE tool_uses SET
          result_status = ?,
          is_blocked = ?,
          block_reason = ?,
          end_time = ?,
          duration_ms = ?
        WHERE id = ?`,
        ["blocked", 1, reason, new Date().toISOString(), durationMs, toolUseId],
      );
    } catch (error) {
      console.error("Failed to log blocked tool:", error);
    }
  }

  /**
   * Log a complete tool invocation in one call
   */
  async logSimple(
    toolName: string,
    toolInput: Record<string, unknown>,
    output: unknown,
    taskId?: string,
    isError: boolean = false,
    errorMessage?: string,
  ): Promise<string> {
    const toolId = await this.logStart(toolName, toolInput, taskId);
    await this.logEnd(toolId, output, isError, errorMessage);
    return toolId;
  }
}

export default ToolUseLogger;
