/**
 * Cascading Change Detection Utilities
 * Detects and analyzes the impact of changes to graph nodes
 *
 * Features:
 * - Semantic similarity scan (threshold 0.7)
 * - Conflict detection (contradictions, supersessions)
 * - Dependency traversal (requires, blocks, derived_from)
 * - Impact radius calculation (1-hop, 2-hop, n-hop)
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T6.4
 */

import type {
  GraphNode,
  GraphEdge,
  LinkType,
  BlockStatus,
} from "../../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface CascadeAnalysisResult {
  affectedNodes: AffectedNode[];
  newLinks: SuggestedLink[];
  conflicts: DetectedConflict[];
  impactRadius: number;
  semanticMatches: SemanticMatch[];
}

export interface AffectedNode {
  id: string;
  content: string;
  currentStatus: BlockStatus;
  proposedAction: "supersedes" | "invalidates" | "needs_review" | "refines";
  reason: string;
  node?: GraphNode; // Optional: full node reference for advanced operations
  suggestedChanges?: Partial<GraphNode>;
  hopDistance: number;
}

export interface SuggestedLink {
  source: string;
  target: string;
  linkType: LinkType;
  reason: string;
  confidence: number;
}

export interface DetectedConflict {
  nodeId: string;
  type: "contradiction" | "supersession" | "dependency" | "cycle";
  description: string;
  severity: "high" | "medium" | "low";
  relatedNodeIds: string[];
}

export interface SemanticMatch {
  nodeId: string;
  similarity: number;
  matchType: "content" | "property" | "label";
}

export interface CascadeDetectionOptions {
  maxHops?: number;
  similarityThreshold?: number;
  includeSuperseded?: boolean;
  dependencyTypes?: LinkType[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_MAX_HOPS = 3;

// Link types that represent dependencies for cascade traversal
const DEPENDENCY_LINK_TYPES: LinkType[] = [
  "requires",
  "blocks",
  "derived_from",
  "evidence_for",
  "implements",
  "constrained_by",
];

// Link types that indicate potential conflicts (reserved for future use)
// const CONFLICT_LINK_TYPES: LinkType[] = [
//   "contradicts",
//   "supersedes",
//   "replaces",
//   "excludes",
// ];

// ============================================================================
// Semantic Similarity
// ============================================================================

/**
 * Calculate simple semantic similarity between two strings
 * Uses word overlap (Jaccard similarity) as a basic approximation
 * In production, this would use embeddings or more sophisticated NLP
 */
export function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Normalize and tokenize
  const normalize = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2), // Filter out short words
    );
  };

  const words1 = normalize(text1);
  const words2 = normalize(text2);

  if (words1.size === 0 || words2.size === 0) return 0;

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Find nodes with semantically similar content
 */
