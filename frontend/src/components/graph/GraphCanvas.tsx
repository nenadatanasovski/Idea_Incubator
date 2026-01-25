/**
 * GraphCanvas Component
 * Renders the Memory Graph using Reagraph with WebGL acceleration
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useSyncExternalStore,
} from "react";
import {
  GraphCanvas as ReagraphCanvas,
  GraphCanvasRef,
  useSelection,
} from "reagraph";
import type { GraphNode, GraphEdge, NodeShape } from "../../types/graph";

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

/**
 * Hook to detect dark mode via CSS class or media query
 */
function useDarkMode(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    // Listen for class changes on documentElement
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also listen for media query changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", callback);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", callback);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    // Check for 'dark' class on html element (Tailwind default) or media query
    return (
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Custom node renderer for different shapes based on graph membership
 * Uses Three.js geometries to create distinct shapes for each graph type
 */
function CustomNodeRenderer({
  size,
  color,
  opacity,
  node,
}: {
  size: number;
  color: string;
  opacity: number;
  node: { shape?: NodeShape };
}) {
  const shape = node.shape || "circle";

  // Get geometry segments based on shape
  // For 2D, we use CircleGeometry with different segment counts
  const getGeometryArgs = (): [number, number] => {
    switch (shape) {
      case "triangle":
        return [size, 3]; // 3 segments = triangle
      case "square":
        return [size, 4]; // 4 segments = square
      case "pentagon":
        return [size, 5]; // 5 segments = pentagon
      case "hexagon":
        return [size, 6]; // 6 segments = hexagon
      case "diamond":
        return [size, 4]; // 4 segments, will be rotated
      case "star":
        return [size, 10]; // 10 points for star-like effect
      case "circle":
      default:
        return [size, 32]; // 32 segments = smooth circle
    }
  };

  // Calculate rotation for certain shapes
  const getRotation = (): [number, number, number] => {
    switch (shape) {
      case "diamond":
        return [0, 0, Math.PI / 4]; // Rotate 45° for diamond
      case "square":
        return [0, 0, Math.PI / 4]; // Rotate 45° for better visual
      case "triangle":
        return [0, 0, -Math.PI / 2]; // Point upward
      default:
        return [0, 0, 0];
    }
  };

  const [radius, segments] = getGeometryArgs();
  const rotation = getRotation();

  return (
    <group rotation={rotation}>
      <mesh>
        <circleGeometry args={[radius, segments]} />
        <meshBasicMaterial color={color} opacity={opacity} transparent />
      </mesh>
    </group>
  );
}

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  /** Called when clicking on empty canvas area (not on a node) */
  onCanvasClick?: () => void;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  highlightedNodeIds?: string[];
  highlightedEdgeIds?: string[];
  recentlyAddedNodeIds?: Set<string>;
  recentlyAddedEdgeIds?: Set<string>;
  /** Nodes temporarily visible due to relationship hover (shown with reduced opacity) */
  temporarilyVisibleNodeIds?: Set<string>;
  /** Edges temporarily visible due to relationship hover (shown with reduced opacity) */
  temporarilyVisibleEdgeIds?: Set<string>;
  /** Node IDs involved in cycles - will be highlighted with red glow */
  cycleNodeIds?: Set<string>;
  layoutType?: LayoutType;
  /** Enable clustering by specifying the node field to cluster on (e.g., 'cluster') */
  clusterAttribute?: string;
  /** Cluster tightness: 0.0 (loose) to 1.0 (tight). Default: 0.7 */
  clusterStrength?: number;
  className?: string;
  /** When true, empty state is due to filters (shows different message) */
  isFilteredEmpty?: boolean;
  /** Total unfiltered node count (used to determine if empty is from filters) */
  totalNodeCount?: number;
}

