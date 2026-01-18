/**
 * OBS-300: Execution Service
 *
 * Manages execution queries and statistics for the observability system.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne, run } from "../../../database/db.js";
import type {
  ExecutionResponse,
  ExecutionListQuery,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type { ExecutionStatus } from "../../../frontend/src/types/observability/transcript.js";
import { observabilityStream } from "./observability-stream.js";

export class ExecutionService {
  /**
   * List all executions with optional filtering.
   */
  async listExecutions(
    listQuery: ExecutionListQuery = {},
  ): Promise<PaginatedResponse<ExecutionResponse>> {
    const limit = listQuery.limit || 50;
    const offset = listQuery.offset || 0;

    try {
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
          waves_total as wave_count,
          tasks_total as task_count,
          tasks_completed as completed_count,
          tasks_failed as failed_count
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
    } catch (error) {
      // Table may not exist yet - return empty result
      console.warn(
        "ExecutionService.listExecutions error (table may not exist):",
        error,
      );
      return {
        data: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }
  }

  /**
   * Get a single execution by ID with full stats.
   */
  async getExecution(executionId: string): Promise<ExecutionResponse | null> {
    try {
      const row = await getOne<ExecutionRow>(
        `SELECT
          id,
          task_list_id,
          run_number,
          status,
          started_at,
          completed_at,
          session_id,
          waves_total as wave_count,
          tasks_total as task_count,
          tasks_completed as completed_count,
          tasks_failed as failed_count
        FROM task_list_execution_runs
        WHERE id = ?`,
        [executionId],
      );

      if (!row) return null;
      return this.enrichExecutionStats(row);
    } catch (error) {
      console.warn("ExecutionService.getExecution error:", error);
      return null;
    }
  }

  /**
   * Enrich execution with computed stats.
   */
  private async enrichExecutionStats(
    row: ExecutionRow,
  ): Promise<ExecutionResponse> {
    const executionId = row.id;

    // Get tool use stats (defensive - tables may not exist)
    let totalToolUses = 0;
    let errorCount = 0;
    let blockedCount = 0;
    try {
      const toolStats = await getOne<ToolStats>(
        `SELECT
          COUNT(*) as totalToolUses,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as errorCount,
          SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blockedCount
        FROM tool_uses
        WHERE execution_id = ?`,
        [executionId],
      );
      totalToolUses = toolStats?.totalToolUses || 0;
      errorCount = toolStats?.errorCount || 0;
      blockedCount = toolStats?.blockedCount || 0;
    } catch {
      // Table may not exist
    }

    // Get assertion stats (defensive - tables may not exist)
    let totalAssertions = 0;
    let passed = 0;
    try {
      const assertionStats = await getOne<AssertionStats>(
        `SELECT
          COUNT(*) as totalAssertions,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
        FROM assertion_results
        WHERE execution_id = ?`,
        [executionId],
      );
      totalAssertions = assertionStats?.totalAssertions || 0;
      passed = assertionStats?.passed || 0;
    } catch {
      // Table may not exist
    }

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
    try {
      const rows = await query<ExecutionRow>(
        `SELECT
          id,
          task_list_id,
          run_number,
          status,
          started_at,
          completed_at,
          session_id,
          waves_total as wave_count,
          tasks_total as task_count,
          tasks_completed as completed_count,
          tasks_failed as failed_count
        FROM task_list_execution_runs
        ORDER BY started_at DESC
        LIMIT ?`,
        [limit],
      );
      return Promise.all(rows.map((row) => this.enrichExecutionStats(row)));
    } catch (error) {
      console.warn("ExecutionService.getRecentExecutions error:", error);
      return [];
    }
  }

  /**
   * Get execution stats for dashboard.
   */
  async getExecutionStats(): Promise<{
    activeCount: number;
    totalRecent: number;
    failedRecent: number;
  }> {
    try {
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
    } catch (error) {
      console.warn("ExecutionService.getExecutionStats error:", error);
      return {
        activeCount: 0,
        totalRecent: 0,
        failedRecent: 0,
      };
    }
  }

  // ===========================================================================
  // OBS-608: Wave Status Streaming
  // ===========================================================================

  /**
   * Emit wave status change event.
   */
  emitWaveStatus(
    executionId: string,
    waveNumber: number,
    status: "pending" | "running" | "completed" | "failed",
    taskCount: number,
    completedCount: number,
    failedCount: number,
  ): void {
    observabilityStream.emitWaveStatus(
      executionId,
      waveNumber,
      status,
      taskCount,
      completedCount,
      failedCount,
    );
  }

  // ===========================================================================
  // OBS-609: Agent Heartbeat Streaming
  // ===========================================================================

  /**
   * Emit agent heartbeat event.
   */
  emitAgentHeartbeat(
    executionId: string,
    instanceId: string,
    status: "idle" | "working" | "blocked" | "error",
    currentTaskId?: string,
    metrics?: Record<string, number>,
  ): void {
    observabilityStream.emitAgentHeartbeat(
      executionId,
      instanceId,
      status,
      currentTaskId,
      metrics,
    );
  }

  // ===========================================================================
  // OBS-610: Execution Status Streaming
  // ===========================================================================

  /**
   * Emit execution status change event.
   */
  emitExecutionStatus(
    executionId: string,
    status: "started" | "running" | "paused" | "completed" | "failed",
    message?: string,
  ): void {
    observabilityStream.emitExecutionStatus(executionId, status, message);
  }

  /**
   * Update execution status and emit stream event.
   */
  async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    message?: string,
  ): Promise<void> {
    try {
      const updates: string[] = ["status = ?"];
      const params: (string | number)[] = [status];

      if (status === "completed" || status === "failed") {
        updates.push("completed_at = ?");
        params.push(new Date().toISOString());
      }

      params.push(executionId);

      await run(
        `UPDATE task_list_execution_runs SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );

      // Map ExecutionStatus to stream status
      const streamStatus = status as
        | "started"
        | "running"
        | "paused"
        | "completed"
        | "failed";
      this.emitExecutionStatus(executionId, streamStatus, message);
    } catch (error) {
      console.error("Failed to update execution status:", error);
    }
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
