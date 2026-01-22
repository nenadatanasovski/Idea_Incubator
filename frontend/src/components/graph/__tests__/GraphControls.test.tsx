/**
 * GraphControls Component Tests
 * Phase 4: Real-Time Updates UI Tests - Manual Refresh (T4.4.1-T4.4.3)
 *
 * Test Coverage:
 * - T4.4.1: Refresh Button
 * - T4.4.2: Last Updated Timestamp
 * - T4.4.3: Stale Indicator
 * - Connection status indicators (T4.1.1 already passed)
 * - Reconnecting indicator (T4.1.2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphControls } from "../GraphControls";

describe("GraphControls", () => {
  describe("T4.4.1: Refresh Button", () => {
    it("should render refresh button when onRefresh is provided", () => {
      const onRefresh = vi.fn();
      render(<GraphControls onRefresh={onRefresh} />);

      const refreshButton = screen.getByTitle("Refresh graph");
      expect(refreshButton).toBeInTheDocument();
    });

    it("should not render refresh button when onRefresh is not provided", () => {
      render(<GraphControls />);

      expect(screen.queryByTitle("Refresh graph")).not.toBeInTheDocument();
    });

    it("should call onRefresh when refresh button is clicked", () => {
      const onRefresh = vi.fn();
      render(<GraphControls onRefresh={onRefresh} />);

      const refreshButton = screen.getByTitle("Refresh graph");
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("should show loading indicator when isRefreshing is true", () => {
      const onRefresh = vi.fn();
      render(<GraphControls onRefresh={onRefresh} isRefreshing={true} />);

      const refreshButton = screen.getByTitle("Refresh graph");
      // Button should have animate-spin class on the SVG
      const svg = refreshButton.querySelector("svg");
      expect(svg).toHaveClass("animate-spin");
    });

    it("should disable refresh button when isRefreshing is true", () => {
      const onRefresh = vi.fn();
      render(<GraphControls onRefresh={onRefresh} isRefreshing={true} />);

      const refreshButton = screen.getByTitle("Refresh graph");
      expect(refreshButton).toBeDisabled();
    });

    it("should not call onRefresh when button is disabled during refresh", () => {
      const onRefresh = vi.fn();
      render(<GraphControls onRefresh={onRefresh} isRefreshing={true} />);

      const refreshButton = screen.getByTitle("Refresh graph");
      fireEvent.click(refreshButton);

      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe("T4.4.2: Last Updated Timestamp", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should display 'Just now' for recent timestamps", () => {
      const now = new Date("2026-01-22T10:00:00Z");
      vi.setSystemTime(now);

      const recentTimestamp = new Date("2026-01-22T09:59:45Z").toISOString();
      render(<GraphControls lastUpdated={recentTimestamp} />);

      expect(screen.getByText("Just now")).toBeInTheDocument();
    });

    it("should display minutes ago for timestamps within the hour", () => {
      const now = new Date("2026-01-22T10:00:00Z");
      vi.setSystemTime(now);

      const fiveMinutesAgo = new Date("2026-01-22T09:55:00Z").toISOString();
      render(<GraphControls lastUpdated={fiveMinutesAgo} />);

      expect(screen.getByText("5m ago")).toBeInTheDocument();
    });

    it("should display hours ago for timestamps within the day", () => {
      const now = new Date("2026-01-22T10:00:00Z");
      vi.setSystemTime(now);

      const twoHoursAgo = new Date("2026-01-22T08:00:00Z").toISOString();
      render(<GraphControls lastUpdated={twoHoursAgo} />);

      expect(screen.getByText("2h ago")).toBeInTheDocument();
    });

    it("should display date for timestamps older than 24 hours", () => {
      const now = new Date("2026-01-22T10:00:00Z");
      vi.setSystemTime(now);

      const yesterday = new Date("2026-01-20T10:00:00Z").toISOString();
      render(<GraphControls lastUpdated={yesterday} />);

      // Should show a formatted date
      const timestamp = screen.getByText(/\d+\/\d+\/\d+/);
      expect(timestamp).toBeInTheDocument();
    });

    it("should not display timestamp when lastUpdated is not provided", () => {
      render(<GraphControls />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
      expect(screen.queryByText("Just now")).not.toBeInTheDocument();
    });

    it("should not display timestamp when lastUpdated is null", () => {
      render(<GraphControls lastUpdated={null} />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });
  });

  describe("T4.4.3: Stale Indicator", () => {
    it("should show stale indicator when isStale is true", () => {
      render(<GraphControls isStale={true} />);

      expect(screen.getByText("Stale")).toBeInTheDocument();
    });

    it("should not show stale indicator when isStale is false", () => {
      render(<GraphControls isStale={false} />);

      expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    });

    it("should not show stale indicator by default", () => {
      render(<GraphControls />);

      expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    });

    it("should show stale indicator with amber/warning styling", () => {
      render(<GraphControls isStale={true} />);

      const staleIndicator = screen.getByText("Stale").closest("div");
      expect(staleIndicator).toHaveClass("bg-amber-100");
    });
  });

  describe("T4.1.1: Connection Indicator (Live badge)", () => {
    it("should show 'Live' when isConnected is true", () => {
      render(<GraphControls isConnected={true} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("should show green indicator when connected", () => {
      render(<GraphControls isConnected={true} />);

      const indicator = screen.getByText("Live").previousSibling;
      expect(indicator).toHaveClass("bg-green-500");
    });

    it("should show 'Offline' when isConnected is false", () => {
      render(<GraphControls isConnected={false} />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("should show red indicator when disconnected", () => {
      render(<GraphControls isConnected={false} />);

      const indicator = screen.getByText("Offline").previousSibling;
      expect(indicator).toHaveClass("bg-red-500");
    });

    it("should not show connection status when isConnected is undefined", () => {
      render(<GraphControls />);

      expect(screen.queryByText("Live")).not.toBeInTheDocument();
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });
  });

  describe("T4.1.2: Reconnecting Indicator", () => {
    it("should show 'Reconnecting...' when isReconnecting is true", () => {
      render(<GraphControls isConnected={false} isReconnecting={true} />);

      expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    });

    it("should show yellow pulsing indicator when reconnecting", () => {
      render(<GraphControls isConnected={false} isReconnecting={true} />);

      const indicator = screen.getByText("Reconnecting...").previousSibling;
      expect(indicator).toHaveClass("bg-yellow-500");
      expect(indicator).toHaveClass("animate-pulse");
    });

    it("should prioritize reconnecting state over offline", () => {
      render(<GraphControls isConnected={false} isReconnecting={true} />);

      expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    it("should show Live after successful reconnection", () => {
      const { rerender } = render(
        <GraphControls isConnected={false} isReconnecting={true} />,
      );

      expect(screen.getByText("Reconnecting...")).toBeInTheDocument();

      // Simulate successful reconnection
      rerender(<GraphControls isConnected={true} isReconnecting={false} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.queryByText("Reconnecting...")).not.toBeInTheDocument();
    });
  });

  describe("Zoom Controls", () => {
    it("should render zoom controls when callbacks are provided", () => {
      const onZoomIn = vi.fn();
      const onZoomOut = vi.fn();
      const onZoomReset = vi.fn();

      render(
        <GraphControls
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
        />,
      );

      expect(screen.getByTitle("Zoom in")).toBeInTheDocument();
      expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
      expect(screen.getByTitle("Reset zoom")).toBeInTheDocument();
    });

    it("should call onZoomIn when zoom in button is clicked", () => {
      const onZoomIn = vi.fn();
      render(<GraphControls onZoomIn={onZoomIn} />);

      fireEvent.click(screen.getByTitle("Zoom in"));
      expect(onZoomIn).toHaveBeenCalledTimes(1);
    });

    it("should call onZoomOut when zoom out button is clicked", () => {
      const onZoomOut = vi.fn();
      render(<GraphControls onZoomOut={onZoomOut} />);

      fireEvent.click(screen.getByTitle("Zoom out"));
      expect(onZoomOut).toHaveBeenCalledTimes(1);
    });

    it("should hide zoom controls when showZoomControls is false", () => {
      const onZoomIn = vi.fn();
      render(<GraphControls onZoomIn={onZoomIn} showZoomControls={false} />);

      expect(screen.queryByTitle("Zoom in")).not.toBeInTheDocument();
    });
  });

  describe("Layout Controls", () => {
    it("should render layout dropdown when onLayoutChange is provided", () => {
      const onLayoutChange = vi.fn();
      render(<GraphControls onLayoutChange={onLayoutChange} />);

      expect(screen.getByText("Force 2D")).toBeInTheDocument();
    });

    it("should show current layout label", () => {
      const onLayoutChange = vi.fn();
      render(
        <GraphControls
          onLayoutChange={onLayoutChange}
          currentLayout="radialOut2d"
        />,
      );

      expect(screen.getByText("Radial")).toBeInTheDocument();
    });

    it("should open layout dropdown on click", () => {
      const onLayoutChange = vi.fn();
      render(<GraphControls onLayoutChange={onLayoutChange} />);

      // Click the dropdown trigger
      fireEvent.click(screen.getByText("Force 2D"));

      // Should show all layout options
      expect(screen.getByText("Tree (Top-Down)")).toBeInTheDocument();
      expect(screen.getByText("Tree (Left-Right)")).toBeInTheDocument();
      expect(screen.getByText("Radial")).toBeInTheDocument();
      expect(screen.getByText("Circular")).toBeInTheDocument();
    });

    it("should call onLayoutChange when a layout is selected", () => {
      const onLayoutChange = vi.fn();
      render(<GraphControls onLayoutChange={onLayoutChange} />);

      // Open dropdown
      fireEvent.click(screen.getByText("Force 2D"));
      // Select radial layout
      fireEvent.click(screen.getByText("Radial"));

      expect(onLayoutChange).toHaveBeenCalledWith("radialOut2d");
    });

    it("should hide layout controls when showLayoutControls is false", () => {
      const onLayoutChange = vi.fn();
      render(
        <GraphControls
          onLayoutChange={onLayoutChange}
          showLayoutControls={false}
        />,
      );

      expect(screen.queryByText("Force 2D")).not.toBeInTheDocument();
    });
  });

  describe("Connection Status Visibility", () => {
    it("should hide connection status when showConnectionStatus is false", () => {
      render(<GraphControls isConnected={true} showConnectionStatus={false} />);

      expect(screen.queryByText("Live")).not.toBeInTheDocument();
    });

    it("should show connection status by default when isConnected is provided", () => {
      render(<GraphControls isConnected={true} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render with data-testid", () => {
      render(<GraphControls />);

      expect(screen.getByTestId("graph-controls")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<GraphControls className="custom-class" />);

      const controls = screen.getByTestId("graph-controls");
      expect(controls).toHaveClass("custom-class");
    });

    it("should render with proper styling", () => {
      render(<GraphControls />);

      const controls = screen.getByTestId("graph-controls");
      expect(controls).toHaveClass("bg-white");
      expect(controls).toHaveClass("border");
      expect(controls).toHaveClass("rounded-lg");
    });
  });
});
