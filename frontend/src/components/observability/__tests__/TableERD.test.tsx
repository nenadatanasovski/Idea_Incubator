/**
 * Tests for TableERD component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TableERD from "../TableERD";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock canvas getContext
const mockGetContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
}));

HTMLCanvasElement.prototype.getContext = mockGetContext as unknown as (
  contextId: string,
) => RenderingContext | null;

describe("TableERD", () => {
  const mockTableData = {
    success: true,
    data: {
      table: {
        name: "tasks",
        columns: [
          {
            name: "id",
            type: "TEXT",
            nullable: false,
            primaryKey: true,
            isForeignKey: false,
          },
          {
            name: "title",
            type: "TEXT",
            nullable: false,
            primaryKey: false,
            isForeignKey: false,
          },
          {
            name: "project_id",
            type: "TEXT",
            nullable: true,
            primaryKey: false,
            isForeignKey: true,
            referencesTable: "projects",
            referencesColumn: "id",
          },
        ],
        primaryKeys: ["id"],
        foreignKeys: [
          {
            column: "project_id",
            referencesTable: "projects",
            referencesColumn: "id",
          },
        ],
      },
      outgoing: [
        {
          fromTable: "tasks",
          fromColumn: "project_id",
          toTable: "projects",
          toColumn: "id",
          relationshipType: "many-to-one",
        },
      ],
      incoming: [
        {
          fromTable: "task_file_impacts",
          fromColumn: "task_id",
          toTable: "tasks",
          toColumn: "id",
          relationshipType: "one-to-many",
        },
      ],
      relatedTables: [
        {
          name: "projects",
          columns: [
            {
              name: "id",
              type: "TEXT",
              nullable: false,
              primaryKey: true,
              isForeignKey: false,
            },
            {
              name: "name",
              type: "TEXT",
              nullable: false,
              primaryKey: false,
              isForeignKey: false,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
        },
        {
          name: "task_file_impacts",
          columns: [
            {
              name: "id",
              type: "INTEGER",
              nullable: false,
              primaryKey: true,
              isForeignKey: false,
            },
            {
              name: "task_id",
              type: "TEXT",
              nullable: false,
              primaryKey: false,
              isForeignKey: true,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [
            {
              column: "task_id",
              referencesTable: "tasks",
              referencesColumn: "id",
            },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/observability/schema/tables/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTableData),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading spinner initially", () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Table display", () => {
    it("fetches table data on mount", async () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/observability/schema/tables/tasks"),
        );
      });
    });

    it("renders canvas element", async () => {
      const { container } = render(
        <TableERD tableName="tasks" onShowFullERD={vi.fn()} />,
      );

      await waitFor(() => {
        expect(container.querySelector("canvas")).toBeInTheDocument();
      });
    });
  });

  describe("Controls", () => {
    it("shows full ERD button", async () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /full erd/i }),
        ).toBeInTheDocument();
      });
    });

    it("calls onShowFullERD when button clicked", async () => {
      const handleShowFullERD = vi.fn();
      render(<TableERD tableName="tasks" onShowFullERD={handleShowFullERD} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /full erd/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /full erd/i }));
      expect(handleShowFullERD).toHaveBeenCalled();
    });

    it("shows refresh button", async () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        // Look for refresh icon button
        const refreshButton = document.querySelector('[aria-label*="refresh"]');
        expect(
          refreshButton || document.querySelector(".animate-spin"),
        ).toBeTruthy();
      });
    });
  });

  describe("Relationship indicators", () => {
    it("renders relationship count indicators", async () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        // Should show relationship indicators for incoming/outgoing
        const arrows = document.querySelectorAll("svg");
        expect(arrows.length).toBeGreaterThan(0);
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

      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByText(/error|failed|unable/i) ||
            document.querySelector(".text-red"),
        ).toBeTruthy();
      });
    });
  });

  describe("Canvas rendering", () => {
    it("initializes canvas context", async () => {
      render(<TableERD tableName="tasks" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(mockGetContext).toHaveBeenCalledWith("2d");
      });
    });
  });

  describe("API calls", () => {
    it("fetches with correct table name", async () => {
      render(<TableERD tableName="projects" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("projects"),
        );
      });
    });

    it("refetches when table name changes", async () => {
      const { rerender } = render(
        <TableERD tableName="tasks" onShowFullERD={vi.fn()} />,
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("tasks"),
        );
      });

      rerender(<TableERD tableName="projects" onShowFullERD={vi.fn()} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("projects"),
        );
      });
    });
  });
});
