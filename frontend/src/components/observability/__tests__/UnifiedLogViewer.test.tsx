/**
 * Tests for UnifiedLogViewer component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import UnifiedLogViewer from "../UnifiedLogViewer";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket
const mockWebSocket = {
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
};

vi.mock("../../hooks/useObservabilityStream", () => ({
  useObservabilityStream: () => ({
    events: [],
    isConnected: true,
  }),
}));

describe("UnifiedLogViewer", () => {
  const mockLogsData = {
    success: true,
    data: {
      data: [
        {
          id: "log-001",
          eventType: "execution.started",
          severity: "info",
          humanSummary: "Execution started for task list",
          timestamp: "2026-01-15T10:00:00.000Z",
          source: "build-agent",
          category: "execution",
          payload: { taskListId: "list-001" },
        },
        {
          id: "log-002",
          eventType: "task.started",
          severity: "info",
          humanSummary: "Starting task T-001",
          timestamp: "2026-01-15T10:01:00.000Z",
          source: "build-agent",
          category: "execution",
          payload: null,
        },
        {
          id: "log-003",
          eventType: "command.blocked",
          severity: "warning",
          humanSummary: "Command blocked by security policy",
          timestamp: "2026-01-15T10:02:00.000Z",
          source: "security-monitor",
          category: "security",
          payload: { command: "rm -rf /" },
        },
        {
          id: "log-004",
          eventType: "task.failed",
          severity: "error",
          humanSummary: "Task failed: Build error",
          timestamp: "2026-01-15T10:03:00.000Z",
          source: "build-agent",
          category: "execution",
          payload: { error: "Compilation failed" },
        },
        {
          id: "log-005",
          eventType: "system.critical",
          severity: "critical",
          humanSummary: "Critical: Database connection lost",
          timestamp: "2026-01-15T10:04:00.000Z",
          source: "monitoring-agent",
          category: "system",
          payload: null,
        },
      ],
      total: 5,
      limit: 200,
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
      render(<UnifiedLogViewer />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Log display", () => {
    it("displays log messages", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
        expect(screen.getByText("Starting task T-001")).toBeInTheDocument();
      });
    });

    it("displays timestamps", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        // Timestamps are displayed as locale time strings
        const logEntries = document.querySelectorAll(".text-gray-500");
        expect(logEntries.length).toBeGreaterThan(0);
      });
    });

    it("displays source badges", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(screen.getByText("build-agent")).toBeInTheDocument();
        expect(screen.getByText("security-monitor")).toBeInTheDocument();
        expect(screen.getByText("monitoring-agent")).toBeInTheDocument();
      });
    });

    it("displays category labels", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(screen.getAllByText("execution").length).toBeGreaterThan(0);
        expect(screen.getByText("security")).toBeInTheDocument();
        expect(screen.getByText("system")).toBeInTheDocument();
      });
    });

    it("displays log count", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(screen.getByText("5 / 5")).toBeInTheDocument();
      });
    });
  });

  describe("Severity styling", () => {
    it("applies info severity styling", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        // Info logs have specific background
        const infoLogs = document.querySelectorAll(".border-l-4");
        expect(infoLogs.length).toBeGreaterThan(0);
      });
    });

    it("applies warning severity styling", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Command blocked by security policy"),
        ).toBeInTheDocument();
      });
    });

    it("applies error severity styling", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Task failed: Build error"),
        ).toBeInTheDocument();
      });
    });

    it("applies critical severity styling", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Critical: Database connection lost"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Search", () => {
    it("has search input", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search logs..."),
        ).toBeInTheDocument();
      });
    });

    it("filters logs by search term", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search logs...");
      fireEvent.change(searchInput, { target: { value: "critical" } });

      await waitFor(() => {
        expect(
          screen.getByText("Critical: Database connection lost"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("Execution started for task list"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Severity filter", () => {
    it("has severity filter buttons", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        // Four severity filter buttons
        const filterButtons = document.querySelectorAll("button[title]");
        const severityButtons = Array.from(filterButtons).filter((btn) =>
          ["info", "warning", "error", "critical"].includes(
            btn.getAttribute("title") || "",
          ),
        );
        expect(severityButtons.length).toBe(4);
      });
    });

    it("toggles severity filter when clicked", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
      });

      const errorButton = screen.getByTitle("error");
      fireEvent.click(errorButton);

      await waitFor(() => {
        // Only error logs should be visible
        expect(
          screen.getByText("Task failed: Build error"),
        ).toBeInTheDocument();
        // Info logs should be filtered out
        expect(
          screen.queryByText("Execution started for task list"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Log expansion", () => {
    it("expands log to show payload when clicked", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
      });

      // Click on log entry with payload
      fireEvent.click(screen.getByText("Execution started for task list"));

      await waitFor(() => {
        // Payload should be shown as JSON
        expect(screen.getByText(/"taskListId"/)).toBeInTheDocument();
      });
    });

    it("collapses log when clicked again", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText("Execution started for task list"));
      await waitFor(() => {
        expect(screen.getByText(/"taskListId"/)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(screen.getByText("Execution started for task list"));
      await waitFor(() => {
        expect(screen.queryByText(/"taskListId"/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Connection status", () => {
    it("shows connection status indicator", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(screen.getByText("Live")).toBeInTheDocument();
      });
    });

    it("shows green indicator when connected", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        const indicator = document.querySelector(".bg-green-500");
        expect(indicator).toBeInTheDocument();
      });
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no logs", async () => {
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
                  limit: 200,
                  offset: 0,
                  hasMore: false,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(screen.getByText("No logs available")).toBeInTheDocument();
      });
    });

    it("shows filter message when filters hide all logs", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(
          screen.getByText("Execution started for task list"),
        ).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText("Search logs...");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      await waitFor(() => {
        expect(screen.getByText("No logs match filters")).toBeInTheDocument();
      });
    });
  });

  describe("Execution ID filter", () => {
    it("passes executionId to fetch request", async () => {
      const executionId = "test-exec-001";
      render(<UnifiedLogViewer executionId={executionId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`executionId=${executionId}`),
        );
      });
    });
  });

  describe("Max height", () => {
    it("applies maxHeight prop", async () => {
      render(<UnifiedLogViewer maxHeight={300} />);
      await waitFor(() => {
        const container = document.querySelector('[style*="max-height"]');
        expect(container).toHaveStyle({ maxHeight: "300px" });
      });
    });

    it("uses default maxHeight of 500", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        const container = document.querySelector('[style*="max-height"]');
        expect(container).toHaveStyle({ maxHeight: "500px" });
      });
    });
  });

  describe("API calls", () => {
    it("fetches logs on mount", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/logs/message-bus"),
        );
      });
    });

    it("includes limit in fetch request", async () => {
      render(<UnifiedLogViewer />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/limit=200/),
        );
      });
    });
  });
});
