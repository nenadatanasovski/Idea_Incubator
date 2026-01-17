/**
 * OBS-302: Tool Use Service
 *
 * Query tool uses and compute summaries.
 */

import Database from "better-sqlite3";
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
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get tool uses for an execution with filtering.
   */
  getToolUses(
    executionId: string,
    query: ToolUseQuery = {},
  ): PaginatedResponse<ToolUse> {
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    const conditions: string[] = ["execution_id = ?"];
    const params: (string | number | boolean)[] = [executionId];

    // Filter by tools
    if (query.tools?.length) {
      const placeholders = query.tools.map(() => "?").join(",");
      conditions.push(`tool IN (${placeholders})`);
      params.push(...query.tools);
    }

    // Filter by categories
    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`tool_category IN (${placeholders})`);
      params.push(...query.categories);
    }

    // Filter by status
    if (query.status?.length) {
      const placeholders = query.status.map(() => "?").join(",");
      conditions.push(`result_status IN (${placeholders})`);
      params.push(...query.status);
    }

    // Filter by task
    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    // Filter by error
    if (query.isError !== undefined) {
      conditions.push("is_error = ?");
      params.push(query.isError ? 1 : 0);
    }

    // Filter by blocked
    if (query.isBlocked !== undefined) {
      conditions.push("is_blocked = ?");
      params.push(query.isBlocked ? 1 : 0);
    }

    // Time filters
    if (query.fromTime) {
      conditions.push("start_time >= ?");
      params.push(query.fromTime);
    }

    if (query.toTime) {
      conditions.push("end_time <= ?");
      params.push(query.toTime);
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

    if (query.includeInputs) {
      selectColumns.push("input");
    }

    if (query.includeOutputs) {
      selectColumns.push("output");
    }

    const sql = `
      SELECT ${selectColumns.join(", ")}
      FROM tool_uses
      WHERE ${whereClause}
      ORDER BY start_time ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(sql)
      .all(...params, limit, offset) as ToolUseRow[];

    // Get total count
    const countParams = params.slice();
    const countSql = `
      SELECT COUNT(*) as count
      FROM tool_uses
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countSql).get(...countParams) as {
      count: number;
    };
    const total = countResult?.count || 0;

    const data = rows.map((row) => this.mapRow(row, query));

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get a single tool use by ID.
   */
  getToolUse(
    toolUseId: string,
    includePayloads: boolean = false,
  ): ToolUse | null {
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

    const sql = `
      SELECT ${columns.join(", ")}
      FROM tool_uses
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(toolUseId) as ToolUseRow | undefined;
    if (!row) return null;

    return this.mapRow(row, {
      includeInputs: includePayloads,
      includeOutputs: includePayloads,
    });
  }

  /**
   * Get tool usage summary for an execution.
   */
  getToolSummary(executionId: string): ToolUsageSummaryResponse {
    // Aggregate by tool
    const byToolRows = this.db
      .prepare(
        `
        SELECT
          tool,
          COUNT(*) as count,
          SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error,
          SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked,
          AVG(duration_ms) as avgDurationMs
        FROM tool_uses
        WHERE execution_id = ?
        GROUP BY tool
      `,
      )
      .all(executionId) as ByToolRow[];

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
    const byCategoryRows = this.db
      .prepare(
        `
        SELECT
          tool_category as category,
          COUNT(*) as count,
          SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error,
          SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blocked
        FROM tool_uses
        WHERE execution_id = ?
        GROUP BY tool_category
      `,
      )
      .all(executionId) as ByCategoryRow[];

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
    const byStatusRows = this.db
      .prepare(
        `
        SELECT
          result_status as status,
          COUNT(*) as count
        FROM tool_uses
        WHERE execution_id = ?
        GROUP BY result_status
      `,
      )
      .all(executionId) as ByStatusRow[];

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
    const totals = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as total,
          AVG(duration_ms) as avgDurationMs,
          SUM(is_error) as errorCount,
          SUM(is_blocked) as blockedCount,
          MIN(start_time) as firstToolUse,
          MAX(end_time) as lastToolUse
        FROM tool_uses
        WHERE execution_id = ?
      `,
      )
      .get(executionId) as TotalsRow | undefined;

    const total = totals?.total || 0;
    const avgDurationMs = Math.round(totals?.avgDurationMs || 0);
    const errorRate = total > 0 ? (totals?.errorCount || 0) / total : 0;
    const blockRate = total > 0 ? (totals?.blockedCount || 0) / total : 0;

    // Get recent errors (limit 20)
    const errors = this.db
      .prepare(
        `
        SELECT id, tool, input_summary, error_message, start_time
        FROM tool_uses
        WHERE execution_id = ? AND is_error = 1
        ORDER BY start_time DESC
        LIMIT 20
      `,
      )
      .all(executionId) as ErrorRow[];

    // Get recent blocked (limit 20)
    const blocked = this.db
      .prepare(
        `
        SELECT id, tool, input_summary, block_reason, start_time
        FROM tool_uses
        WHERE execution_id = ? AND is_blocked = 1
        ORDER BY start_time DESC
        LIMIT 20
      `,
      )
      .all(executionId) as BlockedRow[];

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
  }

  /**
   * Map database row to ToolUse.
   */
  private mapRow(row: ToolUseRow, query: ToolUseQuery): ToolUse {
    return {
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      transcriptEntryId: row.transcript_entry_id,
      tool: row.tool,
      toolCategory: row.tool_category as ToolCategory,
      input: query.includeInputs ? this.parseJson(row.input) || {} : {},
      inputSummary: row.input_summary,
      resultStatus: row.result_status as ToolUse["resultStatus"],
      output: query.includeOutputs ? this.parseJson(row.output) : null,
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

  close(): void {
    this.db.close();
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
