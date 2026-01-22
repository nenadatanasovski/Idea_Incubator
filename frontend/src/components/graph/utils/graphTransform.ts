/**
 * Graph Data Transformation Utilities
 * Transforms API block/link data into Reagraph-compatible node/edge formats
 */

import type {
  GraphNode,
  GraphEdge,
  ApiBlock,
  ApiLink,
  BlockType,
  GraphType,
  BlockStatus,
  LinkType,
  LinkDegree,
  AbstractionLevel,
  SourceType,
} from "../../../types/graph";

// Graph type keywords to detect in properties
const GRAPH_TYPE_KEYWORDS: Record<GraphType, string[]> = {
  problem: ["problem", "pain_point", "challenge", "issue", "obstacle"],
  solution: ["solution", "approach", "method", "strategy", "tool"],
  market: ["market", "tam", "sam", "som", "customer", "segment", "market_size"],
  risk: ["risk", "threat", "vulnerability", "weakness", "concern"],
  fit: ["fit", "alignment", "match", "suitability", "compatibility"],
  business: [
    "business",
    "revenue",
    "cost",
    "pricing",
    "monetization",
    "unit_economics",
  ],
  spec: ["spec", "specification", "requirement", "feature", "implementation"],
};

/**
 * Detect graph memberships based on properties
 */
function detectGraphMembership(
  properties: Record<string, unknown>,
): GraphType[] {
  const memberships: Set<GraphType> = new Set();
  const propKeys = Object.keys(properties).map((k) => k.toLowerCase());
  const propValues = Object.values(properties)
    .filter((v) => typeof v === "string")
    .map((v) => (v as string).toLowerCase());

  for (const [graphType, keywords] of Object.entries(GRAPH_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      // Check if any property key contains the keyword
      if (propKeys.some((key) => key.includes(keyword))) {
        memberships.add(graphType as GraphType);
        break;
      }
      // Check if any string property value contains the keyword
      if (propValues.some((val) => val.includes(keyword))) {
        memberships.add(graphType as GraphType);
        break;
      }
    }
  }

  // Default to "problem" if no membership detected (content blocks should belong somewhere)
  if (memberships.size === 0) {
    memberships.add("problem");
  }

  return Array.from(memberships);
}

/**
 * Truncate content for display label
 */
function createLabel(content: string, maxLength = 50): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + "...";
}

/**
 * Extract confidence from properties
 */
