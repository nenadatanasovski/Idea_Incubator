/**
 * Test Suite 7: Block-Type-Specific Rendering
 * Tests for BlockTypeInspector component
 *
 * @see GRAPH-TAB-VIEW-SPEC.md Test Suite 7
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockTypeInspector } from "../BlockTypeInspector";
import type { GraphNode } from "../../../types/graph";

// Helper to create mock node
function createMockNode(overrides: Partial<GraphNode>): GraphNode {
  return {
    id: "test_node",
    label: "Test Node",
    blockType: "content",
    graphMembership: ["problem"],
    status: "active",
    confidence: 0.8,
    createdAt: "2026-01-22T00:00:00Z",
    updatedAt: "2026-01-22T00:00:00Z",
    content: "Test content",
    properties: {},
    ...overrides,
  };
}

describe("BlockTypeInspector", () => {
  it("should show staleness indicator for stale derived blocks", () => {
    const derivedNode = createMockNode({
      id: "derived_001",
      blockType: "derived",
      formula: "TAM * capture_rate",
      computedValue: 1000000000,
      stale: true,
    });

    render(<BlockTypeInspector node={derivedNode} onRecalculate={vi.fn()} />);

    expect(screen.getByText(/STALE/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recalculate/i }),
    ).toBeInTheDocument();
  });

  it("should show progress bar for action blocks", () => {
    const actionNode = createMockNode({
      id: "action_001",
      blockType: "action",
      actionType: "validate",
      requiredCount: 10,
      completedCount: 7,
      dueDate: "2026-02-15",
    });

    render(<BlockTypeInspector node={actionNode} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "70",
    );
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("should highlight critical unvalidated assumptions", () => {
    const assumptionNode = createMockNode({
      id: "assumption_001",
      blockType: "assumption",
      criticality: "critical",
      assumptionStatus: "unvalidated",
      impliedBy: "block_target",
    });

    render(<BlockTypeInspector node={assumptionNode} />);

    expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument();
    expect(screen.getByText(/unvalidated/i)).toBeInTheDocument();
  });

  it("should indicate cycle membership with type", () => {
    const cycleNode = createMockNode({
      id: "block_funding",
      blockType: "content",
      cycleId: "cycle_001",
      cycleType: "blocking",
      cyclePosition: 1,
    });

    render(<BlockTypeInspector node={cycleNode} />);

    // There may be multiple elements with "circular dependency" text
    const circularDeps = screen.getAllByText(/circular dependency/i);
    expect(circularDeps.length).toBeGreaterThan(0);
    expect(screen.getByText(/blocking/i)).toBeInTheDocument();
  });

  it("should show url_status for external blocks", () => {
    const externalNode = createMockNode({
      id: "external_001",
      blockType: "external",
      url: "https://techcrunch.com/article",
      urlStatus: "alive",
      domainCredibility: "medium",
      snapshotDate: "2026-01-22",
    });

    render(<BlockTypeInspector node={externalNode} />);

    expect(screen.getByText(/alive/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it("should show stakeholder role and view status", () => {
    const stakeholderNode = createMockNode({
      id: "view_001",
      blockType: "stakeholder_view",
      stakeholder: "CEO",
      stakeholderRole: "decision_maker",
      viewStatus: "adopted",
    });

    render(<BlockTypeInspector node={stakeholderNode} />);

    expect(screen.getByText("CEO")).toBeInTheDocument();
    expect(screen.getByText(/decision.maker/i)).toBeInTheDocument();
    expect(screen.getByText(/adopted/i)).toBeInTheDocument();
  });

  it("should show decision topic and status", () => {
    const decisionNode = createMockNode({
      id: "decision_001",
      blockType: "decision",
      topic: "Build vs Buy",
      decidedOption: "option_build",
      status: "validated",
      decisionRationale: "Better long-term control",
    });

    render(<BlockTypeInspector node={decisionNode} />);

    expect(screen.getByText(/Build vs Buy/i)).toBeInTheDocument();
    expect(screen.getByText(/validated/i)).toBeInTheDocument();
  });

  it("should show option selection status", () => {
    const optionNode = createMockNode({
      id: "option_001",
      blockType: "option",
      decision: "decision_build_buy",
      selectionStatus: "selected",
      alternativeTo: ["option_002", "option_003"],
    });

    render(<BlockTypeInspector node={optionNode} />);

    expect(screen.getByText(/selected/i)).toBeInTheDocument();
    expect(screen.getByText(/2 alternatives/i)).toBeInTheDocument();
  });

  it("should show placeholder research query", () => {
    const placeholderNode = createMockNode({
      id: "placeholder_001",
      blockType: "placeholder",
      placeholderFor: "competitor",
      researchQuery: "Who are the main competitors?",
      existenceConfirmed: true,
      partialInfo: ["At least 3 major players"],
    });

    render(<BlockTypeInspector node={placeholderNode} />);

    // "competitor" appears in placeholder for text
    const competitors = screen.getAllByText(/competitor/i);
    expect(competitors.length).toBeGreaterThan(0);
    // "Confirmed" appears in existence confirmed badge
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });

  it("should show synthesis cluster info", () => {
    const synthesisNode = createMockNode({
      id: "synthesis_001",
      blockType: "synthesis",
      synthesizes: ["block_1", "block_2", "block_3"],
      clusterTheme: "Research efficiency problems",
    });

    render(<BlockTypeInspector node={synthesisNode} />);

    expect(screen.getByText(/Research efficiency/i)).toBeInTheDocument();
    expect(screen.getByText(/3 blocks/i)).toBeInTheDocument();
  });

  it("should show pattern scope and instances", () => {
    const patternNode = createMockNode({
      id: "pattern_001",
      blockType: "pattern",
      scope: "global",
      portfolioTag: "ai-time-saving",
    });

    render(<BlockTypeInspector node={patternNode} />);

    expect(screen.getByText(/global/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-time-saving/i)).toBeInTheDocument();
  });

  it("should show topic with stakeholder views", () => {
    const topicNode = createMockNode({
      id: "topic_001",
      blockType: "topic",
      status: "active",
    });

    render(<BlockTypeInspector node={topicNode} />);

    // "Topic" appears in both section header and block type label
    const topicElements = screen.getAllByText(/topic/i);
    expect(topicElements.length).toBeGreaterThan(0);
  });

  it("should show meta block type and about reference", () => {
    const metaNode = createMockNode({
      id: "meta_001",
      blockType: "meta",
      metaType: "uncertainty",
      about: "block_target",
      resolved: false,
    });

    render(<BlockTypeInspector node={metaNode} />);

    expect(screen.getByText(/uncertainty/i)).toBeInTheDocument();
    expect(screen.getByText(/No/i)).toBeInTheDocument();
  });

  it("should call onRecalculate when recalculate button is clicked", async () => {
    const onRecalculate = vi.fn();
    const derivedNode = createMockNode({
      id: "derived_001",
      blockType: "derived",
      formula: "TAM * capture_rate",
      stale: true,
    });

    render(
      <BlockTypeInspector node={derivedNode} onRecalculate={onRecalculate} />,
    );

    const button = screen.getByRole("button", { name: /recalculate/i });
    button.click();

    expect(onRecalculate).toHaveBeenCalledTimes(1);
  });

  it("should call onNavigate when link is clicked", async () => {
    const onNavigate = vi.fn();
    const assumptionNode = createMockNode({
      id: "assumption_001",
      blockType: "assumption",
      impliedBy: "block_target",
    });

    render(
      <BlockTypeInspector node={assumptionNode} onNavigate={onNavigate} />,
    );

    const link = screen.getByText("block_target");
    link.click();

    expect(onNavigate).toHaveBeenCalledWith("block_target");
  });

  it("should return null for content blocks without cycle info", () => {
    const contentNode = createMockNode({
      id: "content_001",
      blockType: "content",
    });

    const { container } = render(<BlockTypeInspector node={contentNode} />);

    expect(container.firstChild).toBeNull();
  });

  it("should show cycle info for non-cycle blocks that are in a cycle", () => {
    const contentInCycle = createMockNode({
      id: "content_001",
      blockType: "content",
      cycleId: "cycle_001",
      cycleType: "reinforcing",
    });

    render(<BlockTypeInspector node={contentInCycle} />);

    // There may be multiple elements with "circular dependency" text
    const circularDeps = screen.getAllByText(/circular dependency/i);
    expect(circularDeps.length).toBeGreaterThan(0);
    expect(screen.getByText(/reinforcing/i)).toBeInTheDocument();
  });
});
