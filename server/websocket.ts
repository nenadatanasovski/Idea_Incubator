/**
 * WebSocket server for real-time debate streaming
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

// Track connected clients by idea slug
const debateRooms = new Map<string, Set<WebSocket>>();

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

    if (!ideaSlug) {
      ws.close(4000, 'Missing idea parameter');
      return;
    }

    // Join the debate room for this idea
    if (!debateRooms.has(ideaSlug)) {
      debateRooms.set(ideaSlug, new Set());
    }
    debateRooms.get(ideaSlug)!.add(ws);

    console.log(`Client joined debate room: ${ideaSlug}`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        ideaSlug,
        data: { message: 'Connected to debate stream' },
      })
    );

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
      const room = debateRooms.get(ideaSlug);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          debateRooms.delete(ideaSlug);
        }
      }
      console.log(`Client left debate room: ${ideaSlug}`);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${ideaSlug}:`, err);
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

export { wss };