export interface GraphCanvasHandle {
  focusOnNode: (nodeId: string) => void;
  fitNodesInView: (nodeIds?: string[]) => void;
  centerGraph: () => void;
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
  isTemporarilyVisible: boolean,
  isInCycle: boolean,
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
    opacity = 1; // Full opacity for selected
  } else if (isRecentlyAdded) {
    // Bright green pulsing effect for newly added nodes
    strokeWidth = 4;
    stroke = "#22C55E"; // Green-500
    opacity = 1;
  } else if (isTemporarilyVisible) {
    // Temporarily visible due to relationship hover - show with reduced opacity
    // Keep original color but use reduced opacity to indicate it's normally hidden
    strokeWidth = 3;
    stroke = "#F97316"; // Orange stroke to show it's highlighted
    opacity = 0.5; // Reduced opacity to indicate it's normally filtered out
  } else if (isHighlighted) {
    strokeWidth = 4;
    stroke = "#F97316"; // Orange for highlighted
    opacity = 1; // Full opacity for highlighted
  } else if (isHovered) {
    strokeWidth = 3;
    stroke = "#60A5FA"; // Blue
    opacity = 1;
  }

  // Increase size for recently added or highlighted nodes to make them more visible
  let finalSize = size;
  if (isRecentlyAdded) {
    finalSize = size * 1.2;
  } else if (isHighlighted) {
    finalSize = size * 1.15;
  }

  // Add file reference indicator as subLabel (📎 icon)
  const subLabel = hasFileReferences ? "📎" : undefined;

  // Nodes with file references get a secondary ring color
  if (
    hasFileReferences &&
    !isSelected &&
    !isRecentlyAdded &&
    !isTemporarilyVisible &&
    !isHighlighted &&
    !isHovered &&
    !isInCycle
  ) {
    stroke = "#8B5CF6"; // Purple for file-referenced nodes
    strokeWidth = 2.5;
  }

  // Cycle nodes get a red glow effect (lower priority than selected/hovered)
  if (
    isInCycle &&
    !isSelected &&
    !isHovered &&
    !isRecentlyAdded &&
    !isTemporarilyVisible
  ) {
    stroke = "#EF4444"; // Red-500 for cycle warning
    strokeWidth = 4;
    opacity = Math.max(opacity, 0.9); // Ensure cycle nodes are visible
  }

  // Use title if available (short summary), otherwise fall back to content/label
  // Show full text for highlighted/selected/hovered/temporarily visible nodes, truncate others
  const fullLabel = node.title || node.content || node.label;
  const showFullText =
    isHighlighted || isSelected || isHovered || isTemporarilyVisible;
  const maxLabelLength = 50;
  const displayLabel = showFullText
    ? fullLabel
    : fullLabel.length > maxLabelLength
      ? fullLabel.substring(0, maxLabelLength - 3) + "..."
      : fullLabel;

  return {
    id: node.id,
    label: displayLabel,
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
  isTemporarilyVisible: boolean,
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
    strokeWidth = width + 2;
    finalOpacity = 1;
  } else if (isTemporarilyVisible) {
    // Temporarily visible due to relationship hover - show with reduced opacity
    stroke = "#F97316"; // Orange to show it's highlighted
    strokeWidth = width + 1;
    finalOpacity = 0.5; // Reduced opacity to indicate it's normally filtered out
  } else if (isHighlighted) {
    stroke = "#F97316"; // Orange to match highlighted nodes
    strokeWidth = width + 2;
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

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas(
    {
      nodes,
      edges,
      onNodeClick,
      onNodeHover,
      onEdgeClick,
      onCanvasClick: onCanvasClickProp,
      selectedNodeId,
      hoveredNodeId,
      highlightedNodeIds = [],
      highlightedEdgeIds = [],
      recentlyAddedNodeIds = new Set(),
      recentlyAddedEdgeIds = new Set(),
      temporarilyVisibleNodeIds = new Set(),
      temporarilyVisibleEdgeIds = new Set(),
      cycleNodeIds = new Set(),
      layoutType = "forceDirected",
      clusterAttribute,
      clusterStrength = 0.7,
      className = "",
      totalNodeCount = 0,
    },
    ref,
  ) {
    // Determine if empty state is due to filters vs truly no data
    const isFilteredEmpty = nodes.length === 0 && totalNodeCount > 0;
    const graphRef = useRef<GraphCanvasRef | null>(null);
    const isDarkMode = useDarkMode();

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focusOnNode: (nodeId: string) => {
          graphRef.current?.fitNodesInView([nodeId], { padding: 100 });
        },
        fitNodesInView: (nodeIds?: string[]) => {
          // Use extra padding when fitting multiple nodes to ensure all are visible
          // For relationship hover (2 nodes), use 50% more padding so nodes aren't too large
          const padding = nodeIds && nodeIds.length > 1 ? 225 : 100;
          graphRef.current?.fitNodesInView(nodeIds, { padding });
        },
        centerGraph: () => {
          graphRef.current?.centerGraph();
        },
      }),
      [],
    );
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [internalHoveredId, setInternalHoveredId] = useState<string | null>(
      null,
    );
    // Key to force remount when WebGL context is lost
    const [canvasKey, setCanvasKey] = useState(0);
    const [isRecovering, setIsRecovering] = useState(false);

    // Handle WebGL context loss recovery
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleContextLost = (event: Event) => {
        console.warn(
          "[GraphCanvas] WebGL context lost, will attempt recovery...",
        );
        event.preventDefault();
        setIsRecovering(true);

        // Wait a bit before trying to recover
        setTimeout(() => {
          console.log("[GraphCanvas] Attempting to recover WebGL context...");
          setCanvasKey((prev) => prev + 1);
          setIsRecovering(false);
        }, 1000);
      };

      const handleContextRestored = () => {
        console.log("[GraphCanvas] WebGL context restored");
        setIsRecovering(false);
      };

      // Listen for context events on canvas elements within the container
      const canvasElements = container.querySelectorAll("canvas");
      canvasElements.forEach((canvas) => {
        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);
      });

      // Also listen on the container in case canvas is added later
      container.addEventListener("webglcontextlost", handleContextLost);
      container.addEventListener("webglcontextrestored", handleContextRestored);

      return () => {
        canvasElements.forEach((canvas) => {
          canvas.removeEventListener("webglcontextlost", handleContextLost);
          canvas.removeEventListener(
            "webglcontextrestored",
            handleContextRestored,
          );
        });
        container.removeEventListener("webglcontextlost", handleContextLost);
        container.removeEventListener(
          "webglcontextrestored",
          handleContextRestored,
        );
      };
    }, [canvasKey]); // Re-attach listeners when canvas remounts

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

    // Create a set for faster lookup of highlighted edges
    const highlightedEdgeSet = useMemo(
      () => new Set(highlightedEdgeIds),
      [highlightedEdgeIds],
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
          temporarilyVisibleNodeIds.has(node.id),
          cycleNodeIds.has(node.id),
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
      temporarilyVisibleNodeIds,
      cycleNodeIds,
    ]);

    // Transform edges to Reagraph format
    const reagraphEdges = useMemo(() => {
      // Highlight edges connected to selected node OR explicitly highlighted
      return edges.map((edge) => {
        const isHighlighted =
          highlightedEdgeSet.has(edge.id) ||
          (selectedNodeId !== null &&
            (edge.source === selectedNodeId || edge.target === selectedNodeId));
        const isRecentlyAdded = recentlyAddedEdgeIds.has(edge.id);
        const isTemporarilyVisible = temporarilyVisibleEdgeIds.has(edge.id);
        return toReagraphEdge(
          edge,
          isHighlighted,
          isRecentlyAdded,
          isTemporarilyVisible,
        );
      });
    }, [
      edges,
      selectedNodeId,
      highlightedEdgeSet,
      recentlyAddedEdgeIds,
      temporarilyVisibleEdgeIds,
    ]);

    // Reagraph selection hook for internal state management
    const {
      selections,
      actives: selectionActives,
      onNodeClick: handleReagraphNodeClick,
      onCanvasClick: reagraphOnCanvasClick,
    } = useSelection({
      ref: graphRef,
      nodes: reagraphNodes,
      edges: reagraphEdges,
      type: "single",
      pathSelectionType: "direct",
    });

    // Wrapper to call both reagraph's internal handler and our prop callback
    const handleCanvasClick = useCallback(
      (event: MouseEvent) => {
        reagraphOnCanvasClick?.(event);
        onCanvasClickProp?.();
      },
      [reagraphOnCanvasClick, onCanvasClickProp],
    );

    // Compute effective hovered ID once
    const effectiveHoveredId = hoveredNodeId ?? internalHoveredId;

    // Combine selections with hovered/highlighted nodes to trigger inactiveOpacity
    const effectiveSelections = useMemo(() => {
      const combined = [...(selections || [])];
      // Add hovered node ID to selections so inactiveOpacity applies
      if (effectiveHoveredId && !combined.includes(effectiveHoveredId)) {
        combined.push(effectiveHoveredId);
      }
      // Add highlighted node IDs to selections
      highlightedNodeIds.forEach((id) => {
        if (!combined.includes(id)) {
          combined.push(id);
        }
      });
      // Add temporarily visible node IDs
      temporarilyVisibleNodeIds.forEach((id) => {
        if (!combined.includes(id)) {
          combined.push(id);
        }
      });
      return combined;
    }, [
      selections,
      effectiveHoveredId,
      highlightedNodeIds,
      temporarilyVisibleNodeIds,
    ]);

    // Combine selection actives with our highlighted nodes/edges and hovered node
    const actives = useMemo(() => {
      const combined = [...(selectionActives || [])];
      // Add hovered node ID (from canvas hover)
      if (effectiveHoveredId && !combined.includes(effectiveHoveredId)) {
        combined.push(effectiveHoveredId);
      }
      // Add highlighted node IDs
      highlightedNodeIds.forEach((id) => {
        if (!combined.includes(id)) {
          combined.push(id);
        }
      });
      // Add temporarily visible node IDs (must be active to avoid being faded)
      temporarilyVisibleNodeIds.forEach((id) => {
        if (!combined.includes(id)) {
          combined.push(id);
        }
      });
      // Add highlighted edge IDs
      highlightedEdgeIds.forEach((id) => {
        if (!combined.includes(id)) {
          combined.push(id);
        }
      });
      return combined;
    }, [
      selectionActives,
      effectiveHoveredId,
      highlightedNodeIds,
      highlightedEdgeIds,
      temporarilyVisibleNodeIds,
    ]);

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

    // Truly empty state (no data at all, not filtered) - return early
    if (nodes.length === 0 && !isFilteredEmpty) {
      return (
        <div
          data-testid="graph-canvas"
          className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg h-full w-full ${className}`}
        >
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 mb-4 text-gray-400 dark:text-gray-500"
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
              Start a conversation, then click the lightbulb button at the top
              left to build the knowledge graph
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        data-testid="graph-canvas"
        className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden h-full w-full ${className}`}
      >
        {/* WebGL Recovery Overlay */}
        {isRecovering && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
            <div className="text-center text-white">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm">Recovering graph visualization...</p>
            </div>
          </div>
        )}
        {/* Filtered Empty Overlay - shows when filters result in 0 nodes */}
        {isFilteredEmpty && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-50/90 dark:bg-gray-900/90 pointer-events-none">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="mx-auto h-12 w-12 mb-4 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <p className="text-sm font-medium">
                No nodes match the selected filters
              </p>
              <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                Try adjusting or clearing your filters
              </p>
            </div>
          </div>
        )}
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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

        {/* Graph Canvas - key forces remount on WebGL context loss or dark mode change */}
        <ReagraphCanvas
          key={`${canvasKey}-${isDarkMode ? "dark" : "light"}`}
          ref={graphRef}
          nodes={reagraphNodes}
          edges={reagraphEdges}
          selections={effectiveSelections}
          actives={actives}
          onNodeClick={handleNodeClick as never}
          onNodePointerOver={handleNodePointerOver as never}
          onNodePointerOut={handleNodePointerOut}
          onEdgeClick={handleEdgeClick as never}
          onCanvasClick={handleCanvasClick}
          layoutType={mapLayoutType(layoutType)}
          clusterAttribute={clusterAttribute}
          layoutOverrides={{
            nodeStrength: -120, // Moderate repulsion between all nodes
            linkDistance: 60, // Shorter edges pull connected nodes closer
            linkStrength: 0.8, // Strong edge attraction keeps relationships tight
            clusterStrength: clusterAttribute ? clusterStrength : undefined, // Keep attribute clusters together
          }}
          labelType="auto"
          draggable
          animated
          cameraMode="pan"
          renderNode={({ size, color, opacity, node }) => (
            <CustomNodeRenderer
              size={size}
              color={color as string}
              opacity={opacity}
              node={node as { shape?: NodeShape }}
            />
          )}
          theme={{
            canvas: {
              background: isDarkMode ? "#111827" : "#F9FAFB", // gray-900 in dark, gray-50 in light
            },
            node: {
              fill: "#3B82F6",
              activeFill: "#3B82F6", // Same as fill - let per-node colors take precedence
              opacity: 1,
              selectedOpacity: 1,
              inactiveOpacity: 0.2, // Fade inactive nodes significantly when there are active selections
              label: {
                color: isDarkMode ? "#F9FAFB" : "#1F2937", // white in dark, gray-800 in light
                activeColor: isDarkMode ? "#FFFFFF" : "#111827", // pure white in dark, gray-900 in light
              },
              subLabel: {
                color: isDarkMode ? "#9CA3AF" : "#6B7280", // gray-400 in dark, gray-500 in light
                activeColor: isDarkMode ? "#D1D5DB" : "#374151", // gray-300 in dark, gray-700 in light
              },
            },
            edge: {
              fill: isDarkMode ? "#6B7280" : "#9CA3AF", // gray-500 in dark, gray-400 in light
              activeFill: "#F97316", // Orange for active/highlighted edges
              opacity: 0.7,
              selectedOpacity: 1,
              inactiveOpacity: 0.15, // Fade inactive edges significantly when there are active selections
              label: {
                color: isDarkMode ? "#9CA3AF" : "#6B7280", // gray-400 in dark, gray-500 in light
                activeColor: isDarkMode ? "#D1D5DB" : "#6B7280", // gray-300 in dark, gray-500 in light
              },
            },
            arrow: {
              fill: isDarkMode ? "#6B7280" : "#9CA3AF", // gray-500 in dark, gray-400 in light
              activeFill: "#F97316", // Orange for active/highlighted arrows
            },
            ring: {
              fill: "#F97316",
              activeFill: "#F97316",
            },
            lasso: {
              border: "#3B82F6",
              background: "rgba(59, 130, 246, 0.1)",
            },
            cluster: {
              stroke: isDarkMode ? "#4B5563" : "#CBD5E1", // gray-600 in dark, slate-300 in light
              fill: isDarkMode
                ? "rgba(31, 41, 55, 0.5)"
                : "rgba(241, 245, 249, 0.3)", // gray-800/50 in dark, slate-100/30 in light
              label: {
                stroke: isDarkMode ? "#1F2937" : "#F1F5F9", // gray-800 in dark, slate-100 in light
                color: isDarkMode ? "#D1D5DB" : "#475569", // gray-300 in dark, slate-600 in light
              },
            },
          }}
        />
      </div>
    );
  },
);

export default GraphCanvas;
