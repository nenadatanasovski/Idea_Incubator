/**
 * OBS-301: Transcript Service
 *
 * Query transcript entries with filtering and pagination.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  TranscriptQuery,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type { TranscriptEntry } from "../../../frontend/src/types/observability/transcript.js";

export class TranscriptService {
  /**
   * Get transcript entries for an execution with filtering.
   */
  async getTranscript(
    executionId: string,
    transcriptQuery: TranscriptQuery = {},
  ): Promise<PaginatedResponse<TranscriptEntry>> {
    const limit = transcriptQuery.limit || 500;
    const offset = transcriptQuery.offset || 0;

    try {
      const conditions: string[] = ["execution_id = ?"];
      const params: (string | number)[] = [executionId];

      // Filter by entry types
      if (transcriptQuery.entryTypes?.length) {
        const placeholders = transcriptQuery.entryTypes
          .map(() => "?")
          .join(",");
        conditions.push(`entry_type IN (${placeholders})`);
        params.push(...transcriptQuery.entryTypes);
      }

      // Filter by categories
      if (transcriptQuery.categories?.length) {
        const placeholders = transcriptQuery.categories
          .map(() => "?")
          .join(",");
        conditions.push(`category IN (${placeholders})`);
        params.push(...transcriptQuery.categories);
      }

      // Filter by task
      if (transcriptQuery.taskId) {
        conditions.push("task_id = ?");
        params.push(transcriptQuery.taskId);
      }

      // Filter by time range
      if (transcriptQuery.fromTimestamp) {
        conditions.push("timestamp >= ?");
        params.push(transcriptQuery.fromTimestamp);
      }

      if (transcriptQuery.toTimestamp) {
        conditions.push("timestamp <= ?");
        params.push(transcriptQuery.toTimestamp);
      }

      // Search in summary
      if (transcriptQuery.search) {
        conditions.push("summary LIKE ?");
        params.push(`%${transcriptQuery.search}%`);
      }

      // Cursor-based pagination
      if (transcriptQuery.cursor) {
        conditions.push("sequence > ?");
        params.push(parseInt(transcriptQuery.cursor, 10));
      }

      const whereClause = conditions.join(" AND ");

      const rows = await query<TranscriptRow>(
        `SELECT
          id,
          timestamp,
          sequence,
          execution_id,
          task_id,
          instance_id,
          wave_number,
          entry_type,
          category,
          summary,
          details,
          skill_ref,
          tool_calls,
          assertions,
          duration_ms,
          token_estimate,
          created_at
        FROM transcript_entries
        WHERE ${whereClause}
        ORDER BY sequence ASC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      // Get total count
      const countResult = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count
        FROM transcript_entries
        WHERE ${whereClause}`,
        params,
      );
      const total = countResult?.count || 0;

      const data = rows.map((row) => this.mapRow(row));
      const hasMore = offset + data.length < total;

      return {
        data,
        total,
        limit,
        offset,
        hasMore,
        nextCursor:
          hasMore && data.length > 0
            ? String(data[data.length - 1].sequence)
            : undefined,
      };
    } catch (error) {
      console.warn("TranscriptService.getTranscript error:", error);
      return { data: [], total: 0, limit, offset, hasMore: false };
    }
  }

  /**
   * Get a single transcript entry by ID.
   */
  async getEntry(entryId: string): Promise<TranscriptEntry | null> {
    try {
      const row = await getOne<TranscriptRow>(
        `SELECT
          id,
          timestamp,
          sequence,
          execution_id,
          task_id,
          instance_id,
          wave_number,
          entry_type,
          category,
          summary,
          details,
          skill_ref,
          tool_calls,
          assertions,
          duration_ms,
          token_estimate,
          created_at
        FROM transcript_entries
        WHERE id = ?`,
        [entryId],
      );

      if (!row) return null;
      return this.mapRow(row);
    } catch (error) {
      console.warn("TranscriptService.getEntry error:", error);
      return null;
    }
  }

  /**
   * Map database row to TranscriptEntry.
   */
  private mapRow(row: TranscriptRow): TranscriptEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sequence: row.sequence,
      executionId: row.execution_id,
      taskId: row.task_id,
      instanceId: row.instance_id,
      waveNumber: row.wave_number,
      entryType: row.entry_type as TranscriptEntry["entryType"],
      category: row.category as TranscriptEntry["category"],
      summary: row.summary,
      details: this.parseJson(row.details),
      skillRef: this.parseJson(row.skill_ref),
      toolCalls: this.parseJson(row.tool_calls),
      assertions: this.parseJson(row.assertions),
      durationMs: row.duration_ms,
      tokenEstimate: row.token_estimate,
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

// Internal row type
interface TranscriptRow {
  id: string;
  timestamp: string;
  sequence: number;
  execution_id: string;
  task_id: string | null;
  instance_id: string;
  wave_number: number | null;
  entry_type: string;
  category: string;
  summary: string;
  details: string | null;
  skill_ref: string | null;
  tool_calls: string | null;
  assertions: string | null;
  duration_ms: number | null;
  token_estimate: number | null;
  created_at: string;
}

// Export singleton instance
export const transcriptService = new TranscriptService();
