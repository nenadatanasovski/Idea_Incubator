/**
 * useGraphDataWithWebSocket Hook
 * Combines useGraphData with useGraphWebSocket for real-time graph updates
 *
 * Features:
 * - Initial data fetch via REST API
 * - Real-time incremental updates via WebSocket
 * - Animated transitions for visual continuity
 * - Manual refresh capability
 * - Stale data indication
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphFilters,
  ApiBlock,
} from "../../../types/graph";
import { useGraphData } from "./useGraphData";
import {
  useGraphWebSocket,
  type BlockCreatedPayload,
  type BlockUpdatedPayload,
  type LinkCreatedPayload,
  type LinkRemovedPayload,
} from "./useGraphWebSocket";
import {
  transformSingleBlockToNode,
  transformSingleLinkToEdge,
  addNodeToGraph,
  updateNodeInGraph,
  addEdgeToGraph,
  removeEdgeFromGraph,
  filterNodesByGraph,
  filterNodesByBlockType,
  filterNodesByStatus,
  filterNodesByConfidence,
  filterNodesByAbstractionLevel,
  filterNodesBySourceType,
  filterEdgesByVisibleNodes,
} from "../utils/graphTransform";

// ============================================================================
// Types
// ============================================================================

export interface UseGraphDataWithWebSocketOptions {
  sessionId: string;
  ideaSlug?: string;
  wsUrl?: string;
  enableWebSocket?: boolean;
  onNodeAdded?: (node: GraphNode) => void;
  onNodeUpdated?: (node: GraphNode) => void;
  onEdgeAdded?: (edge: GraphEdge) => void;
  onEdgeRemoved?: (edgeId: string) => void;
  onError?: (error: Error) => void;
}

export interface UseGraphDataWithWebSocketReturn {
  // Data
  data: GraphData;
  filteredData: GraphData;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Connection status
  isConnected: boolean;
  isReconnecting: boolean;
  isStale: boolean;

  // Filters
  filters: GraphFilters;
  applyFilters: (filters: GraphFilters) => void;
  resetFilters: () => void;

  // Actions
  refetch: () => Promise<void>;
  reconnect: () => void;
  disconnect: () => void;

  // Pending updates (for animation/review)
  pendingUpdates: PendingUpdate[];
  applyPendingUpdates: () => void;
  dismissPendingUpdates: () => void;

  // Recently added items (for animation highlighting)
  recentlyAddedNodeIds: Set<string>;
  recentlyAddedEdgeIds: Set<string>;
}

export interface PendingUpdate {
  type: "node_added" | "node_updated" | "edge_added" | "edge_removed";
  data: GraphNode | GraphEdge | string;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const STALE_THRESHOLD_MS = 60000; // Consider data stale after 1 minute without updates
const RECENT_HIGHLIGHT_DURATION_MS = 3000; // Highlight new nodes/edges for 3 seconds

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGraphDataWithWebSocket(
  options: UseGraphDataWithWebSocketOptions,
): UseGraphDataWithWebSocketReturn {
  const {
    sessionId,
    ideaSlug,
    wsUrl,
    enableWebSocket = true,
    onNodeAdded,
    onNodeUpdated,
    onEdgeAdded,
    onEdgeRemoved,
    onError,
  } = options;

  // Local state for WebSocket-driven updates
  const [wsNodes, setWsNodes] = useState<GraphNode[]>([]);
  const [wsEdges, setWsEdges] = useState<GraphEdge[]>([]);
  const [hasWsUpdates, setHasWsUpdates] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [lastWsEvent, setLastWsEvent] = useState<string | null>(null);

  // Recently added items for animation highlighting
  const [recentlyAddedNodeIds, setRecentlyAddedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [recentlyAddedEdgeIds, setRecentlyAddedEdgeIds] = useState<Set<string>>(
    new Set(),
  );
  const highlightTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      highlightTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      highlightTimeoutsRef.current.clear();
    };
  }, []);

  /**
   * Add an item to recently added set with auto-removal after duration
   */
  const markAsRecentlyAdded = useCallback(
    (id: string, type: "node" | "edge") => {
      const setter =
        type === "node" ? setRecentlyAddedNodeIds : setRecentlyAddedEdgeIds;

      // Add to set
      setter((prev) => new Set(prev).add(id));

      // Clear any existing timeout for this id
      const existingTimeout = highlightTimeoutsRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout to remove from set
      const timeout = setTimeout(() => {
        setter((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        highlightTimeoutsRef.current.delete(id);
      }, RECENT_HIGHLIGHT_DURATION_MS);

      highlightTimeoutsRef.current.set(id, timeout);
    },
    [],
  );

  // Use the base graph data hook for initial fetch
  const {
    data: initialData,
    filteredData: _baseFilteredData,
    isLoading,
    error,
    lastUpdated,
    refetch: baseRefetch,
    applyFilters,
    filters,
    resetFilters,
  } = useGraphData({
    sessionId,
    ideaSlug,
    autoRefresh: false, // We use WebSocket for updates instead
  });

  // Handle block created event
  const handleBlockCreated = useCallback(
    (payload: BlockCreatedPayload) => {
      // Convert payload to ApiBlock format for transformation
      const apiBlock: ApiBlock = {
        id: payload.id,
        type: payload.type || "content",
        content: payload.content || "",
        properties: payload.properties || {},
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const newNode = transformSingleBlockToNode(apiBlock);
      if (newNode) {
        setWsNodes((prev) => addNodeToGraph(prev, newNode));
        setHasWsUpdates(true);
        setLastWsEvent(new Date().toISOString());

        // Mark as recently added for animation
        markAsRecentlyAdded(newNode.id, "node");

        // Add to pending updates for review
        setPendingUpdates((prev) => [
          ...prev,
          {
            type: "node_added",
            data: newNode,
            timestamp: new Date().toISOString(),
          },
        ]);

        onNodeAdded?.(newNode);
      }
    },
    [onNodeAdded, markAsRecentlyAdded],
  );

  // Handle block updated event
  const handleBlockUpdated = useCallback(
    (payload: BlockUpdatedPayload) => {
      setWsNodes((prev) => {
        const existingNode = prev.find((n) => n.id === payload.id);
        if (!existingNode) {
          // Node doesn't exist in WS state, check initial data
          const initialNode = initialData.nodes.find(
            (n) => n.id === payload.id,
          );
          if (initialNode) {
            // Create updated node and add to WS state
            const updatedNode = {
              ...initialNode,
              ...(payload.status && {
                status: payload.status as GraphNode["status"],
              }),
              ...(payload.content && {
                content: payload.content,
                label: payload.content.substring(0, 50),
              }),
              ...(payload.properties && {
                properties: {
                  ...initialNode.properties,
                  ...payload.properties,
                },
              }),
              updatedAt: new Date().toISOString(),
            };
            setPendingUpdates((pending) => [
              ...pending,
              {
                type: "node_updated",
                data: updatedNode,
                timestamp: new Date().toISOString(),
              },
            ]);
            onNodeUpdated?.(updatedNode);
            return addNodeToGraph(prev, updatedNode);
          }
          return prev;
        }

        // Update existing WS node
        return updateNodeInGraph(prev, payload.id, {
          ...(payload.status && {
            status: payload.status as GraphNode["status"],
          }),
          ...(payload.content && {
            content: payload.content,
            label: payload.content.substring(0, 50),
          }),
          ...(payload.properties && {
            properties: { ...existingNode.properties, ...payload.properties },
          }),
        });
      });

      setHasWsUpdates(true);
      setLastWsEvent(new Date().toISOString());
    },
    [initialData.nodes, onNodeUpdated],
  );

  // Handle link created event
  const handleLinkCreated = useCallback(
    (payload: LinkCreatedPayload) => {
      const newEdge = transformSingleLinkToEdge(payload);
      setWsEdges((prev) => addEdgeToGraph(prev, newEdge));
      setHasWsUpdates(true);
      setLastWsEvent(new Date().toISOString());

      // Mark as recently added for animation
      markAsRecentlyAdded(newEdge.id, "edge");

      setPendingUpdates((prev) => [
        ...prev,
        {
          type: "edge_added",
          data: newEdge,
          timestamp: new Date().toISOString(),
        },
      ]);

      onEdgeAdded?.(newEdge);
    },
    [onEdgeAdded, markAsRecentlyAdded],
  );

  // Handle link removed event
  const handleLinkRemoved = useCallback(
    (payload: LinkRemovedPayload) => {
      setWsEdges((prev) => removeEdgeFromGraph(prev, payload.id));
      setHasWsUpdates(true);
      setLastWsEvent(new Date().toISOString());

      setPendingUpdates((prev) => [
        ...prev,
        {
          type: "edge_removed",
          data: payload.id,
          timestamp: new Date().toISOString(),
        },
      ]);

      onEdgeRemoved?.(payload.id);
    },
    [onEdgeRemoved],
  );

  // Handle WebSocket errors
  const handleWsError = useCallback(
    (err: Error) => {
      console.error("WebSocket error:", err);
      onError?.(err);
    },
    [onError],
  );

  // WebSocket connection
  const {
    isConnected,
    isReconnecting,
    connect: wsConnect,
    disconnect: wsDisconnect,
  } = useGraphWebSocket({
    sessionId: enableWebSocket ? sessionId : "",
    wsUrl,
    onBlockCreated: handleBlockCreated,
    onBlockUpdated: handleBlockUpdated,
    onLinkCreated: handleLinkCreated,
    onLinkRemoved: handleLinkRemoved,
    onError: handleWsError,
    reconnect: true,
  });

  // Merge initial data with WebSocket updates
  const mergedData = useMemo((): GraphData => {
    if (!hasWsUpdates) {
      return initialData;
    }

    // Create a map of WS nodes for quick lookup
    const wsNodeMap = new Map(wsNodes.map((n) => [n.id, n]));
    const wsEdgeMap = new Map(wsEdges.map((e) => [e.id, e]));

    // Merge nodes: WS updates take precedence
    const mergedNodes = initialData.nodes.map((node) => {
      const wsNode = wsNodeMap.get(node.id);
      return wsNode || node;
    });

    // Add any new WS nodes that don't exist in initial data
    for (const wsNode of wsNodes) {
      if (!mergedNodes.some((n) => n.id === wsNode.id)) {
        mergedNodes.push(wsNode);
      }
    }

    // Merge edges: WS updates take precedence
    const mergedEdges = initialData.edges.map((edge) => {
      const wsEdge = wsEdgeMap.get(edge.id);
      return wsEdge || edge;
    });

    // Add any new WS edges that don't exist in initial data
    for (const wsEdge of wsEdges) {
      if (!mergedEdges.some((e) => e.id === wsEdge.id)) {
        mergedEdges.push(wsEdge);
      }
    }

    // Remove edges that were removed via WS
    const removedEdgeIds = new Set(
      pendingUpdates
        .filter((u) => u.type === "edge_removed")
        .map((u) => u.data as string),
    );

    return {
      nodes: mergedNodes,
      edges: mergedEdges.filter((e) => !removedEdgeIds.has(e.id)),
    };
  }, [initialData, wsNodes, wsEdges, hasWsUpdates, pendingUpdates]);

  // Apply filters to merged data
  const filteredData = useMemo((): GraphData => {
    let filteredNodes = mergedData.nodes;

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
    const filteredEdges = filterEdgesByVisibleNodes(
      mergedData.edges,
      visibleNodeIds,
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [mergedData, filters]);

  // Determine if data is stale
  const isStale = useMemo(() => {
    if (!lastUpdated && !lastWsEvent) return false;

    const lastUpdate = lastWsEvent || lastUpdated;
    if (!lastUpdate) return false;

    const lastUpdateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    return now - lastUpdateTime > STALE_THRESHOLD_MS;
  }, [lastUpdated, lastWsEvent]);

  // Refetch data and clear WS state
  const refetch = useCallback(async () => {
    await baseRefetch();
    // Clear WebSocket-driven updates after refetch
    setWsNodes([]);
    setWsEdges([]);
    setHasWsUpdates(false);
    setPendingUpdates([]);
  }, [baseRefetch]);

  // Apply pending updates (commit them permanently)
  const applyPendingUpdates = useCallback(() => {
    setPendingUpdates([]);
  }, []);

  // Dismiss pending updates (revert them)
  const dismissPendingUpdates = useCallback(() => {
    // Remove the pending updates from WS state
    const nodesToRemove = new Set(
      pendingUpdates
        .filter((u) => u.type === "node_added")
        .map((u) => (u.data as GraphNode).id),
    );
    const edgesToRemove = new Set(
      pendingUpdates
        .filter((u) => u.type === "edge_added")
        .map((u) => (u.data as GraphEdge).id),
    );

    setWsNodes((prev) => prev.filter((n) => !nodesToRemove.has(n.id)));
    setWsEdges((prev) => prev.filter((e) => !edgesToRemove.has(e.id)));
    setPendingUpdates([]);
  }, [pendingUpdates]);

  return {
    data: mergedData,
    filteredData,
    isLoading,
    error,
    lastUpdated: lastWsEvent || lastUpdated,
    isConnected,
    isReconnecting,
    isStale,
    filters,
    applyFilters,
    resetFilters,
    refetch,
    reconnect: wsConnect,
    disconnect: wsDisconnect,
    pendingUpdates,
    applyPendingUpdates,
    dismissPendingUpdates,
    recentlyAddedNodeIds,
    recentlyAddedEdgeIds,
  };
}

export default useGraphDataWithWebSocket;
