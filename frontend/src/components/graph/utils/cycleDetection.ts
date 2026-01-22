/**
 * Cycle Detection Utilities
 * Real-time cycle detection, classification, and break point suggestions
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.2
 */

import type { GraphNode, GraphEdge, LinkType } from "../../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface DetectedCycle {
  id: string;
  members: string[];
  linkTypes: LinkType[];
  type: "blocking" | "reinforcing";
  edges: GraphEdge[];
}

export interface CycleAnalysis {
  cycles: DetectedCycle[];
  nodeInCycles: Map<string, string[]>; // nodeId -> cycleIds
  suggestedBreakPoints: Map<string, string>; // cycleId -> nodeId to break
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Link types that indicate blocking relationships (requires/blocks/depends)
 */
const BLOCKING_LINK_TYPES: LinkType[] = [
  "requires",
  "blocks",
  "constrained_by",
];

/**
 * Link types that indicate causal/reinforcing relationships
 */
const REINFORCING_LINK_TYPES: LinkType[] = [
  "creates",
  "addresses",
  "derived_from",
  "evidence_for",
];

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect all cycles in the graph using Tarjan's algorithm (simplified)
 * Returns an array of detected cycles with their member nodes
 *
 * @param edges - All graph edges
 * @returns Array of detected cycles
 */
export function detectCycles(edges: GraphEdge[]): DetectedCycle[] {
  const cycles: DetectedCycle[] = [];

  // Build adjacency list
  const adjacency = new Map<
    string,
    Array<{ target: string; edge: GraphEdge }>
  >();
  const allNodes = new Set<string>();

  for (const edge of edges) {
    if (edge.status !== "active") continue;

    allNodes.add(edge.source);
    allNodes.add(edge.target);

    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push({ target: edge.target, edge });
  }

  // DFS-based cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: Array<{ node: string; edge: GraphEdge | null }> = [];

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push({ node, edge: null });

    const neighbors = adjacency.get(node) || [];
    for (const { target, edge } of neighbors) {
      if (!visited.has(target)) {
        path[path.length - 1].edge = edge;
        dfs(target);
      } else if (recursionStack.has(target)) {
        // Found a cycle - extract it
        const cycleStartIndex = path.findIndex((p) => p.node === target);
        if (cycleStartIndex !== -1) {
          const cyclePath = path.slice(cycleStartIndex);
          cyclePath[cyclePath.length - 1].edge = edge;

          const members = cyclePath.map((p) => p.node);
          const cycleEdges = cyclePath
            .map((p) => p.edge)
            .filter((e): e is GraphEdge => e !== null);
          const linkTypes = cycleEdges.map((e) => e.linkType);

          // Avoid duplicate cycles
          const cycleKey = [...members].sort().join(",");
          if (
            !cycles.some((c) => [...c.members].sort().join(",") === cycleKey)
          ) {
            cycles.push({
              id: `cycle_${cycles.length + 1}`,
              members,
              linkTypes,
              type: classifyCycleType({ members, linkTypes }),
              edges: cycleEdges,
            });
          }
        }
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  // Run DFS from each unvisited node
  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Classify a cycle as blocking or reinforcing based on its link types
 *
 * @param cycle - The cycle to classify
 * @returns "blocking" if cycle contains blocking links, "reinforcing" otherwise
 */
export function classifyCycleType(cycle: {
  members: string[];
  linkTypes: LinkType[];
}): "blocking" | "reinforcing" {
  const hasBlockingLinks = cycle.linkTypes.some((lt) =>
    BLOCKING_LINK_TYPES.includes(lt),
  );

  if (hasBlockingLinks) {
    return "blocking";
  }

  // Check if all links are causal/reinforcing
  const hasReinforcingLinks = cycle.linkTypes.some((lt) =>
    REINFORCING_LINK_TYPES.includes(lt),
  );

  if (hasReinforcingLinks) {
    return "reinforcing";
  }

  // Default to blocking for unknown link types
  return "blocking";
}

/**
 * Find the best break point for a cycle based on external inputs
 * Nodes with external inputs are better break points as they can be resolved independently
 *
 * @param cycle - The cycle to find a break point for
 * @param nodes - All graph nodes
 * @returns The node ID that is the best break point, or null if none found
 */
export function findBreakPoint(
  cycle: { members: string[] },
  nodes: Array<{ id: string; externalInputs?: string[] }>,
): string | null {
  let bestBreakPoint: string | null = null;
  let maxExternalInputs = 0;

  for (const memberId of cycle.members) {
    const node = nodes.find((n) => n.id === memberId);
    if (node && node.externalInputs && node.externalInputs.length > 0) {
      if (node.externalInputs.length > maxExternalInputs) {
        maxExternalInputs = node.externalInputs.length;
        bestBreakPoint = memberId;
      }
    }
  }

  // If no node has external inputs, return the first member
  if (!bestBreakPoint && cycle.members.length > 0) {
    bestBreakPoint = cycle.members[0];
  }

  return bestBreakPoint;
}

// ============================================================================
// Full Analysis
// ============================================================================

/**
 * Perform full cycle analysis on the graph
 */
export function analyzeCycles(
  nodes: GraphNode[],
  edges: GraphEdge[],
): CycleAnalysis {
  const cycles = detectCycles(edges);

  // Build node-to-cycles map
  const nodeInCycles = new Map<string, string[]>();
  for (const cycle of cycles) {
    for (const memberId of cycle.members) {
      if (!nodeInCycles.has(memberId)) {
        nodeInCycles.set(memberId, []);
      }
      nodeInCycles.get(memberId)!.push(cycle.id);
    }
  }

  // Find suggested break points for each cycle
  const suggestedBreakPoints = new Map<string, string>();

  // Extend nodes with external input info for break point detection
  const nodesWithExternal = nodes.map((n) => ({
    id: n.id,
    externalInputs: n.properties.externalInputs as string[] | undefined,
  }));

  for (const cycle of cycles) {
    const breakPoint = findBreakPoint(cycle, nodesWithExternal);
    if (breakPoint) {
      suggestedBreakPoints.set(cycle.id, breakPoint);
    }
  }

  return {
    cycles,
    nodeInCycles,
    suggestedBreakPoints,
  };
}

/**
 * Check if adding a new edge would create a cycle
 *
 * @param source - Source node ID
 * @param target - Target node ID
 * @param existingEdges - Current graph edges
 * @returns True if adding the edge would create a cycle
 */
export function wouldCreateCycle(
  source: string,
  target: string,
  existingEdges: GraphEdge[],
): boolean {
  // Check if there's already a path from target to source
  // If so, adding source->target would create a cycle
  const visited = new Set<string>();
  const queue = [target];

  // Build adjacency for existing edges
  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (edge.status !== "active") continue;
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Get cycle information for a specific node
 */
export function getNodeCycleInfo(
  nodeId: string,
  analysis: CycleAnalysis,
): DetectedCycle[] {
  const cycleIds = analysis.nodeInCycles.get(nodeId) || [];
  return analysis.cycles.filter((c) => cycleIds.includes(c.id));
}

/**
 * Highlight all nodes in cycles that include the given node
 */
export function getCycleMemberIds(
  nodeId: string,
  analysis: CycleAnalysis,
): string[] {
  const cycles = getNodeCycleInfo(nodeId, analysis);
  const members = new Set<string>();

  for (const cycle of cycles) {
    for (const memberId of cycle.members) {
      members.add(memberId);
    }
  }

  return Array.from(members);
}

export default {
  detectCycles,
  classifyCycleType,
  findBreakPoint,
  analyzeCycles,
  wouldCreateCycle,
  getNodeCycleInfo,
  getCycleMemberIds,
};
