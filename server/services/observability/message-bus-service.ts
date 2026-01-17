/**
 * OBS-306: Message Bus Service
 *
 * Query message bus logs and correlated events.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  MessageBusQuery,
  MessageBusSummaryResponse,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type {
  MessageBusLogEntry,
  MessageBusSeverity,
  MessageBusCategory,
  CorrelatedEvents,
} from "../../../frontend/src/types/observability/message-bus.js";

export class MessageBusService {
  /**
   * Get message bus logs with filtering.
   */
  async getLogs(
    busQuery: MessageBusQuery = {},
  ): Promise<PaginatedResponse<MessageBusLogEntry>> {
    const limit = busQuery.limit || 100;
    const offset = busQuery.offset || 0;
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    // Filter by execution
    if (busQuery.executionId) {
      conditions.push("execution_id = ?");
      params.push(busQuery.executionId);
    }

    // Filter by task
    if (busQuery.taskId) {
      conditions.push("task_id = ?");
      params.push(busQuery.taskId);
    }

    // Filter by severity
    if (busQuery.severity?.length) {
      const placeholders = busQuery.severity.map(() => "?").join(",");
      conditions.push(`severity IN (${placeholders})`);
      params.push(...busQuery.severity);
    }

    // Filter by category
    if (busQuery.category?.length) {
      const placeholders = busQuery.category.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...busQuery.category);
    }

    // Filter by source
    if (busQuery.source) {
      conditions.push("source = ?");
      params.push(busQuery.source);
    }

    // Filter by event type
    if (busQuery.eventType) {
      conditions.push("event_type = ?");
      params.push(busQuery.eventType);
    }

    // Filter by correlation ID
    if (busQuery.correlationId) {
      conditions.push("correlation_id = ?");
      params.push(busQuery.correlationId);
    }

    // Time filters
    if (busQuery.fromTimestamp) {
      conditions.push("timestamp >= ?");
      params.push(busQuery.fromTimestamp);
    }

    if (busQuery.toTimestamp) {
      conditions.push("timestamp <= ?");
      params.push(busQuery.toTimestamp);
    }

    const whereClause = conditions.join(" AND ");

    const rows = await query<MessageBusRow>(
      `SELECT
        id,
        event_id,
        timestamp,
        source,
        event_type,
        correlation_id,
        human_summary,
        severity,
        category,
        transcript_entry_id,
        task_id,
        execution_id,
        payload,
        created_at
      FROM message_bus_log
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Get total count
    const countResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM message_bus_log
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
   * Get correlated events by correlation ID.
   */
  async getCorrelatedEvents(
    correlationId: string,
  ): Promise<CorrelatedEvents | null> {
    const rows = await query<MessageBusRow>(
      `SELECT
        id,
        event_id,
        timestamp,
        source,
        event_type,
        correlation_id,
        human_summary,
        severity,
        category,
        transcript_entry_id,
        task_id,
        execution_id,
        payload,
        created_at
      FROM message_bus_log
      WHERE correlation_id = ?
      ORDER BY timestamp ASC`,
      [correlationId],
    );

    if (rows.length === 0) return null;

    const events = rows.map((row) => this.mapRow(row));
    const sources = Array.from(new Set(events.map((e) => e.source)));

    const firstTimestamp = events[0].timestamp;
    const lastTimestamp = events[events.length - 1].timestamp;
    const durationMs =
      new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

    // Generate summary from first event
    const summary = events[0].humanSummary;

    return {
      correlationId,
      events,
      timeline: {
        first: firstTimestamp,
        last: lastTimestamp,
        durationMs,
      },
      sources,
      summary,
    };
  }

  /**
   * Get message bus summary for an execution.
   */
  async getSummary(executionId?: string): Promise<MessageBusSummaryResponse> {
    const baseCondition = executionId ? "WHERE execution_id = ?" : "WHERE 1=1";
    const params = executionId ? [executionId] : [];

    // Get total
    const total = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM message_bus_log ${baseCondition}`,
      params,
    );

    // Get by severity
    const bySeverityRows = await query<{ severity: string; count: number }>(
      `SELECT severity, COUNT(*) as count
      FROM message_bus_log
      ${baseCondition}
      GROUP BY severity`,
      params,
    );

    const bySeverity: Record<MessageBusSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    for (const row of bySeverityRows) {
      if (row.severity in bySeverity) {
        bySeverity[row.severity as MessageBusSeverity] = row.count;
      }
    }

    // Get by category
    const byCategoryRows = await query<{ category: string; count: number }>(
      `SELECT category, COUNT(*) as count
      FROM message_bus_log
      ${baseCondition}
      GROUP BY category`,
      params,
    );

    const byCategory: Record<MessageBusCategory, number> = {
      lifecycle: 0,
      coordination: 0,
      failure: 0,
      decision: 0,
    };

    for (const row of byCategoryRows) {
      if (row.category in byCategory) {
        byCategory[row.category as MessageBusCategory] = row.count;
      }
    }

    // Get by source
    const bySourceRows = await query<{ source: string; count: number }>(
      `SELECT source, COUNT(*) as count
      FROM message_bus_log
      ${baseCondition}
      GROUP BY source`,
      params,
    );

    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.source] = row.count;
    }

    // Get recent critical
    const recentCritical = await query<MessageBusRow>(
      `SELECT
        id, event_id, timestamp, source, event_type, correlation_id,
        human_summary, severity, category, transcript_entry_id,
        task_id, execution_id, payload, created_at
      FROM message_bus_log
      ${baseCondition} ${executionId ? "AND" : "WHERE"} severity = 'critical'
      ORDER BY timestamp DESC
      LIMIT 10`,
      params,
    );

    // Get recent errors
    const recentErrors = await query<MessageBusRow>(
      `SELECT
        id, event_id, timestamp, source, event_type, correlation_id,
        human_summary, severity, category, transcript_entry_id,
        task_id, execution_id, payload, created_at
      FROM message_bus_log
      ${baseCondition} ${executionId ? "AND" : "WHERE"} severity = 'error'
      ORDER BY timestamp DESC
      LIMIT 10`,
      params,
    );

    return {
      executionId,
      total: total?.count || 0,
      bySeverity,
      byCategory,
      bySource,
      recentCritical: recentCritical.map((row) => this.mapRow(row)),
      recentErrors: recentErrors.map((row) => this.mapRow(row)),
    };
  }

  /**
   * Map database row to MessageBusLogEntry.
   */
  private mapRow(row: MessageBusRow): MessageBusLogEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      timestamp: row.timestamp,
      source: row.source,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      humanSummary: row.human_summary,
      severity: row.severity as MessageBusSeverity,
      category: row.category as MessageBusCategory,
      transcriptEntryId: row.transcript_entry_id,
      taskId: row.task_id,
      executionId: row.execution_id,
      payload: this.parseJson(row.payload),
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
interface MessageBusRow {
  id: string;
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
  correlation_id: string | null;
  human_summary: string;
  severity: string;
  category: string;
  transcript_entry_id: string | null;
  task_id: string | null;
  execution_id: string | null;
  payload: string | null;
  created_at: string;
}

// Export singleton instance
export const messageBusService = new MessageBusService();
