/**
 * OBS-300: Execution Service
 *
 * Manages execution queries and statistics for the observability system.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  ExecutionResponse,
  ExecutionListQuery,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type { ExecutionStatus } from "../../../frontend/src/types/observability/transcript.js";

export class ExecutionService {
  /**
   * List all executions with optional filtering.
   */
  async listExecutions(
    listQuery: ExecutionListQuery = {},
  ): Promise<PaginatedResponse<ExecutionResponse>> {
    const limit = listQuery.limit || 50;
    const offset = listQuery.offset || 0;
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (listQuery.taskListId) {
      conditions.push("task_list_id = ?");
      params.push(listQuery.taskListId);
    }

    if (listQuery.status?.length) {
      const placeholders = listQuery.status.map(() => "?").join(",");
      conditions.push(`status IN (${placeholders})`);
      params.push(...listQuery.status);
    }

    if (listQuery.fromTime) {
      conditions.push("started_at >= ?");
      params.push(listQuery.fromTime);
    }

    if (listQuery.toTime) {
      conditions.push("started_at <= ?");
      params.push(listQuery.toTime);
    }

    const whereClause = conditions.join(" AND ");

    // Get executions
    const rows = await query<ExecutionRow>(
      `SELECT
        id,
        task_list_id,
        run_number,
        status,
        started_at,
        completed_at,
        session_id,
        wave_count,
        task_count,
        completed_count,
        failed_count
      FROM task_list_execution_runs
      WHERE ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Get total count
    const countResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM task_list_execution_runs
      WHERE ${whereClause}`,
      params,
    );
    const total = countResult?.count || 0;

    // Enrich each execution with stats
    const data = await Promise.all(
      rows.map((row) => this.enrichExecutionStats(row)),
    );

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get a single execution by ID with full stats.
   */
  async getExecution(executionId: string): Promise<ExecutionResponse | null> {
    const row = await getOne<ExecutionRow>(
      `SELECT
        id,
        task_list_id,
        run_number,
        status,
        started_at,
        completed_at,
        session_id,
        wave_count,
        task_count,
        completed_count,
        failed_count
      FROM task_list_execution_runs
      WHERE id = ?`,
      [executionId],
    );

    if (!row) return null;
    return this.enrichExecutionStats(row);
  }

  /**
   * Enrich execution with computed stats.
   */
  private async enrichExecutionStats(
    row: ExecutionRow,
  ): Promise<ExecutionResponse> {
    const executionId = row.id;

    // Get tool use stats
    const toolStats = await getOne<ToolStats>(
      `SELECT
        COUNT(*) as totalToolUses,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as errorCount,
        SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blockedCount
      FROM tool_uses
      WHERE execution_id = ?`,
      [executionId],
    );

    // Get assertion stats
    const assertionStats = await getOne<AssertionStats>(
      `SELECT
        COUNT(*) as totalAssertions,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
      FROM assertion_results
      WHERE execution_id = ?`,
      [executionId],
    );

    const totalToolUses = toolStats?.totalToolUses || 0;
    const errorCount = toolStats?.errorCount || 0;
    const blockedCount = toolStats?.blockedCount || 0;
    const totalAssertions = assertionStats?.totalAssertions || 0;
    const passed = assertionStats?.passed || 0;

    const passRate = totalAssertions > 0 ? passed / totalAssertions : 1;

    // Calculate duration
    let durationMs: number | undefined;
    if (row.started_at && row.completed_at) {
      const startTime = new Date(row.started_at);
      const endTime = new Date(row.completed_at);
      durationMs = endTime.getTime() - startTime.getTime();
    }

    return {
      id: row.id,
      taskListId: row.task_list_id,
      runNumber: row.run_number,
      startTime: row.started_at,
      endTime: row.completed_at || undefined,
      status: row.status as ExecutionStatus,
      taskCount: row.task_count || 0,
      agentCount: 1,
      waveCount: row.wave_count || 1,
      completedCount: row.completed_count || 0,
      failedCount: row.failed_count || 0,
      stats: {
        totalToolUses,
        totalAssertions,
        passRate,
        errorCount,
        blockedCount,
        durationMs,
      },
    };
  }

  /**
   * Get recent executions for dashboard.
   */
  async getRecentExecutions(limit: number = 10): Promise<ExecutionResponse[]> {
    const rows = await query<ExecutionRow>(
      `SELECT
        id,
        task_list_id,
        run_number,
        status,
        started_at,
        completed_at,
        session_id,
        wave_count,
        task_count,
        completed_count,
        failed_count
      FROM task_list_execution_runs
      ORDER BY started_at DESC
      LIMIT ?`,
      [limit],
    );
    return Promise.all(rows.map((row) => this.enrichExecutionStats(row)));
  }

  /**
   * Get execution stats for dashboard.
   */
  async getExecutionStats(): Promise<{
    activeCount: number;
    totalRecent: number;
    failedRecent: number;
  }> {
    const result = await getOne<{
      activeCount: number;
      totalRecent: number;
      failedRecent: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'running') as activeCount,
        (SELECT COUNT(*) FROM task_list_execution_runs WHERE started_at > datetime('now', '-24 hours')) as totalRecent,
        (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'failed' AND started_at > datetime('now', '-24 hours')) as failedRecent`,
      [],
    );

    return {
      activeCount: result?.activeCount || 0,
      totalRecent: result?.totalRecent || 0,
      failedRecent: result?.failedRecent || 0,
    };
  }
}

// Internal row types
interface ExecutionRow {
  id: string;
  task_list_id: string;
  run_number: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  session_id: string | null;
  wave_count: number | null;
  task_count: number | null;
  completed_count: number | null;
  failed_count: number | null;
}

interface ToolStats {
  totalToolUses: number;
  errorCount: number;
  blockedCount: number;
}

interface AssertionStats {
  totalAssertions: number;
  passed: number;
}

// Export singleton instance
export const executionService = new ExecutionService();
