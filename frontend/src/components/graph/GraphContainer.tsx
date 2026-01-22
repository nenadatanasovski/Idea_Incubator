/**
 * GraphContainer Component
 * Main container with responsive layout for graph canvas, filters, legend, and inspector panel
 */

import { useState, useCallback } from "react";
import type {
  GraphNode,
  GraphEdge,
  GraphFilters as GraphFiltersType,
} from "../../types/graph";
import { GraphCanvas } from "./GraphCanvas";
import { NodeInspector } from "./NodeInspector";
import { GraphFilters } from "./GraphFilters";
import { GraphLegend } from "./GraphLegend";
import { GraphControls } from "./GraphControls";
import { useGraphFilters } from "./hooks/useGraphFilters";

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
  // WebSocket status (for real-time updates)
  isConnected?: boolean;
  isReconnecting?: boolean;
  isStale?: boolean;
  // Recently added items (for animation highlighting)
  recentlyAddedNodeIds?: Set<string>;
  recentlyAddedEdgeIds?: Set<string>;
}

/**
 * Loading skeleton for the graph
 */
function GraphSkeleton() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-gray-900 rounded-lg animate-pulse">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mb-4" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2" />
        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
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
    <div className="flex items-center justify-center h-full min-h-[400px] bg-red-50 dark:bg-red-900/20 rounded-lg">
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
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">
          Failed to load graph
        </p>
        <p className="text-red-500 dark:text-red-300 text-sm mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
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
}: GraphContainerProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Use the filter hook for managing filter state
  const {
    graphFilter,
    blockTypeFilter,
    statusFilter,
    confidenceRange,
    setGraphFilter,
    setBlockTypeFilter,
    setStatusFilter,
    setConfidenceRange,
    filteredNodes,
    filteredEdges,
    resetFilters,
    hasActiveFilters,
  } = useGraphFilters(nodes, edges, { syncToUrl: syncFiltersToUrl });

  // Convert hook filter state to GraphFilters format for the component
  const currentFilters: GraphFiltersType = {
    graphTypes: graphFilter,
    blockTypes: blockTypeFilter,
    statuses: statusFilter,
    abstractionLevels: [],
    confidenceRange: [confidenceRange.min, confidenceRange.max],
  };

  // Handle filter changes from the GraphFilters component
  const handleFiltersChange = useCallback(
    (newFilters: GraphFiltersType) => {
      setGraphFilter(newFilters.graphTypes);
      setBlockTypeFilter(newFilters.blockTypes);
      setStatusFilter(newFilters.statuses);
      setConfidenceRange({
        min: newFilters.confidenceRange[0],
        max: newFilters.confidenceRange[1],
      });
    },
    [setGraphFilter, setBlockTypeFilter, setStatusFilter, setConfidenceRange],
  );

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

  // Navigate to a node from the inspector
  const handleInspectorNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        onNodeSelect?.(node);
      }
    },
    [nodes, onNodeSelect],
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
      {/* Left sidebar: Filters and Legend - Compact width to maximize graph space */}
      {(showFilters || showLegend) && (
        <div className="hidden lg:flex lg:flex-col w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {/* Filters */}
          {showFilters && (
            <GraphFilters
              filters={currentFilters}
              onFiltersChange={handleFiltersChange}
              onReset={resetFilters}
              nodeCount={nodes.length}
              filteredNodeCount={filteredNodes.length}
              className="border-b border-gray-200 dark:border-gray-700 rounded-none border-x-0"
            />
          )}

          {/* Legend */}
          {showLegend && (
            <GraphLegend
              className="border-none rounded-none"
              defaultCollapsed={false}
            />
          )}
        </div>
      )}

      {/* Main Graph Area */}
      <div className="flex-1 min-w-0 min-h-0 h-full relative">
        <GraphCanvas
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          selectedNodeId={selectedNode?.id}
          hoveredNodeId={hoveredNode?.id}
          recentlyAddedNodeIds={recentlyAddedNodeIds}
          recentlyAddedEdgeIds={recentlyAddedEdgeIds}
          className="h-full"
        />

        {/* Mobile Filter Toggle */}
        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="lg:hidden absolute top-4 left-4 z-10 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
            title="Toggle filters"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
            )}
          </button>
        )}

        {/* Mobile Filter Panel Overlay */}
        {showFilters && showFilterPanel && (
          <div className="lg:hidden absolute inset-0 z-20 bg-black/50">
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-white">
                  Filters
                </span>
                <button
                  onClick={() => setShowFilterPanel(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="w-5 h-5 text-gray-500"
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
              <GraphFilters
                filters={currentFilters}
                onFiltersChange={handleFiltersChange}
                onReset={resetFilters}
                nodeCount={nodes.length}
                filteredNodeCount={filteredNodes.length}
                className="border-none rounded-none"
              />
              {showLegend && (
                <GraphLegend
                  className="border-none rounded-none"
                  defaultCollapsed
                />
              )}
            </div>
          </div>
        )}

        {/* Top Controls Bar - Using GraphControls component */}
        {showControls && (
          <div className="absolute top-4 right-4 z-10">
            <GraphControls
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              lastUpdated={lastUpdated}
              isStale={isStale}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              showZoomControls={false}
              showLayoutControls={false}
            />
          </div>
        )}

        {/* Hovered Node Tooltip */}
        {hoveredNode && !selectedNode && (
          <div className="absolute bottom-16 left-4 z-10 max-w-xs p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {hoveredNode.label}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                {hoveredNode.blockType}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(hoveredNode.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        )}

        {/* Filter stats badge */}
        {hasActiveFilters && (
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs flex items-center gap-2">
            <span>
              Showing {filteredNodes.length} of {nodes.length} nodes
            </span>
            <button
              onClick={resetFilters}
              className="hover:text-blue-900 dark:hover:text-blue-100"
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
        )}

        {/* Node count badge (when no filters active) */}
        {!hasActiveFilters && (
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-white dark:bg-gray-800 rounded-full shadow-md text-xs text-gray-600 dark:text-gray-300">
            {nodes.length} nodes, {edges.length} edges
          </div>
        )}
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
        />
      )}
    </div>
  );
}

export default GraphContainer;
