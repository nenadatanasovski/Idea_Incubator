/**
 * Mock Graph Data Generator for Testing
 */

import type {
  GraphNode,
  GraphEdge,
  BlockType,
  GraphType,
  BlockStatus,
  LinkType,
} from "../../../types/graph";

const BLOCK_TYPES: BlockType[] = [
  "content",
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

const GRAPH_TYPES: GraphType[] = [
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
];

const LINK_TYPES: LinkType[] = [
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

const STATUSES: BlockStatus[] = [
  "draft",
  "active",
  "validated",
  "superseded",
  "abandoned",
];

/**
 * Generate a random item from an array
 */
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate a random node
 */
function generateMockNode(index: number): GraphNode {
  const blockType = randomItem(BLOCK_TYPES);
  const graphMembership = [randomItem(GRAPH_TYPES)];

  // Sometimes add a second graph membership
  if (Math.random() > 0.7) {
    const second = randomItem(
      GRAPH_TYPES.filter((g) => g !== graphMembership[0]),
    );
    graphMembership.push(second);
  }

  return {
    id: `node_${index}`,
    label: `Test Node ${index}`,
    blockType,
    graphMembership,
    status: randomItem(STATUSES),
    confidence: randomBetween(0.3, 1.0),
    content: `This is the full content for test node ${index}. It contains detailed information about the concept.`,
    properties: {
      testProperty: `value_${index}`,
      numericProperty: index * 10,
    },
    createdAt: new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a random edge between two nodes
 */
function generateMockEdge(
  index: number,
  sourceId: string,
  targetId: string,
): GraphEdge {
  return {
    id: `edge_${index}`,
    source: sourceId,
    target: targetId,
    linkType: randomItem(LINK_TYPES),
    status: "active",
    confidence: Math.random() > 0.3 ? randomBetween(0.5, 1.0) : undefined,
    degree:
      Math.random() > 0.5
        ? randomItem(["full", "partial", "minimal"] as const)
        : undefined,
  };
}

/**
 * Generate a mock graph with specified number of nodes and edges
 */
export function generateMockGraph(
  nodeCount: number,
  edgeCount: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(generateMockNode(i));
  }

  // Generate edges (ensuring valid source/target)
  for (let i = 0; i < edgeCount && nodeCount > 1; i++) {
    const sourceIndex = Math.floor(Math.random() * nodeCount);
    let targetIndex = Math.floor(Math.random() * nodeCount);

    // Ensure source and target are different
    while (targetIndex === sourceIndex) {
      targetIndex = Math.floor(Math.random() * nodeCount);
    }

    edges.push(
      generateMockEdge(i, nodes[sourceIndex].id, nodes[targetIndex].id),
    );
  }

  return { nodes, edges };
}

/**
 * Generate sample data that represents a realistic ideation graph
 */
export function generateSampleIdeationGraph(): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes: GraphNode[] = [
    {
      id: "problem_1",
      label: "Legal research takes too long",
      blockType: "content",
      graphMembership: ["problem"],
      status: "active",
      confidence: 0.9,
      content:
        "Lawyers spend 30% of their time on legal research, significantly reducing billable hours.",
      properties: { timeWasted: "30%", painLevel: "high" },
      createdAt: "2026-01-20T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "solution_1",
      label: "AI-powered legal research assistant",
      blockType: "content",
      graphMembership: ["solution"],
      status: "active",
      confidence: 0.85,
      content:
        "An AI tool that can search case law and summarize relevant findings in minutes.",
      properties: { targetReduction: "80%", complexity: "high" },
      createdAt: "2026-01-20T11:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "market_1",
      label: "Legal tech market is $50B",
      blockType: "content",
      graphMembership: ["market"],
      status: "validated",
      confidence: 0.85,
      content:
        "The legal tech market has grown to $50B TAM with 15% YoY growth.",
      properties: {
        market_size: 50000000000,
        growth: "15%",
        source: "Gartner 2025",
      },
      createdAt: "2026-01-21T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
      sourceType: "research_firm",
      sourceName: "Gartner 2025",
    },
    {
      id: "risk_1",
      label: "Competition from big tech",
      blockType: "content",
      graphMembership: ["risk"],
      status: "active",
      confidence: 0.7,
      content:
        "Microsoft and Google are both developing AI legal tools as part of their enterprise offerings.",
      properties: { competitors: ["Microsoft", "Google"], severity: "high" },
      createdAt: "2026-01-21T14:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "assumption_1",
      label: "Lawyers will trust AI suggestions",
      blockType: "assumption",
      graphMembership: ["fit"],
      status: "active",
      confidence: 0.6,
      content:
        "We assume that lawyers will be willing to rely on AI-generated research summaries.",
      properties: { criticality: "critical", surfacedBy: "ai" },
      createdAt: "2026-01-22T09:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
      assumptionStatus: "unvalidated",
      criticality: "critical",
      surfacedBy: "ai",
    },
    {
      id: "decision_1",
      label: "Pricing model decision",
      blockType: "decision",
      graphMembership: ["business"],
      status: "active",
      confidence: 0.75,
      content:
        "Deciding between per-seat licensing vs. usage-based pricing for the product.",
      properties: { topic: "pricing", options: ["per-seat", "usage-based"] },
      createdAt: "2026-01-22T08:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
      topic: "pricing_model",
    },
  ];

  const edges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "solution_1",
      target: "problem_1",
      linkType: "addresses",
      status: "active",
      degree: "partial",
      confidence: 0.8,
      reason: "Addresses the core research time problem",
    },
    {
      id: "edge_2",
      source: "risk_1",
      target: "solution_1",
      linkType: "blocks",
      status: "active",
      confidence: 0.6,
      reason: "Competition could prevent market entry",
    },
    {
      id: "edge_3",
      source: "market_1",
      target: "solution_1",
      linkType: "evidence_for",
      status: "active",
      confidence: 0.85,
      reason: "Large market validates opportunity",
    },
    {
      id: "edge_4",
      source: "assumption_1",
      target: "solution_1",
      linkType: "constrained_by",
      status: "active",
      confidence: 0.7,
      reason: "Solution viability depends on this assumption",
    },
  ];

  return { nodes, edges };
}

export default generateMockGraph;
