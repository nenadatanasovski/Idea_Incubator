# Graph Query Service

Create `server/services/graph/graph-query-service.ts`:

```typescript
/**
 * GraphQueryService
 *
 * Provides typed query methods for fetching from the memory graph.
 * Used by all agents to retrieve relevant context.
 */

import { db } from "../../db";
import {
  memoryBlocks,
  memoryLinks,
  memoryGraphMemberships,
  memoryBlockTypes,
  memoryBlockSources,
  memoryNodeGroups,
  memoryNodeGroupBlocks,
} from "../../../schema";
import {
  eq,
  and,
  or,
  inArray,
  gte,
  lte,
  like,
  desc,
  asc,
  sql,
} from "drizzle-orm";
import type {
  GraphQuery,
  GraphQueryResult,
  BlockResult,
  LinkResult,
  NodeGroupResult,
  QueryStats,
} from "../../../types/graph-query";

export class GraphQueryService {
  /**
   * Execute a graph query and return matching blocks/links
   */
  async query(query: GraphQuery): Promise<GraphQueryResult> {
    const { ideaId, version = 1, level = "node" } = query;

    // Build base conditions
    const conditions = [eq(memoryBlocks.ideaId, ideaId)];

    // Add status filter
    if (query.statuses?.length) {
      conditions.push(inArray(memoryBlocks.status, query.statuses));
    } else {
      // Default: exclude abandoned
      conditions.push(sql`${memoryBlocks.status} != 'abandoned'`);
    }

    // Add confidence filter
    if (query.minConfidence !== undefined) {
      conditions.push(gte(memoryBlocks.confidence, query.minConfidence));
    }
    if (query.maxConfidence !== undefined) {
      conditions.push(lte(memoryBlocks.confidence, query.maxConfidence));
    }

    // Add text search
    if (query.searchText) {
      const searchPattern = `%${query.searchText}%`;
      conditions.push(
        or(
          like(memoryBlocks.title, searchPattern),
          like(memoryBlocks.content, searchPattern),
        ),
      );
    }

    // Add abstraction level filter
    if (query.abstractionLevels?.length) {
      conditions.push(
        inArray(memoryBlocks.abstractionLevel, query.abstractionLevels),
      );
    }

    // Execute main query
    let blocksQuery = db
      .select()
      .from(memoryBlocks)
      .where(and(...conditions));

    // Add ordering
    if (query.orderBy) {
      const orderColumn = {
        created_at: memoryBlocks.createdAt,
        updated_at: memoryBlocks.updatedAt,
        confidence: memoryBlocks.confidence,
        title: memoryBlocks.title,
      }[query.orderBy];

      blocksQuery =
        query.order === "desc"
          ? blocksQuery.orderBy(desc(orderColumn))
          : blocksQuery.orderBy(asc(orderColumn));
    }

    // Add pagination
    if (query.limit) {
      blocksQuery = blocksQuery.limit(query.limit);
    }
    if (query.offset) {
      blocksQuery = blocksQuery.offset(query.offset);
    }

    const rawBlocks = await blocksQuery;

    // Filter by graph memberships if specified
    let filteredBlockIds = rawBlocks.map((b) => b.id);

    if (query.graphMemberships?.length) {
      const memberships = await db
        .select()
        .from(memoryGraphMemberships)
        .where(
          and(
            inArray(memoryGraphMemberships.blockId, filteredBlockIds),
            inArray(memoryGraphMemberships.graphType, query.graphMemberships),
          ),
        );

      const membershipBlockIds = new Set(memberships.map((m) => m.blockId));
      filteredBlockIds = filteredBlockIds.filter((id) =>
        membershipBlockIds.has(id),
      );
    }

    // Filter by block types if specified
    if (query.blockTypes?.length) {
      const types = await db
        .select()
        .from(memoryBlockTypes)
        .where(
          and(
            inArray(memoryBlockTypes.blockId, filteredBlockIds),
            inArray(memoryBlockTypes.blockType, query.blockTypes),
          ),
        );

      const typeBlockIds = new Set(types.map((t) => t.blockId));
      filteredBlockIds = filteredBlockIds.filter((id) => typeBlockIds.has(id));
    }

    // Get final blocks
    const blocks = rawBlocks.filter((b) => filteredBlockIds.includes(b.id));

    // Fetch block types and memberships for results
    const blockIds = blocks.map((b) => b.id);

    const [allMemberships, allTypes] = await Promise.all([
      blockIds.length
        ? db
            .select()
            .from(memoryGraphMemberships)
            .where(inArray(memoryGraphMemberships.blockId, blockIds))
        : [],
      blockIds.length
        ? db
            .select()
            .from(memoryBlockTypes)
            .where(inArray(memoryBlockTypes.blockId, blockIds))
        : [],
    ]);

    // Build membership and type maps
    const membershipMap = new Map<string, string[]>();
    for (const m of allMemberships) {
      if (!membershipMap.has(m.blockId)) membershipMap.set(m.blockId, []);
      membershipMap.get(m.blockId)!.push(m.graphType);
    }

    const typeMap = new Map<string, string[]>();
    for (const t of allTypes) {
      if (!typeMap.has(t.blockId)) typeMap.set(t.blockId, []);
      typeMap.get(t.blockId)!.push(t.blockType);
    }

    // Fetch links
    const links = blockIds.length
      ? await db
          .select()
          .from(memoryLinks)
          .where(
            or(
              inArray(memoryLinks.sourceBlockId, blockIds),
              inArray(memoryLinks.targetBlockId, blockIds),
            ),
          )
      : [];

    // Build result
    const blockResults: BlockResult[] = blocks.map((b) => ({
      id: b.id,
      type: b.type,
      blockTypes: (typeMap.get(b.id) || []) as any,
      graphMemberships: (membershipMap.get(b.id) || []) as any,
      title: b.title,
      content: b.content,
      properties: b.properties ? JSON.parse(b.properties) : {},
      status: b.status as any,
      confidence: b.confidence,
      abstractionLevel: b.abstractionLevel as any,
      createdAt: b.createdAt || "",
      updatedAt: b.updatedAt || "",
    }));

    const linkResults: LinkResult[] = links.map((l) => ({
      id: l.id,
      sourceBlockId: l.sourceBlockId,
      targetBlockId: l.targetBlockId,
      linkType: l.linkType as any,
      degree: l.degree as any,
      confidence: l.confidence,
      reason: l.reason,
      status: l.status || "active",
    }));

    // Calculate stats if requested
    let stats: QueryStats | undefined;
    if (query.includeStats) {
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
        limit: query.limit || totalCount,
        offset: query.offset || 0,
        hasMore: (query.offset || 0) + blockResults.length < totalCount,
      },
    };
  }

  /**
   * Get blocks by specific IDs with full details
   */
  async getBlocksByIds(blockIds: string[]): Promise<BlockResult[]> {
    if (!blockIds.length) return [];

    const result = await this.query({
      ideaId: "", // Will be overridden
      // Custom handling needed - this is a simplified version
    });

    return result.blocks.filter((b) => blockIds.includes(b.id));
  }

  /**
   * Get node groups for an idea
   */
  async getNodeGroups(
    ideaId: string,
    version: number,
  ): Promise<NodeGroupResult[]> {
    const groups = await db
      .select()
      .from(memoryNodeGroups)
      .where(
        and(
          eq(memoryNodeGroups.ideaId, ideaId),
          eq(memoryNodeGroups.version, version),
        ),
      );

    const groupIds = groups.map((g) => g.id);

    const groupBlocks = groupIds.length
      ? await db
          .select()
          .from(memoryNodeGroupBlocks)
          .where(inArray(memoryNodeGroupBlocks.groupId, groupIds))
      : [];

    const blockMap = new Map<string, string[]>();
    for (const gb of groupBlocks) {
      if (!blockMap.has(gb.groupId)) blockMap.set(gb.groupId, []);
      blockMap.get(gb.groupId)!.push(gb.blockId);
    }

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      summary: g.summary,
      theme: g.theme,
      blockCount: g.blockCount || 0,
      avgConfidence: g.avgConfidence,
      dominantBlockTypes: g.dominantBlockTypes
        ? JSON.parse(g.dominantBlockTypes)
        : [],
      keyInsights: g.keyInsights ? JSON.parse(g.keyInsights) : [],
      primaryGraphMembership: g.primaryGraphMembership as any,
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
}

// Export singleton instance
export const graphQueryService = new GraphQueryService();
```
