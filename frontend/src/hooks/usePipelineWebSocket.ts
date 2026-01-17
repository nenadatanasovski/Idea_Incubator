/**
 * usePipelineWebSocket Hook
 *
 * Real-time WebSocket connection for pipeline events with automatic reconnection.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  PipelineEvent,
  PipelineStatus,
  ProjectOption,
  TaskListOption,
} from "../types/pipeline";

interface UsePipelineWebSocketOptions {
  enabled?: boolean;
  onEvent?: (event: PipelineEvent) => void;
  onStatusChange?: (status: PipelineStatus) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UsePipelineWebSocketResult {
  isConnected: boolean;
  events: PipelineEvent[];
  error: Error | null;
  reconnect: () => void;
  clearEvents: () => void;
}

// Use Vite proxy for WebSocket connections (same port as frontend)
// This ensures consistent behavior with AgentDashboard and avoids CORS issues
function getWsBaseUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = window.location.hostname;
  const wsPort = window.location.port || "3000";
  return `${wsProtocol}//${wsHost}:${wsPort}`;
}

export default function usePipelineWebSocket(
  options: UsePipelineWebSocketOptions = {},
): UsePipelineWebSocketResult {
  const {
    enabled = true,
    onEvent,
    onStatusChange,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Use refs for callbacks to avoid reconnection loops when callbacks change
  const onEventRef = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);

  // Update refs when callbacks change
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${getWsBaseUrl()}/ws?pipeline=stream`);

      ws.onopen = () => {
        // Only log on first connection or after successful reconnect
        if (reconnectAttempts.current > 0) {
          console.log("[Pipeline WS] Reconnected successfully");
        }
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          if (data.type === "pipeline:event") {
            const pipelineEvent: PipelineEvent = data.payload;
            setEvents((prev) => [...prev.slice(-999), pipelineEvent]);
            onEventRef.current?.(pipelineEvent);
          } else if (data.type === "pipeline:status") {
            onStatusChangeRef.current?.(data.payload);
          } else if (data.type === "ping") {
            // Respond to ping with pong
            ws.send(JSON.stringify({ type: "pong" }));
          }
          // Silently ignore other message types (connected, etc.)
        } catch {
          // Silently ignore parse errors for non-JSON messages
        }
      };

      ws.onerror = () => {
        // WebSocket errors are usually followed by close events
        // Only set error state, don't log (close handler will manage reconnection)
        setError(new Error("WebSocket connection error"));
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect if not intentionally closed and still mounted
        if (
          event.code !== 1000 &&
          enabled &&
          mountedRef.current &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current++;
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttempts.current - 1),
            30000,
          );
          // Only log first few attempts to reduce noise
          if (reconnectAttempts.current <= 3) {
            console.log(`[Pipeline WS] Reconnecting in ${delay}ms...`);
          }
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      wsRef.current = ws;
    } catch {
      // Connection failed - this is expected if server is down
      setError(new Error("Connection failed"));
    }
  }, [enabled, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional close");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    events,
    error,
    reconnect,
    clearEvents,
  };
}

// Hook for fetching initial pipeline status via REST
export function usePipelineStatus(filters?: {
  projectId?: string;
  taskListId?: string;
}) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);

      // Build query string from filters
      const params = new URLSearchParams();
      if (filters?.projectId && filters.projectId !== "all") {
        params.set("projectId", filters.projectId);
      }
      if (filters?.taskListId && filters.taskListId !== "all") {
        params.set("taskListId", filters.taskListId);
      }

      const queryString = params.toString();
      const url = `/api/pipeline/status${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      // Silently handle fetch errors - the UI will show error state
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    } finally {
      setLoading(false);
    }
  }, [filters?.projectId, filters?.taskListId]);

  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refetch };
}

// Hook for fetching pipeline events via REST
export function usePipelineEvents(limit = 100) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pipeline/events?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setEvents(data);
      setError(null);
    } catch (err) {
      // Silently handle fetch errors - the UI will show error state
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

// Hook for fetching filter options (projects and task lists)
export function usePipelineFilters() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [taskLists, setTaskLists] = useState<TaskListOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/pipeline/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    }
  }, []);

  const fetchTaskLists = useCallback(async (projectId?: string) => {
    try {
      const url =
        projectId && projectId !== "all"
          ? `/api/pipeline/task-lists?projectId=${encodeURIComponent(projectId)}`
          : "/api/pipeline/task-lists";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch task lists");
      const data = await response.json();
      setTaskLists(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchTaskLists()]);
      setLoading(false);
    };
    init();
  }, [fetchProjects, fetchTaskLists]);

  return {
    projects,
    taskLists,
    loading,
    error,
    refetchTaskLists: fetchTaskLists,
  };
}
