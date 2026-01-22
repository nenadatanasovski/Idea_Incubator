/**
 * Graph Tab View TypeScript Interfaces
 * Defines types for the Memory Graph visualization in the Ideation Agent
 */

// ============================================================================
// Block Types
// ============================================================================

export type BlockType =
  | "content"
  | "link"
  | "meta"
  | "synthesis"
  | "pattern"
  | "decision"
  | "option"
  | "derived"
  | "assumption"
  | "cycle"
  | "placeholder"
  | "stakeholder_view"
  | "topic"
  | "external"
  | "action";

export type GraphType =
  | "problem"
  | "solution"
  | "market"
  | "risk"
  | "fit"
  | "business"
  | "spec";

export type BlockStatus =
  | "draft"
  | "active"
  | "validated"
  | "superseded"
  | "abandoned";

export type AbstractionLevel =
  | "vision"
  | "strategy"
  | "tactic"
  | "implementation";

export type SourceType =
  | "research_firm"
  | "primary_research"
  | "expert"
  | "anecdote"
  | "assumption"
  | "unknown";

// ============================================================================
// Link Types
// ============================================================================

export type LinkType =
  | "addresses"
  | "creates"
  | "requires"
  | "blocks"
  | "unblocks"
  | "supersedes"
  | "refines"
  | "replaces"
  | "contradicts"
  | "evidence_for"
  | "derived_from"
  | "implements"
  | "implemented_by"
  | "alternative_to"
  | "synthesizes"
  | "instance_of"
  | "about"
  | "excludes"
  | "includes"
  | "constrained_by"
  | "validates_claim";

export type LinkDegree = "full" | "partial" | "minimal";

// ============================================================================
// File Reference Types (from T9.6)
// ============================================================================

export interface FileReference {
  filePath: string;
  fileName: string;
  section?: string;
  lineRange?: { start: number; end: number };
  referenceType: "spec" | "code" | "doc" | "other";
}

// ============================================================================
// Graph Node Interface
// ============================================================================

export interface GraphNode {
  id: string;

  // Display properties
  label: string;
  subLabel?: string;

  // Block metadata
  blockType: BlockType;
  graphMembership: GraphType[];
  status: BlockStatus;
  confidence: number;
  abstractionLevel?: AbstractionLevel;

  // Temporal (from Scenario 8)
  createdAt: string;
  updatedAt: string;
  when?: string;
  duration?: string;
  plannedFor?: string;
  validUntil?: string;

  // Full content (for inspector)
  content: string;
  properties: Record<string, unknown>;

  // Source attribution (from Scenario 12)
  sourceType?: SourceType;
  sourceName?: string;
  sourceDate?: string;
  verifiable?: boolean;

  // Objectivity & certainty (from Scenarios 4, 13)
  objectivity?: "objective" | "subjective" | "mixed";
  hypothetical?: boolean;
  condition?: string;

  // Evidence chain (from Scenario 20)
  evidenceStrength?: "strong" | "moderate" | "weak";
  derivedConfidence?: number;

  // Derived block properties (from Scenario 19)
  formula?: string;
  computedValue?: unknown;
  computedAt?: string;
  stale?: boolean;
  overrideValue?: unknown;
  overrideReason?: string;

  // Action block properties (from Scenario 26)
  actionType?: "validate" | "research" | "build" | "decide" | "other";
  requiredCount?: number;
  completedCount?: number;
  assignedTo?: string;
  dueDate?: string;
  outcome?: "validated" | "invalidated" | "inconclusive";

  // Assumption block properties (from Scenario 21)
  impliedBy?: string;
  surfacedBy?: "ai" | "user" | "advisor";
  assumptionStatus?: "unvalidated" | "validated" | "invalidated" | "dismissed";
  criticality?: "critical" | "important" | "minor";

  // Decision/Option block properties (from Scenario 16)
  topic?: string;
  decidedOption?: string;
  decisionRationale?: string;
  selectionStatus?: "exploring" | "selected" | "rejected";
  alternativeTo?: string[];

  // Stakeholder view properties (from Scenario 24)
  stakeholder?: string;
  stakeholderRole?:
    | "decision_maker"
    | "domain_expert"
    | "advisor"
    | "team_member";
  viewStatus?: "active" | "adopted" | "overruled" | "withdrawn";

  // Placeholder block properties (from Scenario 23)
  placeholderFor?: string;
  researchQuery?: string;
  existenceConfirmed?: boolean;
  detailsUnknown?: boolean;

  // External block properties (from Scenario 25)
  url?: string;
  snapshotDate?: string;
  urlStatus?: "alive" | "redirected" | "dead" | "changed";
  domainCredibility?: "high" | "medium" | "low" | "very_low";

  // Meta block properties (from Scenario 5)
  metaType?:
    | "uncertainty"
    | "research_needed"
    | "assessment"
    | "question"
    | "commitment";
  about?: string;
  resolved?: boolean;

  // Cycle detection (from Scenario 22)
  cycleId?: string;
  cyclePosition?: number;
  cycleType?: "blocking" | "reinforcing";

  // Cross-idea patterns (from Scenario 15)
  scope?: string;
  instanceOf?: string;
  sharedWith?: string[];
  portfolioTag?: string;

  // Context-qualified properties (from Scenario 18)
  variesBy?: string;

  // Synthesis block properties (from Scenario 14)
  synthesizes?: string[];
  clusterTheme?: string;

  // Option block properties (from Scenario 16)
  decision?: string;

  // Topic block properties (from T7.3)
  decidedView?: string;
  decisionDate?: string;
  topicRationale?: string;
  stakeholderViews?: string[];

