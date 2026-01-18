/**
 * OBS-600: Observability Stream Service
 *
 * Manages real-time event streaming for observability data.
 * Acts as an event aggregator and broadcaster.
 */

import { EventEmitter } from "events";
import type {
  ObservabilityEvent,
  TranscriptStreamEvent,
  ToolUseStartEvent,
  ToolUseEndEvent,
  ToolUseOutputEvent,
  AssertionStreamEvent,
  SkillStartEvent,
  SkillEndEvent,
  MessageBusStreamEvent,
  WaveStatusEvent,
  AgentHeartbeatEvent,
  ExecutionStatusEvent,
} from "../../types/observability-websocket.js";
import type {
  TranscriptEntry,
  AssertionResultEntry,
  MessageBusLogEntry,
  ToolName,
  ToolResultStatus,
} from "../../types/observability.js";

/**
 * Observability Stream Service
 *
 * Manages real-time event streaming for observability data.
 * Acts as an event aggregator and broadcaster.
 */
export class ObservabilityStreamService extends EventEmitter {
  private static instance: ObservabilityStreamService;

  // Event buffer for late subscribers (last N events)
  private eventBuffer: Map<string, ObservabilityEvent[]> = new Map();
  private maxBufferSize = 100;

  // Active subscriptions by execution ID
  private subscriptions: Map<string, Set<string>> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent connections
  }

  static getInstance(): ObservabilityStreamService {
    if (!ObservabilityStreamService.instance) {
      ObservabilityStreamService.instance = new ObservabilityStreamService();
    }
    return ObservabilityStreamService.instance;
  }

  /**
   * Reset instance for testing purposes.
   */
  static resetInstance(): void {
    if (ObservabilityStreamService.instance) {
      ObservabilityStreamService.instance.removeAllListeners();
      ObservabilityStreamService.instance.eventBuffer.clear();
      ObservabilityStreamService.instance.subscriptions.clear();
    }
    // Don't clear the instance reference itself to avoid issues
  }

  /**
   * Emit a transcript entry event.
   */
  emitTranscriptEntry(
    executionId: string,
    entry: TranscriptEntry,
    isLatest: boolean = true,
  ): void {
    const event: TranscriptStreamEvent = {
      type: "transcript:entry",
      timestamp: new Date().toISOString(),
      executionId,
      entry,
      isLatest,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit a tool use start event.
   */
  emitToolStart(
    executionId: string,
    toolUseId: string,
    tool: ToolName | string,
    inputSummary: string,
    taskId?: string,
  ): void {
    const event: ToolUseStartEvent = {
      type: "tool:start",
      timestamp: new Date().toISOString(),
      executionId,
      toolUseId,
      tool,
      inputSummary,
      taskId,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit a tool use end event.
   */
  emitToolEnd(
    executionId: string,
    toolUseId: string,
    resultStatus: ToolResultStatus,
    durationMs: number,
    outputSummary?: string,
    isError?: boolean,
    isBlocked?: boolean,
  ): void {
    const event: ToolUseEndEvent = {
      type: "tool:end",
      timestamp: new Date().toISOString(),
      executionId,
      toolUseId,
      resultStatus,
      durationMs,
      outputSummary,
      isError,
      isBlocked,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit streaming tool output (for long-running commands).
   */
  emitToolOutput(
    executionId: string,
    toolUseId: string,
    chunk: string,
    isStderr: boolean = false,
  ): void {
    const event: ToolUseOutputEvent = {
      type: "tool:output",
      timestamp: new Date().toISOString(),
      executionId,
      toolUseId,
      chunk,
      isStderr,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit an assertion result event.
   */
  emitAssertionResult(
    executionId: string,
    taskId: string,
    assertion: AssertionResultEntry,
    runningPassRate: number,
  ): void {
    const event: AssertionStreamEvent = {
      type: "assertion:result",
      timestamp: new Date().toISOString(),
      executionId,
      taskId,
      assertion,
      runningPassRate,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit a skill start event.
   */
  emitSkillStart(
    executionId: string,
    skillTraceId: string,
    skillName: string,
    skillFile: string,
    lineNumber: number,
    taskId?: string,
  ): void {
    const event: SkillStartEvent = {
      type: "skill:start",
      timestamp: new Date().toISOString(),
      executionId,
      skillTraceId,
      skillName,
      skillFile,
      lineNumber,
      taskId,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit a skill end event.
   */
  emitSkillEnd(
    executionId: string,
    skillTraceId: string,
    skillName: string,
    status: "success" | "partial" | "failed",
    durationMs: number,
  ): void {
    const event: SkillEndEvent = {
      type: "skill:end",
      timestamp: new Date().toISOString(),
      executionId,
      skillTraceId,
      skillName,
      status,
      durationMs,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit a message bus event.
   */
  emitMessageBusEvent(
    entry: MessageBusLogEntry,
    requiresAction: boolean = false,
  ): void {
    const event: MessageBusStreamEvent = {
      type: "messagebus:event",
      timestamp: new Date().toISOString(),
      executionId: entry.executionId || "global",
      entry,
      requiresAction,
    };
    this.broadcast(entry.executionId || "global", event);
  }

  /**
   * Emit wave status change.
   */
  emitWaveStatus(
    executionId: string,
    waveNumber: number,
    status: "pending" | "running" | "completed" | "failed",
    taskCount: number,
    completedCount: number,
    failedCount: number,
  ): void {
    const event: WaveStatusEvent = {
      type: "wave:status",
      timestamp: new Date().toISOString(),
      executionId,
      waveNumber,
      status,
      taskCount,
      completedCount,
      failedCount,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit agent heartbeat.
   */
  emitAgentHeartbeat(
    executionId: string,
    instanceId: string,
    status: "idle" | "working" | "blocked" | "error",
    currentTaskId?: string,
    metrics?: Record<string, number>,
  ): void {
    const event: AgentHeartbeatEvent = {
      type: "agent:heartbeat",
      timestamp: new Date().toISOString(),
      executionId,
      instanceId,
      status,
      currentTaskId,
      metrics,
    };
    this.broadcast(executionId, event);
  }

  /**
   * Emit execution status change.
   */
  emitExecutionStatus(
    executionId: string,
    status: "started" | "running" | "paused" | "completed" | "failed",
    message?: string,
  ): void {
    const event: ExecutionStatusEvent = {
      type: "execution:status",
      timestamp: new Date().toISOString(),
      executionId,
      status,
      message,
    };
    this.broadcast(executionId, event);
    this.broadcast("global", event); // Also broadcast to global listeners
  }

  /**
   * Broadcast event to appropriate listeners.
   */
  private broadcast(executionId: string, event: ObservabilityEvent): void {
    // Add to buffer
    this.addToBuffer(executionId, event);

    // Emit to execution-specific listeners
    this.emit(`observability:${executionId}`, event);

    // Emit to global listeners (all executions)
    this.emit("observability:all", event);
  }

  /**
   * Add event to replay buffer.
   */
  private addToBuffer(executionId: string, event: ObservabilityEvent): void {
    if (!this.eventBuffer.has(executionId)) {
      this.eventBuffer.set(executionId, []);
    }

    const buffer = this.eventBuffer.get(executionId)!;
    buffer.push(event);

    // Trim buffer if too large
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
  }

  /**
   * Get buffered events for replay to new subscribers.
   */
  getBufferedEvents(executionId: string): ObservabilityEvent[] {
    return this.eventBuffer.get(executionId) || [];
  }

  /**
   * Clear buffer for an execution (when completed/archived).
   */
  clearBuffer(executionId: string): void {
    this.eventBuffer.delete(executionId);
  }

  /**
   * Get active listener count for an execution.
   */
  getListenerCount(executionId: string): number {
    return this.listenerCount(`observability:${executionId}`);
  }

  /**
   * Get global listener count.
   */
  getGlobalListenerCount(): number {
    return this.listenerCount("observability:all");
  }
}

// Export singleton instance
export const observabilityStream = ObservabilityStreamService.getInstance();
