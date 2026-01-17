/**
 * OBS-303: Assertion Service
 *
 * Query assertions and compute summaries.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  AssertionQuery,
  AssertionSummaryResponse,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type {
  AssertionResult,
  AssertionChain,
  AssertionChainWithResults,
  AssertionCategory,
  AssertionSummary,
} from "../../../frontend/src/types/observability/assertion.js";

export class AssertionService {
  /**
   * Get assertions for an execution with filtering.
   */
  async getAssertions(
    executionId: string,
    assertionQuery: AssertionQuery = {},
  ): Promise<PaginatedResponse<AssertionResult>> {
    const limit = assertionQuery.limit || 100;
    const offset = assertionQuery.offset || 0;
    const conditions: string[] = ["execution_id = ?"];
    const params: (string | number)[] = [executionId];

    // Filter by categories
    if (assertionQuery.categories?.length) {
      const placeholders = assertionQuery.categories.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...assertionQuery.categories);
    }

    // Filter by result
    if (assertionQuery.result?.length) {
      const placeholders = assertionQuery.result.map(() => "?").join(",");
      conditions.push(`result IN (${placeholders})`);
      params.push(...assertionQuery.result);
    }

    // Filter by task
    if (assertionQuery.taskId) {
      conditions.push("task_id = ?");
      params.push(assertionQuery.taskId);
    }

    // Filter by chain
    if (assertionQuery.chainId) {
      conditions.push("chain_id = ?");
      params.push(assertionQuery.chainId);
    }

    // Time filters
    if (assertionQuery.since) {
      conditions.push("timestamp >= ?");
      params.push(assertionQuery.since);
    }

    if (assertionQuery.until) {
      conditions.push("timestamp <= ?");
      params.push(assertionQuery.until);
    }

    const whereClause = conditions.join(" AND ");

    const rows = await query<AssertionRow>(
      `SELECT
        id,
        task_id,
        execution_id,
        category,
        description,
        result,
        evidence,
        chain_id,
        chain_position,
        timestamp,
        duration_ms,
        transcript_entry_id,
        created_at
      FROM assertion_results
      WHERE ${whereClause}
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Get total count
    const countResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM assertion_results
      WHERE ${whereClause}`,
      params,
    );
    const total = countResult?.count || 0;

    const data = rows.map((row) => this.mapRow(row));

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get a single assertion by ID.
   */
  async getAssertion(assertionId: string): Promise<AssertionResult | null> {
    const row = await getOne<AssertionRow>(
      `SELECT
        id,
        task_id,
        execution_id,
        category,
        description,
        result,
        evidence,
        chain_id,
        chain_position,
        timestamp,
        duration_ms,
        transcript_entry_id,
        created_at
      FROM assertion_results
      WHERE id = ?`,
      [assertionId],
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Get assertion summary for an execution.
   */
  async getAssertionSummary(
    executionId: string,
  ): Promise<AssertionSummaryResponse> {
    // Get result counts
    const resultCounts = await query<{ result: string; count: number }>(
      `SELECT
        result,
        COUNT(*) as count
      FROM assertion_results
      WHERE execution_id = ?
      GROUP BY result`,
      [executionId],
    );

    const summary: AssertionSummary["summary"] = {
      totalAssertions: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      warnings: 0,
      passRate: 0,
    };

    for (const row of resultCounts) {
      summary.totalAssertions += row.count;
      if (row.result === "pass") summary.passed = row.count;
      else if (row.result === "fail") summary.failed = row.count;
      else if (row.result === "skip") summary.skipped = row.count;
      else if (row.result === "warn") summary.warnings = row.count;
    }

    summary.passRate =
      summary.totalAssertions > 0
        ? summary.passed / summary.totalAssertions
        : 1;

    // Get by category
    const byCategoryRows = await query<ByCategoryRow>(
      `SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped
      FROM assertion_results
      WHERE execution_id = ?
      GROUP BY category`,
      [executionId],
    );

    const byCategory: AssertionSummary["byCategory"] = {};
    for (const row of byCategoryRows) {
      byCategory[row.category as AssertionCategory] = {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        skipped: row.skipped,
      };
    }

    // Get chain stats
    const chainStats = await query<{ overall_result: string; count: number }>(
      `SELECT
        overall_result,
        COUNT(*) as count
      FROM assertion_chains
      WHERE execution_id = ?
      GROUP BY overall_result`,
      [executionId],
    );

    const chains: AssertionSummary["chains"] = {
      total: 0,
      passed: 0,
      failed: 0,
      partial: 0,
    };

    for (const row of chainStats) {
      chains.total += row.count;
      if (row.overall_result === "pass") chains.passed = row.count;
      else if (row.overall_result === "fail") chains.failed = row.count;
      else if (row.overall_result === "partial") chains.partial = row.count;
    }

    // Get failures (limit 20)
    const failures = await query<FailureRow>(
      `SELECT
        id,
        task_id,
        category,
        description,
        evidence,
        transcript_entry_id,
        timestamp
      FROM assertion_results
      WHERE execution_id = ? AND result = 'fail'
      ORDER BY timestamp DESC
      LIMIT 20`,
      [executionId],
    );

    return {
      executionId,
      summary,
      byCategory,
      chains,
      failures: failures.map((f) => ({
        assertionId: f.id,
        taskId: f.task_id,
        category: f.category as AssertionCategory,
        description: f.description,
        evidence: this.parseJson(f.evidence) || {},
        transcriptRef: f.transcript_entry_id,
        timestamp: f.timestamp,
      })),
    };
  }

  /**
   * Get all assertion chains for an execution.
   */
  async getChains(executionId: string): Promise<AssertionChainWithResults[]> {
    const chains = await query<ChainRow>(
      `SELECT
        id,
        task_id,
        execution_id,
        description,
        overall_result,
        pass_count,
        fail_count,
        skip_count,
        first_failure_id,
        started_at,
        completed_at,
        created_at
      FROM assertion_chains
      WHERE execution_id = ?
      ORDER BY started_at ASC`,
      [executionId],
    );

    const results: AssertionChainWithResults[] = [];

    for (const chain of chains) {
      // Get assertions for this chain
      const assertions = await query<AssertionRow>(
        `SELECT
          id,
          task_id,
          execution_id,
          category,
          description,
          result,
          evidence,
          chain_id,
          chain_position,
          timestamp,
          duration_ms,
          transcript_entry_id,
          created_at
        FROM assertion_results
        WHERE chain_id = ?
        ORDER BY chain_position ASC`,
        [chain.id],
      );

      // Get first failure details if exists
      let firstFailure: AssertionChainWithResults["firstFailure"];
      if (chain.first_failure_id) {
        const failure = await this.getAssertion(chain.first_failure_id);
        if (failure) {
          firstFailure = {
            assertionId: failure.id,
            description: failure.description,
            evidence: failure.evidence,
          };
        }
      }

      results.push({
        id: chain.id,
        taskId: chain.task_id,
        executionId: chain.execution_id,
        description: chain.description,
        overallResult: chain.overall_result as AssertionChain["overallResult"],
        passCount: chain.pass_count,
        failCount: chain.fail_count,
        skipCount: chain.skip_count,
        firstFailureId: chain.first_failure_id,
        startedAt: chain.started_at,
        completedAt: chain.completed_at,
        createdAt: chain.created_at,
        assertions: assertions.map((a) => this.mapRow(a)),
        firstFailure,
      });
    }

    return results;
  }

  /**
   * Map database row to AssertionResult.
   */
  private mapRow(row: AssertionRow): AssertionResult {
    return {
      id: row.id,
      taskId: row.task_id,
      executionId: row.execution_id,
      chainId: row.chain_id,
      chainPosition: row.chain_position,
      category: row.category as AssertionCategory,
      description: row.description,
      result: row.result as AssertionResult["result"],
      evidence: this.parseJson(row.evidence) || {},
      timestamp: row.timestamp,
      durationMs: row.duration_ms,
      transcriptEntryId: row.transcript_entry_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Safely parse JSON string.
   */
  private parseJson<T>(json: string | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

// Internal row types
interface AssertionRow {
  id: string;
  task_id: string;
  execution_id: string;
  category: string;
  description: string;
  result: string;
  evidence: string;
  chain_id: string | null;
  chain_position: number | null;
  timestamp: string;
  duration_ms: number | null;
  transcript_entry_id: string | null;
  created_at: string;
}

interface ChainRow {
  id: string;
  task_id: string;
  execution_id: string;
  description: string;
  overall_result: string;
  pass_count: number;
  fail_count: number;
  skip_count: number;
  first_failure_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ByCategoryRow {
  category: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface FailureRow {
  id: string;
  task_id: string;
  category: string;
  description: string;
  evidence: string;
  transcript_entry_id: string | null;
  timestamp: string;
}

// Export singleton instance
export const assertionService = new AssertionService();
