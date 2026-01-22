/**
 * GraphCanvas Component
 * Renders the Memory Graph using Reagraph with WebGL acceleration
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  GraphCanvas as ReagraphCanvas,
  GraphCanvasRef,
  useSelection,
} from "reagraph";
import type { GraphNode, GraphEdge } from "../../types/graph";

// Reagraph internal node type (simplified for our handlers)
interface InternalGraphNode {
  id: string;
  data?: unknown;
}
import {
  getNodeColor,
  getNodeShape,
  getNodeBorderColor,
  getNodeOpacity,
  calculateNodeSize,
  createConnectionCountMap,
} from "./utils/nodeStyles";
import {
  getEdgeColor,
  getEdgeLineStyle,
  getEdgeOpacity,
  getEdgeWidth,
} from "./utils/edgeStyles";

export type LayoutType = "forceDirected" | "hierarchical" | "radial";

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  highlightedNodeIds?: string[];
  recentlyAddedNodeIds?: Set<string>;
  recentlyAddedEdgeIds?: Set<string>;
  layoutType?: LayoutType;
  className?: string;
}

/**
 * Transform our GraphNode to Reagraph node format
 */
function toReagraphNode(
  node: GraphNode,
  connectionCount: number,
  isSelected: boolean,
  isHovered: boolean,
  isHighlighted: boolean,
  isRecentlyAdded: boolean,
  hasFileReferences: boolean,
) {
  const size = calculateNodeSize(node.confidence, connectionCount);
  const baseOpacity = getNodeOpacity(node.confidence);

  // Apply status-based opacity reduction
  let opacity = baseOpacity;
  if (node.status === "draft") opacity *= 0.7;
  if (node.status === "superseded") opacity *= 0.5;
  if (node.status === "abandoned") opacity *= 0.3;

  // Highlight selected/hovered/highlighted/recently added nodes
  let strokeWidth = 2;
  let stroke = getNodeBorderColor(node.graphMembership);

  if (isSelected) {
    strokeWidth = 4;
    stroke = "#FBBF24"; // Yellow
  } else if (isRecentlyAdded) {
    // Bright green pulsing effect for newly added nodes
    strokeWidth = 4;
    stroke = "#22C55E"; // Green-500
  } else if (isHighlighted) {
    strokeWidth = 3;
    stroke = "#F97316"; // Orange for highlighted
  } else if (isHovered) {
    strokeWidth = 3;
    stroke = "#60A5FA"; // Blue
  }

  // Increase size slightly for recently added nodes to make them more visible
  const finalSize = isRecentlyAdded ? size * 1.2 : size;

  // Add file reference indicator as subLabel (📎 icon)
  const subLabel = hasFileReferences ? "📎" : undefined;

  // Nodes with file references get a secondary ring color
  if (
    hasFileReferences &&
    !isSelected &&
    !isRecentlyAdded &&
    !isHighlighted &&
    !isHovered
  ) {
    stroke = "#8B5CF6"; // Purple for file-referenced nodes
    strokeWidth = 2.5;
  }

  return {
    id: node.id,
    label: node.label,
    subLabel,
    fill: isRecentlyAdded ? "#4ADE80" : getNodeColor(node.blockType), // Lighter green fill for new nodes
    size: finalSize,
    opacity,
    stroke,
    strokeWidth,
    shape: getNodeShape(node.graphMembership),
    data: node, // Attach original node data
  };
}

/**
 * Transform our GraphEdge to Reagraph edge format
 */
function toReagraphEdge(
  edge: GraphEdge,
  isHighlighted: boolean,
  isRecentlyAdded: boolean,
) {
  const lineStyle = getEdgeLineStyle(edge.linkType);
  const opacity = getEdgeOpacity(edge.confidence);
  const width = getEdgeWidth(edge.degree);

  // Apply status-based opacity reduction
  let finalOpacity = opacity;
  if (edge.status === "superseded") finalOpacity *= 0.5;
  if (edge.status === "removed") finalOpacity *= 0.2;

  // Convert line style to strokeDasharray for Reagraph
  let strokeDasharray: number[] | undefined;
  if (lineStyle === "dashed") {
    strokeDasharray = [8, 4];
  } else if (lineStyle === "dotted") {
    strokeDasharray = [2, 2];
  }

  // Determine stroke color based on state
  let stroke = getEdgeColor(edge.linkType);
  let strokeWidth = width;

  if (isRecentlyAdded) {
    stroke = "#22C55E"; // Green-500 for new edges
    strokeWidth = width + 1;
    finalOpacity = 1;
  } else if (isHighlighted) {
    stroke = "#FBBF24";
    strokeWidth = width + 1;
    finalOpacity = 1;
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    stroke,
    strokeWidth,
    opacity: finalOpacity,
    strokeDasharray,
    label: edge.reason || edge.linkType.replace(/_/g, " "),
    data: edge, // Attach original edge data
  };
}

// Map our layout type to Reagraph layout type
function mapLayoutType(
  layoutType: LayoutType,
): "forceDirected2d" | "hierarchicalTd" | "radialOut2d" {
  switch (layoutType) {
    case "forceDirected":
      return "forceDirected2d";
    case "hierarchical":
      return "hierarchicalTd";
    case "radial":
      return "radialOut2d";
    default:
      return "forceDirected2d";
  }
}

