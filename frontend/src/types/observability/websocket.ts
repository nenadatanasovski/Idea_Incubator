/**
 * OBS-206: WebSocket Event Types
 *
 * Real-time streaming event types for observability UI.
 */

import type { TranscriptEntry } from "./transcript";
import type { ToolResultStatus, ToolName } from "./tool-use";
import type { AssertionResult } from "./assertion";
import type { MessageBusLogEntry } from "./message-bus";
import type { SkillStatus } from "./skill";

// =============================================================================
// EVENT TYPE ENUM
// =============================================================================

/**
 * WebSocket event types for observability streaming.
 */
export type ObservabilityEventType =
  | "transcript:entry" // New transcript entry
  | "tooluse:start" // Tool invocation started
  | "tooluse:end" // Tool invocation completed
  | "tooluse:output" // Tool output streaming
  | "assertion:result" // Assertion completed
  | "skill:start" // Skill invocation started
  | "skill:end" // Skill invocation completed
  | "messagebus:event" // Message bus event
  | "execution:start" // Execution started
  | "execution:complete" // Execution completed
  | "wave:start" // Execution wave started
  | "wave:complete"; // Execution wave completed

// =============================================================================
// BASE EVENT
// =============================================================================

/**
 * Base interface for all observability events.
 */
export interface BaseObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
  executionId: string;
}

// =============================================================================
// TRANSCRIPT EVENTS
// =============================================================================

/**
 * Transcript entry stream event.
 */
export interface TranscriptEntryEvent extends BaseObservabilityEvent {
  type: "transcript:entry";
  entry: TranscriptEntry;
  isLatest: boolean; // For live scroll-to-bottom
}

/**
 * Alias for TranscriptEntryEvent.
 */
export interface TranscriptEvent extends BaseObservabilityEvent {
  type: "transcript:entry";
  entry: TranscriptEntry;
  isLatest?: boolean;
}

// =============================================================================
// TOOL USE EVENTS
// =============================================================================

/**
 * Tool use start event.
 */
export interface ToolUseStartEvent extends BaseObservabilityEvent {
  type: "tooluse:start";
  toolUseId: string;
  tool: ToolName;
  inputSummary: string;
  taskId?: string;
}

/**
 * Tool use end event.
 */
export interface ToolUseEndEvent extends BaseObservabilityEvent {
  type: "tooluse:end";
  toolUseId: string;
  resultStatus: ToolResultStatus;
  durationMs: number;
  outputSummary?: string;
  isError: boolean;
  isBlocked: boolean;
}

/**
 * Tool output streaming event (for long-running commands).
 */
export interface ToolUseOutputEvent extends BaseObservabilityEvent {
  type: "tooluse:output";
  toolUseId: string;
  chunk: string;
  isStderr: boolean;
  isFinal: boolean;
}

/**
 * Generic tool use event (alias).
 */
export interface ToolUseEvent extends BaseObservabilityEvent {
  toolUseId: string;
  tool?: ToolName;
  resultStatus?: ToolResultStatus;
}

// =============================================================================
// ASSERTION EVENTS
// =============================================================================

/**
 * Assertion result event.
 */
export interface AssertionResultEvent extends BaseObservabilityEvent {
  type: "assertion:result";
  taskId: string;
  assertion: AssertionResult;
  runningPassRate: number; // Update sparkline in real-time
  chainId?: string;
  chainPosition?: number;
}

/**
 * Alias for AssertionResultEvent.
 */
export interface AssertionEvent extends BaseObservabilityEvent {
  type: "assertion:result";
  taskId: string;
  assertion: AssertionResult;
  runningPassRate?: number;
}

// =============================================================================
// SKILL EVENTS
// =============================================================================

/**
 * Skill start event.
 */
export interface SkillStartEvent extends BaseObservabilityEvent {
  type: "skill:start";
  skillTraceId: string;
  skillName: string;
  skillFile: string;
  lineNumber?: number;
  taskId: string;
}

/**
 * Skill end event.
 */
export interface SkillEndEvent extends BaseObservabilityEvent {
  type: "skill:end";
  skillTraceId: string;
  skillName: string;
  status: SkillStatus;
  durationMs: number;
  errorMessage?: string;
}

