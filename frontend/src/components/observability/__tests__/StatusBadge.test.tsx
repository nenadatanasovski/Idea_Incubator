/**
 * Tests for StatusBadge component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge, { StatusIcon, StatusPulse } from "../StatusBadge";

describe("StatusBadge", () => {
  describe("Tool result statuses", () => {
    it("renders done status with green styling", () => {
      render(<StatusBadge status="done" />);

      expect(screen.getByText("Done")).toBeInTheDocument();
      const badge = screen.getByText("Done").closest("span");
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-600");
    });

    it("renders error status with red styling", () => {
      render(<StatusBadge status="error" />);

      expect(screen.getByText("Error")).toBeInTheDocument();
      const badge = screen.getByText("Error").closest("span");
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-600");
    });

    it("renders blocked status with orange styling", () => {
      render(<StatusBadge status="blocked" />);

      expect(screen.getByText("Blocked")).toBeInTheDocument();
      const badge = screen.getByText("Blocked").closest("span");
      expect(badge).toHaveClass("bg-orange-100");
      expect(badge).toHaveClass("text-orange-600");
    });
  });

  describe("Assertion result statuses", () => {
    it("renders pass status with green styling", () => {
      render(<StatusBadge status="pass" />);

      expect(screen.getByText("Pass")).toBeInTheDocument();
      const badge = screen.getByText("Pass").closest("span");
      expect(badge).toHaveClass("bg-green-100");
    });

    it("renders fail status with red styling", () => {
      render(<StatusBadge status="fail" />);

      expect(screen.getByText("Fail")).toBeInTheDocument();
      const badge = screen.getByText("Fail").closest("span");
      expect(badge).toHaveClass("bg-red-100");
    });

    it("renders skip status with gray styling", () => {
      render(<StatusBadge status="skip" />);

      expect(screen.getByText("Skip")).toBeInTheDocument();
      const badge = screen.getByText("Skip").closest("span");
      expect(badge).toHaveClass("bg-gray-100");
    });

    it("renders warn status with yellow styling", () => {
      render(<StatusBadge status="warn" />);

      expect(screen.getByText("Warn")).toBeInTheDocument();
      const badge = screen.getByText("Warn").closest("span");
      expect(badge).toHaveClass("bg-yellow-100");
    });
  });

  describe("Execution run statuses", () => {
    it("renders pending status with gray styling", () => {
      render(<StatusBadge status="pending" />);

      expect(screen.getByText("Pending")).toBeInTheDocument();
      const badge = screen.getByText("Pending").closest("span");
      expect(badge).toHaveClass("bg-gray-100");
    });

    it("renders running status with blue styling", () => {
      render(<StatusBadge status="running" />);

      expect(screen.getByText("Running")).toBeInTheDocument();
      const badge = screen.getByText("Running").closest("span");
      expect(badge).toHaveClass("bg-blue-100");
    });

    it("renders completed status with green styling", () => {
      render(<StatusBadge status="completed" />);

      expect(screen.getByText("Completed")).toBeInTheDocument();
      const badge = screen.getByText("Completed").closest("span");
      expect(badge).toHaveClass("bg-green-100");
    });

    it("renders failed status with red styling", () => {
      render(<StatusBadge status="failed" />);

      expect(screen.getByText("Failed")).toBeInTheDocument();
      const badge = screen.getByText("Failed").closest("span");
      expect(badge).toHaveClass("bg-red-100");
    });

    it("renders cancelled status with orange styling", () => {
      render(<StatusBadge status="cancelled" />);

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
      const badge = screen.getByText("Cancelled").closest("span");
      expect(badge).toHaveClass("bg-orange-100");
    });
  });

  describe("Size variants", () => {
    it("renders small size", () => {
      const { container } = render(<StatusBadge status="done" size="sm" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-3", "w-3");
    });

    it("renders medium size by default", () => {
      const { container } = render(<StatusBadge status="done" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });

    it("renders large size", () => {
      const { container } = render(<StatusBadge status="done" size="lg" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-5", "w-5");
    });
  });

  describe("Label visibility", () => {
    it("shows label by default", () => {
      render(<StatusBadge status="done" />);

      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("hides label when showLabel is false", () => {
      render(<StatusBadge status="done" showLabel={false} />);

      expect(screen.queryByText("Done")).not.toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(<StatusBadge status="done" className="my-custom-class" />);

      const badge = screen.getByText("Done").closest("span");
      expect(badge).toHaveClass("my-custom-class");
    });
  });
});

describe("StatusIcon", () => {
  it("renders icon only without label", () => {
    const { container } = render(<StatusIcon status="done" />);

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("applies correct color class", () => {
    const { container } = render(<StatusIcon status="error" />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass("text-red-600");
  });

  it("applies size class", () => {
    const { container } = render(<StatusIcon status="done" size="lg" />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass("h-5", "w-5");
  });

  it("applies custom className", () => {
    const { container } = render(
      <StatusIcon status="done" className="custom-icon" />,
    );

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass("custom-icon");
  });
});

describe("StatusPulse", () => {
  it("renders pulse indicator", () => {
    const { container } = render(<StatusPulse status="running" />);

    const pulseElement = container.querySelector(".animate-ping");
    expect(pulseElement).toBeInTheDocument();
  });

  it("shows pulse animation for running status", () => {
    const { container } = render(<StatusPulse status="running" />);

    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("shows pulse animation for pending status", () => {
    const { container } = render(<StatusPulse status="pending" />);

    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("does not show pulse animation for completed status", () => {
    const { container } = render(<StatusPulse status="completed" />);

    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
  });

  it("respects size prop", () => {
    const { container } = render(<StatusPulse status="running" size="lg" />);

    const pulse = container.querySelector(".h-4");
    expect(pulse).toBeInTheDocument();
  });
});
