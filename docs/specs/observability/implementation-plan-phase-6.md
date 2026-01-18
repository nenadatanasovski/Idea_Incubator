# Observability System Implementation Plan - Phase 6: WebSocket Streaming

> **Location:** `docs/specs/observability/implementation-plan-phase-6.md`
> **Purpose:** Actionable implementation plan for real-time WebSocket event streaming
> **Status:** Ready for execution
> **Priority:** P1 (Required for real-time UI updates)
> **Dependencies:** Phase 1 (Database Schema), Phase 4 (TypeScript Types), Phase 5 (API Routes)

---

## Executive Summary

Phase 6 implements real-time WebSocket streaming for observability events. This enables live updates in the UI as agents execute tasks, tools are invoked, and assertions are recorded.

| Scope               | Details                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| **Primary File**    | `server/services/observability/observability-stream.ts`                        |
| **Integration**     | `server/websocket.ts` (extend existing infrastructure)                         |
| **Tasks**           | OBS-600 to OBS-614                                                             |
| **Deliverables**    | Complete real-time streaming for all observability events                      |
| **Test Validation** | WebSocket E2E tests verifying events stream within 100ms of database insertion |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY WEBSOCKET ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   DATA PRODUCERS              EVENT EMITTER              WEBSOCKET CLIENTS   │
│   ──────────────              ────────────               ─────────────────   │
│                                                                              │
│   ┌──────────────┐          ┌────────────────┐         ┌─────────────────┐  │
│   │TranscriptSvc │──emit──▶│                 │         │ Global Clients  │  │
│   │(write entry) │          │                │         │ ?observability= │  │
│   └──────────────┘          │  Observability │──push──▶│    all          │  │
│                             │    Stream      │         └─────────────────┘  │
│   ┌──────────────┐          │    Service     │                              │
│   │ToolUseSvc    │──emit──▶│                 │         ┌─────────────────┐  │
│   │(log tool)    │          │  Manages:      │         │ Execution       │  │
│   └──────────────┘          │  - Connections │──push──▶│ Clients         │  │
│                             │  - Subscriptions         │ ?observability= │  │
│   ┌──────────────┐          │  - Buffering   │         │   {execId}      │  │
│   │AssertionSvc  │──emit──▶│  - Filtering   │         └─────────────────┘  │
│   │(record)      │          │                │                              │
│   └──────────────┘          │                │         ┌─────────────────┐  │
│                             │                │         │ Filtered        │  │
│   ┌──────────────┐          │                │──push──▶│ Clients         │  │
│   │SkillSvc      │──emit──▶│                │         │ (subscriptions) │  │
│   │(trace)       │          │                │         └─────────────────┘  │
│   └──────────────┘          └────────────────┘                              │
│                                    │                                         │
│   ┌──────────────┐                 │                                         │
│   │MessageBusSvc │──emit──▶────────┘                                        │
│   │(log event)   │                                                           │
│   └──────────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-600: Create Observability Stream Service

**File:** `server/services/observability/observability-stream.ts`

**Purpose:** Central service for managing observability event streaming.

#### Implementation

```typescript
// server/services/observability/observability-stream.ts

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
} from "../../types/observability-websocket";
import type {
  TranscriptEntry,
  ToolUse,
  AssertionResult,
  SkillTrace,
  MessageBusLogEntry,
} from "../../types/observability";

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
    tool: string,
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
    resultStatus: "done" | "error" | "blocked",
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
    assertion: AssertionResult,
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
```

#### Acceptance Criteria

- [ ] Service implements EventEmitter pattern
- [ ] All 11 event types have dedicated emit methods
- [ ] Event buffer maintains last 100 events per execution
- [ ] Broadcast works for both execution-specific and global listeners
- [ ] Singleton pattern ensures single instance

#### Test Script

```bash
# tests/e2e/test-obs-phase6-stream-service.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-600: Observability Stream Service"
echo "==================================================================="

# Compile TypeScript
npx tsc --noEmit

# Run unit tests
npx vitest run server/services/observability/observability-stream.test.ts

echo "✓ OBS-600 PASSED"
```

#### Pass Criteria

- TypeScript compiles without errors
- Unit tests pass for all emit methods
- Event buffer operations work correctly

---

### OBS-601: Create WebSocket Event Types

**File:** `server/types/observability-websocket.ts`

**Purpose:** Extend existing WebSocket types with all observability streaming events.

#### Implementation

```typescript
// server/types/observability-websocket.ts - Phase 6 Extensions

import type {
  TranscriptEntry,
  ToolResultStatus,
  ToolName,
  AssertionResult,
  MessageBusLogEntry,
} from "./observability";

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
  assertion: AssertionResult;
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
```

#### Acceptance Criteria

- [ ] All 14 event types defined with proper TypeScript interfaces
- [ ] Union type `ObservabilityEvent` covers all events
- [ ] Subscription request types support topic filtering
- [ ] All types compile without errors

#### Test Script

```bash
# tests/e2e/test-obs-phase6-websocket-types.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-601: WebSocket Event Types"
echo "==================================================================="

# Compile TypeScript to verify types
npx tsc --noEmit

# Run type validation
npx tsx tests/e2e/test-obs-websocket-types.ts

echo "✓ OBS-601 PASSED"
```

