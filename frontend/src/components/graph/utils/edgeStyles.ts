/**
 * Edge Visual Styling Utilities
 * Maps graph edges to Reagraph visual properties
 */

import type { GraphEdge, LinkType, LinkDegree } from "../../../types/graph";
import { edgeColors, edgeStyles } from "../../../types/graph";

/**
 * Edge width configuration
 */
export interface EdgeWidthConfig {
  minWidth: number;
  maxWidth: number;
  baseWidth: number;
}

const DEFAULT_WIDTH_CONFIG: EdgeWidthConfig = {
  minWidth: 1,
  maxWidth: 4,
  baseWidth: 2,
};

/**
 * Get edge color based on link type
 */
export function getEdgeColor(linkType: LinkType): string {
  return edgeColors[linkType] || edgeColors.about;
}

/**
 * Get edge line style based on link type
 */
export function getEdgeLineStyle(
  linkType: LinkType,
): "solid" | "dashed" | "dotted" {
  return edgeStyles[linkType] || "solid";
}

/**
 * Calculate edge opacity based on confidence
 */
export function getEdgeOpacity(confidence?: number): number {
  if (confidence === undefined) {
    return 0.7; // Default opacity when no confidence
  }
  // Map confidence (0-1) to opacity (0.3-1.0)
  const minOpacity = 0.3;
  const maxOpacity = 1.0;
  return minOpacity + confidence * (maxOpacity - minOpacity);
}

/**
 * Calculate edge width based on degree of relationship
 */
export function getEdgeWidth(
  degree?: LinkDegree,
  config: EdgeWidthConfig = DEFAULT_WIDTH_CONFIG,
): number {
  switch (degree) {
    case "full":
      return config.maxWidth;
    case "partial":
      return config.baseWidth;
    case "minimal":
      return config.minWidth;
    default:
      return config.baseWidth;
  }
}

/**
 * Get edge status styling overlay
 */
export function getEdgeStatusStyle(status: GraphEdge["status"]): {
  opacity: number;
  strokeDasharray?: string;
} {
  switch (status) {
    case "active":
      return { opacity: 1.0 };
    case "superseded":
      return { opacity: 0.4, strokeDasharray: "4 2" };
    case "removed":
      return { opacity: 0.2, strokeDasharray: "2 4" };
    default:
      return { opacity: 1.0 };
  }
}

/**
 * Determine if edge should show an arrow (directional)
 * Most link types are directional
 */
export function shouldShowArrow(_linkType: LinkType): boolean {
  // All link types are directional in our model
  return true;
}

/**
 * Get arrow type based on link semantics
 */
export function getArrowType(
  linkType: LinkType,
): "forward" | "backward" | "both" | "none" {
  // Bidirectional relationships
  const bidirectional: LinkType[] = ["alternative_to", "contradicts"];

  if (bidirectional.includes(linkType)) {
    return "both";
  }

  return "forward";
}

/**
 * Get edge semantic category for grouping similar edge types
 */
export function getEdgeCategory(
  linkType: LinkType,
): "positive" | "negative" | "dependency" | "temporal" | "reference" {
  const positiveTypes: LinkType[] = [
    "addresses",
    "creates",
    "unblocks",
    "evidence_for",
    "implements",
    "implemented_by",
    "includes",
    "validates_claim",
  ];

  const negativeTypes: LinkType[] = ["blocks", "contradicts", "excludes"];

  const dependencyTypes: LinkType[] = [
    "requires",
    "constrained_by",
    "derived_from",
  ];

  const temporalTypes: LinkType[] = ["supersedes", "refines", "replaces"];

  if (positiveTypes.includes(linkType)) return "positive";
  if (negativeTypes.includes(linkType)) return "negative";
  if (dependencyTypes.includes(linkType)) return "dependency";
  if (temporalTypes.includes(linkType)) return "temporal";
  return "reference";
}

/**
 * Get complete edge style configuration for Reagraph
 */
export function getEdgeStyle(edge: GraphEdge): {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  strokeDasharray: string | undefined;
  animated: boolean;
} {
  const lineStyle = getEdgeLineStyle(edge.linkType);
  const statusStyle = getEdgeStatusStyle(edge.status);

  // Convert line style to strokeDasharray
  let strokeDasharray: string | undefined;
  if (lineStyle === "dashed") {
    strokeDasharray = "8 4";
  } else if (lineStyle === "dotted") {
    strokeDasharray = "2 2";
  } else if (statusStyle.strokeDasharray) {
    strokeDasharray = statusStyle.strokeDasharray;
  }

  // Animate blocking/negative edges
  const category = getEdgeCategory(edge.linkType);
  const animated = category === "negative" && edge.status === "active";

  return {
    stroke: getEdgeColor(edge.linkType),
    strokeWidth: getEdgeWidth(edge.degree),
    opacity: statusStyle.opacity * getEdgeOpacity(edge.confidence),
    strokeDasharray,
    animated,
  };
}

/**
 * Get highlight styling for selected/hovered edges
 */
export function getEdgeHighlightStyle(
  isSelected: boolean,
  isHovered: boolean,
): {
  strokeWidth: number;
  stroke: string;
  opacity: number;
} {
  if (isSelected) {
    return {
      strokeWidth: 4,
      stroke: "#FBBF24", // Yellow highlight
      opacity: 1,
    };
  }
  if (isHovered) {
    return {
      strokeWidth: 3,
      stroke: "#60A5FA", // Blue highlight
      opacity: 1,
    };
  }
  return {
    strokeWidth: 2,
    stroke: "transparent",
    opacity: 0,
  };
}

/**
 * Get edge label text for display
 */
export function getEdgeLabelText(edge: GraphEdge): string {
  // Format link type for display (replace underscores with spaces)
  const label = edge.linkType.replace(/_/g, " ");

  // Add degree indicator if present
  if (edge.degree && edge.degree !== "full") {
    return `${label} (${edge.degree})`;
  }

  return label;
}

/**
 * Determine if edge label should be shown based on zoom level
 */
export function shouldShowEdgeLabel(zoomLevel: number): boolean {
  // Only show labels when zoomed in enough
  return zoomLevel > 1.2;
}

/**
 * Get edge curvature for parallel edges
 * When multiple edges connect the same nodes, curve them to avoid overlap
 */
export function getEdgeCurvature(
  edgeIndex: number,
  totalParallelEdges: number,
): number {
  if (totalParallelEdges <= 1) return 0;

  // Distribute curvature evenly
  const spread = 0.5; // Maximum curvature
  const step = spread / (totalParallelEdges - 1);
  const offset = (totalParallelEdges - 1) / 2;

  return (edgeIndex - offset) * step;
}

/**
 * Group edges by their source-target pair for parallel edge detection
 */
export function groupParallelEdges(
  edges: GraphEdge[],
): Map<string, GraphEdge[]> {
  const groups = new Map<string, GraphEdge[]>();

  edges.forEach((edge) => {
    // Create a normalized key (sort source/target to handle bidirectional)
    const key = [edge.source, edge.target].sort().join("-");
    const existing = groups.get(key) || [];
    groups.set(key, [...existing, edge]);
  });

  return groups;
}