function extractConfidence(properties: Record<string, unknown>): number {
  if (typeof properties.confidence === "number") {
    return properties.confidence;
  }
  if (typeof properties.confidence === "string") {
    const parsed = parseFloat(properties.confidence);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  // Default confidence
  return 0.5;
}

/**
 * Transform API blocks to GraphNode format
 */
export function transformBlocksToNodes(blocks: ApiBlock[]): GraphNode[] {
  return blocks
    .filter((block) => block.type !== "link") // Filter out link blocks (they become edges)
    .map((block) => {
      const props = block.properties || {};

      const node: GraphNode = {
        id: block.id,
        label: createLabel(block.content),
        blockType: block.type as BlockType,
        graphMembership: detectGraphMembership(props),
        status: (block.status as BlockStatus) || "active",
        confidence: extractConfidence(props),
        content: block.content,
        properties: props,
        createdAt: block.created_at,
        updatedAt: block.updated_at,
      };

      // Extract optional properties based on block type
      if (props.abstraction_level) {
        node.abstractionLevel = props.abstraction_level as AbstractionLevel;
      }

      // Source attribution
      if (props.source_type) {
        node.sourceType = props.source_type as SourceType;
      }
      if (props.source_name) {
        node.sourceName = props.source_name as string;
      }
      if (props.source_date) {
        node.sourceDate = props.source_date as string;
      }

      // Temporal properties
      if (props.when) {
        node.when = props.when as string;
      }
      if (props.duration) {
        node.duration = props.duration as string;
      }
      if (props.planned_for) {
        node.plannedFor = props.planned_for as string;
      }
      if (props.valid_until) {
        node.validUntil = props.valid_until as string;
      }

      // Objectivity
      if (props.objectivity) {
        node.objectivity = props.objectivity as
          | "objective"
          | "subjective"
          | "mixed";
      }
      if (props.hypothetical !== undefined) {
        node.hypothetical = props.hypothetical as boolean;
      }
      if (props.condition) {
        node.condition = props.condition as string;
      }

      // Evidence chain
      if (props.evidence_strength) {
        node.evidenceStrength = props.evidence_strength as
          | "strong"
          | "moderate"
          | "weak";
      }
      if (props.derived_confidence !== undefined) {
        node.derivedConfidence = props.derived_confidence as number;
      }

      // Derived block
      if (props.formula) {
        node.formula = props.formula as string;
      }
      if (props.computed_value !== undefined) {
        node.computedValue = props.computed_value;
      }
      if (props.stale !== undefined) {
        node.stale = props.stale as boolean;
      }

      // Action block
      if (props.action_type) {
        node.actionType = props.action_type as
          | "validate"
          | "research"
          | "build"
          | "decide"
          | "other";
      }
      if (props.required_count !== undefined) {
        node.requiredCount = props.required_count as number;
      }
      if (props.completed_count !== undefined) {
        node.completedCount = props.completed_count as number;
      }
      if (props.due_date) {
        node.dueDate = props.due_date as string;
      }

      // Assumption block
      if (props.implied_by) {
        node.impliedBy = props.implied_by as string;
      }
      if (props.surfaced_by) {
        node.surfacedBy = props.surfaced_by as "ai" | "user" | "advisor";
      }
      if (props.assumption_status) {
        node.assumptionStatus = props.assumption_status as
          | "unvalidated"
          | "validated"
          | "invalidated"
          | "dismissed";
      }
      if (props.criticality) {
        node.criticality = props.criticality as
          | "critical"
          | "important"
          | "minor";
      }

      // Decision/Option block
      if (props.topic) {
        node.topic = props.topic as string;
      }
      if (props.decided_option) {
        node.decidedOption = props.decided_option as string;
      }
      if (props.selection_status) {
        node.selectionStatus = props.selection_status as
          | "exploring"
          | "selected"
          | "rejected";
      }

      // Stakeholder view
      if (props.stakeholder) {
        node.stakeholder = props.stakeholder as string;
      }
      if (props.stakeholder_role) {
        node.stakeholderRole = props.stakeholder_role as
          | "decision_maker"
          | "domain_expert"
          | "advisor"
          | "team_member";
      }
      if (props.view_status) {
        node.viewStatus = props.view_status as
          | "active"
          | "adopted"
          | "overruled"
          | "withdrawn";
      }

      // Placeholder block
      if (props.placeholder_for) {
        node.placeholderFor = props.placeholder_for as string;
      }
      if (props.research_query) {
        node.researchQuery = props.research_query as string;
      }

      // External block
      if (props.url) {
        node.url = props.url as string;
      }
      if (props.url_status) {
        node.urlStatus = props.url_status as
          | "alive"
          | "redirected"
          | "dead"
          | "changed";
      }
      if (props.domain_credibility) {
        node.domainCredibility = props.domain_credibility as
          | "high"
          | "medium"
          | "low"
          | "very_low";
      }

      // Meta block
      if (props.meta_type) {
        node.metaType = props.meta_type as
          | "uncertainty"
          | "research_needed"
          | "assessment"
          | "question"
          | "commitment";
      }
      if (props.about) {
        node.about = props.about as string;
      }
      if (props.resolved !== undefined) {
        node.resolved = props.resolved as boolean;
      }

      // Cycle detection
      if (props.cycle_id) {
        node.cycleId = props.cycle_id as string;
      }
      if (props.cycle_type) {
        node.cycleType = props.cycle_type as "blocking" | "reinforcing";
      }

      // Pattern/cross-idea
      if (props.scope) {
        node.scope = props.scope as string;
      }
      if (props.instance_of) {
        node.instanceOf = props.instance_of as string;
      }
      if (props.portfolio_tag) {
        node.portfolioTag = props.portfolio_tag as string;
      }

      // Synthesis block
      if (props.synthesizes && Array.isArray(props.synthesizes)) {
        node.synthesizes = props.synthesizes as string[];
      }
      if (props.cluster_theme) {
        node.clusterTheme = props.cluster_theme as string;
      }

      // Source verifiability
      if (props.verifiable !== undefined) {
        node.verifiable = props.verifiable as boolean;
      }

      // Decision/Option additional properties
      if (props.decision_rationale) {
        node.decisionRationale = props.decision_rationale as string;
      }
      if (props.alternative_to && Array.isArray(props.alternative_to)) {
        node.alternativeTo = props.alternative_to as string[];
      }
      if (props.decision) {
        node.decision = props.decision as string;
      }

      // Cross-idea patterns
      if (props.shared_with && Array.isArray(props.shared_with)) {
        node.sharedWith = props.shared_with as string[];
      }

      // Derived block additional properties
      if (props.computed_at) {
        node.computedAt = props.computed_at as string;
      }

      // Action block additional properties
      if (props.assigned_to) {
        node.assignedTo = props.assigned_to as string;
      }
      if (props.outcome) {
        node.outcome = props.outcome as
          | "validated"
          | "invalidated"
          | "inconclusive";
      }

      // Placeholder block additional properties
      if (props.existence_confirmed !== undefined) {
        node.existenceConfirmed = props.existence_confirmed as boolean;
      }
      if (props.details_unknown !== undefined) {
        node.detailsUnknown = props.details_unknown as boolean;
      }
      if (props.partial_info && Array.isArray(props.partial_info)) {
        node.partialInfo = props.partial_info as string[];
      }

      // External block additional properties
      if (props.snapshot_date) {
        node.snapshotDate = props.snapshot_date as string;
      }

      // Cycle detection additional properties
      if (props.cycle_position !== undefined) {
        node.cyclePosition = props.cycle_position as number;
      }
      if (props.break_strategy) {
        node.breakStrategy = props.break_strategy as string;
      }
      if (props.break_point) {
        node.breakPoint = props.break_point as string;
      }

      // Context-qualified properties
      if (props.varies_by) {
        node.variesBy = props.varies_by as string;
      }

      // Assumption validation tracking
      if (props.validation_method) {
        node.validationMethod = props.validation_method as string;
      }
      if (props.validated_by) {
        node.validatedBy = props.validated_by as string;
      }
      if (props.validated_at) {
        node.validatedAt = props.validated_at as string;
      }

      // Evidence chain status
      if (props.evidence_status) {
        node.evidenceStatus = props.evidence_status as
          | "active"
          | "source_invalidated"
          | "source_superseded";
      }

      // Stakeholder view resolution
      if (props.incorporated_into) {
        node.incorporatedInto = props.incorporated_into as string;
      }
      if (props.overruled_reason) {
        node.overruledReason = props.overruled_reason as string;
      }

      return node;
    });
}

/**
 * Transform API links to GraphEdge format
 */
export function transformLinksToEdges(links: ApiLink[]): GraphEdge[] {
  return links.map((link) => {
    const props = link.properties;

    const edge: GraphEdge = {
      id: link.id,
      source: props.source,
      target: props.target,
      linkType: props.link_type as LinkType,
      status: (props.status as "active" | "superseded" | "removed") || "active",
    };

    if (props.degree) {
      edge.degree = props.degree as LinkDegree;
    }

    if (props.confidence !== undefined) {
      edge.confidence = props.confidence;
    }

    if (props.reason) {
      edge.reason = props.reason;
    }

    return edge;
  });
}

/**
 * Transform both blocks and links to complete graph data
 */
export function transformToGraphData(
  blocks: ApiBlock[],
  links: ApiLink[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: transformBlocksToNodes(blocks),
    edges: transformLinksToEdges(links),
  };
}

/**
 * Filter nodes by graph membership
 */
export function filterNodesByGraph(
  nodes: GraphNode[],
  graphTypes: GraphType[],
): GraphNode[] {
  if (graphTypes.length === 0) return nodes;
  return nodes.filter((node) =>
    node.graphMembership.some((g) => graphTypes.includes(g)),
  );
}

/**
 * Filter nodes by block type
 */
export function filterNodesByBlockType(
  nodes: GraphNode[],
  blockTypes: BlockType[],
): GraphNode[] {
  if (blockTypes.length === 0) return nodes;
  return nodes.filter((node) => blockTypes.includes(node.blockType));
}

/**
 * Filter nodes by status
 */
export function filterNodesByStatus(
  nodes: GraphNode[],
  statuses: BlockStatus[],
): GraphNode[] {
  if (statuses.length === 0) return nodes;
  return nodes.filter((node) => statuses.includes(node.status));
}

/**
 * Filter nodes by confidence range
 */
export function filterNodesByConfidence(
  nodes: GraphNode[],
  minConfidence: number,
  maxConfidence: number,
): GraphNode[] {
  return nodes.filter(
    (node) =>
      node.confidence >= minConfidence && node.confidence <= maxConfidence,
  );
}

/**
 * Filter nodes by abstraction level
 */
export function filterNodesByAbstractionLevel(
  nodes: GraphNode[],
  abstractionLevels: AbstractionLevel[],
): GraphNode[] {
  if (abstractionLevels.length === 0) return nodes;
  return nodes.filter(
    (node) =>
      node.abstractionLevel &&
      abstractionLevels.includes(node.abstractionLevel),
  );
}

/**
 * Filter edges to only include those connecting visible nodes
 */
export function filterEdgesByVisibleNodes(
  edges: GraphEdge[],
  nodeIds: Set<string>,
): GraphEdge[] {
  return edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
}

// ============================================================================
// Incremental Update Functions (for WebSocket real-time updates)
// ============================================================================

/**
 * Transform a single API block to GraphNode format
 * Used for incremental updates via WebSocket
 */
export function transformSingleBlockToNode(block: ApiBlock): GraphNode | null {
  if (block.type === "link") {
    return null; // Link blocks become edges, not nodes
  }

  const props = block.properties || {};

  const node: GraphNode = {
    id: block.id,
    label: createLabel(block.content || ""),
    blockType: block.type as BlockType,
    graphMembership: detectGraphMembership(props),
    status: (block.status as BlockStatus) || "active",
    confidence: extractConfidence(props),
    content: block.content || "",
    properties: props,
    createdAt: block.created_at || new Date().toISOString(),
    updatedAt: block.updated_at || new Date().toISOString(),
  };

  // Apply same property extractions as transformBlocksToNodes
  applyOptionalProperties(node, props);

  return node;
}

/**
 * Apply optional properties to a node based on properties object
 * Extracted for reuse in incremental updates
 */
function applyOptionalProperties(
  node: GraphNode,
  props: Record<string, unknown>,
): void {
  // Abstraction level
  if (props.abstraction_level) {
    node.abstractionLevel = props.abstraction_level as AbstractionLevel;
  }

  // Source attribution
  if (props.source_type) {
    node.sourceType = props.source_type as SourceType;
  }
  if (props.source_name) {
    node.sourceName = props.source_name as string;
  }
  if (props.source_date) {
    node.sourceDate = props.source_date as string;
  }

  // Temporal properties
  if (props.when) {
    node.when = props.when as string;
  }
  if (props.duration) {
    node.duration = props.duration as string;
  }
  if (props.planned_for) {
    node.plannedFor = props.planned_for as string;
  }
  if (props.valid_until) {
    node.validUntil = props.valid_until as string;
  }

  // Objectivity
  if (props.objectivity) {
    node.objectivity = props.objectivity as
      | "objective"
      | "subjective"
      | "mixed";
  }
  if (props.hypothetical !== undefined) {
    node.hypothetical = props.hypothetical as boolean;
  }
  if (props.condition) {
    node.condition = props.condition as string;
  }

  // Evidence chain
  if (props.evidence_strength) {
    node.evidenceStrength = props.evidence_strength as
      | "strong"
      | "moderate"
      | "weak";
  }
  if (props.derived_confidence !== undefined) {
    node.derivedConfidence = props.derived_confidence as number;
  }

  // Derived block
  if (props.formula) {
    node.formula = props.formula as string;
  }
  if (props.computed_value !== undefined) {
    node.computedValue = props.computed_value;
  }
  if (props.stale !== undefined) {
    node.stale = props.stale as boolean;
  }
  if (props.computed_at) {
    node.computedAt = props.computed_at as string;
  }

  // Action block
  if (props.action_type) {
    node.actionType = props.action_type as
      | "validate"
      | "research"
      | "build"
      | "decide"
      | "other";
  }
  if (props.required_count !== undefined) {
    node.requiredCount = props.required_count as number;
  }
  if (props.completed_count !== undefined) {
    node.completedCount = props.completed_count as number;
  }
  if (props.due_date) {
    node.dueDate = props.due_date as string;
  }
  if (props.assigned_to) {
    node.assignedTo = props.assigned_to as string;
  }
  if (props.outcome) {
    node.outcome = props.outcome as
      | "validated"
      | "invalidated"
      | "inconclusive";
  }

  // Assumption block
  if (props.implied_by) {
    node.impliedBy = props.implied_by as string;
  }
  if (props.surfaced_by) {
    node.surfacedBy = props.surfaced_by as "ai" | "user" | "advisor";
  }
  if (props.assumption_status) {
    node.assumptionStatus = props.assumption_status as
      | "unvalidated"
      | "validated"
      | "invalidated"
      | "dismissed";
  }
  if (props.criticality) {
    node.criticality = props.criticality as "critical" | "important" | "minor";
  }

  // Validation tracking
  if (props.validation_method) {
    node.validationMethod = props.validation_method as string;
  }
  if (props.validated_by) {
    node.validatedBy = props.validated_by as string;
  }
  if (props.validated_at) {
    node.validatedAt = props.validated_at as string;
  }

  // Decision/Option block
  if (props.topic) {
    node.topic = props.topic as string;
  }
  if (props.decided_option) {
    node.decidedOption = props.decided_option as string;
  }
  if (props.selection_status) {
    node.selectionStatus = props.selection_status as
      | "exploring"
      | "selected"
      | "rejected";
  }
  if (props.decision_rationale) {
    node.decisionRationale = props.decision_rationale as string;
  }
  if (props.alternative_to && Array.isArray(props.alternative_to)) {
    node.alternativeTo = props.alternative_to as string[];
  }
  if (props.decision) {
    node.decision = props.decision as string;
  }

  // Stakeholder view
  if (props.stakeholder) {
    node.stakeholder = props.stakeholder as string;
  }
  if (props.stakeholder_role) {
    node.stakeholderRole = props.stakeholder_role as
      | "decision_maker"
      | "domain_expert"
      | "advisor"
      | "team_member";
  }
  if (props.view_status) {
    node.viewStatus = props.view_status as
      | "active"
      | "adopted"
      | "overruled"
      | "withdrawn";
  }
  if (props.incorporated_into) {
    node.incorporatedInto = props.incorporated_into as string;
  }
  if (props.overruled_reason) {
    node.overruledReason = props.overruled_reason as string;
  }

  // Placeholder block
  if (props.placeholder_for) {
    node.placeholderFor = props.placeholder_for as string;
  }
  if (props.research_query) {
    node.researchQuery = props.research_query as string;
  }
  if (props.existence_confirmed !== undefined) {
    node.existenceConfirmed = props.existence_confirmed as boolean;
  }
  if (props.details_unknown !== undefined) {
    node.detailsUnknown = props.details_unknown as boolean;
  }
  if (props.partial_info && Array.isArray(props.partial_info)) {
    node.partialInfo = props.partial_info as string[];
  }

  // External block
  if (props.url) {
    node.url = props.url as string;
  }
  if (props.url_status) {
    node.urlStatus = props.url_status as
      | "alive"
      | "redirected"
      | "dead"
      | "changed";
  }
  if (props.domain_credibility) {
    node.domainCredibility = props.domain_credibility as
      | "high"
      | "medium"
      | "low"
      | "very_low";
  }
  if (props.snapshot_date) {
    node.snapshotDate = props.snapshot_date as string;
  }

  // Meta block
  if (props.meta_type) {
    node.metaType = props.meta_type as
      | "uncertainty"
      | "research_needed"
      | "assessment"
      | "question"
      | "commitment";
  }
  if (props.about) {
    node.about = props.about as string;
  }
  if (props.resolved !== undefined) {
    node.resolved = props.resolved as boolean;
  }

  // Cycle detection
  if (props.cycle_id) {
    node.cycleId = props.cycle_id as string;
  }
  if (props.cycle_type) {
    node.cycleType = props.cycle_type as "blocking" | "reinforcing";
  }
  if (props.cycle_position !== undefined) {
    node.cyclePosition = props.cycle_position as number;
  }
  if (props.break_strategy) {
    node.breakStrategy = props.break_strategy as string;
  }
  if (props.break_point) {
    node.breakPoint = props.break_point as string;
  }

  // Pattern/cross-idea
  if (props.scope) {
    node.scope = props.scope as string;
  }
  if (props.instance_of) {
    node.instanceOf = props.instance_of as string;
  }
  if (props.portfolio_tag) {
    node.portfolioTag = props.portfolio_tag as string;
  }
  if (props.shared_with && Array.isArray(props.shared_with)) {
    node.sharedWith = props.shared_with as string[];
  }

  // Synthesis block
  if (props.synthesizes && Array.isArray(props.synthesizes)) {
    node.synthesizes = props.synthesizes as string[];
  }
  if (props.cluster_theme) {
    node.clusterTheme = props.cluster_theme as string;
  }

  // Context-qualified
  if (props.varies_by) {
    node.variesBy = props.varies_by as string;
  }

  // Source verifiability
  if (props.verifiable !== undefined) {
    node.verifiable = props.verifiable as boolean;
  }

  // Evidence chain status
  if (props.evidence_status) {
    node.evidenceStatus = props.evidence_status as
      | "active"
      | "source_invalidated"
      | "source_superseded";
  }
}

/**
 * Transform a single API link to GraphEdge format
 * Used for incremental updates via WebSocket
 */
export function transformSingleLinkToEdge(
  link:
    | ApiLink
    | {
        id: string;
        link_type: string;
        source: string;
        target: string;
        degree?: string;
        confidence?: number;
        reason?: string;
        status?: string;
      },
): GraphEdge {
  // Handle both ApiLink format and direct WebSocket payload format
  const props = "properties" in link ? link.properties : link;

  const edge: GraphEdge = {
    id: link.id,
    source: props.source,
    target: props.target,
    linkType: props.link_type as LinkType,
    status: (props.status as "active" | "superseded" | "removed") || "active",
  };

  if (props.degree) {
    edge.degree = props.degree as LinkDegree;
  }

  if (props.confidence !== undefined) {
    edge.confidence = props.confidence;
  }

  if (props.reason) {
    edge.reason = props.reason;
  }

  return edge;
}

/**
 * Add a node to existing nodes array (immutable)
 * Returns new array with the node added
 */
export function addNodeToGraph(
  nodes: GraphNode[],
  newNode: GraphNode,
): GraphNode[] {
  // Check if node already exists
  const existingIndex = nodes.findIndex((n) => n.id === newNode.id);
  if (existingIndex >= 0) {
    // Update existing node
    return nodes.map((n, i) => (i === existingIndex ? newNode : n));
  }
  // Add new node
  return [...nodes, newNode];
}

/**
 * Update a node's properties in the nodes array (immutable)
 * Returns new array with the updated node
 */
export function updateNodeInGraph(
  nodes: GraphNode[],
  nodeId: string,
  updates: Partial<GraphNode>,
): GraphNode[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      : node,
  );
}

