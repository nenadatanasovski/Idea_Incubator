/**
 * Memory Graph Changes Hooks
 * React hooks for fetching memory graph changes with filtering and pagination
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/observability/memory-graph";

// === Types ===

export type ChangeType =
  | "created"
  | "modified"
  | "superseded"
  | "linked"
  | "unlinked"
  | "deleted";

export type TriggerType =
  | "user"
  | "ai_auto"
  | "ai_confirmed"
  | "cascade"
  | "system";

export interface GraphChangeEntry {
  id: string;
  timestamp: string;
  changeType: ChangeType;
  blockId: string;
  blockType: string;
  blockLabel?: string;
  propertyChanged?: string;
  oldValue?: string;
  newValue?: string;
  triggeredBy: TriggerType;
  contextSource: string;
  sessionId: string;
  cascadeDepth: number;
  affectedBlocks?: string[];
}

export interface GraphChangeFilters {
  changeType?: ChangeType[];
  triggeredBy?: TriggerType[];
  sessionId?: string;
  timeRange?: string;
  showCascades?: boolean;
  search?: string;
}

export interface GraphChangeStats {
  total: number;
  byChangeType: Record<string, number>;
  byTrigger: Record<string, number>;
  cascadeCount: number;
}

// === useMemoryGraphChanges Hook ===

interface UseMemoryGraphChangesResult {
  entries: GraphChangeEntry[];
  loading: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMemoryGraphChanges(
  filters: GraphChangeFilters = {},
  initialLimit = 50,
): UseMemoryGraphChangesResult {
  const [entries, setEntries] = useState<GraphChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const buildQueryString = useCallback(
    (currentOffset: number) => {
      const params = new URLSearchParams();

      if (filters.sessionId) {
        params.set("sessionId", filters.sessionId);
      }
      if (filters.timeRange) {
        params.set("timeRange", filters.timeRange);
      }
      if (filters.changeType?.length) {
        params.set("changeType", filters.changeType.join(","));
      }
      if (filters.triggeredBy?.length) {
        params.set("triggeredBy", filters.triggeredBy.join(","));
      }
      if (filters.showCascades !== undefined) {
        params.set("showCascades", String(filters.showCascades));
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

  const fetchEntries = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;
        const queryString = buildQueryString(currentOffset);
        const response = await fetch(`${API_BASE}/changes?${queryString}`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (reset) {
          setEntries(data.entries || []);
        } else {
          setEntries((prev) => [...prev, ...(data.entries || [])]);
        }

        setTotal(data.total || 0);
        setHasMore(data.hasMore || false);
        setOffset(currentOffset + (data.entries?.length || 0));
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
    await fetchEntries(false);
  }, [fetchEntries, hasMore, loading]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchEntries(true);
  }, [fetchEntries]);

  // Initial fetch and refetch on filter change
  useEffect(() => {
    setOffset(0);
    fetchEntries(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return {
    entries,
    loading,
    error,
    total,
    hasMore,
    loadMore,
    refresh,
  };
}

// === useMemoryGraphStats Hook ===

interface UseMemoryGraphStatsResult {
  stats: GraphChangeStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMemoryGraphStats(
  sessionId?: string,
  timeRange = "24h",
): UseMemoryGraphStatsResult {
  const [stats, setStats] = useState<GraphChangeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (sessionId) {
        params.set("sessionId", sessionId);
      }
      params.set("timeRange", timeRange);

      const response = await fetch(`${API_BASE}/changes/stats?${params}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [sessionId, timeRange]);

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