export function GraphCanvas({
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  selectedNodeId,
  hoveredNodeId,
  highlightedNodeIds = [],
  recentlyAddedNodeIds = new Set(),
  recentlyAddedEdgeIds = new Set(),
  layoutType = "forceDirected",
  className = "",
}: GraphCanvasProps) {
  const graphRef = useRef<GraphCanvasRef | null>(null);
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(
    null,
  );

  // Calculate connection counts for all nodes
  const connectionCounts = useMemo(
    () => createConnectionCountMap(nodes, edges),
    [nodes, edges],
  );

  // Create a set for faster lookup of highlighted nodes
  const highlightedSet = useMemo(
    () => new Set(highlightedNodeIds),
    [highlightedNodeIds],
  );

  // Transform nodes to Reagraph format
  const reagraphNodes = useMemo(() => {
    const effectiveHoveredId = hoveredNodeId ?? internalHoveredId;
    return nodes.map((node) =>
      toReagraphNode(
        node,
        connectionCounts.get(node.id) || 0,
        node.id === selectedNodeId,
        node.id === effectiveHoveredId,
        highlightedSet.has(node.id),
        recentlyAddedNodeIds.has(node.id),
        Boolean(node.fileReferences && node.fileReferences.length > 0),
      ),
    );
  }, [
    nodes,
    connectionCounts,
    selectedNodeId,
    hoveredNodeId,
    internalHoveredId,
    highlightedSet,
    recentlyAddedNodeIds,
  ]);

  // Transform edges to Reagraph format
  const reagraphEdges = useMemo(() => {
    // Highlight edges connected to selected node
    return edges.map((edge) => {
      const isHighlighted =
        selectedNodeId !== null &&
        (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const isRecentlyAdded = recentlyAddedEdgeIds.has(edge.id);
      return toReagraphEdge(edge, isHighlighted, isRecentlyAdded);
    });
  }, [edges, selectedNodeId, recentlyAddedEdgeIds]);

  // Reagraph selection hook for internal state management
  const {
    selections,
    actives,
    onNodeClick: handleReagraphNodeClick,
    onCanvasClick,
  } = useSelection({
    ref: graphRef,
    nodes: reagraphNodes,
    edges: reagraphEdges,
    type: "single",
    pathSelectionType: "direct",
  });

  // Handle node click
  const handleNodeClick = useCallback(
    (nodeData: InternalGraphNode) => {
      if (handleReagraphNodeClick) {
        handleReagraphNodeClick(nodeData as never);
      }
      const node = nodes.find((n) => n.id === nodeData.id);
      if (node && onNodeClick) {
        onNodeClick(node);
      }
    },
    [nodes, onNodeClick, handleReagraphNodeClick],
  );

  // Handle node pointer over (hover)
  const handleNodePointerOver = useCallback(
    (nodeData: InternalGraphNode) => {
      setInternalHoveredId(nodeData.id);
      const node = nodes.find((n) => n.id === nodeData.id);
      if (node && onNodeHover) {
        onNodeHover(node);
      }
    },
    [nodes, onNodeHover],
  );

  // Handle node pointer out
  const handleNodePointerOut = useCallback(() => {
    setInternalHoveredId(null);
    if (onNodeHover) {
      onNodeHover(null);
    }
  }, [onNodeHover]);

  // Handle edge click
  const handleEdgeClick = useCallback(
    (edgeData: { id: string }) => {
      const edge = edges.find((e) => e.id === edgeData.id);
      if (edge && onEdgeClick) {
        onEdgeClick(edge);
      }
    },
    [edges, onEdgeClick],
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const handleFitView = useCallback(() => {
    graphRef.current?.fitNodesInView();
  }, []);

  const handleCenterGraph = useCallback(() => {
    graphRef.current?.centerGraph();
  }, []);

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        data-testid="graph-canvas"
        className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}
        style={{ minHeight: 400 }}
      >
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 mb-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          <p className="text-sm">No graph data to display</p>
          <p className="text-xs mt-1">
            Start a conversation to build the knowledge graph
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="graph-canvas"
      className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: 400 }}
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Fit to View"
          aria-label="Fit to View"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
        <button
          onClick={handleCenterGraph}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Center Graph"
          aria-label="Center Graph"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </button>
      </div>

      {/* Graph Canvas */}
      <ReagraphCanvas
        ref={graphRef}
        nodes={reagraphNodes}
        edges={reagraphEdges}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick as never}
        onNodePointerOver={handleNodePointerOver as never}
        onNodePointerOut={handleNodePointerOut}
        onEdgeClick={handleEdgeClick as never}
        onCanvasClick={onCanvasClick}
        layoutType={mapLayoutType(layoutType)}
        layoutOverrides={{
          nodeStrength: -100,
          linkDistance: 100,
        }}
        labelType="auto"
        draggable
        animated
        cameraMode="pan"
        theme={{
          canvas: {
            background: "transparent",
          },
          node: {
            fill: "#3B82F6",
            activeFill: "#FBBF24",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.3,
            label: {
              color: "#1F2937",
              activeColor: "#1F2937",
            },
            subLabel: {
              color: "#6B7280",
              activeColor: "#6B7280",
            },
          },
          edge: {
            fill: "#9CA3AF",
            activeFill: "#FBBF24",
            opacity: 0.7,
            selectedOpacity: 1,
            inactiveOpacity: 0.2,
            label: {
              color: "#6B7280",
              activeColor: "#6B7280",
            },
          },
          arrow: {
            fill: "#9CA3AF",
            activeFill: "#FBBF24",
          },
          ring: {
            fill: "#FBBF24",
            activeFill: "#FBBF24",
          },
          lasso: {
            border: "#3B82F6",
            background: "rgba(59, 130, 246, 0.1)",
          },
        }}
      />

      {/* Node Count Badge */}
      <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-white dark:bg-gray-800 rounded-full shadow-md text-xs text-gray-600 dark:text-gray-300">
        {nodes.length} nodes, {edges.length} edges
      </div>
    </div>
  );
}

export default GraphCanvas;
