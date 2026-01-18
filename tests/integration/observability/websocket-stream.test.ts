/**
 * OBS-612: WebSocket Stream Integration Tests
 *
 * End-to-end tests for WebSocket observability streaming.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { WebSocket } from "ws";
import { createServer, Server as HttpServer } from "http";
import { initWebSocket, closeWebSocket } from "../../../server/websocket.js";
import {
  observabilityStream,
  ObservabilityStreamService,
} from "../../../server/services/observability/index.js";

describe("WebSocket Observability Streaming", () => {
  let httpServer: HttpServer;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();

    // Initialize WebSocket server
    initWebSocket(httpServer);

    // Start listening
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        port =
          typeof address === "object" && address !== null ? address.port : 0;
        wsUrl = `ws://localhost:${port}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    closeWebSocket();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    ObservabilityStreamService.resetInstance();
  });

  describe("connection", () => {
    it("connects with observability=all parameter", async () => {
      const ws = new WebSocket(`${wsUrl}?observability=all`);

      const connected = await new Promise<boolean>((resolve) => {
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "observability:connected") {
            resolve(true);
          }
        });
        ws.on("error", () => resolve(false));
        setTimeout(() => resolve(false), 2000);
      });

      ws.close();
      expect(connected).toBe(true);
    });

    it("connects with specific execution ID", async () => {
      const executionId = "test-exec-123";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      const message = await new Promise<any>((resolve) => {
        ws.on("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        ws.on("error", () => resolve(null));
        setTimeout(() => resolve(null), 2000);
      });

      ws.close();
      expect(message?.type).toBe("observability:connected");
      expect(message?.executionId).toBe(executionId);
    });

    it("closes connection without any valid parameter", async () => {
      const ws = new WebSocket(wsUrl);

      // Wait for close event - server should close connections without valid params
      const result = await new Promise<{ closed: boolean; code?: number }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            resolve({ closed: false });
          }, 2000);

          ws.on("close", (code) => {
            clearTimeout(timeout);
            resolve({ closed: true, code });
          });

          ws.on("error", () => {
            clearTimeout(timeout);
            resolve({ closed: true });
          });
        },
      );

      expect(result.closed).toBe(true);
    });
  });

  describe("event streaming", () => {
    it("receives wave:status events", async () => {
      const executionId = "test-exec-wave";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      // Setup event promise before emitting
      const eventPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      // Small delay to ensure handler is registered
      await new Promise((r) => setTimeout(r, 50));

      // Emit wave status event
      observabilityStream.emitWaveStatus(executionId, 1, "running", 5, 2, 0);

      const event = await eventPromise;
      ws.close();

      expect(event?.type).toBe("wave:status");
      expect(event?.executionId).toBe(executionId);
      expect(event?.waveNumber).toBe(1);
      expect(event?.status).toBe("running");
    });

    it("receives execution:status events", async () => {
      const executionId = "test-exec-status";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      const eventPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      await new Promise((r) => setTimeout(r, 50));

      observabilityStream.emitExecutionStatus(
        executionId,
        "started",
        "Starting execution",
      );

      const event = await eventPromise;
      ws.close();

      expect(event?.type).toBe("execution:status");
      expect(event?.executionId).toBe(executionId);
      expect(event?.status).toBe("started");
    });

    it("receives agent:heartbeat events", async () => {
      const executionId = "test-exec-heartbeat";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      const eventPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      await new Promise((r) => setTimeout(r, 50));

      observabilityStream.emitAgentHeartbeat(
        executionId,
        "instance-1",
        "working",
        "task-1",
        { cpuUsage: 50 },
      );

      const event = await eventPromise;
      ws.close();

      expect(event?.type).toBe("agent:heartbeat");
      expect(event?.instanceId).toBe("instance-1");
      expect(event?.status).toBe("working");
    });
  });

  describe("global subscription", () => {
    it("receives events for all executions with observability=all", async () => {
      const ws = new WebSocket(`${wsUrl}?observability=all`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      const eventPromise = new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      await new Promise((r) => setTimeout(r, 50));

      // Emit to a specific execution - global subscriber should receive it
      observabilityStream.emitWaveStatus(
        "some-other-exec",
        1,
        "running",
        5,
        2,
        0,
      );

      const event = await eventPromise;
      ws.close();

      expect(event?.type).toBe("wave:status");
      expect(event?.executionId).toBe("some-other-exec");
    });
  });

  describe("ping/pong", () => {
    it("responds to ping messages", async () => {
      const executionId = "test-exec-ping";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      // Send ping
      ws.send(JSON.stringify({ type: "ping" }));

      const response = await new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      ws.close();

      expect(response?.type).toBe("pong");
      expect(response?.timestamp).toBeDefined();
    });
  });

  describe("subscription management", () => {
    it("handles subscription requests", async () => {
      const executionId = "test-exec-sub";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      // Send subscription request
      ws.send(
        JSON.stringify({
          action: "subscribe",
          topic: "waves",
          executionId,
        }),
      );

      const response = await new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      ws.close();

      expect(response?.type).toBe("observability:subscribed");
      expect(response?.topic).toBe("waves");
    });
  });

  describe("error handling", () => {
    it("returns error for invalid messages", async () => {
      const executionId = "test-exec-err";
      const ws = new WebSocket(`${wsUrl}?observability=${executionId}`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 2000);
      });

      // Skip the connected message
      await new Promise<void>((resolve) => {
        ws.once("message", () => resolve());
      });

      // Send invalid JSON
      ws.send("not valid json");

      const response = await new Promise<any>((resolve) => {
        ws.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        setTimeout(() => resolve(null), 3000);
      });

      ws.close();

      expect(response?.type).toBe("observability:error");
      expect(response?.code).toBe("INVALID_MESSAGE");
    });
  });
});
