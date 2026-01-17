/**
 * Tests for ObservabilityContainer component
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import ObservabilityContainer from "../ObservabilityContainer";

// Mock child components
vi.mock("../ObservabilityHeader", () => ({
  default: () => <div data-testid="obs-header">Header</div>,
}));

vi.mock("../ObservabilitySubTabs", () => ({
  default: () => <div data-testid="obs-subtabs">SubTabs</div>,
}));

describe("ObservabilityContainer", () => {
  const renderWithRouter = (initialEntries = ["/observability"]) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <ObservabilityContainer>
          <div data-testid="content">Content</div>
        </ObservabilityContainer>
      </MemoryRouter>,
    );
  };

  describe("Rendering", () => {
    it("renders without crashing", () => {
      renderWithRouter();
      expect(screen.getByTestId("obs-header")).toBeInTheDocument();
    });

    it("renders header component", () => {
      renderWithRouter();
      expect(screen.getByTestId("obs-header")).toBeInTheDocument();
    });

    it("renders sub-tabs component", () => {
      renderWithRouter();
      expect(screen.getByTestId("obs-subtabs")).toBeInTheDocument();
    });

    it("has main container class", () => {
      const { container } = renderWithRouter();
      expect(container.querySelector(".flex-col")).toBeInTheDocument();
    });
  });

  describe("Layout structure", () => {
    it("renders header at the top", () => {
      const { container } = renderWithRouter();
      const header = screen.getByTestId("obs-header");
      const subtabs = screen.getByTestId("obs-subtabs");

      // Header should come before subtabs in DOM order
      expect(
        header.compareDocumentPosition(subtabs) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});
