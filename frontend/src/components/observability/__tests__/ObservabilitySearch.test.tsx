/**
 * Tests for ObservabilitySearch component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ObservabilitySearch from "../ObservabilitySearch";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ObservabilitySearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              results: [
                {
                  id: "exec-1",
                  type: "execution",
                  title: "Build Task #42",
                  subtitle: "TypeScript compilation",
                  timestamp: new Date().toISOString(),
                  href: "/observability/executions/exec-1",
                },
                {
                  id: "event-1",
                  type: "event",
                  title: "Task Started",
                  subtitle: "Build agent started task",
                  timestamp: new Date().toISOString(),
                  href: "/observability/events?id=event-1",
                },
              ],
              total: 2,
              limit: 20,
              offset: 0,
              hasMore: false,
            },
          }),
      }),
    );
  });

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <ObservabilitySearch />
      </BrowserRouter>,
    );
  };

  describe("Input rendering", () => {
    it("renders search input", () => {
      renderWithRouter();
      // The actual placeholder is "Search events, executions, tools..."
      expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
    });

    it("renders search icon", () => {
      const { container } = renderWithRouter();
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Debounced search", () => {
    it("does not search immediately on input", () => {
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "test" } });

      // Check immediately - fetch should not be called yet
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("searches after debounce delay", async () => {
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "test" } });

      // Wait for the debounce (300ms) plus some buffer
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/search"),
          );
        },
        { timeout: 2000 },
      );
    });

    it("searches for single character queries after debounce", async () => {
      // The component does search for any non-empty query
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "a" } });

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/search?q=a"),
          );
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Results display", () => {
    it("shows results dropdown after search", async () => {
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "build" } });

      await waitFor(
        () => {
          expect(screen.getByText("Build Task #42")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("groups results by type", async () => {
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "build" } });

      await waitFor(
        () => {
          expect(screen.getByText(/execution/i)).toBeInTheDocument();
          expect(screen.getByText(/event/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Keyboard navigation", () => {
    it("closes dropdown on Escape key", async () => {
      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "build" } });

      await waitFor(
        () => {
          expect(screen.getByText("Build Task #42")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );

      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Build Task #42")).not.toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator during search", async () => {
      // Use a very slow mock to ensure loading state is visible
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({ success: true, data: { results: [] } }),
                }),
              2000, // 2 second delay
            ),
          ),
      );

      renderWithRouter();
      const input = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(input, { target: { value: "test" } });

      // After debounce (300ms), loading should appear
      await waitFor(
        () => {
          expect(document.querySelector(".animate-spin")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });
});
