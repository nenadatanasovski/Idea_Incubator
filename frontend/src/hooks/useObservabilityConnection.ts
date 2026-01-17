/**
 * useObservabilityConnection Hook
 *
 * Single WebSocket connection for all Observability tabs with automatic reconnection.
 * Provides connection status and event subscriptions for real-time updates.
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

export type ObservabilityEventType =
  | "execution"
  | "agent"
  | "question"
  | "event"
  | "tool-use"
  | "assertion";

export interface ObservabilityEvent {
  type: ObservabilityEventType;
  action:
    | "started"
    | "updated"
    | "completed"
    | "failed"
    | "created"
    | "answered"
    | "blocked";
  id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface UseObservabilityConnectionOptions {
  enabled?: boolean;
  onEvent?: (event: ObservabilityEvent) => void;
  subscriptions?: ObservabilityEventType[];
}

interface UseObservabilityConnectionResult {
  status: ConnectionStatus;
  isConnected: boolean;
  events: ObservabilityEvent[];
  error: Error | null;
  reconnect: () => void;
  clearEvents: () => void;
  subscribe: (eventTypes: ObservabilityEventType[]) => void;
}

// Connect directly to the API server on port 3001
const WS_BASE_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3001`
    : "ws://localhost:3001";

export default function useObservabilityConnection(
  options: UseObservabilityConnectionOptions = {},
): UseObservabilityConnectionResult {
  const {
    enabled = true,
    onEvent,
    subscriptions = ["execution", "agent", "question", "event"],
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const subscriptionsRef = useRef<ObservabilityEventType[]>(subscriptions);

  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Update subscriptions ref when prop changes
  useEffect(() => {
    subscriptionsRef.current = subscriptions;
    // Send updated subscriptions if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "subscribe", eventTypes: subscriptions }),
      );
    }
  }, [subscriptions]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const subscribe = useCallback((eventTypes: ObservabilityEventType[]) => {
    subscriptionsRef.current = eventTypes;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", eventTypes }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    )
      return;

    try {
      setStatus("reconnecting");

      // Server expects observability=all or observability={executionId}
      const ws = new WebSocket(`${WS_BASE_URL}/ws?observability=all`);

      ws.onopen = () => {
        console.log("[Observability WS] Connected");
        setStatus("connected");
        setError(null);
        reconnectAttempts.current = 0;

        // Subscribe to events
        ws.send(
          JSON.stringify({
            type: "subscribe",
            eventTypes: subscriptionsRef.current,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          if (data.type === "observability:event" || data.type === "event") {
            const obsEvent: ObservabilityEvent = {
              type: data.eventType || data.payload?.type || "event",
              action: data.action || data.payload?.action || "updated",
              id: data.id || data.payload?.id || "",
              timestamp: data.timestamp || new Date().toISOString(),
              data: data.payload || data.data || {},
            };

            // Only process if subscribed to this event type
            if (subscriptionsRef.current.includes(obsEvent.type)) {
              setEvents((prev) => [...prev.slice(-99), obsEvent]);
              onEvent?.(obsEvent);
            }
          } else if (data.type === "ping") {
            // Respond to ping with pong
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch (err) {
          console.error("[Observability WS] Failed to parse message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[Observability WS] Error:", event);
        setError(new Error("WebSocket connection error"));
      };

      ws.onclose = (event) => {
        console.log(
          "[Observability WS] Disconnected:",
          event.code,
          event.reason,
        );
        wsRef.current = null;

        // Attempt reconnect if not intentionally closed
        if (event.code !== 1000 && enabled) {
          setStatus("reconnecting");
          reconnectAttempts.current++;

          // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current - 1),
            30000,
          );

          console.log(
            `[Observability WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`,
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setStatus("offline");
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[Observability WS] Failed to connect:", err);
      setError(err instanceof Error ? err : new Error("Connection failed"));
      setStatus("offline");
    }
  }, [enabled, onEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional close");
      wsRef.current = null;
    }

    setStatus("offline");
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    status,
    isConnected: status === "connected",
    events,
    error,
    reconnect,
    clearEvents,
    subscribe,
  };
}
