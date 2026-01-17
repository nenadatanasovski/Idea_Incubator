/**
 * OBS-205: Message Bus Types
 *
 * Types for tracking inter-agent communication via the message bus.
 */

// =============================================================================
// MESSAGE BUS ENUMS
// =============================================================================

/**
 * Severity levels for message bus entries.
 */
export type MessageBusSeverity = "info" | "warning" | "error" | "critical";

/**
 * Categories for message bus events.
 */
export type MessageBusCategory =
  | "lifecycle" // Agent lifecycle events
  | "coordination" // File locks, wave assignments
  | "failure" // Errors, rollbacks
  | "decision"; // Agent decisions, handoffs

// =============================================================================
// MESSAGE BUS LOG ENTRY
// =============================================================================

/**
 * Human-readable log entry from Message Bus.
 * Matches the database schema for obs_message_bus_logs.
 */
export interface MessageBusLogEntry {
  // === IDENTITY ===
  id: string;
  eventId: string; // Original message bus event ID
  timestamp: string;

  // === SOURCE ===
  source: string; // Agent or system that emitted
  eventType: string; // Original event type
  correlationId: string | null; // For related events

  // === HUMAN-READABLE ===
  humanSummary: string; // Plain English description (primary display field)
  severity: MessageBusSeverity;
  category: MessageBusCategory;

  // === LINKS ===
  transcriptEntryId: string | null; // Link to transcript entry
  taskId: string | null;
  executionId: string | null;

  // === PAYLOAD ===
  payload: Record<string, unknown> | null; // Filtered for readability

  // === METADATA ===
  createdAt: string;
}

/**
 * Input for creating a message bus log entry.
 */
export interface MessageBusLogInput {
  eventId: string;
  source: string;
  eventType: string;
  humanSummary: string;
  severity: MessageBusSeverity;
  category: MessageBusCategory;
  correlationId?: string;
  transcriptEntryId?: string;
  taskId?: string;
  executionId?: string;
  payload?: Record<string, unknown>;
}

// =============================================================================
// QUERY/FILTER TYPES
// =============================================================================

/**
 * Query parameters for message bus endpoint.
 */
export interface MessageBusQuery {
  executionId?: string;
  taskId?: string;
  severity?: MessageBusSeverity[];
  category?: MessageBusCategory[];
  source?: string;
  eventType?: string;
  correlationId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Summary of message bus activity.
 */
export interface MessageBusSummary {
  executionId?: string;
  total: number;

  bySeverity: Record<MessageBusSeverity, number>;
  byCategory: Record<MessageBusCategory, number>;
  bySource: Record<string, number>;

  recentCritical: MessageBusLogEntry[];
  recentErrors: MessageBusLogEntry[];
}

// =============================================================================
// CORRELATION
// =============================================================================

/**
 * Correlated events grouped by correlation ID.
 */
export interface CorrelatedEvents {
  correlationId: string;
  events: MessageBusLogEntry[];
  timeline: {
    first: string;
    last: string;
    durationMs: number;
  };
  sources: string[];
  summary: string;
}
