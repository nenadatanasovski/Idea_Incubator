/**
 * useGraphFilters Hook
 * Manages filter state for graph visualization with URL synchronization
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  GraphNode,
  GraphEdge,
  GraphType,
  BlockType,
  BlockStatus,
  AbstractionLevel,
} from "../../../types/graph";

export interface FilterState {
  graphTypes: GraphType[];
  blockTypes: BlockType[];
  statuses: BlockStatus[];
  abstractionLevels: AbstractionLevel[];
  confidenceRange: { min: number; max: number };
}

export interface UseGraphFiltersOptions {
  /**
   * Whether to sync filter state to URL search params
   */
  syncToUrl?: boolean;
  /**
   * Initial filter state (overrides URL params if provided)
   */
  initialFilters?: Partial<FilterState>;
}

export interface UseGraphFiltersReturn {
  // Filter state
  graphFilter: GraphType[];
  blockTypeFilter: BlockType[];
  statusFilter: BlockStatus[];
  abstractionFilter: AbstractionLevel[];
  confidenceRange: { min: number; max: number };

  // Setters
  setGraphFilter: (types: GraphType[]) => void;
  setBlockTypeFilter: (types: BlockType[]) => void;
  setStatusFilter: (statuses: BlockStatus[]) => void;
  setAbstractionFilter: (levels: AbstractionLevel[]) => void;
  setConfidenceRange: (range: { min: number; max: number }) => void;

  // Derived data
  filteredNodes: GraphNode[];
  filteredEdges: GraphEdge[];

  // Utilities
  resetFilters: () => void;
  hasActiveFilters: boolean;

  // URL utilities
  getShareableUrl: () => string;
}

// URL parameter keys
const URL_PARAM_KEYS = {
  graphTypes: "graph",
  blockTypes: "block",
  statuses: "status",
  abstractionLevels: "abstraction",
  confMin: "confMin",
  confMax: "confMax",
} as const;

/**
 * Parse filter state from URL search params
 */
function parseFiltersFromUrl(): Partial<FilterState> {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const filters: Partial<FilterState> = {};

  // Parse graph types
  const graphTypesParam = params.get(URL_PARAM_KEYS.graphTypes);
  if (graphTypesParam) {
    filters.graphTypes = graphTypesParam.split(",") as GraphType[];
  }

  // Parse block types
  const blockTypesParam = params.get(URL_PARAM_KEYS.blockTypes);
  if (blockTypesParam) {
    filters.blockTypes = blockTypesParam.split(",") as BlockType[];
  }

  // Parse statuses
  const statusesParam = params.get(URL_PARAM_KEYS.statuses);
  if (statusesParam) {
    filters.statuses = statusesParam.split(",") as BlockStatus[];
  }

  // Parse abstraction levels
  const abstractionParam = params.get(URL_PARAM_KEYS.abstractionLevels);
  if (abstractionParam) {
    filters.abstractionLevels = abstractionParam.split(
      ",",
    ) as AbstractionLevel[];
  }

  // Parse confidence range
  const confMinParam = params.get(URL_PARAM_KEYS.confMin);
  const confMaxParam = params.get(URL_PARAM_KEYS.confMax);
  if (confMinParam || confMaxParam) {
    filters.confidenceRange = {
      min: confMinParam ? parseFloat(confMinParam) : 0,
      max: confMaxParam ? parseFloat(confMaxParam) : 1,
    };
  }

  return filters;
}

/**
 * Update URL search params with filter state
 */
function updateUrlWithFilters(filters: FilterState): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);

  // Update graph types
  if (filters.graphTypes.length > 0) {
    params.set(URL_PARAM_KEYS.graphTypes, filters.graphTypes.join(","));
  } else {
    params.delete(URL_PARAM_KEYS.graphTypes);
  }

  // Update block types
  if (filters.blockTypes.length > 0) {
    params.set(URL_PARAM_KEYS.blockTypes, filters.blockTypes.join(","));
  } else {
    params.delete(URL_PARAM_KEYS.blockTypes);
  }

  // Update statuses
  if (filters.statuses.length > 0) {
    params.set(URL_PARAM_KEYS.statuses, filters.statuses.join(","));
  } else {
    params.delete(URL_PARAM_KEYS.statuses);
  }

  // Update abstraction levels
  if (filters.abstractionLevels.length > 0) {
    params.set(
      URL_PARAM_KEYS.abstractionLevels,
      filters.abstractionLevels.join(","),
    );
  } else {
    params.delete(URL_PARAM_KEYS.abstractionLevels);
  }

  // Update confidence range
  if (filters.confidenceRange.min > 0) {
    params.set(URL_PARAM_KEYS.confMin, filters.confidenceRange.min.toString());
  } else {
    params.delete(URL_PARAM_KEYS.confMin);
  }

  if (filters.confidenceRange.max < 1) {
    params.set(URL_PARAM_KEYS.confMax, filters.confidenceRange.max.toString());
  } else {
    params.delete(URL_PARAM_KEYS.confMax);
  }

  // Update URL without page reload
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

/**
 * Default filter state
 */
