/**
 * Tests for ToolUseList component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ToolUseList from "../ToolUseList";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ToolUseList", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
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
                    inputSummary: "Reading config.ts",
                    outputSummary: "File content returned",
                    durationMs: 45,
                    resultStatus: "done",
                    startTime: new Date().toISOString(),
                    isError: false,
                    isBlocked: false,
                  },
                  {
                    id: "tool-002",
                    tool: "Bash",
                    inputSummary: "npm run build",
                    outputSummary: "Build completed",
                    durationMs: 5000,
                    resultStatus: "error",
                    startTime: new Date().toISOString(),
                    isError: true,
                    isBlocked: false,
                  },
                  {
                    id: "tool-003",
                    tool: "Write",
                    inputSummary: "Writing output.json",
                    outputSummary: "Blocked by permission",
                    durationMs: 10,
                    resultStatus: "blocked",
                    startTime: new Date().toISOString(),
                    isError: false,
                    isBlocked: true,
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

  describe("Loading state", () => {
    it("shows loading skeleton initially", () => {
      render(<ToolUseList executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Tool use list", () => {
    it("displays tool names", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Read")).toBeInTheDocument();
        expect(screen.getByText("Bash")).toBeInTheDocument();
        expect(screen.getByText("Write")).toBeInTheDocument();
      });
    });

    it("displays input summaries", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Reading config.ts")).toBeInTheDocument();
        expect(screen.getByText("npm run build")).toBeInTheDocument();
      });
    });

    it("displays duration in ms", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("45ms")).toBeInTheDocument();
        expect(screen.getByText("5000ms")).toBeInTheDocument();
      });
    });

    it("displays total count", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("3 total")).toBeInTheDocument();
      });
    });
  });

  describe("Tool icons", () => {
    it("displays tool-specific icons", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        // Tool icons are rendered as emojis
        expect(screen.getByText("📖")).toBeInTheDocument(); // Read
        expect(screen.getByText("💻")).toBeInTheDocument(); // Bash
        expect(screen.getByText("✏️")).toBeInTheDocument(); // Write
      });
    });
  });

  describe("Filters", () => {
    it("has tool filter dropdown", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("All Tools")).toBeInTheDocument();
      });
    });

    it("has status filter dropdown", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("All Status")).toBeInTheDocument();
      });
    });

    it("filters by tool when selected", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("All Tools")).toBeInTheDocument();
      });

      const toolSelect = screen.getAllByRole("combobox")[0];
      fireEvent.change(toolSelect, { target: { value: "Read" } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/tool=Read/),
        );
      });
    });

    it("filters by status when selected", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("All Status")).toBeInTheDocument();
      });

      const statusSelect = screen.getAllByRole("combobox")[1];
      fireEvent.change(statusSelect, { target: { value: "error" } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/status=error/),
        );
      });
    });
  });

  describe("Tool use click", () => {
    it("calls onToolUseClick when item is clicked", async () => {
      const handleClick = vi.fn();
      render(
        <ToolUseList executionId={executionId} onToolUseClick={handleClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText("Read")).toBeInTheDocument();
      });

      // Click on the tool item
      fireEvent.click(screen.getByText("Reading config.ts"));

      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tool-001",
          tool: "Read",
        }),
      );
    });
  });

  describe("Load more", () => {
    it("shows load more button when hasMore is true", async () => {
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
                      inputSummary: "Reading file",
                      durationMs: 50,
                      resultStatus: "done",
                      startTime: new Date().toISOString(),
                    },
                  ],
                  total: 100,
                  hasMore: true,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Load more...")).toBeInTheDocument();
      });
    });

    it("does not show load more button when hasMore is false", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("3 total")).toBeInTheDocument();
      });
      expect(screen.queryByText("Load more...")).not.toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty message when no tool uses", async () => {
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

      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("No tool uses found")).toBeInTheDocument();
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

      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Error loading tool uses/)).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches tool uses with correct execution ID", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(executionId),
        );
      });
    });

    it("includes limit in fetch request", async () => {
      render(<ToolUseList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/limit=50/),
        );
      });
    });
  });
});
