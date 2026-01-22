/**
 * Test Suite 8: Evidence Chain Traversal
 * Tests for evidence chain calculations and confidence propagation
 *
 * @see GRAPH-TAB-VIEW-SPEC.md Test Suite 8
 */

import { describe, it, expect } from "vitest";
import {
  traverseEvidenceChain,
  calculateDerivedConfidence,
  detectInvalidatedSources,
  STRENGTH_MULTIPLIERS,
} from "../evidenceChain";
import type { GraphNode, GraphEdge } from "../../../../types/graph";

// Helper to create mock nodes
function createMockNode(
  overrides: Partial<GraphNode> & { id: string },
): GraphNode {
  return {
    label: overrides.id,
    subLabel: undefined,
    blockType: "content",
    graphMembership: ["problem"],
    status: "active",
    confidence: 0.8,
    createdAt: "2026-01-22T00:00:00Z",
    updatedAt: "2026-01-22T00:00:00Z",
    content: `Content for ${overrides.id}`,
    properties: {},
    ...overrides,
  };
}

// Helper to create mock edges
function createMockEdge(
  source: string,
  target: string,
  linkType: string = "evidence_for",
): GraphEdge {
  return {
    id: `${source}_${target}`,
    source,
    target,
    linkType: linkType as GraphEdge["linkType"],
    status: "active",
  };
}

