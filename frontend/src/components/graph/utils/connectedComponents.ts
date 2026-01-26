/**
 * Connected Components Utility
 * Finds disconnected subgraphs and calculates layout offsets
 */

import type { GraphNode, GraphEdge } from "../../../types/graph";

/**
 * A connected component is a group of nodes that are all reachable from each other
 */
export interface ConnectedComponent {
  /** Unique identifier for this component */
  id: number;
  /** Node IDs in this component */
  nodeIds: Set<string>;
  /** Number of nodes in this component */
  size: number;
}

/**
 * Find all connected components in a graph using BFS
 * Treats edges as undirected for component detection
 */
export function findConnectedComponents(
  nodes: GraphNode[],
  edges: GraphEdge[],
): ConnectedComponent[] {
  if (nodes.length === 0) return [];

  // Build adjacency list (undirected)
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    // Only add edges if both nodes exist in our node list
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }
  }

  const visited = new Set<string>();
  const components: ConnectedComponent[] = [];
  let componentId = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    // BFS to find all nodes in this component
    const componentNodeIds = new Set<string>();
    const queue: string[] = [node.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      componentNodeIds.add(currentId);

      // Add unvisited neighbors to queue
      const neighbors = adjacency.get(currentId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }

    components.push({
      id: componentId++,
      nodeIds: componentNodeIds,
      size: componentNodeIds.size,
    });
  }

  // Sort components by size (largest first) for better visual layout
  components.sort((a, b) => b.size - a.size);

  return components;
}

/**
 * Create a mapping of node ID to component ID
 */
export function createNodeComponentMap(
  components: ConnectedComponent[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const component of components) {
    for (const nodeId of component.nodeIds) {
      map.set(nodeId, component.id);
    }
  }
  return map;
}

/**
 * Calculate vertical offset for each component to separate them visually
 * Returns a map of component ID to Y offset
 */
export function calculateComponentOffsets(
  components: ConnectedComponent[],
  gapBetweenComponents: number = 200,
): Map<number, number> {
  const offsets = new Map<number, number>();

  // Estimate height of each component based on node count
  // This is a rough estimate - actual height depends on layout
  const estimateComponentHeight = (component: ConnectedComponent): number => {
    // For tree layouts, height roughly scales with sqrt of node count
    // since nodes spread both horizontally and vertically
    return Math.max(100, Math.sqrt(component.size) * 80);
  };

  let currentOffset = 0;
  for (const component of components) {
    offsets.set(component.id, currentOffset);
    currentOffset += estimateComponentHeight(component) + gapBetweenComponents;
  }

  return offsets;
}

/**
 * Result of component separation analysis
 */
export interface ComponentSeparationResult {
  /** All connected components found */
  components: ConnectedComponent[];
  /** Map from node ID to component ID */
  nodeComponentMap: Map<string, number>;
  /** Map from component ID to Y offset */
  componentOffsets: Map<number, number>;
  /** Whether there are multiple components (separation needed) */
  hasMultipleComponents: boolean;
}

/**
 * Analyze graph and calculate component separation data
 * Returns all the data needed to apply vertical offsets to nodes
 */
export function analyzeComponentSeparation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  gapBetweenComponents: number = 200,
): ComponentSeparationResult {
  const components = findConnectedComponents(nodes, edges);
  const nodeComponentMap = createNodeComponentMap(components);
  const componentOffsets = calculateComponentOffsets(
    components,
    gapBetweenComponents,
  );

  return {
    components,
    nodeComponentMap,
    componentOffsets,
    hasMultipleComponents: components.length > 1,
  };
}

/**
 * Get the Y offset for a specific node based on its component
 */
export function getNodeYOffset(
  nodeId: string,
  nodeComponentMap: Map<string, number>,
  componentOffsets: Map<number, number>,
): number {
  const componentId = nodeComponentMap.get(nodeId);
  if (componentId === undefined) return 0;
  return componentOffsets.get(componentId) || 0;
}
