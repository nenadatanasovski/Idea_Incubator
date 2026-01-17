/**
 * Tests for QuickStats component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import QuickStats, { QuickStatsCompact } from "../QuickStats";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("QuickStats", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-summary")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                total: 150,
                avgDurationMs: 75,
                byTool: {
                  Read: 50,
                  Write: 30,
                  Bash: 70,
                },
                byStatus: {
                  done: 140,
                  error: 8,
                  blocked: 2,
                },
              },
            }),
        });
      }
      if (url.includes("/assertion-summary")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                total: 45,
                passed: 40,
                failed: 3,
                warned: 2,
                skipped: 0,
                passRate: 0.89,
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
      render(<QuickStats executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Stats display", () => {
    it("displays tool calls count", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Tool Calls")).toBeInTheDocument();
        expect(screen.getByText("150")).toBeInTheDocument();
      });
    });

    it("displays assertions count", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Assertions")).toBeInTheDocument();
        expect(screen.getByText("45")).toBeInTheDocument();
      });
    });

    it("displays passed count", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Passed")).toBeInTheDocument();
        expect(screen.getByText("40")).toBeInTheDocument();
      });
    });

    it("displays failed count", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Failed")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
      });
    });

    it("displays errors count", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Errors")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
      });
    });

    it("displays average duration", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Avg Duration")).toBeInTheDocument();
        expect(screen.getByText("75ms")).toBeInTheDocument();
      });
    });
  });

  describe("Grid layout", () => {
    it("renders 6 stat cards", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Tool Calls")).toBeInTheDocument();
      });

      // Should have 6 stat cards
      const statLabels = [
        "Tool Calls",
        "Assertions",
        "Passed",
        "Failed",
        "Errors",
        "Avg Duration",
      ];
      statLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches tool summary with execution ID", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/tool-summary"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(executionId),
        );
      });
    });

    it("fetches assertion summary", async () => {
      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/assertion-summary"),
        );
      });
    });
  });

  describe("No execution ID", () => {
    it("works without execution ID", async () => {
      render(<QuickStats />);
      await waitFor(() => {
        expect(screen.getByText("Tool Calls")).toBeInTheDocument();
      });
    });
  });

  describe("Zero values", () => {
    it("displays zero values correctly", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/tool-summary")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  total: 0,
                  avgDurationMs: 0,
                  byTool: {},
                  byStatus: {},
                },
              }),
          });
        }
        if (url.includes("/assertion-summary")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  total: 0,
                  passed: 0,
                  failed: 0,
                  warned: 0,
                  skipped: 0,
                  passRate: 0,
                },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<QuickStats executionId={executionId} />);
      await waitFor(() => {
        // Multiple zeros should be displayed
        const zeros = screen.getAllByText("0");
        expect(zeros.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("QuickStatsCompact", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-summary")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                total: 150,
                avgDurationMs: 75,
                byTool: {},
                byStatus: {},
              },
            }),
        });
      }
      if (url.includes("/assertion-summary")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                total: 45,
                passed: 40,
                failed: 3,
                warned: 2,
                skipped: 0,
                passRate: 0.89,
              },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  describe("Loading state", () => {
    it("shows loading skeleton initially", () => {
      render(<QuickStatsCompact executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Compact display", () => {
    it("displays tool count", async () => {
      render(<QuickStatsCompact executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText("tools")).toBeInTheDocument();
      });
    });

    it("displays pass rate percentage", async () => {
      render(<QuickStatsCompact executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("89%")).toBeInTheDocument();
        expect(screen.getByText("pass")).toBeInTheDocument();
      });
    });

    it("displays failed count", async () => {
      render(<QuickStatsCompact executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("failed")).toBeInTheDocument();
      });
    });
  });

  describe("Inline layout", () => {
    it("renders in horizontal layout", async () => {
      const { container } = render(
        <QuickStatsCompact executionId={executionId} />,
      );
      await waitFor(() => {
        expect(screen.getByText("tools")).toBeInTheDocument();
      });

      // Container should have flex layout
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("flex");
    });
  });
});
