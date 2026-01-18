/**
 * OBS-302: Tool Use Service
 *
 * Query tool uses and compute summaries.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  ToolUseQuery,
  ToolUsageSummaryResponse,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type {
  ToolUse,
  ToolCategory,
} from "../../../frontend/src/types/observability/tool-use.js";

export class ToolUseService {
  /**
   * Get tool uses for an execution with filtering.
   */
  async getToolUses(
    executionId: string,
    toolQuery: ToolUseQuery = {},
  ): Promise<PaginatedResponse<ToolUse>> {
    const limit = toolQuery.limit || 100;
    const offset = toolQuery.offset || 0;

    try {
      const conditions: string[] = ["execution_id = ?"];
      const params: (string | number | boolean)[] = [executionId];

      // Filter by tools
      if (toolQuery.tools?.length) {
        const placeholders = toolQuery.tools.map(() => "?").join(",");
        conditions.push(`tool IN (${placeholders})`);
        params.push(...toolQuery.tools);
      }

      // Filter by categories
      if (toolQuery.categories?.length) {
        const placeholders = toolQuery.categories.map(() => "?").join(",");
        conditions.push(`tool_category IN (${placeholders})`);
        params.push(...toolQuery.categories);
      }

      // Filter by status
      if (toolQuery.status?.length) {
        const placeholders = toolQuery.status.map(() => "?").join(",");
        conditions.push(`result_status IN (${placeholders})`);
        params.push(...toolQuery.status);
      }

      // Filter by task
      if (toolQuery.taskId) {
        conditions.push("task_id = ?");
        params.push(toolQuery.taskId);
      }

      // Filter by error
      if (toolQuery.isError !== undefined) {
        conditions.push("is_error = ?");
        params.push(toolQuery.isError ? 1 : 0);
      }

      // Filter by blocked
      if (toolQuery.isBlocked !== undefined) {
        conditions.push("is_blocked = ?");
        params.push(toolQuery.isBlocked ? 1 : 0);
      }

      // Time filters
      if (toolQuery.fromTime) {
        conditions.push("start_time >= ?");
        params.push(toolQuery.fromTime);
      }

      if (toolQuery.toTime) {
        conditions.push("end_time <= ?");
        params.push(toolQuery.toTime);
      }

      const whereClause = conditions.join(" AND ");

      // Build select columns based on include flags
      const selectColumns = [
        "id",
        "execution_id",
        "task_id",
        "transcript_entry_id",
        "tool",
        "tool_category",
        "input_summary",
        "result_status",
        "output_summary",
        "is_error",
        "is_blocked",
        "error_message",
        "block_reason",
        "start_time",
        "end_time",
        "duration_ms",
        "within_skill",
        "parent_tool_use_id",
        "created_at",
      ];

      if (toolQuery.includeInputs) {
        selectColumns.push("input");
      }

      if (toolQuery.includeOutputs) {
        selectColumns.push("output");
      }

      const rows = await query<ToolUseRow>(
        `SELECT ${selectColumns.join(", ")}
        FROM tool_uses
        WHERE ${whereClause}
        ORDER BY start_time ASC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      // Get total count
      const countResult = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count
        FROM tool_uses
        WHERE ${whereClause}`,
        params,
      );
      const total = countResult?.count || 0;

      const data = rows.map((row) => this.mapRow(row, toolQuery));

      return {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      };
    } catch (error) {
      console.warn("ToolUseService.getToolUses error:", error);
      return { data: [], total: 0, limit, offset, hasMore: false };
    }
  }

  /**
   * Get a single tool use by ID.
   */
  async getToolUse(
    toolUseId: string,
    includePayloads: boolean = false,
  ): Promise<ToolUse | null> {
    try {
      const columns = [
        "id",
        "execution_id",
        "task_id",
        "transcript_entry_id",
        "tool",
        "tool_category",
        "input_summary",
        "result_status",
        "output_summary",
        "is_error",
        "is_blocked",
        "error_message",
        "block_reason",
        "start_time",
        "end_time",
        "duration_ms",
        "within_skill",
        "parent_tool_use_id",
        "created_at",
      ];

      if (includePayloads) {
        columns.push("input", "output");
      }

      const row = await getOne<ToolUseRow>(
        `SELECT ${columns.join(", ")}
        FROM tool_uses
        WHERE id = ?`,
        [toolUseId],
      );

      if (!row) return null;
      return this.mapRow(row, {
        includeInputs: includePayloads,
        includeOutputs: includePayloads,
      });
    } catch (error) {
      console.warn("ToolUseService.getToolUse error:", error);
      return null;
    }
  }

  /**
   * Get tool usage summary for an execution.
   */
  async getToolSummary(executionId: string): Promise<ToolUsageSummaryResponse> {
    const emptyResponse: ToolUsageSummaryResponse = {
      executionId,
      total: 0,
      byTool: {},
      byCategory: {},
      byStatus: { done: 0, error: 0, blocked: 0 },
      avgDurationMs: 0,
      errorRate: 0,
      blockRate: 0,
      timeline: { firstToolUse: "", lastToolUse: "", totalDurationMs: 0 },
      errors: [],
      blocked: [],
    };

    try {
      // Aggregate by tool
      const byToolRows = await query<ByToolRow>(
        `SELECT
        tool,
        COUNT(*) as count,
        SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked,
        AVG(duration_ms) as avgDurationMs
      FROM tool_uses
      WHERE execution_id = ?
      GROUP BY tool`,
        [executionId],
      );

      const byTool: ToolUsageSummaryResponse["byTool"] = {};
      for (const row of byToolRows) {
        byTool[row.tool] = {
          count: row.count,
          success: row.success,
          error: row.error,
          blocked: row.blocked,
          avgDurationMs: Math.round(row.avgDurationMs || 0),
        };
      }

      // Aggregate by category
      const byCategoryRows = await query<ByCategoryRow>(
        `SELECT
        tool_category as category,
        COUNT(*) as count,
        SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked
      FROM tool_uses
      WHERE execution_id = ?
      GROUP BY tool_category`,
        [executionId],
      );

      const byCategory: ToolUsageSummaryResponse["byCategory"] = {};
      for (const row of byCategoryRows) {
        byCategory[row.category] = {
          count: row.count,
          success: row.success,
          error: row.error,
          blocked: row.blocked,
        };
      }

      // Aggregate by status
      const byStatusRows = await query<ByStatusRow>(
        `SELECT
        result_status as status,
        COUNT(*) as count
      FROM tool_uses
      WHERE execution_id = ?
      GROUP BY result_status`,
        [executionId],
      );

      const byStatus: ToolUsageSummaryResponse["byStatus"] = {
        done: 0,
        error: 0,
        blocked: 0,
      };
      for (const row of byStatusRows) {
        if (row.status === "done") byStatus.done = row.count;
        else if (row.status === "error") byStatus.error = row.count;
        else if (row.status === "blocked") byStatus.blocked = row.count;
      }

      // Get totals
      const totals = await getOne<TotalsRow>(
        `SELECT
        COUNT(*) as total,
        AVG(duration_ms) as avgDurationMs,
        SUM(is_error) as errorCount,
        SUM(is_blocked) as blockedCount,
        MIN(start_time) as firstToolUse,
        MAX(end_time) as lastToolUse
      FROM tool_uses
      WHERE execution_id = ?`,
        [executionId],
      );

      const total = totals?.total || 0;
      const avgDurationMs = Math.round(totals?.avgDurationMs || 0);
      const errorRate = total > 0 ? (totals?.errorCount || 0) / total : 0;
      const blockRate = total > 0 ? (totals?.blockedCount || 0) / total : 0;

      // Get recent errors (limit 20)
      const errors = await query<ErrorRow>(
        `SELECT id, tool, input_summary, error_message, start_time
      FROM tool_uses
      WHERE execution_id = ? AND is_error = 1
      ORDER BY start_time DESC
      LIMIT 20`,
        [executionId],
      );

      // Get recent blocked (limit 20)
      const blocked = await query<BlockedRow>(
        `SELECT id, tool, input_summary, block_reason, start_time
      FROM tool_uses
      WHERE execution_id = ? AND is_blocked = 1
      ORDER BY start_time DESC
      LIMIT 20`,
        [executionId],
      );

      // Calculate timeline duration
      let totalDurationMs = 0;
      if (totals?.firstToolUse && totals?.lastToolUse) {
        const first = new Date(totals.firstToolUse);
        const last = new Date(totals.lastToolUse);
        totalDurationMs = last.getTime() - first.getTime();
      }

      return {
        executionId,
        total,
        byTool,
        byCategory,
        byStatus,
        avgDurationMs,
        errorRate,
        blockRate,
        timeline: {
          firstToolUse: totals?.firstToolUse || "",
          lastToolUse: totals?.lastToolUse || "",
          totalDurationMs,
        },
        errors: errors.map((e) => ({
          toolUseId: e.id,
          tool: e.tool,
          inputSummary: e.input_summary,
          errorMessage: e.error_message || "",
          timestamp: e.start_time,
        })),
        blocked: blocked.map((b) => ({
          toolUseId: b.id,
          tool: b.tool,
          inputSummary: b.input_summary,
          blockReason: b.block_reason || "",
          timestamp: b.start_time,
        })),
      };
    } catch (error) {
      console.warn("ToolUseService.getToolSummary error:", error);
      return emptyResponse;
    }
  }

  /**
   * Map database row to ToolUse.
   */
  private mapRow(row: ToolUseRow, toolQuery: ToolUseQuery): ToolUse {
    return {
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      transcriptEntryId: row.transcript_entry_id,
      tool: row.tool,
      toolCategory: row.tool_category as ToolCategory,
      input: toolQuery.includeInputs ? this.parseJson(row.input) || {} : {},
      inputSummary: row.input_summary,
      resultStatus: row.result_status as ToolUse["resultStatus"],
      output: toolQuery.includeOutputs ? this.parseJson(row.output) : null,
      outputSummary: row.output_summary,
      isError: row.is_error === 1,
      isBlocked: row.is_blocked === 1,
      errorMessage: row.error_message,
      blockReason: row.block_reason,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMs: row.duration_ms,
      withinSkill: row.within_skill,
      parentToolUseId: row.parent_tool_use_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Safely parse JSON string.
   */
  private parseJson<T>(json: string | null | undefined): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

// Internal row types
interface ToolUseRow {
  id: string;
  execution_id: string;
  task_id: string | null;
  transcript_entry_id: string;
  tool: string;
  tool_category: string;
  input?: string;
  input_summary: string;
  result_status: string;
  output?: string;
  output_summary: string;
  is_error: number;
  is_blocked: number;
  error_message: string | null;
  block_reason: string | null;
  start_time: string;
  end_time: string;
  duration_ms: number;
  within_skill: string | null;
  parent_tool_use_id: string | null;
  created_at: string;
}

interface ByToolRow {
  tool: string;
  count: number;
  success: number;
  error: number;
  blocked: number;
  avgDurationMs: number;
}

interface ByCategoryRow {
  category: string;
  count: number;
  success: number;
  error: number;
  blocked: number;
}

interface ByStatusRow {
  status: string;
  count: number;
}

interface TotalsRow {
  total: number;
  avgDurationMs: number;
  errorCount: number;
  blockedCount: number;
  firstToolUse: string;
  lastToolUse: string;
}

interface ErrorRow {
  id: string;
  tool: string;
  input_summary: string;
  error_message: string | null;
  start_time: string;
}

interface BlockedRow {
  id: string;
  tool: string;
  input_summary: string;
  block_reason: string | null;
  start_time: string;
}

// Export singleton instance
export const toolUseService = new ToolUseService();
