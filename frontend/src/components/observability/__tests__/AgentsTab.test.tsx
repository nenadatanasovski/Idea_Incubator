/**
 * Tests for AgentsTab component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AgentsTab from "../AgentsTab";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AgentsTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: "agent-1",
                  name: "Build Agent 1",
                  type: "build",
                  status: "running",
                  lastHeartbeat: new Date().toISOString(),
                  metrics: {
                    tasksCompleted: 10,
                    tasksFailed: 2,
                    avgDuration: 5000,
                    questionsAsked: 3,
                    questionsAnswered: 2,
                  },
                },
                {
                  id: "agent-2",
                  name: "Spec Agent",
                  type: "spec",
                  status: "idle",
                  lastHeartbeat: new Date().toISOString(),
                  metrics: {
                    tasksCompleted: 5,
                    tasksFailed: 0,
                    avgDuration: 3000,
                    questionsAsked: 1,
                    questionsAnswered: 1,
                  },
                },
              ],
            }),
        });
      }
      if (url.includes("/api/questions/pending")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: "q-1",
                  agentId: "agent-1",
                  question: "Should I proceed with the migration?",
                  status: "pending",
                  createdAt: new Date().toISOString(),
                  priority: 80,
                },
              ],
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
        <AgentsTab />
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
    it("displays Agent Monitoring heading", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Agent Monitoring")).toBeInTheDocument();
      });
    });

    it("displays refresh button", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });

  describe("Summary cards", () => {
    it("displays Total Agents count", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Total Agents")).toBeInTheDocument();
      });
    });

    it("displays Running count", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Running")).toBeInTheDocument();
      });
    });

    it("displays Blocked count", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Blocked")).toBeInTheDocument();
      });
    });

    it("displays Errors count", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Errors")).toBeInTheDocument();
      });
    });
  });

  describe("Agent grid", () => {
    it("displays Agent Status section", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Agent Status")).toBeInTheDocument();
      });
    });

    it("renders agent cards", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText("Build Agent 1")).toBeInTheDocument();
        expect(screen.getByText("Spec Agent")).toBeInTheDocument();
      });
    });
  });

  describe("Blocking questions", () => {
    it("displays Blocking Questions section", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(screen.getByText(/Blocking Questions/)).toBeInTheDocument();
      });
    });

    it("renders pending questions", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(
          screen.getByText("Should I proceed with the migration?"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches agents and questions on mount", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/agents"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/questions/pending"),
        );
      });
    });
  });
});
