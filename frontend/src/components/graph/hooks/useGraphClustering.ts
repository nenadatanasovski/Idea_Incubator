/**
 * useGraphClustering Hook
 * Manages clustering logic and computes cluster assignments for graph nodes
 * Supports URL synchronization for shareable cluster configurations
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  GraphNode,
  ClusterStrategy,
  ClusterConfig,
} from "../../../types/graph";
import { defaultClusterConfig } from "../../../types/graph";

// URL parameter keys for clustering
const URL_PARAM_KEYS = {
  clusterStrategy: "cluster",
  clusterStrength: "clusterStrength",
} as const;

// Valid cluster strategy values for validation
const VALID_STRATEGIES: ClusterStrategy[] = [
  "none",
  "graphMembership",
  "blockType",
  "abstraction",
  "status",
  "custom",
];

export interface UseGraphClusteringOptions {
  /** Whether to sync cluster state to URL search params */
  syncToUrl?: boolean;
  /** Initial cluster configuration (overrides URL params if provided) */
  initialConfig?: Partial<ClusterConfig>;
}

export interface UseGraphClusteringReturn {
  /** Current clustering strategy */
  clusterStrategy: ClusterStrategy;
  /** Set the clustering strategy */
  setClusterStrategy: (strategy: ClusterStrategy) => void;

  /** Cluster strength (0.0 - 1.0) */
  clusterStrength: number;
  /** Set cluster strength */
  setClusterStrength: (strength: number) => void;

  /** Full cluster configuration */
  clusterConfig: ClusterConfig;

  /** Get the cluster for a specific node based on current strategy */
  getClusterForNode: (node: GraphNode) => string | undefined;

  /** Apply cluster assignments to nodes (returns nodes with cluster field populated) */
  applyClusterAssignments: (nodes: GraphNode[]) => GraphNode[];

  /** Available cluster values based on current strategy and nodes */
  availableClusters: string[];

  /** Reset to default configuration */
  resetClustering: () => void;

  /** Get shareable URL with current cluster settings */
  getShareableUrl: () => string;
}

/**
 * Parse cluster configuration from URL search params
 */
function parseClusterConfigFromUrl(): Partial<ClusterConfig> {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const config: Partial<ClusterConfig> = {};

  // Parse cluster strategy
  const strategyParam = params.get(URL_PARAM_KEYS.clusterStrategy);
  if (
    strategyParam &&
    VALID_STRATEGIES.includes(strategyParam as ClusterStrategy)
  ) {
    config.strategy = strategyParam as ClusterStrategy;
  }

  // Parse cluster strength
  const strengthParam = params.get(URL_PARAM_KEYS.clusterStrength);
  if (strengthParam) {
    const strength = parseFloat(strengthParam);
    if (!isNaN(strength) && strength >= 0 && strength <= 1) {
      config.strength = strength;
    }
  }

  return config;
}

/**
 * Update URL search params with cluster configuration
 */
function updateUrlWithClusterConfig(config: ClusterConfig): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);

  // Update cluster strategy
  if (config.strategy !== "none") {
    params.set(URL_PARAM_KEYS.clusterStrategy, config.strategy);
  } else {
    params.delete(URL_PARAM_KEYS.clusterStrategy);
  }

  // Update cluster strength (only if not default and clustering is active)
  if (config.strategy !== "none" && config.strength !== 0.7) {
    params.set(URL_PARAM_KEYS.clusterStrength, config.strength.toFixed(2));
  } else {
    params.delete(URL_PARAM_KEYS.clusterStrength);
  }

  // Update URL without page reload
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, "", newUrl);
}

/**
 * Get cluster value for a node based on strategy
 */
