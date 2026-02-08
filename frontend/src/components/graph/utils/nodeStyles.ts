/**
 * Node Visual Styling Utilities
 * Maps graph nodes to Reagraph visual properties
 */

import type {
  GraphNode,
  BlockType,
  GraphType,
  NodeShape,
} from "../../../types/graph";
import { nodeColors, graphColors, nodeShapes } from "../../../types/graph";

/**
 * Node size configuration
 */
export interface NodeSizeConfig {
  minSize: number;
  maxSize: number;
  baseSize: number;
}

const DEFAULT_SIZE_CONFIG: NodeSizeConfig = {
  minSize: 28,
  maxSize: 40,
  baseSize: 32,
};

/**
 * Get node fill color based on block type(s)
 * Accepts single BlockType or array; uses first type for fill color
 */
export function getNodeColor(blockType: BlockType | BlockType[]): string {
  const primary = Array.isArray(blockType) ? blockType[0] : blockType;
  return (primary && nodeColors[primary]) || nodeColors.fact;
}

/**
 * Valid graph types that have defined shapes
 */
const VALID_GRAPH_TYPES = new Set<string>(Object.keys(nodeShapes));

/**
 * Get node shape based on block type and graph membership
 * Prioritizes blockType when it's a valid GraphType, then falls back to
 * the first valid GraphType in graphMembership
 */
export function getNodeShape(graphMembership: GraphType[]): NodeShape {
  const validMembership = graphMembership.filter((g) =>
    VALID_GRAPH_TYPES.has(g),
  );
  const primaryGraph = validMembership[0] || "problem";
  return nodeShapes[primaryGraph] || "circle";
}

/**
 * Get node border color based on graph membership
 * Uses the first graph membership for consistency
 */
export function getNodeBorderColor(graphMembership: GraphType[]): string {
  const validMembership = graphMembership.filter((g) =>
    VALID_GRAPH_TYPES.has(g),
  );
  const primaryGraph = validMembership[0] || "problem";
  return graphColors[primaryGraph] || graphColors.problem;
}

/**
 * Calculate node opacity based on confidence
 * Higher confidence = higher opacity
 */
export function getNodeOpacity(confidence: number): number {
  // Map confidence (0-1) to opacity (0.4-1.0)
  const minOpacity = 0.4;
  const maxOpacity = 1.0;
  return minOpacity + confidence * (maxOpacity - minOpacity);
}

/**
 * Calculate node border opacity based on confidence
 * Used to indicate certainty level
 */
export function getNodeBorderOpacity(confidence: number): number {
  // Map confidence (0-1) to border opacity (0.3-1.0)
  const minOpacity = 0.3;
  const maxOpacity = 1.0;
  return minOpacity + confidence * (maxOpacity - minOpacity);
}

/**
 * Calculate node size based on importance metrics
 * Importance can be derived from connection count or explicit weight
 */
export function getNodeSize(
  connectionCount: number,
  config: NodeSizeConfig = DEFAULT_SIZE_CONFIG,
): number {
  // Logarithmic scaling for connection count
  const scaleFactor = Math.log2(connectionCount + 1);
  const size = config.baseSize + scaleFactor * 2;

  return Math.min(Math.max(size, config.minSize), config.maxSize);
}

/**
 * Calculate node size based on confidence and connections
 */
export function calculateNodeSize(
  _confidence: number,
  _connectionCount: number,
  config: NodeSizeConfig = DEFAULT_SIZE_CONFIG,
): number {
  // Fixed size for all nodes - uniform appearance
  return config.baseSize;
}

/**
 * Get status-based styling overlay
 */
export function getStatusStyle(status: GraphNode["status"]): {
  opacity: number;
  strokeDasharray?: string;
} {
  switch (status) {
    case "draft":
      return { opacity: 0.6, strokeDasharray: "4 2" };
    case "active":
      return { opacity: 1.0 };
    case "validated":
      return { opacity: 1.0 };
    case "superseded":
      return { opacity: 0.4, strokeDasharray: "2 2" };
    case "abandoned":
      return { opacity: 0.3, strokeDasharray: "1 3" };
    default:
      return { opacity: 1.0 };
  }
}

/**
 * Get complete node style configuration for Reagraph
 */
export function getNodeStyle(
  node: GraphNode,
  connectionCount: number = 0,
): {
  fill: string;
  size: number;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  shape: NodeShape;
} {
  const baseStyle = getStatusStyle(node.status);

  return {
    fill: getNodeColor(node.blockTypes || [node.blockType]),
    size: calculateNodeSize(node.confidence, connectionCount),
    opacity: baseStyle.opacity * getNodeOpacity(node.confidence),
    stroke: getNodeBorderColor(node.graphMembership),
    strokeWidth: 2,
    shape: getNodeShape(node.graphMembership),
  };
}

/**
 * Get highlight styling for selected/hovered nodes
 */
export function getHighlightStyle(
  isSelected: boolean,
  isHovered: boolean,
): {
  strokeWidth: number;
  stroke: string;
  glowSize: number;
} {
  if (isSelected) {
    return {
      strokeWidth: 4,
      stroke: "#FBBF24", // Yellow highlight
      glowSize: 10,
    };
  }
  if (isHovered) {
    return {
      strokeWidth: 3,
      stroke: "#60A5FA", // Blue highlight
      glowSize: 5,
    };
  }
  return {
    strokeWidth: 2,
    stroke: "none", // No stroke when not highlighted
    glowSize: 0,
  };
}

/**
 * Count connections for each node in the graph
 */
export function countNodeConnections(
  nodeId: string,
  edges: { source: string; target: string }[],
): number {
  return edges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId,
  ).length;
}

/**
 * Create a map of node IDs to their connection counts
 */
export function createConnectionCountMap(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();

  // Initialize all nodes with 0 connections
  nodes.forEach((node) => counts.set(node.id, 0));

  // Count connections from edges
  edges.forEach((edge) => {
    const sourceCount = counts.get(edge.source) || 0;
    const targetCount = counts.get(edge.target) || 0;
    counts.set(edge.source, sourceCount + 1);
    counts.set(edge.target, targetCount + 1);
  });

  return counts;
}
