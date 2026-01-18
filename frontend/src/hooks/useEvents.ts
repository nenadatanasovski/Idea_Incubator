/**
 * Platform Events Hooks
 * React hooks for fetching and streaming platform events
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  PlatformEvent,
  EventFilters,
  PaginatedEvents,
  EventStats,
  EventsWebSocketMessage,
} from "../types/events";

const API_BASE = "/api/events";

// === API Fetcher ===

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Unknown error");
  }
  return json;
}

// === useEvents Hook ===

interface UseEventsResult {
  events: PlatformEvent[];
  loading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEvents(
  filters: EventFilters = {},
  initialLimit = 50,
): UseEventsResult {
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const buildQueryString = useCallback(
    (currentOffset: number) => {
      const params = new URLSearchParams();

      if (filters.source?.length) {
        params.set("source", filters.source.join(","));
      }
      if (filters.eventType?.length) {
        params.set("eventType", filters.eventType.join(","));
      }
      if (filters.severity?.length) {
        params.set("severity", filters.severity.join(","));
      }
      if (filters.projectId) {
        params.set("projectId", filters.projectId);
      }
      if (filters.taskId) {
        params.set("taskId", filters.taskId);
      }
      if (filters.executionId) {
        params.set("executionId", filters.executionId);
      }
      if (filters.fromTimestamp) {
        params.set("fromTimestamp", filters.fromTimestamp);
      }
      if (filters.toTimestamp) {
        params.set("toTimestamp", filters.toTimestamp);
      }
      if (filters.search) {
        params.set("search", filters.search);
      }

      params.set("limit", String(initialLimit));
      params.set("offset", String(currentOffset));

      return params.toString();
    },
    [filters, initialLimit],
  );

  const fetchEvents = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;
        const queryString = buildQueryString(currentOffset);
        const response = await fetchApi<PaginatedEvents>(`?${queryString}`);

        if (reset) {
          setEvents(response.data);
        } else {
          setEvents((prev) => [...prev, ...response.data]);
        }

        setTotal(response.total);
        setHasMore(response.hasMore);
        setOffset(currentOffset + response.data.length);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString, offset],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchEvents(false);
  }, [fetchEvents, hasMore, loading]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchEvents(true);
  }, [fetchEvents]);

  // Initial fetch
  useEffect(() => {
    setOffset(0);
    fetchEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return {
    events,
    loading,
    error,
    total,
    hasMore,
    loadMore,
    refresh,
  };
}

// === useEventStream Hook ===

interface UseEventStreamResult {
  events: PlatformEvent[];
  isConnected: boolean;
  error: Error | null;
  clearEvents: () => void;
}

export function useEventStream(maxEvents = 200): UseEventStreamResult {
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws?events=stream`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as EventsWebSocketMessage;

          if (message.type === "platform:event") {
            setEvents((prev) => {
              const newEvents = [message.event, ...prev];
              return newEvents.slice(0, maxEvents);
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30000,
        );
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        setError(new Error("WebSocket connection error"));
        console.error("WebSocket error:", err);
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [maxEvents]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    isConnected,
    error,
    clearEvents,
  };
}

// === useEventStats Hook ===

interface UseEventStatsResult {
  stats: EventStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useEventStats(executionId?: string): UseEventStatsResult {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = executionId
        ? `/stats?executionId=${executionId}`
        : "/stats";
      const response = await fetchApi<{ data: EventStats }>(endpoint);
      setStats(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

// === useEventById Hook ===

export function useEventById(id: string | null): {
  event: PlatformEvent | null;
  loading: boolean;
  error: Error | null;
} {
  const [event, setEvent] = useState<PlatformEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setEvent(null);
      return;
    }

    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchApi<{ data: PlatformEvent }>(`/${id}`);
        setEvent(response.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  return { event, loading, error };
}