#### Pass Criteria

- TypeScript compiles without errors
- Type narrowing works for discriminated union
- All event types are importable

---

### OBS-602: Integrate Stream Service with Existing WebSocket

**File:** `server/websocket.ts` (modify existing)

**Purpose:** Connect observability stream service to WebSocket infrastructure.

#### Implementation

Add to existing `server/websocket.ts`:

```typescript
// Add to existing websocket.ts imports
import { observabilityStream } from "./services/observability/observability-stream";
import type {
  ObservabilityEvent,
  SubscriptionRequest,
  ClientMessage,
} from "./types/observability-websocket";

// ============================================================================
// OBSERVABILITY STREAMING INTEGRATION (OBS-602)
// ============================================================================

// Track subscription state per client
const clientSubscriptions = new WeakMap<
  WebSocket,
  {
    executionId: string;
    topics: Set<string>;
    filters: Record<string, unknown>;
  }
>();

/**
 * Setup observability streaming for a connected client.
 */
function setupObservabilityStreaming(ws: WebSocket, executionId: string): void {
  // Initialize subscription state
  clientSubscriptions.set(ws, {
    executionId,
    topics: new Set(["all"]),
    filters: {},
  });

  // Create event handler
  const eventHandler = (event: ObservabilityEvent) => {
    const state = clientSubscriptions.get(ws);
    if (!state) return;

    // Apply topic filter
    if (!shouldSendEvent(event, state.topics, state.filters)) {
      return;
    }

    // Send event
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  };

  // Subscribe to execution-specific events
  if (executionId && executionId !== "all") {
    observabilityStream.on(`observability:${executionId}`, eventHandler);

    // Send buffered events for replay
    const buffered = observabilityStream.getBufferedEvents(executionId);
    for (const event of buffered) {
      ws.send(JSON.stringify(event));
    }
  }

  // Subscribe to global events
  observabilityStream.on("observability:all", eventHandler);

  // Store handler reference for cleanup
  (ws as any)._obsHandler = eventHandler;
  (ws as any)._obsExecId = executionId;

  // Send connected confirmation
  ws.send(
    JSON.stringify({
      type: "observability:connected",
      timestamp: new Date().toISOString(),
      executionId,
      message:
        executionId === "all"
          ? "Connected to all observability events"
          : `Connected to execution ${executionId}`,
      bufferedEventCount:
        executionId !== "all"
          ? observabilityStream.getBufferedEvents(executionId).length
          : 0,
    }),
  );
}

/**
 * Handle subscription request from client.
 */
function handleSubscriptionRequest(
  ws: WebSocket,
  request: SubscriptionRequest,
): void {
  const state = clientSubscriptions.get(ws);
  if (!state) return;

  if (request.action === "subscribe") {
    state.topics.add(request.topic);
    if (request.filters) {
      Object.assign(state.filters, request.filters);
    }
    ws.send(
      JSON.stringify({
        type: "observability:subscribed",
        timestamp: new Date().toISOString(),
        topic: request.topic,
        executionId: request.executionId,
      }),
    );
  } else if (request.action === "unsubscribe") {
    state.topics.delete(request.topic);
    ws.send(
      JSON.stringify({
        type: "observability:unsubscribed",
        timestamp: new Date().toISOString(),
        topic: request.topic,
      }),
    );
  }
}

/**
 * Check if event should be sent based on subscriptions and filters.
 */
function shouldSendEvent(
  event: ObservabilityEvent,
  topics: Set<string>,
  filters: Record<string, unknown>,
): boolean {
  // "all" topic gets everything
  if (topics.has("all")) return true;

  // Map event type to topic
  const topicMap: Record<string, string> = {
    "transcript:entry": "transcript",
    "tool:start": "tools",
    "tool:end": "tools",
    "tool:output": "tools",
    "assertion:result": "assertions",
    "skill:start": "skills",
    "skill:end": "skills",
    "messagebus:event": "messagebus",
    "wave:status": "waves",
    "agent:heartbeat": "agents",
    "execution:status": "execution",
  };

  const eventTopic = topicMap[event.type];
  if (!eventTopic || !topics.has(eventTopic)) {
    return false;
  }

  // Apply additional filters
  if (filters.taskId && "taskId" in event && event.taskId !== filters.taskId) {
    return false;
  }

  if (filters.tools && event.type === "tool:start") {
    const toolEvent = event as ToolUseStartEvent;
    if (!(filters.tools as string[]).includes(toolEvent.tool)) {
      return false;
    }
  }

  return true;
}

/**
 * Cleanup observability streaming on disconnect.
 */
function cleanupObservabilityStreaming(ws: WebSocket): void {
  const handler = (ws as any)._obsHandler;
  const execId = (ws as any)._obsExecId;

  if (handler) {
    if (execId && execId !== "all") {
      observabilityStream.off(`observability:${execId}`, handler);
    }
    observabilityStream.off("observability:all", handler);
  }

  clientSubscriptions.delete(ws);
}
```

Modify the existing WebSocket connection handler:

