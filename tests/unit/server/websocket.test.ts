/**
 * Tests for WebSocket server module
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'http';
import WebSocket from 'ws';
import {
  initWebSocket,
  closeWebSocket,
  emitDebateEvent,
  getClientCount,
  getActiveRooms,
  broadcastDebateEvent,
} from '../../../server/websocket.js';

describe('WebSocket Server', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    initWebSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    closeWebSocket();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections with idea parameter', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        ws.on('error', reject);
      });
    });

    it('should reject connections without idea parameter', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);

      const closeCode = await new Promise<number>((resolve) => {
        ws.on('close', (code) => resolve(code));
        ws.on('error', () => {
          // Expected to fail
        });
      });

      expect(closeCode).toBe(4000);
    });

    it('should send welcome message on connection', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      const event = await new Promise<{ type: string; ideaSlug: string; data: { message: string } }>((resolve, reject) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
        ws.on('error', reject);
      });

      expect(event.type).toBe('connected');
      expect(event.ideaSlug).toBe('test-idea');
      expect(event.data.message).toBe('Connected to debate stream');
      ws.close();
    });
  });

  describe('Room Management', () => {
    it('should track active rooms', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Need a small delay for the room to be registered
      await new Promise((r) => setTimeout(r, 50));

      const rooms = getActiveRooms();
      expect(rooms).toContain('test-idea');
      ws.close();
    });

    it('should track client count per room', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          ws1.on('open', resolve);
          ws1.on('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          ws2.on('open', resolve);
          ws2.on('error', reject);
        }),
      ]);

      await new Promise((r) => setTimeout(r, 50));

      expect(getClientCount('test-idea')).toBe(2);
      ws1.close();
      ws2.close();
    });

    it('should remove room when all clients disconnect', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      ws.close();

      await new Promise<void>((resolve) => {
        ws.on('close', resolve);
      });

      await new Promise((r) => setTimeout(r, 50));

      const rooms = getActiveRooms();
      expect(rooms).not.toContain('test-idea');
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to connected clients', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);
      const events: Array<{ type: string }> = [];

      const eventPromise = new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          events.push(event);

          if (event.type === 'connected') {
            // Send a test event after connected
            setTimeout(() => {
              emitDebateEvent('debate:started', 'test-idea', 'run-123', {
                message: 'Debate started',
              });
            }, 50);
          } else if (event.type === 'debate:started') {
            expect(event.ideaSlug).toBe('test-idea');
            expect(event.runId).toBe('run-123');
            expect(event.data.message).toBe('Debate started');
            resolve();
          }
        });
        ws.on('error', reject);
      });

      await eventPromise;
      ws.close();
    });

    it('should only broadcast to clients in the same room', async () => {
      const ws1 = new WebSocket(`ws://localhost:${port}/ws?idea=idea-1`);
      const ws2 = new WebSocket(`ws://localhost:${port}/ws?idea=idea-2`);

      let ws2ReceivedNonWelcome = false;

      // Wait for both to connect
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          ws1.on('message', (data) => {
            const event = JSON.parse(data.toString());
            if (event.type === 'connected') {
              resolve();
            }
          });
          ws1.on('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          ws2.on('message', (data) => {
            const event = JSON.parse(data.toString());
            if (event.type === 'connected') {
              resolve();
            } else {
              ws2ReceivedNonWelcome = true;
            }
          });
          ws2.on('error', reject);
        }),
      ]);

      // Listen for events on ws1
      const ws1EventPromise = new Promise<void>((resolve) => {
        ws1.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event.type === 'debate:started') {
            expect(event.ideaSlug).toBe('idea-1');
            resolve();
          }
        });
      });

      // Emit event only to idea-1
      emitDebateEvent('debate:started', 'idea-1', 'run-123', {});

      await ws1EventPromise;

      // Wait a bit to ensure ws2 doesn't receive anything
      await new Promise((r) => setTimeout(r, 100));

      expect(ws2ReceivedNonWelcome).toBe(false);
      ws1.close();
      ws2.close();
    });
  });

  describe('Ping/Pong', () => {
    it('should respond to ping messages', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);

      // Wait for welcome
      await new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event.type === 'connected') {
            resolve();
          }
        });
        ws.on('error', reject);
      });

      // Send ping and wait for pong
      ws.send(JSON.stringify({ type: 'ping' }));

      const pongEvent = await new Promise<{ type: string; timestamp: string }>((resolve) => {
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event.type === 'pong') {
            resolve(event);
          }
        });
      });

      expect(pongEvent.type).toBe('pong');
      expect(pongEvent.timestamp).toBeDefined();
      ws.close();
    });
  });

  describe('broadcastDebateEvent', () => {
    it('should handle broadcast to non-existent room gracefully', () => {
      // This should not throw
      broadcastDebateEvent({
        type: 'debate:started',
        timestamp: new Date().toISOString(),
        ideaSlug: 'non-existent-idea',
        runId: 'run-123',
        data: {},
      });
    });
  });

  describe('Event Types', () => {
    it('should support all debate event types', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?idea=test-idea`);
      const eventTypes = [
        'debate:started',
        'debate:round:started',
        'evaluator:speaking',
        'redteam:challenge',
        'arbiter:verdict',
        'debate:round:complete',
        'debate:complete',
        'synthesis:started',
        'synthesis:complete',
        'error',
      ] as const;

      // Wait for welcome
      await new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event.type === 'connected') {
            resolve();
          }
        });
        ws.on('error', reject);
      });

      // Collect received events
      const receivedTypes: string[] = [];
      const allEventsPromise = new Promise<void>((resolve) => {
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (eventTypes.includes(event.type)) {
            receivedTypes.push(event.type);
            if (receivedTypes.length === eventTypes.length) {
              resolve();
            }
          }
        });
      });

      // Emit all event types
      for (const type of eventTypes) {
        emitDebateEvent(type, 'test-idea', 'run-123', { eventType: type });
      }

      await allEventsPromise;
      expect(receivedTypes).toHaveLength(eventTypes.length);
      ws.close();
    });
  });
});
