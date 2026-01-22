/**
 * Evidence Chain Traversal Utilities
 * Traverses evidence_for links to build evidence chains and calculate derived confidence
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.1
 */

import type { GraphNode, GraphEdge } from "../../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface EvidenceChainNode {
  id: string;
  node: GraphNode;
  confidence: number;
  evidenceStrength?: "strong" | "moderate" | "weak";
  status: "active" | "invalidated" | "superseded";
  hopDistance: number;
}

export interface EvidenceChain {
  nodes: EvidenceChainNode[];
  derivedConfidence: number;
  hasInvalidatedSource: boolean;
  hasSupersededSource: boolean;
  totalStrengthMultiplier: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Evidence strength multipliers for confidence calculation
 */
export const STRENGTH_MULTIPLIERS: Record<string, number> = {
  strong: 1.0,
  moderate: 0.7,
  weak: 0.4,
};

/**
 * Status penalty multipliers
 */
export const STATUS_MULTIPLIERS: Record<string, number> = {
  active: 1.0,
  superseded: 0.5,
  invalidated: 0.0,
};

// ============================================================================
// Evidence Chain Traversal
// ============================================================================

/**
 * Traverse evidence_for links upward from a starting node
 * Builds a chain of nodes that provide evidence for the claim
 *
 * @param startNodeId - The node to start traversal from
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of nodes in the evidence chain (from start to root)
 */
export function traverseEvidenceChain(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): EvidenceChainNode[] {
  const chain: EvidenceChainNode[] = [];
  const visited = new Set<string>();

  // Create node lookup map
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Create edge lookup - evidence_for links point FROM evidence TO claim
  // So we need to find edges where the source is our current node
  const evidenceForEdges = edges.filter((e) => e.linkType === "evidence_for");
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of evidenceForEdges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  }

  // BFS traversal upward through evidence_for links
  let currentId = startNodeId;
  let hopDistance = 0;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) break;

    // Determine status
    let status: "active" | "invalidated" | "superseded" = "active";
    if (
      node.evidenceStatus === "source_invalidated" ||
      node.status === "abandoned"
    ) {
      status = "invalidated";
    } else if (
      node.evidenceStatus === "source_superseded" ||
      node.status === "superseded"
    ) {
      status = "superseded";
    }

    chain.push({
      id: node.id,
      node,
      confidence: node.confidence,
      evidenceStrength: node.evidenceStrength,
      status,
      hopDistance,
    });

    // Find next node in chain (follow evidence_for link upward)
    const outgoingEdges = edgesBySource.get(currentId) || [];
    if (outgoingEdges.length > 0) {
      // Take the first evidence_for link (in complex graphs, might need to handle multiple)
      currentId = outgoingEdges[0].target;
      hopDistance++;
    } else {
      break;
    }
  }

  return chain;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate derived confidence by traversing evidence chain and applying multipliers
 *
 * Formula: rootConfidence × Π(strengthMultiplier[i] × confidence[i]) for intermediate nodes
 *          × strengthMultiplier[startNode]
 *
 * The starting node's own confidence is NOT included - the derived confidence IS
 * the calculated confidence for that node based on its evidence chain.
 *
 * Example: claim -> advisor -> gartner
 * = 0.9 (gartner) × 1.0 (advisor strength) × 0.7 (advisor) × 0.7 (claim strength) = 0.441
 *
 * @param startNodeId - The node to calculate derived confidence for
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Derived confidence value (0-1)
 */
export function calculateDerivedConfidence(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): number {
  const chain = traverseEvidenceChain(startNodeId, nodes, edges);

  if (chain.length === 0) return 0;
  if (chain.length === 1) return chain[0].confidence;

  // Start with 1.0 and multiply factors
  let derivedConfidence = 1.0;

  // Traverse from root (last) to start (first)
  for (let i = chain.length - 1; i >= 0; i--) {
    const chainNode = chain[i];
    const isStartNode = i === 0;
    const isRootNode = i === chain.length - 1;

    // Apply status penalty
    const statusMultiplier = STATUS_MULTIPLIERS[chainNode.status] ?? 1.0;
    if (statusMultiplier === 0) {
      return 0; // Chain is broken by invalidated source
    }

    // For root node: use its confidence
    // For intermediate nodes: use strength × confidence
    // For start node: only use strength (not its own confidence)
    if (isRootNode) {
      derivedConfidence *= chainNode.confidence * statusMultiplier;
    } else if (isStartNode) {
      // Start node: only apply its evidence strength, not its confidence
      if (chainNode.evidenceStrength) {
        const strengthMultiplier =
          STRENGTH_MULTIPLIERS[chainNode.evidenceStrength] ?? 1.0;
        derivedConfidence *= strengthMultiplier * statusMultiplier;
      }
    } else {
      // Intermediate nodes: apply both strength and confidence
      const strengthMultiplier =
        STRENGTH_MULTIPLIERS[chainNode.evidenceStrength ?? "strong"] ?? 1.0;
      derivedConfidence *=
        strengthMultiplier * chainNode.confidence * statusMultiplier;
    }
  }

  return derivedConfidence;
}