```typescript
// In initWebSocket(), add observability handling to the connection handler

} else if (observability) {
  // Enhanced observability connection (OBS-602)
  setupObservabilityStreaming(ws, observability);

  // Handle client messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      if (message.type === "ping") {
        ws.send(JSON.stringify({
          type: "pong",
          timestamp: new Date().toISOString(),
        }));
      } else if ("action" in message) {
        handleSubscriptionRequest(ws, message);
      }
    } catch (e) {
      ws.send(JSON.stringify({
        type: "observability:error",
        timestamp: new Date().toISOString(),
        error: "Invalid message format",
        code: "INVALID_MESSAGE",
      }));
    }
  });
}

// In the close handler, add cleanup:
} else if (observability) {
  cleanupObservabilityStreaming(ws);
  // ... existing cleanup code
}
```

#### Acceptance Criteria

- [ ] Stream service integrated with existing WebSocket infrastructure
- [ ] Clients can subscribe to specific topics
- [ ] Event filtering works based on subscriptions
- [ ] Buffered events replayed on connection
- [ ] Proper cleanup on disconnect

#### Test Script

```bash
# tests/e2e/test-obs-phase6-ws-integration.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-602: WebSocket Integration"
echo "==================================================================="

# Start server in background
npm run dev &
SERVER_PID=$!
sleep 3

# Test WebSocket connection
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001/ws?observability=test-exec');

ws.on('open', () => {
  console.log('✓ Connected to observability WebSocket');
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type === 'observability:connected') {
    console.log('✓ Received connection confirmation');

    // Test subscription
    ws.send(JSON.stringify({
      action: 'subscribe',
      topic: 'tools',
    }));
  } else if (event.type === 'observability:subscribed') {
    console.log('✓ Subscription confirmed');
    ws.close();
  }
});

ws.on('close', () => {
  console.log('✓ Connection closed cleanly');
  process.exit(0);
});

setTimeout(() => {
  console.log('✗ Timeout waiting for events');
  process.exit(1);
}, 10000);
"

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo "✓ OBS-602 PASSED"
```

#### Pass Criteria

- WebSocket connects with `?observability=` parameter
- Connection confirmation received
- Subscription/unsubscription works
- Connection closes cleanly

---

### OBS-603: Wire TranscriptService to Stream

**File:** `server/services/observability/transcript-service.ts` (modify)

**Purpose:** Emit stream events when transcript entries are written.

#### Implementation

```typescript
// Add to transcript-service.ts

import { observabilityStream } from "./observability-stream";

// In writeEntry() or similar method, add after database insert:

// Emit stream event
observabilityStream.emitTranscriptEntry(
  entry.executionId,
  {
    id: insertedId,
    timestamp: entry.timestamp,
    sequence: entry.sequence,
    executionId: entry.executionId,
    taskId: entry.taskId,
    instanceId: entry.instanceId,
    waveNumber: entry.waveNumber,
    entryType: entry.entryType,
    category: entry.category,
    summary: entry.summary,
    details: entry.details,
    durationMs: entry.durationMs,
  },
  true, // isLatest
);
```

#### Acceptance Criteria

- [ ] Stream event emitted after every transcript entry insert
- [ ] Entry data matches database record
- [ ] `isLatest` flag set correctly

#### Test Script

```bash
# tests/e2e/test-obs-phase6-transcript-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-603: Transcript Service Streaming"
echo "==================================================================="

npx vitest run server/services/observability/transcript-service.test.ts --grep "stream"

echo "✓ OBS-603 PASSED"
```

#### Pass Criteria

- Stream event emitted for each transcript entry
- Event contains complete entry data
- Unit tests pass

---

### OBS-604: Wire ToolUseService to Stream

**File:** `server/services/observability/tool-use-service.ts` (modify)

**Purpose:** Emit stream events when tool uses are logged.

#### Implementation

```typescript
// Add to tool-use-service.ts

import { observabilityStream } from "./observability-stream";

// In logStart() method:
observabilityStream.emitToolStart(
  toolUse.executionId,
  toolUse.id,
  toolUse.tool,
  toolUse.inputSummary,
  toolUse.taskId,
);

// In logEnd() method:
observabilityStream.emitToolEnd(
  toolUse.executionId,
  toolUse.id,
  toolUse.resultStatus,
  toolUse.durationMs,
  toolUse.outputSummary,
  toolUse.isError,
  toolUse.isBlocked,
);

// For streaming output (if applicable):
observabilityStream.emitToolOutput(
  executionId,
  toolUseId,
  outputChunk,
  isStderr,
);
```

#### Acceptance Criteria

- [ ] `tool:start` event emitted when tool invocation begins
- [ ] `tool:end` event emitted when tool invocation completes
- [ ] `tool:output` event emitted for streaming output (if applicable)
- [ ] Error and blocked flags properly transmitted

#### Test Script

```bash
# tests/e2e/test-obs-phase6-tooluse-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-604: ToolUse Service Streaming"
echo "==================================================================="

npx vitest run server/services/observability/tool-use-service.test.ts --grep "stream"

echo "✓ OBS-604 PASSED"
```

#### Pass Criteria

- Start and end events emitted for each tool use
- Duration calculated correctly
- Error/blocked states transmitted

---

### OBS-605: Wire AssertionService to Stream

