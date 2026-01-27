/**
 * GraphContainer Component
 * Main container with responsive layout for graph canvas, filters, legend, and inspector panel
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type {
  GraphNode,
  GraphEdge,
  GraphFilters as GraphFiltersType,
  ClusterStrategy,
} from "../../types/graph";
import { GraphCanvas, GraphCanvasHandle } from "./GraphCanvas";
import type { LayoutOption } from "./GraphControls";
import { NodeInspector, RelationshipHoverInfo } from "./NodeInspector";
import { GraphLegend } from "./GraphLegend";
import { GraphControls } from "./GraphControls";
import { useGraphFilters } from "./hooks/useGraphFilters";
import { useGraphClustering } from "./hooks/useGraphClustering";
import { CycleIndicator } from "./CycleIndicator";
import { GraphQuickActions } from "./GraphQuickActions";
import { analyzeCycles } from "./utils/cycleDetection";
import { SourceSelectionModal } from "./SourceSelectionModal";
import type { ReportSynthesisJobStatus } from "./hooks/useReportSynthesisStatus";

export interface GraphContainerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  filters?: GraphFiltersType;
  onFiltersChange?: (filters: GraphFiltersType) => void;
  onNodeSelect?: (node: GraphNode | null) => void;
  onRefresh?: () => void;
  lastUpdated?: string | null;
  showFilters?: boolean;
  showLegend?: boolean;
  showControls?: boolean;
  syncFiltersToUrl?: boolean;
  className?: string;
  // Reset trigger - when this value changes, internal filters are reset
  resetFiltersTrigger?: number;
  // WebSocket status (for real-time updates)
  isConnected?: boolean;
  isReconnecting?: boolean;
  isStale?: boolean;
  // Recently added items (for animation highlighting)
  recentlyAddedNodeIds?: Set<string>;
  recentlyAddedEdgeIds?: Set<string>;
  // Memory Graph Update
  onUpdateMemoryGraph?: () => void;
  onAnalyzeWithSources?: (selectedSourceIds: string[]) => Promise<void>;
  isAnalyzingGraph?: boolean;
  isApplyingChanges?: boolean; // Flag to prevent auto-open during apply phase
  pendingGraphChanges?: number;
  // AI Prompt
  sessionId?: string;
  ideaSlug?: string; // Optional idea slug for file-based artifacts
  onPromptHighlight?: (nodeIds: string[]) => void;
  onPromptFilterChange?: (filters: Partial<GraphFiltersType>) => void;
  // Source navigation callbacks
  onNavigateToChatMessage?: (messageId: string, turnIndex?: number) => void;
  onNavigateToArtifact?: (artifactId: string, section?: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  onNavigateToExternal?: (url: string) => void;
  // Selection actions
  onLinkNode?: (nodeId: string) => void;
  onGroupIntoSynthesis?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string, nodeLabel: string) => void;
  /** Callback to delete all nodes in a group (from Node Group Report view) */
  onDeleteNodeGroup?: (nodeIds: string[], groupName: string) => void;
  // Success notification
  successNotification?: {
    action: "created" | "updated" | "deleted";
    nodeLabel: string;
  } | null;
  onClearNotification?: () => void;
  // Snapshot/Versioning
  onSaveSnapshot?: (name: string, description?: string) => Promise<void>;
  onRestoreSnapshot?: (snapshotId: string) => Promise<void>;
  onDeleteSnapshot?: (snapshotId: string) => Promise<void>;
  onLoadSnapshots?: () => void;
  snapshots?: Array<{
    id: string;
    sessionId: string;
    name: string;
    description: string | null;
    blockCount: number;
    linkCount: number;
    createdAt: string;
  }>;
  isLoadingSnapshots?: boolean;
  isSavingSnapshot?: boolean;
  isRestoringSnapshot?: boolean;
  // Report refresh trigger - increments when report synthesis completes
  reportRefreshTrigger?: number;
  // Report synthesis status (for displaying status pill in controls)
  reportSynthesisStatus?: ReportSynthesisJobStatus;
  onCancelReportSynthesis?: () => void;
  onDismissReportSynthesisStatus?: () => void;
}

