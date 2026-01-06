/**
 * WebSocket server for real-time debate streaming and ideation updates
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// Event types that can be broadcast during a debate
export type DebateEventType =
  | 'debate:started'
  | 'debate:criterion:start'     // Marks start of debate for a specific criterion
  | 'debate:round:started'
  | 'evaluator:initial'          // Initial assessment (before debate)
  | 'evaluator:speaking'         // DEPRECATED: Use evaluator:initial or evaluator:defense
  | 'evaluator:defense'          // Defense against red team (during debate)
  | 'redteam:challenge'
  | 'arbiter:verdict'
  | 'debate:round:complete'
  | 'debate:criterion:complete'  // Marks end of debate for a specific criterion
  | 'debate:complete'
  | 'synthesis:started'
  | 'synthesis:complete'
  | 'error';

// Event types for ideation sessions
export type IdeationEventType =
  | 'artifact:updating'    // Artifact edit in progress
  | 'artifact:updated'     // Artifact edit completed
  | 'artifact:created'     // New artifact created (e.g., by sub-agent)
  | 'artifact:deleted'     // Artifact deleted
  | 'artifact:error'       // Artifact edit failed
  | 'classifications:updated' // Classifications have been updated
  | 'subagent:spawn'       // When a sub-agent starts
  | 'subagent:status'      // When a sub-agent status changes (running/completed/failed)
  | 'subagent:result';     // When a sub-agent produces results

// Sub-agent status types
export type SubAgentStatus = 'spawning' | 'running' | 'completed' | 'failed';

// Sub-agent types (extended to support orchestrator task types)
export type SubAgentType =
  | 'research'              // Web research agent
  | 'evaluator'             // Idea evaluation agent
  | 'redteam'               // Red team challenge agent
  | 'development'           // Idea development agent
  | 'synthesis'             // Synthesis agent
  | 'action-plan'           // Action plan generator
  | 'pitch-refine'          // Pitch refinement agent
  | 'architecture-explore'  // Architecture exploration agent
  | 'custom';               // Custom task agent

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

// Track connected clients by idea slug (for debates)
const debateRooms = new Map<string, Set<WebSocket>>();

// Track connected clients by session ID (for ideation)
const sessionRooms = new Map<string, Set<WebSocket>>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server attached to HTTP server
 */
export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const ideaSlug = url.searchParams.get('idea');
    const sessionId = url.searchParams.get('session');

    // Must have either idea or session parameter
    if (!ideaSlug && !sessionId) {
      ws.close(4000, 'Missing idea or session parameter');
      return;
    }

    // Join the appropriate room
    if (sessionId) {
      // Ideation session room
      if (!sessionRooms.has(sessionId)) {
        sessionRooms.set(sessionId, new Set());
      }
      sessionRooms.get(sessionId)!.add(ws);
      console.log(`Client joined ideation session: ${sessionId}`);

      ws.send(
        JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          sessionId,
          data: { message: 'Connected to ideation session' },
        })
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
          type: 'connected',
          timestamp: new Date().toISOString(),
          ideaSlug,
          data: { message: 'Connected to debate stream' },
        })
      );
    }

    // Handle client messages (e.g., ping/pong)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Clean up on disconnect
    ws.on('close', () => {
      if (sessionId) {
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

    ws.on('error', (err) => {
      console.error(`WebSocket error:`, err);
    });
  });

  console.log('WebSocket server initialized on /ws');
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

  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Helper to create and broadcast a debate event
 */
export function emitDebateEvent(
  type: DebateEventType,
  ideaSlug: string,
  runId: string,
  data: DebateEvent['data'] = {}
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
    console.log(`[WS] No clients in session ${event.sessionId} to receive event`);
    return;
  }

  const message = JSON.stringify(event);
  console.log(`[WS] Broadcasting ${event.type} to ${room.size} clients in session ${event.sessionId}`);

  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Helper to emit an ideation session event
 */
export function emitSessionEvent(
  type: IdeationEventType,
  sessionId: string,
  data: IdeationEvent['data'] = {}
): void {
  broadcastSessionEvent({
    type,
    timestamp: new Date().toISOString(),
    sessionId,
    data,
  });
}

/**
 * Helper to emit a sub-agent spawn event
 */
export function emitSubAgentSpawn(
  sessionId: string,
  subAgentId: string,
  subAgentType: SubAgentType,
  subAgentName: string
): void {
  emitSessionEvent('subagent:spawn', sessionId, {
    subAgentId,
    subAgentType,
    subAgentName,
    subAgentStatus: 'spawning' as SubAgentStatus,
  });
}

/**
 * Helper to emit a sub-agent status change event
 */
export function emitSubAgentStatus(
  sessionId: string,
  subAgentId: string,
  status: SubAgentStatus,
  error?: string
): void {
  emitSessionEvent('subagent:status', sessionId, {
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
  result: unknown
): void {
  emitSessionEvent('subagent:result', sessionId, {
    subAgentId,
    subAgentStatus: 'completed' as SubAgentStatus,
    result,
  });
}

export { wss };
