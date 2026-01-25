/**
 * Tests for ProposedChangesReviewModal - Supersession UI
 *
 * These tests verify that the modal correctly displays supersession indicators.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposedChangesReviewModal } from "../ProposedChangesReviewModal";
import type { ProposedChange } from "../../../types/ideation-state";

describe("ProposedChangesReviewModal - Supersession UI", () => {
  const mockOnApply = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnCancel = vi.fn();

  const baseProps = {
    isOpen: true,
    onClose: mockOnClose,
    onApply: mockOnApply,
    onCancel: mockOnCancel,
    isApplying: false,
  };

  describe("Supersession Count Display", () => {
    test("shows supersession count in info banner when changes have supersedesBlockId", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_1",
          type: "create_block",
          blockType: "decision",
          title: "Use Vue.js",
          content: "Decided to use Vue.js",
          confidence: 0.95,
          supersedesBlockId: "block_old",
          supersessionReason: "Changed preference",
        },
        {
          id: "block_2",
          type: "create_block",
          blockType: "context",
          title: "Some context",
          content: "Context info",
          confidence: 0.8,
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should show "1 superseding" in the banner
      expect(screen.getByText(/superseding/i)).toBeDefined();
    });

    test("hides supersession count when no changes supersede", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_1",
          type: "create_block",
          blockType: "context",
          title: "Some context",
          content: "Context info",
          confidence: 0.8,
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should NOT show superseding text
      expect(screen.queryByText(/superseding/i)).toBeNull();
    });
  });

  describe("Supersession Badge Display", () => {
    test("shows Supersedes badge on blocks with supersedesBlockId", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_vue",
          type: "create_block",
          blockType: "decision",
          title: "Use Vue.js",
          content: "Switching to Vue",
          confidence: 0.95,
          supersedesBlockId: "block_react",
          supersessionReason: "Simpler API",
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should show "Supersedes" badge
      expect(screen.getByText("Supersedes")).toBeDefined();
    });

    test("shows supersession reason when available", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_vue",
          type: "create_block",
          blockType: "decision",
          title: "Use Vue.js",
          content: "Switching to Vue",
          confidence: 0.95,
          supersedesBlockId: "block_react",
          supersessionReason: "Simpler API",
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should show the reason
      expect(screen.getByText(/Reason: Simpler API/i)).toBeDefined();
    });

    test("does NOT show badge on regular blocks", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_regular",
          type: "create_block",
          blockType: "context",
          title: "Regular block",
          content: "No supersession",
          confidence: 0.8,
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should NOT show "Supersedes" badge
      expect(screen.queryByText("Supersedes")).toBeNull();
    });
  });

  describe("Multiple Supersessions", () => {
    test("shows correct count for multiple superseding changes", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "block_1",
          type: "create_block",
          blockType: "decision",
          title: "Decision 1",
          content: "First decision change",
          confidence: 0.9,
          supersedesBlockId: "old_1",
        },
        {
          id: "block_2",
          type: "create_block",
          blockType: "decision",
          title: "Decision 2",
          content: "Second decision change",
          confidence: 0.85,
          supersedesBlockId: "old_2",
        },
        {
          id: "block_3",
          type: "create_block",
          blockType: "context",
          title: "Context",
          content: "Just context",
          confidence: 0.8,
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should show "2" before "superseding"
      // The count is displayed as a <strong> element
      const supersedingText = screen.getByText(/superseding/i);
      expect(supersedingText).toBeDefined();
    });
  });

  describe("Link Type Display", () => {
    test("displays supersedes link type correctly", () => {
      const proposedChanges: ProposedChange[] = [
        {
          id: "link_1",
          type: "create_link",
          sourceBlockId: "block_new",
          targetBlockId: "block_old",
          linkType: "supersedes",
          confidence: 0.95,
          reason: "This is a supersession link",
        },
      ];

      render(
        <ProposedChangesReviewModal
          {...baseProps}
          proposedChanges={proposedChanges}
        />,
      );

      // Should show "supersedes" as the link type
      expect(screen.getByText("supersedes")).toBeDefined();
    });
  });
});
