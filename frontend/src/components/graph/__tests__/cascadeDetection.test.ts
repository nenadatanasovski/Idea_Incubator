/**
 * Cascade Detection Utility Tests
 * @see GRAPH-TAB-VIEW-SPEC.md Test Suite 10
 */

import { describe, it, expect } from "vitest";
import {
  detectCascadingChanges,
  calculateSimilarity,
  findSemanticMatches,
  traverseDependencies,
  calculateImpactRadius,
  analyzeCascadeEffects,
  wouldCreateCycle,
} from "../utils/cascadeDetection";
import type { GraphNode, GraphEdge, GraphType } from "../../../types/graph";

describe("detectCascadingChanges", () => {
  it("should detect semantically similar nodes", () => {
    const newContent = "We're targeting enterprise now";
    const existingNodes = [
      { id: "1", content: "Target: SMB customers", similarity: 0.75 },
      { id: "2", content: "Pricing model", similarity: 0.3 },
    ];

    const affected = detectCascadingChanges(newContent, existingNodes, 0.7);

    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe("1");
  });

  it("should detect dependency chain impacts", () => {
    const modifiedNodeId = "block_target";
    const edges: GraphEdge[] = [
      {
        id: "e1",
        source: "block_pricing",
        target: "block_target",
        linkType: "derived_from",
        status: "active",
      },
      {
        id: "e2",
        source: "block_sales",
        target: "block_pricing",
        linkType: "derived_from",
        status: "active",
      },
    ];

    const impacted = detectCascadingChanges(modifiedNodeId, [], 0.7, edges);

    expect(impacted.map((n) => n.id)).toContain("block_pricing");
    expect(impacted.map((n) => n.id)).toContain("block_sales");
  });

  it("should return empty array when no nodes match threshold", () => {
    const existingNodes = [
      { id: "1", content: "Target: SMB customers", similarity: 0.5 },
      { id: "2", content: "Pricing model", similarity: 0.3 },
    ];

    const affected = detectCascadingChanges("content", existingNodes, 0.7);

    expect(affected).toHaveLength(0);
  });

  it("should return empty array when no edges provided for dependency mode", () => {
    const affected = detectCascadingChanges("node_id", [], 0.7);
    expect(affected).toHaveLength(0);
  });
});

describe("calculateSimilarity", () => {
  it("should return 0 for empty strings", () => {
    expect(calculateSimilarity("", "")).toBe(0);
    expect(calculateSimilarity("hello", "")).toBe(0);
    expect(calculateSimilarity("", "world")).toBe(0);
  });

  it("should return 1 for identical strings", () => {
    expect(calculateSimilarity("hello world", "hello world")).toBe(1);
  });

  it("should return high similarity for similar strings", () => {
    const sim = calculateSimilarity(
      "targeting enterprise customers",
      "targeting enterprise clients",
    );
    // Jaccard similarity for these strings: intersection / union
    // intersection: {targeting, enterprise}
    // union: {targeting, enterprise, customers, clients}
    // similarity: 2/4 = 0.5
    expect(sim).toBeGreaterThanOrEqual(0.5);
  });

  it("should return low similarity for different strings", () => {
    const sim = calculateSimilarity(
      "targeting enterprise customers",
      "pricing model strategy",
    );
    expect(sim).toBeLessThan(0.3);
  });
});

describe("findSemanticMatches", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "1",
      content: "Target: SMB customers",
      label: "SMB Target",
      blockType: "content",
      graphMembership: ["market"],
      confidence: 0.8,
      status: "active",
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      content: "Enterprise pricing model",
      label: "Pricing",
      blockType: "content",
      graphMembership: ["market"],
      confidence: 0.9,
      status: "active",
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("should find nodes with similar content", () => {
    // Use a lower threshold since Jaccard similarity can be low for short phrases
    const matches = findSemanticMatches(
      "Target SMB customers now",
      mockNodes,
      0.2,
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].nodeId).toBe("1");
  });

  it("should return empty array when no matches above threshold", () => {
    const matches = findSemanticMatches(
      "completely unrelated topic",
      mockNodes,
      0.9,
    );
    expect(matches).toHaveLength(0);
  });

  it("should sort matches by similarity descending", () => {
    const matches = findSemanticMatches("SMB customer pricing", mockNodes, 0.2);
    if (matches.length >= 2) {
      expect(matches[0].similarity).toBeGreaterThanOrEqual(
        matches[1].similarity,
      );
    }
  });
});