export function findSemanticMatches(
  newContent: string,
  nodes: GraphNode[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): SemanticMatch[] {
  const matches: SemanticMatch[] = [];

  for (const node of nodes) {
    // Check content similarity
    const contentSim = calculateSimilarity(newContent, node.content);
    if (contentSim >= threshold) {
      matches.push({
        nodeId: node.id,
        similarity: contentSim,
        matchType: "content",
      });
      continue;
    }

    // Check label similarity
    const labelSim = calculateSimilarity(newContent, node.label);
    if (labelSim >= threshold) {
      matches.push({
        nodeId: node.id,
        similarity: labelSim,
        matchType: "label",
      });
      continue;
    }

    // Check property values for similarity
    const propValues = Object.values(node.properties)
      .filter((v) => typeof v === "string")
      .join(" ");
    const propSim = calculateSimilarity(newContent, propValues);
    if (propSim >= threshold) {
      matches.push({
        nodeId: node.id,
        similarity: propSim,
        matchType: "property",
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect potential conflicts between a new node and existing nodes
 */
export function detectConflicts(
  newNode: Partial<GraphNode>,
  nodes: GraphNode[],
  edges: GraphEdge[],
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  // Build edge lookup
  const edgesBySource = new Map<string, GraphEdge[]>();
  const edgesByTarget = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
    if (!edgesByTarget.has(edge.target)) {
      edgesByTarget.set(edge.target, []);
    }
    edgesByTarget.get(edge.target)!.push(edge);
  }

  // Check for potential supersession (similar content but different conclusion)
  const similarNodes = findSemanticMatches(
    newNode.content || "",
    nodes,
    0.8, // Higher threshold for supersession detection
  );

  for (const match of similarNodes) {
    const existingNode = nodes.find((n) => n.id === match.nodeId);
    if (!existingNode) continue;

    // If same block type and high similarity, might be supersession
    if (
      existingNode.blockType === newNode.blockType &&
      match.similarity > 0.85
    ) {
      conflicts.push({
        nodeId: existingNode.id,
        type: "supersession",
        description: `New content may supersede existing "${existingNode.label}" (${Math.round(match.similarity * 100)}% similar)`,
        severity: match.similarity > 0.95 ? "high" : "medium",
        relatedNodeIds: [existingNode.id],
      });
    }
  }

  // Check for contradiction patterns (e.g., conflicting assumptions)
  if (newNode.blockType === "assumption") {
    const existingAssumptions = nodes.filter(
      (n) => n.blockType === "assumption",
    );
    for (const assumption of existingAssumptions) {
      // Check if they might contradict
      const sim = calculateSimilarity(
        newNode.content || "",
        assumption.content,
      );
      // High similarity in assumptions often means conflict
      if (sim > 0.5 && sim < 0.9) {
        conflicts.push({
          nodeId: assumption.id,
          type: "contradiction",
          description: `May contradict assumption "${assumption.label}"`,
          severity: "medium",
          relatedNodeIds: [assumption.id],
        });
      }
    }
  }

  // Check for circular dependency potential
  // (This is a simplified check - full cycle detection is more complex)
  if (newNode.id) {
    const outgoingDeps = edgesBySource.get(newNode.id) || [];

    for (const outEdge of outgoingDeps) {
      if (DEPENDENCY_LINK_TYPES.includes(outEdge.linkType)) {
        // Check if target has path back to new node
        const targetIncoming = edgesByTarget.get(outEdge.target) || [];
        for (const inEdge of targetIncoming) {
          if (
            inEdge.source === newNode.id &&
            DEPENDENCY_LINK_TYPES.includes(inEdge.linkType)
          ) {
            conflicts.push({
              nodeId: outEdge.target,
              type: "cycle",
              description: `Potential circular dependency with "${outEdge.target}"`,
              severity: "high",
              relatedNodeIds: [outEdge.target],
            });
          }
        }
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Dependency Traversal
// ============================================================================

/**
 * Traverse dependency graph from a starting node up to maxHops
 */
export function traverseDependencies(
  startNodeId: string,
  _nodes: GraphNode[], // Reserved for future node validation
  edges: GraphEdge[],
  options: {
    maxHops?: number;
    direction?: "upstream" | "downstream" | "both";
    linkTypes?: LinkType[];
  } = {},
): Map<string, number> {
  const {
    maxHops = DEFAULT_MAX_HOPS,
    direction = "both",
    linkTypes = DEPENDENCY_LINK_TYPES,
  } = options;

  const visited = new Map<string, number>(); // nodeId -> hop distance
  const queue: Array<{ nodeId: string; hop: number }> = [
    { nodeId: startNodeId, hop: 0 },
  ];

  // Build edge lookup for efficiency
  const edgesBySource = new Map<string, GraphEdge[]>();
  const edgesByTarget = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    if (!linkTypes.includes(edge.linkType)) continue;

    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);

    if (!edgesByTarget.has(edge.target)) {
      edgesByTarget.set(edge.target, []);
    }
    edgesByTarget.get(edge.target)!.push(edge);
  }

  while (queue.length > 0) {
    const { nodeId, hop } = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.set(nodeId, hop);

    if (hop >= maxHops) continue;

    // Get connected nodes
    const neighbors: string[] = [];

    if (direction === "downstream" || direction === "both") {
      const outgoing = edgesBySource.get(nodeId) || [];
      neighbors.push(...outgoing.map((e) => e.target));
    }

    if (direction === "upstream" || direction === "both") {
      const incoming = edgesByTarget.get(nodeId) || [];
      neighbors.push(...incoming.map((e) => e.source));
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push({ nodeId: neighbor, hop: hop + 1 });
      }
    }
  }

  return visited;
}

// ============================================================================
// Impact Radius Calculation
// ============================================================================

/**
 * Calculate the impact radius of a change to a node
 * Returns the maximum hop distance to affected nodes
 */
export function calculateImpactRadius(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxHops: number = DEFAULT_MAX_HOPS,
): number {
  const affected = traverseDependencies(nodeId, nodes, edges, { maxHops });
  let maxDistance = 0;

  for (const distance of affected.values()) {
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }

  return maxDistance;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform full cascade analysis for a new or updated node
 */
export function analyzeCascadeEffects(
  newNode: Partial<GraphNode> & { content: string },
  existingNodes: GraphNode[],
  edges: GraphEdge[],
  options: CascadeDetectionOptions = {},
): CascadeAnalysisResult {
  const {
    maxHops = DEFAULT_MAX_HOPS,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    includeSuperseded = false,
  } = options;

  // Filter out superseded nodes unless requested
  const activeNodes = includeSuperseded
    ? existingNodes
    : existingNodes.filter((n) => n.status !== "superseded");

  // Find semantic matches
  const semanticMatches = findSemanticMatches(
    newNode.content,
    activeNodes,
    similarityThreshold,
  );

  // Detect conflicts
  const conflicts = detectConflicts(newNode, activeNodes, edges);

  // Traverse dependencies to find affected nodes
  const affectedNodeIds = new Map<string, number>();

  // Start from semantically similar nodes
  for (const match of semanticMatches) {
    const dependencies = traverseDependencies(
      match.nodeId,
      activeNodes,
      edges,
      {
        maxHops,
      },
    );
    for (const [nodeId, hop] of dependencies) {
      const existing = affectedNodeIds.get(nodeId);
      if (existing === undefined || hop < existing) {
        affectedNodeIds.set(nodeId, hop);
      }
    }
  }

  // Build affected nodes list with actions
  const affectedNodes: AffectedNode[] = [];
  const processedIds = new Set<string>();

  for (const [nodeId, hop] of affectedNodeIds) {
    if (nodeId === newNode.id || processedIds.has(nodeId)) continue;
    processedIds.add(nodeId);

    const node = activeNodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Determine proposedAction based on relationship
    let proposedAction: AffectedNode["proposedAction"] = "needs_review";
    let reason = "Related through dependency chain";
    let suggestedChanges: Partial<GraphNode> | undefined;

    // Check if this is a semantic match
    const semanticMatch = semanticMatches.find((m) => m.nodeId === nodeId);
    if (semanticMatch && semanticMatch.similarity > 0.85) {
      proposedAction = "supersedes";
      reason = `High similarity (${Math.round(semanticMatch.similarity * 100)}%) suggests supersession`;
      suggestedChanges = { status: "superseded" };
    } else if (semanticMatch) {
      proposedAction = "refines";
      reason = `Content similarity (${Math.round(semanticMatch.similarity * 100)}%) suggests refinement`;
    }

    // Check for conflicts
    const conflict = conflicts.find((c) => c.relatedNodeIds.includes(nodeId));
    if (conflict) {
      proposedAction = "invalidates";
      reason = conflict.description;
    }

    affectedNodes.push({
      id: node.id,
      content: node.content,
      currentStatus: node.status,
      proposedAction,
      reason,
      node,
      suggestedChanges,
      hopDistance: hop,
    });
  }

  // Sort by hop distance (closer nodes first)
  affectedNodes.sort((a, b) => a.hopDistance - b.hopDistance);

  // Generate suggested links
  const newLinks: SuggestedLink[] = [];

  for (const match of semanticMatches.slice(0, 5)) {
    // Limit to top 5
    const node = activeNodes.find((n) => n.id === match.nodeId);
    if (!node) continue;

    // Determine appropriate link type based on block types
    let linkType: LinkType = "about";

    if (newNode.blockType === "assumption" && node.blockType === "content") {
      linkType = "evidence_for";
    } else if (
      newNode.blockType === "derived" &&
      node.blockType !== "derived"
    ) {
      linkType = "derived_from";
    } else if (newNode.blockType === node.blockType) {
      linkType = match.similarity > 0.85 ? "supersedes" : "refines";
    }

    newLinks.push({
      source: newNode.id || "new_node",
      target: match.nodeId,
      linkType,
      reason: `${match.matchType} similarity: ${Math.round(match.similarity * 100)}%`,
      confidence: match.similarity,
    });
  }

  // Calculate overall impact radius
  const impactRadius = Math.max(...affectedNodes.map((n) => n.hopDistance), 0);

  return {
    affectedNodes,
    newLinks,
    conflicts,
    impactRadius,
    semanticMatches,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if adding a link would create a cycle in the graph
 */
export function wouldCreateCycle(
  source: string,
  target: string,
  edges: GraphEdge[],
  linkTypes: LinkType[] = DEPENDENCY_LINK_TYPES,
): boolean {
  // BFS from target to see if we can reach source
  const visited = new Set<string>();
  const queue = [target];

  // Build edge lookup
  const edgesBySource = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (!linkTypes.includes(edge.linkType)) continue;
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)!.push(edge);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const outgoing = edgesBySource.get(current) || [];
    for (const edge of outgoing) {
      queue.push(edge.target);
    }
  }

  return false;
}

/**
 * Find all nodes that would be affected by marking a node as superseded
 */
export function findSupersessionCascade(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[] {
  // Find nodes that depend on this node
  const dependents = traverseDependencies(nodeId, nodes, edges, {
    direction: "downstream",
    linkTypes: ["derived_from", "evidence_for", "requires"],
  });

  return [...dependents.keys()].filter((id) => id !== nodeId);
}

// ============================================================================
// Spec-compatible API (T6.4 - Test Suite 10)
// ============================================================================

/**
 * Simplified cascade detection function for spec compatibility.
 * Supports two modes:
 * 1. Semantic similarity filtering: detectCascadingChanges(content, nodesWithSimilarity, threshold)
 * 2. Dependency chain traversal: detectCascadingChanges(nodeId, [], threshold, edges)
 *
 * @see GRAPH-TAB-VIEW-SPEC.md Test Suite 10
 */
export function detectCascadingChanges(
  contentOrNodeId: string,
  existingNodes: Array<{ id: string; content?: string; similarity?: number }>,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  edges?: GraphEdge[],
): Array<{ id: string; content?: string; similarity?: number }> {
  // Mode 1: If nodes have pre-computed similarity, filter by threshold
  if (existingNodes.length > 0 && existingNodes[0].similarity !== undefined) {
    return existingNodes.filter(
      (node) => node.similarity !== undefined && node.similarity >= threshold,
    );
  }

  // Mode 2: Dependency chain traversal (when edges are provided)
  // Find nodes that depend ON the modified node (upstream direction)
  // e.g., if block_pricing.target = block_target, then block_pricing depends on block_target
  // When block_target changes, block_pricing is affected
  if (edges && edges.length > 0) {
    const nodeId = contentOrNodeId;

    // Build edge lookup - find nodes that have nodeId as their target (they depend on nodeId)
    const dependentNodes = new Set<string>();

    // BFS to find all nodes that transitively depend on nodeId
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find edges where current is the target (nodes that depend on current)
      for (const edge of edges) {
        if (edge.target === current && !visited.has(edge.source)) {
          dependentNodes.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    // Return affected nodes excluding the starting node
    return [...dependentNodes].map((id) => ({ id }));
  }

  // Default: return empty array
  return [];
}

export default {
  calculateSimilarity,
  findSemanticMatches,
  detectConflicts,
  traverseDependencies,
  calculateImpactRadius,
  analyzeCascadeEffects,
  detectCascadingChanges,
  wouldCreateCycle,
  findSupersessionCascade,
};
