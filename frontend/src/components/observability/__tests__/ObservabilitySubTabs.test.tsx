/**
 * Tests for ObservabilitySubTabs component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ObservabilitySubTabs from "../ObservabilitySubTabs";

describe("ObservabilitySubTabs", () => {
  const renderWithRouter = (initialEntries = ["/observability"]) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <ObservabilitySubTabs activeTab="overview" />
      </MemoryRouter>,
    );
  };

  describe("Tab rendering", () => {
    it("renders all sub-tabs", () => {
      renderWithRouter();
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("Debate Events")).toBeInTheDocument();
      expect(screen.getByText("Executions")).toBeInTheDocument();
      expect(screen.getByText("Agents")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });

    it("renders tabs as navigation links", () => {
      renderWithRouter();
      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Active state", () => {
    it("highlights Overview tab when on /observability", () => {
      renderWithRouter(["/observability"]);
      const overviewLink = screen.getByText("Overview").closest("a");
      expect(overviewLink).toHaveAttribute("href", "/observability");
    });

    it("highlights Events tab when on /observability/events", () => {
      renderWithRouter(["/observability/events"]);
      const eventsLink = screen.getByText("Debate Events").closest("a");
      expect(eventsLink).toHaveAttribute("href", "/observability/events");
    });

    it("highlights Executions tab when on /observability/executions", () => {
      renderWithRouter(["/observability/executions"]);
      const execLink = screen.getByText("Executions").closest("a");
      expect(execLink).toHaveAttribute("href", "/observability/executions");
    });
  });

  describe("Navigation structure", () => {
    it("renders as nav element", () => {
      renderWithRouter();
      const nav = screen.getByRole("navigation");
      expect(nav).toBeInTheDocument();
    });

    it("contains all tab links", () => {
      renderWithRouter();
      const nav = screen.getByRole("navigation");
      expect(nav.querySelectorAll("a").length).toBe(5);
    });
  });
});
