/**
 * Tests for LogViewer component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LogViewer from "../LogViewer";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("LogViewer", () => {
  const mockLogsData = {
    success: true,
    data: {
      data: [
        {
          id: "log-001",
          eventType: "execution.started",
          severity: "info",
          humanSummary: "Execution started",
          timestamp: "2026-01-15T10:00:00.000Z",
          source: "build-agent",
          category: "lifecycle",
        },
        {
          id: "log-002",
          eventType: "task.warning",
          severity: "warning",
          humanSummary: "Task taking longer than expected",
          timestamp: "2026-01-15T10:01:00.000Z",
          source: "monitoring",
          category: "decision",
        },
        {
          id: "log-003",
          eventType: "task.failed",
          severity: "error",
          humanSummary: "Task failed with error",
          timestamp: "2026-01-15T10:02:00.000Z",
          source: "build-agent",
          category: "failure",
        },
        {
          id: "log-004",
          eventType: "system.critical",
          severity: "critical",
          humanSummary: "Critical system failure",
          timestamp: "2026-01-15T10:03:00.000Z",
          source: "system",
          category: "failure",
        },
      ],
      total: 4,
      limit: 100,
      offset: 0,
      hasMore: false,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/logs/message-bus")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLogsData),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading skeleton initially", () => {
      render(<LogViewer />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Log display", () => {
    it("displays log messages", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("Execution started")).toBeInTheDocument();
        expect(
          screen.getByText("Task taking longer than expected"),
        ).toBeInTheDocument();
        expect(screen.getByText("Task failed with error")).toBeInTheDocument();
        expect(screen.getByText("Critical system failure")).toBeInTheDocument();
      });
    });

    it("displays event types", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("execution.started")).toBeInTheDocument();
        expect(screen.getByText("task.warning")).toBeInTheDocument();
        expect(screen.getByText("task.failed")).toBeInTheDocument();
      });
    });

    it("displays sources", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getAllByText("[build-agent]").length).toBeGreaterThan(0);
        expect(screen.getByText("[monitoring]")).toBeInTheDocument();
        expect(screen.getByText("[system]")).toBeInTheDocument();
      });
    });

    it("displays log count", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("4 logs")).toBeInTheDocument();
      });
    });
  });

  describe("Severity styling", () => {
    it("applies info styling (blue)", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        const infoLogs = document.querySelectorAll(".bg-blue-50");
        expect(infoLogs.length).toBeGreaterThan(0);
      });
    });

    it("applies warning styling (yellow)", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        const warningLogs = document.querySelectorAll(".bg-yellow-50");
        expect(warningLogs.length).toBeGreaterThan(0);
      });
    });

    it("applies error styling (red)", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        const errorLogs = document.querySelectorAll(".bg-red-50");
        expect(errorLogs.length).toBeGreaterThan(0);
      });
    });

    it("applies critical styling (dark red)", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        const criticalLogs = document.querySelectorAll(".bg-red-100");
        expect(criticalLogs.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Filters", () => {
    it("has severity filter dropdown", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("All Severity")).toBeInTheDocument();
      });
    });

    it("has category filter dropdown", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("All Categories")).toBeInTheDocument();
      });
    });

    it("filters by severity when selected", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("All Severity")).toBeInTheDocument();
      });

      const severitySelect = screen.getAllByRole("combobox")[0];
      fireEvent.change(severitySelect, { target: { value: "error" } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/severity=error/),
        );
      });
    });

    it("filters by category when selected", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("All Categories")).toBeInTheDocument();
      });

      const categorySelect = screen.getAllByRole("combobox")[1];
      fireEvent.change(categorySelect, { target: { value: "lifecycle" } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/category=lifecycle/),
        );
      });
    });
  });

  describe("Load more", () => {
    it("shows load more button when hasMore is true", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/logs/message-bus")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  data: [mockLogsData.data.data[0]],
                  total: 100,
                  limit: 100,
                  offset: 0,
                  hasMore: true,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("Load more...")).toBeInTheDocument();
      });
    });

    it("does not show load more button when hasMore is false", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("4 logs")).toBeInTheDocument();
      });
      expect(screen.queryByText("Load more...")).not.toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty message when no logs", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/logs/message-bus")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  data: [],
                  total: 0,
                  limit: 100,
                  offset: 0,
                  hasMore: false,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText("No logs found")).toBeInTheDocument();
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

      render(<LogViewer />);
      await waitFor(() => {
        expect(screen.getByText(/Error loading logs/)).toBeInTheDocument();
      });
    });
  });

  describe("Execution ID filter", () => {
    it("passes executionId to fetch request", async () => {
      const executionId = "test-exec-001";
      render(<LogViewer executionId={executionId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`executionId=${executionId}`),
        );
      });
    });
  });

  describe("API calls", () => {
    it("fetches logs on mount", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/logs/message-bus"),
        );
      });
    });

    it("includes limit in fetch request", async () => {
      render(<LogViewer />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/limit=100/),
        );
      });
    });
  });
});
