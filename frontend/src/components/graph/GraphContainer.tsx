/**
 * GraphContainer Component
 * Main container with responsive layout for graph canvas, filters, legend, and inspector panel
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type {
  GraphNode,
  GraphEdge,
  GraphFilters as GraphFiltersType,
} from "../../types/graph";
import { GraphCanvas, GraphCanvasHandle } from "./GraphCanvas";
import { NodeInspector, RelationshipHoverInfo } from "./NodeInspector";
import { GraphLegend } from "./GraphLegend";
import { GraphControls } from "./GraphControls";
import { useGraphFilters } from "./hooks/useGraphFilters";
import { useGraphClustering } from "./hooks/useGraphClustering";
import { CycleIndicator } from "./CycleIndicator";
import { GraphQuickActions } from "./GraphQuickActions";
import { analyzeCycles } from "./utils/cycleDetection";
import { SourceSelectionModal } from "./SourceSelectionModal";

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
  pendingGraphChanges?: number;
  // AI Prompt
  sessionId?: string;
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
  onDeleteNode?: (nodeId: string) => void;
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
  pendingGraphChanges = 0,
  sessionId,
  onPromptHighlight,
  onPromptFilterChange,
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
  onLinkNode,
  onGroupIntoSynthesis,
  onDeleteNode,
  resetFiltersTrigger,
}: GraphContainerProps) {
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
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

  // Source selection modal state
  const [showSourceSelectionModal, setShowSourceSelectionModal] =
    useState(false);

  // Compute highlighted node and edge IDs from hovered relationship or cycle node
  const highlightedNodeIds = useMemo(() => {
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
  }, [hoveredRelationship, hoveredCycleNodeId, hoveredCycleNodeIds]);

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

  // Handle opening source selection modal
  const handleOpenSourceSelection = useCallback(() => {
    setShowSourceSelectionModal(true);
  }, []);

  // Handle source selection confirm (reset & analyze)
  const handleSourceSelectionConfirm = useCallback(
    async (selectedSourceIds: string[]) => {
      if (onAnalyzeWithSources) {
        await onAnalyzeWithSources(selectedSourceIds);
      }
      setShowSourceSelectionModal(false);
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

  // Close inspector panel
  const handleCloseInspector = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
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
      // Zoom to show both nodes when hovering - use small delay to ensure layout is settled
      if (info) {
        // Immediate call for responsiveness
        graphCanvasRef.current?.fitNodesInView([
          info.currentNodeId,
          info.relatedNodeId,
        ]);
        // Follow-up call after layout settles to ensure both nodes are properly in view
        setTimeout(() => {
          graphCanvasRef.current?.fitNodesInView([
            info.currentNodeId,
            info.relatedNodeId,
          ]);
        }, 50);
      }
    },
    [],
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
          clusterAttribute={clusterStrategy !== "none" ? "cluster" : undefined}
          clusterStrength={clusterStrength}
          totalNodeCount={nodes.length}
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
                  Analyzing All Sources
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Chat, Artifacts, Memory Files, Manual Insights...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls Bar - Using GraphControls component */}
        {showControls && (
          <div className="absolute top-4 left-4 z-10">
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
              showLayoutControls={false}
              showClusterControls={true}
              currentClusterStrategy={clusterStrategy}
              onClusterStrategyChange={setClusterStrategy}
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
            />
          </div>
        )}

        {/* Hovered Node Tooltip */}
        {hoveredNode && !selectedNode && (
          <div className="absolute bottom-16 left-4 z-10 max-w-2xl p-4 bg-white rounded-lg shadow-lg border border-gray-200">
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
        <div className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
          {/* Legend Pill */}
          {showLegend && (
            <GraphLegend
              isExpanded={expandedPill === "legend"}
              onExpandedChange={handleLegendExpandedChange}
            />
          )}

          {/* Stats badge */}
          {hasActiveFilters || searchQuery ? (
            <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs flex items-center gap-2">
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
            <div className="px-3 py-1 bg-white rounded-full shadow-md text-xs text-gray-600">
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
        />
      )}

      {/* Source Selection Modal */}
      {sessionId && (
        <SourceSelectionModal
          isOpen={showSourceSelectionModal}
          onClose={() => setShowSourceSelectionModal(false)}
          sessionId={sessionId}
          onConfirm={handleSourceSelectionConfirm}
          isProcessing={isAnalyzingGraph}
        />
      )}
    </div>
  );
}

export default GraphContainer;