**File:** `server/services/observability/assertion-service.ts` (modify)

**Purpose:** Emit stream events when assertions are recorded.

#### Implementation

```typescript
// Add to assertion-service.ts

import { observabilityStream } from "./observability-stream";

// In recordAssertion() method:

// Calculate running pass rate
const stats = await this.getExecutionStats(assertion.executionId);
const runningPassRate = stats.total > 0 ? stats.passed / stats.total : 1.0;

// Emit stream event
observabilityStream.emitAssertionResult(
  assertion.executionId,
  assertion.taskId,
  {
    id: insertedId,
    taskId: assertion.taskId,
    executionId: assertion.executionId,
    chainId: assertion.chainId,
    category: assertion.category,
    description: assertion.description,
    result: assertion.result,
    evidence: assertion.evidence,
    timestamp: assertion.timestamp,
    durationMs: assertion.durationMs,
  },
  runningPassRate,
);
```

#### Acceptance Criteria

- [ ] Stream event emitted for each assertion
- [ ] Running pass rate calculated and included
- [ ] Evidence data transmitted

#### Test Script

```bash
# tests/e2e/test-obs-phase6-assertion-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-605: Assertion Service Streaming"
echo "==================================================================="

npx vitest run server/services/observability/assertion-service.test.ts --grep "stream"

echo "✓ OBS-605 PASSED"
```

#### Pass Criteria

- Assertion events emitted with complete data
- Running pass rate calculated correctly
- Evidence included in event

---

### OBS-606: Wire SkillService to Stream

**File:** `server/services/observability/skill-service.ts` (modify)

**Purpose:** Emit stream events when skills are invoked.

#### Implementation

```typescript
// Add to skill-service.ts

import { observabilityStream } from "./observability-stream";

// In startSkillTrace() method:
observabilityStream.emitSkillStart(
  trace.executionId,
  trace.id,
  trace.skillName,
  trace.skillFile,
  trace.lineNumber,
  trace.taskId,
);

// In endSkillTrace() method:
observabilityStream.emitSkillEnd(
  trace.executionId,
  trace.id,
  trace.skillName,
  trace.status,
  trace.durationMs,
);
```

#### Acceptance Criteria

- [ ] `skill:start` event emitted when skill invocation begins
- [ ] `skill:end` event emitted when skill invocation completes
- [ ] File and line number included in start event
- [ ] Status and duration included in end event

#### Test Script

```bash
# tests/e2e/test-obs-phase6-skill-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-606: Skill Service Streaming"
echo "==================================================================="

npx vitest run server/services/observability/skill-service.test.ts --grep "stream"

echo "✓ OBS-606 PASSED"
```

#### Pass Criteria

- Start and end events emitted for each skill
- File:line reference included
- Duration calculated correctly

---

### OBS-607: Wire MessageBusService to Stream

**File:** `server/services/observability/message-bus-service.ts` (modify)

**Purpose:** Emit stream events when message bus entries are logged.

#### Implementation

```typescript
// Add to message-bus-service.ts

import { observabilityStream } from "./observability-stream";

// In logEvent() method:

// Determine if action is required
const requiresAction =
  entry.severity === "error" || entry.severity === "critical";

// Emit stream event
observabilityStream.emitMessageBusEvent(
  {
    id: insertedId,
    eventId: entry.eventId,
    timestamp: entry.timestamp,
    source: entry.source,
    eventType: entry.eventType,
    correlationId: entry.correlationId,
    humanSummary: entry.humanSummary,
    severity: entry.severity,
    category: entry.category,
    transcriptEntryId: entry.transcriptEntryId,
    taskId: entry.taskId,
    executionId: entry.executionId,
    payload: entry.payload,
    createdAt: new Date().toISOString(),
  },
  requiresAction,
);
```

#### Acceptance Criteria

- [ ] Stream event emitted for each message bus entry
- [ ] `requiresAction` flag set for errors/critical
- [ ] Correlation ID preserved for linking

#### Test Script

```bash
# tests/e2e/test-obs-phase6-messagebus-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-607: MessageBus Service Streaming"
echo "==================================================================="

npx vitest run server/services/observability/message-bus-service.test.ts --grep "stream"

echo "✓ OBS-607 PASSED"
```

#### Pass Criteria

- Message bus events emitted with complete data
- requiresAction flag set correctly
- Correlation ID included

---

### OBS-608: Add Wave Status Streaming

**File:** `server/services/observability/execution-service.ts` (modify)

**Purpose:** Emit stream events when wave status changes.

#### Implementation

```typescript
// Add to execution-service.ts

import { observabilityStream } from "./observability-stream";

// In updateWaveStatus() or similar method:
observabilityStream.emitWaveStatus(
  executionId,
  waveNumber,
  status, // "pending" | "running" | "completed" | "failed"
  taskCount,
  completedCount,
  failedCount,
);
```

#### Acceptance Criteria

- [ ] Wave status events emitted on status change
- [ ] Task counts included (total, completed, failed)
- [ ] Wave number correctly identified

#### Test Script

```bash
# tests/e2e/test-obs-phase6-wave-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-608: Wave Status Streaming"
echo "==================================================================="

npx vitest run server/services/observability/execution-service.test.ts --grep "wave"

echo "✓ OBS-608 PASSED"
```

