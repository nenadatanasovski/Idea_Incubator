/**
 * Tests for OverviewDashboard component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import OverviewDashboard from "../OverviewDashboard";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OverviewDashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/stats")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                activeExecutions: 5,
                errorRate: "2.5%",
                blockedAgents: 1,
                pendingQuestions: 3,
                lastUpdated: new Date().toISOString(),
              },
            }),
        });
      }
      if (url.includes("/health")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                status: "healthy",
                issues: [],
                metrics: {
                  failedExecutionsLastHour: 0,
                  blockedAgents: 0,
                  staleQuestions: 0,
                },
                lastUpdated: new Date().toISOString(),
              },
            }),
        });
      }
      if (url.includes("/activity")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [],
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
        <OverviewDashboard />
      </BrowserRouter>,
    );
  };

  describe("Loading state", () => {
    it("shows loading spinner initially", () => {
      renderWithRouter();
      // Loading spinner should be present briefly
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Stats display", () => {
    it("displays stat cards after loading", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Active Executions")).toBeInTheDocument();
      });
    });

    it("displays error rate card", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText(/Error Rate/)).toBeInTheDocument();
      });
    });

    it("displays blocked agents card", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Blocked Agents")).toBeInTheDocument();
      });
    });

    it("displays pending questions card", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Pending Questions")).toBeInTheDocument();
      });
    });
  });

  describe("Health indicator", () => {
    it("displays system health section", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("System Health")).toBeInTheDocument();
      });
    });

    it("shows healthy status when system is healthy", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Healthy")).toBeInTheDocument();
      });
    });
  });

  describe("Activity feed", () => {
    it("displays recent activity section", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      });
    });

    it("shows empty state when no activity", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("No recent activity")).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches stats, health, and activity on mount", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/stats"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/health"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/activity"),
        );
      });
    });
  });
});
