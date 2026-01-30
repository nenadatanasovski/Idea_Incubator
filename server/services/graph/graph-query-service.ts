/**
 * GraphQueryService
 *
 * Provides typed query methods for fetching from the memory graph.
 * Used by all agents to retrieve relevant context.
 */

import { query as dbQuery } from "../../../database/db.js";
import type {
  GraphQuery,
  GraphQueryResult,
  BlockResult,
  LinkResult,
  NodeGroupResult,
  QueryStats,
  GraphDimension,
  BlockType,
  BlockStatus,
  AbstractionLevel,
} from "../../../types/graph-query.js";

// Re-export types for consumers
export type { GraphQuery, GraphQueryResult, BlockResult, LinkResult };

export class GraphQueryService {
  /**
   * Execute a graph query and return matching blocks/links
   */
  async query(graphQuery: GraphQuery): Promise<GraphQueryResult> {
    const { ideaId, version = 1, level = "node" } = graphQuery;

    // Get session IDs for this idea (using idea_slug column)
    const sessions = await dbQuery<{ id: string }>(
      `SELECT id FROM ideation_sessions WHERE idea_slug = ?`,
      [ideaId],
    );

    if (sessions.length === 0) {
      return {
        blocks: [],
        links: [],
        pagination: {
          total: 0,
          limit: graphQuery.limit || 100,
          offset: 0,
          hasMore: false,
        },
      };
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionPlaceholders = sessionIds.map(() => "?").join(",");

    // Build WHERE conditions
    const conditions: string[] = [`session_id IN (${sessionPlaceholders})`];
    const params: any[] = [...sessionIds];

    // Add status filter
    if (graphQuery.statuses?.length) {
      const statusPlaceholders = graphQuery.statuses.map(() => "?").join(",");
      conditions.push(`status IN (${statusPlaceholders})`);
      params.push(...graphQuery.statuses);
    } else {
      conditions.push(`status != 'abandoned'`);
    }

    // Add confidence filter
    if (graphQuery.minConfidence !== undefined) {
      conditions.push(`confidence >= ?`);
      params.push(graphQuery.minConfidence);
    }
    if (graphQuery.maxConfidence !== undefined) {
      conditions.push(`confidence <= ?`);
      params.push(graphQuery.maxConfidence);
    }

    // Add text search
    if (graphQuery.searchText) {
      conditions.push(`(title LIKE ? OR content LIKE ?)`);
      const searchPattern = `%${graphQuery.searchText}%`;
      params.push(searchPattern, searchPattern);
    }

    // Add abstraction level filter
    if (graphQuery.abstractionLevels?.length) {
      const levelPlaceholders = graphQuery.abstractionLevels
        .map(() => "?")
        .join(",");
      conditions.push(`abstraction_level IN (${levelPlaceholders})`);
      params.push(...graphQuery.abstractionLevels);
    }

    // Build ORDER BY
    let orderBy = "created_at DESC";
    if (graphQuery.orderBy) {
      const orderColumn = {
        created_at: "created_at",
        updated_at: "updated_at",
        confidence: "confidence",
        title: "title",
      }[graphQuery.orderBy];
      if (orderColumn) {
        orderBy = `${orderColumn} ${graphQuery.order === "asc" ? "ASC" : "DESC"}`;
      }
    }

    // Build LIMIT/OFFSET
    let limitClause = "";
    if (graphQuery.limit) {
      limitClause = ` LIMIT ${graphQuery.limit}`;
      if (graphQuery.offset) {
        limitClause += ` OFFSET ${graphQuery.offset}`;
      }
    }

    // Execute main query
    const sql = `
      SELECT * FROM memory_blocks
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      ${limitClause}
    `;

    const rawBlocks = await dbQuery<any>(sql, params);

    // Filter by graph memberships if specified
    let filteredBlockIds = rawBlocks.map((b: any) => b.id);

    if (graphQuery.graphMemberships?.length && filteredBlockIds.length > 0) {
      const blockPlaceholders = filteredBlockIds.map(() => "?").join(",");
      const membershipPlaceholders = graphQuery.graphMemberships
        .map(() => "?")
        .join(",");

      const memberships = await dbQuery<{ block_id: string }>(
        `SELECT DISTINCT block_id FROM memory_graph_memberships
         WHERE block_id IN (${blockPlaceholders})
         AND graph_type IN (${membershipPlaceholders})`,
        [...filteredBlockIds, ...graphQuery.graphMemberships],
      );

      const membershipBlockIds = new Set(memberships.map((m) => m.block_id));
      filteredBlockIds = filteredBlockIds.filter((id: string) =>
        membershipBlockIds.has(id),
      );
    }

    // Filter by block types if specified
    if (graphQuery.blockTypes?.length && filteredBlockIds.length > 0) {
      const blockPlaceholders = filteredBlockIds.map(() => "?").join(",");
      const typePlaceholders = graphQuery.blockTypes.map(() => "?").join(",");

      const types = await dbQuery<{ block_id: string }>(
        `SELECT DISTINCT block_id FROM memory_block_types
         WHERE block_id IN (${blockPlaceholders})
         AND block_type IN (${typePlaceholders})`,
        [...filteredBlockIds, ...graphQuery.blockTypes],
      );

      const typeBlockIds = new Set(types.map((t) => t.block_id));
      filteredBlockIds = filteredBlockIds.filter((id: string) =>
        typeBlockIds.has(id),
      );
    }

    // Get final blocks
    const blocks = rawBlocks.filter((b: any) =>
      filteredBlockIds.includes(b.id),
    );
    const blockIds = blocks.map((b: any) => b.id);

    // Fetch block types and memberships
    let allMemberships: any[] = [];
    let allTypes: any[] = [];

    if (blockIds.length > 0) {
      const blockPlaceholders = blockIds.map(() => "?").join(",");

      [allMemberships, allTypes] = await Promise.all([
        dbQuery<any>(
          `SELECT block_id, graph_type FROM memory_graph_memberships
           WHERE block_id IN (${blockPlaceholders})`,
          blockIds,
        ),
        dbQuery<any>(
          `SELECT block_id, block_type FROM memory_block_types
           WHERE block_id IN (${blockPlaceholders})`,
          blockIds,
        ),
      ]);
    }

    // Build membership and type maps
    const membershipMap = new Map<string, string[]>();
    for (const m of allMemberships) {
      if (!membershipMap.has(m.block_id)) membershipMap.set(m.block_id, []);
      membershipMap.get(m.block_id)!.push(m.graph_type);
    }

    const typeMap = new Map<string, string[]>();
    for (const t of allTypes) {
      if (!typeMap.has(t.block_id)) typeMap.set(t.block_id, []);
      typeMap.get(t.block_id)!.push(t.block_type);
    }

    // Fetch links
    let links: any[] = [];
    if (blockIds.length > 0) {
      const blockPlaceholders = blockIds.map(() => "?").join(",");
      links = await dbQuery<any>(
        `SELECT * FROM memory_links
         WHERE source_block_id IN (${blockPlaceholders})
         OR target_block_id IN (${blockPlaceholders})`,
        [...blockIds, ...blockIds],
      );
    }

    // Build result
    const blockResults: BlockResult[] = blocks.map((b: any) => ({
      id: b.id,
      type: b.type,
      blockTypes: (typeMap.get(b.id) || []) as BlockType[],
      graphMemberships: (membershipMap.get(b.id) || []) as GraphDimension[],
      title: b.title,
      content: b.content,
      properties: b.properties ? JSON.parse(b.properties) : {},
      status: b.status as BlockStatus,
      confidence: b.confidence,
      abstractionLevel: b.abstraction_level as AbstractionLevel | null,
      createdAt: b.created_at || "",
      updatedAt: b.updated_at || "",
    }));

    const linkResults: LinkResult[] = links.map((l: any) => ({
      id: l.id,
      sourceBlockId: l.source_block_id,
      targetBlockId: l.target_block_id,
      linkType: l.link_type,
      degree: l.degree,
      confidence: l.confidence,
      reason: l.reason,
      status: l.status || "active",
    }));

    // Calculate stats if requested
    let stats: QueryStats | undefined;
    if (graphQuery.includeStats) {
      stats = this.calculateStats(blockResults);
    }

    // Handle node groups if level=group
    let groups: NodeGroupResult[] | undefined;
    if (level === "group") {
      groups = await this.getNodeGroups(ideaId, version);
    }

    // Get total count for pagination
    const totalCount = filteredBlockIds.length;

    return {
      blocks: blockResults,
      links: linkResults,
      groups,
      stats,
      pagination: {
        total: totalCount,
        limit: graphQuery.limit || totalCount,
        offset: graphQuery.offset || 0,
        hasMore: (graphQuery.offset || 0) + blockResults.length < totalCount,
      },
    };
  }

  /**
   * Get blocks by specific IDs with full details
   */
  async getBlocksByIds(blockIds: string[]): Promise<BlockResult[]> {
    if (!blockIds.length) return [];

    const blockPlaceholders = blockIds.map(() => "?").join(",");

    const blocks = await dbQuery<any>(
      `SELECT * FROM memory_blocks WHERE id IN (${blockPlaceholders})`,
      blockIds,
    );

    const [allMemberships, allTypes] = await Promise.all([
      dbQuery<any>(
        `SELECT block_id, graph_type FROM memory_graph_memberships
         WHERE block_id IN (${blockPlaceholders})`,
        blockIds,
      ),
      dbQuery<any>(
        `SELECT block_id, block_type FROM memory_block_types
         WHERE block_id IN (${blockPlaceholders})`,
        blockIds,
      ),
    ]);

    const membershipMap = new Map<string, string[]>();
    for (const m of allMemberships) {
      if (!membershipMap.has(m.block_id)) membershipMap.set(m.block_id, []);
      membershipMap.get(m.block_id)!.push(m.graph_type);
    }

    const typeMap = new Map<string, string[]>();
    for (const t of allTypes) {
      if (!typeMap.has(t.block_id)) typeMap.set(t.block_id, []);
      typeMap.get(t.block_id)!.push(t.block_type);
    }

    return blocks.map((b: any) => ({
      id: b.id,
      type: b.type,
      blockTypes: (typeMap.get(b.id) || []) as BlockType[],
      graphMemberships: (membershipMap.get(b.id) || []) as GraphDimension[],
      title: b.title,
      content: b.content,
      properties: b.properties ? JSON.parse(b.properties) : {},
      status: b.status as BlockStatus,
      confidence: b.confidence,
      abstractionLevel: b.abstraction_level as AbstractionLevel | null,
      createdAt: b.created_at || "",
      updatedAt: b.updated_at || "",
    }));
  }

  /**
   * Get node groups for an idea
   */
  async getNodeGroups(
    ideaId: string,
    version: number,
  ): Promise<NodeGroupResult[]> {
    const groups = await dbQuery<any>(
      `SELECT * FROM memory_node_groups WHERE idea_id = ? AND version = ?`,
      [ideaId, version],
    );

    const groupIds = groups.map((g: any) => g.id);

    let groupBlocks: any[] = [];
    if (groupIds.length > 0) {
      const groupPlaceholders = groupIds.map(() => "?").join(",");
      groupBlocks = await dbQuery<any>(
        `SELECT group_id, block_id FROM memory_node_group_blocks
         WHERE group_id IN (${groupPlaceholders})`,
        groupIds,
      );
    }

    const blockMap = new Map<string, string[]>();
    for (const gb of groupBlocks) {
      if (!blockMap.has(gb.group_id)) blockMap.set(gb.group_id, []);
      blockMap.get(gb.group_id)!.push(gb.block_id);
    }

    return groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      summary: g.summary,
      theme: g.theme,
      blockCount: g.block_count || 0,
      avgConfidence: g.avg_confidence,
      dominantBlockTypes: g.dominant_block_types
        ? JSON.parse(g.dominant_block_types)
        : [],
      keyInsights: g.key_insights ? JSON.parse(g.key_insights) : [],
      primaryGraphMembership:
        g.primary_graph_membership as GraphDimension | null,
      blockIds: blockMap.get(g.id) || [],
    }));
  }

  /**
   * Calculate statistics for a set of blocks
   */
  private calculateStats(blocks: BlockResult[]): QueryStats {
    const byBlockType: Record<string, number> = {};
    const byGraphMembership: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const block of blocks) {
      // Count block types
      for (const type of block.blockTypes) {
        byBlockType[type] = (byBlockType[type] || 0) + 1;
      }

      // Count graph memberships
      for (const membership of block.graphMemberships) {
        byGraphMembership[membership] =
          (byGraphMembership[membership] || 0) + 1;
      }

      // Count statuses
      byStatus[block.status] = (byStatus[block.status] || 0) + 1;

      // Sum confidence
      if (block.confidence !== null) {
        totalConfidence += block.confidence;
        confidenceCount++;
      }
    }

    return {
      totalBlocks: blocks.length,
      byBlockType: byBlockType as any,
      byGraphMembership: byGraphMembership as any,
      byStatus: byStatus as any,
      avgConfidence:
        confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }

  // ============================================================================
  // Ideation Agent Queries
  // ============================================================================

  /**
   * Get user profile blocks for personalization
   */
  async getUserProfile(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["user"],
      blockTypes: ["fact", "constraint", "insight"],
      statuses: ["active", "validated"],
      orderBy: "confidence",
      order: "desc",
    });
  }

  /**
   * Get problem/solution understanding
   */
  async getProblemSolution(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["problem", "solution"],
      includeLinkedBlocks: true,
      linkTypes: ["addresses", "creates", "requires"],
      statuses: ["active", "validated"],
    });
  }

  /**
   * Get market and competition context
   */
  async getMarketContext(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["market", "competition"],
      blockTypes: ["fact", "insight", "assumption"],
      minConfidence: 0.5,
      statuses: ["active", "validated"],
    });
  }

  // ============================================================================
  // Spec Agent Queries
  // ============================================================================

  /**
   * Get all requirements and constraints for spec generation
   */
  async getSpecRequirements(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["spec"],
      blockTypes: ["requirement", "constraint", "decision"],
      statuses: ["active", "validated"],
      includeLinkedBlocks: true,
      linkTypes: ["requires", "constrained_by", "depends_on"],
    });
  }

  /**
   * Get validation evidence for spec
   */
  async getValidationEvidence(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["validation"],
      blockTypes: ["fact", "evaluation"],
      includeSources: true,
    });
  }

  // ============================================================================
  // Build Agent Queries
  // ============================================================================

  /**
   * Get task context for build agent
   */
  async getTaskContext(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["tasks"],
      blockTypes: ["epic", "story", "task", "bug"],
      statuses: ["active"],
      orderBy: "created_at",
      order: "asc",
    });
  }

  /**
   * Get requirements relevant to a specific task
   */
  async getTaskRequirements(
    _ideaId: string, // kept for API consistency
    taskBlockId: string,
  ): Promise<GraphQueryResult> {
    // Get links from the task
    const links = await dbQuery<any>(
      `SELECT * FROM memory_links
       WHERE source_block_id = ?
       AND link_type IN ('requires', 'addresses', 'depends_on')`,
      [taskBlockId],
    );

    const linkedBlockIds = links.map((l: any) => l.target_block_id);

    if (!linkedBlockIds.length) {
      return {
        blocks: [],
        links: [],
        pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
      };
    }

    // Fetch the linked blocks
    const blocks = await this.getBlocksByIds(linkedBlockIds);
    return {
      blocks,
      links: [],
      pagination: {
        total: blocks.length,
        limit: blocks.length,
        offset: 0,
        hasMore: false,
      },
    };
  }

  /**
   * Get gotchas and patterns from SIA
   */
  async getLearnings(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      blockTypes: ["learning", "pattern"],
      minConfidence: 0.7,
      statuses: ["active", "validated"],
      orderBy: "confidence",
      order: "desc",
      limit: 20,
    });
  }

  // ============================================================================
  // SIA Agent Queries
  // ============================================================================

  /**
   * Get execution context for learning extraction
   */
  async getExecutionContext(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["tasks", "spec"],
      blockTypes: ["task", "bug", "decision"],
      includeSources: true,
    });
  }

  /**
   * Check for existing learnings (for duplicate detection)
   */
  async getExistingLearnings(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      blockTypes: ["learning", "pattern"],
    });
  }

  // ============================================================================
  // Marketing Agent Queries
  // ============================================================================

  /**
   * Get positioning and marketing context
   */
  async getMarketingContext(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["marketing", "competition", "customer"],
      blockTypes: ["insight", "fact", "persona", "decision"],
    });
  }

  /**
   * Get distribution strategy blocks
   */
  async getDistributionStrategy(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["distribution", "marketing"],
      blockTypes: ["decision", "option", "action"],
    });
  }

  /**
   * Get customer personas
   */
  async getCustomerPersonas(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      graphMemberships: ["customer"],
      blockTypes: ["persona"],
      statuses: ["active", "validated"],
    });
  }

  // ============================================================================
  // Evaluation Queries
  // ============================================================================

  /**
   * Get all evaluations for an idea
   */
  async getEvaluations(ideaId: string): Promise<GraphQueryResult> {
    return this.query({
      ideaId,
      blockTypes: ["evaluation"],
      includeSources: true,
      orderBy: "created_at",
      order: "desc",
    });
  }

  // ============================================================================
  // Readiness Check Methods
  // ============================================================================

  /**
   * Check spec generation readiness
   */
  async checkSpecReadiness(ideaId: string): Promise<{
    ready: boolean;
    score: number;
    missing: string[];
  }> {
    const result = await this.query({
      ideaId,
      graphMemberships: ["problem", "solution", "spec"],
      includeStats: true,
    });

    const missing: string[] = [];

    // Handle case where no data exists yet
    if (!result.stats || result.blocks.length === 0) {
      return {
        ready: false,
        score: 0,
        missing: [
          "Problem definition blocks",
          "Solution description blocks",
          "Requirements",
        ],
      };
    }

    const stats = result.stats;

    if (!stats.byGraphMembership.problem) {
      missing.push("Problem definition blocks");
    }
    if (!stats.byGraphMembership.solution) {
      missing.push("Solution description blocks");
    }
    if (!stats.byBlockType.requirement) {
      missing.push("Requirements");
    }

    const score = Math.max(0, 100 - missing.length * 25);

    return {
      ready: missing.length === 0,
      score,
      missing,
    };
  }

  /**
   * Check marketing/launch readiness
   */
  async checkLaunchReadiness(ideaId: string): Promise<{
    ready: boolean;
    score: number;
    missing: string[];
  }> {
    const result = await this.query({
      ideaId,
      graphMemberships: ["marketing", "customer", "distribution"],
      includeStats: true,
    });

    const missing: string[] = [];

    // Handle case where no data exists yet
    if (!result.stats || result.blocks.length === 0) {
      return {
        ready: false,
        score: 0,
        missing: [
          "Customer personas",
          "Marketing strategy blocks",
          "Distribution channel blocks",
        ],
      };
    }

    const stats = result.stats;

    if (!stats.byBlockType.persona) {
      missing.push("Customer personas");
    }
    if (!stats.byGraphMembership.marketing) {
      missing.push("Marketing strategy blocks");
    }
    if (!stats.byGraphMembership.distribution) {
      missing.push("Distribution channel blocks");
    }

    const score = Math.max(0, 100 - missing.length * 25);

    return {
      ready: missing.length === 0,
      score,
      missing,
    };
  }

  // ============================================================================
  // Source Content Methods
  // ============================================================================

  /**
   * Get sources for a specific block
   */
  async getBlockSources(
    blockId: string,
    includeContent = false,
  ): Promise<
    Array<{
      sourceId: string;
      sourceType: string;
      content?: string;
      location?: string;
    }>
  > {
    const sources = await dbQuery<any>(
      `SELECT
         mbs.id,
         mbs.source_type,
         mbs.source_id,
         mbs.location,
         mbs.content
       FROM memory_block_sources mbs
       WHERE mbs.block_id = ?`,
      [blockId],
    );

    return sources.map((s: any) => ({
      sourceId: s.source_id,
      sourceType: s.source_type,
      location: s.location,
      content: includeContent ? s.content : undefined,
    }));
  }
}

// Export singleton instance
export const graphQueryService = new GraphQueryService();
