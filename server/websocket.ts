/**
 * WebSocket server for real-time debate streaming and ideation updates
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { observabilityStream } from "./services/observability/observability-stream.js";
import type {
  ObservabilityEvent as StreamObservabilityEvent,
  SubscriptionRequest,
  ClientMessage,
  ObservabilityTopic,
  EventFilters,
  ToolUseStartEvent,
} from "./types/observability-websocket.js";

// Event types that can be broadcast during a debate
export type DebateEventType =
  | "debate:started"
  | "debate:criterion:start" // Marks start of debate for a specific criterion
  | "debate:round:started"
  | "evaluator:initial" // Initial assessment (before debate)
  | "evaluator:speaking" // DEPRECATED: Use evaluator:initial or evaluator:defense
  | "evaluator:defense" // Defense against red team (during debate)
  | "redteam:challenge"
  | "arbiter:verdict"
  | "debate:round:complete"
  | "debate:criterion:complete" // Marks end of debate for a specific criterion
  | "debate:complete"
  | "synthesis:started"
  | "synthesis:complete"
  | "error";

// Event types for ideation sessions
export type IdeationEventType =
  | "artifact:updating" // Artifact edit in progress
  | "artifact:updated" // Artifact edit completed
  | "artifact:created" // New artifact created (e.g., by sub-agent)
  | "artifact:deleted" // Artifact deleted
  | "artifact:error" // Artifact edit failed
  | "classifications:updated" // Classifications have been updated
  | "subagent:spawn" // When a sub-agent starts
  | "subagent:status" // When a sub-agent status changes (running/completed/failed)
  | "subagent:result" // When a sub-agent produces results
  | "followup:pending" // Follow-up question is being generated
  | "followup:message" // Follow-up question/message received
  // Spec-related events (SPEC-009)
  | "readiness:update" // Readiness score changed
  | "spec:generating" // Spec generation started
  | "spec:generated" // Spec generation complete
  | "spec:updated" // Spec content changed
  | "spec:workflow:changed" // Workflow state changed
  // Graph/block events for real-time updates
  | "block_created" // Memory block created
  | "block_updated" // Memory block updated
  | "link_created" // Memory link created
  | "link_removed" // Memory link removed
  // Source mapping events (background Claude Opus 4.5 processing)
  | "source_mapping_started" // Source mapping job started
  | "source_mapping_progress" // Source mapping progress update
  | "source_mapping_complete" // Source mapping finished successfully
  | "source_mapping_failed" // Source mapping failed
  | "source_mapping_cancelled" // Source mapping was cancelled
  // Report synthesis events (background report generation for node groups)
  | "report_synthesis_started" // Report synthesis job started
  | "report_synthesis_progress" // Report synthesis progress update
  | "report_synthesis_complete" // Report synthesis finished successfully
  | "report_synthesis_failed" // Report synthesis failed
  | "report_synthesis_cancelled"; // Report synthesis was cancelled

// Event types for agent/monitoring system (WSK-001)
export type AgentEventType =
  | "agent:registered" // Agent registered with Communication Hub
  | "agent:started" // Agent started working
  | "agent:heartbeat" // Agent heartbeat
  | "agent:blocked" // Agent blocked waiting for answer
  | "agent:unblocked" // Agent unblocked (answer received)
  | "agent:completed" // Agent completed work
  | "agent:error" // Agent encountered error
  | "agent:halted" // Agent halted (timeout/error)
  | "question:created" // New question created
  | "question:delivered" // Question delivered to user
  | "question:answered" // Question answered
  | "question:timeout" // Question timed out
  | "notification:sent" // Notification sent
  | "system:health" // System health update
  | "system:alert"; // System alert

// Sub-agent status types
export type SubAgentStatus = "spawning" | "running" | "completed" | "failed";

// Sub-agent types (extended to support orchestrator task types)
export type SubAgentType =
  | "research" // Web research agent
  | "evaluator" // Idea evaluation agent
  | "redteam" // Red team challenge agent
  | "development" // Idea development agent
  | "synthesis" // Synthesis agent
  | "action-plan" // Action plan generator
  | "pitch-refine" // Pitch refinement agent
  | "architecture-explore" // Architecture exploration agent
  | "custom"; // Custom task agent

export interface SubAgentInfo {
  id: string;
  type: SubAgentType;
  name: string;
  status: SubAgentStatus;
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface IdeationEvent {
  type: IdeationEventType;
  timestamp: string;
  sessionId: string;
  data: {
    // Artifact-related
    artifactId?: string;
    content?: string;
    title?: string;
    summary?: string;
    error?: string;
    // Sub-agent-related
    subAgentId?: string;
    subAgentType?: SubAgentType;
    subAgentName?: string;
    subAgentStatus?: SubAgentStatus;
    result?: unknown;
    [key: string]: unknown;
  };
}

export interface DebateEvent {
  type: DebateEventType;
  timestamp: string;
  ideaSlug: string;
  runId: string;
  data: {
    criterion?: string;
    category?: string;
    roundNumber?: number;
    persona?: string;
    content?: string;
    score?: number;
    adjustment?: number;
    verdict?: string;
    error?: string;
    [key: string]: unknown;
  };
}

// Agent/Monitoring event interface (WSK-001)
export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  agentId?: string;
  agentType?: string;
  sessionId?: string;
  data: {
    status?: string;
    message?: string;
    questionId?: string;
    questionType?: string;
    notificationId?: string;
    severity?: "info" | "warning" | "error" | "critical";
    metrics?: Record<string, number>;
    error?: string;
    [key: string]: unknown;
  };
}

// Track connected clients by idea slug (for debates)
const debateRooms = new Map<string, Set<WebSocket>>();

// Track connected clients by session ID (for ideation)
const sessionRooms = new Map<string, Set<WebSocket>>();

// Track connected clients for agent/monitoring dashboard (WSK-002)
const agentMonitorClients = new Set<WebSocket>();

// Track connected clients by user ID (for notifications)
const userConnections = new Map<string, Set<WebSocket>>();

// Track connected clients for pipeline dashboard
const pipelineClients = new Set<WebSocket>();

// Track connected clients for platform events stream
const eventsClients = new Set<WebSocket>();

// ============================================
// OBS-602: Observability Subscription State
// ============================================

interface ObservabilityClientState {
  executionId: string;
  topics: Set<ObservabilityTopic>;
  filters: EventFilters;
  eventHandler: ((event: StreamObservabilityEvent) => void) | null;
}

// Track subscription state per observability client
const observabilityClientState = new WeakMap<
  WebSocket,
  ObservabilityClientState
>();

/**
 * Check if event should be sent based on subscriptions and filters.
 */