/**
 * Loading skeleton for the graph
 */
function GraphSkeleton() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 rounded-lg animate-pulse">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 w-32 bg-gray-200 rounded mx-auto mb-2" />
        <div className="h-3 w-48 bg-gray-200 rounded mx-auto" />
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function GraphError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-red-50 rounded-lg">
      <div className="text-center p-6">
        <svg
          className="mx-auto h-12 w-12 text-red-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-red-600 font-medium mb-2">Failed to load graph</p>
        <p className="text-red-500 text-sm mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Main Graph Container Component
 */
export function GraphContainer({
  nodes,
  edges,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onNodeSelect,
  onRefresh,
  lastUpdated,
  showFilters = true,
  showLegend = true,
  showControls = true,
  syncFiltersToUrl = false,
  className = "",
  isConnected,
  isReconnecting = false,
  isStale = false,
  recentlyAddedNodeIds,
  recentlyAddedEdgeIds,
  onUpdateMemoryGraph,
  onAnalyzeWithSources,
  isAnalyzingGraph = false,
  isApplyingChanges = false,
  pendingGraphChanges = 0,
  sessionId,
  ideaSlug,
  onPromptHighlight,
  onPromptFilterChange,
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
  onLinkNode,
  onGroupIntoSynthesis,
  onDeleteNode,
  onDeleteNodeGroup,
  resetFiltersTrigger,
  successNotification,
  onClearNotification,
  // Snapshot/Versioning
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onLoadSnapshots,
  snapshots = [],
  isLoadingSnapshots = false,
  isSavingSnapshot = false,
  isRestoringSnapshot = false,
  reportRefreshTrigger,
  reportSynthesisStatus,
  onCancelReportSynthesis,
  onDismissReportSynthesisStatus,
}: GraphContainerProps) {
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [currentLayout, setCurrentLayout] = useState<LayoutOption>("treeLr2d");
  const [hoveredRelationship, setHoveredRelationship] =
    useState<RelationshipHoverInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cycleNodeIds, setCycleNodeIds] = useState<Set<string>>(new Set());
  const [hoveredCycleNodeId, setHoveredCycleNodeId] = useState<string | null>(
    null,
  );
  const [hoveredCycleNodeIds, setHoveredCycleNodeIds] = useState<string[]>([]);
  // Track which bottom pill is expanded - only one at a time
  const [expandedPill, setExpandedPill] = useState<
    "actions" | "cycles" | "legend" | null
  >(null);
  // Report view state - tracks layout override and highlighted group nodes
  const [reportViewNodeIds, setReportViewNodeIds] = useState<string[]>([]);
  // Use ref to avoid callback dependency issues
  const layoutBeforeReportViewRef = useRef<LayoutOption | null>(null);

  // Source selection modal state
  const [showSourceSelectionModal, setShowSourceSelectionModal] =
    useState(false);
  // Track if auto-open has been attempted (only once per mount)
  const hasAutoOpenedRef = useRef(false);
  // Debounce timeout for relationship hover focus
  const relationshipHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss success notification after 2 seconds
  useEffect(() => {
    if (successNotification && onClearNotification) {
      const timer = setTimeout(() => {
        onClearNotification();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successNotification, onClearNotification]);

  // Close inspector panel when a node is deleted
  useEffect(() => {
    if (successNotification?.action === "deleted") {
      setSelectedNode(null);
      onNodeSelect?.(null);
    }
  }, [successNotification, onNodeSelect]);

  // Auto-open source selection modal when graph is empty (only on initial load)
  useEffect(() => {
    // Only auto-open once per mount if:
    // 1. Haven't already auto-opened
    // 2. Graph has no nodes
    // 3. We have the analyze callback available
    // 4. We're not currently loading, analyzing, or applying changes
    // 5. We have a sessionId
    // 6. Initial data load has completed (lastUpdated is set)
    if (
      !hasAutoOpenedRef.current &&
      nodes.length === 0 &&
      onAnalyzeWithSources &&
      !isLoading &&
      !isAnalyzingGraph &&
      !isApplyingChanges &&
      sessionId &&
      lastUpdated // Only auto-open AFTER initial data load completes
    ) {
      hasAutoOpenedRef.current = true;
      setShowSourceSelectionModal(true);
    }
  }, [
    nodes.length,
    onAnalyzeWithSources,
    isLoading,
    isAnalyzingGraph,
    isApplyingChanges,
    sessionId,
    lastUpdated,
  ]);

  // Compute highlighted node and edge IDs from hovered relationship, cycle node, or report view
  const highlightedNodeIds = useMemo(() => {
    // Report view highlighting takes priority - show all group nodes
    if (reportViewNodeIds.length > 0) {
      return reportViewNodeIds;
    }
    // Cycle card header hover - highlight all nodes in the cycle
    if (hoveredCycleNodeIds.length > 0) {
      return hoveredCycleNodeIds;
    }
    // Single cycle node hover takes priority
    if (hoveredCycleNodeId) {
      return [hoveredCycleNodeId];
    }
    if (!hoveredRelationship) return [];
    return [
      hoveredRelationship.currentNodeId,
      hoveredRelationship.relatedNodeId,
    ];
  }, [
    hoveredRelationship,
    hoveredCycleNodeId,
    hoveredCycleNodeIds,
    reportViewNodeIds,
  ]);

  const highlightedEdgeIds = useMemo(() => {
    if (!hoveredRelationship) return [];
    return [hoveredRelationship.edgeId];
  }, [hoveredRelationship]);

  // Analyze graph for cycles (T7.2)
  const cycleAnalysis = useMemo(() => {
    return analyzeCycles(nodes, edges);
  }, [nodes, edges]);

  const hasCycles = cycleAnalysis.cycles.length > 0;

  // Use the filter hook for managing filter state
  const {
    graphFilter,
    blockTypeFilter,
    statusFilter,
    abstractionFilter,
    sourceTypeFilter,
    confidenceRange,
    setGraphFilter,
    setBlockTypeFilter,
    setStatusFilter,
    setAbstractionFilter,
    setSourceTypeFilter,
    setConfidenceRange,
    filteredNodes,
    filteredEdges,
    resetFilters,
    hasActiveFilters,
  } = useGraphFilters(nodes, edges, { syncToUrl: syncFiltersToUrl });

  // Reset internal filters when trigger changes (from parent "Show all" button)
  useEffect(() => {
    if (resetFiltersTrigger !== undefined && resetFiltersTrigger > 0) {
      resetFilters();
      setSearchQuery("");
    }
  }, [resetFiltersTrigger, resetFilters]);

  // Use the clustering hook for managing cluster state
  const {
    clusterStrategy,
    setClusterStrategy,
    clusterStrength,
    setClusterStrength,
    applyClusterAssignments,
  } = useGraphClustering(nodes, { syncToUrl: syncFiltersToUrl });

  // Convert hook filter state to GraphFilters format for the component
  const currentFilters: GraphFiltersType = {
    graphTypes: graphFilter,
    blockTypes: blockTypeFilter,
    statuses: statusFilter,
    abstractionLevels: abstractionFilter,
    sourceTypes: sourceTypeFilter,
    confidenceRange: [confidenceRange.min, confidenceRange.max],
  };

  // Handle filter changes from the GraphFilters component
  const handleFiltersChange = useCallback(
    (newFilters: GraphFiltersType) => {
      setGraphFilter(newFilters.graphTypes);
      setBlockTypeFilter(newFilters.blockTypes);
      setStatusFilter(newFilters.statuses);
      setAbstractionFilter(newFilters.abstractionLevels);
      setSourceTypeFilter(newFilters.sourceTypes);
      setConfidenceRange({
        min: newFilters.confidenceRange[0],
        max: newFilters.confidenceRange[1],
      });
    },
    [
      setGraphFilter,
      setBlockTypeFilter,
      setStatusFilter,
      setAbstractionFilter,
      setSourceTypeFilter,
      setConfidenceRange,
    ],
  );

  // Handle search query change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle layout change
  const handleLayoutChange = useCallback(
    (layout: LayoutOption) => {
      setCurrentLayout(layout);
      // If switching away from force-directed and clustering is enabled, disable clustering
      // (clustering only works with force-directed layouts in reagraph)
      if (layout !== "forceDirected2d" && clusterStrategy !== "none") {
        setClusterStrategy("none");
      }
    },
    [clusterStrategy, setClusterStrategy],
  );

  // Handle cluster strategy change - automatically switch to force-directed layout when clustering is enabled
  // (clustering only works with force-directed layouts in reagraph)
  const handleClusterStrategyChange = useCallback(
    (strategy: ClusterStrategy) => {
      setClusterStrategy(strategy);
      // If enabling clustering and not using force-directed layout, switch to it
      if (strategy !== "none" && currentLayout !== "forceDirected2d") {
        setCurrentLayout("forceDirected2d");
      }
    },
    [setClusterStrategy, currentLayout],
  );

  // Handle cycle node IDs from CycleIndicator for canvas highlighting
  const handleCycleNodeIds = useCallback((nodeIds: string[]) => {
    setCycleNodeIds(new Set(nodeIds));
  }, []);

  // Handle pill expansion - only one can be expanded at a time
  const handleActionsExpandedChange = useCallback((expanded: boolean) => {
    setExpandedPill(expanded ? "actions" : null);
  }, []);

  const handleCyclesExpandedChange = useCallback((expanded: boolean) => {
    setExpandedPill(expanded ? "cycles" : null);
  }, []);

  const handleLegendExpandedChange = useCallback((expanded: boolean) => {
    setExpandedPill(expanded ? "legend" : null);
  }, []);

  // Handle cycle member row hover - highlight node and zoom to it
  const handleCycleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredCycleNodeId(nodeId);
    if (nodeId) {
      // Zoom to show the hovered node in center view
      graphCanvasRef.current?.fitNodesInView([nodeId]);
    }
  }, []);

  // Handle cycle card header hover - highlight all cycle nodes and zoom to fit them
  const handleCycleHover = useCallback((nodeIds: string[] | null) => {
    setHoveredCycleNodeIds(nodeIds || []);
    if (nodeIds && nodeIds.length > 0) {
      // Zoom to show all cycle nodes in view
      graphCanvasRef.current?.fitNodesInView(nodeIds);
    }
  }, []);

  // Handle report view state changes - switches layout, highlights nodes, and zooms
  const handleReportViewChange = useCallback(
    (active: boolean, nodeIds: string[]) => {
      if (active && nodeIds.length > 0) {
        // Entering report view: save current layout, switch to force-directed, highlight nodes
        setCurrentLayout((prevLayout) => {
          // Only save if we haven't already saved (prevent overwriting on re-renders)
          if (layoutBeforeReportViewRef.current === null) {
            layoutBeforeReportViewRef.current = prevLayout;
          }
          return "forceDirected2d";
        });
        setReportViewNodeIds(nodeIds);
        // Zoom to fit all group nodes with a slight delay to allow layout transition
        setTimeout(() => {
          graphCanvasRef.current?.fitNodesInView(nodeIds, { slow: true });
        }, 100);
      } else {
        // Exiting report view: restore previous layout and clear highlights
        if (layoutBeforeReportViewRef.current !== null) {
          setCurrentLayout(layoutBeforeReportViewRef.current);
          layoutBeforeReportViewRef.current = null;
        }
        setReportViewNodeIds([]);
      }
    },
    [], // No dependencies - uses refs and functional updates
  );

  // Handle focusing on selected node (when switching to Node Details tab)
  const handleFocusOnSelectedNode = useCallback((nodeId: string) => {
    graphCanvasRef.current?.focusOnNode(nodeId);
  }, []);

  // Handle opening source selection modal
  const handleOpenSourceSelection = useCallback(() => {
    setShowSourceSelectionModal(true);
  }, []);

  // Handle source selection confirm (reset & analyze)
  const handleSourceSelectionConfirm = useCallback(
    async (selectedSourceIds: string[]) => {
      // Close modal immediately to prevent double-clicks
      // (analysis completion would briefly enable the button before the modal closes)
      setShowSourceSelectionModal(false);
      if (onAnalyzeWithSources) {
        await onAnalyzeWithSources(selectedSourceIds);
      }
    },
    [onAnalyzeWithSources],
  );

  // Apply search filtering to nodes
  const searchFilteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredNodes;
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    const matchedNodes = filteredNodes.filter((node) => {
      // Search in content
      if (node.content?.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in label
      if (node.label?.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in block type
      if (node.blockType?.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in graph membership
      if (
        node.graphMembership?.some((g) => g.toLowerCase().includes(lowerQuery))
      ) {
        return true;
      }
      return false;
    });

    // If hovering over a relationship or cycle node, temporarily include the node
    // even if it's hidden by the search filter or other filters
    let result = matchedNodes;
    const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));

    if (hoveredRelationship) {
      const relatedNodeId = hoveredRelationship.relatedNodeId;
      // Check if the related node is not already in the matched nodes
      if (!matchedNodeIds.has(relatedNodeId)) {
        // Find the related node from the full nodes list (not filtered)
        // because the NodeInspector shows all relationships regardless of filters
        const relatedNode = nodes.find((n) => n.id === relatedNodeId);
        if (relatedNode) {
          result = [...result, relatedNode];
          matchedNodeIds.add(relatedNodeId);
        }
      }
    }

    // Also include hovered cycle node if filtered out
    if (hoveredCycleNodeId && !matchedNodeIds.has(hoveredCycleNodeId)) {
      const hoveredNode = nodes.find((n) => n.id === hoveredCycleNodeId);
      if (hoveredNode) {
        result = [...result, hoveredNode];
      }
    }

    return result;
  }, [
    filteredNodes,
    nodes,
    searchQuery,
    hoveredRelationship,
    hoveredCycleNodeId,
  ]);

  // Apply cluster assignments to nodes based on current strategy
  const clusteredNodes = useMemo(() => {
    return applyClusterAssignments(searchFilteredNodes);
  }, [searchFilteredNodes, applyClusterAssignments]);

  // Filter edges to only include those between search-filtered nodes
  const searchFilteredEdges = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredEdges;
    }

    const visibleNodeIds = new Set(searchFilteredNodes.map((node) => node.id));
    const matchedEdges = filteredEdges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );

    // If hovering over a relationship, ensure the edge is included
    // even if filtered out by other filters
    if (hoveredRelationship) {
      const hoveredEdgeId = hoveredRelationship.edgeId;
      const hasHoveredEdge = matchedEdges.some((e) => e.id === hoveredEdgeId);

      if (!hasHoveredEdge) {
        // Look in full edges list since NodeInspector shows all relationships
        const hoveredEdge = edges.find((e) => e.id === hoveredEdgeId);
        if (hoveredEdge) {
          return [...matchedEdges, hoveredEdge];
        }
      }
    }

    return matchedEdges;
  }, [
    edges,
    filteredEdges,
    searchFilteredNodes,
    searchQuery,
    hoveredRelationship,
  ]);

  // Compute which nodes are temporarily visible (due to relationship/cycle hover but normally filtered)
  const temporarilyVisibleNodeIds = useMemo(() => {
    const tempVisible = new Set<string>();

    // Helper to check if a node would normally be visible
    const isNodeNormallyVisible = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;

      // Check if node passes filters
      const isInFilteredNodes = filteredNodes.some((n) => n.id === nodeId);
      if (!isInFilteredNodes) return false;

      // If no search query, node is visible
      if (!searchQuery.trim()) return true;

      // Check if node matches search query
      const lowerQuery = searchQuery.toLowerCase().trim();
      return (
        node.content?.toLowerCase().includes(lowerQuery) ||
        node.label?.toLowerCase().includes(lowerQuery) ||
        node.blockType?.toLowerCase().includes(lowerQuery) ||
        node.graphMembership?.some((g) =>
          g.toLowerCase().includes(lowerQuery),
        ) ||
        false
      );
    };

    // Check hovered relationship node
    if (hoveredRelationship) {
      const relatedNodeId = hoveredRelationship.relatedNodeId;
      if (!isNodeNormallyVisible(relatedNodeId)) {
        tempVisible.add(relatedNodeId);
      }
    }

    // Check hovered cycle node
    if (hoveredCycleNodeId && !isNodeNormallyVisible(hoveredCycleNodeId)) {
      tempVisible.add(hoveredCycleNodeId);
    }

    return tempVisible;
  }, [
    hoveredRelationship,
    hoveredCycleNodeId,
    searchQuery,
    nodes,
    filteredNodes,
  ]);

  // Compute which edges are temporarily visible
  const temporarilyVisibleEdgeIds = useMemo(() => {
    if (!hoveredRelationship || !searchQuery.trim()) {
      return new Set<string>();
    }

    const hoveredEdgeId = hoveredRelationship.edgeId;

    // Check if the edge would normally be in the filtered edges
    const isInFilteredEdges = filteredEdges.some((e) => e.id === hoveredEdgeId);

    // If the related node is temporarily visible, the edge is too
    if (
      temporarilyVisibleNodeIds.has(hoveredRelationship.relatedNodeId) ||
      !isInFilteredEdges
    ) {
      return new Set([hoveredEdgeId]);
    }

    return new Set<string>();
  }, [
    hoveredRelationship,
    searchQuery,
    filteredEdges,
    temporarilyVisibleNodeIds,
  ]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      onNodeSelect?.(node);
    },
    [onNodeSelect],
  );

  // Handle node hover
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
  }, []);

  // Close inspector panel and clear all highlight states
  // Hard rule: clicking empty canvas space must remove all overlays
  const handleCloseInspector = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
    // Clear all hover/highlight states that contribute to the overlay
    setHoveredNode(null);
    setHoveredRelationship(null);
    setHoveredCycleNodeId(null);
    setHoveredCycleNodeIds([]);
    // Clear any pending relationship hover camera movements
    if (relationshipHoverTimeoutRef.current) {
      clearTimeout(relationshipHoverTimeoutRef.current);
      relationshipHoverTimeoutRef.current = null;
    }
  }, [onNodeSelect]);

  // Navigate to a node from the inspector and focus on it in the canvas
  const handleInspectorNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        onNodeSelect?.(node);
        // Focus on the node in the canvas and bring it into view
        graphCanvasRef.current?.focusOnNode(nodeId);
      }
    },
    [nodes, onNodeSelect],
  );

  // Handle relationship hover from inspector
  const handleRelationshipHover = useCallback(
    (info: RelationshipHoverInfo | null) => {
      setHoveredRelationship(info);

      // Clear any pending hover timeout
      if (relationshipHoverTimeoutRef.current) {
        clearTimeout(relationshipHoverTimeoutRef.current);
        relationshipHoverTimeoutRef.current = null;
      }

      // Zoom to show both nodes when hovering - use 250ms debounce for quick row changes
      if (info) {
        relationshipHoverTimeoutRef.current = setTimeout(() => {
          // Use slow option for 50% slower camera transition speed
          graphCanvasRef.current?.fitNodesInView(
            [info.currentNodeId, info.relatedNodeId],
            { slow: true },
          );
        }, 250);
      } else if (selectedNode) {
        // Restore focus to the selected node when unhovering
        relationshipHoverTimeoutRef.current = setTimeout(() => {
          graphCanvasRef.current?.fitNodesInView([selectedNode.id], {
            slow: true,
          });
        }, 250);
      }
    },
    [selectedNode],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex h-full ${className}`}>
        <div className="flex-1">
          <GraphSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex h-full ${className}`}>
        <div className="flex-1">
          <GraphError message={error} onRetry={onRefresh} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${className}`} data-testid="graph-container">
      {/* Main Graph Area */}
      <div className="flex-1 min-w-0 min-h-0 h-full relative">
        <GraphCanvas
          ref={graphCanvasRef}
          nodes={clusteredNodes}
          edges={searchFilteredEdges}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onCanvasClick={handleCloseInspector}
          selectedNodeId={selectedNode?.id}
          hoveredNodeId={hoveredNode?.id}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          recentlyAddedNodeIds={recentlyAddedNodeIds}
          recentlyAddedEdgeIds={recentlyAddedEdgeIds}
          temporarilyVisibleNodeIds={temporarilyVisibleNodeIds}
          temporarilyVisibleEdgeIds={temporarilyVisibleEdgeIds}
          cycleNodeIds={cycleNodeIds}
          layoutType={currentLayout}
          clusterAttribute={clusterStrategy !== "none" ? "cluster" : undefined}
          clusterStrength={clusterStrength}
          totalNodeCount={nodes.length}
          showAllLabels={reportViewNodeIds.length > 0}
          className="h-full"
        />

        {/* Analyzing Overlay */}
        {isAnalyzingGraph && (
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-20"
            data-testid="graph-analyzing-overlay"
          >
            <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {/* Brain icon */}
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Analyzing Sources
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Extracting insights for your knowledge graph...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Notification Pill */}
        {successNotification && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-2 duration-200"
            data-testid="graph-success-notification"
          >
            <div
              className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium ${
                successNotification.action === "deleted"
                  ? "bg-red-100 text-red-800"
                  : successNotification.action === "created"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
              }`}
            >
              {successNotification.action === "deleted" && (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
              {successNotification.action === "created" && (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
              {successNotification.action === "updated" && (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span className="truncate max-w-[200px]">
                {successNotification.action === "deleted" && "Deleted: "}
                {successNotification.action === "created" && "Created: "}
                {successNotification.action === "updated" && "Updated: "}
                {successNotification.nodeLabel}
              </span>
            </div>
          </div>
        )}

        {/* Top Controls Bar - Using GraphControls component */}
        {showControls && (
          <div className="absolute top-4 left-4 z-50">
            <GraphControls
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              lastUpdated={lastUpdated}
              isStale={isStale}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              onUpdateMemoryGraph={
                onAnalyzeWithSources
                  ? handleOpenSourceSelection
                  : onUpdateMemoryGraph
              }
              isAnalyzingGraph={isAnalyzingGraph}
              pendingGraphChanges={pendingGraphChanges}
              showZoomControls={false}
              showLayoutControls={true}
              currentLayout={currentLayout}
              onLayoutChange={handleLayoutChange}
              showClusterControls={true}
              currentClusterStrategy={clusterStrategy}
              onClusterStrategyChange={handleClusterStrategyChange}
              clusterStrength={clusterStrength}
              onClusterStrengthChange={setClusterStrength}
              sessionId={sessionId}
              onPromptHighlight={onPromptHighlight}
              onPromptFilterChange={onPromptFilterChange}
              promptDisabled={isLoading}
              onSearchChange={handleSearchChange}
              searchQuery={searchQuery}
              searchResultCount={searchFilteredNodes.length}
              totalNodeCount={filteredNodes.length}
              filters={showFilters ? currentFilters : undefined}
              onFiltersChange={showFilters ? handleFiltersChange : undefined}
              onFiltersReset={showFilters ? resetFilters : undefined}
              nodeCount={nodes.length}
              filteredNodeCount={filteredNodes.length}
              // Snapshot/Versioning
              snapshots={snapshots}
              onSaveSnapshot={onSaveSnapshot}
              onRestoreSnapshot={onRestoreSnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
              onLoadSnapshots={onLoadSnapshots}
              isLoadingSnapshots={isLoadingSnapshots}
              isSavingSnapshot={isSavingSnapshot}
              isRestoringSnapshot={isRestoringSnapshot}
              // Report synthesis status
              reportSynthesisStatus={reportSynthesisStatus}
              onCancelReportSynthesis={onCancelReportSynthesis}
              onDismissReportSynthesisStatus={onDismissReportSynthesisStatus}
            />
          </div>
        )}

        {/* Hovered Node Tooltip */}
        {hoveredNode && !selectedNode && (
          <div className="absolute bottom-16 left-4 z-20 max-w-2xl p-4 bg-white rounded-lg shadow-lg border border-gray-200">
            <p className="font-medium text-gray-900 text-sm whitespace-pre-wrap">
              {hoveredNode.content || hoveredNode.label}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {hoveredNode.blockType}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(hoveredNode.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        )}

        {/* Bottom Left - Legend pill and stats */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          {/* Legend Pill */}
          {showLegend && (
            <GraphLegend
              isExpanded={expandedPill === "legend"}
              onExpandedChange={handleLegendExpandedChange}
            />
          )}

          {/* Stats badge */}
          {hasActiveFilters || searchQuery ? (
            <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs flex items-center gap-2 border border-white">
              <span>
                Showing {searchFilteredNodes.length} of {nodes.length} nodes
                {searchQuery && ` (search: "${searchQuery}")`}
              </span>
              <button
                onClick={() => {
                  resetFilters();
                  setSearchQuery("");
                }}
                className="hover:text-blue-900"
                title="Clear filters"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="px-3 py-1 bg-white rounded-full shadow-md text-xs text-gray-600 border border-white">
              {nodes.length} nodes, {edges.length} edges
            </div>
          )}
        </div>

        {/* Bottom Right Pills - Actions and Cycles (only one expanded at a time) */}
        <div className="absolute bottom-4 right-4 z-10 flex items-end gap-2">
          {/* Quick Actions Pill */}
          {sessionId && (
            <GraphQuickActions
              sessionId={sessionId}
              selectedNodeIds={selectedNode ? [selectedNode.id] : []}
              onActionComplete={onRefresh || (() => {})}
              disabled={isLoading || isAnalyzingGraph}
              isExpanded={expandedPill === "actions"}
              onExpandedChange={handleActionsExpandedChange}
            />
          )}

          {/* Cycle Indicator Pill */}
          {hasCycles && (
            <CycleIndicator
              nodes={nodes}
              edges={edges}
              showAll
              onNodeClick={handleInspectorNodeClick}
              onNodeHover={handleCycleNodeHover}
              onCycleHover={handleCycleHover}
              onCycleNodeIds={handleCycleNodeIds}
              isExpanded={expandedPill === "cycles"}
              onExpandedChange={handleCyclesExpandedChange}
            />
          )}
        </div>
      </div>

      {/* Inspector Panel (right side)
       * NOTE: We intentionally pass unfiltered edges/nodes to allow exploring
       * the full relationship graph from the inspector, regardless of current filters.
       * This enables discovery of connections that might be hidden by filters.
       */}
      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          edges={edges}
          nodes={nodes}
          sessionId={sessionId}
          onClose={handleCloseInspector}
          onNodeClick={handleInspectorNodeClick}
          onRelationshipHover={handleRelationshipHover}
          onNavigateToChatMessage={onNavigateToChatMessage}
          onNavigateToArtifact={onNavigateToArtifact}
          onNavigateToMemoryDB={onNavigateToMemoryDB}
          onNavigateToExternal={onNavigateToExternal}
          onLinkNode={onLinkNode}
          onGroupIntoSynthesis={onGroupIntoSynthesis}
          onDeleteNode={onDeleteNode}
          onDeleteNodeGroup={onDeleteNodeGroup}
          reportRefreshTrigger={reportRefreshTrigger}
          onReportViewChange={handleReportViewChange}
          onFocusOnSelectedNode={handleFocusOnSelectedNode}
        />
      )}

      {/* Source Selection Modal */}
      {sessionId && (
        <SourceSelectionModal
          isOpen={showSourceSelectionModal}
          onClose={() => setShowSourceSelectionModal(false)}
          sessionId={sessionId}
          ideaSlug={ideaSlug}
          onConfirm={handleSourceSelectionConfirm}
          isProcessing={isAnalyzingGraph}
        />
      )}
    </div>
  );
}

export default GraphContainer;
