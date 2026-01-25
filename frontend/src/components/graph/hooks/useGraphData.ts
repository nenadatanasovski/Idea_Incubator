/**
 * useGraphData Hook
 * Fetches and manages graph data for Memory Graph visualization
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  GraphData,
  GraphDataState,
  ApiBlock,
  ApiLink,
  GraphFilters,
} from "../../../types/graph";
import {
  transformBlocksToNodes,
  transformLinksToEdges,
  filterNodesByGraph,
  filterNodesByBlockType,
  filterNodesByStatus,
  filterNodesByConfidence,
  filterNodesByAbstractionLevel,
  filterNodesBySourceType,
  filterEdgesByVisibleNodes,
} from "../utils/graphTransform";

const API_BASE = "/api";

interface UseGraphDataOptions {
  sessionId?: string;
  ideaSlug?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

interface UseGraphDataReturn extends GraphDataState {
  refetch: () => Promise<void>;
  applyFilters: (filters: GraphFilters) => void;
  filteredData: GraphData;
  filters: GraphFilters;
  resetFilters: () => void;
}

/**
 * Fetch blocks from API
 */
async function fetchBlocks(
  sessionId?: string,
  ideaSlug?: string,
): Promise<ApiBlock[]> {
  let endpoint = "";

  if (sessionId) {
    endpoint = `${API_BASE}/ideation/session/${sessionId}/blocks`;
  } else if (ideaSlug) {
    endpoint = `${API_BASE}/ideas/${ideaSlug}/blocks`;
  } else {
    throw new Error("Either sessionId or ideaSlug must be provided");
  }

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch blocks: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success === false) {
    throw new Error(data.error || "Failed to fetch blocks");
  }

  return data.data?.blocks || data.blocks || [];
}

/**
 * Fetch links from API
 */
async function fetchLinks(
  sessionId?: string,
  ideaSlug?: string,
): Promise<ApiLink[]> {
  let endpoint = "";

  if (sessionId) {
    endpoint = `${API_BASE}/ideation/session/${sessionId}/links`;
  } else if (ideaSlug) {
    endpoint = `${API_BASE}/ideas/${ideaSlug}/links`;
  } else {
    throw new Error("Either sessionId or ideaSlug must be provided");
  }

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch links: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success === false) {
    throw new Error(data.error || "Failed to fetch links");
  }

  return data.data?.links || data.links || [];
}

/**
 * Hook to fetch and manage graph data
 */
export function useGraphData(
  options: UseGraphDataOptions = {},
): UseGraphDataReturn {
  const {
    sessionId,
    ideaSlug,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  // Core state
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<GraphFilters>({
    graphTypes: [],
    blockTypes: [],
    statuses: [],
    abstractionLevels: [],
    sourceTypes: [],
    confidenceRange: [0, 1],
  });

  /**
   * Fetch all graph data
   */
  const refetch = useCallback(async () => {
    if (!sessionId && !ideaSlug) {
      setError("Either sessionId or ideaSlug must be provided");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch blocks and links in parallel
      const [blocks, links] = await Promise.all([
        fetchBlocks(sessionId, ideaSlug),
        fetchLinks(sessionId, ideaSlug),
      ]);

      // Transform to graph format
      const nodes = transformBlocksToNodes(blocks);
      const edges = transformLinksToEdges(links);

      setData({ nodes, edges });
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("Error fetching graph data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, ideaSlug]);

  /**
   * Apply filters to the data
   */
  const applyFilters = useCallback((newFilters: GraphFilters) => {
    setFilters(newFilters);
  }, []);

  /**
   * Reset filters to default
   */
  const resetFilters = useCallback(() => {
    setFilters({
      graphTypes: [],
      blockTypes: [],
      statuses: [],
      abstractionLevels: [],
      sourceTypes: [],
      confidenceRange: [0, 1],
    });
  }, []);

  /**
   * Compute filtered data
   */
  const filteredData = useMemo((): GraphData => {
    let filteredNodes = data.nodes;

    // Apply graph type filter
    if (filters.graphTypes.length > 0) {
      filteredNodes = filterNodesByGraph(filteredNodes, filters.graphTypes);
    }

    // Apply block type filter
    if (filters.blockTypes.length > 0) {
      filteredNodes = filterNodesByBlockType(filteredNodes, filters.blockTypes);
    }

    // Apply status filter
    if (filters.statuses.length > 0) {
      filteredNodes = filterNodesByStatus(filteredNodes, filters.statuses);
    }

    // Apply abstraction level filter
    if (filters.abstractionLevels.length > 0) {
      filteredNodes = filterNodesByAbstractionLevel(
        filteredNodes,
        filters.abstractionLevels,
      );
    }

    // Apply source type filter
    if (filters.sourceTypes.length > 0) {
      filteredNodes = filterNodesBySourceType(
        filteredNodes,
        filters.sourceTypes,
      );
    }

    // Apply confidence filter
    const [minConf, maxConf] = filters.confidenceRange;
    if (minConf > 0 || maxConf < 1) {
      filteredNodes = filterNodesByConfidence(filteredNodes, minConf, maxConf);
    }

    // Filter edges to only include those between visible nodes
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = filterEdgesByVisibleNodes(data.edges, visibleNodeIds);

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [data, filters]);

  // Initial fetch
  useEffect(() => {
    if (sessionId || ideaSlug) {
      refetch();
    }
  }, [sessionId, ideaSlug, refetch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || (!sessionId && !ideaSlug)) {
      return;
    }

    const intervalId = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, sessionId, ideaSlug, refetch]);

  return {
    data,
    filteredData,
    isLoading,
    error,
    lastUpdated,
    refetch,
    applyFilters,
    filters,
    resetFilters,
  };
}

/**
 * Hook to get graph data for a specific session
 */
export function useSessionGraphData(
  sessionId: string,
  options?: Omit<UseGraphDataOptions, "sessionId" | "ideaSlug">,
) {
  return useGraphData({ ...options, sessionId });
}

/**
 * Hook to get graph data for a specific idea
 */
export function useIdeaGraphData(
  ideaSlug: string,
  options?: Omit<UseGraphDataOptions, "sessionId" | "ideaSlug">,
) {
  return useGraphData({ ...options, ideaSlug });
}

export default useGraphData;
