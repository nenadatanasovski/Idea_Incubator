/**
 * Infinite Scroll Hooks (OBS-707)
 * Provides infinite scroll/pagination helpers for large datasets.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
} from "../types/observability";

interface UseInfiniteOptions {
  pageSize?: number;
  threshold?: number;
}

interface InfiniteState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  total: number;
}

/**
 * Generic infinite scroll hook factory.
 */
function createInfiniteHook<T>(
  fetchFn: (
    executionId: string,
    offset: number,
    limit: number,
  ) => Promise<{ data: T[]; total: number; hasMore: boolean }>,
) {
  return function useInfinite(
    executionId: string | undefined,
    options: UseInfiniteOptions = {},
  ) {
    const { pageSize = 50 } = options;

    const [state, setState] = useState<InfiniteState<T>>({
      items: [],
      loading: true,
      loadingMore: false,
      error: null,
      hasMore: true,
      total: 0,
    });

    const offsetRef = useRef(0);
    const loadingRef = useRef(false);
    const observerInstanceRef = useRef<IntersectionObserver | null>(null);

    // Initial load
    const loadInitial = useCallback(async () => {
      if (!executionId) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const result = await fetchFn(executionId, 0, pageSize);
        offsetRef.current = result.data.length;
        setState({
          items: result.data,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: result.hasMore,
          total: result.total,
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    }, [executionId, pageSize]);

    // Load more
    const loadMore = useCallback(async () => {
      if (!executionId || loadingRef.current || !state.hasMore) return;

      loadingRef.current = true;
      setState((prev) => ({ ...prev, loadingMore: true }));

      try {
        const result = await fetchFn(executionId, offsetRef.current, pageSize);
        offsetRef.current += result.data.length;
        setState((prev) => ({
          ...prev,
          items: [...prev.items, ...result.data],
          loadingMore: false,
          hasMore: result.hasMore,
          total: result.total,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loadingMore: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      } finally {
        loadingRef.current = false;
      }
    }, [executionId, pageSize, state.hasMore]);

    // Reset and reload
    const reset = useCallback(() => {
      offsetRef.current = 0;
      loadInitial();
    }, [loadInitial]);

    // Initial load on mount
    useEffect(() => {
      loadInitial();
    }, [loadInitial]);

    // Intersection observer ref for automatic loading
    // Note: This callback ref pattern properly manages the observer lifecycle
    const observerRef = useCallback(
      (node: HTMLElement | null) => {
        // Cleanup previous observer
        if (observerInstanceRef.current) {
          observerInstanceRef.current.disconnect();
          observerInstanceRef.current = null;
        }

        // If no node, we're done (element unmounted)
        if (!node) return;

        // Create new observer
        const observer = new IntersectionObserver(
          (entries) => {
            if (
              entries[0].isIntersecting &&
              state.hasMore &&
              !state.loadingMore
            ) {
              loadMore();
            }
          },
          { threshold: 0.1 },
        );

        observer.observe(node);
        observerInstanceRef.current = observer;
      },
      [loadMore, state.hasMore, state.loadingMore],
    );

    // Cleanup observer on unmount
    useEffect(() => {
      return () => {
        if (observerInstanceRef.current) {
          observerInstanceRef.current.disconnect();
        }
      };
    }, []);

    return {
      ...state,
      loadMore,
      reset,
      observerRef,
    };
  };
}

// API fetch functions
async function fetchTranscript(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/transcript?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchToolUses(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/tool-uses?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchAssertions(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/assertions?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchSkillTraces(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/skills?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchMessageBusLogs(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/logs/message-bus?executionId=${executionId}&offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

// Export typed hooks
export const useInfiniteTranscript =
  createInfiniteHook<TranscriptEntry>(fetchTranscript);
export const useInfiniteToolUses = createInfiniteHook<ToolUse>(fetchToolUses);
export const useInfiniteAssertions =
  createInfiniteHook<AssertionResultEntry>(fetchAssertions);
export const useInfiniteSkillTraces = createInfiniteHook<{
  id: string;
  skillName: string;
  status: string;
  durationMs: number | null;
}>(fetchSkillTraces);
export const useInfiniteMessageBusLogs = createInfiniteHook<{
  id: string;
  eventType: string;
  severity: string;
  humanSummary: string;
  timestamp: string;
}>(fetchMessageBusLogs);
