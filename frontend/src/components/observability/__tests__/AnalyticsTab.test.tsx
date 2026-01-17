/**
 * Tests for AnalyticsTab component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AnalyticsTab from "../AnalyticsTab";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AnalyticsTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/tool-usage")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                tools: [
                  { name: "Read", count: 150, errors: 2, avgDurationMs: 50 },
                  { name: "Write", count: 75, errors: 1, avgDurationMs: 100 },
                ],
                summary: {
                  total: 225,
                  errors: 3,
                  blocked: 0,
                  errorRate: "1.3%",
                },
              },
            }),
        });
      }
      if (url.includes("/assertions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                summary: {
                  total: 100,
                  passed: 95,
                  failed: 5,
                  skipped: 0,
                  warned: 0,
                  passRate: "95%",
                },
                byCategory: [
                  {
                    category: "validation",
                    total: 50,
                    passed: 48,
                    passRate: "96%",
                  },
                  {
                    category: "type-check",
                    total: 50,
                    passed: 47,
                    passRate: "94%",
                  },
                ],
              },
            }),
        });
      }
      if (url.includes("/durations")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                summary: {
                  avgSeconds: 5.2,
                  minSeconds: 0.5,
                  maxSeconds: 30,
                  p95Seconds: 15,
                  totalExecutions: 100,
                },
                trend: [
                  {
                    id: "1",
                    durationSeconds: 5,
                    status: "completed",
                    startedAt: new Date().toISOString(),
                  },
                  {
                    id: "2",
                    durationSeconds: 10,
                    status: "completed",
                    startedAt: new Date().toISOString(),
                  },
                ],
              },
            }),
        });
      }
      if (url.includes("/errors")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                toolErrors: [
                  { tool: "Bash", count: 10, sampleError: "Command failed" },
                  { tool: "Read", count: 5, sampleError: "File not found" },
                ],
                assertionFailures: [],
                failedExecutions: [],
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

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <AnalyticsTab />
      </BrowserRouter>,
    );
  };

  describe("Loading state", () => {
    it("shows loading spinner initially", () => {
      renderWithRouter();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Header section", () => {
    it("displays Analytics heading", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Analytics")).toBeInTheDocument();
      });
    });
  });

  describe("Time range selector", () => {
    it("displays time range buttons", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("1h")).toBeInTheDocument();
        expect(screen.getByText("6h")).toBeInTheDocument();
        expect(screen.getByText("24h")).toBeInTheDocument();
        expect(screen.getByText("7d")).toBeInTheDocument();
      });
    });

    it("24h is selected by default", async () => {
      renderWithRouter();
      await waitFor(() => {
        const button24h = screen.getByText("24h");
        expect(button24h.closest("button")).toHaveClass("bg-blue-600");
      });
    });

    it("changes time range when button clicked", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("7d")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("7d"));

      await waitFor(() => {
        const button7d = screen.getByText("7d");
        expect(button7d.closest("button")).toHaveClass("bg-blue-600");
      });
    });
  });

  describe("Analytics panels", () => {
    it("displays Tool Usage panel", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Tool Usage")).toBeInTheDocument();
      });
    });

    it("displays Assertion Trends panel", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Assertion Trends")).toBeInTheDocument();
      });
    });

    it("displays Execution Duration panel", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Execution Duration")).toBeInTheDocument();
      });
    });

    it("displays Error Hotspots panel", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Error Hotspots")).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches all analytics data on mount", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/tool-usage"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/assertions"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/durations"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/errors"),
        );
      });
    });
  });
});