/**
 * Remove a node from the nodes array (immutable)
 * Returns new array without the node
 */
export function removeNodeFromGraph(
  nodes: GraphNode[],
  nodeId: string,
): GraphNode[] {
  return nodes.filter((n) => n.id !== nodeId);
}

/**
 * Add an edge to existing edges array (immutable)
 * Returns new array with the edge added
 */
export function addEdgeToGraph(
  edges: GraphEdge[],
  newEdge: GraphEdge,
): GraphEdge[] {
  // Check if edge already exists
  const existingIndex = edges.findIndex((e) => e.id === newEdge.id);
  if (existingIndex >= 0) {
    // Update existing edge
    return edges.map((e, i) => (i === existingIndex ? newEdge : e));
  }
  // Add new edge
  return [...edges, newEdge];
}

/**
 * Remove an edge from the edges array (immutable)
 * Returns new array without the edge
 */
export function removeEdgeFromGraph(
  edges: GraphEdge[],
  edgeId: string,
): GraphEdge[] {
  return edges.filter((e) => e.id !== edgeId);
}

/**
 * Remove all edges connected to a node (immutable)
 * Used when a node is removed
 */
export function removeEdgesForNode(
  edges: GraphEdge[],
  nodeId: string,
): GraphEdge[] {
  return edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
}