// =============================================================================
// MESSAGE BUS EVENTS
// =============================================================================

/**
 * Message bus event forwarded to UI.
 */
export interface MessageBusEvent extends BaseObservabilityEvent {
  type: "messagebus:event";
  entry: MessageBusLogEntry;
  requiresAction: boolean; // Highlight if needs attention
}

// =============================================================================
// EXECUTION EVENTS
// =============================================================================

/**
 * Execution start event.
 */
export interface ExecutionStartEvent extends BaseObservabilityEvent {
  type: "execution:start";
  taskListId: string;
  taskCount: number;
  waveCount: number;
}

/**
 * Execution complete event.
 */
export interface ExecutionCompleteEvent extends BaseObservabilityEvent {
  type: "execution:complete";
  status: "completed" | "failed" | "cancelled";
  completedCount: number;
  failedCount: number;
  durationMs: number;
}

// =============================================================================
// WAVE EVENTS
// =============================================================================

/**
 * Wave start event.
 */
export interface WaveStartEvent extends BaseObservabilityEvent {
  type: "wave:start";
  waveNumber: number;
  taskIds: string[];
  agentCount: number;
}

/**
 * Wave complete event.
 */
export interface WaveCompleteEvent extends BaseObservabilityEvent {
  type: "wave:complete";
  waveNumber: number;
  completedTasks: number;
  failedTasks: number;
  durationMs: number;
}

// =============================================================================
// EVENT UNION
// =============================================================================

/**
 * Base ObservabilityEvent interface (for type checking).
 */
export interface ObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
  executionId: string;
  taskId?: string;
  data?: unknown;
}

/**
 * Union of all specific observability events.
 */
export type ObservabilityEventUnion =
  | TranscriptEntryEvent
  | ToolUseStartEvent
  | ToolUseEndEvent
  | ToolUseOutputEvent
  | AssertionResultEvent
  | SkillStartEvent
  | SkillEndEvent
  | MessageBusEvent
  | ExecutionStartEvent
  | ExecutionCompleteEvent
  | WaveStartEvent
  | WaveCompleteEvent;

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

/**
 * WebSocket subscription request.
 */
export interface ObservabilitySubscription {
  topic: string; // e.g., 'transcript:*', 'tooluse:exec-123'
  action: "subscribe" | "unsubscribe";
}

/**
 * WebSocket connection state.
 */
export interface ObservabilityConnectionState {
  isConnected: boolean;
  executionId?: string;
  subscriptions: string[];
  lastEventTime?: string;
  reconnectAttempts: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for transcript entry events.
 */
export function isTranscriptEntryEvent(
  event: ObservabilityEvent,
): event is TranscriptEntryEvent {
  return event.type === "transcript:entry";
}

/**
 * Type guard for tool use events.
 */
export function isToolUseEvent(
  event: ObservabilityEvent,
): event is ToolUseStartEvent | ToolUseEndEvent | ToolUseOutputEvent {
  return event.type.startsWith("tooluse:");
}

/**
 * Type guard for assertion events.
 */
export function isAssertionEvent(
  event: ObservabilityEvent,
): event is AssertionResultEvent {
  return event.type === "assertion:result";
}

/**
 * Type guard for skill events.
 */
export function isSkillEvent(
  event: ObservabilityEvent,
): event is SkillStartEvent | SkillEndEvent {
  return event.type.startsWith("skill:");
}

/**
 * Type guard for message bus events.
 */
export function isMessageBusEvent(
  event: ObservabilityEvent,
): event is MessageBusEvent {
  return event.type === "messagebus:event";
}

/**
 * Type guard for execution events.
 */
export function isExecutionEvent(
  event: ObservabilityEvent,
): event is ExecutionStartEvent | ExecutionCompleteEvent {
  return event.type.startsWith("execution:");
}

/**
 * Type guard for wave events.
 */
export function isWaveEvent(
  event: ObservabilityEvent,
): event is WaveStartEvent | WaveCompleteEvent {
  return event.type.startsWith("wave:");
}
