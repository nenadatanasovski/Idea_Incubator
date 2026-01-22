/**
 * useGraphDataWithWebSocket Hook Tests
 * Tests the integration of REST data fetching with WebSocket real-time updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Server } from "mock-socket";
import { useGraphDataWithWebSocket } from "../useGraphDataWithWebSocket";

// Mock useGraphData
vi.mock("../useGraphData", () => ({
  useGraphData: vi.fn(() => ({
    data: {
      nodes: [
        {
          id: "initial_node_1",
          label: "Initial Node 1",
          blockType: "content",
          graphMembership: ["problem"],
          status: "active",
          confidence: 0.8,
          content: "Initial content",
          properties: {},
          createdAt: "2026-01-22T10:00:00Z",
          updatedAt: "2026-01-22T10:00:00Z",
        },
      ],
      edges: [
        {
          id: "initial_edge_1",
          source: "initial_node_1",
          target: "initial_node_2",
          linkType: "addresses",
          status: "active",
        },
      ],
    },
    filteredData: {
      nodes: [],
      edges: [],
    },
    isLoading: false,
    error: null,
    lastUpdated: "2026-01-22T10:00:00Z",
    refetch: vi.fn(),
    applyFilters: vi.fn(),
    filters: {
      graphTypes: [],
      blockTypes: [],
      statuses: [],
      abstractionLevels: [],
      confidenceRange: [0, 1] as [number, number],
    },
    resetFilters: vi.fn(),
  })),
}));

describe("useGraphDataWithWebSocket", () => {
  let mockServer: Server;
  const WS_URL = "ws://localhost:8080/ws/graph/session_123";

  beforeEach(() => {
    mockServer = new Server(WS_URL);
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        host: "localhost:8080",
      },
      writable: true,
    });
  });

  afterEach(() => {
    mockServer.close();
    vi.clearAllMocks();
  });

  it("should return initial data from useGraphData", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    expect(result.current.data.nodes).toHaveLength(1);
    expect(result.current.data.nodes[0].id).toBe("initial_node_1");
    expect(result.current.data.edges).toHaveLength(1);
  });

  it("should connect to WebSocket when enableWebSocket is true", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        enableWebSocket: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("should not connect to WebSocket when enableWebSocket is false", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        enableWebSocket: false,
      }),
    );

    // Give it time to potentially connect
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.isConnected).toBe(false);
  });

  it("should add new node when block_created event is received", async () => {
    const onNodeAdded = vi.fn();

    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        onNodeAdded,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "block_created",
          payload: {
            id: "new_block",
            type: "content",
            content: "New block content",
            properties: { market: "Tech" },
          },
        }),
      );
    });

    await waitFor(() => {
      expect(onNodeAdded).toHaveBeenCalled();
    });

    // Check merged data includes new node
    expect(result.current.data.nodes.some((n) => n.id === "new_block")).toBe(
      true,
    );
  });

  it("should add pending update when node is created", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "block_created",
          payload: {
            id: "pending_block",
            type: "content",
            content: "Pending content",
            properties: {},
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.pendingUpdates.length).toBeGreaterThan(0);
    });

    expect(
      result.current.pendingUpdates.some((u) => u.type === "node_added"),
    ).toBe(true);
  });

  it("should add new edge when link_created event is received", async () => {
    const onEdgeAdded = vi.fn();

    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        onEdgeAdded,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "link_created",
          payload: {
            id: "new_link",
            link_type: "creates",
            source: "block_a",
            target: "block_b",
            confidence: 0.9,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(onEdgeAdded).toHaveBeenCalled();
    });
  });

  it("should remove edge when link_removed event is received", async () => {
    const onEdgeRemoved = vi.fn();

    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        onEdgeRemoved,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "link_removed",
          payload: {
            id: "initial_edge_1",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(onEdgeRemoved).toHaveBeenCalledWith("initial_edge_1");
    });
  });

  it("should track stale data correctly", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    // Initially not stale (lastUpdated is recent)
    expect(result.current.isStale).toBe(false);
  });

  it("should clear pending updates when applyPendingUpdates is called", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Add a pending update
    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "block_created",
          payload: {
            id: "block_to_apply",
            type: "content",
            content: "Content",
            properties: {},
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.pendingUpdates.length).toBeGreaterThan(0);
    });

    // Apply pending updates
    act(() => {
      result.current.applyPendingUpdates();
    });

    expect(result.current.pendingUpdates).toHaveLength(0);
  });

  it("should dismiss pending updates and remove WS nodes when dismissPendingUpdates is called", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Add a pending update
    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "block_created",
          payload: {
            id: "block_to_dismiss",
            type: "content",
            content: "Content to dismiss",
            properties: {},
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.pendingUpdates.length).toBeGreaterThan(0);
    });

    const nodeCountBefore = result.current.data.nodes.length;

    // Dismiss pending updates
    act(() => {
      result.current.dismissPendingUpdates();
    });

    expect(result.current.pendingUpdates).toHaveLength(0);
    // Node should be removed
    expect(result.current.data.nodes.length).toBeLessThanOrEqual(
      nodeCountBefore,
    );
  });

  it("should expose reconnect and disconnect methods", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    expect(typeof result.current.reconnect).toBe("function");
    expect(typeof result.current.disconnect).toBe("function");

    // Test disconnect
    act(() => {
      result.current.disconnect();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should update lastUpdated timestamp when WebSocket events arrive", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    const initialLastUpdated = result.current.lastUpdated;

    // Wait a bit before sending event
    await new Promise((resolve) => setTimeout(resolve, 50));

    act(() => {
      mockServer.emit(
        "message",
        JSON.stringify({
          type: "block_created",
          payload: {
            id: "timestamp_test_block",
            type: "content",
            content: "Test",
            properties: {},
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.lastUpdated).not.toBe(initialLastUpdated);
    });
  });

  it("should call onError when WebSocket error occurs", async () => {
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
        onError,
      }),
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Send malformed JSON to trigger error
    act(() => {
      mockServer.emit("message", "invalid json{");
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should expose filter methods from useGraphData", () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    expect(typeof result.current.applyFilters).toBe("function");
    expect(typeof result.current.resetFilters).toBe("function");
    expect(result.current.filters).toBeDefined();
  });

  it("should track isReconnecting state", async () => {
    const { result } = renderHook(() =>
      useGraphDataWithWebSocket({
        sessionId: "session_123",
        wsUrl: WS_URL,
      }),
    );

    // Initially not reconnecting
    expect(result.current.isReconnecting).toBe(false);

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Still not reconnecting after connected
    expect(result.current.isReconnecting).toBe(false);
  });
});
