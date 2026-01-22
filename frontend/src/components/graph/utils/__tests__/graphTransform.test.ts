import { describe, it, expect } from "vitest";
import {
  transformBlocksToNodes,
  transformLinksToEdges,
  // Incremental update functions
  transformSingleBlockToNode,
  transformSingleLinkToEdge,
  addNodeToGraph,
  updateNodeInGraph,
  removeNodeFromGraph,
  addEdgeToGraph,
  removeEdgeFromGraph,
  removeEdgesForNode,
} from "../graphTransform";
import type { GraphNode, GraphEdge } from "../../../../types/graph";

describe("transformBlocksToNodes", () => {
  it("should transform a content block to a graph node", () => {
    const blocks = [
      {
        id: "block_001",
        type: "content",
        content: "Legal tech market is $50B",
        properties: {
          market: "Legal tech",
          market_size: 50000000000,
          confidence: 0.85,
        },
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "block_001",
      label: "Legal tech market is $50B",
      blockType: "content",
      graphMembership: ["market"],
      status: "active",
      confidence: 0.85,
    });
  });

  it("should assign multiple graph memberships", () => {
    const blocks = [
      {
        id: "block_002",
        type: "content",
        content: "AI tool saves lawyers 10 hours",
        properties: {
          solution: "AI tool",
          problem: "Research time waste",
        },
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);

    expect(nodes[0].graphMembership).toContain("solution");
    expect(nodes[0].graphMembership).toContain("problem");
  });

  it("should handle 15 block types correctly", () => {
    const blockTypes = [
      "content",
      "link",
      "meta",
      "synthesis",
      "pattern",
      "decision",
      "option",
      "derived",
      "assumption",
      "cycle",
      "placeholder",
      "stakeholder_view",
      "topic",
      "external",
      "action",
    ];

    // Filter out "link" since those become edges, not nodes
    const nodeBlockTypes = blockTypes.filter((t) => t !== "link");

    nodeBlockTypes.forEach((type) => {
      const blocks = [
        {
          id: `block_${type}`,
          type,
          content: `Test ${type} block`,
          properties: {},
          status: "active",
          created_at: "2026-01-22T10:00:00Z",
          updated_at: "2026-01-22T10:00:00Z",
        },
      ];

      const nodes = transformBlocksToNodes(blocks);
      expect(nodes[0].blockType).toBe(type);
    });
  });

  it("should filter out link blocks from nodes", () => {
    const blocks = [
      {
        id: "block_content",
        type: "content",
        content: "Content block",
        properties: {},
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
      {
        id: "block_link",
        type: "link",
        content: "Link block",
        properties: {
          link_type: "addresses",
          source: "a",
          target: "b",
        },
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].blockType).toBe("content");
  });

  it("should truncate long labels", () => {
    const blocks = [
      {
        id: "block_long",
        type: "content",
        content:
          "This is a very long content that should be truncated because it exceeds the maximum label length",
        properties: {},
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);
    expect(nodes[0].label.length).toBeLessThanOrEqual(50);
    expect(nodes[0].label.endsWith("...")).toBe(true);
  });

  it("should extract confidence from properties", () => {
    const blocks = [
      {
        id: "block_conf",
        type: "content",
        content: "High confidence block",
        properties: {
          confidence: 0.95,
        },
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);
    expect(nodes[0].confidence).toBe(0.95);
  });

  it("should default confidence to 0.5 when not provided", () => {
    const blocks = [
      {
        id: "block_no_conf",
        type: "content",
        content: "No confidence block",
        properties: {},
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);
    expect(nodes[0].confidence).toBe(0.5);
  });

  it("should preserve full content in node.content", () => {
    const longContent =
      "This is a very long content that should be fully preserved in the content field";
    const blocks = [
      {
        id: "block_full",
        type: "content",
        content: longContent,
        properties: {},
        status: "active",
        created_at: "2026-01-22T10:00:00Z",
        updated_at: "2026-01-22T10:00:00Z",
      },
    ];

    const nodes = transformBlocksToNodes(blocks);
    expect(nodes[0].content).toBe(longContent);
  });
});

describe("transformLinksToEdges", () => {
  it("should transform a link block to a graph edge", () => {
    const links = [
      {
        id: "link_001",
        type: "link" as const,
        properties: {
          link_type: "addresses",
          source: "block_solution_001",
          target: "block_problem_001",
          degree: "partial",
          confidence: 0.8,
          reason: "Covers main use case",
          status: "active",
        },
      },
    ];

    const edges = transformLinksToEdges(links);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "link_001",
      source: "block_solution_001",
      target: "block_problem_001",
      linkType: "addresses",
      degree: "partial",
      confidence: 0.8,
      reason: "Covers main use case",
      status: "active",
    });
  });

  it("should handle all 21 link types", () => {
    const linkTypes = [
      "addresses",
      "creates",
      "requires",
      "blocks",
      "unblocks",
      "supersedes",
      "refines",
      "replaces",
      "contradicts",
      "evidence_for",
      "derived_from",
      "implements",
      "implemented_by",
      "alternative_to",
      "synthesizes",
      "instance_of",
      "about",
      "excludes",
      "includes",
      "constrained_by",
      "validates_claim",
    ];

    linkTypes.forEach((linkType) => {
      const links = [
        {
          id: `link_${linkType}`,
          type: "link" as const,
          properties: {
            link_type: linkType,
            source: "block_a",
            target: "block_b",
            status: "active",
          },
        },
      ];

      const edges = transformLinksToEdges(links);
      expect(edges[0].linkType).toBe(linkType);
    });
  });

  it("should handle missing optional properties", () => {
    const links = [
      {
        id: "link_minimal",
        type: "link" as const,
        properties: {
          link_type: "addresses",
          source: "block_a",
          target: "block_b",
        },
      },
    ];

    const edges = transformLinksToEdges(links);
    expect(edges[0]).toMatchObject({
      id: "link_minimal",
      source: "block_a",
      target: "block_b",
      linkType: "addresses",
      status: "active", // default
    });
    expect(edges[0].degree).toBeUndefined();
    expect(edges[0].confidence).toBeUndefined();
    expect(edges[0].reason).toBeUndefined();
  });
});

// =============================================================================
// Incremental Update Functions Tests
// =============================================================================

describe("transformSingleBlockToNode", () => {
  it("should transform a single API block to a GraphNode", () => {
    const block = {
      id: "block_single",
      type: "content",
      content: "Single block test",
      properties: {
        market: "Tech",
        confidence: 0.9,
      },
      status: "active",
      created_at: "2026-01-22T10:00:00Z",
      updated_at: "2026-01-22T10:00:00Z",
    };

    const node = transformSingleBlockToNode(block);

    expect(node).not.toBeNull();
    expect(node).toMatchObject({
      id: "block_single",
      label: "Single block test",
      blockType: "content",
      status: "active",
      confidence: 0.9,
      content: "Single block test",
    });
    expect(node?.graphMembership).toContain("market");
  });

  it("should return null for link type blocks", () => {
    const linkBlock = {
      id: "block_link",
      type: "link",
      content: "Link block",
      properties: {
        link_type: "addresses",
        source: "a",
        target: "b",
      },
      status: "active",
      created_at: "2026-01-22T10:00:00Z",
      updated_at: "2026-01-22T10:00:00Z",
    };

    const node = transformSingleBlockToNode(linkBlock);
    expect(node).toBeNull();
  });

  it("should handle empty/missing properties gracefully", () => {
    const block = {
      id: "block_minimal",
      type: "content",
      content: "",
      properties: {},
      status: "active",
      created_at: "2026-01-22T10:00:00Z",
      updated_at: "2026-01-22T10:00:00Z",
    };

    const node = transformSingleBlockToNode(block);

    expect(node).not.toBeNull();
    expect(node?.confidence).toBe(0.5); // default
    expect(node?.graphMembership).toContain("problem"); // default
  });
});

describe("transformSingleLinkToEdge", () => {
  it("should transform an API link to a GraphEdge", () => {
    const link = {
      id: "link_single",
      type: "link" as const,
      properties: {
        link_type: "addresses",
        source: "block_a",
        target: "block_b",
        degree: "full",
        confidence: 0.95,
        reason: "Full coverage",
        status: "active",
      },
    };

    const edge = transformSingleLinkToEdge(link);

    expect(edge).toMatchObject({
      id: "link_single",
      source: "block_a",
      target: "block_b",
      linkType: "addresses",
      degree: "full",
      confidence: 0.95,
      reason: "Full coverage",
      status: "active",
    });
  });

  it("should handle WebSocket payload format (flat structure)", () => {
    const wsPayload = {
      id: "link_ws",
      link_type: "creates",
      source: "block_x",
      target: "block_y",
      degree: "partial",
      confidence: 0.7,
      reason: "Creates dependency",
    };

    const edge = transformSingleLinkToEdge(wsPayload);

    expect(edge).toMatchObject({
      id: "link_ws",
      source: "block_x",
      target: "block_y",
      linkType: "creates",
      degree: "partial",
      confidence: 0.7,
      reason: "Creates dependency",
    });
  });

  it("should default status to active when not provided", () => {
    const link = {
      id: "link_no_status",
      link_type: "requires",
      source: "a",
      target: "b",
    };

    const edge = transformSingleLinkToEdge(link);
    expect(edge.status).toBe("active");
  });
});

describe("addNodeToGraph", () => {
  const existingNodes: GraphNode[] = [
    {
      id: "node_1",
      label: "Node 1",
      blockType: "content",
      graphMembership: ["problem"],
      status: "active",
      confidence: 0.8,
      content: "Node 1 content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "node_2",
      label: "Node 2",
      blockType: "content",
      graphMembership: ["solution"],
      status: "active",
      confidence: 0.9,
      content: "Node 2 content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
  ];

  it("should add a new node to the array", () => {
    const newNode: GraphNode = {
      id: "node_3",
      label: "Node 3",
      blockType: "meta",
      graphMembership: ["market"],
      status: "active",
      confidence: 0.75,
      content: "Node 3 content",
      properties: {},
      createdAt: "2026-01-22T11:00:00Z",
      updatedAt: "2026-01-22T11:00:00Z",
    };

    const result = addNodeToGraph(existingNodes, newNode);

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual(newNode);
    // Verify immutability
    expect(existingNodes).toHaveLength(2);
  });

  it("should update existing node if id matches", () => {
    const updatedNode: GraphNode = {
      id: "node_1",
      label: "Updated Node 1",
      blockType: "content",
      graphMembership: ["problem", "market"],
      status: "superseded",
      confidence: 0.6,
      content: "Updated content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T12:00:00Z",
    };

    const result = addNodeToGraph(existingNodes, updatedNode);

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("Updated Node 1");
    expect(result[0].status).toBe("superseded");
    // Verify immutability
    expect(existingNodes[0].label).toBe("Node 1");
  });

  it("should return new array (immutable)", () => {
    const newNode: GraphNode = {
      id: "node_new",
      label: "New",
      blockType: "content",
      graphMembership: [],
      status: "active",
      confidence: 0.5,
      content: "",
      properties: {},
      createdAt: "",
      updatedAt: "",
    };

    const result = addNodeToGraph(existingNodes, newNode);

    expect(result).not.toBe(existingNodes);
  });
});

describe("updateNodeInGraph", () => {
  const existingNodes: GraphNode[] = [
    {
      id: "node_1",
      label: "Node 1",
      blockType: "content",
      graphMembership: ["problem"],
      status: "active",
      confidence: 0.8,
      content: "Original content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
  ];

  it("should update specific node properties", () => {
    const result = updateNodeInGraph(existingNodes, "node_1", {
      status: "superseded",
      confidence: 0.3,
    });

    expect(result[0].status).toBe("superseded");
    expect(result[0].confidence).toBe(0.3);
    expect(result[0].label).toBe("Node 1"); // unchanged
    expect(result[0].updatedAt).not.toBe("2026-01-22T10:00:00Z"); // updated
  });

  it("should not modify nodes with different ids", () => {
    const nodesWithMultiple: GraphNode[] = [
      ...existingNodes,
      {
        id: "node_2",
        label: "Node 2",
        blockType: "content",
        graphMembership: ["solution"],
        status: "active",
        confidence: 0.9,
        content: "Node 2",
        properties: {},
        createdAt: "",
        updatedAt: "",
      },
    ];

    const result = updateNodeInGraph(nodesWithMultiple, "node_1", {
      label: "Updated",
    });

    expect(result[0].label).toBe("Updated");
    expect(result[1].label).toBe("Node 2"); // unchanged
  });

  it("should return same array if node not found", () => {
    const result = updateNodeInGraph(existingNodes, "nonexistent", {
      label: "Won't work",
    });

    // Still returns new array (immutability)
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Node 1");
  });
});

describe("removeNodeFromGraph", () => {
  const existingNodes: GraphNode[] = [
    {
      id: "node_1",
      label: "Node 1",
      blockType: "content",
      graphMembership: [],
      status: "active",
      confidence: 0.8,
      content: "",
      properties: {},
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "node_2",
      label: "Node 2",
      blockType: "content",
      graphMembership: [],
      status: "active",
      confidence: 0.9,
      content: "",
      properties: {},
      createdAt: "",
      updatedAt: "",
    },
  ];

  it("should remove node by id", () => {
    const result = removeNodeFromGraph(existingNodes, "node_1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("node_2");
  });

  it("should return same length array if node not found", () => {
    const result = removeNodeFromGraph(existingNodes, "nonexistent");
    expect(result).toHaveLength(2);
  });

  it("should be immutable", () => {
    const result = removeNodeFromGraph(existingNodes, "node_1");
    expect(existingNodes).toHaveLength(2);
    expect(result).not.toBe(existingNodes);
  });
});

describe("addEdgeToGraph", () => {
  const existingEdges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "node_1",
      target: "node_2",
      linkType: "addresses",
      status: "active",
    },
  ];

  it("should add a new edge", () => {
    const newEdge: GraphEdge = {
      id: "edge_2",
      source: "node_2",
      target: "node_3",
      linkType: "creates",
      status: "active",
    };

    const result = addEdgeToGraph(existingEdges, newEdge);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(newEdge);
  });

  it("should update existing edge if id matches", () => {
    const updatedEdge: GraphEdge = {
      id: "edge_1",
      source: "node_1",
      target: "node_2",
      linkType: "supersedes",
      status: "superseded",
    };

    const result = addEdgeToGraph(existingEdges, updatedEdge);

    expect(result).toHaveLength(1);
    expect(result[0].linkType).toBe("supersedes");
    expect(result[0].status).toBe("superseded");
  });
});

describe("removeEdgeFromGraph", () => {
  const existingEdges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "a",
      target: "b",
      linkType: "addresses",
      status: "active",
    },
    {
      id: "edge_2",
      source: "b",
      target: "c",
      linkType: "creates",
      status: "active",
    },
  ];

  it("should remove edge by id", () => {
    const result = removeEdgeFromGraph(existingEdges, "edge_1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("edge_2");
  });

  it("should be immutable", () => {
    const result = removeEdgeFromGraph(existingEdges, "edge_1");
    expect(existingEdges).toHaveLength(2);
    expect(result).not.toBe(existingEdges);
  });
});

describe("removeEdgesForNode", () => {
  const existingEdges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "node_1",
      target: "node_2",
      linkType: "addresses",
      status: "active",
    },
    {
      id: "edge_2",
      source: "node_2",
      target: "node_3",
      linkType: "creates",
      status: "active",
    },
    {
      id: "edge_3",
      source: "node_3",
      target: "node_1",
      linkType: "requires",
      status: "active",
    },
  ];

  it("should remove all edges connected to a node (as source)", () => {
    const result = removeEdgesForNode(existingEdges, "node_1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("edge_2");
  });

  it("should remove edges where node is target", () => {
    const result = removeEdgesForNode(existingEdges, "node_2");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("edge_3");
  });

  it("should remove edges where node is either source or target", () => {
    // node_3 is target of edge_2 and source of edge_3
    const result = removeEdgesForNode(existingEdges, "node_3");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("edge_1");
  });
});
