/**
 * Tests for ObservabilityHeader component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ObservabilityHeader from "../ObservabilityHeader";

// Mock fetch for ObservabilitySearch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("ObservabilityHeader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { results: [], total: 0, limit: 10, offset: 0 },
          }),
      });
    });
  });

  describe("Title", () => {
    it("displays Observability title", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      expect(screen.getByText("Observability")).toBeInTheDocument();
    });

    it("displays activity icon", () => {
      const { container } = renderWithRouter(
        <ObservabilityHeader connectionStatus="connected" />,
      );

      expect(container.querySelector(".text-blue-600")).toBeInTheDocument();
    });
  });

  describe("Connection status", () => {
    it("shows connected status with green indicator", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(document.querySelector(".bg-green-500")).toBeInTheDocument();
    });

    it("shows reconnecting status with yellow indicator", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="reconnecting" />);

      expect(screen.getByText("Reconnecting")).toBeInTheDocument();
      expect(document.querySelector(".bg-yellow-500")).toBeInTheDocument();
    });

    it("shows offline status with red indicator", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="offline" />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(document.querySelector(".bg-red-500")).toBeInTheDocument();
    });

    it("has accessibility label for connection status", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      expect(
        screen.getByRole("status", { name: /Connection status: Live/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Refresh button", () => {
    it("renders refresh button", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      expect(
        screen.getByRole("button", { name: /Refresh data/i }),
      ).toBeInTheDocument();
    });

    it("calls onRefresh when clicked", async () => {
      const handleRefresh = vi.fn();
      renderWithRouter(
        <ObservabilityHeader
          connectionStatus="connected"
          onRefresh={handleRefresh}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Refresh data/i }));

      expect(handleRefresh).toHaveBeenCalled();
    });

    it("shows spinning animation while refreshing", async () => {
      const handleRefresh = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      renderWithRouter(
        <ObservabilityHeader
          connectionStatus="connected"
          onRefresh={handleRefresh}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Refresh data/i }));

      // Should show spinning animation
      await waitFor(() => {
        expect(document.querySelector(".animate-spin")).toBeInTheDocument();
      });
    });

    it("disables button while refreshing", async () => {
      const handleRefresh = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      renderWithRouter(
        <ObservabilityHeader
          connectionStatus="connected"
          onRefresh={handleRefresh}
        />,
      );

      const button = screen.getByRole("button", { name: /Refresh data/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Refreshing data/i }),
        ).toBeDisabled();
      });
    });

    it("does not call anything if onRefresh is not provided", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      const button = screen.getByRole("button", { name: /Refresh data/i });
      fireEvent.click(button);

      // Should not throw error
    });
  });

  describe("Search", () => {
    it("renders search input", () => {
      renderWithRouter(<ObservabilityHeader connectionStatus="connected" />);

      expect(
        screen.getByPlaceholderText("Search observability..."),
      ).toBeInTheDocument();
    });
  });

  describe("Layout", () => {
    it("has flex layout for header", () => {
      const { container } = renderWithRouter(
        <ObservabilityHeader connectionStatus="connected" />,
      );

      const header = container.firstChild;
      expect(header).toHaveClass("flex");
      expect(header).toHaveClass("items-center");
      expect(header).toHaveClass("justify-between");
    });
  });
});