function shouldSendObservabilityEvent(
  event: StreamObservabilityEvent,
  topics: Set<ObservabilityTopic>,
  filters: EventFilters,
): boolean {
  // "all" topic gets everything
  if (topics.has("all")) {
    // Apply filters even with "all" topic
    if (
      filters.taskId &&
      "taskId" in event &&
      (event as { taskId?: string }).taskId !== filters.taskId
    ) {
      return false;
    }
    return true;
  }

  // Map event type to topic
  const topicMap: Record<string, ObservabilityTopic> = {
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
  if (
    filters.taskId &&
    "taskId" in event &&
    (event as { taskId?: string }).taskId !== filters.taskId
  ) {
    return false;
  }

  if (filters.tools && event.type === "tool:start") {
    const toolEvent = event as ToolUseStartEvent;
    if (!filters.tools.includes(toolEvent.tool as string)) {
      return false;
    }
  }

  return true;
}

/**
 * Setup observability streaming for a connected client using ObservabilityStreamService.
 */
function setupObservabilityStreaming(ws: WebSocket, executionId: string): void {
  // Initialize subscription state
  const state: ObservabilityClientState = {
    executionId,
    topics: new Set(["all"] as ObservabilityTopic[]),
    filters: {},
    eventHandler: null,
  };

  // Create event handler
  const eventHandler = (event: StreamObservabilityEvent): void => {
    const clientState = observabilityClientState.get(ws);
    if (!clientState) return;

    // Apply topic filter
    if (
      !shouldSendObservabilityEvent(
        event,
        clientState.topics,
        clientState.filters,
      )
    ) {
      return;
    }

    // Send event
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  };

  state.eventHandler = eventHandler;
  observabilityClientState.set(ws, state);

  // Subscribe to execution-specific events
  if (executionId && executionId !== "all") {
    observabilityStream.on(`observability:${executionId}`, eventHandler);

    // Send buffered events for replay
    const buffered = observabilityStream.getBufferedEvents(executionId);
    for (const event of buffered) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  // Subscribe to global events
  observabilityStream.on("observability:all", eventHandler);

  // Send connected confirmation
  const bufferedCount =
    executionId !== "all"
      ? observabilityStream.getBufferedEvents(executionId).length
      : 0;

  ws.send(
    JSON.stringify({
      type: "observability:connected",
      timestamp: new Date().toISOString(),
      executionId,
      message:
        executionId === "all"
          ? "Connected to all observability events"
          : `Connected to execution ${executionId}`,
      bufferedEventCount: bufferedCount,
    }),
  );
}

/**
 * Handle subscription request from observability client.
 */
function handleObservabilitySubscriptionRequest(
  ws: WebSocket,
  request: SubscriptionRequest,
): void {
  const state = observabilityClientState.get(ws);
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
 * Cleanup observability streaming on disconnect.
 */
function cleanupObservabilityStreaming(ws: WebSocket): void {
  const state = observabilityClientState.get(ws);
  if (!state || !state.eventHandler) return;

  const handler = state.eventHandler;
  const execId = state.executionId;

  if (execId && execId !== "all") {
    observabilityStream.off(`observability:${execId}`, handler);
  }
  observabilityStream.off("observability:all", handler);

  observabilityClientState.delete(ws);
}

// Event handlers for user-specific events (notifications)
const userEventHandlers = new Map<
  string,
  (userId: string, data: Record<string, unknown>) => void
>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server attached to HTTP server
 */
export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const ideaSlug = url.searchParams.get("idea");
    const sessionId = url.searchParams.get("session");
    const monitor = url.searchParams.get("monitor"); // WSK-002: agent monitoring
    const userId = url.searchParams.get("user"); // User ID for notifications
    const executor = url.searchParams.get("executor"); // Task executor monitoring
    const observability = url.searchParams.get("observability"); // Observability monitoring
    const pipeline = url.searchParams.get("pipeline"); // Pipeline dashboard
    const events = url.searchParams.get("events"); // Platform events stream

    // Must have either idea, session, monitor, user, executor, observability, pipeline, or events parameter
    if (
      !ideaSlug &&
      !sessionId &&
      monitor !== "agents" &&
      !userId &&
      executor !== "tasks" &&
      !observability &&
      pipeline !== "stream" &&
      events !== "stream"
    ) {
      ws.close(
        4000,
        "Missing idea, session, monitor, user, executor, observability, pipeline, or events parameter",
      );
      return;
    }

    // Join the appropriate room
    if (pipeline === "stream") {
      // Pipeline dashboard
      pipelineClients.add(ws);
      console.log(
        `Client joined pipeline stream (${pipelineClients.size} connected)`,
      );

      ws.send(
        JSON.stringify({
          type: "pipeline:connected",
          timestamp: new Date().toISOString(),
          data: {
            message: "Connected to pipeline stream",
            clientCount: pipelineClients.size,
          },
        }),
      );
    } else if (events === "stream") {
      // Platform events stream
      eventsClients.add(ws);
      console.log(
        `Client joined events stream (${eventsClients.size} connected)`,
      );

      // Setup event listener
      const { eventService } = await import("./services/event-service.js");
      const eventHandler = (streamEvent: {
        type: string;
        timestamp: string;
        event: unknown;
      }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(streamEvent));
        }
      };

      eventService.on("platform:event", eventHandler);

      // Send buffered events for replay
      const bufferedEvents = eventService.getBufferedEvents();
      for (const event of bufferedEvents.slice(-50)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "platform:event",
              timestamp: event.timestamp,
              event,
            }),
          );
        }
      }

      ws.send(
        JSON.stringify({
          type: "events:connected",
          timestamp: new Date().toISOString(),
          data: {
            message: "Connected to platform events stream",
            clientCount: eventsClients.size,
            bufferedCount: bufferedEvents.length,
          },
        }),
      );

      // Store handler for cleanup
      (
        ws as WebSocket & { _eventHandler?: typeof eventHandler }
      )._eventHandler = eventHandler;
    } else if (observability) {
      // OBS-602: Enhanced observability connection using ObservabilityStreamService
      // Keep backward-compatible room tracking
      if (observability === "all") {
        observabilityGlobalClients.add(ws);
        console.log(
          `Client joined observability global (${observabilityGlobalClients.size} connected)`,
        );
      } else {
        // Specific execution ID
        if (!observabilityClients.has(observability)) {
          observabilityClients.set(observability, new Set());
        }
        observabilityClients.get(observability)!.add(ws);
        console.log(
          `Client joined observability for execution ${observability}`,
        );
      }

      // Setup streaming with ObservabilityStreamService (handles buffered events, filtering, etc.)
      setupObservabilityStreaming(ws, observability);

      // Handle client messages (subscriptions, ping/pong)
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;

          if ("type" in message && message.type === "ping") {
            ws.send(
              JSON.stringify({
                type: "pong",
                timestamp: new Date().toISOString(),
              }),
            );
          } else if ("action" in message) {
            handleObservabilitySubscriptionRequest(ws, message);
          }
        } catch {
          ws.send(
            JSON.stringify({
              type: "observability:error",
              timestamp: new Date().toISOString(),
              error: "Invalid message format",
              code: "INVALID_MESSAGE",
            }),
          );
        }
      });
    } else if (executor === "tasks") {
      // Task executor monitoring
      taskExecutorClients.add(ws);
      console.log(
        `Client joined task executor (${taskExecutorClients.size} connected)`,
      );

      ws.send(
        JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          data: {
            message: "Connected to task executor",
            clientCount: taskExecutorClients.size,
          },
        }),
      );
    } else if (userId) {
      // User notifications connection
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
      }
      userConnections.get(userId)!.add(ws);
      console.log(
        `User ${userId} connected for notifications (${userConnections.get(userId)!.size} connections)`,
      );

      ws.send(
        JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          userId,
          data: { message: "Connected for notifications" },
        }),
      );
    } else if (monitor === "agents") {
      // Agent monitoring dashboard (WSK-002)
      agentMonitorClients.add(ws);
      console.log(
        `Client joined agent monitoring (${agentMonitorClients.size} connected)`,
      );

      ws.send(
        JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          data: {
            message: "Connected to agent monitoring",
            clientCount: agentMonitorClients.size,
          },
        }),
      );
    } else if (sessionId) {
      // Ideation session room
      if (!sessionRooms.has(sessionId)) {
        sessionRooms.set(sessionId, new Set());
      }
      sessionRooms.get(sessionId)!.add(ws);
      console.log(`Client joined ideation session: ${sessionId}`);

      ws.send(
        JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          sessionId,
          data: { message: "Connected to ideation session" },
        }),
      );
    } else if (ideaSlug) {
      // Debate room
      if (!debateRooms.has(ideaSlug)) {
        debateRooms.set(ideaSlug, new Set());
      }
      debateRooms.get(ideaSlug)!.add(ws);
      console.log(`Client joined debate room: ${ideaSlug}`);

      ws.send(
        JSON.stringify({
          type: "connected",
          timestamp: new Date().toISOString(),
          ideaSlug,
          data: { message: "Connected to debate stream" },
        }),
      );
    }

    // Handle client messages (e.g., ping/pong, notification events)
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            }),
          );
        } else if (userId && data.event) {
          // Route notification-related events to handlers
          const handler = userEventHandlers.get(data.event);
          if (handler) {
            handler(userId, data.data || {});
          }
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Clean up on disconnect
    ws.on("close", async () => {
      if (pipeline === "stream") {
        pipelineClients.delete(ws);
        console.log(
          `Client left pipeline stream (${pipelineClients.size} connected)`,
        );
      } else if (events === "stream") {
        // Cleanup events stream listener
        eventsClients.delete(ws);
        const handler = (
          ws as WebSocket & { _eventHandler?: (...args: unknown[]) => void }
        )._eventHandler;
        if (handler) {
          const { eventService } = await import("./services/event-service.js");
          eventService.off("platform:event", handler);
        }
        console.log(
          `Client left events stream (${eventsClients.size} connected)`,
        );
      } else if (observability) {
        // OBS-602: Cleanup stream service listeners
        cleanupObservabilityStreaming(ws);

        // Keep backward-compatible room cleanup
        if (observability === "all") {
          observabilityGlobalClients.delete(ws);
          console.log(
            `Client left observability global (${observabilityGlobalClients.size} connected)`,
          );
        } else {
          const room = observabilityClients.get(observability);
          if (room) {
            room.delete(ws);
            if (room.size === 0) {
              observabilityClients.delete(observability);
            }
          }
          console.log(
            `Client left observability for execution ${observability}`,
          );
        }
      } else if (executor === "tasks") {
        taskExecutorClients.delete(ws);
        console.log(
          `Client left task executor (${taskExecutorClients.size} connected)`,
        );
      } else if (userId) {
        const connections = userConnections.get(userId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            userConnections.delete(userId);
          }
        }
        console.log(
          `User ${userId} disconnected (${userConnections.get(userId)?.size || 0} connections remaining)`,
        );
      } else if (monitor === "agents") {
        agentMonitorClients.delete(ws);
        console.log(
          `Client left agent monitoring (${agentMonitorClients.size} connected)`,
        );
      } else if (sessionId) {
        const room = sessionRooms.get(sessionId);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            sessionRooms.delete(sessionId);
          }
        }
        console.log(`Client left ideation session: ${sessionId}`);
      } else if (ideaSlug) {
        const room = debateRooms.get(ideaSlug);
        if (room) {
          room.delete(ws);
          if (room.size === 0) {
            debateRooms.delete(ideaSlug);
          }
        }
        console.log(`Client left debate room: ${ideaSlug}`);
      }
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error:`, err);
    });
  });

  console.log("WebSocket server initialized on /ws");
  return wss;
}

/**
 * Broadcast an event to all clients watching a specific idea
 */
export function broadcastDebateEvent(event: DebateEvent): void {
  const room = debateRooms.get(event.ideaSlug);
  if (!room || room.size === 0) {
    return;
  }

  const message = JSON.stringify(event);

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to create and broadcast a debate event
 */
export function emitDebateEvent(
  type: DebateEventType,
  ideaSlug: string,
  runId: string,
  data: DebateEvent["data"] = {},
): void {
  broadcastDebateEvent({
    type,
    timestamp: new Date().toISOString(),
    ideaSlug,
    runId,
    data,
  });
}

/**
 * Get the count of connected clients for an idea
 */
export function getClientCount(ideaSlug: string): number {
  return debateRooms.get(ideaSlug)?.size || 0;
}

/**
 * Get all active debate rooms
 */
export function getActiveRooms(): string[] {
  return Array.from(debateRooms.keys());
}

/**
 * Close WebSocket server
 */
export function closeWebSocket(): void {
  if (wss) {
    wss.close();
    debateRooms.clear();
    wss = null;
  }
}

/**
 * Broadcast an event to all clients in an ideation session
 */
export function broadcastSessionEvent(event: IdeationEvent): void {
  const room = sessionRooms.get(event.sessionId);
  if (!room || room.size === 0) {
    console.log(
      `[WS] No clients in session ${event.sessionId} to receive event`,
    );
    return;
  }

  const message = JSON.stringify(event);
  console.log(
    `[WS] Broadcasting ${event.type} to ${room.size} clients in session ${event.sessionId}`,
  );

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit an ideation session event
 */
export function emitSessionEvent(
  type: IdeationEventType,
  sessionId: string,
  data: IdeationEvent["data"] = {},
): void {
  broadcastSessionEvent({
    type,
    timestamp: new Date().toISOString(),
    sessionId,
    data,
  });
}

/**
 * Broadcast an event to a specific session (SPEC-009)
 * Used by spec workflow state machine
 */
export function broadcastToSession(
  sessionId: string,
  event: { type: string; payload: Record<string, unknown> },
): void {
  const room = sessionRooms.get(sessionId);
  if (!room || room.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: event.type,
    timestamp: new Date().toISOString(),
    sessionId,
    data: event.payload,
  });

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit a sub-agent spawn event
 */
export function emitSubAgentSpawn(
  sessionId: string,
  subAgentId: string,
  subAgentType: SubAgentType,
  subAgentName: string,
): void {
  emitSessionEvent("subagent:spawn", sessionId, {
    subAgentId,
    subAgentType,
    subAgentName,
    subAgentStatus: "spawning" as SubAgentStatus,
  });
}

/**
 * Helper to emit a sub-agent status change event
 */
export function emitSubAgentStatus(
  sessionId: string,
  subAgentId: string,
  status: SubAgentStatus,
  error?: string,
): void {
  emitSessionEvent("subagent:status", sessionId, {
    subAgentId,
    subAgentStatus: status,
    error,
  });
}

/**
 * Helper to emit a sub-agent result event
 */
export function emitSubAgentResult(
  sessionId: string,
  subAgentId: string,
  result: unknown,
): void {
  emitSessionEvent("subagent:result", sessionId, {
    subAgentId,
    subAgentStatus: "completed" as SubAgentStatus,
    result,
  });
}

// ============================================
// Graph Event Functions (Real-time Graph Updates)
// ============================================

/**
 * Payload interface for block_created events
 */
export interface BlockCreatedPayload {
  id: string;
  type?: string;
  title?: string | null;
  content?: string;
  properties?: Record<string, unknown>;
  status?: string;
  confidence?: number;
  abstractionLevel?: string;
  graphMembership?: string[];
}

/**
 * Payload interface for block_updated events
 */
export interface BlockUpdatedPayload {
  id: string;
  type?: string;
  content?: string;
  properties?: Record<string, unknown>;
  status?: string;
  confidence?: number;
  abstractionLevel?: string;
  graphMembership?: string[];
}

/**
 * Payload interface for link_created events
 */
export interface LinkCreatedPayload {
  id: string;
  link_type: string;
  source: string;
  target: string;
  degree?: string;
  confidence?: number;
  reason?: string;
}

/**
 * Payload interface for link_removed events
 */
export interface LinkRemovedPayload {
  id: string;
}

/**
 * Emit a block_created event to all clients in a session
 */
export function emitBlockCreated(
  sessionId: string,
  payload: BlockCreatedPayload,
): void {
  const room = sessionRooms.get(sessionId);
  if (!room || room.size === 0) {
    console.log(
      `[WS] No clients in session ${sessionId} to receive block_created event`,
    );
    return;
  }

  const message = JSON.stringify({
    type: "block_created",
    payload,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[WS] Broadcasting block_created to ${room.size} clients in session ${sessionId}`,
  );

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Emit a block_updated event to all clients in a session
 */
