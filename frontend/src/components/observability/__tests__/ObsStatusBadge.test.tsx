/**
 * Tests for ObsStatusBadge component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ObsStatusBadge from "../ObsStatusBadge";

describe("ObsStatusBadge", () => {
  describe("Tool result statuses", () => {
    it("renders success status correctly", () => {
      render(<ObsStatusBadge status="success" />);
      expect(screen.getByText("Success")).toBeInTheDocument();
    });

    it("renders error status correctly", () => {
      render(<ObsStatusBadge status="error" />);
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("renders blocked status correctly", () => {
      render(<ObsStatusBadge status="blocked" />);
      expect(screen.getByText("Blocked")).toBeInTheDocument();
    });

    it("renders running status correctly", () => {
      render(<ObsStatusBadge status="running" />);
      expect(screen.getByText("Running")).toBeInTheDocument();
    });
  });

  describe("Assertion result statuses", () => {
    it("renders pass status correctly", () => {
      render(<ObsStatusBadge status="pass" />);
      expect(screen.getByText("Pass")).toBeInTheDocument();
    });

    it("renders fail status correctly", () => {
      render(<ObsStatusBadge status="fail" />);
      expect(screen.getByText("Fail")).toBeInTheDocument();
    });

    it("renders warn status correctly", () => {
      render(<ObsStatusBadge status="warn" />);
      expect(screen.getByText("Warn")).toBeInTheDocument();
    });

    it("renders skip status correctly", () => {
      render(<ObsStatusBadge status="skip" />);
      expect(screen.getByText("Skip")).toBeInTheDocument();
    });
  });

  describe("Execution statuses", () => {
    it("renders completed status correctly", () => {
      render(<ObsStatusBadge status="completed" />);
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });

    it("renders failed execution status correctly", () => {
      render(<ObsStatusBadge status="failed" />);
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("renders pending status correctly", () => {
      render(<ObsStatusBadge status="pending" />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("renders small size", () => {
      render(<ObsStatusBadge status="success" size="sm" />);
      const labelSpan = screen.getByText("Success");
      expect(labelSpan).toHaveClass("text-xs");
    });

    it("renders medium size by default", () => {
      render(<ObsStatusBadge status="success" />);
      const labelSpan = screen.getByText("Success");
      expect(labelSpan).toHaveClass("text-sm");
    });

    it("renders large size", () => {
      render(<ObsStatusBadge status="success" size="lg" />);
      const labelSpan = screen.getByText("Success");
      expect(labelSpan).toHaveClass("text-base");
    });
  });

  describe("Label visibility", () => {
    it("shows label by default", () => {
      render(<ObsStatusBadge status="success" />);
      expect(screen.getByText("Success")).toBeInTheDocument();
    });

    it("hides label when showLabel is false", () => {
      render(<ObsStatusBadge status="success" showLabel={false} />);
      expect(screen.queryByText("Success")).not.toBeInTheDocument();
    });
  });
});