/**
 * Build complete evidence chain analysis including confidence breakdown
 */
export function analyzeEvidenceChain(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): EvidenceChain {
  const chainNodes = traverseEvidenceChain(startNodeId, nodes, edges);

  let hasInvalidatedSource = false;
  let hasSupersededSource = false;
  let totalStrengthMultiplier = 1.0;

  for (const chainNode of chainNodes) {
    if (chainNode.status === "invalidated") {
      hasInvalidatedSource = true;
    }
    if (chainNode.status === "superseded") {
      hasSupersededSource = true;
    }
    if (chainNode.evidenceStrength) {
      totalStrengthMultiplier *=
        STRENGTH_MULTIPLIERS[chainNode.evidenceStrength] ?? 1.0;
    }
  }

  const derivedConfidence = calculateDerivedConfidence(
    startNodeId,
    nodes,
    edges,
  );

  return {
    nodes: chainNodes,
    derivedConfidence,
    hasInvalidatedSource,
    hasSupersededSource,
    totalStrengthMultiplier,
  };
}

// ============================================================================
// Source Invalidation Detection
// ============================================================================

/**
 * Detect nodes affected by an invalidated source in their evidence chain
 *
 * @param startNodeId - The node to check from
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of affected nodes (excluding active sources)
 */
export function detectInvalidatedSources(
  startNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const affected: GraphNode[] = [];

  // Find the root node of the evidence chain
  const chain = traverseEvidenceChain(startNodeId, nodes, edges);

  // Check if any node in the chain is invalidated
  let foundInvalidated = false;
  for (const chainNode of chain) {
    if (chainNode.status === "invalidated") {
      foundInvalidated = true;
      break;
    }
  }

  if (!foundInvalidated) {
    return affected;
  }

  // All nodes up to (but not including) the invalidated source are affected
  for (const chainNode of chain) {
    if (chainNode.status === "invalidated") {
      break;
    }
    affected.push(chainNode.node);
  }

  return affected;
}

/**
 * Find all nodes that depend on a given source through evidence chains
 * (downstream propagation - find what nodes cite this as evidence)
 */
export function findDependentNodes(
  sourceNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const dependents: GraphNode[] = [];
  const visited = new Set<string>();

  // Create node lookup
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Find edges where this node is the target of evidence_for
  // (meaning other nodes provide evidence for this one)
  const evidenceForEdges = edges.filter((e) => e.linkType === "evidence_for");
  const edgesByTarget = new Map<string, GraphEdge[]>();
  for (const edge of evidenceForEdges) {
    if (!edgesByTarget.has(edge.target)) {
      edgesByTarget.set(edge.target, []);
    }
    edgesByTarget.get(edge.target)!.push(edge);
  }

  // BFS to find all downstream dependents
  const queue = [sourceNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find nodes that cite this node as evidence
    const incomingEdges = edgesByTarget.get(currentId) || [];
    for (const edge of incomingEdges) {
      const dependentNode = nodeMap.get(edge.source);
      if (dependentNode && !visited.has(edge.source)) {
        dependents.push(dependentNode);
        queue.push(edge.source);
      }
    }
  }

  return dependents;
}

/**
 * Check if a node's evidence chain contains low confidence
 * (derived confidence below threshold)
 */
export function hasLowConfidenceChain(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  threshold: number = 0.3,
): boolean {
  const derivedConfidence = calculateDerivedConfidence(nodeId, nodes, edges);
  return derivedConfidence < threshold;
}

export default {
  traverseEvidenceChain,
  calculateDerivedConfidence,
  analyzeEvidenceChain,
  detectInvalidatedSources,
  findDependentNodes,
  hasLowConfidenceChain,
  STRENGTH_MULTIPLIERS,
  STATUS_MULTIPLIERS,
};