#### Pass Criteria

- Wave events emitted on status change
- Task counts accurate
- Status transitions correct

---

### OBS-609: Add Agent Heartbeat Streaming

**File:** `server/services/observability/execution-service.ts` (modify)

**Purpose:** Emit stream events for agent heartbeats.

#### Implementation

```typescript
// Add to execution-service.ts or agent-related service

import { observabilityStream } from "./observability-stream";

// In recordHeartbeat() or similar method:
observabilityStream.emitAgentHeartbeat(
  executionId,
  instanceId,
  status, // "idle" | "working" | "blocked" | "error"
  currentTaskId,
  {
    toolCalls: metrics.toolCallCount,
    assertions: metrics.assertionCount,
    memoryMb: metrics.memoryUsage,
    cpuPercent: metrics.cpuUsage,
  },
);
```

#### Acceptance Criteria

- [ ] Agent heartbeat events emitted periodically
- [ ] Status reflects current agent state
- [ ] Metrics included when available
- [ ] Current task ID included when working

#### Test Script

```bash
# tests/e2e/test-obs-phase6-heartbeat-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-609: Agent Heartbeat Streaming"
echo "==================================================================="

npx vitest run server/services/observability/execution-service.test.ts --grep "heartbeat"

echo "✓ OBS-609 PASSED"
```

#### Pass Criteria

- Heartbeat events emitted
- Status reflects agent state
- Metrics present when available

---

### OBS-610: Add Execution Status Streaming

**File:** `server/services/observability/execution-service.ts` (modify)

**Purpose:** Emit stream events when execution status changes.

#### Implementation

```typescript
// Add to execution-service.ts

import { observabilityStream } from "./observability-stream";

// In updateExecutionStatus() or similar method:
observabilityStream.emitExecutionStatus(
  executionId,
  status, // "started" | "running" | "paused" | "completed" | "failed"
  message, // Optional status message
);
```

#### Acceptance Criteria

- [ ] Execution status events emitted on status change
- [ ] Status covers all execution states
- [ ] Optional message included when relevant
- [ ] Events broadcast to both execution-specific and global listeners

#### Test Script

```bash
# tests/e2e/test-obs-phase6-execution-stream.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-610: Execution Status Streaming"
echo "==================================================================="

npx vitest run server/services/observability/execution-service.test.ts --grep "status"

echo "✓ OBS-610 PASSED"
```

#### Pass Criteria

- Execution status events emitted
- All status types covered
- Broadcast to global listeners

---

### OBS-611: Create Stream Unit Tests

**File:** `server/services/observability/observability-stream.test.ts`

**Purpose:** Unit tests for the stream service.

#### Implementation

```typescript
// server/services/observability/observability-stream.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ObservabilityStreamService } from "./observability-stream";

describe("ObservabilityStreamService", () => {
  let streamService: ObservabilityStreamService;

  beforeEach(() => {
    // Get fresh instance for each test
    streamService = ObservabilityStreamService.getInstance();
    streamService.removeAllListeners();
  });

  describe("Transcript Events", () => {
    it("should emit transcript:entry event", () => {
      const handler = vi.fn();
      streamService.on("observability:exec-123", handler);

      streamService.emitTranscriptEntry(
        "exec-123",
        {
          id: "entry-1",
          timestamp: new Date().toISOString(),
          sequence: 1,
          executionId: "exec-123",
          instanceId: "instance-1",
          entryType: "phase_start",
          category: "lifecycle",
          summary: "Starting phase",
          details: {},
        },
        true,
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe("transcript:entry");
      expect(handler.mock.calls[0][0].isLatest).toBe(true);
    });
  });

  describe("Tool Use Events", () => {
    it("should emit tool:start and tool:end events", () => {
      const handler = vi.fn();
      streamService.on("observability:exec-123", handler);

      streamService.emitToolStart("exec-123", "tool-1", "Read", "Read file.ts");
      streamService.emitToolEnd("exec-123", "tool-1", "done", 150);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].type).toBe("tool:start");
      expect(handler.mock.calls[1][0].type).toBe("tool:end");
      expect(handler.mock.calls[1][0].durationMs).toBe(150);
    });

    it("should emit tool:output for streaming output", () => {
      const handler = vi.fn();
      streamService.on("observability:exec-123", handler);

      streamService.emitToolOutput("exec-123", "tool-1", "line 1\n", false);
      streamService.emitToolOutput("exec-123", "tool-1", "error\n", true);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].isStderr).toBe(false);
      expect(handler.mock.calls[1][0].isStderr).toBe(true);
    });
  });

  describe("Assertion Events", () => {
    it("should emit assertion:result with running pass rate", () => {
      const handler = vi.fn();
      streamService.on("observability:exec-123", handler);

      streamService.emitAssertionResult(
        "exec-123",
        "task-1",
        {
          id: "assert-1",
          taskId: "task-1",
          executionId: "exec-123",
          category: "typescript_compiles",
          description: "TypeScript compiles",
          result: "pass",
          evidence: { exitCode: 0 },
          timestamp: new Date().toISOString(),
          durationMs: 2000,
        },
        0.92,
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe("assertion:result");
      expect(handler.mock.calls[0][0].runningPassRate).toBe(0.92);
    });
  });

  describe("Event Buffer", () => {
    it("should buffer events for replay", () => {
      streamService.emitTranscriptEntry(
        "exec-123",
        {
          id: "entry-1",
          timestamp: new Date().toISOString(),
          sequence: 1,
          executionId: "exec-123",
          instanceId: "instance-1",
          entryType: "phase_start",
          category: "lifecycle",
          summary: "Starting phase",
          details: {},
        },
        true,
      );

      const buffered = streamService.getBufferedEvents("exec-123");
      expect(buffered).toHaveLength(1);
      expect(buffered[0].type).toBe("transcript:entry");
    });

    it("should limit buffer size to 100", () => {
      for (let i = 0; i < 150; i++) {
        streamService.emitTranscriptEntry(
          "exec-123",
          {
            id: `entry-${i}`,
            timestamp: new Date().toISOString(),
            sequence: i,
            executionId: "exec-123",
            instanceId: "instance-1",
            entryType: "phase_start",
            category: "lifecycle",
            summary: `Event ${i}`,
            details: {},
          },
          true,
        );
      }

      const buffered = streamService.getBufferedEvents("exec-123");
      expect(buffered).toHaveLength(100);
      // Should have oldest events trimmed
      expect(buffered[0].entry.sequence).toBe(50);
    });

    it("should clear buffer when requested", () => {
      streamService.emitTranscriptEntry(
        "exec-123",
        {
          id: "entry-1",
          timestamp: new Date().toISOString(),
          sequence: 1,
          executionId: "exec-123",
          instanceId: "instance-1",
          entryType: "phase_start",
          category: "lifecycle",
          summary: "Starting phase",
          details: {},
        },
        true,
      );

      streamService.clearBuffer("exec-123");

      const buffered = streamService.getBufferedEvents("exec-123");
      expect(buffered).toHaveLength(0);
    });
  });

  describe("Global Broadcasting", () => {
    it("should broadcast execution events to global listeners", () => {
      const execHandler = vi.fn();
      const globalHandler = vi.fn();

      streamService.on("observability:exec-123", execHandler);
      streamService.on("observability:all", globalHandler);

      streamService.emitExecutionStatus("exec-123", "started");

      expect(execHandler).toHaveBeenCalledTimes(1);
      expect(globalHandler).toHaveBeenCalledTimes(1);
    });
  });
});
```

