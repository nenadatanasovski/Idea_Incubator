/**
 * Abstraction Traversal Utilities
 * Traverses implements/implemented_by links for abstraction chain queries
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.4
 */

import type {
  GraphNode,
  GraphEdge,
  AbstractionLevel,
} from "../../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface AbstractionChainNode {
  id: string;
  node: GraphNode;
  abstractionLevel?: AbstractionLevel;
  direction: "up" | "down" | "current";
  hopDistance: number;
}

export interface AbstractionChain {
  current: GraphNode;
  ancestors: AbstractionChainNode[]; // More abstract (vision -> strategy)
  descendants: AbstractionChainNode[]; // More concrete (tactic -> implementation)
  whyIsThisHere: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Abstraction levels in order from most abstract to most concrete
 */
export const ABSTRACTION_ORDER: AbstractionLevel[] = [
  "vision",
  "strategy",
  "tactic",
  "implementation",
];

/**
 * Get the index of an abstraction level (lower = more abstract)
 */
export function getAbstractionIndex(level?: AbstractionLevel): number {
  if (!level) return -1;
  return ABSTRACTION_ORDER.indexOf(level);
}

// ============================================================================
// Traversal Functions
// ============================================================================

/**
 * Traverse upward through implements links to find more abstract nodes
 * (this node implements -> more abstract parent)
 */
export function traverseAbstractionUp(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): AbstractionChainNode[] {
  const ancestors: AbstractionChainNode[] = [];
  const visited = new Set<string>();

  // Create node lookup
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Find implements links (source implements target)
  const implementsEdges = edges.filter(
    (e) => e.linkType === "implements" && e.status === "active",
  );
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of implementsEdges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  }

  // BFS upward
  let currentId = startNodeId;
  let hopDistance = 0;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const outgoingImplements = edgesBySource.get(currentId) || [];
    if (outgoingImplements.length === 0) break;

    // Follow the first implements link upward
    const edge = outgoingImplements[0];
    const parentNode = nodeMap.get(edge.target);
    if (!parentNode) break;

    hopDistance++;
    ancestors.push({
      id: parentNode.id,
      node: parentNode,
      abstractionLevel: parentNode.abstractionLevel,
      direction: "up",
      hopDistance,
    });

    currentId = parentNode.id;
  }

  return ancestors;
}

/**
 * Traverse downward through implemented_by links to find more concrete nodes
 * (this node implemented_by -> more concrete children)
 */
export function traverseAbstractionDown(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): AbstractionChainNode[] {
  const descendants: AbstractionChainNode[] = [];
  const visited = new Set<string>();

  // Create node lookup
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Find implemented_by links (source is implemented by target)
  const implementedByEdges = edges.filter(
    (e) => e.linkType === "implemented_by" && e.status === "active",
  );
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of implementedByEdges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  }

  // BFS downward
  const queue: Array<{ id: string; hopDistance: number }> = [
    { id: startNodeId, hopDistance: 0 },
  ];

  while (queue.length > 0) {
    const { id: currentId, hopDistance } = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const outgoingImplementedBy = edgesBySource.get(currentId) || [];
    for (const edge of outgoingImplementedBy) {
      const childNode = nodeMap.get(edge.target);
      if (!childNode || visited.has(childNode.id)) continue;

      descendants.push({
        id: childNode.id,
        node: childNode,
        abstractionLevel: childNode.abstractionLevel,
        direction: "down",
        hopDistance: hopDistance + 1,
      });

      queue.push({ id: childNode.id, hopDistance: hopDistance + 1 });
    }
  }

  return descendants;
}

/**
 * Build complete abstraction chain for a node
 */
export function buildAbstractionChain(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): AbstractionChain {
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const currentNode = nodeMap.get(nodeId);
  if (!currentNode) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const ancestors = traverseAbstractionUp(nodeId, nodes, edges);
  const descendants = traverseAbstractionDown(nodeId, nodes, edges);

  // Generate "Why is this here?" explanations
  const whyIsThisHere = generateWhyExplanations(currentNode, ancestors);

  return {
    current: currentNode,
    ancestors,
    descendants,
    whyIsThisHere,
  };
}

/**
 * Generate "Why is this here?" explanations based on abstraction chain
 */
function generateWhyExplanations(
  node: GraphNode,
  ancestors: AbstractionChainNode[],
): string[] {
  const explanations: string[] = [];

  if (ancestors.length === 0) {
    explanations.push(
      `"${node.label}" is a top-level ${node.abstractionLevel || "block"} with no higher abstraction.`,
    );
    return explanations;
  }

  // Build explanation chain
  explanations.push(
    `"${node.label}" exists to implement higher-level abstractions:`,
  );

  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = ancestors[i];
    const prefix = "  ".repeat(i + 1) + "↳ ";
    explanations.push(
      `${prefix}Implements "${ancestor.node.label}" (${ancestor.abstractionLevel || "unspecified"})`,
    );
  }

  // Add summary
  const root = ancestors[ancestors.length - 1];
  if (root) {
    explanations.push(
      `\nUltimately supporting the ${root.abstractionLevel || "top-level"}: "${root.node.label}"`,
    );
  }

  return explanations;
}

/**
 * Get nodes at a specific abstraction level
 */
export function getNodesAtAbstractionLevel(
  level: AbstractionLevel,
  nodes: GraphNode[],
): GraphNode[] {
  return nodes.filter((n) => n.abstractionLevel === level);
}

/**
 * Sort nodes by abstraction level (most abstract first)
 */
export function sortByAbstractionLevel(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => {
    const aIndex = getAbstractionIndex(a.abstractionLevel);
    const bIndex = getAbstractionIndex(b.abstractionLevel);
    return aIndex - bIndex;
  });
}

/**
 * Find all nodes that implement a given node (direct children only)
 */
export function findImplementingNodes(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const implementingEdges = edges.filter(
    (e) =>
      e.linkType === "implements" &&
      e.target === nodeId &&
      e.status === "active",
  );

  return implementingEdges
    .map((e) => nodeMap.get(e.source))
    .filter((n): n is GraphNode => n !== undefined);
}

/**
 * Find the node that this node implements (direct parent only)
 */
export function findImplementedNode(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode | null {
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const implementsEdge = edges.find(
    (e) =>
      e.linkType === "implements" &&
      e.source === nodeId &&
      e.status === "active",
  );

  if (!implementsEdge) return null;
  return nodeMap.get(implementsEdge.target) || null;
}

export default {
  traverseAbstractionUp,
  traverseAbstractionDown,
  buildAbstractionChain,
  getNodesAtAbstractionLevel,
  sortByAbstractionLevel,
  findImplementingNodes,
  findImplementedNode,
  getAbstractionIndex,
  ABSTRACTION_ORDER,
};
