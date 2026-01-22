/**
 * useGraphFilters Hook Tests
 * Tests filter functionality for graph visualization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGraphFilters } from "../useGraphFilters";
import type { GraphNode, GraphEdge } from "../../../../types/graph";

// Mock window.location and history for URL sync tests
const mockLocation = {
  pathname: "/test",
  search: "",
  origin: "http://localhost:3000",
};

const mockReplaceState = vi.fn();

beforeEach(() => {
  vi.stubGlobal("location", mockLocation);
  vi.stubGlobal("history", { replaceState: mockReplaceState });
  mockLocation.search = "";
  mockReplaceState.mockClear();
});

describe("useGraphFilters", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "1",
      label: "Problem Node",
      graphMembership: ["problem"],
      blockType: "content",
      status: "active",
      confidence: 0.9,
      content: "Test problem content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "2",
      label: "Solution Node",
      graphMembership: ["solution"],
      blockType: "content",
      status: "active",
      confidence: 0.8,
      content: "Test solution content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "3",
      label: "Market Node",
      graphMembership: ["market"],
      blockType: "content",
      status: "active",
      confidence: 0.7,
      content: "Test market content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "4",
      label: "Multi-Graph Node",
      graphMembership: ["problem", "solution"],
      blockType: "content",
      status: "active",
      confidence: 0.85,
      content: "Test multi-graph content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
    {
      id: "5",
      label: "Risk Assumption",
      graphMembership: ["risk"],
      blockType: "assumption",
      status: "draft",
      confidence: 0.5,
      content: "Test risk assumption",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
  ];

  const mockEdges: GraphEdge[] = [
    {
      id: "edge_1",
      source: "1",
      target: "2",
      linkType: "addresses",
      status: "active",
    },
    {
      id: "edge_2",
      source: "2",
      target: "3",
      linkType: "creates",
      status: "active",
    },
    {
      id: "edge_3",
      source: "4",
      target: "5",
      linkType: "requires",
      status: "active",
    },
  ];

  it("should filter nodes by single graph type", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setGraphFilter(["problem"]);
    });

    expect(result.current.filteredNodes).toHaveLength(2);
    expect(result.current.filteredNodes.map((n) => n.id)).toEqual(["1", "4"]);
  });

  it("should filter nodes by multiple graph types (OR logic)", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setGraphFilter(["problem", "market"]);
    });

    expect(result.current.filteredNodes).toHaveLength(3);
    expect(result.current.filteredNodes.map((n) => n.id)).toEqual([
      "1",
      "3",
      "4",
    ]);
  });

  it("should filter nodes by block type", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setBlockTypeFilter(["assumption"]);
    });

    expect(result.current.filteredNodes).toHaveLength(1);
    expect(result.current.filteredNodes[0].id).toBe("5");
  });

  it("should filter nodes by status", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setStatusFilter(["draft"]);
    });

    expect(result.current.filteredNodes).toHaveLength(1);
    expect(result.current.filteredNodes[0].id).toBe("5");
  });

  it("should filter nodes by confidence range", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setConfidenceRange({ min: 0.8, max: 1.0 });
    });

    expect(result.current.filteredNodes).toHaveLength(3);
    expect(result.current.filteredNodes.map((n) => n.id)).toEqual([
      "1",
      "2",
      "4",
    ]);
  });

  it("should combine multiple filters (AND logic)", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setGraphFilter(["problem"]);
      result.current.setConfidenceRange({ min: 0.85, max: 1.0 });
    });

    expect(result.current.filteredNodes).toHaveLength(2);
    expect(result.current.filteredNodes.map((n) => n.id)).toEqual(["1", "4"]);
  });

  it("should reset all filters", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setGraphFilter(["problem"]);
      result.current.setStatusFilter(["active"]);
      result.current.resetFilters();
    });

    expect(result.current.filteredNodes).toHaveLength(5);
  });

  it("should filter edges based on visible nodes", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    // Initially all edges should be present
    expect(result.current.filteredEdges).toHaveLength(3);

    // Filter to only problem nodes
    act(() => {
      result.current.setGraphFilter(["problem"]);
    });

    // Only edges between problem nodes should remain
    // Nodes 1 and 4 have "problem" membership
    // edge_1 (1->2) should be excluded (2 is not a problem node)
    // edge_2 (2->3) should be excluded (neither are problem nodes)
    // edge_3 (4->5) should be excluded (5 is not a problem node)
    expect(result.current.filteredEdges).toHaveLength(0);
  });

  it("should indicate when filters are active", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setGraphFilter(["problem"]);
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("should return all nodes when no filters are applied", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    expect(result.current.filteredNodes).toHaveLength(5);
    expect(result.current.filteredEdges).toHaveLength(3);
  });

  it("should handle empty nodes array", () => {
    const { result } = renderHook(() => useGraphFilters([], []));

    expect(result.current.filteredNodes).toHaveLength(0);
    expect(result.current.filteredEdges).toHaveLength(0);
  });

  it("should handle nodes without edges", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes));

    expect(result.current.filteredNodes).toHaveLength(5);
    expect(result.current.filteredEdges).toHaveLength(0);
  });

  it("should filter by multiple block types", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setBlockTypeFilter(["content", "assumption"]);
    });

    expect(result.current.filteredNodes).toHaveLength(5);
  });

  it("should filter by multiple statuses", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setStatusFilter(["active", "draft"]);
    });

    expect(result.current.filteredNodes).toHaveLength(5);
  });

  it("should apply confidence range with edge cases", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    // Test exact boundary values
    act(() => {
      result.current.setConfidenceRange({ min: 0.5, max: 0.5 });
    });

    expect(result.current.filteredNodes).toHaveLength(1);
    expect(result.current.filteredNodes[0].id).toBe("5");
  });

  it("should correctly report filter state", () => {
    const { result } = renderHook(() => useGraphFilters(mockNodes, mockEdges));

    act(() => {
      result.current.setGraphFilter(["problem", "solution"]);
      result.current.setBlockTypeFilter(["content"]);
      result.current.setStatusFilter(["active"]);
      result.current.setConfidenceRange({ min: 0.7, max: 0.95 });
    });

    expect(result.current.graphFilter).toEqual(["problem", "solution"]);
    expect(result.current.blockTypeFilter).toEqual(["content"]);
    expect(result.current.statusFilter).toEqual(["active"]);
    expect(result.current.confidenceRange).toEqual({ min: 0.7, max: 0.95 });
  });
});

describe("useGraphFilters URL sync", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "1",
      label: "Test Node",
      graphMembership: ["problem"],
      blockType: "content",
      status: "active",
      confidence: 0.9,
      content: "Test content",
      properties: {},
      createdAt: "2026-01-22T10:00:00Z",
      updatedAt: "2026-01-22T10:00:00Z",
    },
  ];

  it("should generate shareable URL with filters", () => {
    const { result } = renderHook(() =>
      useGraphFilters(mockNodes, [], { syncToUrl: false }),
    );

    act(() => {
      result.current.setGraphFilter(["problem", "solution"]);
      result.current.setConfidenceRange({ min: 0.5, max: 0.9 });
    });

    const url = result.current.getShareableUrl();
    // URL encoding converts comma to %2C
    expect(url).toMatch(/graph=problem(%2C|,)solution/);
    expect(url).toContain("confMin=0.5");
    expect(url).toContain("confMax=0.9");
  });

  it("should generate clean URL when no filters", () => {
    const { result } = renderHook(() =>
      useGraphFilters(mockNodes, [], { syncToUrl: false }),
    );

    const url = result.current.getShareableUrl();
    expect(url).toBe("http://localhost:3000/test");
  });
});
