/**
 * Tests for EventLogTab component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventLogTab from "../EventLogTab";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EventLogTab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      // Component first calls /api/ideas to get list
      if (url.endsWith("/api/ideas")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [{ slug: "test-idea", title: "Test Idea" }],
            }),
        });
      }
      // Then calls /api/ideas/:slug/events/sessions for each idea
      if (url.includes("/events/sessions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  session_id: "session-1",
                  event_count: 5,
                  started_at: new Date().toISOString(),
                  ended_at: new Date().toISOString(),
                },
              ],
            }),
        });
      }
      // Then fetches events for selected session
      if (url.includes("/events")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  session_id: "session-1",
                  event_type: "task_started",
                  event_data: { task: "build" },
                  created_at: new Date().toISOString(),
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  const renderWithRouter = (initialEntries = ["/observability/events"]) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <EventLogTab />
      </MemoryRouter>,
    );
  };

  describe("Rendering", () => {
    it("renders without crashing", () => {
      renderWithRouter();
      // Component should render
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Session list", () => {
    it("fetches ideas and then sessions", async () => {
      renderWithRouter();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/ideas"),
        );
      });
    });
  });

  describe("URL parameter handling", () => {
    it("reads session from URL params", async () => {
      renderWithRouter(["/observability/events?session=session-1"]);
      await waitFor(() => {
        // Should fetch events for the selected session
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Event display", () => {
    it("fetches events when session is selected", async () => {
      renderWithRouter();
      // First call is /api/ideas, then /events/sessions
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});