function getClusterValue(
  node: GraphNode,
  strategy: ClusterStrategy,
  customGroups?: Record<string, string[]>,
): string | undefined {
  switch (strategy) {
    case "none":
      return undefined;

    case "graphMembership":
      // Use first graphMembership as cluster
      return node.graphMembership?.[0];

    case "blockType":
      return node.blockType;

    case "abstraction":
      return node.abstractionLevel;

    case "status":
      return node.status;

    case "custom":
      // Look up node in custom groups
      if (!customGroups) return undefined;
      for (const [clusterName, nodeIds] of Object.entries(customGroups)) {
        if (nodeIds.includes(node.id)) {
          return clusterName;
        }
      }
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Extract available cluster values from nodes based on strategy
 */
function extractAvailableClusters(
  nodes: GraphNode[],
  strategy: ClusterStrategy,
  customGroups?: Record<string, string[]>,
): string[] {
  if (strategy === "none") {
    return [];
  }

  if (strategy === "custom" && customGroups) {
    return Object.keys(customGroups);
  }

  const clusterSet = new Set<string>();

  for (const node of nodes) {
    const cluster = getClusterValue(node, strategy);
    if (cluster) {
      clusterSet.add(cluster);
    }
  }

  return Array.from(clusterSet).sort();
}

/**
 * Hook to manage graph clustering configuration and compute cluster assignments
 */
export function useGraphClustering(
  nodes: GraphNode[],
  options: UseGraphClusteringOptions = {},
): UseGraphClusteringReturn {
  const { syncToUrl = false, initialConfig } = options;

  // Initialize state from URL or defaults
  const [clusterConfig, setClusterConfig] = useState<ClusterConfig>(() => {
    const urlConfig = syncToUrl ? parseClusterConfigFromUrl() : {};
    return {
      ...defaultClusterConfig,
      ...urlConfig,
      ...initialConfig,
    };
  });

  // Sync to URL when config changes
  useEffect(() => {
    if (syncToUrl) {
      updateUrlWithClusterConfig(clusterConfig);
    }
  }, [clusterConfig, syncToUrl]);

  // Convenience setters
  const setClusterStrategy = useCallback((strategy: ClusterStrategy) => {
    setClusterConfig((prev) => ({ ...prev, strategy }));
  }, []);

  const setClusterStrength = useCallback((strength: number) => {
    // Clamp strength between 0 and 1
    const clampedStrength = Math.max(0, Math.min(1, strength));
    setClusterConfig((prev) => ({ ...prev, strength: clampedStrength }));
  }, []);

  const resetClustering = useCallback(() => {
    setClusterConfig(defaultClusterConfig);
  }, []);

  // Memoized cluster getter for single nodes
  const getClusterForNode = useCallback(
    (node: GraphNode): string | undefined => {
      return getClusterValue(
        node,
        clusterConfig.strategy,
        clusterConfig.customGroups,
      );
    },
    [clusterConfig.strategy, clusterConfig.customGroups],
  );

  // Memoized function to apply cluster assignments to all nodes
  const applyClusterAssignments = useCallback(
    (nodesToCluster: GraphNode[]): GraphNode[] => {
      if (clusterConfig.strategy === "none") {
        // Clear cluster assignments
        return nodesToCluster.map((node) => ({
          ...node,
          cluster: undefined,
        }));
      }

      return nodesToCluster.map((node) => ({
        ...node,
        cluster: getClusterValue(
          node,
          clusterConfig.strategy,
          clusterConfig.customGroups,
        ),
      }));
    },
    [clusterConfig.strategy, clusterConfig.customGroups],
  );

  // Memoized available clusters
  const availableClusters = useMemo(
    () =>
      extractAvailableClusters(
        nodes,
        clusterConfig.strategy,
        clusterConfig.customGroups,
      ),
    [nodes, clusterConfig.strategy, clusterConfig.customGroups],
  );

  // Generate shareable URL with current cluster settings
  const getShareableUrl = useCallback(() => {
    if (typeof window === "undefined") return "";

    const params = new URLSearchParams(window.location.search);

    if (clusterConfig.strategy !== "none") {
      params.set(URL_PARAM_KEYS.clusterStrategy, clusterConfig.strategy);
      if (clusterConfig.strength !== 0.7) {
        params.set(
          URL_PARAM_KEYS.clusterStrength,
          clusterConfig.strength.toFixed(2),
        );
      }
    }

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }, [clusterConfig]);

  return {
    clusterStrategy: clusterConfig.strategy,
    setClusterStrategy,
    clusterStrength: clusterConfig.strength,
    setClusterStrength,
    clusterConfig,
    getClusterForNode,
    applyClusterAssignments,
    availableClusters,
    resetClustering,
    getShareableUrl,
  };
}

export default useGraphClustering;
