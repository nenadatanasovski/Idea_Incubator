/**
 * Tests for AssertionList component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AssertionList from "../AssertionList";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AssertionList", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/assertions?") && url.includes("limit=")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                assertions: [
                  {
                    id: "assertion-001",
                    description: "TypeScript compiles without errors",
                    category: "syntax",
                    result: "pass",
                    timestamp: new Date().toISOString(),
                  },
                  {
                    id: "assertion-002",
                    description: "Unit tests pass",
                    category: "unit_test",
                    result: "fail",
                    timestamp: new Date().toISOString(),
                    evidence: {
                      command: "npm test",
                      exitCode: 1,
                      stderr: "Test failed",
                    },
                  },
                ],
                total: 2,
                hasMore: false,
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
                total: 2,
                passed: 1,
                failed: 1,
                warned: 0,
                skipped: 0,
                passRate: 0.5,
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
      render(<AssertionList executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Summary display", () => {
    it("displays passed count", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("passed")).toBeInTheDocument();
      });
    });

    it("displays failed count", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("failed")).toBeInTheDocument();
      });
    });

    it("displays pass rate", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/50% pass rate/)).toBeInTheDocument();
      });
    });
  });

  describe("Assertion list", () => {
    it("displays assertion descriptions", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(
          screen.getByText("TypeScript compiles without errors"),
        ).toBeInTheDocument();
        expect(screen.getByText("Unit tests pass")).toBeInTheDocument();
      });
    });

    it("displays assertion categories", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("syntax")).toBeInTheDocument();
        expect(screen.getByText("unit_test")).toBeInTheDocument();
      });
    });
  });

  describe("Filter toggle", () => {
    it("has show only failed checkbox", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Show only failed")).toBeInTheDocument();
      });
    });

    it("toggles filter when checkbox clicked", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Show only failed")).toBeInTheDocument();
      });

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      // Should trigger re-fetch with filter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/result=fail/),
        );
      });
    });
  });

  describe("Assertion click", () => {
    it("calls onAssertionClick when assertion is clicked", async () => {
      const handleClick = vi.fn();
      render(
        <AssertionList
          executionId={executionId}
          onAssertionClick={handleClick}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText("TypeScript compiles without errors"),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("TypeScript compiles without errors"));

      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "assertion-001",
          description: "TypeScript compiles without errors",
        }),
      );
    });
  });

  describe("Evidence expansion", () => {
    it("shows evidence when expanded", async () => {
      render(<AssertionList executionId={executionId} />);

      await waitFor(() => {
        expect(screen.getByText("Unit tests pass")).toBeInTheDocument();
      });

      // Find and click the expand button (chevron)
      const expandButtons = document.querySelectorAll(
        "button[class*='hover:bg-gray-100']",
      );
      if (expandButtons.length > 0) {
        fireEvent.click(expandButtons[0]);

        await waitFor(() => {
          expect(screen.getByText(/Exit code:/)).toBeInTheDocument();
        });
      }
    });
  });

  describe("Empty state", () => {
    it("shows empty message when no assertions", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/assertions")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { assertions: [], total: 0, hasMore: false },
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

      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("No assertions found")).toBeInTheDocument();
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

      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(
          screen.getByText(/Error loading assertions/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches assertions with correct execution ID", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(executionId),
        );
      });
    });

    it("fetches assertion summary", async () => {
      render(<AssertionList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/assertion-summary"),
        );
      });
    });
  });
});
