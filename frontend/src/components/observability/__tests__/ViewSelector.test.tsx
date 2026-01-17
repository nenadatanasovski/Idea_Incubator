/**
 * Tests for ViewSelector component
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewSelector, { ViewSelectorCompact } from "../ViewSelector";
import type { ObservabilityView } from "../../../types/observability";

describe("ViewSelector", () => {
  const defaultProps = {
    currentView: "timeline" as ObservabilityView,
    onViewChange: vi.fn(),
  };

  describe("Tab rendering", () => {
    it("renders all view tabs", () => {
      render(<ViewSelector {...defaultProps} />);

      expect(screen.getByText("Timeline")).toBeInTheDocument();
      expect(screen.getByText("Tools")).toBeInTheDocument();
      expect(screen.getByText("Assertions")).toBeInTheDocument();
      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Logs")).toBeInTheDocument();
    });

    it("renders tabs as buttons", () => {
      render(<ViewSelector {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(5);
    });
  });

  describe("Active state", () => {
    it("highlights timeline tab when timeline is active", () => {
      render(<ViewSelector {...defaultProps} currentView="timeline" />);

      const timelineTab = screen.getByText("Timeline").closest("button");
      expect(timelineTab).toHaveClass("border-blue-600");
      expect(timelineTab).toHaveClass("text-blue-600");
    });

    it("highlights tools tab when tool-uses is active", () => {
      render(<ViewSelector {...defaultProps} currentView="tool-uses" />);

      const toolsTab = screen.getByText("Tools").closest("button");
      expect(toolsTab).toHaveClass("border-blue-600");
      expect(toolsTab).toHaveClass("text-blue-600");
    });

    it("highlights assertions tab when assertions is active", () => {
      render(<ViewSelector {...defaultProps} currentView="assertions" />);

      const assertionsTab = screen.getByText("Assertions").closest("button");
      expect(assertionsTab).toHaveClass("border-blue-600");
    });

    it("highlights skills tab when skills is active", () => {
      render(<ViewSelector {...defaultProps} currentView="skills" />);

      const skillsTab = screen.getByText("Skills").closest("button");
      expect(skillsTab).toHaveClass("border-blue-600");
    });

    it("highlights logs tab when logs is active", () => {
      render(<ViewSelector {...defaultProps} currentView="logs" />);

      const logsTab = screen.getByText("Logs").closest("button");
      expect(logsTab).toHaveClass("border-blue-600");
    });
  });

  describe("View change", () => {
    it("calls onViewChange when tab is clicked", () => {
      const handleChange = vi.fn();
      render(<ViewSelector {...defaultProps} onViewChange={handleChange} />);

      fireEvent.click(screen.getByText("Tools"));

      expect(handleChange).toHaveBeenCalledWith("tool-uses");
    });

    it("calls onViewChange with correct view for each tab", () => {
      const handleChange = vi.fn();
      render(<ViewSelector {...defaultProps} onViewChange={handleChange} />);

      fireEvent.click(screen.getByText("Timeline"));
      expect(handleChange).toHaveBeenCalledWith("timeline");

      fireEvent.click(screen.getByText("Assertions"));
      expect(handleChange).toHaveBeenCalledWith("assertions");

      fireEvent.click(screen.getByText("Skills"));
      expect(handleChange).toHaveBeenCalledWith("skills");

      fireEvent.click(screen.getByText("Logs"));
      expect(handleChange).toHaveBeenCalledWith("logs");
    });
  });

  describe("Inactive tabs", () => {
    it("applies inactive styling to non-active tabs", () => {
      render(<ViewSelector {...defaultProps} currentView="timeline" />);

      const toolsTab = screen.getByText("Tools").closest("button");
      expect(toolsTab).toHaveClass("text-gray-500");
      expect(toolsTab).toHaveClass("border-transparent");
    });
  });
});

describe("ViewSelectorCompact", () => {
  const defaultProps = {
    currentView: "timeline" as ObservabilityView,
    onViewChange: vi.fn(),
  };

  describe("Select rendering", () => {
    it("renders as select element", () => {
      render(<ViewSelectorCompact {...defaultProps} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("renders all view options", () => {
      render(<ViewSelectorCompact {...defaultProps} />);

      expect(screen.getByText("Timeline")).toBeInTheDocument();
      expect(screen.getByText("Tools")).toBeInTheDocument();
      expect(screen.getByText("Assertions")).toBeInTheDocument();
      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Logs")).toBeInTheDocument();
    });
  });

  describe("Current value", () => {
    it("shows current view as selected", () => {
      render(
        <ViewSelectorCompact {...defaultProps} currentView="assertions" />,
      );

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("assertions");
    });
  });

  describe("View change", () => {
    it("calls onViewChange when option is selected", () => {
      const handleChange = vi.fn();
      render(
        <ViewSelectorCompact {...defaultProps} onViewChange={handleChange} />,
      );

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "skills" },
      });

      expect(handleChange).toHaveBeenCalledWith("skills");
    });
  });
});
