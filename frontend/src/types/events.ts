/**
 * Platform Events Types
 * Type definitions for the All Events viewer
 */

export type EventSource =
  | "task-agent"
  | "pipeline"
  | "api"
  | "system"
  | "ideation"
  | "build-agent"
  | "websocket"
  | "telegram"
  | "monitoring";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface PlatformEvent {
  id: string;
  timestamp: string;
  source: EventSource;
  eventType: string;
  correlationId: string | null;
  payload: Record<string, unknown> | null;
  taskId: string | null;
  executionId: string | null;
  projectId: string | null;
  ideaId: string | null;
  sessionId: string | null;
  userId: string | null;
  severity: EventSeverity;
  createdAt: string;
  // Joined fields
  taskTitle?: string;
  projectName?: string;
}

export interface EventFilters {
  source?: EventSource[];
  eventType?: string[];
  severity?: EventSeverity[];
  projectId?: string;
  taskId?: string;
  executionId?: string;
  ideaId?: string;
  sessionId?: string;
  userId?: string;
  correlationId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  search?: string;
}

export interface PaginatedEvents {
  data: PlatformEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EventStats {
  total: number;
  bySource: Record<string, number>;
  bySeverity: Record<EventSeverity, number>;
  byType: Array<{ eventType: string; count: number }>;
  recentErrors: PlatformEvent[];
  hourlyBreakdown: Array<{ hour: string; count: number; errorCount: number }>;
}

export interface PlatformEventStreamEvent {
  type: "platform:event";
  timestamp: string;
  event: PlatformEvent;
}

// WebSocket message types
export interface EventsConnectedMessage {
  type: "events:connected";
  timestamp: string;
  data: {
    message: string;
    clientCount: number;
    bufferedCount: number;
  };
}

export type EventsWebSocketMessage =
  | EventsConnectedMessage
  | PlatformEventStreamEvent;
