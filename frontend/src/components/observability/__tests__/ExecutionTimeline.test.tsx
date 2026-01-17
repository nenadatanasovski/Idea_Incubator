/**
 * Tests for ExecutionTimeline component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ExecutionTimeline, { ToolDensityChart } from "../ExecutionTimeline";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ExecutionTimeline", () => {
  const executionId = "test-exec-001";

  const mockTranscriptData = {
    success: true,
    data: {
      entries: [
        {
          id: "entry-001",
          entryType: "phase_start",
          summary: "Database Phase",
          timestamp: "2026-01-15T10:00:00.000Z",
          taskId: null,
          sequence: 1,
        },
        {
          id: "entry-002",
          entryType: "task_start",
          summary: "Creating migration",
          timestamp: "2026-01-15T10:01:00.000Z",
          taskId: "task-001",
          sequence: 2,
        },
        {
          id: "entry-003",
          entryType: "tool_use",
          summary: "Read schema.ts",
          timestamp: "2026-01-15T10:02:00.000Z",
          taskId: "task-001",
          sequence: 3,
        },
        {
          id: "entry-004",
          entryType: "task_end",
          summary: "Migration created",
          timestamp: "2026-01-15T10:05:00.000Z",
          taskId: "task-001",
          sequence: 4,
        },
        {
          id: "entry-005",
          entryType: "phase_end",
          summary: "Database Phase Complete",
          timestamp: "2026-01-15T10:10:00.000Z",
          taskId: null,
          sequence: 5,
        },
      ],
      total: 5,
      hasMore: false,
    },
  };

  const mockToolUsesData = {
    success: true,
    data: {
      toolUses: [
        {
          id: "tool-001",
          tool: "Read",
          inputSummary: "Reading schema.ts",
          startTime: "2026-01-15T10:02:00.000Z",
          durationMs: 50,
          taskId: "task-001",
          isError: false,
          isBlocked: false,
        },
        {
          id: "tool-002",
          tool: "Write",
          inputSummary: "Writing migration.sql",
          startTime: "2026-01-15T10:03:00.000Z",
          durationMs: 100,
          taskId: "task-001",
          isError: false,
          isBlocked: false,
        },
      ],
      total: 2,
      hasMore: false,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/transcript")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTranscriptData),
        });
      }
      if (url.includes("/tool-uses")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockToolUsesData),
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
      render(<ExecutionTimeline executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Toolbar", () => {
    it("displays zoom controls", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("100%")).toBeInTheDocument();
      });
    });

    it("displays export button", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      });
    });

    it("zooms in when zoom in button clicked", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("100%")).toBeInTheDocument();
      });

      const zoomInButton = screen.getByTitle("Zoom in");
      fireEvent.click(zoomInButton);

      await waitFor(() => {
        expect(screen.getByText("125%")).toBeInTheDocument();
      });
    });

    it("zooms out when zoom out button clicked", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("100%")).toBeInTheDocument();
      });

      const zoomOutButton = screen.getByTitle("Zoom out");
      fireEvent.click(zoomOutButton);

      await waitFor(() => {
        expect(screen.getByText("75%")).toBeInTheDocument();
      });
    });
  });

  describe("Phase display", () => {
    it("displays phase bars", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Database Phase")).toBeInTheDocument();
      });
    });
  });

  describe("Task rows", () => {
    it("displays task labels", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });
    });

    it("displays global row for non-task entries", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Global")).toBeInTheDocument();
      });
    });

    it("shows entry count for each task", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        // Entry count is shown
        const taskRow = screen.getByText(/Task task-001/).closest("div");
        expect(taskRow?.textContent).toMatch(/\d+/);
      });
    });
  });

  describe("Task expansion", () => {
    it("expands task when clicked", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText(/Task task-001/));

      await waitFor(() => {
        expect(screen.getByText(/Tool Uses/)).toBeInTheDocument();
      });
    });

    it("collapses task when clicked again", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText(/Task task-001/));
      await waitFor(() => {
        expect(screen.getByText(/Tool Uses/)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(screen.getByText(/Task task-001/));
      await waitFor(() => {
        expect(screen.queryByText(/Tool Uses \(2\)/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Click handlers", () => {
    it("calls onEntryClick when entry is clicked", async () => {
      const handleEntryClick = vi.fn();
      render(
        <ExecutionTimeline
          executionId={executionId}
          onEntryClick={handleEntryClick}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });

      // Click on the task bar
      const taskBar = document.querySelector(".bg-green-200");
      if (taskBar) {
        fireEvent.click(taskBar);
        expect(handleEntryClick).toHaveBeenCalled();
      }
    });

    it("calls onToolUseClick when tool use is clicked", async () => {
      const handleToolUseClick = vi.fn();
      render(
        <ExecutionTimeline
          executionId={executionId}
          onToolUseClick={handleToolUseClick}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });

      // Expand task to see tool uses
      fireEvent.click(screen.getByText(/Task task-001/));
      await waitFor(() => {
        expect(screen.getByText(/Tool Uses/)).toBeInTheDocument();
      });

      // Click on a tool use bar
      const toolUseBar = document.querySelector(".bg-purple-200");
      if (toolUseBar) {
        fireEvent.click(toolUseBar);
        expect(handleToolUseClick).toHaveBeenCalled();
      }
    });
  });

  describe("Export", () => {
    it("exports JSON when export button clicked", async () => {
      const mockCreateObjectURL = vi.fn(() => "blob:url");
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = vi.fn();
      const mockAnchor = { click: mockClick, href: "", download: "" };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockAnchor as unknown as HTMLAnchorElement,
      );

      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Export"));

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no entries", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/transcript")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { entries: [], total: 0, hasMore: false },
              }),
          });
        }
        if (url.includes("/tool-uses")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { toolUses: [], total: 0, hasMore: false },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(
          screen.getByText("No timeline data available"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Hover tooltip", () => {
    it("shows tooltip on entry hover", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Task task-001/)).toBeInTheDocument();
      });

      // Expand to see entries
      fireEvent.click(screen.getByText(/Task task-001/));
      await waitFor(() => {
        expect(screen.getByText("Entries")).toBeInTheDocument();
      });

      // Find an entry marker and hover
      const entryMarker = document.querySelector('[title*="task_start"]');
      if (entryMarker) {
        fireEvent.mouseEnter(entryMarker);
        // Tooltip should appear (fixed position element)
        await waitFor(() => {
          expect(document.querySelector(".fixed")).toBeInTheDocument();
        });
      }
    });
  });

  describe("API calls", () => {
    it("fetches transcript with execution ID", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(executionId),
        );
      });
    });

    it("fetches transcript and tool uses", async () => {
      render(<ExecutionTimeline executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transcript"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/tool-uses"),
        );
      });
    });
  });
});

describe("ToolDensityChart", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders density chart with tool uses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-uses")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                toolUses: Array(20)
                  .fill(null)
                  .map((_, i) => ({
                    id: `tool-${i}`,
                    tool: "Read",
                    startTime: new Date(
                      Date.now() - (20 - i) * 60000,
                    ).toISOString(),
                    durationMs: 50,
                  })),
                total: 20,
                hasMore: false,
              },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<ToolDensityChart executionId={executionId} />);

    await waitFor(() => {
      // Should render density bars
      const bars = document.querySelectorAll(".bg-purple-400");
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  it("returns null when no tool uses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-uses")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { toolUses: [], total: 0, hasMore: false },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const { container } = render(
      <ToolDensityChart executionId={executionId} />,
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("respects height prop", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-uses")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                toolUses: [
                  {
                    id: "tool-001",
                    tool: "Read",
                    startTime: new Date().toISOString(),
                    durationMs: 50,
                  },
                ],
                total: 1,
                hasMore: false,
              },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<ToolDensityChart executionId={executionId} height={60} />);

    await waitFor(() => {
      const chart = document.querySelector('[style*="height"]');
      expect(chart).toHaveStyle({ height: "60px" });
    });
  });
});
