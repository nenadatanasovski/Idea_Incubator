/**
 * Tests for SkillTraceList component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SkillTraceList from "../SkillTraceList";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("SkillTraceList", () => {
  const executionId = "test-exec-001";

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/skills")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                skills: [
                  {
                    id: "skill-001",
                    skillName: "commit",
                    skillFile: "skills/commit/index.ts",
                    lineNumber: 42,
                    sectionTitle: "Creating commit message",
                    status: "completed",
                    durationMs: 1200,
                    tokenEstimate: 500,
                    toolCalls: ["tool-001", "tool-002"],
                  },
                  {
                    id: "skill-002",
                    skillName: "review-pr",
                    skillFile: "skills/review-pr/index.ts",
                    lineNumber: 10,
                    sectionTitle: null,
                    status: "running",
                    durationMs: null,
                    tokenEstimate: 200,
                    toolCalls: [],
                  },
                ],
                total: 2,
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
      render(<SkillTraceList executionId={executionId} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Skill list", () => {
    it("displays skill names", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("commit")).toBeInTheDocument();
        expect(screen.getByText("review-pr")).toBeInTheDocument();
      });
    });

    it("displays skill files with line numbers", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("skills/commit/index.ts")).toBeInTheDocument();
        expect(screen.getByText(":42")).toBeInTheDocument();
      });
    });

    it("displays section titles when available", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("Creating commit message")).toBeInTheDocument();
      });
    });

    it("displays skill count", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("2 skill invocations")).toBeInTheDocument();
      });
    });
  });

  describe("Duration and tokens", () => {
    it("displays duration when available", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("1200ms")).toBeInTheDocument();
      });
    });

    it("displays token estimate when available", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("500 tokens")).toBeInTheDocument();
      });
    });
  });

  describe("Tool calls summary", () => {
    it("displays tool calls count when available", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText("2 tool calls")).toBeInTheDocument();
      });
    });
  });

  describe("Skill click", () => {
    it("calls onSkillClick when skill is clicked", async () => {
      const handleClick = vi.fn();
      render(
        <SkillTraceList executionId={executionId} onSkillClick={handleClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText("commit")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("commit"));

      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "skill-001",
          skillName: "commit",
        }),
      );
    });
  });

  describe("Empty state", () => {
    it("shows empty message when no skills", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/skills")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { skills: [], total: 0, hasMore: false },
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(
          screen.getByText("No skill invocations found"),
        ).toBeInTheDocument();
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

      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(screen.getByText(/Error loading skills/)).toBeInTheDocument();
      });
    });
  });

  describe("API calls", () => {
    it("fetches skills with correct execution ID", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(executionId),
        );
      });
    });

    it("includes limit in fetch request", async () => {
      render(<SkillTraceList executionId={executionId} />);
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/limit=50/),
        );
      });
    });
  });
});
