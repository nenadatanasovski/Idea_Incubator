/**
 * Observability WebSocket Hook
 * Provides real-time updates for observability data via WebSocket
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ObservabilityEvent,
  ObservabilityEventType,
} from "../types/observability";

interface UseObservabilityStreamOptions {
  executionId?: string;
  autoConnect?: boolean;
  maxEvents?: number;
}

interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  lastConnectedAt: string | null;
}

export function useObservabilityStream(
  options: UseObservabilityStreamOptions = {},
) {
  const { executionId, autoConnect = true, maxEvents = 1000 } = options;

  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    error: null,
    lastConnectedAt: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  // Build WebSocket URL
  const buildWsUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    let url = `${protocol}//${host}/ws?monitor=observability`;
    if (executionId) {
      url += `&execution=${executionId}`;
    }
    return url;
  }, [executionId]);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      maxReconnectDelay,
    );
    return delay;
  }, []);

  // Handle incoming WebSocket message
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Check if it's an observability event
        if (
          (data.type && data.type.startsWith("transcript:")) ||
          data.type?.startsWith("tooluse:") ||
          data.type?.startsWith("assertion:") ||
          data.type?.startsWith("skill:") ||
          data.type?.startsWith("messagebus:")
        ) {
          const obsEvent: ObservabilityEvent = {
            type: data.type as ObservabilityEventType,
            timestamp: data.timestamp || new Date().toISOString(),
            executionId: data.executionId,
            taskId: data.taskId,
            data: data.data,
          };

          setEvents((prev) => {
            const newEvents = [...prev, obsEvent];
            // Keep only the last maxEvents
            if (newEvents.length > maxEvents) {
              return newEvents.slice(-maxEvents);
            }
            return newEvents;
          });
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    },
    [maxEvents],
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const url = buildWsUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setStatus({
          connected: true,
          reconnecting: false,
          error: null,
          lastConnectedAt: new Date().toISOString(),
        });
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setStatus((prev) => ({
          ...prev,
          error: "Connection error",
        }));
      };

      ws.onclose = () => {
        setStatus((prev) => ({
          ...prev,
          connected: false,
        }));

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = getReconnectDelay();
          reconnectAttemptsRef.current++;

          setStatus((prev) => ({
            ...prev,
            reconnecting: true,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus((prev) => ({
            ...prev,
            reconnecting: false,
            error: "Max reconnection attempts reached",
          }));
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setStatus((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to connect",
      }));
    }
  }, [buildWsUrl, handleMessage, getReconnectDelay]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus({
      connected: false,
      reconnecting: false,
      error: null,
      lastConnectedAt: null,
    });
    reconnectAttemptsRef.current = 0;
  }, []);

  // Clear events buffer
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Reconnect when executionId changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
      connect();
    }
  }, [executionId, connect, disconnect]);

  // Filter events by type
  const filterEvents = useCallback(
    (type: ObservabilityEventType | ObservabilityEventType[]) => {
      const types = Array.isArray(type) ? type : [type];
      return events.filter((e) => types.includes(e.type));
    },
    [events],
  );

  // Get latest event of a specific type
  const getLatestEvent = useCallback(
    (type: ObservabilityEventType) => {
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === type) {
          return events[i];
        }
      }
      return null;
    },
    [events],
  );

  return {
    // Connection
    connect,
    disconnect,
    status,

    // Events
    events,
    clearEvents,
    filterEvents,
    getLatestEvent,

    // Derived state
    isConnected: status.connected,
    isReconnecting: status.reconnecting,
    eventCount: events.length,
  };
}