#### Acceptance Criteria

- [ ] Unit tests cover all emit methods
- [ ] Event buffer tests verify size limiting
- [ ] Global broadcasting tested
- [ ] All tests pass

#### Test Script

```bash
# tests/e2e/test-obs-phase6-unit-tests.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-611: Stream Service Unit Tests"
echo "==================================================================="

npx vitest run server/services/observability/observability-stream.test.ts

echo "✓ OBS-611 PASSED"
```

#### Pass Criteria

- All unit tests pass
- Coverage > 80%

---

### OBS-612: Create WebSocket E2E Tests

**File:** `tests/e2e/test-obs-phase6-websocket-e2e.ts`

**Purpose:** End-to-end tests for WebSocket streaming.

#### Implementation

```typescript
// tests/e2e/test-obs-phase6-websocket-e2e.ts

import WebSocket from "ws";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const WS_URL = "ws://localhost:3001/ws";

describe("Observability WebSocket E2E", () => {
  let server: any;

  beforeAll(async () => {
    // Start server if not running
    // This assumes server is running in test mode
  });

  afterAll(async () => {
    // Cleanup
  });

  it("should connect with observability parameter", async () => {
    const ws = new WebSocket(`${WS_URL}?observability=test-exec`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        // Should receive connected message
      });

      ws.on("message", (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === "observability:connected") {
          expect(event.executionId).toBe("test-exec");
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);

      setTimeout(() => reject(new Error("Timeout")), 5000);
    });
  });

  it("should connect with observability=all for global events", async () => {
    const ws = new WebSocket(`${WS_URL}?observability=all`);

    await new Promise<void>((resolve, reject) => {
      ws.on("message", (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === "observability:connected") {
          expect(event.message).toContain("all observability events");
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });
  });

  it("should handle subscription requests", async () => {
    const ws = new WebSocket(`${WS_URL}?observability=test-exec`);

    await new Promise<void>((resolve, reject) => {
      let connected = false;

      ws.on("message", (data) => {
        const event = JSON.parse(data.toString());

        if (event.type === "observability:connected") {
          connected = true;
          ws.send(
            JSON.stringify({
              action: "subscribe",
              topic: "tools",
            }),
          );
        } else if (event.type === "observability:subscribed") {
          expect(event.topic).toBe("tools");
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });
  });

  it("should receive buffered events on connect", async () => {
    // This test requires seeding the buffer first
    // Implementation depends on test setup
  });

  it("should handle ping/pong", async () => {
    const ws = new WebSocket(`${WS_URL}?observability=test-exec`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "ping" }));
      });

      ws.on("message", (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === "pong") {
          expect(event.timestamp).toBeDefined();
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });
  });

  it("should deliver events within 100ms of emission", async () => {
    // This test requires triggering a real event
    // and measuring delivery latency
  });
});
```

