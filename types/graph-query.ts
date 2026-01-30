/**
 * Graph Query Types
 *
 * These types define the query interface for the memory graph.
 * All agents use these types to request relevant subgraphs.
 */

// Valid graph dimensions (17 total)
export type GraphDimension =
  | "problem"
  | "solution"
  | "market"
  | "risk"
  | "fit"
  | "business"
  | "spec"
  | "distribution"
  | "marketing"
  | "manufacturing"
  | "user"
  | "competition"
  | "validation"
  | "tasks"
  | "timeline"
  | "customer"
  | "product";

// Valid block types (21 total)
export type BlockType =
  | "insight"
  | "fact"
  | "assumption"
  | "question"
  | "decision"
  | "action"
  | "requirement"
  | "option"
  | "pattern"
  | "synthesis"
  | "meta"
  | "constraint"
  | "blocker"
  | "epic"
  | "story"
  | "task"
  | "bug"
  | "persona"
  | "milestone"
  | "evaluation"
  | "learning";

// Block status options
export type BlockStatus =
  | "draft"
  | "active"
  | "validated"
  | "superseded"
  | "abandoned";

// Abstraction levels
export type AbstractionLevel =
  | "vision"
  | "strategy"
  | "tactic"
  | "implementation";

// Link types (21 total)
export type LinkType =
  | "addresses"
  | "creates"
  | "requires"
  | "conflicts"
  | "supports"
  | "depends_on"
  | "enables"
  | "suggests"
  | "supersedes"
  | "validates"
  | "invalidates"
  | "references"
  | "evidence_for"
  | "elaborates"
  | "refines"
  | "specializes"
  | "alternative_to"
  | "instance_of"
  | "constrained_by"
  | "derived_from"
  | "measured_by";

// Source types for block provenance
export type SourceType =
  | "conversation"
  | "artifact"
  | "memory_file"
  | "external"
  | "user_created"
  | "ai_generated";

// Query level - determines granularity of results
export type QueryLevel = "group" | "node" | "source";

/**
 * Main query interface for fetching from memory graph
 */
export interface GraphQuery {
  // Required: scope the query
  ideaId: string;
  version?: number; // Defaults to current version

  // Query level (default: node)
  level?: QueryLevel;

  // Filtering by classification
  graphMemberships?: GraphDimension[];
  blockTypes?: BlockType[];
  statuses?: BlockStatus[];
  abstractionLevels?: AbstractionLevel[];

  // Confidence filtering
  minConfidence?: number; // 0.0 - 1.0
  maxConfidence?: number;

  // Text search
  searchText?: string; // Searches title and content

  // Relationship traversal
  includeLinkedBlocks?: boolean;
  linkTypes?: LinkType[]; // Filter which links to traverse
  maxDepth?: number; // How many hops to traverse (default: 1)
  linkDirection?: "outgoing" | "incoming" | "both";

  // Source loading
  includeSources?: boolean;
  sourceTypes?: SourceType[];

  // Pagination
  limit?: number;
  offset?: number;

  // Ordering
  orderBy?: "created_at" | "updated_at" | "confidence" | "title";
  order?: "asc" | "desc";

  // Grouping (for analytics)
  groupBy?: "graphMembership" | "blockType" | "abstraction" | "status";

  // Include statistics
  includeStats?: boolean;
}

/**
 * Result types
 */
export interface GraphQueryResult {
  blocks: BlockResult[];
  links: LinkResult[];
  groups?: NodeGroupResult[]; // Only if level=group
  stats?: QueryStats;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface BlockResult {
  id: string;
  type: string;
  blockTypes: BlockType[];
  graphMemberships: GraphDimension[];
  title: string | null;
  content: string;
  properties: Record<string, unknown>;
  status: BlockStatus;
  confidence: number | null;
  abstractionLevel: AbstractionLevel | null;
  createdAt: string;
  updatedAt: string;

  // Relationships (if includeLinkedBlocks)
  linkedBlocks?: BlockResult[];

  // Sources (if includeSources)
  sources?: SourceResult[];
  sourceCount?: number;
}

export interface LinkResult {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  linkType: LinkType;
  degree: "full" | "partial" | "minimal" | null;
  confidence: number | null;
  reason: string | null;
  status: string;
}

export interface NodeGroupResult {
  id: string;
  name: string;
  summary: string | null;
  theme: string | null;
  blockCount: number;
  avgConfidence: number | null;
  dominantBlockTypes: BlockType[];
  keyInsights: string[];
  primaryGraphMembership: GraphDimension | null;
  blockIds: string[];
}

export interface SourceResult {
  id: string;
  blockId: string;
  sourceType: SourceType;
  sourceId: string;
  relevanceScore: number | null;
  mappingReason: string | null;
  content?: string; // Only if full content requested
  metadata?: Record<string, unknown>;
}

export interface QueryStats {
  totalBlocks: number;
  byBlockType: Record<BlockType, number>;
  byGraphMembership: Record<GraphDimension, number>;
  byStatus: Record<BlockStatus, number>;
  avgConfidence: number;
}
