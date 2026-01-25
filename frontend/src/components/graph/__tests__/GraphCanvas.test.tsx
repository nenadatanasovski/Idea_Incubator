/**
 * GraphCanvas Component Tests
 * Tests for the Memory Graph visualization component
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphCanvas } from "../GraphCanvas";
import type { GraphNode, GraphEdge } from "../../../types/graph";

// Mock Reagraph since it uses WebGL which isn't available in jsdom
vi.mock("reagraph", () => ({
  GraphCanvas: vi.fn(({ nodes, edges }) => (
    <div
      data-testid="reagraph-canvas"
      data-nodes={nodes.length}
      data-edges={edges.length}
    >
      <canvas data-testid="webgl-canvas" />
    </div>
  )),
  useSelection: vi.fn(() => ({
    selections: [],
    actives: [],
    onNodeClick: vi.fn(),
    onCanvasClick: vi.fn(),
  })),
}));

describe("GraphCanvas", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "node_1",
      label: "Problem Block",
      blockType: "content",
      graphMembership: ["problem"],
      status: "active",
      confidence: 0.9,
      content: "Test problem",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "node_2",
      label: "Solution Block",
      blockType: "content",
      graphMembership: ["solution"],
      status: "active",
      confidence: 0.8,
      content: "Test solution",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
  ];

  const mockEdges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "node_2",
      target: "node_1",
      linkType: "addresses",
      status: "active",
    },
  ];

  it("should render without crashing", () => {
    render(
      <GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={vi.fn()} />,
    );

    // Check for graph canvas container
    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });

  it("should render the graph canvas with nodes and edges", () => {
    render(
      <GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={vi.fn()} />,
    );

    // The mocked Reagraph should receive the nodes and edges
    const reagraphCanvas = screen.getByTestId("reagraph-canvas");
    expect(reagraphCanvas).toBeInTheDocument();
    expect(reagraphCanvas.dataset.nodes).toBe("2");
    expect(reagraphCanvas.dataset.edges).toBe("1");
  });

  it("should render WebGL canvas", () => {
    const { container } = render(
      <GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={vi.fn()} />,
    );

    // Verify canvas element is present (mocked)
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should display node and edge count badge", () => {
    render(
      <GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={vi.fn()} />,
    );

    // Check for the count badge
    expect(screen.getByText("2 nodes, 1 edges")).toBeInTheDocument();
  });

  it("should display empty state when no nodes", () => {
    render(<GraphCanvas nodes={[]} edges={[]} onNodeClick={vi.fn()} />);

    expect(screen.getByText("No graph data to display")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start a conversation, then click the lightbulb button at the top left to build the knowledge graph",
      ),
    ).toBeInTheDocument();
  });

  it("should render zoom controls", () => {
    render(
      <GraphCanvas nodes={mockNodes} edges={mockEdges} onNodeClick={vi.fn()} />,
    );

    // Check for zoom control buttons
    expect(screen.getByTitle("Zoom In")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom Out")).toBeInTheDocument();
    expect(screen.getByTitle("Fit to View")).toBeInTheDocument();
    expect(screen.getByTitle("Center Graph")).toBeInTheDocument();
  });

  it("should not call onNodeClick on initial render", () => {
    const handleNodeClick = vi.fn();

    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={handleNodeClick}
      />,
    );

    expect(handleNodeClick).not.toHaveBeenCalled();
  });

  it("should handle different node types", () => {
    const diverseNodes: GraphNode[] = [
      {
        id: "content_1",
        label: "Content Block",
        blockType: "content",
        graphMembership: ["problem"],
        status: "active",
        confidence: 0.9,
        content: "Test content",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
      {
        id: "assumption_1",
        label: "Assumption Block",
        blockType: "assumption",
        graphMembership: ["fit"],
        status: "active",
        confidence: 0.6,
        content: "Test assumption",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
      {
        id: "decision_1",
        label: "Decision Block",
        blockType: "decision",
        graphMembership: ["business"],
        status: "active",
        confidence: 0.75,
        content: "Test decision",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
    ];

    render(
      <GraphCanvas nodes={diverseNodes} edges={[]} onNodeClick={vi.fn()} />,
    );

    // Should render all node types
    const reagraphCanvas = screen.getByTestId("reagraph-canvas");
    expect(reagraphCanvas.dataset.nodes).toBe("3");
  });

  it("should handle nodes with different statuses", () => {
    const statusNodes: GraphNode[] = [
      {
        id: "draft_1",
        label: "Draft Block",
        blockType: "content",
        graphMembership: ["problem"],
        status: "draft",
        confidence: 0.5,
        content: "Draft content",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
      {
        id: "validated_1",
        label: "Validated Block",
        blockType: "content",
        graphMembership: ["market"],
        status: "validated",
        confidence: 0.95,
        content: "Validated content",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
      {
        id: "superseded_1",
        label: "Superseded Block",
        blockType: "content",
        graphMembership: ["solution"],
        status: "superseded",
        confidence: 0.7,
        content: "Superseded content",
        properties: {},
        createdAt: "2026-01-22T10:00:00Z",
        updatedAt: "2026-01-22T10:00:00Z",
      },
    ];

    render(
      <GraphCanvas nodes={statusNodes} edges={[]} onNodeClick={vi.fn()} />,
    );

    // Should render all status types
    const reagraphCanvas = screen.getByTestId("reagraph-canvas");
    expect(reagraphCanvas.dataset.nodes).toBe("3");
  });

  it("should handle different edge types", () => {
    const diverseEdges: GraphEdge[] = [
      {
        id: "edge_addresses",
        source: "node_1",
        target: "node_2",
        linkType: "addresses",
        status: "active",
      },
      {
        id: "edge_blocks",
        source: "node_2",
        target: "node_1",
        linkType: "blocks",
        status: "active",
      },
      {
        id: "edge_evidence",
        source: "node_1",
        target: "node_2",
        linkType: "evidence_for",
        status: "active",
        confidence: 0.85,
      },
    ];

    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={diverseEdges}
        onNodeClick={vi.fn()}
      />,
    );

    // Should render all edge types
    const reagraphCanvas = screen.getByTestId("reagraph-canvas");
    expect(reagraphCanvas.dataset.edges).toBe("3");
  });

  it("should apply custom className", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        className="custom-class"
      />,
    );

    const container = screen.getByTestId("graph-canvas");
    expect(container).toHaveClass("custom-class");
  });

  it("should accept highlightedNodeIds prop", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        highlightedNodeIds={["node_1"]}
      />,
    );

    // Component should render without errors
    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });

  it("should accept multiple highlightedNodeIds", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        highlightedNodeIds={["node_1", "node_2"]}
      />,
    );

    // Component should render without errors with multiple highlighted nodes
    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("reagraph-canvas")).toBeInTheDocument();
  });

  it("should accept layoutType prop with forceDirected", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        layoutType="forceDirected"
      />,
    );

    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });

  it("should accept layoutType prop with hierarchical", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        layoutType="hierarchical"
      />,
    );

    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });

  it("should accept layoutType prop with radial", () => {
    render(
      <GraphCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={vi.fn()}
        layoutType="radial"
      />,
    );

    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });
});