  // Assumption validation tracking (from Scenario 21)
  validationMethod?: string;
  validatedBy?: string;
  validatedAt?: string;

  // Evidence chain status (from Scenario 20)
  evidenceStatus?: "active" | "source_invalidated" | "source_superseded";

  // Placeholder partial info (from Scenario 23)
  partialInfo?: string[];

  // Stakeholder view resolution (from Scenario 24)
  incorporatedInto?: string;
  overruledReason?: string;

  // Cycle resolution (from Scenario 22)
  breakStrategy?: string;
  breakPoint?: string;

  // Artifact link (from T8.3)
  artifactId?: string;
  artifactType?: string;
  artifactSection?: string;

  // File references (from T9.6)
  fileReferences?: FileReference[];

  // Visual hints
  isHighlighted?: boolean;
  isSelected?: boolean;
  cluster?: string;
}

// ============================================================================
// Graph Edge Interface
// ============================================================================

export interface GraphEdge {
  id: string;
  source: string;
  target: string;

  // Link metadata
  linkType: LinkType;
  degree?: LinkDegree;
  confidence?: number;
  reason?: string;
  status: "active" | "superseded" | "removed";

  // Visual hints
  isHighlighted?: boolean;
}

// ============================================================================
// Visual Mapping Types
// ============================================================================

export const nodeColors: Record<BlockType, string> = {
  content: "#3B82F6", // Blue
  link: "#6B7280", // Gray (usually hidden)
  meta: "#F59E0B", // Amber
  synthesis: "#8B5CF6", // Purple
  pattern: "#EC4899", // Pink
  decision: "#EF4444", // Red
  option: "#F97316", // Orange
  derived: "#14B8A6", // Teal
  assumption: "#FBBF24", // Yellow
  cycle: "#DC2626", // Dark red
  placeholder: "#9CA3AF", // Light gray
  stakeholder_view: "#06B6D4", // Cyan
  topic: "#0EA5E9", // Light blue
  external: "#84CC16", // Lime
  action: "#22C55E", // Green
};

export const graphColors: Record<GraphType, string> = {
  problem: "#EF4444", // Red
  solution: "#22C55E", // Green
  market: "#3B82F6", // Blue
  risk: "#F59E0B", // Amber
  fit: "#8B5CF6", // Purple
  business: "#14B8A6", // Teal
  spec: "#6B7280", // Gray
};

export type NodeShape =
  | "hexagon"
  | "diamond"
  | "circle"
  | "triangle"
  | "square"
  | "pentagon"
  | "star";

export const nodeShapes: Record<GraphType, NodeShape> = {
  problem: "hexagon",
  solution: "diamond",
  market: "circle",
  risk: "triangle",
  fit: "square",
  business: "pentagon",
  spec: "star",
};

export const edgeColors: Record<LinkType, string> = {
  addresses: "#22C55E", // Green - positive
  creates: "#3B82F6", // Blue - creative
  requires: "#F59E0B", // Amber - dependency
  blocks: "#EF4444", // Red - blocker
  unblocks: "#22C55E", // Green - positive
  supersedes: "#6B7280", // Gray - temporal
  refines: "#8B5CF6", // Purple - refinement
  replaces: "#6B7280", // Gray - temporal
  contradicts: "#EF4444", // Red - conflict
  evidence_for: "#3B82F6", // Blue - support
  derived_from: "#14B8A6", // Teal - derivation
  implements: "#22C55E", // Green - implementation
  implemented_by: "#22C55E", // Green - implementation
  alternative_to: "#F97316", // Orange - options
  synthesizes: "#8B5CF6", // Purple - synthesis
  instance_of: "#EC4899", // Pink - pattern
  about: "#6B7280", // Gray - reference
  excludes: "#EF4444", // Red - exclusion
  includes: "#22C55E", // Green - inclusion
  constrained_by: "#F59E0B", // Amber - constraint
  validates_claim: "#3B82F6", // Blue - validation
};

export type EdgeStyle = "solid" | "dashed" | "dotted";

export const edgeStyles: Record<LinkType, EdgeStyle> = {
  addresses: "solid",
  creates: "solid",
  requires: "dashed",
  blocks: "solid",
  unblocks: "solid",
  supersedes: "dotted",
  refines: "dashed",
  replaces: "dotted",
  contradicts: "solid",
  evidence_for: "solid",
  derived_from: "dashed",
  implements: "solid",
  implemented_by: "solid",
  alternative_to: "dashed",
  synthesizes: "solid",
  instance_of: "dotted",
  about: "dotted",
  excludes: "solid",
  includes: "solid",
  constrained_by: "dashed",
  validates_claim: "solid",
};

// ============================================================================
// API Response Types (for transformation)
// ============================================================================

export interface ApiBlock {
  id: string;
  type: string;
  content: string;
  properties: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ApiLink {
  id: string;
  type: "link";
  properties: {
    link_type: string;
    source: string;
    target: string;
    degree?: string;
    confidence?: number;
    reason?: string;
    status?: string;
  };
}

// ============================================================================
// Filter Types
// ============================================================================

export interface GraphFilters {
  graphTypes: GraphType[];
  blockTypes: BlockType[];
  statuses: BlockStatus[];
  abstractionLevels: AbstractionLevel[];
  confidenceRange: [number, number];
}

export const defaultGraphFilters: GraphFilters = {
  graphTypes: [],
  blockTypes: [],
  statuses: [],
  abstractionLevels: [],
  confidenceRange: [0, 1],
};

// ============================================================================
// Graph Data State
// ============================================================================

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphDataState {
  data: GraphData;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}