describe("traverseDependencies", () => {
  // Edges: A -> B -> C -> D (A is derived from B, B requires C, C blocks D)
  const mockEdges: GraphEdge[] = [
    { id: "e1", source: "A", target: "B", linkType: "derived_from", status: "active" },
    { id: "e2", source: "B", target: "C", linkType: "requires", status: "active" },
    { id: "e3", source: "C", target: "D", linkType: "blocks", status: "active" },
  ];

  it("should traverse downstream dependencies (following outgoing edges)", () => {
    // Starting from B, downstream follows B -> C -> D
    const result = traverseDependencies("B", [], mockEdges, {
      direction: "downstream",
    });

    expect(result.has("B")).toBe(true);
    expect(result.has("C")).toBe(true); // B -> C
    expect(result.has("D")).toBe(true); // C -> D
  });

  it("should traverse upstream dependencies (following incoming edges)", () => {
    // Starting from B, upstream follows edges pointing to B: A -> B
    const result = traverseDependencies("B", [], mockEdges, {
      direction: "upstream",
    });

    expect(result.has("B")).toBe(true);
    expect(result.has("A")).toBe(true); // A -> B (A depends on B)
  });

  it("should respect maxHops limit", () => {
    const result = traverseDependencies("B", [], mockEdges, {
      maxHops: 1,
      direction: "both",
    });

    // Should only include immediate neighbors (1 hop)
    expect(result.get("B")).toBe(0);
    expect(result.has("A")).toBe(true); // 1 hop upstream
    expect(result.has("C")).toBe(true); // 1 hop downstream
    // D is 2 hops from B via C, should not be included with maxHops: 1
    expect(result.has("D")).toBe(false);
  });
});

describe("calculateImpactRadius", () => {
  const mockEdges: GraphEdge[] = [
    { id: "e1", source: "A", target: "center", linkType: "derived_from", status: "active" },
    { id: "e2", source: "B", target: "A", linkType: "derived_from", status: "active" },
    { id: "e3", source: "C", target: "B", linkType: "derived_from", status: "active" },
  ];

  it("should calculate maximum hop distance", () => {
    const radius = calculateImpactRadius("center", [], mockEdges, 3);
    expect(radius).toBeGreaterThanOrEqual(1);
  });

  it("should return 0 for isolated nodes", () => {
    const radius = calculateImpactRadius("isolated", [], [], 3);
    expect(radius).toBe(0);
  });
});

describe("wouldCreateCycle", () => {
  const mockEdges: GraphEdge[] = [
    { id: "e1", source: "A", target: "B", linkType: "derived_from", status: "active" },
    { id: "e2", source: "B", target: "C", linkType: "derived_from", status: "active" },
  ];

  it("should detect when adding edge would create cycle", () => {
    // Adding C -> A would create A -> B -> C -> A cycle
    const wouldCycle = wouldCreateCycle("C", "A", mockEdges);
    expect(wouldCycle).toBe(true);
  });

  it("should return false when no cycle would be created", () => {
    // Adding D -> A would not create a cycle
    const wouldCycle = wouldCreateCycle("D", "A", mockEdges);
    expect(wouldCycle).toBe(false);
  });
});

describe("analyzeCascadeEffects", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "block_smb",
      content: "Target: SMB customers",
      label: "SMB Target",
      blockType: "content",
      graphMembership: ["market"],
      confidence: 0.8,
      status: "active",
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "block_pricing",
      content: "SMB pricing: $29/month",
      label: "Pricing",
      blockType: "content",
      graphMembership: ["market"],
      confidence: 0.9,
      status: "active",
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockEdges: GraphEdge[] = [
    {
      id: "e1",
      source: "block_pricing",
      target: "block_smb",
      linkType: "derived_from",
      status: "active",
    },
  ];

  it("should analyze cascade effects for new node", () => {
    const newNode = {
      id: "new_block",
      content: "We are now targeting enterprise customers",
      blockType: "content" as const,
      graphMembership: ["market"] as GraphType[],
      confidence: 0.85,
    };

    const result = analyzeCascadeEffects(newNode, mockNodes, mockEdges, {
      similarityThreshold: 0.3,
    });

    expect(result).toHaveProperty("affectedNodes");
    expect(result).toHaveProperty("newLinks");
    expect(result).toHaveProperty("conflicts");
    expect(result).toHaveProperty("impactRadius");
  });

  it("should filter out superseded nodes by default", () => {
    const supersededNodes: GraphNode[] = [
      {
        ...mockNodes[0],
        status: "superseded",
      },
    ];

    const newNode = {
      id: "new_block",
      content: "Target: SMB customers updated",
      blockType: "content" as const,
    };

    const result = analyzeCascadeEffects(newNode, supersededNodes, [], {
      includeSuperseded: false,
    });

    // Should not include superseded nodes in affected
    const affectedIds = result.affectedNodes.map((n) => n.id);
    expect(affectedIds).not.toContain("block_smb");
  });
});
