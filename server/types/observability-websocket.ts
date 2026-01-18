/**
 * OBS-601: WebSocket Event Types for Observability Streaming
 *
 * Type definitions for real-time WebSocket event streaming.
 */

import type {
  TranscriptEntry,
  ToolResultStatus,
  ToolName,
  AssertionResultEntry,
  MessageBusLogEntry,
} from "./observability.js";

// ============================================================================
// BASE EVENT INTERFACE
// ============================================================================

/**
 * Base interface for all observability WebSocket events.
 */
export interface BaseObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
  executionId: string;
}

// ============================================================================
// EVENT TYPE ENUM
// ============================================================================

/**
 * All observability WebSocket event types.
 */
export type ObservabilityEventType =
  // Transcript events
  | "transcript:entry"
  // Tool use events
  | "tool:start"
  | "tool:end"
  | "tool:output"
  // Assertion events
  | "assertion:result"
  // Skill events
  | "skill:start"
  | "skill:end"
  // Message bus events
  | "messagebus:event"
  // Wave/execution events
  | "wave:status"
  | "agent:heartbeat"
  | "execution:status"
  // Connection events
  | "observability:connected"
  | "observability:subscribed"
  | "observability:unsubscribed"
  | "observability:error";

// ============================================================================
// TRANSCRIPT EVENTS
// ============================================================================

/**
 * Transcript entry stream event.
 */
export interface TranscriptStreamEvent extends BaseObservabilityEvent {
  type: "transcript:entry";
  entry: TranscriptEntry;
  isLatest: boolean;
}

// ============================================================================
// TOOL USE EVENTS
// ============================================================================

/**
 * Tool use start event.
 */
export interface ToolUseStartEvent extends BaseObservabilityEvent {
  type: "tool:start";
  toolUseId: string;
  tool: ToolName | string;
  inputSummary: string;
  taskId?: string;
}

/**
 * Tool use end event.
 */
export interface ToolUseEndEvent extends BaseObservabilityEvent {
  type: "tool:end";
  toolUseId: string;
  resultStatus: ToolResultStatus;
  durationMs: number;
  outputSummary?: string;
  isError?: boolean;
  isBlocked?: boolean;
}

/**
 * Tool output streaming event (for long-running commands).
 */
export interface ToolUseOutputEvent extends BaseObservabilityEvent {
  type: "tool:output";
  toolUseId: string;
  chunk: string;
  isStderr: boolean;
}

// ============================================================================
// ASSERTION EVENTS
// ============================================================================

/**
 * Assertion result event.
 */
export interface AssertionStreamEvent extends BaseObservabilityEvent {
  type: "assertion:result";
  taskId: string;
  assertion: AssertionResultEntry;
  runningPassRate: number;
}

// ============================================================================
// SKILL EVENTS
// ============================================================================

/**
 * Skill start event.
 */
export interface SkillStartEvent extends BaseObservabilityEvent {
  type: "skill:start";
  skillTraceId: string;
  skillName: string;
  skillFile: string;
  lineNumber: number;
  taskId?: string;
}

/**
 * Skill end event.
 */
export interface SkillEndEvent extends BaseObservabilityEvent {
  type: "skill:end";
  skillTraceId: string;
  skillName: string;
  status: "success" | "partial" | "failed";
  durationMs: number;
}

// ============================================================================
// MESSAGE BUS EVENTS
// ============================================================================

/**
 * Message bus event forwarded to UI.
 */
export interface MessageBusStreamEvent extends BaseObservabilityEvent {
  type: "messagebus:event";
  entry: MessageBusLogEntry;
  requiresAction: boolean;
}

// ============================================================================
// WAVE/EXECUTION EVENTS
// ============================================================================

/**
 * Wave status change event.
 */
export interface WaveStatusEvent extends BaseObservabilityEvent {
  type: "wave:status";
  waveNumber: number;
  status: "pending" | "running" | "completed" | "failed";
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

/**
 * Agent heartbeat event.
 */
export interface AgentHeartbeatEvent extends BaseObservabilityEvent {
  type: "agent:heartbeat";
  instanceId: string;
  status: "idle" | "working" | "blocked" | "error";
  currentTaskId?: string;
  metrics?: Record<string, number>;
}

/**
 * Execution status change event.
 */
export interface ExecutionStatusEvent extends BaseObservabilityEvent {
  type: "execution:status";
  status: "started" | "running" | "paused" | "completed" | "failed";
  message?: string;
}

// ============================================================================
// CONNECTION EVENTS
// ============================================================================

/**
 * Connection established event.
 */
export interface ObservabilityConnectedEvent {
  type: "observability:connected";
  timestamp: string;
  executionId: string;
  message: string;
  bufferedEventCount: number;
}

/**
 * Subscription confirmation event.
 */
export interface ObservabilitySubscribedEvent {
  type: "observability:subscribed";
  timestamp: string;
  topic: string;
  executionId?: string;
}

/**
 * Unsubscription confirmation event.
 */
export interface ObservabilityUnsubscribedEvent {
  type: "observability:unsubscribed";
  timestamp: string;
  topic: string;
}

/**
 * Error event.
 */
export interface ObservabilityErrorEvent {
  type: "observability:error";
  timestamp: string;
  error: string;
  code: string;
}

// ============================================================================
// UNION TYPE
// ============================================================================

/**
 * Union of all observability WebSocket events.
 */
export type ObservabilityEvent =
  | TranscriptStreamEvent
  | ToolUseStartEvent
  | ToolUseEndEvent
  | ToolUseOutputEvent
  | AssertionStreamEvent
  | SkillStartEvent
  | SkillEndEvent
  | MessageBusStreamEvent
  | WaveStatusEvent
  | AgentHeartbeatEvent
  | ExecutionStatusEvent
  | ObservabilityConnectedEvent
  | ObservabilitySubscribedEvent
  | ObservabilityUnsubscribedEvent
  | ObservabilityErrorEvent;

// ============================================================================
// CLIENT MESSAGE TYPES
// ============================================================================

/**
 * Client subscription request.
 */
export interface SubscriptionRequest {
  action: "subscribe" | "unsubscribe";
  topic: ObservabilityTopic;
  executionId?: string;
  filters?: EventFilters;
}

/**
 * Available subscription topics.
 */
export type ObservabilityTopic =
  | "all" // All events for an execution
  | "transcript" // Only transcript entries
  | "tools" // Only tool use events
  | "assertions" // Only assertion events
  | "skills" // Only skill events
  | "messagebus" // Only message bus events
  | "waves" // Only wave status events
  | "agents" // Only agent heartbeat events
  | "execution"; // Only execution status events

/**
 * Optional event filters.
 */
export interface EventFilters {
  entryTypes?: string[]; // Filter transcript entry types
  tools?: string[]; // Filter specific tools
  categories?: string[]; // Filter assertion categories
  severity?: string[]; // Filter message bus severity
  taskId?: string; // Filter to specific task
}

/**
 * Client ping message.
 */
export interface PingMessage {
  type: "ping";
}

/**
 * Server pong response.
 */
export interface PongMessage {
  type: "pong";
  timestamp: string;
}

/**
 * All client-to-server messages.
 */
export type ClientMessage = SubscriptionRequest | PingMessage;
