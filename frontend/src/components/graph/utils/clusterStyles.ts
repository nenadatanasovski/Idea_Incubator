/**
 * Cluster styling utilities for graph visualization
 * Provides color mappings and theme configuration for cluster boundaries
 */

import type { GraphType } from "../../../types/graph";

/**
 * Color configuration for cluster boundaries
 */
export interface ClusterColorConfig {
  /** Border color for the cluster boundary */
  stroke: string;
  /** Fill color for the cluster background (with transparency) */
  fill: string;
}

/**
 * Color mappings for each graph type cluster
 * Uses semantic color tints that match the node colors but lighter
 */
export const clusterColors: Record<GraphType, ClusterColorConfig> = {
  problem: {
    stroke: "#FCA5A5", // Red-300
    fill: "rgba(254, 226, 226, 0.3)", // Red-100 with transparency
  },
  solution: {
    stroke: "#86EFAC", // Green-300
    fill: "rgba(220, 252, 231, 0.3)", // Green-100 with transparency
  },
  market: {
    stroke: "#93C5FD", // Blue-300
    fill: "rgba(219, 234, 254, 0.3)", // Blue-100 with transparency
  },
  risk: {
    stroke: "#FCD34D", // Amber-300
    fill: "rgba(254, 249, 195, 0.3)", // Amber-100 with transparency
  },
  fit: {
    stroke: "#C4B5FD", // Violet-300
    fill: "rgba(237, 233, 254, 0.3)", // Violet-100 with transparency
  },
  business: {
    stroke: "#5EEAD4", // Teal-300
    fill: "rgba(204, 251, 241, 0.3)", // Teal-100 with transparency
  },
  spec: {
    stroke: "#D1D5DB", // Gray-300
    fill: "rgba(243, 244, 246, 0.3)", // Gray-100 with transparency
  },
};

/**
 * Default cluster colors for unknown or custom clusters
 */
export const defaultClusterColor: ClusterColorConfig = {
  stroke: "#CBD5E1", // Slate-300
  fill: "rgba(241, 245, 249, 0.3)", // Slate-100 with transparency
};

/**
 * Get cluster color configuration by cluster name
 * Falls back to default colors if cluster name is not recognized
 */
export function getClusterColor(clusterName: string): ClusterColorConfig {
  if (clusterName in clusterColors) {
    return clusterColors[clusterName as GraphType];
  }
  return defaultClusterColor;
}

/**
 * Theme configuration for cluster visualization in Reagraph
 */
export const clusterTheme = {
  /** Default cluster styling */
  cluster: {
    stroke: defaultClusterColor.stroke,
    fill: defaultClusterColor.fill,
    label: {
      stroke: "#F1F5F9", // Slate-100 - label background
      color: "#475569", // Slate-600 - label text
      fontSize: 12,
    },
  },
};

/**
 * Generate a Reagraph-compatible cluster theme based on available clusters
 * This can be used to customize cluster colors based on their names
 */
export function generateClusterTheme(
  clusterNames: string[],
): Record<string, ClusterColorConfig> {
  const theme: Record<string, ClusterColorConfig> = {};

  for (const name of clusterNames) {
    theme[name] = getClusterColor(name);
  }

  return theme;
}
