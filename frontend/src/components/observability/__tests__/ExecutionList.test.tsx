/**
 * Tests for ExecutionList component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ExecutionList from "../ExecutionList";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ExecutionList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/executions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                executions: [
                  {
                    id: "exec-001",
                    runNumber: 1,
                    status: "completed",
                    startedAt: "2026-01-15T10:00:00.000Z",
                    completedAt: "2026-01-15T10:30:00.000Z",
                    taskCount: 10,
                    completedCount: 10,
                    failedCount: 0,
                  },
                  {
                    id: "exec-002",
                    runNumber: 2,
                    status: "running",
                    startedAt: "2026-01-15T11:00:00.000Z",
                    completedAt: null,
                    taskCount: 5,
                    completedCount: 2,
                    failedCount: 0,
                  },
                  {
                    id: "exec-003",
                    runNumber: 3,
                    status: "failed",
                    startedAt: "2026-01-15T12:00:00.000Z",
                    completedAt: "2026-01-15T12:15:00.000Z",
                    taskCount: 8,
                    completedCount: 5,
                    failedCount: 3,
                  },
                ],
                total: 3,
                hasMore: false,
              },
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });
    });
  });

  const renderWithRouter = (props = {}) => {
    return render(
      <BrowserRouter>
        <ExecutionList {...props} />
      </BrowserRouter>,
    );
  };

  describe("Loading state", () => {
    it("shows loading skeleton initially", () => {
      renderWithRouter();
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Execution list", () => {
    it("displays execution run numbers", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Run #1")).toBeInTheDocument();
        expect(screen.getByText("Run #2")).toBeInTheDocument();
        expect(screen.getByText("Run #3")).toBeInTheDocument();
      });
    });

    it("displays execution count", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("3 executions")).toBeInTheDocument();
      });
    });

    it("displays task progress", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("10/10 tasks")).toBeInTheDocument();
        expect(screen.getByText("2/5 tasks")).toBeInTheDocument();
        expect(screen.getByText("5/8 tasks")).toBeInTheDocument();
      });
    });

    it("displays execution IDs (truncated)", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("exec-001")).toBeInTheDocument();
      });
    });
  });

  describe("Duration display", () => {
    it("displays duration for completed executions", async () => {
      renderWithRouter();
      await waitFor(() => {
        // 30 minutes = 30m 0s
        expect(screen.getByText(/30m/)).toBeInTheDocument();
      });
    });
  });

  describe("Progress bar", () => {
    it("renders progress bar with correct proportions", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Run #1")).toBeInTheDocument();
      });

      // Progress bars should be rendered
      const progressBars = document.querySelectorAll(".bg-green-500");
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it("shows failed section in progress bar", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Run #3")).toBeInTheDocument();
      });

      // Failed progress bar section
      const failedBars = document.querySelectorAll(".bg-red-500");
      expect(failedBars.length).toBeGreaterThan(0);
    });
  });

  describe("Execution select", () => {
    it("calls onExecutionSelect when execution is clicked", async () => {
      const handleSelect = vi.fn();
      renderWithRouter({ onExecutionSelect: handleSelect });

      await waitFor(() => {
        expect(screen.getByText("Run #1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Run #1"));

      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "exec-001",
          runNumber: 1,
        }),
      );
    });

    it("links to execution detail page", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Run #1")).toBeInTheDocument();
      });

      const link = screen.getByText("Run #1").closest("a");
      expect(link).toHaveAttribute(
        "href",
        "/observability/executions/exec-001",
      );
    });
  });

  describe("Load more", () => {
    it("shows load more button when hasMore is true", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/executions")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  executions: [
                    {
                      id: "exec-001",
                      runNumber: 1,
                      status: "completed",
                      startedAt: new Date().toISOString(),
                      taskCount: 5,
                      completedCount: 5,
                      failedCount: 0,
                    },
                  ],
                  total: 50,
                  hasMore: true,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Load more...")).toBeInTheDocument();
      });
    });

    it("does not show load more button when hasMore is false", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("3 executions")).toBeInTheDocument();
      });
      expect(screen.queryByText("Load more...")).not.toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no executions", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/executions")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { executions: [], total: 0, hasMore: false },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("No executions yet")).toBeInTheDocument();
      });
    });

    it("shows guidance message in empty state", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/executions")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { executions: [], total: 0, hasMore: false },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      renderWithRouter();
      await waitFor(() => {
        expect(
          screen.getByText(/Start a task list execution/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error state", () => {
    it("shows error message on fetch failure", async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({ success: false, error: "Server error" }),
        });
      });

      renderWithRouter();
      await waitFor(() => {
        expect(
          screen.getByText(/Error loading executions/),
        ).toBeInTheDocument();
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

    it("includes limit in fetch request", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/limit=20/),
        );
      });
    });
  });

  describe("Timestamp display", () => {
    it("displays start time for executions", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText(/Started/)).toBeInTheDocument();
      });
    });
  });
});
