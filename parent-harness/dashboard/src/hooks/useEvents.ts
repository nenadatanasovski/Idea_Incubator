import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import type { ObservabilityEvent } from "../api/types";

interface UseEventsResult {
  events: ObservabilityEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEvents(limit = 50): UseEventsResult {
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<ObservabilityEvent[]>(
        `/api/events?limit=${limit}`,
      );
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

export default useEvents;
