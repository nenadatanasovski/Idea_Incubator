/**
 * Tests for Breadcrumb component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Breadcrumb, { buildExecutionBreadcrumb } from "../Breadcrumb";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("Breadcrumb", () => {
  describe("Rendering", () => {
    it("renders home link", () => {
      renderWithRouter(<Breadcrumb segments={[]} />);

      const homeLink = screen.getByRole("link");
      expect(homeLink).toHaveAttribute("href", "/observability");
    });

    it("renders segment labels", () => {
      renderWithRouter(
        <Breadcrumb
          segments={[{ label: "Executions" }, { label: "exec-12345678" }]}
        />,
      );

      expect(screen.getByText("Executions")).toBeInTheDocument();
      expect(screen.getByText("exec-12345678")).toBeInTheDocument();
    });

    it("renders segment links when href is provided", () => {
      renderWithRouter(
        <Breadcrumb
          segments={[
            { label: "Executions", href: "/observability" },
            { label: "exec-123", href: "/observability/executions/exec-123" },
          ]}
        />,
      );

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(3); // Home + 2 segments
    });
  });

  describe("Navigation", () => {
    it("has accessibility label", () => {
      renderWithRouter(<Breadcrumb segments={[{ label: "Test" }]} />);

      expect(screen.getByRole("navigation")).toHaveAttribute(
        "aria-label",
        "Breadcrumb",
      );
    });

    it("marks last segment as current page", () => {
      renderWithRouter(
        <Breadcrumb
          segments={[
            { label: "Executions", href: "/observability" },
            { label: "Current Page" },
          ]}
        />,
      );

      const currentPage = screen.getByText("Current Page");
      expect(currentPage).toHaveAttribute("aria-current", "page");
    });

    it("applies font-medium to last segment", () => {
      renderWithRouter(
        <Breadcrumb
          segments={[{ label: "First" }, { label: "Last Segment" }]}
        />,
      );

      const lastSegment = screen.getByText("Last Segment");
      expect(lastSegment).toHaveClass("font-medium");
    });
  });

  describe("Separators", () => {
    it("renders chevron separators between segments", () => {
      const { container } = renderWithRouter(
        <Breadcrumb
          segments={[
            { label: "First" },
            { label: "Second" },
            { label: "Third" },
          ]}
        />,
      );

      // Each segment has a chevron before it
      const chevrons = container.querySelectorAll(".text-gray-400");
      expect(chevrons.length).toBe(3);
    });
  });

  describe("Screen reader text", () => {
    it("has screen reader text for home link", () => {
      renderWithRouter(<Breadcrumb segments={[]} />);

      expect(screen.getByText("Observability")).toHaveClass("sr-only");
    });
  });
});

describe("buildExecutionBreadcrumb", () => {
  it("builds breadcrumb with execution ID", () => {
    const segments = buildExecutionBreadcrumb("exec-12345678-abcd");

    expect(segments).toEqual([
      { label: "Executions", href: "/observability" },
      {
        label: "exec-123",
        href: "/observability/executions/exec-12345678-abcd",
      },
    ]);
  });

  it("truncates execution ID to 8 characters", () => {
    const segments = buildExecutionBreadcrumb(
      "very-long-execution-id-that-should-be-truncated",
    );

    expect(segments[1].label).toBe("very-lon");
  });

  it("appends additional segments", () => {
    const segments = buildExecutionBreadcrumb("exec-123", [
      { label: "Timeline" },
    ]);

    expect(segments).toHaveLength(3);
    expect(segments[2]).toEqual({ label: "Timeline" });
  });

  it("appends multiple additional segments", () => {
    const segments = buildExecutionBreadcrumb("exec-123", [
      { label: "Task", href: "/task/123" },
      { label: "Details" },
    ]);

    expect(segments).toHaveLength(4);
    expect(segments[2]).toEqual({ label: "Task", href: "/task/123" });
    expect(segments[3]).toEqual({ label: "Details" });
  });
});
