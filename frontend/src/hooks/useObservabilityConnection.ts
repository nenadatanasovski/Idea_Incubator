/**
 * useObservabilityConnection Hook
 *
 * Single WebSocket connection for all Observability tabs with automatic reconnection.
 * Provides connection status and event subscriptions for real-time updates.
 *
 * NOTE: This hook provides a different abstraction than useObservabilityStream.
 * - useObservabilityStream: Low-level WebSocket for raw observability events (transcript, tool use, etc.)
 * - useObservabilityConnection: High-level WebSocket for dashboard events (execution, agent, question status)
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

/**
 * Dashboard event types for useObservabilityConnection.
 * These are higher-level events for dashboard status updates,
 * NOT the same as ObservabilityEventType from types/observability.ts
 * which is for low-level transcript/tooluse/assertion events.
 */
export type DashboardEventType =
  | "execution"
  | "agent"
  | "question"
  | "event"
  | "tool-use"
  | "assertion";

export interface DashboardEvent {
  type: DashboardEventType;
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

/**
 * @deprecated Use DashboardEventType instead - renamed for clarity
 */
export type ObservabilityEventType = DashboardEventType;

/**
 * @deprecated Use DashboardEvent instead - renamed for clarity
 */
export type ObservabilityEvent = DashboardEvent;

interface UseObservabilityConnectionOptions {
  enabled?: boolean;
  onEvent?: (event: DashboardEvent) => void;
  subscriptions?: DashboardEventType[];
}

interface UseObservabilityConnectionResult {
  status: ConnectionStatus;
  isConnected: boolean;
  events: DashboardEvent[];
  error: Error | null;
  reconnect: () => void;
  clearEvents: () => void;
  subscribe: (eventTypes: DashboardEventType[]) => void;
}

// Use current host for WebSocket connection (goes through Vite proxy in dev)
function getWsBaseUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

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
  const subscriptionsRef = useRef<DashboardEventType[]>(subscriptions);

  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [events, setEvents] = useState<DashboardEvent[]>([]);
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

  const subscribe = useCallback((eventTypes: DashboardEventType[]) => {
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
      const wsUrl = `${getWsBaseUrl()}/ws?observability=all`;
      console.log("[Observability WS] Connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);

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
            const obsEvent: DashboardEvent = {
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

      ws.onerror = () => {
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