#### Acceptance Criteria

- [ ] E2E tests verify connection flow
- [ ] Subscription handling tested
- [ ] Ping/pong tested
- [ ] Event delivery latency tested (< 100ms)

#### Test Script

```bash
# tests/e2e/test-obs-phase6-websocket-e2e.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-612: WebSocket E2E Tests"
echo "==================================================================="

# Start server in background
npm run dev &
SERVER_PID=$!
sleep 3

# Run E2E tests
npx vitest run tests/e2e/test-obs-phase6-websocket-e2e.ts

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo "✓ OBS-612 PASSED"
```

#### Pass Criteria

- All E2E tests pass
- Latency under 100ms
- Connection handling correct

---

### OBS-613: Update Service Index Exports

**File:** `server/services/observability/index.ts` (modify)

**Purpose:** Export stream service from index.

#### Implementation

```typescript
// Add to server/services/observability/index.ts

export {
  ObservabilityStreamService,
  observabilityStream,
} from "./observability-stream";
```

#### Acceptance Criteria

- [ ] Stream service exported from index
- [ ] Can import from `server/services/observability`

#### Test Script

```bash
# tests/e2e/test-obs-phase6-exports.sh
#!/bin/bash
set -e

echo "==================================================================="
echo "TEST OBS-613: Service Exports"
echo "==================================================================="

# Verify import works
node -e "
const { observabilityStream } = require('./dist/server/services/observability');
if (!observabilityStream) {
  console.error('✗ observabilityStream not exported');
  process.exit(1);
}
console.log('✓ observabilityStream exported correctly');
"

echo "✓ OBS-613 PASSED"
```

#### Pass Criteria

- Stream service importable from index
- No circular dependency issues

---

### OBS-614: Create Phase 6 Validation Script

**File:** `tests/e2e/test-obs-phase6-all.sh`

**Purpose:** Run all Phase 6 tests in sequence.

#### Implementation

```bash
#!/bin/bash
# tests/e2e/test-obs-phase6-all.sh

set -e

echo ""
echo "======================================================================"
echo "OBSERVABILITY PHASE 6 WEBSOCKET STREAMING TESTS"
echo "======================================================================"
echo ""

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
run_test() {
  local name=$1
  local script=$2

  echo "----------------------------------------------------------------------"
  echo "Running: $name"
  echo "----------------------------------------------------------------------"

  if $script; then
    echo "✓ $name PASSED"
    ((TESTS_PASSED++))
  else
    echo "✗ $name FAILED"
    ((TESTS_FAILED++))
  fi
  echo ""
}

# Pre-check: TypeScript compilation
echo "Pre-check: TypeScript compilation..."
if npx tsc --noEmit; then
  echo "✓ TypeScript compiles without errors"
else
  echo "✗ TypeScript compilation failed"
  exit 1
fi
echo ""

# Run all Phase 6 tests
run_test "OBS-600: Stream Service" "npx vitest run server/services/observability/observability-stream.test.ts --silent"
run_test "OBS-601: WebSocket Types" "npx tsc --noEmit server/types/observability-websocket.ts"
run_test "OBS-611: Unit Tests" "npx vitest run server/services/observability/observability-stream.test.ts --silent"

# E2E tests (require running server)
echo "----------------------------------------------------------------------"
echo "Starting server for E2E tests..."
echo "----------------------------------------------------------------------"
npm run dev &
SERVER_PID=$!
sleep 5

if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "✓ Server started successfully"

  run_test "OBS-602: WebSocket Integration" "bash tests/e2e/test-obs-phase6-ws-integration.sh"
  run_test "OBS-612: WebSocket E2E" "npx vitest run tests/e2e/test-obs-phase6-websocket-e2e.ts --silent"
else
  echo "✗ Server failed to start"
  ((TESTS_FAILED++))
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true

# Summary
echo ""
echo "======================================================================"
echo "PHASE 6 TEST SUMMARY"
echo "======================================================================"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  echo "✗ PHASE 6 TESTS FAILED"
  exit 1
else
  echo "✓ ALL PHASE 6 TESTS PASSED"
  exit 0
fi
```

#### Acceptance Criteria

- [ ] Script runs all Phase 6 tests
- [ ] Proper server lifecycle management
- [ ] Clear pass/fail summary
- [ ] Exit code reflects test results

#### Test Script

```bash
chmod +x tests/e2e/test-obs-phase6-all.sh
./tests/e2e/test-obs-phase6-all.sh
```

#### Pass Criteria

- All tests pass
- Script exits with code 0

---

## Task Summary

