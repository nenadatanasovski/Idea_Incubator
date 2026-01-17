/**
 * OBS-300: Execution Service
 *
 * Manages execution queries and statistics for the observability system.
 */

import Database from "better-sqlite3";
import type {
  ExecutionResponse,
  ExecutionListQuery,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type { ExecutionStatus } from "../../../frontend/src/types/observability/transcript.js";

export class ExecutionService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * List all executions with optional filtering.
   */
  listExecutions(
    query: ExecutionListQuery = {},
  ): PaginatedResponse<ExecutionResponse> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (query.taskListId) {
      conditions.push("task_list_id = ?");
      params.push(query.taskListId);
    }

    if (query.status?.length) {
      const placeholders = query.status.map(() => "?").join(",");
      conditions.push(`status IN (${placeholders})`);
      params.push(...query.status);
    }

    if (query.fromTime) {
      conditions.push("started_at >= ?");
      params.push(query.fromTime);
    }

    if (query.toTime) {
      conditions.push("started_at <= ?");
      params.push(query.toTime);
    }

    const whereClause = conditions.join(" AND ");

    // Get executions
    const sql = `
      SELECT
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
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(sql)
      .all(...params, limit, offset) as ExecutionRow[];

    // Get total count
    const countSql = `
      SELECT COUNT(*) as count
      FROM task_list_execution_runs
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countSql).get(...params) as {
      count: number;
    };
    const total = countResult?.count || 0;

    // Enrich each execution with stats
    const data = rows.map((row) => this.enrichExecutionStats(row));

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
  getExecution(executionId: string): ExecutionResponse | null {
    const sql = `
      SELECT
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
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(executionId) as
      | ExecutionRow
      | undefined;
    if (!row) return null;

    return this.enrichExecutionStats(row);
  }

  /**
   * Enrich execution with computed stats.
   */
  private enrichExecutionStats(row: ExecutionRow): ExecutionResponse {
    const executionId = row.id;

    // Get tool use stats
    const toolStats = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as totalToolUses,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as errorCount,
          SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END) as blockedCount
        FROM tool_uses
        WHERE execution_id = ?
      `,
      )
      .get(executionId) as ToolStats | undefined;

    // Get assertion stats
    const assertionStats = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as totalAssertions,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
        FROM assertion_results
        WHERE execution_id = ?
      `,
      )
      .get(executionId) as AssertionStats | undefined;

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
      agentCount: 1, // Default - would need separate tracking
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
  getRecentExecutions(limit: number = 10): ExecutionResponse[] {
    const sql = `
      SELECT
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
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(limit) as ExecutionRow[];
    return rows.map((row) => this.enrichExecutionStats(row));
  }

  /**
   * Get execution stats for dashboard.
   */
  getExecutionStats(): {
    activeCount: number;
    totalRecent: number;
    failedRecent: number;
  } {
    const result = this.db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'running') as activeCount,
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE started_at > datetime('now', '-24 hours')) as totalRecent,
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'failed' AND started_at > datetime('now', '-24 hours')) as failedRecent
      `,
      )
      .get() as {
      activeCount: number;
      totalRecent: number;
      failedRecent: number;
    };

    return {
      activeCount: result?.activeCount || 0,
      totalRecent: result?.totalRecent || 0,
      failedRecent: result?.failedRecent || 0,
    };
  }

  close(): void {
    this.db.close();
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