const defaultFilterState: FilterState = {
  graphTypes: [],
  blockTypes: [],
  statuses: [],
  abstractionLevels: [],
  confidenceRange: { min: 0, max: 1 },
};

/**
 * Hook to manage graph filter state with URL synchronization
 */
export function useGraphFilters(
  nodes: GraphNode[],
  edges?: GraphEdge[],
  options: UseGraphFiltersOptions = {},
): UseGraphFiltersReturn {
  const { syncToUrl = false, initialFilters } = options;

  // Initialize state from URL or defaults
  const [filters, setFilters] = useState<FilterState>(() => {
    const urlFilters = syncToUrl ? parseFiltersFromUrl() : {};
    return {
      ...defaultFilterState,
      ...urlFilters,
      ...initialFilters,
    };
  });

  // Sync to URL when filters change
  useEffect(() => {
    if (syncToUrl) {
      updateUrlWithFilters(filters);
    }
  }, [filters, syncToUrl]);

  // Filter setters
  const setGraphFilter = useCallback((types: GraphType[]) => {
    setFilters((prev) => ({ ...prev, graphTypes: types }));
  }, []);

  const setBlockTypeFilter = useCallback((types: BlockType[]) => {
    setFilters((prev) => ({ ...prev, blockTypes: types }));
  }, []);

  const setStatusFilter = useCallback((statuses: BlockStatus[]) => {
    setFilters((prev) => ({ ...prev, statuses: statuses }));
  }, []);

  const setAbstractionFilter = useCallback((levels: AbstractionLevel[]) => {
    setFilters((prev) => ({ ...prev, abstractionLevels: levels }));
  }, []);

  const setConfidenceRange = useCallback(
    (range: { min: number; max: number }) => {
      setFilters((prev) => ({ ...prev, confidenceRange: range }));
    },
    [],
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilterState);
  }, []);

  // Filter nodes based on current filter state
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // Filter by graph type (OR logic - node must have at least one of the selected types)
    if (filters.graphTypes.length > 0) {
      result = result.filter((node) =>
        node.graphMembership.some((membership) =>
          filters.graphTypes.includes(membership),
        ),
      );
    }

    // Filter by block type
    if (filters.blockTypes.length > 0) {
      result = result.filter((node) =>
        filters.blockTypes.includes(node.blockType),
      );
    }

    // Filter by status
    if (filters.statuses.length > 0) {
      result = result.filter((node) => filters.statuses.includes(node.status));
    }

    // Filter by abstraction level
    if (filters.abstractionLevels.length > 0) {
      result = result.filter(
        (node) =>
          node.abstractionLevel &&
          filters.abstractionLevels.includes(node.abstractionLevel),
      );
    }

    // Filter by confidence range
    const { min, max } = filters.confidenceRange;
    if (min > 0 || max < 1) {
      result = result.filter(
        (node) => node.confidence >= min && node.confidence <= max,
      );
    }

    return result;
  }, [nodes, filters]);

  // Filter edges to only include those between visible nodes
  const filteredEdges = useMemo(() => {
    if (!edges) return [];

    const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));
    return edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );
  }, [edges, filteredNodes]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.graphTypes.length > 0 ||
      filters.blockTypes.length > 0 ||
      filters.statuses.length > 0 ||
      filters.abstractionLevels.length > 0 ||
      filters.confidenceRange.min > 0 ||
      filters.confidenceRange.max < 1
    );
  }, [filters]);

  // Generate shareable URL with current filters
  const getShareableUrl = useCallback(() => {
    if (typeof window === "undefined") return "";

    const params = new URLSearchParams();

    if (filters.graphTypes.length > 0) {
      params.set(URL_PARAM_KEYS.graphTypes, filters.graphTypes.join(","));
    }
    if (filters.blockTypes.length > 0) {
      params.set(URL_PARAM_KEYS.blockTypes, filters.blockTypes.join(","));
    }
    if (filters.statuses.length > 0) {
      params.set(URL_PARAM_KEYS.statuses, filters.statuses.join(","));
    }
    if (filters.abstractionLevels.length > 0) {
      params.set(
        URL_PARAM_KEYS.abstractionLevels,
        filters.abstractionLevels.join(","),
      );
    }
    if (filters.confidenceRange.min > 0) {
      params.set(
        URL_PARAM_KEYS.confMin,
        filters.confidenceRange.min.toString(),
      );
    }
    if (filters.confidenceRange.max < 1) {
      params.set(
        URL_PARAM_KEYS.confMax,
        filters.confidenceRange.max.toString(),
      );
    }

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }, [filters]);

  return {
    // Filter state
    graphFilter: filters.graphTypes,
    blockTypeFilter: filters.blockTypes,
    statusFilter: filters.statuses,
    abstractionFilter: filters.abstractionLevels,
    confidenceRange: filters.confidenceRange,

    // Setters
    setGraphFilter,
    setBlockTypeFilter,
    setStatusFilter,
    setAbstractionFilter,
    setConfidenceRange,

    // Derived data
    filteredNodes,
    filteredEdges,

    // Utilities
    resetFilters,
    hasActiveFilters,
    getShareableUrl,
  };
}

export default useGraphFilters;