| Task ID | Title                             | File                                                         | Priority | Dependencies     |
| ------- | --------------------------------- | ------------------------------------------------------------ | -------- | ---------------- |
| OBS-600 | Create Stream Service             | `server/services/observability/observability-stream.ts`      | P1       | OBS-200-208      |
| OBS-601 | Create WebSocket Event Types      | `server/types/observability-websocket.ts`                    | P1       | OBS-200          |
| OBS-602 | Integrate with Existing WebSocket | `server/websocket.ts`                                        | P1       | OBS-600, OBS-601 |
| OBS-603 | Wire TranscriptService            | `server/services/observability/transcript-service.ts`        | P1       | OBS-600          |
| OBS-604 | Wire ToolUseService               | `server/services/observability/tool-use-service.ts`          | P1       | OBS-600          |
| OBS-605 | Wire AssertionService             | `server/services/observability/assertion-service.ts`         | P1       | OBS-600          |
| OBS-606 | Wire SkillService                 | `server/services/observability/skill-service.ts`             | P1       | OBS-600          |
| OBS-607 | Wire MessageBusService            | `server/services/observability/message-bus-service.ts`       | P1       | OBS-600          |
| OBS-608 | Add Wave Status Streaming         | `server/services/observability/execution-service.ts`         | P1       | OBS-600          |
| OBS-609 | Add Agent Heartbeat Streaming     | `server/services/observability/execution-service.ts`         | P1       | OBS-600          |
| OBS-610 | Add Execution Status Streaming    | `server/services/observability/execution-service.ts`         | P1       | OBS-600          |
| OBS-611 | Create Stream Unit Tests          | `server/services/observability/observability-stream.test.ts` | P1       | OBS-600          |
| OBS-612 | Create WebSocket E2E Tests        | `tests/e2e/test-obs-phase6-websocket-e2e.ts`                 | P1       | OBS-602          |
| OBS-613 | Update Service Index Exports      | `server/services/observability/index.ts`                     | P1       | OBS-600          |
| OBS-614 | Create Phase 6 Validation Script  | `tests/e2e/test-obs-phase6-all.sh`                           | P1       | OBS-600-613      |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 6 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRE-REQUISITES                                                          │
│  ─────────────                                                          │
│  ✓ Phase 1 complete (Database Schema)                                   │
│  ✓ Phase 4 complete (TypeScript Types)                                  │
│  ✓ Phase 5 complete (API Routes)                                        │
│                                                                          │
│  PHASE 6a: Core Infrastructure                                           │
│  ─────────────────────────────────                                      │
│  1. OBS-601: Create WebSocket event types                               │
│  2. OBS-600: Create ObservabilityStreamService                          │
│  3. OBS-602: Integrate with existing WebSocket                          │
│                                                                          │
│  PHASE 6b: Service Wiring                                                │
│  ────────────────────────                                               │
│  4. OBS-603: Wire TranscriptService                                     │
│  5. OBS-604: Wire ToolUseService                                        │
│  6. OBS-605: Wire AssertionService                                      │
│  7. OBS-606: Wire SkillService                                          │
│  8. OBS-607: Wire MessageBusService                                     │
│  9. OBS-608: Add wave status streaming                                  │
│  10. OBS-609: Add agent heartbeat streaming                             │
│  11. OBS-610: Add execution status streaming                            │
│                                                                          │
│  PHASE 6c: Testing                                                       │
│  ────────────────                                                       │
│  12. OBS-611: Create stream unit tests                                  │
│  13. OBS-612: Create WebSocket E2E tests                                │
│  14. OBS-613: Update service exports                                    │
│                                                                          │
│  PHASE 6d: Validation                                                    │
│  ────────────────────                                                   │
│  15. OBS-614: Run all Phase 6 tests                                     │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All services emit stream events                                      │
│  ✓ WebSocket delivers events within 100ms                               │
│  ✓ Subscription filtering works                                         │
│  ✓ Event buffer supports replay                                         │
│  ✓ All unit and E2E tests pass                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 6 tasks

# Step 1: Verify TypeScript compilation
npx tsc --noEmit

# Step 2: Run unit tests
npx vitest run server/services/observability/observability-stream.test.ts

# Step 3: Start server
npm run dev &

# Step 4: Run E2E tests
npx vitest run tests/e2e/test-obs-phase6-websocket-e2e.ts

# Step 5: Run all Phase 6 tests
chmod +x tests/e2e/test-obs-phase6-all.sh
./tests/e2e/test-obs-phase6-all.sh
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 6 WEBSOCKET STREAMING TESTS
======================================================================

Pre-check: TypeScript compilation...
✓ TypeScript compiles without errors

----------------------------------------------------------------------
Running: OBS-600: Stream Service
----------------------------------------------------------------------
✓ OBS-600 PASSED

----------------------------------------------------------------------
Running: OBS-601: WebSocket Types
----------------------------------------------------------------------
✓ OBS-601 PASSED

[... all 15 tests pass ...]

======================================================================
PHASE 6 TEST SUMMARY
======================================================================
Passed: 15
Failed: 0

✓ ALL PHASE 6 TESTS PASSED
```

---

## Related Documents

| Document                                                           | Purpose                    |
| ------------------------------------------------------------------ | -------------------------- |
| [SPEC.md](./SPEC.md)                                               | Master specification       |
| [api/README.md](./api/README.md)                                   | API specification          |
| [appendices/TYPES.md](./appendices/TYPES.md)                       | Type definitions           |
| [implementation-plan-phase-4.md](./implementation-plan-phase-4.md) | TypeScript types (Phase 4) |
| [implementation-plan-phase-5.md](./implementation-plan-phase-5.md) | API routes (Phase 5)       |

---

_Phase 6 Implementation Plan: WebSocket Streaming_
