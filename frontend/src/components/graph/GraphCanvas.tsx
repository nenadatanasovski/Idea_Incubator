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
  LayoutTypes,
} from "reagraph";
import type { GraphNode, GraphEdge, NodeShape } from "../../types/graph";
// @ts-ignore - troika-three-text is a transitive dependency via reagraph
import { Text as TroikaText } from "troika-three-text";

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

// Re-export Reagraph's LayoutTypes for external use
export type LayoutType = LayoutTypes;

/**
 * Hook to detect dark mode - supports Dark Reader extension detection
 * Also syncs the 'dark' class on HTML element for Tailwind's class-based dark mode
 */
function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    // Check for Dark Reader extension (it adds data-darkreader attributes or styles)
    const hasDarkReader =
      document.documentElement.hasAttribute("data-darkreader-mode") ||
      document.documentElement.hasAttribute("data-darkreader-scheme") ||
      document.querySelector('meta[name="darkreader"]') !== null ||
      document.querySelector("style.darkreader") !== null ||
      document.querySelector('style[class*="darkreader"]') !== null;

    return hasDarkReader;
  });

  useEffect(() => {
    const checkDarkMode = () => {
      // Check for Dark Reader extension
      const hasDarkReader =
        document.documentElement.hasAttribute("data-darkreader-mode") ||
        document.documentElement.hasAttribute("data-darkreader-scheme") ||
        document.querySelector('meta[name="darkreader"]') !== null ||
        document.querySelector("style.darkreader") !== null ||
        document.querySelector('style[class*="darkreader"]') !== null;

      setIsDark(hasDarkReader);

      // Sync 'dark' class on HTML element for Tailwind's class-based dark mode
      if (hasDarkReader) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    // Listen for attribute changes on html element (Dark Reader modifies attributes)
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-darkreader-mode", "data-darkreader-scheme"],
    });

    // Also observe head for Dark Reader style injection/removal
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    // Check immediately
    checkDarkMode();

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDark;
}

/**
 * Custom node renderer for different shapes based on graph membership
 * Uses Three.js geometries to create distinct shapes for each graph type
 * Text is rendered inside the node using troika-three-text via <primitive>
 */
