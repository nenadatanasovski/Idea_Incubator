import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 WebSocket client connected');

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'Connected to Parent Harness' },
      timestamp: new Date().toISOString(),
    }));

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📩 WebSocket message:', data);

        // Handle ping/pong
        if (data.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('🔌 WebSocket server initialized on /ws');
  return wss;
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(type: string, payload: unknown): void {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Broadcast event types
 */
export const ws = {
  // Agent events
  agentStatusChanged: (agent: unknown) => broadcast('agent:status', agent),
  agentHeartbeat: (agentId: string) => broadcast('agent:heartbeat', { agentId }),

  // Task events
  taskCreated: (task: unknown) => broadcast('task:created', task),
  taskUpdated: (task: unknown) => broadcast('task:updated', task),
  taskAssigned: (task: unknown, agentId: string) => broadcast('task:assigned', { task, agentId }),
  taskCompleted: (task: unknown) => broadcast('task:completed', task),
  taskFailed: (task: unknown, error: string) => broadcast('task:failed', { task, error }),

  // Session events
  sessionStarted: (session: unknown) => broadcast('session:started', session),
  sessionUpdated: (session: unknown) => broadcast('session:updated', session),
  sessionEnded: (session: unknown) => broadcast('session:ended', session),
  iterationLogged: (iteration: unknown) => broadcast('session:iteration', iteration),

  // Observability events
  event: (event: unknown) => broadcast('event', event),

  // Test events
  testRunStarted: (run: unknown) => broadcast('test:started', run),
  testRunCompleted: (run: unknown) => broadcast('test:completed', run),

  // Budget events
  budgetUpdated: (budget: unknown) => broadcast('budget:updated', budget),

  // Telegram events
  telegramMessage: (message: unknown) => broadcast('telegram:message', message),
};

export default { initWebSocket, broadcast, ws };