export function emitBlockUpdated(
  sessionId: string,
  payload: BlockUpdatedPayload,
): void {
  const room = sessionRooms.get(sessionId);
  if (!room || room.size === 0) {
    console.log(
      `[WS] No clients in session ${sessionId} to receive block_updated event`,
    );
    return;
  }

  const message = JSON.stringify({
    type: "block_updated",
    payload,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[WS] Broadcasting block_updated to ${room.size} clients in session ${sessionId}`,
  );

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Emit a link_created event to all clients in a session
 */
export function emitLinkCreated(
  sessionId: string,
  payload: LinkCreatedPayload,
): void {
  const room = sessionRooms.get(sessionId);
  if (!room || room.size === 0) {
    console.log(
      `[WS] No clients in session ${sessionId} to receive link_created event`,
    );
    return;
  }

  const message = JSON.stringify({
    type: "link_created",
    payload,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[WS] Broadcasting link_created to ${room.size} clients in session ${sessionId}`,
  );

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Emit a link_removed event to all clients in a session
 */
export function emitLinkRemoved(
  sessionId: string,
  payload: LinkRemovedPayload,
): void {
  const room = sessionRooms.get(sessionId);
  if (!room || room.size === 0) {
    console.log(
      `[WS] No clients in session ${sessionId} to receive link_removed event`,
    );
    return;
  }

  const message = JSON.stringify({
    type: "link_removed",
    payload,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `[WS] Broadcasting link_removed to ${room.size} clients in session ${sessionId}`,
  );

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ============================================
// Source Mapping Events (Background Processing)
// ============================================

/**
 * Payload for source mapping events
 */
export interface SourceMappingPayload {
  jobId: string;
  blocksToMap: number;
  sourcesAvailable: number;
  mappingsCreated?: number;
  progress?: number; // 0-100
  status: "started" | "processing" | "complete" | "failed" | "cancelled";
  error?: string;
}

/**
 * Emit source mapping started event
 */
export function emitSourceMappingStarted(
  sessionId: string,
  payload: Pick<
    SourceMappingPayload,
    "jobId" | "blocksToMap" | "sourcesAvailable"
  >,
): void {
  emitSessionEvent("source_mapping_started", sessionId, {
    ...payload,
    status: "started",
  });
}

/**
 * Emit source mapping progress event
 */
export function emitSourceMappingProgress(
  sessionId: string,
  payload: Pick<
    SourceMappingPayload,
    "jobId" | "progress" | "blocksToMap" | "sourcesAvailable"
  >,
): void {
  emitSessionEvent("source_mapping_progress", sessionId, {
    ...payload,
    status: "processing",
  });
}

/**
 * Emit source mapping complete event
 */
export function emitSourceMappingComplete(
  sessionId: string,
  payload: Pick<
    SourceMappingPayload,
    "jobId" | "mappingsCreated" | "blocksToMap" | "sourcesAvailable"
  >,
): void {
  emitSessionEvent("source_mapping_complete", sessionId, {
    ...payload,
    status: "complete",
  });
}

/**
 * Emit source mapping failed event
 */
export function emitSourceMappingFailed(
  sessionId: string,
  payload: Pick<SourceMappingPayload, "jobId" | "error">,
): void {
  emitSessionEvent("source_mapping_failed", sessionId, {
    ...payload,
    status: "failed",
  });
}

/**
 * Emit source mapping cancelled event
 */
export function emitSourceMappingCancelled(
  sessionId: string,
  payload: Pick<SourceMappingPayload, "jobId">,
): void {
  emitSessionEvent("source_mapping_cancelled", sessionId, {
    ...payload,
    status: "cancelled",
  });
}

// ============================================
// Report Synthesis Event Functions
// ============================================

/**
 * Payload for report synthesis events
 */
export interface ReportSynthesisPayload {
  jobId: string;
  totalGroups: number;
  completedGroups: number;
  currentGroupName?: string;
  reportsCreated?: number;
  progress?: number; // 0-100
  status:
    | "started"
    | "detecting"
    | "generating"
    | "complete"
    | "failed"
    | "cancelled";
  error?: string;
}

/**
 * Emit report synthesis started event
 */
export function emitReportSynthesisStarted(
  sessionId: string,
  payload: Pick<ReportSynthesisPayload, "jobId">,
): void {
  emitSessionEvent("report_synthesis_started", sessionId, {
    ...payload,
    totalGroups: 0,
    completedGroups: 0,
    progress: 0,
    status: "started",
  });
}

/**
 * Emit report synthesis progress event (detecting groups)
 */
export function emitReportSynthesisDetecting(
  sessionId: string,
  payload: Pick<ReportSynthesisPayload, "jobId">,
): void {
  emitSessionEvent("report_synthesis_progress", sessionId, {
    ...payload,
    totalGroups: 0,
    completedGroups: 0,
    progress: 10,
    status: "detecting",
  });
}

/**
 * Emit report synthesis progress event (generating reports)
 */
export function emitReportSynthesisProgress(
  sessionId: string,
  payload: Pick<
    ReportSynthesisPayload,
    | "jobId"
    | "totalGroups"
    | "completedGroups"
    | "currentGroupName"
    | "progress"
  >,
): void {
  emitSessionEvent("report_synthesis_progress", sessionId, {
    ...payload,
    status: "generating",
  });
}

/**
 * Emit report synthesis complete event
 */
export function emitReportSynthesisComplete(
  sessionId: string,
  payload: Pick<
    ReportSynthesisPayload,
    "jobId" | "totalGroups" | "reportsCreated"
  >,
): void {
  emitSessionEvent("report_synthesis_complete", sessionId, {
    ...payload,
    completedGroups: payload.totalGroups,
    progress: 100,
    status: "complete",
  });
}

/**
 * Emit report synthesis failed event
 */
export function emitReportSynthesisFailed(
  sessionId: string,
  payload: Pick<ReportSynthesisPayload, "jobId" | "error">,
): void {
  emitSessionEvent("report_synthesis_failed", sessionId, {
    ...payload,
    status: "failed",
  });
}

/**
 * Emit report synthesis cancelled event
 */
export function emitReportSynthesisCancelled(
  sessionId: string,
  payload: Pick<ReportSynthesisPayload, "jobId">,
): void {
  emitSessionEvent("report_synthesis_cancelled", sessionId, {
    ...payload,
    status: "cancelled",
  });
}

// ============================================
// Agent Monitoring Functions (WSK-003)
// ============================================

/**
 * Broadcast an agent event to all monitoring clients
 */
export function broadcastAgentEvent(event: AgentEvent): void {
  if (agentMonitorClients.size === 0) {
    return;
  }

  const message = JSON.stringify(event);

  agentMonitorClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit an agent event
 */
export function emitAgentEvent(
  type: AgentEventType,
  agentId?: string,
  agentType?: string,
  data: AgentEvent["data"] = {},
): void {
  broadcastAgentEvent({
    type,
    timestamp: new Date().toISOString(),
    agentId,
    agentType,
    data,
  });
}

/**
 * Emit agent registration event
 */
export function emitAgentRegistered(agentId: string, agentType: string): void {
  emitAgentEvent("agent:registered", agentId, agentType, {
    status: "registered",
    message: `Agent ${agentId} registered`,
  });
}

/**
 * Emit agent started event
 */
export function emitAgentStarted(
  agentId: string,
  agentType: string,
  sessionId?: string,
): void {
  broadcastAgentEvent({
    type: "agent:started",
    timestamp: new Date().toISOString(),
    agentId,
    agentType,
    sessionId,
    data: { status: "working" },
  });
}

/**
 * Emit agent blocked event (waiting for user input)
 */
export function emitAgentBlocked(
  agentId: string,
  agentType: string,
  questionId: string,
): void {
  emitAgentEvent("agent:blocked", agentId, agentType, {
    status: "blocked",
    questionId,
    message: "Waiting for user input",
  });
}

/**
 * Emit agent unblocked event
 */
export function emitAgentUnblocked(
  agentId: string,
  agentType: string,
  questionId: string,
): void {
  emitAgentEvent("agent:unblocked", agentId, agentType, {
    status: "working",
    questionId,
    message: "User input received",
  });
}

/**
 * Emit question created event
 */
export function emitQuestionCreated(
  questionId: string,
  questionType: string,
  agentId: string,
  agentType: string,
): void {
  emitAgentEvent("question:created", agentId, agentType, {
    questionId,
    questionType,
  });
}

/**
 * Emit question answered event
 */
export function emitQuestionAnswered(
  questionId: string,
  agentId: string,
  agentType: string,
): void {
  emitAgentEvent("question:answered", agentId, agentType, {
    questionId,
  });
}

/**
 * Emit system health event
 */
export function emitSystemHealth(metrics: Record<string, number>): void {
  emitAgentEvent("system:health", undefined, undefined, {
    metrics,
  });
}

/**
 * Emit system alert event
 */
export function emitSystemAlert(
  message: string,
  severity: "info" | "warning" | "error" | "critical",
): void {
  emitAgentEvent("system:alert", undefined, undefined, {
    message,
    severity,
  });
}

/**
 * Get count of connected monitoring clients
 */
export function getMonitorClientCount(): number {
  return agentMonitorClients.size;
}

// ============================================
// Build Agent Functions
// ============================================

// Build event types
export type BuildEventType =
  | "build:created" // Build execution created
  | "build:started" // Build execution started
  | "build:paused" // Build execution paused
  | "build:resumed" // Build execution resumed
  | "build:completed" // Build execution completed successfully
  | "build:failed" // Build execution failed
  | "build:cancelled" // Build execution cancelled
  | "task:started" // Task execution started
  | "task:completed" // Task execution completed
  | "task:failed" // Task execution failed
  | "task:skipped" // Task execution skipped
  | "task:validating" // Task validation in progress
  | "build:progress"; // Build progress update

export interface BuildEvent {
  type: BuildEventType;
  timestamp: string;
  buildId: string;
  data: {
    specId?: string;
    specPath?: string;
    taskId?: string;
    phase?: string;
    action?: string;
    filePath?: string;
    status?: string;
    tasksTotal?: number;
    tasksCompleted?: number;
    tasksFailed?: number;
    progressPct?: number;
    error?: string;
    fromCheckpoint?: string | null;
    [key: string]: unknown;
  };
}

// Track connected clients for build monitoring
const buildMonitorClients = new Map<string, Set<WebSocket>>();

/**
 * Broadcast a build event to clients watching a specific build
 */
export function broadcastBuildEvent(event: BuildEvent): void {
  const room = buildMonitorClients.get(event.buildId);
  if (!room || room.size === 0) {
    return;
  }

  const message = JSON.stringify(event);

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit a build event
 */
export function emitBuildEvent(
  type: BuildEventType,
  buildId: string,
  data: BuildEvent["data"] = {},
): void {
  broadcastBuildEvent({
    type,
    timestamp: new Date().toISOString(),
    buildId,
    data,
  });
}

/**
 * Emit task started event
 */
export function emitTaskStarted(
  buildId: string,
  taskId: string,
  phase: string,
  action: string,
  filePath: string,
): void {
  emitBuildEvent("task:started", buildId, {
    taskId,
    phase,
    action,
    filePath,
    status: "running",
  });
}

/**
 * Emit task completed event
 */
export function emitTaskCompleted(
  buildId: string,
  taskId: string,
  tasksCompleted: number,
  tasksTotal: number,
): void {
  emitBuildEvent("task:completed", buildId, {
    taskId,
    status: "completed",
    tasksCompleted,
    tasksTotal,
    progressPct: Math.round((tasksCompleted / tasksTotal) * 100),
  });
}

/**
 * Emit task failed event
 */
export function emitTaskFailed(
  buildId: string,
  taskId: string,
  error: string,
): void {
  emitBuildEvent("task:failed", buildId, {
    taskId,
    status: "failed",
    error,
  });
}

/**
 * Emit build progress event
 */
export function emitBuildProgress(
  buildId: string,
  tasksCompleted: number,
  tasksTotal: number,
  tasksFailed: number,
  currentTaskId?: string,
): void {
  emitBuildEvent("build:progress", buildId, {
    taskId: currentTaskId,
    tasksCompleted,
    tasksTotal,
    tasksFailed,
    progressPct: Math.round((tasksCompleted / tasksTotal) * 100),
  });
}

/**
 * Get count of clients watching a build
 */
export function getBuildClientCount(buildId: string): number {
  return buildMonitorClients.get(buildId)?.size || 0;
}

// ============================================
// User Notification Functions
// ============================================

/**
 * Broadcast an event to all connections for a specific user
 */
export function broadcastToUser(
  userId: string,
  event: string,
  data: unknown,
): void {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) {
    return;
  }

  const message = JSON.stringify({ event, data });

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Register a handler for user-specific events
 * Used by notification system to handle mark-read, archive, etc.
 */
export function onUserEvent(
  event: string,
  handler: (userId: string, data: Record<string, unknown>) => void,
): void {
  userEventHandlers.set(event, handler);
}

/**
 * Remove a handler for a user event
 */
export function offUserEvent(event: string): void {
  userEventHandlers.delete(event);
}

/**
 * Get count of connections for a user
 */
export function getUserConnectionCount(userId: string): number {
  return userConnections.get(userId)?.size || 0;
}

/**
 * Get all connected user IDs
 */
export function getConnectedUsers(): string[] {
  return Array.from(userConnections.keys());
}

/**
 * Check if a user has any active connections
 */
export function isUserConnected(userId: string): boolean {
  const connections = userConnections.get(userId);
  return !!(connections && connections.size > 0);
}

// ============================================
// Task Executor Functions
// ============================================

// Observability event types
export type ObservabilityEventType =
  | "observability:connected" // Client connected to observability stream
  | "transcript:entry" // New transcript entry (tool use, user message, etc.)
  | "tool:started" // Tool execution started
  | "tool:completed" // Tool execution completed
  | "assertion:recorded" // Assertion result recorded
  | "skill:invoked" // Skill invoked
  | "execution:started" // Execution run started
  | "execution:completed" // Execution run completed
  | "execution:failed"; // Execution run failed

export interface ObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
  executionId: string;
  data: {
    entryId?: string;
    toolName?: string;
    skillName?: string;
    result?: string;
    duration?: number;
    assertionId?: string;
    assertionResult?: "pass" | "fail" | "skip" | "warn";
    description?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    [key: string]: unknown;
  };
}

// Track connected clients for observability monitoring
const observabilityClients = new Map<string, Set<WebSocket>>(); // executionId -> clients
const observabilityGlobalClients = new Set<WebSocket>(); // clients watching all executions

// Task executor event types
export type TaskExecutorEventType =
  | "executor:started" // Executor started autonomous execution
  | "executor:paused" // Executor paused
  | "executor:resumed" // Executor resumed
  | "executor:stopped" // Executor stopped
  | "executor:complete" // All tasks completed
  | "task:queued" // Task added to queue
  | "task:started" // Task execution started
  | "task:completed" // Task execution completed
  | "task:failed" // Task execution failed
  | "task:skipped" // Task skipped
  | "task:requeued" // Task requeued
  | "task:blocked" // Task blocked waiting for user input
  | "task:resumed" // Task resumed after user input
  | "task:claimed" // Task claimed by an agent
  | "task:released" // Task released back to queue
  | "task:progress" // Task execution progress update
  | "task:timeout" // Task execution timed out
  | "task:error" // Task execution error
  | "tasklist:loaded" // Task list loaded
  | "question:answered" // Question answered
  | "question:expired"; // Question expired

export interface TaskExecutorEvent {
  type: TaskExecutorEventType;
  timestamp: string;
  data: {
    taskId?: string;
    description?: string;
    priority?: string;
    status?: string;
    agent?: string;
    output?: string;
    error?: string;
    attempts?: number;
    taskListPath?: string;
    pendingTasks?: number;
    completedTasks?: number;
    failedTasks?: number;
    totalTasks?: number;
    [key: string]: unknown;
  };
}

// Track connected task executor clients
const taskExecutorClients = new Set<WebSocket>();

/**
 * Add a client to the task executor room
 */
export function addTaskExecutorClient(ws: WebSocket): void {
  taskExecutorClients.add(ws);
  console.log(
    `Client joined task executor (${taskExecutorClients.size} connected)`,
  );
}

/**
 * Remove a client from the task executor room
 */
export function removeTaskExecutorClient(ws: WebSocket): void {
  taskExecutorClients.delete(ws);
  console.log(
    `Client left task executor (${taskExecutorClients.size} connected)`,
  );
}

/**
 * Broadcast an event to all task executor clients
 */
export function broadcastTaskExecutorEvent(event: TaskExecutorEvent): void {
  if (taskExecutorClients.size === 0) {
    return;
  }

  const message = JSON.stringify(event);
  console.log(
    `[WS] Broadcasting ${event.type} to ${taskExecutorClients.size} task executor clients`,
  );

  taskExecutorClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit a task executor event
 */
export function emitTaskExecutorEvent(
  type: TaskExecutorEventType,
  data: TaskExecutorEvent["data"] = {},
): void {
  broadcastTaskExecutorEvent({
    type,
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Get count of connected task executor clients
 */
export function getTaskExecutorClientCount(): number {
  return taskExecutorClients.size;
}

// ============================================
// Observability Functions
// ============================================

/**
 * Broadcast an observability event to all clients watching
 */
export function broadcastObservabilityEvent(event: ObservabilityEvent): void {
  const message = JSON.stringify(event);

  // Send to execution-specific clients
  const execRoom = observabilityClients.get(event.executionId);
  if (execRoom && execRoom.size > 0) {
    execRoom.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send to global clients (watching all executions)
  if (observabilityGlobalClients.size > 0) {
    observabilityGlobalClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

/**
 * Helper to emit an observability event
 */
export function emitObservabilityEvent(
  type: ObservabilityEventType,
  executionId: string,
  data: ObservabilityEvent["data"] = {},
): void {
  broadcastObservabilityEvent({
    type,
    timestamp: new Date().toISOString(),
    executionId,
    data,
  });
}

/**
 * Emit transcript entry event
 */
export function emitTranscriptEntry(
  executionId: string,
  entryId: string,
  metadata?: Record<string, unknown>,
): void {
  emitObservabilityEvent("transcript:entry", executionId, {
    entryId,
    metadata,
  });
}

/**
 * Emit tool started event
 */
export function emitToolStarted(
  executionId: string,
  entryId: string,
  toolName: string,
): void {
  emitObservabilityEvent("tool:started", executionId, {
    entryId,
    toolName,
  });
}

/**
 * Emit tool completed event
 */
export function emitToolCompleted(
  executionId: string,
  entryId: string,
  toolName: string,
  result: string,
  duration: number,
): void {
  emitObservabilityEvent("tool:completed", executionId, {
    entryId,
    toolName,
    result,
    duration,
  });
}

/**
 * Emit assertion recorded event
 */
export function emitAssertionRecorded(
  executionId: string,
  assertionId: string,
  assertionResult: "pass" | "fail" | "skip" | "warn",
  description: string,
): void {
  emitObservabilityEvent("assertion:recorded", executionId, {
    assertionId,
    assertionResult,
    description,
  });
}

/**
 * Emit skill invoked event
 */
export function emitSkillInvoked(
  executionId: string,
  entryId: string,
  skillName: string,
): void {
  emitObservabilityEvent("skill:invoked", executionId, {
    entryId,
    skillName,
  });
}

/**
 * Emit execution started event
 */
export function emitExecutionStarted(executionId: string): void {
  emitObservabilityEvent("execution:started", executionId, {});
}

/**
 * Emit execution completed event
 */
export function emitExecutionCompleted(executionId: string): void {
  emitObservabilityEvent("execution:completed", executionId, {});
}

/**
 * Emit execution failed event
 */
export function emitExecutionFailed(executionId: string, error: string): void {
  emitObservabilityEvent("execution:failed", executionId, { error });
}

/**
 * Get count of clients watching an execution
 */
export function getObservabilityClientCount(executionId?: string): number {
  if (executionId) {
    return observabilityClients.get(executionId)?.size || 0;
  }
  return observabilityGlobalClients.size;
}

// ============================================
// Pipeline Dashboard Functions
// ============================================

export type PipelineEventType =
  | "pipeline:connected" // Client connected to pipeline stream
  | "pipeline:event" // Generic pipeline event
  | "pipeline:status" // Pipeline status update
  | "wave:started" // Wave started
  | "wave:completed" // Wave completed
  | "task:started" // Task started
  | "task:completed" // Task completed
  | "task:failed" // Task failed
  | "task:blocked" // Task blocked
  | "task:unblocked" // Task unblocked
  | "agent:assigned" // Agent assigned to task
  | "agent:idle" // Agent became idle
  | "conflict:detected" // Conflict detected
  | "dependency:resolved" // Dependency resolved
  | "pipeline:completed" // Pipeline completed
  | "pipeline:failed" // Pipeline failed
  // Decomposition events
  | "decomposition:started" // Task decomposition started
  | "decomposition:completed" // Task decomposition completed
  | "decomposition:failed" // Task decomposition failed
  | "subtask:created"; // Subtask created from decomposition

export interface PipelineStreamEvent {
  type: "pipeline:event" | "pipeline:status";
  timestamp: string;
  payload: {
    id?: string;
    eventType?: PipelineEventType;
    waveNumber?: number;
    taskId?: string;
    taskDisplayId?: string;
    agentId?: string;
    agentName?: string;
    duration?: number;
    reason?: string;
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Broadcast an event to all pipeline dashboard clients
 */
export function broadcastPipelineEvent(event: PipelineStreamEvent): void {
  if (pipelineClients.size === 0) {
    return;
  }

  const message = JSON.stringify(event);
  console.log(
    `[WS] Broadcasting pipeline event to ${pipelineClients.size} clients`,
  );

  pipelineClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Helper to emit a pipeline event
 */
export function emitPipelineEvent(
  eventType: PipelineEventType,
  payload: PipelineStreamEvent["payload"] = {},
): void {
  const id = `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  broadcastPipelineEvent({
    type: "pipeline:event",
    timestamp: new Date().toISOString(),
    payload: {
      id,
      eventType,
      ...payload,
    },
  });
}

/**
 * Emit pipeline status update
 */
export function emitPipelineStatus(status: Record<string, unknown>): void {
  broadcastPipelineEvent({
    type: "pipeline:status",
    timestamp: new Date().toISOString(),
    payload: status as PipelineStreamEvent["payload"],
  });
}

/**
 * Get count of connected pipeline clients
 */
export function getPipelineClientCount(): number {
  return pipelineClients.size;
}

// ============================================
// Task Decomposition Functions
// ============================================

/**
 * Emit decomposition started event
 */
export function emitDecompositionStarted(
  taskId: string,
  taskDisplayId: string,
  reason: string,
): void {
  emitPipelineEvent("decomposition:started", {
    taskId,
    taskDisplayId,
    reason,
  });
}

/**
 * Emit decomposition completed event
 */
export function emitDecompositionCompleted(
  taskId: string,
  taskDisplayId: string,
  subtaskIds: string[],
  subtaskCount: number,
): void {
  emitPipelineEvent("decomposition:completed", {
    taskId,
    taskDisplayId,
    subtaskIds,
    subtaskCount,
  });
}

/**
 * Emit decomposition failed event
 */
export function emitDecompositionFailed(
  taskId: string,
  taskDisplayId: string,
  error: string,
): void {
  emitPipelineEvent("decomposition:failed", {
    taskId,
    taskDisplayId,
    error,
  });
}

/**
 * Emit subtask created event
 */
export function emitSubtaskCreated(
  parentTaskId: string,
  subtaskId: string,
  subtaskDisplayId: string,
  subtaskTitle: string,
  position: number,
): void {
  emitPipelineEvent("subtask:created", {
    parentTaskId,
    subtaskId,
    subtaskDisplayId,
    subtaskTitle,
    position,
  });
}

// ============================================
// Platform Events Functions
// ============================================

/**
 * Broadcast a platform event to all connected events clients.
 * This is a low-level broadcast function. Prefer using eventService.emitEvent()
 * which handles both database persistence and WebSocket broadcast.
 */
export function broadcastPlatformEvent(event: {
  type: string;
  timestamp: string;
  event: unknown;
}): void {
  if (eventsClients.size === 0) return;

  const message = JSON.stringify(event);

  eventsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Get count of connected events clients.
 */
export function getEventsClientCount(): number {
  return eventsClients.size;
}

export { wss };