function CustomNodeRenderer({
  size,
  opacity,
  node,
  label,
}: {
  size: number;
  color: string;
  opacity: number;
  node: { shape?: NodeShape; fill?: string };
  label?: string;
}) {
  const shape = node.shape || "circle";
  const fillColor = node.fill || "#3B82F6";

  // Visual scale: make nodes appear larger without affecting layout spacing
  const visualSize = size * 1.3;

  const getGeometryArgs = (): [number, number] => {
    switch (shape) {
      case "triangle":
        return [visualSize, 3];
      case "square":
        return [visualSize, 4];
      case "pentagon":
        return [visualSize, 5];
      case "hexagon":
        return [visualSize, 6];
      case "diamond":
        return [visualSize, 4];
      case "star":
        return [visualSize, 10];
      case "circle":
      default:
        return [visualSize, 32];
    }
  };

  const getRotation = (): [number, number, number] => {
    switch (shape) {
      case "diamond":
        return [0, 0, Math.PI / 4];
      case "square":
        return [0, 0, Math.PI / 4];
      case "triangle":
        return [0, 0, -Math.PI / 2];
      default:
        return [0, 0, 0];
    }
  };

  const [radius, segments] = getGeometryArgs();
  const rotation = getRotation();

  // Truncate label for display inside node
  const truncatedLabel =
    label && label.length > 60 ? label.substring(0, 57) + "..." : label;

  // Create troika text mesh for centered label inside node
  const textMesh = useMemo(() => {
    const t = new TroikaText();
    t.text = truncatedLabel || "";
    t.fontSize = visualSize * 0.35;
    t.color = 0xffffff;
    t.anchorX = "center";
    t.anchorY = "middle";
    t.textAlign = "center";
    t.maxWidth = visualSize * 1.6;
    t.outlineWidth = visualSize * 0.04;
    t.outlineColor = 0x000000;
    t.position.z = 0.5;
    t.sync();
    return t;
  }, [truncatedLabel, visualSize]);

  // Clean up troika text on unmount
  useEffect(() => {
    return () => {
      textMesh.dispose();
    };
  }, [textMesh]);

  return (
    <group>
      <group rotation={rotation}>
        <mesh>
          <circleGeometry args={[radius, segments]} />
          <meshBasicMaterial color={fillColor} opacity={opacity} transparent />
        </mesh>
      </group>
      {truncatedLabel && <primitive object={textMesh} />}
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
  /** When true, show labels for all nodes (used in report view) */
  showAllLabels?: boolean;
}

export interface GraphCanvasHandle {
  focusOnNode: (nodeId: string) => void;
  fitNodesInView: (nodeIds?: string[], options?: { slow?: boolean }) => void;
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
  const displayLabel = node.title || node.content || node.label;

  const fillColor = isRecentlyAdded ? "#4ADE80" : getNodeColor(node.blockType);
  return {
    id: node.id,
    label: " ", // Hidden - troika renders text inside nodes
    subLabel: "", // Hidden
    fill: fillColor,
    activeFill: fillColor, // Keep same color when selected/active
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

  // Convert line style to dashArray for Reagraph (uses [dashSize, gapSize] tuple)
  let dashArray: [number, number] | undefined;
  if (lineStyle === "dashed") {
    dashArray = [8, 4];
  } else if (lineStyle === "dotted") {
    dashArray = [2, 2];
  }

  // Determine fill color based on state (Reagraph uses 'fill' for edge color)
  let fill = getEdgeColor(edge.linkType);
  let size = width;

  if (isRecentlyAdded) {
    fill = "#22C55E"; // Green-500 for new edges
    size = width + 2;
    finalOpacity = 1;
  } else if (isTemporarilyVisible) {
    // Temporarily visible due to relationship hover - show with reduced opacity
    fill = "#F97316"; // Orange to show it's highlighted
    size = width + 1;
    finalOpacity = 0.5; // Reduced opacity to indicate it's normally filtered out
  } else if (isHighlighted) {
    fill = "#F97316"; // Orange to match highlighted nodes
    size = width + 2;
    finalOpacity = 1;
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    fill, // Reagraph uses 'fill' for edge color
    size, // Reagraph uses 'size' for edge width
    opacity: finalOpacity,
    dashArray, // Reagraph uses 'dashArray' for dash patterns
    label: edge.reason || edge.linkType.replace(/_/g, " "),
    data: edge, // Attach original edge data
  };
}

// No mapping needed - using Reagraph layout types directly

/**
 * Get layout-specific overrides based on the layout type.
 * Different layout algorithms require different parameters.
 */
function getLayoutOverrides(
  layoutType: LayoutType,
  clusterAttribute?: string,
  clusterStrength?: number,
): Record<string, unknown> {
  const baseClusterStrength = clusterAttribute ? clusterStrength : undefined;

  switch (layoutType) {
    // Tree layouts use nodeSeparation (factor) and nodeSize [width, height]
    case "treeLr2d":
    case "treeTd2d":
      return {
        nodeSeparation: 2.5, // Factor of distance between sibling nodes (default 1)
        nodeSize: [120, 120], // Size allocation per node [width, height] (default [50, 50])
        clusterStrength: baseClusterStrength,
      };

    // Radial layouts spread nodes outward from center
    case "radialOut2d":
      return {
        nodeSeparation: 2,
        nodeSize: [100, 100],
        clusterStrength: baseClusterStrength,
      };

    // Circular layout arranges nodes in a circle
    case "circular2d":
      return {
        clusterStrength: baseClusterStrength,
      };

    // Force-directed layouts use physics-based parameters
    case "forceDirected2d":
    default:
      return {
        nodeStrength: -120, // Repulsion between all nodes
        linkDistance: 60, // Target edge length
        linkStrength: 0.8, // Edge attraction strength
        clusterStrength: baseClusterStrength,
      };
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
      layoutType = "forceDirected2d",
      clusterAttribute,
      clusterStrength = 0.7,
      className = "",
      totalNodeCount = 0,
      showAllLabels = false,
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
          graphRef.current?.fitNodesInView([nodeId]);
        },
        fitNodesInView: (nodeIds?: string[], options?: { slow?: boolean }) => {
          // Access camera controls to adjust animation speed
          const controls = graphRef.current?.getControls();
          if (controls && options?.slow) {
            // Set smoothTime to 0.25 for slower transitions (default is 0.1)
            controls.smoothTime = 0.25;
          }

          graphRef.current?.fitNodesInView(nodeIds);

          // Reset smoothTime after animation starts
          if (controls && options?.slow) {
            setTimeout(() => {
              controls.smoothTime = 0.1;
            }, 200);
          }
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
    // Note: We don't use onNodeClick from useSelection because it applies theme.activeFill
    // which overrides per-node fill colors. Selection is managed via selectedNodeId prop.
    const {
      selections,
      // Note: We don't use actives from useSelection - see actives useMemo below for explanation
      clearSelections,
      onCanvasClick: reagraphOnCanvasClick,
    } = useSelection({
      ref: graphRef,
      nodes: reagraphNodes,
      edges: reagraphEdges,
      type: "single",
      pathSelectionType: "direct",
    });

    // Sync external selectedNodeId with reagraph's internal selection
    // When parent clears selection (selectedNodeId becomes null), clear reagraph's internal state
    useEffect(() => {
      if (selectedNodeId === null || selectedNodeId === undefined) {
        clearSelections();
      }
    }, [selectedNodeId, clearSelections]);

    // Wrapper to call both reagraph's internal handler and our prop callback
    const handleCanvasClick = useCallback(
      (event: MouseEvent) => {
        reagraphOnCanvasClick?.(event);
        onCanvasClickProp?.();
        // Hard rule: always clear internal hover state when clicking empty canvas
        setInternalHoveredId(null);
        // Recenter and fit all nodes in view when clicking empty space
        graphRef.current?.fitNodesInView();
      },
      [reagraphOnCanvasClick, onCanvasClickProp],
    );

    // Compute effective hovered ID once
    const effectiveHoveredId = hoveredNodeId ?? internalHoveredId;

    // Combine selections with highlighted nodes to trigger inactiveOpacity
    // NOTE: Do NOT add hovered node here - adding to selections triggers pathSelectionType
    // Reagraph's inactiveOpacity is triggered by items in `selections`, not `actives`.
    // So we add both selected and hovered nodes here to trigger the fade effect.
    const effectiveSelections = useMemo(() => {
      const combined = [...(selections || [])];
      // Add selected node ID - this triggers inactiveOpacity for other nodes
      if (selectedNodeId && !combined.includes(selectedNodeId)) {
        combined.push(selectedNodeId);
      }
      // Add hovered node ID - also triggers inactiveOpacity for other nodes
      if (effectiveHoveredId && !combined.includes(effectiveHoveredId)) {
        combined.push(effectiveHoveredId);
      }
      // Add highlighted node IDs to selections (for relationship hover from inspector)
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
      selectedNodeId,
      effectiveHoveredId,
      highlightedNodeIds,
      temporarilyVisibleNodeIds,
    ]);

    // Compute active node/edge IDs for reagraph
    // IMPORTANT: We do NOT use selectionActives from useSelection because:
    // 1. We manage selection externally via selectedNodeId prop (not useSelection's click handler)
    // 2. useSelection's actives state can become stale/out-of-sync with our external selection
    // 3. This caused a bug where previously selected nodes stayed at 100% opacity after deselection
    // Instead, we compute actives entirely from our own state to ensure consistency.
    const actives = useMemo(() => {
      const combined: string[] = [];
      // Add selected node ID - must be active so it's not dimmed
      if (selectedNodeId && !combined.includes(selectedNodeId)) {
        combined.push(selectedNodeId);
      }
      // Add hovered node ID - triggers inactiveOpacity on other nodes
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
      selectedNodeId,
      effectiveHoveredId,
      highlightedNodeIds,
      highlightedEdgeIds,
      temporarilyVisibleNodeIds,
    ]);

    // Handle node click
    // Note: We intentionally do NOT call handleReagraphNodeClick because reagraph
    // applies theme.activeFill to selected nodes, overriding per-node fill colors.
    // Selection state is managed externally via selectedNodeId prop, and
    // selection styling (yellow stroke) is handled in toReagraphNode.
    const handleNodeClick = useCallback(
      (nodeData: InternalGraphNode) => {
        const node = nodes.find((n) => n.id === nodeData.id);
        if (node) {
          // Center the clicked node on screen
          graphRef.current?.fitNodesInView([nodeData.id]);
          if (onNodeClick) {
            onNodeClick(node);
          }
        }
      },
      [nodes, onNodeClick],
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
          className={`flex items-center justify-center h-full w-full ${className}`}
          style={{ backgroundColor: isDarkMode ? "#111827" : "#F9FAFB" }}
        >
          <div
            className={`text-center ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
          >
            <svg
              className={`mx-auto h-12 w-12 mb-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
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
        className={`relative overflow-hidden h-full w-full ${className}`}
        style={{ backgroundColor: isDarkMode ? "#111827" : "#F9FAFB" }}
        onPointerLeave={handleNodePointerOut}
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
          <div
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
            style={{
              backgroundColor: isDarkMode
                ? "rgba(17, 24, 39, 0.9)"
                : "rgba(249, 250, 251, 0.9)",
            }}
          >
            <div
              className={`text-center ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
            >
              <svg
                className={`mx-auto h-12 w-12 mb-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
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
              <p
                className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                Try adjusting or clearing your filters
              </p>
            </div>
          </div>
        )}
        {/* Zoom Controls */}
        <div
          className="absolute top-4 right-4 z-10 flex flex-col gap-2 p-1 rounded-lg border shadow-sm"
          style={{
            backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
            borderColor: isDarkMode ? "#374151" : "#E5E7EB",
          }}
        >
          <button
            onClick={handleZoomIn}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}
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
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}
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
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}
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
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}
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
          layoutType={layoutType}
          clusterAttribute={clusterAttribute}
          layoutOverrides={getLayoutOverrides(
            layoutType,
            clusterAttribute,
            clusterStrength,
          )}
          labelType="all"
          draggable
          animated
          cameraMode="pan"
          renderNode={({ size, color, opacity, node }) => (
            <CustomNodeRenderer
              size={size}
              color={color as string}
              opacity={opacity}
              node={node as { shape?: NodeShape; fill?: string }}
              label={
                ((node as any).data as GraphNode)?.title ||
                ((node as any).data as GraphNode)?.content ||
                ((node as any).data as GraphNode)?.label ||
                ""
              }
            />
          )}
          theme={{
            canvas: {
              background: isDarkMode ? "#111827" : "#F9FAFB", // Match container background
            },
            node: {
              fill: "#3B82F6",
              opacity: 1,
              selectedOpacity: 1,
              inactiveOpacity: 0.2, // Fade inactive nodes when hovering/selecting
              label: {
                color: "transparent", // Hidden - labels rendered inside nodes via troika
                activeColor: "transparent",
                fontSize: 1,
              },
              subLabel: {
                color: isDarkMode ? "#9CA3AF" : "#6B7280", // gray-400 in dark, gray-500 in light
                activeColor: isDarkMode ? "#D1D5DB" : "#374151", // gray-300 in dark, gray-700 in light
              },
            } as any,
            edge: {
              fill: isDarkMode ? "#9CA3AF" : "#9CA3AF", // lighter gray for better visibility
              activeFill: "#F97316", // Orange for active/highlighted edges
              opacity: 0.7,
              selectedOpacity: 1,
              inactiveOpacity: 0.15, // Fade inactive edges significantly when there are active selections
              label: {
                color: isDarkMode ? "#D1D5DB" : "#374151", // gray-300 in dark, gray-700 in light
                activeColor: "#000000", // Black text for max contrast on orange arrows
                fontSize: 7,
              },
            },
            arrow: {
              fill: isDarkMode ? "#9CA3AF" : "#9CA3AF", // lighter gray for better visibility
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
