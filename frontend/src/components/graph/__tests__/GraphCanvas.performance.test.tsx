/**
 * GraphCanvas Performance Tests
 * Tests for large graph rendering performance
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { GraphCanvas } from "../GraphCanvas";
import { generateMockGraph } from "../__mocks__/mockGraphData";

// Mock Reagraph for performance tests
vi.mock("reagraph", () => ({
  GraphCanvas: vi.fn(({ nodes, edges }) => (
    <div
      data-testid="reagraph-canvas"
      data-nodes={nodes.length}
      data-edges={edges.length}
    >
      <canvas />
    </div>
  )),
  useSelection: vi.fn(() => ({
    selections: [],
    actives: [],
    onNodeClick: vi.fn(),
    onCanvasClick: vi.fn(),
  })),
}));

describe("GraphCanvas Performance", () => {
  it("should render 200 nodes within 2 seconds", async () => {
    const { nodes, edges } = generateMockGraph(200, 300);

    const startTime = performance.now();

    render(<GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(2000);
    console.log(`Render time for 200 nodes: ${renderTime.toFixed(2)}ms`);
  });

  it("should render 500 nodes within 5 seconds", async () => {
    const { nodes, edges } = generateMockGraph(500, 750);

    const startTime = performance.now();

    render(<GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(5000);
    console.log(`Render time for 500 nodes: ${renderTime.toFixed(2)}ms`);
  });

  it("should maintain performance with 200 nodes during re-render", async () => {
    const { nodes, edges } = generateMockGraph(200, 300);

    const { rerender } = render(
      <GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />,
    );

    // Measure re-render time
    const startTime = performance.now();

    // Simulate a re-render with updated nodes
    const updatedNodes = nodes.map((node) => ({
      ...node,
      confidence: Math.random(),
    }));

    rerender(
      <GraphCanvas nodes={updatedNodes} edges={edges} onNodeClick={() => {}} />,
    );

    const endTime = performance.now();
    const rerenderTime = endTime - startTime;

    // Re-render should be faster than initial render
    expect(rerenderTime).toBeLessThan(1000);
    console.log(`Re-render time for 200 nodes: ${rerenderTime.toFixed(2)}ms`);
  });

  it("should handle empty to large graph transition", () => {
    const { rerender, container } = render(
      <GraphCanvas nodes={[]} edges={[]} onNodeClick={() => {}} />,
    );

    // Start with empty graph
    expect(container.querySelector("canvas")).not.toBeInTheDocument();

    // Transition to large graph
    const { nodes, edges } = generateMockGraph(200, 300);

    const startTime = performance.now();

    rerender(
      <GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />,
    );

    const endTime = performance.now();
    const transitionTime = endTime - startTime;

    expect(transitionTime).toBeLessThan(2000);
    console.log(
      `Empty to 200 nodes transition time: ${transitionTime.toFixed(2)}ms`,
    );
  });

  it("should efficiently filter nodes", () => {
    const { nodes, edges } = generateMockGraph(500, 750);

    // Initial render
    const { rerender } = render(
      <GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />,
    );

    // Filter to only problem nodes (roughly 1/7 of total)
    const filteredNodes = nodes.filter((node) =>
      node.graphMembership.includes("problem"),
    );
    const filteredEdges = edges.filter(
      (edge) =>
        filteredNodes.some((n) => n.id === edge.source) &&
        filteredNodes.some((n) => n.id === edge.target),
    );

    const startTime = performance.now();

    rerender(
      <GraphCanvas
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodeClick={() => {}}
      />,
    );

    const endTime = performance.now();
    const filterTime = endTime - startTime;

    expect(filterTime).toBeLessThan(500);
    console.log(
      `Filter transition time (${filteredNodes.length} nodes): ${filterTime.toFixed(2)}ms`,
    );
  });

  it("should handle rapid filter changes", async () => {
    const { nodes, edges } = generateMockGraph(200, 300);

    const { rerender } = render(
      <GraphCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />,
    );

    const startTime = performance.now();

    // Simulate 10 rapid filter changes
    for (let i = 0; i < 10; i++) {
      const filteredNodes = nodes.slice(0, Math.floor(Math.random() * 200));
      rerender(
        <GraphCanvas
          nodes={filteredNodes}
          edges={edges}
          onNodeClick={() => {}}
        />,
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / 10;

    expect(avgTime).toBeLessThan(100);
    console.log(
      `Average rapid filter change time: ${avgTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`,
    );
  });
});
