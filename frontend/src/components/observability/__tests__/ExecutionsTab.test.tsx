/**
 * Tests for ExecutionsTab component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ExecutionsTab from "../ExecutionsTab";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ExecutionsTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      // The useExecutions hook calls /api/observability/executions
      if (url.includes("/executions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                data: [
                  {
                    id: "run-1",
                    runNumber: 1,
                    status: "completed",
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    taskListId: "list-1",
                  },
                  {
                    id: "run-2",
                    runNumber: 2,
                    status: "running",
                    startedAt: new Date().toISOString(),
                    taskListId: "list-1",
                  },
                  {
                    id: "run-3",
                    runNumber: 3,
                    status: "failed",
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    taskListId: "list-1",
                  },
                ],
                total: 3,
                hasMore: false,
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { data: [], total: 0, hasMore: false },
          }),
      });
    });
  });

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <ExecutionsTab />
      </BrowserRouter>,
    );
  };

  describe("Loading state", () => {
    it("shows loading skeleton initially", () => {
      renderWithRouter();
      // ExecutionList uses animate-pulse skeleton, not spinner
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Header section", () => {
    it("displays Execution Runs heading", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Execution Runs")).toBeInTheDocument();
      });
    });

    it("displays filter buttons", async () => {
      renderWithRouter();
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Filter buttons", () => {
    it("displays All filter", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("All")).toBeInTheDocument();
      });
    });

    it("displays Running filter", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Running")).toBeInTheDocument();
      });
    });

    it("displays Completed filter", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeInTheDocument();
      });
    });

    it("displays Failed filter", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Failed")).toBeInTheDocument();
      });
    });

    it("filters executions when filter clicked", async () => {
      renderWithRouter();

      // Find the filter button specifically (not status badges)
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const failedFilterButton = buttons.find(
          (btn: HTMLElement) => btn.textContent === "Failed",
        );
        expect(failedFilterButton).toBeDefined();
      });

      // Get filter buttons
      const buttons = screen.getAllByRole("button");
      const failedFilterButton = buttons.find(
        (btn) => btn.textContent === "Failed",
      );

      fireEvent.click(failedFilterButton!);

      // Filter button should be active with red styling
      await waitFor(() => {
        expect(failedFilterButton).toHaveClass("bg-red-100");
      });
    });
  });

  describe("Execution list", () => {
    it("renders empty state when no executions", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { data: [], total: 0, hasMore: false },
            }),
        }),
      );
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("No executions yet")).toBeInTheDocument();
      });
    });

    it("shows execution status", async () => {
      renderWithRouter();
      await waitFor(() => {
        // Should show the Completed status from the mock data
        expect(
          screen.getAllByText(/Completed|Running|Failed/i).length,
        ).toBeGreaterThan(0);
      });
    });
  });

  describe("API calls", () => {
    it("fetches executions on mount", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/executions"),
        );
      });
    });
  });

  describe("Click navigation", () => {
    it("renders execution cards", async () => {
      renderWithRouter();
      await waitFor(() => {
        // Look for the execution count text which indicates cards are rendered
        expect(screen.getByText(/3 executions/i)).toBeInTheDocument();
      });
    });
  });
});