describe("Evidence Chain Traversal", () => {
  // Test data matching the spec
  const mockNodes: GraphNode[] = [
    createMockNode({
      id: "gartner",
      blockType: "external",
      confidence: 0.9,
      status: "active",
    }),
    createMockNode({
      id: "advisor",
      blockType: "content",
      confidence: 0.7,
      evidenceStrength: "strong",
    }),
    createMockNode({
      id: "claim",
      blockType: "content",
      confidence: 0.8,
      evidenceStrength: "moderate",
    }),
  ];

  const mockEdges: GraphEdge[] = [
    createMockEdge("advisor", "gartner", "evidence_for"),
    createMockEdge("claim", "advisor", "evidence_for"),
  ];

  it("should traverse evidence_for links upward", () => {
    const chain = traverseEvidenceChain("claim", mockNodes, mockEdges);

    expect(chain).toHaveLength(3);
    expect(chain[0].id).toBe("claim");
    expect(chain[1].id).toBe("advisor");
    expect(chain[2].id).toBe("gartner");
  });

  it("should calculate derived_confidence correctly", () => {
    // Chain: claim -> advisor -> gartner
    // Expected: 0.9 (gartner) × 1.0 (strong) × 0.7 (advisor) × 0.7 (moderate) = 0.441
    const derivedConfidence = calculateDerivedConfidence(
      "claim",
      mockNodes,
      mockEdges,
    );

    expect(derivedConfidence).toBeCloseTo(0.441, 2);
  });

  it("should apply evidence strength multipliers correctly", () => {
    // Verify the strength multipliers are as specified
    expect(STRENGTH_MULTIPLIERS.strong).toBe(1.0);
    expect(STRENGTH_MULTIPLIERS.moderate).toBe(0.7);
    expect(STRENGTH_MULTIPLIERS.weak).toBe(0.4);
  });

  it("should flag when source is invalidated", () => {
    const nodesWithInvalidated: GraphNode[] = [
      createMockNode({
        id: "gartner",
        blockType: "external",
        confidence: 0.9,
        status: "abandoned", // Invalidated
        evidenceStatus: "source_invalidated",
      }),
      createMockNode({
        id: "advisor",
        blockType: "content",
        confidence: 0.7,
        evidenceStrength: "strong",
      }),
      createMockNode({
        id: "claim",
        blockType: "content",
        confidence: 0.8,
        evidenceStrength: "moderate",
      }),
    ];

    const affected = detectInvalidatedSources(
      "claim",
      nodesWithInvalidated,
      mockEdges,
    );

    expect(affected).toHaveLength(2); // advisor and claim are affected
    expect(affected.map((n) => n.id)).toContain("claim");
    expect(affected.map((n) => n.id)).toContain("advisor");
  });

  it("should handle superseded sources with 50% confidence reduction", () => {
    const nodesWithSuperseded: GraphNode[] = [
      createMockNode({
        id: "gartner",
        blockType: "external",
        confidence: 0.9,
        status: "superseded",
        evidenceStatus: "source_superseded",
      }),
      createMockNode({
        id: "advisor",
        blockType: "content",
        confidence: 0.7,
        evidenceStrength: "strong",
      }),
      createMockNode({
        id: "claim",
        blockType: "content",
        confidence: 0.8,
        evidenceStrength: "moderate",
      }),
    ];

    const derivedConfidence = calculateDerivedConfidence(
      "claim",
      nodesWithSuperseded,
      mockEdges,
    );

    // Original: 0.441, with superseded reduction: 0.441 * 0.5 = 0.2205
    expect(derivedConfidence).toBeCloseTo(0.2205, 2);
  });

  it("should return zero confidence when source is invalidated", () => {
    const nodesWithInvalidated: GraphNode[] = [
      createMockNode({
        id: "gartner",
        blockType: "external",
        confidence: 0.9,
        status: "abandoned",
        evidenceStatus: "source_invalidated",
      }),
      createMockNode({
        id: "advisor",
        blockType: "content",
        confidence: 0.7,
        evidenceStrength: "strong",
      }),
      createMockNode({
        id: "claim",
        blockType: "content",
        confidence: 0.8,
        evidenceStrength: "moderate",
      }),
    ];

    const derivedConfidence = calculateDerivedConfidence(
      "claim",
      nodesWithInvalidated,
      mockEdges,
    );

    expect(derivedConfidence).toBe(0);
  });

  it("should handle single node without chain", () => {
    const singleNode = [
      createMockNode({
        id: "standalone",
        confidence: 0.75,
      }),
    ];

    const chain = traverseEvidenceChain("standalone", singleNode, []);

    expect(chain).toHaveLength(1);
    expect(chain[0].id).toBe("standalone");
    expect(chain[0].confidence).toBe(0.75);
  });

  it("should handle weak evidence strength", () => {
    const nodesWithWeak: GraphNode[] = [
      createMockNode({
        id: "root",
        confidence: 1.0,
      }),
      createMockNode({
        id: "claim",
        confidence: 0.8,
        evidenceStrength: "weak",
      }),
    ];

    const edgesWithWeak: GraphEdge[] = [
      createMockEdge("claim", "root", "evidence_for"),
    ];

    const derivedConfidence = calculateDerivedConfidence(
      "claim",
      nodesWithWeak,
      edgesWithWeak,
    );

    // For 2-node chain: root.confidence × claim.evidenceStrength
    // = 1.0 (root) × 0.4 (weak) = 0.4
    // Note: start node's own confidence is NOT included in derived calculation
    expect(derivedConfidence).toBeCloseTo(0.4, 2);
  });

  it("should handle long evidence chains", () => {
    const longChainNodes: GraphNode[] = [
      createMockNode({ id: "root", confidence: 1.0 }),
      createMockNode({ id: "n1", confidence: 0.9, evidenceStrength: "strong" }),
      createMockNode({ id: "n2", confidence: 0.9, evidenceStrength: "strong" }),
      createMockNode({ id: "n3", confidence: 0.9, evidenceStrength: "strong" }),
      createMockNode({
        id: "leaf",
        confidence: 0.9,
        evidenceStrength: "strong",
      }),
    ];

    const longChainEdges: GraphEdge[] = [
      createMockEdge("n1", "root", "evidence_for"),
      createMockEdge("n2", "n1", "evidence_for"),
      createMockEdge("n3", "n2", "evidence_for"),
      createMockEdge("leaf", "n3", "evidence_for"),
    ];

    const chain = traverseEvidenceChain("leaf", longChainNodes, longChainEdges);

    expect(chain).toHaveLength(5);
    expect(chain[0].id).toBe("leaf");
    expect(chain[4].id).toBe("root");
  });
});
