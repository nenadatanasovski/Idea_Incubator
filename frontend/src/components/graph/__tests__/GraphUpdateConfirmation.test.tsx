/**
 * GraphUpdateConfirmation Component Tests
 * @see GRAPH-TAB-VIEW-SPEC.md Test 10.1
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphUpdateConfirmation } from "../GraphUpdateConfirmation";
import type { NewBlockUpdate, CascadeEffect } from "../GraphUpdateConfirmation";

describe("GraphUpdateConfirmation", () => {
  const mockNewBlock: NewBlockUpdate = {
    id: "new_block_1",
    content: "We're targeting enterprise now",
    suggestedType: "content",
    suggestedGraph: ["market"],
    confidence: 0.85,
  };

  const mockCascadeEffects: CascadeEffect = {
    affectedNodes: [
      {
        id: "block_smb",
        content: "Target: SMB customers",
        currentStatus: "active",
        proposedAction: "supersedes",
        reason: "New target market specified",
      },
      {
        id: "block_pricing",
        content: "SMB pricing model: $29/mo",
        currentStatus: "active",
        proposedAction: "invalidates",
        reason: "Pricing may not apply to enterprise",
      },
    ],
    newLinks: [],
    conflicts: [],
    impactRadius: 1,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    newBlock: mockNewBlock,
    cascadeEffects: mockCascadeEffects,
    onConfirmAll: vi.fn(),
    onReviewEach: vi.fn(),
    onCancel: vi.fn(),
  };

  it("should not render when isOpen is false", () => {
    render(<GraphUpdateConfirmation {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByTestId("graph-update-confirmation"),
    ).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByTestId("graph-update-confirmation")).toBeInTheDocument();
  });

  it("should display new block content", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText(/targeting enterprise/i)).toBeInTheDocument();
  });

  it("should display new block type", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText(/content/i)).toBeInTheDocument();
  });

  it("should display confidence percentage", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it("should display affected nodes count", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText("2")).toBeInTheDocument(); // 2 affected nodes
  });

  it("should display impact radius", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText(/1 hop/i)).toBeInTheDocument();
  });

  it("should call onConfirmAll when Confirm All clicked", () => {
    const onConfirmAll = vi.fn();

    render(
      <GraphUpdateConfirmation {...defaultProps} onConfirmAll={onConfirmAll} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm all/i }));

    expect(onConfirmAll).toHaveBeenCalledTimes(1);
  });

  it("should call onReviewEach when Review Each clicked", () => {
    const onReviewEach = vi.fn();

    render(
      <GraphUpdateConfirmation {...defaultProps} onReviewEach={onReviewEach} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /review each/i }));

    expect(onReviewEach).toHaveBeenCalledTimes(1);
  });

  it("should call onClose and onCancel when Cancel clicked", () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();

    render(
      <GraphUpdateConfirmation
        {...defaultProps}
        onClose={onClose}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("should show conflicts warning when conflicts exist", () => {
    const propsWithConflicts = {
      ...defaultProps,
      cascadeEffects: {
        ...mockCascadeEffects,
        conflicts: [
          {
            nodeId: "block_pricing",
            type: "contradiction" as const,
            description: "Conflicting pricing strategy",
          },
        ],
      },
    };

    render(<GraphUpdateConfirmation {...propsWithConflicts} />);

    expect(screen.getByText(/1 conflict/i)).toBeInTheDocument();
  });

  it("should enter review mode when Review Each is clicked", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /review each/i }));

    // Should show pending review count
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("should display suggested graphs for new block", () => {
    render(<GraphUpdateConfirmation {...defaultProps} />);

    expect(screen.getByText(/market/i)).toBeInTheDocument();
  });

  it("should be disabled when isProcessing is true", () => {
    render(<GraphUpdateConfirmation {...defaultProps} isProcessing={true} />);

    const confirmButton = screen.getByRole("button", { name: /processing/i });
    expect(confirmButton).toBeDisabled();
  });
});
